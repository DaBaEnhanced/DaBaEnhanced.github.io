import { loadAssets, paletteRGBA } from './assets.js';
import { buildLevel, BLOCK_SIZE } from './level.js';
import { Renderer } from './render.js';
import { createPresenter } from './gpu.js';
import { Input, applyInput } from './input.js';
import { movePlayer, relocatePlayer, updateWalkOscillation } from './movement.js';
import { makePlayer, KEYS, snapshot, restore } from './player.js';
import { Effects } from './effects.js';
import { World } from './enemies.js';
import { PLAYER_GUNS } from './weapons.js';
import { Audio } from './audio.js';
import { Screens, STATE, SCREEN_W, SCREEN_H, VIEW_H, LOGO1_TICKS, LOGO2_TICKS } from './screens.js';
import { loadPanel } from './panel.js';
import { loadTerminal } from './terminal.js';
import { Automap } from './automap.js';
import { Messages } from './messages.js';
import { Fade } from './fade.js';
import { Shell } from './shell.js';
import { Touch, shouldGrabPointer } from './touch.js';
import { codeFor, decodeCode } from './levelcode.js';
import { drawText } from './textdraw.js';
import { Config, expandView, VIEW_AREA_H } from './config.js';
import { fetchBytes } from './fetch.js';

const canvas = document.getElementById('screen');
const hud = document.getElementById('hud');
const picker = document.getElementById('level');
const note = document.getElementById('note');

const assets = await loadAssets();
const config = new Config(assets.manifest);
const messages = new Messages(null);
const fade = new Fade(assets.lighting);
config.load();                        // ReadConfig, before anything reads a setting
const renderer = new Renderer(assets, ...config.renderSize());
// Two buffers, because the 3D view and the UI live at different resolutions.
//
// `ui` is the Amiga's own 320x240 screen and everything except the 3D view is
// drawn into it exactly as before -- panel, crosshair, messages, terminal, map,
// title pictures. `composite` is what actually reaches the screen, at the
// chosen render scale, and receives the 3D view directly at full resolution.
// Each frame the UI is overlaid on top at the same integer scale.
//
// Keeping the UI at 320 and scaling it is deliberate rather than lazy: the
// panel is a bitmap and the font is a 6x6 bitmap, so there is nothing to gain
// by drawing them at 4x except four times the work and a mismatched look. A
// chunky HUD over a sharp view is what every high-resolution port of a 1990s
// software renderer looks like.
const ui = new Uint8Array(SCREEN_W * SCREEN_H);
let composite = new Uint8Array(SCREEN_W * SCREEN_H);
let compW = SCREEN_W, compH = SCREEN_H;

/** Resize the presented buffer when the render scale changes. */
function sizeComposite() {
  const s = config.scale;
  const w = SCREEN_W * s, h = SCREEN_H * s;
  if (w === compW && h === compH) return false;
  compW = w; compH = h;
  composite = new Uint8Array(w * h);
  return true;
}

/**
 * Put the 320x240 UI over the high-resolution frame at `s` times size.
 *
 * Above the panel the UI is drawn with index 0 meaning "leave the 3D showing".
 * The panel rows are copied opaquely, because a status panel legitimately
 * contains black and must not become a window onto the world behind it.
 */
function overlayUI(s, viewTransparent = true) {
  if (s === 1 && composite === ui) return;
  for (let y = 0; y < SCREEN_H; y++) {
    const solid = !viewTransparent || y >= VIEW_H;
    const srcRow = y * SCREEN_W;
    for (let ry = 0; ry < s; ry++) {
      const dstRow = (y * s + ry) * compW;
      for (let x = 0; x < SCREEN_W; x++) {
        const v = ui[srcRow + x];
        if (!solid && v === 0) continue;
        const dx = x * s;
        for (let rx = 0; rx < s; rx++) composite[dstRow + dx + rx] = v;
      }
    }
  }
}

sizeComposite();
const presenter = await createPresenter(canvas, compW, compH, paletteRGBA(assets, 0));
if (presenter.backend !== 'webgpu') {
  console.warn('No usable WebGPU adapter; presenting through a 2D canvas instead.');
}
// preventDefault follows the live key table, including bindings changed in the
// terminal after Input was constructed.
const input = new Input(window, (code) =>
  Object.values(config.keys).some((codes) => codes.includes(code)));
const audio = new Audio(assets.manifest);
const screens = new Screens(assets);

const grab = async (k) => {
  const g = assets.manifest.gfx?.[k];
  if (!g) return null;
  return { ...g, data: await fetchBytes(`${assets.base}/${g.file}`) };
};
const panel = await loadPanel(assets);
const crosshair = await grab('Mirino01');
const terminal = await loadTerminal(assets);
if (terminal) {
  terminal.config = config;
  messages.cs = terminal.cs;
  terminal.onConfig = (field) => {
    if (field === 'windowSize' || field === 'pixelSize' || field === 'renderScale') {
      const [rw, rh] = config.renderSize();
      renderer.resize(rw, rh);
      // The render scale changes the size of the presented frame as well as
      // the view inside it, so the composite and the present pass follow.
      if (sizeComposite()) presenter.resize(compW, compH);
    } else if (field === 'hdArt') {
      // Swapping the art set rebuilds only the level's texture table; geometry,
      // objects and effect state are untouched, so it happens mid-level.
      //
      // Turning it ON is a 10.8 MB download the first time, so say so and let
      // the game carry on rendering the 1x art until it lands. Turning it off
      // is instant -- the original set never leaves memory.
      if (config.hdArt && !assets.hd) messages.show('LOADING HD ART');
      assets.setHD(config.hdArt).then((on) => {
        level?.rebuildTextures(assets);
        messages.show(on ? 'HD ART ON'
          : (config.hdArt ? 'NO HD ART BUILT' : 'HD ART OFF'));
      });
    } else if (field === 'musicVolume' || field === 'musicOn') {
      audio.setMusicVolume(config.musicOn ? config.musicVolumes[config.musicVolume] / 4 : 0);
    } else if (field === 'filter') {
      audio.setFilter(config.filter);
    } else if (field === 'control') {
      // Switching to MOUSE takes effect as soon as the menu closes; switching
      // away releases the pointer immediately so the cursor comes back.
      if (!config.mouseOn && document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
    }
  };
  terminal.onClose = () => closeTerminal();
  // conf_page0p's CREDITS entry: ShowCredits (Presentation.asm) puts the
  // credits picture up until a key is pressed.
  terminal.onCredits = () => { terminal.configOnly = false; setState(STATE.CREDITS, PRES.credits); };
}
// The saved sound settings are applied in `wake`, once the audio nodes exist.
// Calling these here did nothing at all: `musicGain` and the filter are created
// by start(), which has not run yet.

const SND = { doorStart: 'LFT1', doorStop: 'LFT2', switch: 'SWT1',
              teleport: 'TSP1', scream: 'SCM1', steps: 'STP4',
              weaponEmpty: 'FAUL', pickup: 'ITM1' };
const PRES = assets.manifest.presentation;
const distSq = (o) => (o && cam ? (o.x - cam.x) ** 2 + (o.z - cam.z) ** 2 : 0);

for (const [id, info] of Object.entries(assets.manifest.levels)) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = `${info.world.replace(/\s*-\s*$/, '')} — ${info.name}`;
  picker.append(opt);
}

