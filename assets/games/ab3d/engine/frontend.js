export const LEVEL_NAMES = Object.freeze([
  'THE GATE', 'STORAGE BAY', 'SEWER NETWORK', 'THE COURTYARD',
  'SYSTEM PURGE', 'THE MINES', 'THE FURNACE', 'TEST ARENA GAMMA',
  'SURFACE ZONE', 'TRAINING AREA', 'ADMIN BLOCK', 'THE PIT',
  'STRATA', 'REACTOR CORE', 'COOLING TOWER', 'COMMAND CENTRE',
]);

const SAVED_GUNS = [1, 2, 4, 7];
const SAVED_AMMO = [0, 1, 2, 4, 7];
const MENU_ITEMS = Object.freeze([
  { label: 'PLAY  GAME', row: 15, left: 15 },
  { label: 'CONTROL  OPTIONS', row: 17, left: 12 },
  { label: 'GAME CREDITS', row: 19, left: 14 },
  { label: 'PASSWORD', row: 21, left: 16 },
]);

const CONTROL_LINES = [
  [4, '            DEFINE  CONTROLS            '],
  [6, '     TURN LEFT                  Q / LEFT '],
  [7, '     TURN RIGHT                 E / RIGHT'],
  [8, '     FORWARDS                   W        '],
  [9, '     BACKWARDS                  S        '],
  [10, '     FIRE                       F / CTRL '],
  [11, '     OPERATE DOOR/LIFT/SWITCH   SPACE    '],
  [12, '     SIDESTEP LEFT              A        '],
  [13, '     SIDESTEP RIGHT             D        '],
  [14, '     DUCK                        C        '],
  [15, '     RUN                         SHIFT    '],
  [16, '             OTHER CONTROLS             '],
  [17, ' WEAPONS          1-5  PAUSE            P '],
  [18, ' TITLE MENU ESC/BACK  FULLSCREEN        X'],
  [19, ' GAMEPAD    STICKS / A FIRE / X OPERATE '],
  [27, '               MAIN  MENU               '],
];

const CREDIT_LINES = [
  [0, '    Programming, Game Code, Graphics    '],
  [1, '         Game Design and Manual         '],
  [2, '            Andrew Clitheroe            '],
  [4, '             Alien Graphics             '],
  [5, '             Michael  Green             '],
  [7, '           3D Object Designer           '],
  [8, '            Charles Blessing            '],
  [10, '              Level Design              '],
  [11, 'Michael Green  Ben Chanter   Jackie Lang'],
  [12, '     Kai Barrett Charles Blessing       '],
  [14, '           Creative  Director           '],
  [15, '              Martyn Brown              '],
  [17, '       Project Manager and Manual       '],
  [18, "            Martin O'Donnell            "],
  [20, '              Music + SFX               '],
  [21, '              Bjorn Lynne               '],
  [23, '      Cover Illustration and Logo       '],
  [24, '             Kevin Jenkins              '],
  [26, '      Packaging and Manual Design       '],
  [27, '               Paul Sharp               '],
  [29, '             QA and Playtest            '],
  [30, '           Phil and The Wolves          '],
];

// titlecop.s:OPTCOP changes sprite colours 2/3 once per eight-line glyph.
// controlloop.s:HIGHLIGHT skips the 16-byte sprite header and then inverts
// only the second sprite bitplane: normal glyph pixels remain colour 1;
// selected background becomes colour 2 and selected glyphs become colour 3.
const MENU_HIGHLIGHT_BACKGROUND = Object.freeze([
  [34, 0, 0], [68, 0, 0], [102, 0, 0], [136, 0, 0],
  [136, 0, 0], [102, 0, 0], [68, 0, 0], [34, 0, 0],
]);
const MENU_HIGHLIGHT_FOREGROUND = Object.freeze([
  [68, 68, 136], [119, 119, 170], [170, 170, 204], [204, 204, 255],
  [204, 204, 255], [170, 170, 204], [119, 119, 170], [68, 68, 136],
]);

export function sourceMenuPixelColour(set, inverted, scanline, normalColour = null) {
  if (!inverted) return set ? normalColour : null;
  return (set ? MENU_HIGHLIGHT_FOREGROUND : MENU_HIGHLIGHT_BACKGROUND)[scanline & 7];
}

