// Display, sound and control options -- Terminal.asm conf_page1, 2 and 4.
//
// The configuration menu is not the shop terminal. KIescape (TMapMain.asm)
// binds Esc to `terminal = -1`, which InitTerminal reads as "configuration"
// rather than "terminal", and it has its own root pages: conf_page0 in game
// (RETURN TO GAME / WINDOW / SOUND / KEYBOARD / CONTROLS / QUIT) and
// conf_page0p at the title (START GAME / ... / GAME OPTIONS / CREDITS / QUIT).
//
//   WINDOW SIZE   eight steps, ViewSizeTable in TMapMain.asm:
//                 96x60 128x80 160x100 192x120 224x140 256x160 288x180 320x200
//   PIXEL SIZE    pixel_type: bit 0 doubles height, bit 1 doubles width, so
//                 1x1 2x1 1x2 2x2. The 3D view is rendered at the reduced
//                 resolution and each pixel expanded -- the original's way of
//                 buying frame rate, and the reason ComputeVars recalculates
//                 windowXratio and windowYratio from the *pixel* dimensions.
//   SIGHT         the crosshair, on or off
//   MUSIC VOLUME  1..4        MUSIC STATE  on/off      AUDIO FILTER  on/off
//
// conf_page4 is CONTROL CONFIGURATION, and its six speed/inertia selectors are
// really wired: InitConfigVars converts the engine variables into menu indices
// on entry and AdjustConfigVars converts them back on exit. Those two routines
// are the whole definition of what each menu position means, so the tables
// below are transcriptions of them rather than anything chosen here:
//
//   PlayerWalkSpeed    = (WalkSpeed   + 4) << 4     WalkSpeed   0..3
//   PlayerRunSpeed     = (PWalkSpeed  + 4) << 4     PWalkSpeed  0..3
//   PlayerRotWalkSpeed = (RotSpeed  << 2) +  8      RotSpeed    0..5
//   PlayerRotRunSpeed  = (PRotSpeed << 2) +  8      PRotSpeed   0..5
//   PlayerAccel        = (WalkInertia << 1 || 1) + 2   HIGH/MID/LOW
//   PlayerRotAccel     = 1 << RotInertia               HIGH/MID/LOW
//
// Note the inertia lists read HIGH, MID, LOW while the numbers they produce go
// *up*: "HIGH inertia" means a small acceleration, so the player takes longer
// to reach full speed. TMapMain's defaults are PlayerWalkSpeed 4<<4,
// PlayerRunSpeed 6<<4, PlayerRotWalkSpeed 8, PlayerRotRunSpeed 20, and both
// accelerations 4 -- which invert to the menu indices used below.
//
// The renderer is already resolution-independent -- windowXratio and
// windowYratio keep the projection identical at every size -- so a smaller
// window really is the same view, drawn smaller, not a cropped one.

export const VIEW_AREA_H = 200;                 // the 3D window inside the screen

