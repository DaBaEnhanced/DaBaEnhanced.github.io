// Shared text drawing with the 6x6 sprite-monitor charset from Sorgenti/Char.i.
//
// The charset holds 41 glyphs -- A-Z, 0-9, then - + ! " = -- five pixels wide
// in bits 7..3 of six rows. Characters it does not have (space included) simply
// advance the cursor, which is how the original spaces its menus.

export function drawText(fb, W, H, cs, x, y, str, colour) {
  const { w, h, data, chars } = cs;
  let cx = x;
  for (const raw of String(str).toUpperCase()) {
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
  return cx;
}

/** Width in pixels a string will occupy. */
export function textWidth(cs, str) {
  return String(str).length * (cs.w + 1);
}
