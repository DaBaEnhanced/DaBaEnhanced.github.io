// On-screen messages, from Sorgenti/Text.asm.
//
// The original prints these into the sprite text overlay a character at a time
// ("un carattere al 25esimo" -- one per 25th of a second, so one every two
// ticks), then queues MessWait: `dc.b -2,60, -3,8, 0`, a wait of 60 ticks
// followed by "clear row 8". So a message types itself out, sits for just over
// a second, and disappears.
//
// The table is Messages/Mess0..Mess19 verbatim, and the indices matter because
// callers compute them: CollectItem returns 0-3 for keys and 8-11 for the
// pickups, SwitchManagement adds 3 to a key number to get "NEED x KEY", and
// KIchangeweapon adds 13 to the weapon slot.

export const MESSAGES = [
  'COLLECTED GREEN KEY',       // 0   CollectItem, keys 1-4
  'COLLECTED YELLOW KEY',      // 1
  'COLLECTED RED KEY',         // 2
  'COLLECTED BLUE KEY',        // 3
  'NEED GREEN KEY',            // 4   SwitchManagement: key + 3
  'NEED YELLOW KEY',           // 5
  'NEED RED KEY',              // 6
  'NEED BLUE KEY',             // 7
  'COLLECTED HEALTH ITEM',     // 8   CollectItem
  'COLLECTED SHIELDS ITEM',    // 9
  'COLLECTED ENERGY ITEM',     // 10
  'COLLECTED CREDITS ITEM',    // 11
  'WARNING!!! ITEM ERROR',     // 12  a pick item of the wrong type
  'SIMPLE SHOT',               // 13  KIchangeweapon: 13 + slot
  'FIREBALLS',                 // 14
  'PLASMA GUN',                // 15
  'FLAME-THROWER',             // 16
  'MAGNETIC GUN',              // 17
  'DEATH MACHINE',             // 18
  'PAUSE OFF',                 // 19
];

// The pickup -> message mapping lives in enemies.js, beside the subtype table
// it is derived from. It used to be duplicated here keyed on names, and the two
// drifted: this one expected `green` while a pickup is called `keyGreen`, so
// every key collected fell through to Mess12, "WARNING!!! ITEM ERROR".

const TYPE_TICKS = 2;          // one character per 25th of a second
const HOLD_TICKS = 60;         // MessWait's `-2,60`
const ROW = 8;                 // MessWait's `-3,8` clears row 8

export class Messages {
  constructor(charset) {
    this.cs = charset;
    this.text = '';
    this.shown = 0;            // characters revealed so far
    this.age = 0;
  }

  /** Show message `n` from the table, or a string of your own. */
  show(n) {
    const text = typeof n === 'number' ? MESSAGES[n] : n;
    if (!text) return;
    this.text = String(text).toUpperCase();
    this.shown = 0;
    this.age = 0;
  }

  clear() { this.text = ''; }

  update(ticks) {
    if (!this.text) return;
    this.age += ticks;
    const chars = Math.floor(this.age / TYPE_TICKS);
    this.shown = Math.min(this.text.length, chars);
    if (this.shown >= this.text.length
        && this.age - this.text.length * TYPE_TICKS > HOLD_TICKS) {
      this.clear();
    }
  }

  /**
   * A line that stays up rather than typing out and expiring -- used for the
   * pointer-lock prompt, which has to be readable until it is acted on.
   */
  drawStatic(fb, W, H, text, row = 2, colour = 21) {
    if (!this.cs || !text) return;
    const w = String(text).length * (this.cs.w + 1);
    drawInto(fb, W, H, this.cs, Math.max(0, (W - w) >> 1),
             row * (this.cs.h + 2), String(text).toUpperCase(), colour);
  }

  draw(fb, W, H) {
    if (!this.text || !this.cs) return;
    const line = this.text.slice(0, this.shown);
    if (!line) return;
    drawInto(fb, W, H, this.cs, 4, ROW * (this.cs.h + 2), line, 61);
  }
}

// A local copy of textdraw's inner loop: messages are drawn over the 3D view
// rather than into the terminal panel, so they need the view's own clip bounds.
function drawInto(fb, W, H, cs, x, y, str, colour) {
  const { w, h, data, chars } = cs;
  let cx = x;
  for (const raw of str) {
    const g = chars.indexOf(raw);
    if (g >= 0) {
      const base = g * w * h;
      for (let gy = 0; gy < h; gy++) {
        const ty = y + gy;
        if (ty < 0 || ty >= H) continue;
        for (let gx = 0; gx < w; gx++) {
          const tx = cx + gx;
          if (tx < 0 || tx >= W) continue;
          if (data[base + gy * w + gx]) fb[ty * W + tx] = colour;
        }
      }
    }
    cx += w + 1;
  }
}
