// Menace - the presentation route, from the menu flow at $71a38.
//
//   71a54  moveq #$1,d0 / jsr $50370   ; tune 1 - the menu music
//   71a64  lea $7426e(pc),a0 / bsr $7221a  ; credits
//   71a70  bsr $71b76                  ; difficulty: F1 rookie, F2 expert,
//                                      ;   giving up after 500 frames
//   71a9c  lea $7447a(pc),a0 / bsr $7221a  ; level index
//   71aa4  bsr $71c50                  ; thumbnails
//   71aac  bsr $71b4a                  ; wait for a key
//   71ad2  bsr $72e50                  ; load the $23000 module
//   71ae6  bsr $72e82                  ; the mothership screen
//
// $71a74's `beq` after the difficulty select is inverted from the obvious
// reading: F1 sets Z and SKIPS the level index, while the 500-frame timeout
// clears it and falls into the index. The index is part of the attract loop,
// not a menu you choose from.
//
// The font is proportional: 16x16 three-plane glyphs from '!' ($21), with a
// width byte each at $686f0. Drawing it fixed-pitch spaces every string wrong.

export const MENU_W = 320;

export class Screens {
  constructor(man) {
    this.man = man;
    this.menu = man.menu;
  }

  glyphIndex(chArg) {
    const c = chArg.toUpperCase().charCodeAt(0);
    const i = c - this.menu.font.first;
    return (i >= 0 && i < this.menu.font.count) ? i : -1;
  }

  textWidth(str) {
    let w = 0;
    for (const ch of str) {
      const i = this.glyphIndex(ch);
      w += i < 0 ? 8 : this.menu.font.widths[i];
    }
    return w;
  }

  // Draw into a playfield's idx buffer using the menu palette's font ramp,
  // which lives in colours 0-7 and stays put for the whole screen.
  // How wide `str` renders, in the same proportional widths text() advances by.
  measure(str) {
    const f = this.menu.font;
    let w = 0;
    for (const ch of str) {
      const gi = this.glyphIndex(ch);
      w += gi >= 0 ? f.widths[gi] : 8;
    }
    return w;
  }

  text(pf, str, x, y) {
    const f = this.menu.font;
    let cx = x;
    for (const ch of str) {
      const gi = this.glyphIndex(ch);
      if (gi >= 0) {
        const src = gi * f.w * f.h;
        for (let iy = 0; iy < f.h; iy++) {
          const sy = y + iy;
          if (sy < 0 || sy >= 224) continue;
          for (let ix = 0; ix < f.w; ix++) {
            const sx = cx + ix;
            if (sx < 0 || sx >= MENU_W) continue;
            const v = f.data[src + iy * f.w + ix];
            if (v) pf.idx[sy * MENU_W + sx] = v;
          }
        }
        cx += f.widths[gi];
      } else {
        cx += 8;
      }
    }
    return cx;
  }

  // A plate in the style of the powerup icons: the menu palette carries their
  // four blues at 8..11 - $dff, $6ac, $36a, $038 - a light top-left edge, two
  // fills and a dark bottom-right one. F1 and F2 are awkward keys on a laptop
  // and the original's own instruction line is what these replace.
  button(pf, label, x, y, w, h, hot) {
    for (let iy = 0; iy < h; iy++) {
      const o = (y + iy) * 320;
      for (let ix = 0; ix < w; ix++) {
        const edge = iy === 0 || ix === 0;
        const shade = iy === h - 1 || ix === w - 1;
        pf.idx[o + x + ix] = edge ? 8 : shade ? 11 : (hot ? 9 : 10);
      }
    }
    // The font is PROPORTIONAL - f.widths[gi] per glyph - so a label cannot be
    // centred by counting characters.
    const f = this.menu.font;
    this.text(pf, label, x + ((w - this.measure(label)) >> 1),
              y + ((h - f.h) >> 1));
  }

  centre(pf, str, y) {
    return this.text(pf, str, (MENU_W - this.textWidth(str)) >> 1, y);
  }

  // One thumbnail is a 32-row slice of the DECODED 64x192 picture. Slicing the
  // file instead gives confetti, which is how this was first got wrong.
  thumb(pf, n, x, y) {
    const t = this.menu.thumbs;
    if (!t.data) return;
    const each = t.each;
    for (let iy = 0; iy < each; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= 224) continue;
      for (let ix = 0; ix < t.w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= MENU_W) continue;
        const v = t.data[(n * each + iy) * t.w + ix];
        if (v) pf.idx[sy * MENU_W + sx] = v;
      }
    }
  }

  // $71cde: erase the crack pattern out of a completed level's thumbnail.
  // BLTCON0 $d0c is minterm $0c, D = B AND NOT A - the thumbnail survives
  // only where the mask is clear. $71ccc applies it to every level below the
  // current one, so the index shows the trail of levels already destroyed.
  breakThumb(pf, x, y) {
    const m = this.menu.breakMask;
    if (!m || !m.data) return;
    for (let iy = 0; iy < m.h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= 224) continue;
      for (let ix = 0; ix < m.w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= MENU_W) continue;
        if (m.data[iy * m.w + ix]) pf.idx[sy * MENU_W + sx] = 0;
      }
    }
  }

  cursor(pf, x, y) {
    const c = this.menu.cursor;
    if (!c.data) return;
    for (let iy = 0; iy < c.h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= 224) continue;
      for (let ix = 0; ix < c.w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= MENU_W) continue;
        const v = c.data[iy * c.w + ix];
        if (v) pf.idx[sy * MENU_W + sx] = v;
      }
    }
  }

  // $7483a is the hardware sprite used by $72094's character grid. Its packed
  // pixels already use sprite colours 17-19; the control words place its 16px
  // bracket two pixels left of the selected glyph.
  nameCursor(pf, x, y) {
    const c = this.menu.nameCursor;
    if (!c || !c.data) return;
    for (let iy = 0; iy < c.h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= 224) continue;
      for (let ix = 0; ix < c.w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= MENU_W) continue;
        const v = c.data[iy * c.w + ix];
        if (v) pf.idx[sy * MENU_W + sx] = v;
      }
    }
  }
}

