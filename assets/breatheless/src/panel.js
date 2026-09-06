// The status panel and its numeric readouts.
//
// ScorePrint (Sorgenti/Text.asm) does not overwrite a digit cell outright: it
// writes only the bitplanes named in the font header and leaves the rest of the
// panel showing through. CaratteriDigital uses planes 0, 2, 3 and 4;
// CaratteriMini uses 0 and 4. So a drawn pixel's colour is
//
//     (panelIndex & ~planeMask) | glyphIndex
//
// which is why the digits pick up the panel's own colouring rather than being
// flat grey. Getting this wrong produces legible but wrongly-coloured numbers.
//
// Field positions are the five ScorePrint call sites in Scores.asm, and the
// number is right-aligned into its field with leading ZEROS, not spaces --
// ScorePrint fills the unused leading positions with character 0.

import { fetchBytes } from './fetch.js';

// TurnLight (Scores.asm) blits an 8-wide, 6-row shape in a solid colour index.
// Offsets in the source are byte offsets into a 40-byte-per-row bitplane, so
// x = byteOffset * 8 and y = the row it was multiplied by.
const KEY_SHAPE = [255, 255, 255, 255, 255, 255];        // KeyLightData: a solid block

// KeyLightData call sites: offset, "off" colour, "on" colour.
const KEY_LIGHTS = [
  { name: 'green',  x: 1 * 8, y: 8,  off: 21, on: 61 },
  { name: 'yellow', x: 3 * 8, y: 8,  off: 21, on: 195 },
  { name: 'red',    x: 1 * 8, y: 23, off: 21, on: 62 },
  { name: 'blue',   x: 3 * 8, y: 23, off: 21, on: 44 },
];

// WeaponLightData: a small digit 1..6 per weapon slot, with its own offset.
const WEAPON_LIGHTS = [
  { x: 36 * 8, y: 7,  shape: [16, 16, 16, 16, 16, 0] },
  { x: 38 * 8, y: 7,  shape: [60, 4, 60, 32, 60, 0] },
  { x: 36 * 8, y: 19, shape: [60, 4, 28, 4, 60, 0] },
  { x: 38 * 8, y: 19, shape: [36, 36, 60, 4, 4, 0] },
  { x: 36 * 8, y: 31, shape: [60, 32, 60, 4, 60, 0] },
  { x: 38 * 8, y: 31, shape: [60, 32, 60, 36, 60, 0] },
];
const WEAPON_ABSENT = 0, WEAPON_OWNED = 195, WEAPON_ACTIVE = 62;

export class Panel {
  constructor(assets, gfx, fonts) {
    this.w = gfx.w;
    this.h = gfx.h;
    this.base = gfx.data;                    // the untouched panel graphic
    this.buffer = new Uint8Array(gfx.data);  // what we actually draw
    this.fonts = fonts;                      // name -> {w,h,count,planeMask,data}
    this.fields = assets.manifest.panelFields ?? [];
    this.last = {};
  }

  /** Draw one right-aligned, zero-padded number into a field. */
  drawNumber(field, value) {
    const f = this.fonts[field.font];
    if (!f) return;
    const n = Math.max(0, Math.min(value | 0, 10 ** field.digits - 1));
    const text = String(n).padStart(field.digits, '0');
    const keep = ~f.planeMask & 0xff;
    for (let i = 0; i < field.digits; i++) {
      const glyph = text.charCodeAt(i) - 48;
      if (glyph < 0 || glyph >= f.count) continue;
      const gx = field.x + i * f.w, gy = field.y;
      const src = glyph * f.w * f.h;
      for (let y = 0; y < f.h; y++) {
        const ty = gy + y;
        if (ty < 0 || ty >= this.h) continue;
        for (let x = 0; x < f.w; x++) {
          const tx = gx + x;
          if (tx < 0 || tx >= this.w) continue;
          const o = ty * this.w + tx;
          this.buffer[o] = (this.base[o] & keep) | f.data[src + y * f.w + x];
        }
      }
    }
  }

  /** TurnLight: set every pixel of the shape to `colour`, leave the rest. */
  light(x, y, shape, colour) {
    for (let row = 0; row < shape.length; row++) {
      const ty = y + row;
      if (ty < 0 || ty >= this.h) continue;
      const bits = shape[row];
      for (let bit = 0; bit < 8; bit++) {
        if (!(bits & (0x80 >> bit))) continue;
        const tx = x + bit;
        if (tx < 0 || tx >= this.w) continue;
        this.buffer[ty * this.w + tx] = colour;
      }
    }
  }

  drawKeys(keys) {
    KEY_LIGHTS.forEach((k, i) => {
      this.light(k.x, k.y, KEY_SHAPE, keys[i] ? k.on : k.off);
    });
  }

  drawWeapons(owned, active) {
    WEAPON_LIGHTS.forEach((w, i) => {
      const colour = !owned[i] ? WEAPON_ABSENT
        : (i === active ? WEAPON_ACTIVE : WEAPON_OWNED);
      this.light(w.x, w.y, w.shape, colour);
    });
  }

  /** Refresh the readouts; only redraws a field whose value changed. */
  update(values) {
    for (const field of this.fields) {
      const v = values[field.name] ?? 0;
      if (this.last[field.name] === v) continue;
      this.last[field.name] = v;
      this.drawNumber(field, v);
    }
    if (values.keys) {
      const sig = values.keys.join(',');
      if (this.last.keys !== sig) { this.last.keys = sig; this.drawKeys(values.keys); }
    }
    if (values.weapons) {
      const sig = values.weapons.join(',') + '/' + values.weapon;
      if (this.last.weapons !== sig) {
        this.last.weapons = sig;
        this.drawWeapons(values.weapons, values.weapon);
      }
    }
    return this.buffer;
  }
}

export async function loadPanel(assets) {
  const gfxInfo = assets.manifest.gfx?.Panel04;
  if (!gfxInfo) return null;
  const get = (file) => fetchBytes(`${assets.base}/${file}`);
  const gfx = { ...gfxInfo, data: await get(gfxInfo.file) };
  const fonts = {};
  for (const [name, info] of Object.entries(assets.manifest.fonts ?? {})) {
    fonts[name] = { ...info, data: await get(info.file) };
  }
  return new Panel(assets, gfx, fonts);
}