export class Config {
  constructor(manifest) {
    const c = manifest.terminal?.config ?? {};
    this.windowSizes = c.windowSizes ?? [[320, 200]];
    this.pixelSizes = c.pixelSizes ?? [[1, 1]];
    this.musicVolumes = c.musicVolumes ?? [1, 2, 3, 4];
    this.windowSize = this.windowSizes.length - 1;   // full size
    this.pixelSize = 0;                              // 1x1
    this.renderScale = 0;           // index into SCALES: 1x, 2x, 4x
    // HD ART is separate from RENDER SCALE on purpose. The scale changes how
    // many pixels the engine draws; this changes how detailed the art it draws
    // with is. They are useful independently -- HD art is a visible improvement
    // even at 1x, and 4x is worth having on the original art.
    this.hdArt = false;
    this.sight = true;
    this.musicVolume = this.musicVolumes.length - 1;
    this.musicOn = true;
    // TMapMain: `move.w #1,FilterState(a5)`. The LED filter is ON by default,
    // and InitAudio2 reads a non-zero FilterState as "clear bit 1 of $bfe001",
    // which switches the filter in. The port had this off, so every sound and
    // the music ran unfiltered.
    this.filter = true;
    // Whether the player has ASKED for sound, which is not the same as whether
    // the music is enabled in the game's own sound menu (MusicOnOff). A browser
    // will not start audio without a gesture, and guessing wrong means either
    // silence that looks broken or noise nobody asked for -- so the game starts
    // quiet and the speaker button in the bar is the gesture that starts it.
    // The choice is remembered, and on a later visit the first click restores
    // it rather than waiting for the button again.
    this.audioOn = false;

    // conf_page4. Defaults are TMapMain's engine values run backwards through
    // InitConfigVars, so entering the menu and leaving it changes nothing.
    // A deliberate departure: TMapMain does `clr.w ActiveControl(a5)`, so the
    // original boots into KEYBOARD. Mouse look is what anyone reaches for in a
    // first-person game now, and the mouse mode is the original's own -- this
    // starts on it rather than making people find the menu first. Set CONTROL
    // to KEYBOARD under Esc -> CONTROLS for the original's behaviour, and a
    // saved configuration overrides this either way.
    this.control = 1;               // 0 KEYBOARD, 1 MOUSE (ActiveControl)
    this.mouseSensitivity = 5;      // 0..8, TMapMain sets 5
    this.mouseLook = true;          // an addition; see input.js
    this.storedKeys = { keyboard: Config.defaultKeys(false),
                        mouse: Config.defaultKeys(true) };
    this.keys = Config.defaultKeys(this.control === 1);
    this.walkSpeed = 0;             // (0+4)<<4 =  64
    this.runSpeed = 2;              // (2+4)<<4 =  96
    this.rotSpeed = 0;              // (0<<2)+8 =   8
    this.rotRunSpeed = 3;           // (3<<2)+8 =  20
    this.walkInertia = 1;           // MID -> PlayerAccel    4
    this.rotInertia = 2;            // LOW -> PlayerRotAccel 4
  }

  // ---- AdjustConfigVars: menu index -> engine variable -------------------
  // Walk speeds are in 1/16 of a world unit per tick; rotation speeds are in
  // 1/2048 of a turn per tick.
  get playerWalkSpeed() { return ((this.walkSpeed + 4) << 4) / 16; }
  get playerRunSpeed() { return ((this.runSpeed + 4) << 4) / 16; }
  get playerRotWalkSpeed() { return (this.rotSpeed << 2) + 8; }
  get playerRotRunSpeed() { return (this.rotRunSpeed << 2) + 8; }
  get playerAccel() { return (((this.walkInertia << 1) || 1) + 2) / 16; }
  get playerRotAccel() { return 1 << this.rotInertia; }
  get mouseOn() { return this.control === 1; }

  /**
   * The port's own: render the 3D view at 1x, 2x or 4x the Amiga's resolution.
   *
   * This costs nothing in fidelity because the engine was already resolution
   * independent -- ComputeVars derives windowXratio and windowYratio from the
   * pixel dimensions, which is what let the original offer eight window sizes
   * from one renderer. Pushing past 320x200 is the same mechanism used in the
   * other direction, and `sizecheck` measures the projection as identical at
   * every size: the field of view stays 63.9 degrees and coverage stays 100%.
   *
   * What changes is only what a higher sampling rate ever changes -- geometry
   * edges get sharper while textures, which are 64x64 for a 64-unit block, get
   * correspondingly softer. That is the same trade every high-resolution port
   * of a 1990s software renderer makes.
   *
   * The UI is composited at the same integer scale rather than redrawn, so the
   * panel and text stay chunky over a sharp view, which is how those ports look
   * too.
   */
  static SCALES = [1, 2, 4];

  get scale() { return Config.SCALES[this.renderScale] ?? 1; }