// Which parsed block is which screen. The strings and their coordinates both
// come from the data, so nothing here is transcribed by hand.
export const BLOCK = {
  CREDITS: 0,      // MENACE / DAVE JONES / PRESS F1 - ROOKIE
  DEATH: 1,        // SHIELD ENERGY DEPLETED / YOUR SHIP WAS DESTROYED
  RESTART: 2,      // PRESS FIRE / TO RESTART THIS LEVEL
  ENDING: 3,       // CONGRATULATIONS !
  CONTINUE: 4,     // WHY NOT CONTINUE
  LEGEND: 7,       // the seven powerups, beside the 32x171 icon column
  LEVELS: 8,       // the six level names, 32 rows apart to match the bands
  TALLY: 9,        // LEVEL n SCORE.... / TOTAL.... / SPEEDUPS...
  HISCORE: 10,     // the high score table
};

// The end-of-level tally (block 9) and the high score table (block 10) are
// both text blocks with placeholder numbers - '000000' for each level's score,
// '00' for each powerup count. $71ff0 edits the high score block IN PLACE,
// shuffling 24-byte entries down with `move.l -$18(a0),$4(a0)` and dropping the
// new score in, so the table is not a separate structure: the displayed text is
// the storage.
//
// Defaults are the DMA Design team - DAVE JONES, TONY SMITH, DMA DESIGN,
// BRIAN -W-, RUSSELL K, STEVE -H-, MIKE -D-, EWAN -W- - against $7479c's
// thresholds of 250000 down to 20000.
// Implements $7221a's renderer, $71fda's high score table, $71f84's tally
// formatting, $71bd6 and $71ccc (the level index screen, whose names live at
// $744fc), $71d78's prompt, $71c22's reveal, and the tally / high score blocks.
//
// $72c56 writes the table back to the DISK - it lays down $aaaa gap words, a
// $4489 sync and the $552a2a55 marker, the same custom format the loader reads.
// localStorage is the browser's equivalent, so high scores persist the way the
// original's did rather than resetting every reload.
const STORE_KEY = 'menace.hiscores';

export function loadScores(fallback) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* private mode, or storage disabled */ }
  return fallback;
}

export function saveScores(entries) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); }
  catch (e) { /* nothing to do - the table just will not persist */ }
}

// Insert a score the way $71ff0 does: find the first entry it beats, shuffle
// the rest down, drop it in. The table is always eight long.
//
// Returns {table, rank}. It does NOT mutate the array it is given - returning
// only the rank and expecting the caller's array to have changed is how the
// first version silently did nothing.
export function insertScore(entries, value, name) {
  const out = entries.slice();
  for (let i = 0; i < out.length; i++) {
    if (value > out[i].score) {
      out.splice(i, 0, { score: value, name });
      out.length = 8;
      return { table: out, rank: i };
    }
  }
  return { table: out, rank: -1 };
}
export function drawTally(sc, pf, blocks, score, power, level) {
  const b = blocks[9];
  if (!b) return;
  const six = (bcd) => bcd.map((v) => v.toString(16).padStart(2, '0')).join('').slice(-6);
  const two = (n) => String(Math.min(99, n)).padStart(2, '0');
  // the placeholders, in the order they appear in the block
  const nums = [];
  for (let i = 0; i < 6; i++) nums.push(six(score.perLevel[i] || [0, 0, 0, 0]));
  nums.push(six(score.score));
  const counts = [power.collected[3], power.collected[4], power.collected[5],
                  power.collected[1], power.collected[2], power.collected[6]];
  let ni = 0, ci = 0;
  for (const e of b) {
    if (e.t === '000000') sc.text(pf, nums[ni++] || '000000', e.x, e.y);
    else if (e.t === '00') sc.text(pf, two(counts[ci++] || 0), e.x, e.y);
    else sc.text(pf, e.t, e.x, e.y);
  }
}

// The high score block alternates a "rank score" string with a "....NAME" one,
// so the defaults can be read straight out of the recovered text rather than
// retyped.
export function defaultScores(blocks) {
  const b = blocks[9 + 1] || [];
  const out = [];
  for (let i = 0; i + 1 < b.length; i += 2) {
    const m = /^(\d)\s+(\d+)/.exec(b[i].t);
    if (!m) continue;
    out.push({ score: Number(m[2]), name: b[i + 1].t.replace(/^\.+/, '').trim() });
  }
  return out;
}

// Draw the table from entries rather than from the raw block, so an inserted
// score shows up.
export function drawScores(sc, pf, entries) {
  entries.slice(0, 8).forEach((e, i) => {
    const y = i * 16;
    sc.text(pf, (i + 1) + ' ' + String(e.score).padStart(6, '0'), 40, y);
    sc.text(pf, '....' + e.name, 136, y);
  });
}

// Draw a whole parsed block at the coordinates the data carries.
export function drawBlock(sc, pf, blocks, n) {
  const b = blocks[n];
  if (!b) return;
  for (const e of b) sc.text(pf, e.t, e.x, e.y);
}