let level = null, cam = null, fx = null, world = null;
const automap = new Automap();

// Cheats are a SESSION setting, not player state. The player object is rebuilt
// for every level and `restore()` only carries what InitScores2 carries -- that
// list is a transcription and cheats have no business in it -- so a flag left on
// `cam` was switched off by the next door out. Keeping them here and applying
// them to whatever player currently exists means they survive a level change,
// a death and a retry, which is what someone who turned a cheat on expects.
const cheats = { god: false, energy: false };

function applyCheats() {
  if (!cam) return;
  cam.godMode = cheats.god;
  cam.infiniteEnergy = cheats.energy;
  if (cheats.god) { cam.health = 100; cam.shields = 100; }
  if (cheats.energy) cam.energy = 1000;
}
let paused = false;
let kills = 0, fireQueue = 0, fireHeld = false;
// Carried between levels, and rewound when a level is replayed after death.
let carried = null, levelStart = null, playAgain = false;
let switchHeld = false, anyHeld = false;
let state = STATE.LOGO1, stateTicks = 0, currentLevel = null;
let screenRequest = 0, levelRequest = 0;
let codeEntry = null, restoreState = null;
let fps = 0;

function say(text) {
  note.textContent = text;
  clearTimeout(say.t);
  say.t = setTimeout(() => { note.textContent = ''; }, 2500);
}

// Presentation.asm gives the two ending screens a module and a position each,
// and in both cases the position is the LAST pattern of that module:
//   EndGameSequence   PresModName (MUST, 35 positions), P61_SetPosition 34
//   GameOverSequence  "MUSL"      (MUSL,  4 positions), P61_SetPosition 3
const SEQUENCE_MUSIC = {
  [STATE.END]: () => [PRES.music, 34],
  [STATE.GAMEOVER]: () => ['MUSL', 3],
};

function startMusicFor(s) {
  if (!audio.enabled) return;
  // Audio.asm:InitAudio2 gives in-game music three of Paula's four channels and
  // keeps the fourth for sound effects; Presentation.asm gives its screens all
  // four, because nothing else is making a noise there.
  audio.setGameChannels(s === STATE.PLAYING ? 3 : 4);
  const seq = SEQUENCE_MUSIC[s]?.();
  if (seq) { audio.playMusic(seq[0], seq[1]); return; }
  if (s === STATE.PLAYING && level) {
    const mod = level.json.sounds.find((n) => assets.manifest.sounds[n]?.type === 'MOD');
    if (mod) audio.playMusic(mod);
  } else {
    audio.playMusic(PRES.music);
  }
}

// Level-code entry on the title screen. The password carries the whole save
// state (see levelcode.js), so a valid one restores health, credits, weapons
// and position, not just the level number.
window.addEventListener('keydown', (e) => {
  if (state !== STATE.TITLE) return;
  const k = e.key.toUpperCase();
  if (codeEntry === null) {
    if (!/^[1-9A-W]$/.test(k)) return;
    codeEntry = '';
  }
  if (/^[1-9A-W]$/.test(k) && codeEntry.length < 16) codeEntry += k;
  else if (e.key === 'Backspace') codeEntry = codeEntry.slice(0, -1);
  else if (e.key === 'Escape') codeEntry = null;
  else if (e.key === 'Enter' && codeEntry.length === 16) {
    const st = decodeCode(codeEntry);
    if (!st) { say('BAD CODE'); codeEntry = null; return; }
    restoreState = st;
    codeEntry = null;
    const ids = Object.keys(assets.manifest.levels);
    go(ids[Math.min(ids.length - 1, st.game * 5 + st.level)]);
  }
  e.preventDefault();
});