  /** Pixel dimensions the renderer should draw at, before expansion. */
  renderSize() {
    const [w, h] = this.windowSizes[this.windowSize];
    const [pw, ph] = this.pixelSizes[this.pixelSize];
    const s = this.scale;
    return [Math.max(1, Math.floor(w * s / pw)), Math.max(1, Math.floor(h * s / ph))];
  }

  /** Size the view occupies on screen once pixels are expanded. */
  screenSize() {
    const [w, h] = this.windowSizes[this.windowSize];
    const s = this.scale;
    return [w * s, h * s];
  }

  pixelScale() {
    return this.pixelSizes[this.pixelSize];
  }

  /** Top-left corner that centres the view in the window area, at this scale. */
  origin(screenW) {
    const [w, h] = this.screenSize();
    const s = this.scale;
    return [(screenW * s - w) >> 1, (VIEW_AREA_H * s - h) >> 1];
  }

  // Loader.asm:ReadConfig/WriteConfig keep a BREATHLESS:Config file holding the
  // window, sound and control settings, the key tables, and the last level
  // code. The per-mode key tables and every other browser-relevant field
  // round-trip through localStorage.
  // conf_page5's SAVE CONFIGURATION is a menu item in the original -- saving on
  // every change is the same result without a step to forget.
  // conf_page3, KEYS CONFIGURATION: thirteen rebindable actions, in the order
  // the page lists them. Each default is the original's key plus the browser
  // aliases the port has always accepted -- rebinding replaces the whole list
  // with the single key the player pressed.
  //
  //   ForwardKey $4C up      BackwardKey $4D down    RotateLeft  $4F left
  //   RotateRight $4E right  SideLeftKey $31 Z       SideRightKey $32 X
  //   FireKey $64 L-Alt      AccelKey $63 Ctrl       ForceSideKey $60 L-Shift
  //   LookUpKey $3D kp7      ResetLookKey $2D kp4    LookDownKey $1D kp1
  //   SwitchKey $40 space
  static ACTIONS = [
    ['forward', 'FORWARDS', ['ArrowUp', 'KeyW']],
    ['backward', 'BACKWARDS', ['ArrowDown', 'KeyS']],
    ['rotateLeft', 'ROTATE LEFT', ['ArrowLeft']],
    ['rotateRight', 'ROTATE RIGHT', ['ArrowRight']],
    ['sideLeft', 'SIDESTEP LEFT', ['KeyA', 'KeyZ']],
    ['sideRight', 'SIDESTEP RIGHT', ['KeyD', 'KeyX']],
    // Alt is the original's FireKey, but a browser gives Alt to the menu bar,
    // so the primary binding is the mouse button and Space/Enter back it up.
    ['fire', 'FIRE', ['Space', 'Enter', 'AltLeft', 'AltRight']],
    // AccelKey is Ctrl held in the original. Ctrl is a browser modifier and
    // holding it is uncomfortable anyway, so this is CapsLock as a TOGGLE --
    // see `runToggle` in main.js. Shift still works as a hold.
    ['accel', 'RUN (TOGGLE)', ['CapsLock']],
    ['forceSide', 'FORCE SIDESTEP', ['ShiftLeft', 'ShiftRight']],
    ['lookUp', 'LOOK UP', ['PageUp', 'Numpad7']],
    ['resetLook', 'RESET LOOK', ['Home', 'Numpad4']],
    ['lookDown', 'LOOK DOWN', ['PageDown', 'Numpad1']],
    // SwitchKey is Space in the original, but Space is the natural fire key in
    // a browser once Alt is unusable, so "use" moves to E/F as it would in any
    // modern first-person game. A deliberate departure, like the fire binding.
    ['switch', 'USE / DOORS', ['KeyE', 'KeyF']],
  ];