function byte(value) { return value & 0xff; }

export function withSourceParity(value) {
  value &= 0x7f;
  let parity = 0;
  for (let bit = 0; bit < 7; bit++) parity ^= value >> bit & 1;
  return value | parity << 7;
}

export function hasSourceParity(value) {
  return withSourceParity(value) === (value & 0xff);
}

function packedOwnership(guns) {
  let word = 0;
  for (let index = 0; index < SAVED_GUNS.length; index++) {
    word = word & 0xff00 | (guns[SAVED_GUNS[index]] ? 0xff : 0);
    word = index === SAVED_GUNS.length - 1 ? word >>> 3 : word << 1 & 0xffff;
  }
  return word & 0xf0;
}

function interleaveBytes(first, second) {
  let result = 0;
  first &= 0xff;
  second &= 0xff;
  for (let bit = 0; bit < 8; bit++) {
    result = result << 1 | first & 1;
    first >>>= 1;
    result = result << 1 | second & 1;
    second >>>= 1;
  }
  return result & 0xffff;
}

export function encodePassword(state) {
  const level = Math.max(0, Math.min(15, state.level | 0));
  const guns = state.guns || [];
  const ammo = state.ammo || [];
  const buffer = new Uint8Array(8);
  buffer[0] = withSourceParity(state.energy ?? 127);
  buffer[1] = packedOwnership(guns) | level;
  for (let index = 0; index < SAVED_AMMO.length; index++) {
    buffer[index + 2] = withSourceParity((ammo[SAVED_AMMO[index]] || 0) >>> 3);
  }
  buffer[7] = byte(-byte(buffer[1] ^ 0xb5) + 50);

  const packed = new Uint8Array(8);
  for (let index = 0; index < 4; index++) {
    const word = interleaveBytes(buffer[index], byte(~buffer[7 - index]));
    packed[index * 2] = word >>> 8;
    packed[index * 2 + 1] = word;
  }
  let password = '';
  for (const value of packed) {
    password += String.fromCharCode(65 + (value & 15));
    password += String.fromCharCode(65 + (value >>> 4 & 15));
  }
  return password;
}

export function decodePassword(text) {
  const normalized = text.toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{16}$/.test(normalized)) return null;
  const packed = new Uint8Array(8);
  for (let index = 0; index < 8; index++) {
    const low = (normalized.charCodeAt(index * 2) - 65) & 15;
    const high = (normalized.charCodeAt(index * 2 + 1) - 65) & 15;
    packed[index] = low | high << 4;
  }

  const buffer = new Uint8Array(8);
  for (let index = 0; index < 4; index++) {
    let word = packed[index * 2] << 8 | packed[index * 2 + 1];
    let first = 0, second = 0;
    for (let bit = 0; bit < 8; bit++) {
      first = first << 1 | word & 1;
      word >>>= 1;
      second = second << 1 | word & 1;
      word >>>= 1;
    }
    buffer[index] = second;
    buffer[7 - index] = byte(~first);
  }
  if (![0, 2, 3, 4, 5, 6].every(index => hasSourceParity(buffer[index]))) return null;
  if (byte(-byte(buffer[1] ^ 0xb5) + 50) !== buffer[7]) return null;

  const guns = Array(8).fill(false);
  guns[0] = true;
  for (let index = 0; index < SAVED_GUNS.length; index++) {
    guns[SAVED_GUNS[index]] = Boolean(buffer[1] & 0x80 >> index);
  }
  const ammo = Array(8).fill(0);
  for (let index = 0; index < SAVED_AMMO.length; index++) {
    ammo[SAVED_AMMO[index]] = (buffer[index + 2] & 0x7f) << 3;
  }
  return {
    level: buffer[1] & 15,
    energy: buffer[0] & 0x7f,
    guns,
    ammo,
  };
}

// `wevewon` increments MAXLEVEL before controlloop serializes the live player
// through CALCPASSWORD/PASSLINETOGAME/GETSTATS.  Preserve that lossy, eight-unit
// ammo representation rather than carrying browser-only state between levels.
export function advanceCampaign(state) {
  const level = Math.max(0, Math.min(15, state.level | 0));
  if (level === 15) return { type: 'ending' };
  const password = encodePassword({ ...state, level: level + 1 });
  return { type: 'menu', stats: decodePassword(password), password };
}