// The rest of TMapMain's KeyboardInput table (line 676 onward). Everything here
// is a fresh-press action rather than a held key, which is why it lives in a
// keydown listener instead of applyInput:
//
//   1-6 / F1-F6  select a weapon      TAB  show the map (KIshowmap)
//   - / +        window size          P    pause (KIpause)
//   [ ] / *      pixel size 1x1 2x1 1x2 2x2   (numeric keypad)
//   Esc          configuration menu   F9   cheat (KIcheat)
//   8 / 9        skip a level / a game
window.addEventListener('keydown', (e) => {
  // A held key repeats keydown several times a second. Every action here is a
  // one-shot -- toggling the map, pausing, stepping the window size -- so an
  // auto-repeat would flap them on and off rather than doing them once.
  if (e.repeat) return;
  if (state !== STATE.PLAYING || !level || terminal?.open || codeEntry !== null) return;
  // Run is a toggle rather than a hold; see input.js.
  if ((config.keys.accel ?? []).includes(e.code)) {
    cam.running = !cam.running;
    messages.show(cam.running ? 'RUN ON' : 'RUN OFF');
    e.preventDefault();
    return;
  }
  const step = (field, dir) => { config.cycle(field, dir); terminal?.onConfig?.(field); };
  switch (e.code) {
    case 'F1': case 'F2': case 'F3': case 'F4': case 'F5': case 'F6':
      selectWeapon(Number(e.code.slice(1)) - 1);
      break;
    case 'Tab':
      automap.open = !automap.open;
      audio.play(SND.switch, 0);
      break;
    case 'KeyG':                                   // fullscreen, from the keyboard
      shell.toggleFullscreen();
      break;
    case 'KeyP':
      paused = !paused;
      if (paused) say('PAUSED'); else { say(''); messages.show(19); }  // Mess19
      break;
    case 'Minus': case 'NumpadSubtract': step('windowSize', -1); break;
    case 'Equal': case 'NumpadAdd': step('windowSize', 1); break;
    // KIpixelsize11/21/12/22 give the four pixel sizes a key each, on Amiga
    // keypad codes a browser does not distinguish; two keys cycling the same
    // four values reach all of them.
    case 'BracketLeft': step('pixelSize', -1); break;
    case 'BracketRight': step('pixelSize', 1); break;
    case 'F9': cheatAll(); break;
    case 'F10':                                   // the port's own: stay alive
      cheats.god = !cheats.god;
      applyCheats();
      messages.show(cheats.god ? 'INFINITE HEALTH ON' : 'INFINITE HEALTH OFF');
      break;
    case 'F11':                                   // the port's own: never empty
      cheats.energy = !cheats.energy;
      applyCheats();
      messages.show(cheats.energy ? 'INFINITE ENERGY ON' : 'INFINITE ENERGY OFF');
      break;
    case 'Digit8': nextLevel(); break;               // KIjumplevel
    case 'Digit9': {                                 // KIjumpgame
      // `addq.w #1,CurrentGame ; clr.w CurrentLevel`: on to the next world.
      const ids = Object.keys(assets.manifest.levels);
      const i = ids.indexOf(currentLevel);
      const nextWorld = (Math.floor(i / 5) + 1) * 5;
      if (nextWorld < ids.length) go(ids[nextWorld]);
      else setState(STATE.END, PRES.endGame);
      break;
    }
    default: return;
  }
  e.preventDefault();
});

/**
 * KIcheat (TMapMain.asm:895) tops up health, shields, energy and credits. This
 * version also grants every weapon, because the alternative -- earning 35,000
 * credits at a terminal for the Death Machine -- is not what anyone reaches for
 * a cheat key to do.
 */
function cheatAll() {
  if (!cam) return;
  cam.health = 100; cam.shields = 100; cam.energy = 1000; cam.credits = 90000;
  for (let k = 0; k < PLAYER_GUNS; k++) cam.collectWeapon(k);
  messages.show('ALL WEAPONS');
}

/**
 * KIchangeweapon: a weapon key SELECTS, it does not grant. The original tests
 * `tst.b (a1,d0.w)` -- is this weapon owned? -- and returns if not, then returns
 * again if it is already active, so the change sound only plays on a real
 * change. Weapons are bought at a terminal.
 *
 * The port used to call collectWeapon here, a shortcut from before the terminal
 * was implemented. It meant pressing 1 to 6 to cycle weapons silently gave you
 * all six, which is why the game appeared to start with a full arsenal.
 */
function selectWeapon(k) {
  if (!cam || k < 0 || k >= PLAYER_GUNS) return false;
  if (!cam.weapons[k]) { messages.show('WEAPON NOT OWNED'); return false; }
  if (cam.weapon === k) return false;
  cam.weapon = k;
  audio.play(SND.switch, 0);
  messages.show(13 + k);                   // KIchangeweapon: 13 + slot
  return true;
}

// KIescape (TMapMain.asm:720) binds Esc to `pause = 1; terminal = -1`, which
// InitTerminal reads as the configuration menu rather than a shop terminal.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.repeat) return;
  if (!terminal || codeEntry !== null) return;      // Esc cancels code entry first
  if (terminal.open) return;                        // stepTerminal closes it
  if (state !== STATE.PLAYING && state !== STATE.TITLE) return;
  openConfigMenu();
  e.preventDefault();
});

// Starting audio needs a gesture, and a context can be suspended again later
// (the tab loses focus, the browser decides to). So this is NOT a once-only
// handler: every gesture gets a chance to resume a stalled context, and only
// the first one does the expensive setup. A failure here used to be completely
// invisible -- `start()` returned a rejected promise nobody caught, and the
// game ran on in silence.
// Exposed for tools/browserprobe.mjs. This lives at module scope rather than
// inside go(), because the things worth watching earliest -- the audio context
// and the worklet -- are set up on the first gesture, long before a level.
globalThis.__dbg = {
  audio,
  get level() { return level; }, get cam() { return cam; },
  get fx() { return fx; }, get world() { return world; },
  get renderer() { return renderer; }, get terminal() { return terminal; },
  get cfg() { return config; },
  presenterSize: () => [compW, compH],
  get state() { return state; },
  go,
};

// index.html is the development page; play.html sets data-mode="play" and gets
// nothing on screen but the game and the shell buttons.
const PLAY_MODE = document.body?.dataset?.mode === 'play';