  // devices.asm keeps THREE tables: ActiveKeyConfig, which the game reads, and
  // KeyboardKeyConfig / MouseKeyConfig, which store a set each. Changing CONTROL
  // runs CopyFromActualConfig (active -> the table for the old mode) and then
  // CopyToActualConfig (the table for the new mode -> active), so each control
  // mode remembers its own bindings.
  //
  // MouseKeyConfig differs from the keyboard one in four places: RotateLeft,
  // RotateRight and ForceSide are bound to $2C, a code no key produces, and
  // SideLeft/SideRight move onto the cursor keys. With the mouse steering, the
  // cursor keys strafe -- which the port used to special-case in applyInput and
  // now simply reads out of the table.
  static MOUSE_OVERRIDES = {
    rotateLeft: [], rotateRight: [], forceSide: [],
    sideLeft: ['ArrowLeft', 'KeyA', 'KeyZ'],
    sideRight: ['ArrowRight', 'KeyD', 'KeyX'],
  };

  static defaultKeys(mouse = false) {
    const t = Object.fromEntries(Config.ACTIONS.map(([a, , d]) => [a, [...d]]));
    if (mouse) for (const [a, v] of Object.entries(Config.MOUSE_OVERRIDES)) t[a] = [...v];
    return t;
  }

  /** CopyFromActualConfig then CopyToActualConfig, in that order. */
  swapKeyTable(toMouse) {
    const clone = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, [...v]]));
    this.storedKeys[toMouse ? 'keyboard' : 'mouse'] = clone(this.keys);
    this.keys = clone(this.storedKeys[toMouse ? 'mouse' : 'keyboard']);
  }

  /** `keylist` prints a three-character name per key; this is its equivalent. */
  static keyName(code) {
    if (!code) return '---';
    return String(code)
      .replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'KP')
      .replace(/^Arrow/, '').replace(/^Control/, 'CTR').replace(/^Alt/, 'AL')
      .replace(/^Shift/, 'SH').replace('Left', 'L').replace('Right', 'R')
      .toUpperCase().slice(0, 6);
  }

  keyLabel(action) {
    return (this.keys[action] ?? []).map(Config.keyName).join('/') || '---';
  }

  /** Bind one action to a single key, taking it off any other action. */
  bind(action, code) {
    if (!code || !(action in this.keys)) return false;
    for (const a of Object.keys(this.keys)) {
      if (a === action) continue;
      this.keys[a] = this.keys[a].filter((c) => c !== code);
    }
    this.keys[action] = [code];
    this.save();
    return true;
  }

  /** Only the table for the mode you are in, as the page's own reset would. */
  resetKeys() {
    this.keys = Config.defaultKeys(this.control === 1);
    this.storedKeys[this.control === 1 ? 'mouse' : 'keyboard'] = Config.defaultKeys(this.control === 1);
    this.save();
  }

  static FIELDS = ['windowSize', 'pixelSize', 'sight', 'musicVolume', 'musicOn',
    'filter', 'audioOn', 'renderScale', 'hdArt', 'control', 'mouseSensitivity', 'mouseLook', 'walkSpeed',
    'runSpeed', 'rotSpeed', 'rotRunSpeed', 'walkInertia', 'rotInertia'];

  save() {
    try {
      const out = {};
      for (const f of Config.FIELDS) out[f] = this[f];
      if (this.levelCode) out.levelCode = this.levelCode;
      out.keys = this.keys;
      out.storedKeys = this.storedKeys;
      globalThis.localStorage?.setItem('breathless.config', JSON.stringify(out));
    } catch { /* private windows and blocked storage are not an error */ }
  }

  load() {
    let raw = null;
    try { raw = globalThis.localStorage?.getItem('breathless.config'); } catch { return; }
    if (!raw) return;
    let v;
    try { v = JSON.parse(raw); } catch { return; }
    for (const f of Config.FIELDS) {
      if (typeof v?.[f] !== typeof this[f]) continue;
      // Clamp anything that indexes a list, so a stale file cannot break the menu.
      if (typeof this[f] === 'number') {
        const n = this.listLength(f);
        this[f] = Math.max(0, Math.min(n - 1, v[f] | 0));
      } else {
        this[f] = v[f];
      }
    }
    if (typeof v?.levelCode === 'string') this.levelCode = v.levelCode;
    // Only accept bindings for actions that still exist, and only as arrays of
    // strings -- a stale file must not be able to unbind the game.
    const readTable = (src, into) => {
      if (!src || typeof src !== 'object') return;
      for (const [a] of Config.ACTIONS) {
        const list = src[a];
        // An action bound to nothing is legitimate -- MouseKeyConfig disables
        // three of them -- but the value still has to be an array of strings.
        if (Array.isArray(list) && list.every((c) => typeof c === 'string')) {
          into[a] = [...list];
        }
      }
    };
    readTable(v?.keys, this.keys);
    readTable(v?.storedKeys?.keyboard, this.storedKeys.keyboard);
    readTable(v?.storedKeys?.mouse, this.storedKeys.mouse);
  }

  listLength(field) {
    return {
      windowSize: this.windowSizes.length, pixelSize: this.pixelSizes.length,
      musicVolume: this.musicVolumes.length, renderScale: Config.SCALES.length,
      control: 2, mouseSensitivity: 9,
      walkSpeed: 4, runSpeed: 4, rotSpeed: 6, rotRunSpeed: 6,
      walkInertia: 3, rotInertia: 3,
    }[field] ?? Infinity;
  }

  cycle(field, dir = 1) {
    const lists = {
      windowSize: this.windowSizes.length,
      pixelSize: this.pixelSizes.length,
      renderScale: Config.SCALES.length,
      musicVolume: this.musicVolumes.length,
      control: 2, mouseSensitivity: 9,
      walkSpeed: 4, runSpeed: 4, rotSpeed: 6, rotRunSpeed: 6,
      walkInertia: 3, rotInertia: 3,
    };
    if (field in lists) {
      const was = this[field];
      this[field] = (this[field] + dir + lists[field]) % lists[field];
      // Changing CONTROL swaps the whole key table, both ways.
      if (field === 'control' && this[field] !== was) this.swapKeyTable(this[field] === 1);
    } else {
      this[field] = !this[field];
    }
    this.save();
    return this[field];
  }

  label(field) {
    switch (field) {
      case 'windowSize': return this.windowSizes[this.windowSize].join('*');
      case 'pixelSize': return this.pixelSizes[this.pixelSize].join('*');
      case 'renderScale': {
        const [w, h] = this.screenSize();
        return `${this.scale}X  ${w}*${h}`;
      }
      case 'musicVolume': return String(this.musicVolumes[this.musicVolume]);
      case 'control': return ['KEYBOARD', 'MOUSE'][this.control];
      case 'mouseSensitivity': return String(this.mouseSensitivity);
      case 'walkSpeed': case 'runSpeed': return String(this[field] + 1);
      case 'rotSpeed': case 'rotRunSpeed': return String(this[field] + 1);
      case 'walkInertia': case 'rotInertia':
        return ['HIGH', 'MID', 'LOW'][this[field]];
      default: return this[field] ? 'ON' : 'OFF';
    }
  }
}

/**
 * Expand a rendered view into the composite, doubling pixels as `pixelSize`
 * asks and clearing the rest of the 3D window area.
 */
export function expandView(src, sw, sh, dst, dw, dh, ox, oy, px, py,
                           viewH = VIEW_AREA_H) {
  for (let y = 0; y < viewH; y++) {
    dst.fill(0, y * dw, y * dw + dw);
  }
  for (let y = 0; y < sh; y++) {
    for (let ry = 0; ry < py; ry++) {
      const ty = oy + y * py + ry;
      if (ty < 0 || ty >= viewH) continue;
      const row = ty * dw;
      for (let x = 0; x < sw; x++) {
        const v = src[y * sw + x];
        const tx0 = ox + x * px;
        for (let rx = 0; rx < px; rx++) {
          const tx = tx0 + rx;
          if (tx >= 0 && tx < dw) dst[row + tx] = v;
        }
      }
    }
  }
}