function blankLines() { return Array(32).fill(' '.repeat(40)); }

function put(lines, row, value) {
  lines[row] = value.padEnd(40).slice(0, 40);
}

export class FrontendController {
  constructor() {
    this.active = false;
    this.screen = 'menu';
    this.selected = 0;
    this.passwordInput = '';
    this.passwordError = false;
    this.resume = null;
    this.sourcePixels = true;
    this.displayMode = 'original';
    this.crtFilter = false;
    this.controlSelected = 0;
    this.stats = {
      level: 0, energy: 127,
      guns: [true, false, false, false, false, false, false, false],
      ammo: [160, 0, 0, 0, 0, 0, 0, 0],
    };
  }

  resetStats() {
    this.stats = {
      level: 0, energy: 127,
      guns: [true, false, false, false, false, false, false, false],
      ammo: [160, 0, 0, 0, 0, 0, 0, 0],
    };
  }

  setStats(current) {
    this.stats = {
      level: current.level | 0,
      energy: current.energy | 0,
      guns: [...current.guns],
      ammo: [...current.ammo],
    };
  }

  open(current = null) {
    this.active = true;
    this.screen = 'menu';
    this.selected = 0;
    this.passwordInput = '';
    this.passwordError = false;
    this.resume = current;
    if (current) this.setStats(current);
  }

  close() { this.active = false; }

  setSourcePixels(enabled) {
    this.sourcePixels = Boolean(enabled);
    this.displayMode = this.sourcePixels ? 'original' : 'sharp';
  }

  setDisplayMode(mode) {
    if (!['original', 'sharp', 'enhanced'].includes(mode)) return;
    this.displayMode = mode;
    this.sourcePixels = mode === 'original';
  }

  setCrtFilter(enabled) { this.crtFilter = Boolean(enabled); }

  activateRow(row) {
    if (this.screen === 'controls') {
      if (row === 28 || row === 29) this.controlSelected = row - 28;
      return this.key('Enter');
    }
    if (this.screen !== 'menu') return this.key('Enter');
    const selected = MENU_ITEMS.findIndex(item => item.row === row);
    if (selected < 0) return null;
    this.selected = selected;
    return this.key('Enter');
  }

  key(code, key = '') {
    if (!this.active) return null;
    if (this.screen === 'menu') {
      if (code === 'ArrowUp') this.selected = Math.max(0, this.selected - 1);
      else if (code === 'ArrowDown') this.selected = Math.min(MENU_ITEMS.length - 1, this.selected + 1);
      else if (code === 'Escape' && this.resume) return { type: 'resume' };
      else if (code === 'Enter' || code === 'Space') {
        if (this.selected === 0) return { type: 'play', stats: this.stats };
        if (this.selected === 1) {
          this.screen = 'controls';
          this.controlSelected = 0;
        }
        if (this.selected === 2) this.screen = 'credits';
        if (this.selected === 3) {
          this.screen = 'password';
          this.passwordInput = '';
          this.passwordError = false;
        }
      }
      return null;
    }
    if (this.screen === 'password') {
      if (code === 'Escape') this.screen = 'menu';
      else if (code === 'Backspace') {
        this.passwordInput = this.passwordInput.slice(0, -1);
        this.passwordError = false;
      } else if (/^[a-z]$/i.test(key) && this.passwordInput.length < 16) {
        this.passwordInput += key.toUpperCase();
        this.passwordError = false;
      } else if (code === 'Enter') {
        const decoded = decodePassword(this.passwordInput);
        if (decoded) {
          this.stats = decoded;
          this.screen = 'menu';
          this.passwordInput = '';
          return { type: 'password', stats: decoded };
        }
        this.passwordError = true;
      }
      return null;
    }
    if (this.screen === 'controls') {
      if (code === 'Escape') this.screen = 'menu';
      else if (code === 'ArrowUp') this.controlSelected = Math.max(0, this.controlSelected - 1);
      else if (code === 'ArrowDown') this.controlSelected = Math.min(1, this.controlSelected + 1);
      else if (code === 'Enter' || code === 'Space') {
        if (this.controlSelected === 0) {
          const modes = ['original', 'sharp', 'enhanced'];
          this.displayMode = modes[(modes.indexOf(this.displayMode) + 1) % modes.length];
          this.sourcePixels = this.displayMode === 'original';
          return { type: 'display-mode', displayMode: this.displayMode };
        }
        this.crtFilter = !this.crtFilter;
        return { type: 'crt-filter', crtFilter: this.crtFilter };
      }
      return null;
    }
    if (code === 'Escape' || code === 'Enter' || code === 'Space') this.screen = 'menu';
    return null;
  }