const shell = new Shell({
  playMode: PLAY_MODE,
  onLayout: () => fit(),
  isSound: () => config.audioOn,
  onSound: (on) => {
    config.audioOn = on;
    config.save();
    if (on) {
      // This click IS the user gesture, so it is the moment the context can be
      // created and resumed. Everything downstream needs audio to exist first.
      startAudio().then(() => {
        audio.setMusicVolume(config.musicOn
          ? config.musicVolumes[config.musicVolume] / 4 : 0);
        audio.master && (audio.master.gain.value = 0.6);
        shell.refresh();
      });
    } else {
      audio.setMusicVolume(0);
      audio.master && (audio.master.gain.value = 0);
    }
  },
  isCheat: () => (cheats.god && cheats.energy) ? 'both'
    : cheats.god ? 'health' : cheats.energy ? 'energy' : '',
  onCheat: (kind) => {
    if (kind === 'weapons') { cheatAll(); return; }
    cheats.god = kind === 'health' || kind === 'both';
    cheats.energy = kind === 'energy' || kind === 'both';
    applyCheats();
    messages.show(kind === '' ? 'CHEATS OFF' : 'CHEAT ON');
  },
});

const touch = new Touch(canvas, input, {
  onFire: () => { fireQueue += 1; },
  onUse: () => { if (fx && cam) fx.pressSwitch(cam); },
// The letterboxed container, not the canvas: the black bands beside the picture
// are where a thumb naturally rests, and reading input from the canvas alone
// made them the one part of the screen that did nothing.
// Only a real letterbox wrapper, never `parentElement` as a fallback: on the
// dev page the canvas sits directly in <body>, and taking that as the input
// surface would turn the level selector and the shell buttons into thumbsticks.
}, canvas.closest?.('.screen') ?? canvas);

let audioReady = false;
// A generic gesture only starts audio if the player has already asked for it in
// an earlier session. A first-time visitor gets silence until they press the
// speaker, which is the one thing a browser will always honour.
const wake = () => {
  if (config.audioOn) startAudio();
};

function startAudio() {
  return audio.start()
    .then(() => {
      if (!audioReady) {
        audioReady = true;
        // Apply the saved sound settings now that there is something to apply
        // them to; doing it at load time was a no-op, the nodes did not exist.
        audio.setMusicVolume(config.audioOn && config.musicOn
          ? config.musicVolumes[config.musicVolume] / 4 : 0);
        audio.setFilter(config.filter);
        if (audio.master) audio.master.gain.value = config.audioOn ? 0.6 : 0;
      }
      startMusicFor(state);
      // Say it on the page, not only in the console. Silence is a symptom with
      // several causes and none of them announce themselves.
      const a = audio.status();
      if (a.worklet !== 'ready') say(`NO MUSIC: ${a.error ?? 'worklet unavailable'}`);
      else if (a.failed) say(`${a.failed} sound file(s) failed to load`);
    })
    .catch((e) => {
      console.error('audio failed to start:', e);
      say(`AUDIO UNAVAILABLE: ${e && e.message ? e.message : e}`);
    });
}

canvas.addEventListener('pointerdown', wake);
window.addEventListener('keydown', wake);

// ---- mouse ---------------------------------------------------------------
// devices.asm feeds the input handler IECLASS_RAWMOUSE events and reads
// ie_X out of them when IEQUALIFIERB_RELATIVEMOUSE is set. Pointer lock is the
// browser's version of that same relative stream: without it the pointer would
// stop at the window edge and the deltas would dry up mid-turn.
function grabPointer() {
  // Guarded at the choke point as well as at the listener, because there is a
  // second caller -- closing the configuration menu re-grabs -- and it would
  // have re-frozen the thumbsticks the first time a phone player opened and
  // closed the menu. A device with no mouse has nothing to lock.
  if (touch.enabled) return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
}
canvas.addEventListener('pointerdown', (e) => {
  if (terminal?.open) return;
  if (shouldGrabPointer({ pointerType: e.pointerType, mouseOn: config.mouseOn,
                          playing: state === STATE.PLAYING,
                          locked: document.pointerLockElement === canvas })) {
    grabPointer();
    e.preventDefault();
    return;
  }
  // IHCnorelmouse maps the RIGHT button to SwitchKey, so it opens doors and
  // presses switches. The left button is not read there -- fire in mouse mode
  // is still FireKey -- but a mouse whose main button does nothing is not
  // usable in a browser, so button 0 is treated as a fire press.
  // Feed the button in as whichever key the action is bound to, so a rebound
  // fire key still works from the mouse.
  // A touch pointer reports button 0, so without this every finger put down
  // anywhere -- including one dragging the movement stick -- held the fire key
  // for as long as it stayed down. Touch input belongs to the Touch class,
  // which fires on a TAP and knows the difference between that and a drag.
  if (touch.enabled && e.pointerType === 'touch') return;
  if (e.button === 2) input.down.add(config.keys.switch[0]);
  else if (e.button === 0) input.down.add(config.keys.fire[0]);
});
canvas.addEventListener('pointerup', (e) => {
  if (touch.enabled && e.pointerType === 'touch') return;
  if (e.button === 2) input.down.delete(config.keys.switch[0]);
  else if (e.button === 0) input.down.delete(config.keys.fire[0]);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  input.addMouse(e.movementX ?? 0, e.movementY ?? 0);
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) input.takeMouse();
});

async function setState(s, pic) {
  const request = ++screenRequest;
  const loaded = pic ? await screens.load(pic) : null;
  if (request !== screenRequest) return false;
  state = s; stateTicks = 0;
  if (pic) screens.draw(loaded);
  startMusicFor(s);
  return true;
}

