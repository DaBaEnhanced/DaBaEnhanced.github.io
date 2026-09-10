// The in-level terminal, from Sorgenti/Terminal.asm.
//
// Effect opcode 11 opens it (51 uses across the game). The original draws it
// into two hardware sprites using the 6x6 sprite-monitor font in Char.i; this
// draws the same font straight into the composite framebuffer, which produces
// the same text at the same size without the sprite machinery.
//
// The pages are data in Terminal.asm. Each menu item carries `credits` (price)
// and `value` (quantity), which is where the shop prices come from:
//
//   term_page1  weapons       Fireballs 4000, Plasma 9000, Flamethrower 13000,
//                             Magnetic 20000, Death Machine 35000
//   term_page2  weapon boost  Simple 1500, Fireballs 2000, Plasma 5000,
//                             Flamethrower N/A, Magnetic 20000, Death 20000
//   term_page3  accessories   Health +10 for 200, Shields +10 for 150,
//                             Energy +100 for 200, each key 5000
//
// Buying deducts the price and only succeeds if the player can afford it
// (Terminal.asm subtracts and refuses on a negative result).

import { drawText } from './textdraw.js';
import { fetchBytes } from './fetch.js';

const PANEL_X = 24, PANEL_Y = 20, PANEL_W = 272, PANEL_H = 160;

export class Terminal {
  constructor(assets, charset) {
    this.cs = charset;                       // {w,h,chars,data}
    this.shop = assets.manifest.terminal;
    this.open = false;
    this.configOnly = false;      // true when Esc opened the configuration menu
    this.binding = null;          // the action waiting for a key, if any
    this.inGame = false;          // conf_page0 vs conf_page0p wording
    this.page = 'main';
    this.sel = 0;
    this.message = '';
    this.number = 0;
  }

  /** Draw a string; unknown characters (space included) leave a gap. */
  text(fb, W, x, y, str, colour) {
    return drawText(fb, W, 240, this.cs, x, y, str, colour);
  }