  lines() {
    const lines = blankLines();
    if (this.screen === 'controls') {
      for (const [row, line] of CONTROL_LINES) put(lines, row, line);
      const displayName = {
        original: 'ORIGINAL 2X2', sharp: 'SHARP PORT  ', enhanced: 'ENHANCED 320X180',
      }[this.displayMode];
      put(lines, 28, ` PORT DISPLAY    : ${displayName}`);
      put(lines, 29, ` PORT CRT FILTER : ${this.crtFilter ? 'ON ' : 'OFF'} (BROWSER)`);
      put(lines, 30, ' ARROWS SELECT  ENTER TOGGLE  ESC : MENU ');
      return { lines, highlight: { row: 28 + this.controlSelected, left: 1, width: 37 } };
    }
    if (this.screen === 'credits') {
      for (const [row, line] of CREDIT_LINES) put(lines, row, line);
      return { lines, highlight: null };
    }
    const level = Math.max(0, Math.min(15, this.stats.level));
    put(lines, 11, `      LEVEL ${String(level + 1).padStart(2)} : ${LEVEL_NAMES[level].padStart(16)}      `);
    put(lines, 13, '                1 PLAYER                ');
    for (const item of MENU_ITEMS) put(lines, item.row, item.label.padStart(item.left + item.label.length));
    if (this.screen === 'password') {
      const input = this.passwordInput.padEnd(16, '_');
      put(lines, 23, `            ${input}            `);
      if (this.passwordError) put(lines, 25, '            INVALID PASSWORD            ');
      return { lines, highlight: { row: 23, left: 12, width: 16 } };
    }
    put(lines, 23, `            ${encodePassword(this.stats)}            `);
    const selected = MENU_ITEMS[this.selected];
    return { lines, highlight: { ...selected, width: selected.label.length } };
  }
}

export class FrontendRenderer {
  constructor(fonts, titleImage) {
    this.fonts = fonts;
    this.titleImage = titleImage;
    this.surface = document.createElement('canvas');
    this.surface.width = 320;
    this.surface.height = 256;
    this.context = this.surface.getContext('2d');
  }

  draw(controller, target, width, height) {
    const context = this.context;
    context.imageSmoothingEnabled = false;
    context.drawImage(this.titleImage, 0, 0, 320, 256);
    const { lines, highlight } = controller.lines();
    for (let row = 0; row < 32; row++) {
      for (let column = 0; column < 40; column++) {
        const selected = highlight && row === highlight.row &&
          column >= highlight.left && column < highlight.left + highlight.width;
        this.drawGlyph(context, lines[row].charCodeAt(column), column * 8, row * 8, selected);
      }
    }
    target.imageSmoothingEnabled = false;
    target.clearRect(0, 0, width, height);
    const scale = Math.min(width / 320, height / 256);
    target.drawImage(this.surface, (width - 320 * scale) / 2, (height - 256 * scale) / 2,
      320 * scale, 256 * scale);
  }

  drawGlyph(context, code, x, y, inverted = false) {
    for (let py = 0; py < 8; py++) {
      const normalColour = this.fonts.menuColour(y + py);
      for (let px = 0; px < 8; px++) {
        const set = Boolean(this.fonts.sample('optfont', code, px, py));
        const colour = sourceMenuPixelColour(set, inverted, py, normalColour);
        if (!colour) continue;
        context.fillStyle = `rgb(${colour[0]} ${colour[1]} ${colour[2]})`;
        context.fillRect(x + px, y + py, 1, 1);
      }
    }
  }
}