async function go(id) {
  // The original never resets PlayerHealth and friends between levels -- they
  // are globals that simply persist, and InitScores2 only takes a copy for a
  // possible retry. This port builds a fresh player per level, so the live
  // state has to be captured on the way OUT, here, while `cam` is still the
  // outgoing player. Taking it at level start instead (which is what this used
  // to do) carried the state the player had on ENTERING the previous level and
  // silently threw away everything earned during it.
  const request = ++levelRequest;
  // A level request is also a screen request: a later presentation change or
  // later level selection invalidates both its loading picture and its commit.
  const screenToken = ++screenRequest;
  const retry = playAgain;
  const nextCarried = cam && !retry ? snapshot(cam) : carried;
  const retryState = levelStart;
  const pendingRestore = restoreState;
  const info = assets.manifest.levels[id];
  const lv = await assets.loadLevel(id);
  if (request !== levelRequest || screenToken !== screenRequest) return false;
  const loadingPic = lv.loadPic ? await screens.load(lv.loadPic) : null;
  if (request !== levelRequest || screenToken !== screenRequest) return false;

  // Nothing visible or persistent is committed until all async dependencies
  // are known to belong to the newest request.
  if (cam && !retry) carried = nextCarried;
  currentLevel = id;
  state = STATE.LOADING; stateTicks = 0;
  if (loadingPic) screens.draw(loadingPic);
  startMusicFor(state);
  say(`${info.world.replace(/\s*-\s*$/, '')} — ${info.name}`);
  picker.value = id;

  // Before buildLevel, so the level's texture table is built against whichever
  // art set is in force. If the HD fetch fails this resolves false and the
  // level is built from the 1x set, which is the right outcome either way.
  await assets.setHD(config.hdArt);
  level = buildLevel(lv, assets);
  // InitAutomap: exploration is per level, not per game.
  automap.reset();
  paused = false;
  // TMapMain writes `#$1f000100` on entering a level: start at the darkest
  // lighting level and fade down to clear.
  fade.start(0x1f000100);
  cam = makePlayer(level, {
    onHurt: (n) => say(`hit for ${n}`),
    onDeath: () => { playAgain = true; setState(STATE.GAMEOVER, PRES.gameOver); },
  });
  kills = 0; fireQueue = 0; fireHeld = false;
  audio.stopAll();

  world = new World(level, {
    onKill: (o, s) => {
      kills++; cam.score += s; say(`killed ${o.name} +${s}`);
      if (o.def.sounds[1]) audio.play(o.def.sounds[1], distSq(o));
    },
    onSound: (what, o, gun) => {
      if (what === 'playerFire') {
        const g = world.guns.get(cam.weapon);
        if (g?.def.sounds[0]) audio.play(g.def.sounds[0], 0);
      } else if (what === 'weaponEmpty') audio.play(SND.weaponEmpty, 0);
      else if (what === 'enemyFire' && gun?.def.sounds[0]) audio.play(gun.def.sounds[0], distSq(o));
      else if (what === 'enemyHit' && o?.def.sounds[0]) audio.play(o.def.sounds[0], distSq(o));
    },
  });
  fx = new Effects(level, {
    // `#$04000002` on leaving a level: a one-way black fade, and the next
    // level only loads once the screen has gone.
    onEndLevel: () => fade.start(0x04000002, { freeze: true, onEnd: () => nextLevel() }),
    onLocked: (k) => { say(`you need the ${KEYS[k - 1]} key`); messages.show(k + 3); },
    onSound: (what) => { if (SND[what]) audio.play(SND[what], 0); },
    onTerminal: (n) => {
      if (!terminal) { say(`terminal ${n}`); return; }
      terminal.open = true; terminal.page = 'main';
      terminal.sel = 0; terminal.number = n; terminal.message = '';
      termHeld = true;                 // Space is usually still down; see above
      const ids = Object.keys(assets.manifest.levels);
      const i = ids.indexOf(currentLevel);
      terminal.code = codeFor(cam, Math.floor(i / 5), i % 5);
    },
    // Animations.asm:Teleport writes `#$04000001` to TransEffect the moment the
    // effect starts -- a fog fade, both directions -- and freezes the world.
    onTeleportStart: () => fade.start(0x04000001, { freeze: true }),
    onTeleport: (x, z) => {
      relocatePlayer(level, cam, x * BLOCK_SIZE + 32, z * BLOCK_SIZE + 32);
      // InitPlayerPos2 clears the fire state as part of relocation.
      for (const code of config.keys.fire ?? []) input.down.delete(code);
      fireQueue = 0; fireHeld = false;
      say('teleport');
    },
    onActivateEnemy: (t) => { const n = world.activate(t); if (n) say(`${n} enemies activated`); },
  });
  // InitScores2: replaying a level rewinds to its opening snapshot; otherwise
  // the carried state comes forward from the previous level.
  restore(cam, retry ? retryState : carried);
  playAgain = false;
  // InitScores2's S* copy: the state on entering this level, for a retry.
  levelStart = snapshot(cam);
  applyCheats();          // the port's own, and they outlive a level

  if (pendingRestore) {
    Object.assign(cam, {
      health: pendingRestore.health, shields: pendingRestore.shields,
      energy: pendingRestore.energy, credits: pendingRestore.credits,
      weapons: pendingRestore.weapons.slice(), weapon: pendingRestore.weapon,
    });
    say(`restored: hp ${cam.health} cr ${cam.credits}`);
    if (restoreState === pendingRestore) restoreState = null;
  }
  fx.player = cam;
  fx.world = world;
  canvas.focus();
  return true;
}

function nextLevel() {
  const ids = Object.keys(assets.manifest.levels);
  const i = ids.indexOf(currentLevel);
  if (i + 1 < ids.length) { say('LEVEL COMPLETE'); go(ids[i + 1]); }
  else setState(STATE.END, PRES.endGame);
}

async function advance() {
  if (state === STATE.LOGO1) return setState(STATE.LOGO2, PRES.logo2);
  if (state === STATE.LOGO2) return setState(STATE.TITLE, PRES.title);
  if (state === STATE.TITLE) {
    return go(picker.value || Object.keys(assets.manifest.levels)[0]);
  }
  if (state === STATE.LOADING) { state = STATE.PLAYING; startMusicFor(state); return; }
  // Dying replays the same level from its opening snapshot (PlayAgain).
  if (state === STATE.GAMEOVER && currentLevel) return go(currentLevel);
  return setState(STATE.TITLE, PRES.title);          // credits / ending
}