  box(fb, W, x, y, w, h, fill, border) {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const edge = yy === y || yy === y + h - 1 || xx === x || xx === x + w - 1;
        fb[yy * W + xx] = edge ? border : fill;
      }
    }
  }

  /** conf_page1/2/4: label, config field, and the value shown beside it. */
  configItems(page) {
    const c = this.config;
    const opt = (label, field) => ({ label, field, value: c.label(field) });
    if (page === 'window') {            // conf_page1 WINDOW CONFIGURATION
      return [opt('WINDOW SIZE', 'windowSize'),
              opt('PIXEL SIZE', 'pixelSize'),
              // The port's own: the original could only go smaller than
              // 320x200, because it had a 68020. See config.js.
              opt('RENDER SCALE', 'renderScale'),
              opt('HD ART', 'hdArt'),
              opt('SIGHT', 'sight')];
    }
    if (page === 'sound') {             // conf_page2 SOUND CONFIGURATION
      return [opt('MUSIC VOLUME', 'musicVolume'),
              opt('MUSIC STATE', 'musicOn'),
              opt('AUDIO FILTER', 'filter')];
    }
    // conf_page4 CONTROL CONFIGURATION. The original splits the four speed
    // selectors under two headings, ACCEL. KEY NOT PRESSED and ACCEL. KEY
    // PRESSED; the suffixes here carry the same meaning in one list.
    if (page === 'keys') {          // conf_page3 KEYS CONFIGURATION
      return c.constructor.ACTIONS.map(([action, label]) => ({
        label, action, value: this.binding === action ? '?' : c.keyLabel(action),
      })).concat([{ label: 'RESET TO DEFAULTS', reset: true }]);
    }
    return [opt('CONTROL', 'control'),
            opt('MOUSE SENSITIVITY', 'mouseSensitivity'),
            opt('MOUSE LOOK', 'mouseLook'),
            opt('WALKING INERTIA', 'walkInertia'),
            opt('ROTATING INERTIA', 'rotInertia'),
            opt('WALKING SPEED', 'walkSpeed'),
            opt('ROTATING SPEED', 'rotSpeed'),
            opt('RUN WALKING SPEED', 'runSpeed'),
            opt('RUN ROTATING SPEED', 'rotRunSpeed')];
  }

  items() {
    if (this.page === 'main') {
      // conf_page0 / conf_page0p: the configuration menu is its own root when
      // Esc opened it, and a branch of the shop when a terminal did.
      if (this.configOnly) {
        // conf_page0 in game, conf_page0p at the title -- which adds CREDITS.
        // GAME OPTIONS (conf_page5) is access-code entry and SAVE
        // CONFIGURATION; the title screen already takes a typed code, and the
        // configuration saves itself on every change, so it has no page here.
        return [{ label: this.inGame ? 'RETURN TO GAME' : 'START GAME' },
                { label: 'WINDOW' }, { label: 'SOUND' }, { label: 'KEYBOARD' },
                { label: 'CONTROLS' },
                ...(this.inGame ? [] : [{ label: 'CREDITS' }])];
      }
      return [{ label: 'WEAPONS' }, { label: 'WEAPONS BOOST' },
              { label: 'ACCESSORIES' }, { label: 'CONFIGURATION' },
              { label: 'EXIT' }];
    }
    if (this.page === 'config') {
      return [{ label: 'WINDOW' }, { label: 'SOUND' }, { label: 'KEYBOARD' },
              { label: 'CONTROLS' }, { label: 'EXIT' }];
    }
    if (this.page === 'window' || this.page === 'sound' || this.page === 'controls'
        || this.page === 'keys') {
      return [...this.configItems(this.page), { label: 'MAIN PAGE' }];
    }
    if (this.page === 'weapons') {
      return [...this.shop.weapons.map((w) => ({ ...w, label: w.name })),
              { label: 'EXIT' }];
    }
    if (this.page === 'boost') {
      return [...this.shop.boost.map((w) => ({ ...w, label: w.name })),
              { label: 'EXIT' }];
    }
    return [...this.shop.accessories.map((a) => ({ ...a, label: a.name })),
            { label: 'EXIT' }];
  }

  price(item) {
    return item.price === undefined ? null : item.price;
  }

  choose(player) {
    const list = this.items();
    const item = list[this.sel];
    if (!item) return;
    const SUB = ['window', 'sound', 'keys', 'controls'];
    const leaving = ['EXIT', 'MAIN PAGE', 'RETURN TO GAME', 'START GAME']
      .includes(item.label);
    if (leaving) {
      // A sub-page goes back to whichever root opened it: the configuration
      // menu's own root when Esc opened it (conf_page0/0p), or the shop's
      // CONFIGURATION branch when a terminal did.
      if (this.page === 'main') { this.open = false; this.onClose?.(); return; }
      if (SUB.includes(this.page)) this.page = this.configOnly ? 'main' : 'config';
      else this.page = 'main';
      this.sel = 0; this.message = '';
      return;
    }
    if (this.page === 'main') {
      if (this.configOnly && item.label === 'CREDITS') {
        this.open = false; this.onCredits?.();
        return;
      }
      // conf_page0's first entry is RETURN TO GAME, so the sub-pages start at 1.
      this.page = this.configOnly ? SUB[this.sel - 1]
        : ['weapons', 'boost', 'accessories', 'config'][this.sel];
      this.sel = 0; this.message = '';
      return;
    }
    if (this.page === 'config') {
      this.page = SUB[this.sel];
      this.sel = 0; this.message = '';
      return;
    }
    if (item.reset) { this.config.resetKeys(); this.message = 'DEFAULTS'; return; }
    if (item.action) {
      // conf_page3's selectors are type 3, not type 2: they do not cycle a
      // list, they wait for a key. main.js watches `binding` and hands the
      // next keydown to bindKey.
      this.binding = item.action;
      this.message = 'PRESS A KEY';
      return;
    }
    if (item.field) {
      // a cycle selector steps to its next value rather than buying anything
      this.config.cycle(item.field, 1);
      this.onConfig?.(item.field);
      return;
    }
    if (item.price < 0) { this.message = 'NOT AVAILABLE'; return; }
    if (player.credits < item.price) { this.message = 'NOT ENOUGH CREDITS'; return; }

    if (this.page === 'weapons') {
      if (player.weapons[item.slot]) { this.message = 'ALREADY OWNED'; return; }
      player.weapons[item.slot] = 1;
    } else if (this.page === 'boost') {
      if (!player.weapons[item.slot]) { this.message = 'WEAPON NOT OWNED'; return; }
      if (player.weapons[item.slot] >= 2) { this.message = 'ALREADY BOOSTED'; return; }
      player.weapons[item.slot] = 2;
    } else {
      // CollectItem returns -1 when a capped resource or an already-held key
      // cannot be accepted. DSbuy skips the credit deduction on that path.
      if (!player.give(item.give, item.value)) {
        this.message = 'CANNOT BUY';
        return;
      }
    }
    player.credits -= item.price;
    this.message = 'PURCHASED';
  }

  /**
   * Go up one page, or close from the root -- what choosing EXIT does, without
   * having to find EXIT first. Esc does this on a keyboard; on a touchscreen it
   * is a tap on the look side, because there is no Esc to press.
   */
  back() {
    const SUB = ['window', 'sound', 'keys', 'controls'];
    if (this.page === 'main') { this.open = false; this.onClose?.(); return; }
    if (SUB.includes(this.page)) this.page = this.configOnly ? 'main' : 'config';
    else this.page = 'main';
    this.sel = 0; this.message = '';
  }

  move(delta) {
    const n = this.items().length;
    this.sel = (this.sel + delta + n) % n;
    this.message = '';
  }

  /** Take the key the player pressed while a KEYS row was waiting for one. */
  bindKey(code) {
    if (!this.binding) return false;
    const action = this.binding;
    this.binding = null;
    if (code === 'Escape') { this.message = ''; return true; }   // cancelled
    this.config.bind(action, code);
    this.message = '';
    return true;
  }

  /** Left/right on a selector steps its value, the way the original's do. */
  step(dir) {
    const item = this.items()[this.sel];
    if (!item?.field) return false;
    this.config.cycle(item.field, dir);
    this.onConfig?.(item.field);
    return true;
  }

  draw(fb, W, player) {
    this.box(fb, W, PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0, 21);
    const cs = this.cs, lh = cs.h + 2;
    let y = PANEL_Y + 6;
    const TITLES = { window: 'WINDOW CONFIGURATION', sound: 'SOUND CONFIGURATION',
                     controls: 'CONTROL CONFIGURATION', keys: 'KEYS CONFIGURATION' };
    const heading = this.configOnly
      ? (TITLES[this.page] ?? 'CONFIGURATION MENU')
      : `TERMINAL ${this.number}`;
    this.text(fb, W, PANEL_X + 8, y, heading, 61);
    y += lh + 2;
    if (!this.configOnly) {
      this.text(fb, W, PANEL_X + 8, y, `CREDITS ${player.credits}`, 195);
    }
    y += lh;
    // LevelCodeOut packs the whole save state into the password, so the code
    // shown here changes as the player's health, credits and weapons change.
    if (this.code && !this.configOnly) {
      this.text(fb, W, PANEL_X + 8, y, this.code, 44);
    }
    y += lh + 4;

    const list = this.items();
    list.forEach((item, i) => {
      const on = i === this.sel;
      let line = (on ? '>' : '-') + item.label;
      if (item.value !== undefined) line += ` ${item.value}`;
      const p = this.price(item);
      if (p !== null && p >= 0) line += ` ${p}`;
      else if (p !== null) line += ' N-A';
      this.text(fb, W, PANEL_X + 8, y + i * lh, line, on ? 62 : 195);
    });
    if (this.message) {
      this.text(fb, W, PANEL_X + 8, PANEL_Y + PANEL_H - 12, this.message, 61);
    }
  }
}

export async function loadTerminal(assets) {
  const info = assets.manifest.charset;
  if (!info) return null;
  const data = await fetchBytes(`${assets.base}/${info.file}`);
  return new Terminal(assets, { ...info, data });
}