function blit(src, w, h, dx, dy, transparent) {
  for (let y = 0; y < h; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= SCREEN_H) continue;
    for (let x = 0; x < w; x++) {
      const tx = dx + x;
      if (tx < 0 || tx >= SCREEN_W) continue;
      const v = src[y * w + x];
      if (transparent && v === 0) continue;
      ui[ty * SCREEN_W + tx] = v;
    }
  }
}

// A KEYS row waiting for a key takes the next keydown whole, before any menu
// navigation sees it -- otherwise binding SWITCH to space would immediately be
// read as "choose this row again".
window.addEventListener('keydown', (e) => {
  if (!terminal?.open || !terminal.binding) return;
  terminal.bindKey(e.code);
  termHeld = true;                       // swallow the release too
  e.preventDefault();
}, true);

let termHeld = false;
function stepTerminal() {
  if (terminal.binding) { termHeld = input.down.size > 0; return; }
  const pressed = input.has('ArrowUp', 'KeyW') ? -1
    : input.has('ArrowDown', 'KeyS') ? 1 : 0;
  const sideways = input.has('ArrowRight', 'KeyD') ? 1
    : input.has('ArrowLeft', 'KeyA') ? -1 : 0;
  const enter = input.has(...(config.keys.fire ?? []), ...(config.keys.switch ?? []));
  const esc = input.has('Escape');
  if (!termHeld) {
    if (pressed) terminal.move(pressed);
    else if (sideways) terminal.step(sideways);
    else if (enter) terminal.choose(cam);
    else if (esc) { terminal.open = false; closeTerminal(); }
  }
  termHeld = pressed !== 0 || sideways !== 0 || enter || esc;
}

/** Leaving the configuration menu unpauses and re-grabs the pointer. */
function closeTerminal() {
  terminal.configOnly = false;
  if (config.mouseOn && state === STATE.PLAYING) grabPointer();
}

/** KIescape: Esc pauses and opens the configuration menu (terminal = -1). */
function openConfigMenu() {
  if (!terminal) return;
  terminal.open = true; terminal.configOnly = true;
  terminal.inGame = state === STATE.PLAYING;
  terminal.page = 'main'; terminal.sel = 0; terminal.message = '';
  // The key that opened the menu is still physically down. stepTerminal acts on
  // fresh presses only, and it decides what is fresh by comparing against
  // `termHeld` -- which starts false, so without this the very next frame sees
  // Escape held, reads it as a new press, and closes the menu again. That is
  // why the menu only appeared if the key was released inside one frame.
  termHeld = true;
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}

function drawPanel() {
  if (!panel) return;
  const face = panel.update({
    score: cam.score, health: Math.max(0, cam.health),
    shields: cam.shields, energy: cam.energy, credits: cam.credits,
    keys: cam.keys, weapons: cam.weapons, weapon: cam.weapon,
  });
  blit(face, panel.w, panel.h, 0, VIEW_H, false);
}

/**
 * Render the 3D view straight into the high-resolution frame. Everything the
 * view needs to know about scale is already in `config`: renderSize() gives the
 * buffer size and origin() the placement, both multiplied by it.
 */
function drawView(ticksForFade = null) {
  const [rw, rh] = config.renderSize();
  const [px, py] = config.pixelScale();
  const [ox, oy] = config.origin(SCREEN_W);
  const v = renderer.render(level, cam, world?.shots);
  if (ticksForFade !== null) fade.apply(v, ticksForFade);
  expandView(v, rw, rh, composite, compW, compH, ox, oy, px, py,
             VIEW_AREA_H * config.scale);
}

function step(ticks) {
  ui.fill(0);                      // the UI is redrawn from nothing each frame
  if (terminal?.open) {
    stepTerminal();
    drawView();
    terminal.draw(ui, SCREEN_W, cam);
    drawPanel();
    if (!PLAY_MODE) hud.textContent = `TERMINAL ${terminal.number} | credits ${cam.credits}`;
    return;
  }
  termHeld = false;
  if (paused || automap.open || fade.freezing) {
    // KIpause freezes the world, and MapMode replaces the view entirely --
    // it even swaps the pixel height and turns the sprites off. Neither runs
    // the movement, effects or object code.
    automap.timer += ticks;
    if (fade.freezing && !paused && !automap.open) {
      // ProgramState = -1 stops movement and the objects, but Animations still
      // runs -- which is what counts the teleport's own 32 ticks down.
      fx.update(ticks, cam);
      drawView(ticks);
      drawPanel();
      return;
    }
    if (automap.open) {
      automap.draw(ui, SCREEN_W, SCREEN_H, level, cam);
      if (!PLAY_MODE) hud.textContent = `MAP | ${level.name ?? ''}`;
    } else {
      drawView();
      drawPanel();
    }
    return;
  }
  messages.update(ticks);
  automap.trace(level, cam);
  const before = { x: cam.x, z: cam.z };
  // A phone has no run key and nowhere comfortable to put one, so touch play
  // runs by default. The stick's bitmask is handed straight to applyInput,
  // which cannot tell it from a keyboard.
  const touchDir = touch.direction();
  // Looking is a rate now, integrated per frame from the held deflection, so a
  // thumb parked at the rim keeps turning instead of stopping when it runs out
  // of screen. Feeds the same mouse path, so MouseSensitivity still applies.
  touch.lookRate(ticks / 50);
  if (touch.enabled) cam.running = true;
  if (!cam.dead) applyInput(input, cam, ticks / 50, config, touchDir);
  const wishX = cam.x - before.x, wishZ = cam.z - before.z;
  cam.x = before.x; cam.z = before.z;

  movePlayer(level, cam, wishX, wishZ, ticks, fx);
  updateWalkOscillation(cam, ticks, () => audio.play(SND.steps, 0));
  cam.floorH = level.B.floorH[cam.block];
  fx.update(ticks, cam);
  world.update(ticks, cam);

  const switchDown = input.has(...(config.keys.switch ?? []));
  if (switchDown && !switchHeld) fx.pressSwitch(cam);
  switchHeld = switchDown;

  for (let k = 0; k < PLAYER_GUNS; k++) {
    if (input.has(`Digit${k + 1}`)) selectWeapon(k);
  }
  // Firing follows AnimateObjects/ReadJoy exactly. `joyfire` counts only fresh
  // PRESSES (ReadJoy guards it with joyfireP), so an ordinary weapon fires once
  // per press -- the autofire branch is commented out in this build. Only the
  // flamethrower (param8 = 1) adds elapsed ticks while the button is held.
  const gun = world.guns.get(cam.weapon);
  const firing = input.has(...(config.keys.fire ?? []));
  if (gun?.flame) {
    if (firing && !cam.dead) fireQueue += ticks;
    else if (gun.def.sounds[0]) audio.stop(gun.def.sounds[0]);
  } else if (firing && !fireHeld && !cam.dead) {
    fireQueue += 1;
  }
  fireHeld = firing;

  if (fireQueue >= 1) {
    fireQueue -= 1;
    // PlayerWeapons entry 2 means boosted: two shots at -8 and +8, and
    // PlayerFire passes a6<>0 on the second so it costs no extra energy.
    world.playerFire(cam, { boosted: cam.weapons[cam.weapon] === 2 });
  }

  for (const p of world.collectPickups(cam)) {
    audio.play(SND.pickup, 0);
    say(`picked up ${p.what}${p.value ? ` (${p.value})` : ''}`);
    messages.show(p.msg);          // CollectItem returns the message number
  }
  world.collidePlayerObjects(cam);
  cam.tick(ticks);
  presenter.setPalette(paletteRGBA(assets, cam.redFlash > 0 ? 1 : 0));

  drawView(ticks);
  // Mouse mode is the default, and a browser will not give a page the pointer
  // without a click. Say so, until it has been given.
  // Not on a touchscreen: there is nothing to click, the sticks are already
  // steering, and pointer lock is the one thing that must NOT happen there.
  if (config.mouseOn && !touch.enabled
      && document.pointerLockElement !== canvas) {
    messages.drawStatic(ui, SCREEN_W, VIEW_AREA_H, 'CLICK TO LOOK');
  }
  messages.draw(ui, SCREEN_W, VIEW_AREA_H);
  if (crosshair && config.sight) {
    blit(crosshair.data, crosshair.w, crosshair.h,
         (SCREEN_W - crosshair.w) >> 1, (VIEW_AREA_H - crosshair.h) >> 1, true);
  }
  drawPanel();

  touch.draw(ui, SCREEN_W, VIEW_AREA_H);

  // Play mode writes no diagnostics anywhere. frame() does the presenting, so
  // there is nothing else in this function to skip.
  if (PLAY_MODE) return;
  hud.textContent =
    `${fps.toFixed(0)} fps | cell ${Math.floor(cam.x / BLOCK_SIZE)},${Math.floor(cam.z / BLOCK_SIZE)} | ` +
    `hp ${Math.max(0, cam.health)} sh ${cam.shields} nrg ${cam.energy} | ` +
    `${cam.keys.map((k, i) => (k ? KEYS[i][0].toUpperCase() : '-')).join('')} | ` +
    `wpn ${cam.weapon + 1} ${gun?.name ?? '-'} | kills ${kills} | ` +
    `score ${cam.score}${cam.dead ? ' | DEAD' : ''}` +
    (presenter.backend === 'webgpu' ? '' : ' | 2D') +
    (cam.godMode ? ' | GOD' : '') + (cam.infiniteEnergy ? ' | NRG' : '') +
    (() => {
      const a = audio.status();
      // Silence has too many possible causes to leave invisible.
      if (a.context === 'running' && a.worklet === 'ready' && a.music) return '';
      return ` | AUDIO ${a.context}/${a.worklet}/${a.music ?? 'no track'}`;
    })();
}

function fatal(err) {
  console.error(err);
  note.textContent = '';
  hud.textContent = '';
  const box = document.getElementById('fatal');
  if (box) {
    box.hidden = false;
    box.textContent = `${err && err.stack ? err.stack : err}`;
  }
}

let last = performance.now(), acc = 0, frames = 0;
function loop(now) {
  try {
    frame(now);
  } catch (err) {
    // An uncaught throw here would stop requestAnimationFrame and freeze the
    // last drawn image, which looks exactly like "it hangs on the loading
    // screen". Show it instead.
    fatal(err);
    return;
  }
  requestAnimationFrame(loop);
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const ticks = dt * 50;
  acc += dt; frames++;
  if (acc >= 0.5) { fps = frames / acc; acc = 0; frames = 0; }
  stateTicks += ticks;

  const pressed = input.down.size > 0;
  const fresh = pressed && !anyHeld;
  anyHeld = pressed;

  // `pause = 1` in KIescape: the world stops while the menu is up, and the menu
  // is drawn over whatever was on screen -- the frozen view in game, the title
  // picture otherwise.
  if (terminal?.open && terminal.configOnly) {
    stepTerminal();
    ui.fill(0);
    if (state === STATE.PLAYING && level) {
      drawView();
      drawPanel();
    } else {
      ui.set(screens.frame);
      presenter.setPalette(screens.paletteRGBA());
    }
    terminal.draw(ui, SCREEN_W, cam ?? { credits: 0 });
    if (!PLAY_MODE) hud.textContent = `CONFIGURATION | ${terminal.page}`;
    overlayUI(config.scale, state === STATE.PLAYING && level);
    presenter.present(composite);
    return;
  }

  if (state === STATE.PLAYING && level) {
    step(ticks);
  } else {
    ui.set(screens.frame);
    presenter.setPalette(screens.paletteRGBA());
    // The title screen shows the code only while one is being typed. The
    // prompt used to sit there permanently, over artwork that does not have a
    // space for it -- typing a code still works, it just does not advertise
    // itself, which is what the original does too.
    if (state === STATE.TITLE && terminal && codeEntry !== null) {
      drawText(ui, SCREEN_W, SCREEN_H, terminal.cs,
               8, SCREEN_H - 14, codeEntry + '_', 61);
    }
    if (!PLAY_MODE) hud.textContent = state + (codeEntry !== null ? ` code ${codeEntry}` : '');
    // The logos time out on their own; every other screen waits for a key.
    // `Waiting` returns on a key, the left mouse button, OR after d2 ticks --
    // the ending screens pass 5000, so they do not sit there for ever.
    if ((state === STATE.LOGO1 && stateTicks > LOGO1_TICKS)
        || (state === STATE.LOGO2 && stateTicks > LOGO2_TICKS)
        || (state === STATE.LOADING && stateTicks > 50)
        || ((state === STATE.END || state === STATE.GAMEOVER
             || state === STATE.CREDITS) && stateTicks > 5000)
        || (fresh && codeEntry === null)) {
      advance();
    }
  }
  // The UI is transparent over the 3D window and opaque over the panel; on a
  // picture screen there is no 3D behind it at all.
  overlayUI(config.scale, state === STATE.PLAYING && level !== null);
  presenter.present(composite);
}

function fit() {
  // Integer scale, so a source pixel is always a whole number of screen pixels
  // and nothing is resampled. In play mode and fullscreen there is no chrome to
  // leave room for.
  // Measure the bar rather than guessing at it: in play mode it is a real grid
  // row above the game, so its height is exactly what the canvas cannot have.
  const bar = document.getElementById('shell');
  const barH = bar?.getBoundingClientRect().height || 0;
  const chrome = PLAY_MODE ? barH
    : (document.fullscreenElement ? barH : barH + 76);
  const w = window.innerWidth, h = window.innerHeight - chrome;
  let s = Math.max(1, Math.min(Math.floor(w / SCREEN_W), Math.floor(h / SCREEN_H)));
  canvas.width = SCREEN_W * s;
  canvas.height = SCREEN_H * s;
  // On a phone the largest whole scale can leave a lot of the screen unused, so
  // CSS stretches the (still integer-rendered) canvas up to fill the short axis.
  // The buffer stays sharp; only the final blit is fractional.
  if (PLAY_MODE || document.fullscreenElement) {
    const fill = Math.min(w / SCREEN_W, h / SCREEN_H);
    canvas.style.width = `${Math.round(SCREEN_W * fill)}px`;
    canvas.style.height = `${Math.round(SCREEN_H * fill)}px`;
  } else {
    canvas.style.width = `${SCREEN_W * s}px`;
    canvas.style.height = `${SCREEN_H * s}px`;
  }
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
document.addEventListener('fullscreenchange', fit);
picker.addEventListener('change', () => go(picker.value));

// ---- ?touchdebug=1 --------------------------------------------------------
//
// A standalone diagnostics page measured raw pointer events on a plain div and
// reported everything healthy while the game stayed broken -- because the game
// does not use raw events on a div, it uses the Touch class on the canvas. So
// this measures the real instance in the real place: whether Touch enabled
// itself at all, whether its listeners are seeing anything, and what the
// movement code is actually being handed each frame.
//
// Note the trap this exists to expose: fire works on a phone even when the
// thumbsticks are completely inactive, because the pointerdown handler above
// treats button 0 as a fire press. "Fire works" is therefore NOT evidence that
// Touch is running.
if (globalThis.location?.search?.includes('touchdebug')) {
  const box = document.createElement('div');
  // Safe-area padding and a border, because the first thing a diagnostic must
  // do is be visible: in fullscreen on a notched phone the top-left corner sits
  // under the status bar, and "no overlay" is the one reading that must never
  // be ambiguous -- its absence is the version check for this very file.
  box.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;' +
    'max-width:100%;background:#000e;color:#7ddc86;border:2px solid #7ddc86;' +
    'font:11px/1.35 ui-monospace,monospace;white-space:pre;pointer-events:none;' +
    'padding:6px 8px;padding-top:calc(6px + env(safe-area-inset-top, 0px));';
  document.body.append(box);

  // Bound on the canvas, alongside Touch's own listeners, to prove whether
  // events reach the element Touch is actually listening to.
  let raw = 0, lastRaw = '-', lastDown = '-', moved = 0;
  const seenAt = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    lastDown = `${e.pointerType} btn=${e.button} @${e.clientX | 0},${e.clientY | 0}`;
    seenAt.x = e.clientX; seenAt.y = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    raw++;
    if (e.clientX !== seenAt.x || e.clientY !== seenAt.y) moved++;
    seenAt.x = e.clientX; seenAt.y = e.clientY;
    lastRaw = `${e.pointerType} @${e.clientX | 0},${e.clientY | 0}`;
  });

  setInterval(() => {
    const r = canvas.getBoundingClientRect();
    const sticks = [...touch.sticks.values()]
      .map((k) => `${k.side} d=${(k.x - k.x0) | 0},${(k.y - k.y0) | 0}`).join(' | ');
    box.textContent = [
      `touch.enabled   ${touch.enabled}   <- if false, NO sticks exist`,
      `coarse pointer  ${globalThis.matchMedia?.('(pointer: coarse)')?.matches}`,
      `canvas rect     ${r.width | 0}x${r.height | 0} at ${r.left | 0},${r.top | 0}`,
      `canvas events   ${raw} moves, ${moved} with new coords`,
      `last down       ${lastDown}`,
      `last move       ${lastRaw}`,
      `sticks          ${touch.sticks.size}${sticks ? '  ' + sticks : ''}`,
      `direction()     ${touch.direction()}`,
      `pointerLock     ${document.pointerLockElement ? 'LOCKED' : 'null'}`,
      `state           ${state}  mouseOn=${config.mouseOn}`,
      `cam             ${cam ? `falling=${!!cam.falling} dead=${!!cam.dead}` : 'none'}`,
    ].join('\n');
  }, 200);
}

fit();
await setState(STATE.LOGO1, PRES.logo1);
requestAnimationFrame(loop);
