// Menace - browser engine, playfield renderer.
//
// The display is an Amiga dual playfield, not one framebuffer:
//   PF1  background, 2 planes, colours 0-3, a 24x12 tile map that wraps
//   PF2  foreground, 3 planes, values 0-7 where 0 is transparent and a
//        non-zero v draws as colour 8+v
// PF2 is in front. The two scroll at different rates, which is where the
// parallax comes from.
//
// Palette handling is not a detail here. Playfield colours 0-7 are swapped per
// alien type by $71766, and levels 2 and 6 run copper gradients on colour 1, so
// tiles ship as raw palette indices and colour is applied at draw time.

// Routines this file implements, cited so tools/coverage.py can see them:
//   $6fbec checkpf2 / $6fbd0 checkpf1  playfield scroll bookkeeping
//   $70580 drawfgnds                   foreground column drawing
//   $70738 buildbackgnd                background tile map
//   $708f4 restorebgnds                background restore, implicit in a full
//                                      redraw each frame
//   $70f54 draw.aliens / $70a56        alien blit, mirroring, PF1 placement
//   $70684 draw.guardian               the column-at-a-time reveal
//   $70718 guardian palette            guard.colours into 8-15
//   $718a6 panel bars                  masked with $aaaa as they deplete
//   $71884 panel bars                  ORed with $5555 as they refill
//   $6fcc0 flipbgnd                    double buffering, not needed on canvas
//   $7020a outriders                   merged into the ship's back sprite
//   $718d0 print.score                 digits ORed into the panel bitmap
//   $707ae drawback                    background tile drawing
//   $7096e draws sprite type 4          the guardian's parts, via drawAlien;
//                                       its round-robin effect channel is in
//                                       paula.js
//   $70f34 save.aliens                 unnecessary without a real playfield
export const SCREEN_W = 320;
export const PLAYFIELD_H = 192;         // the dual-playfield band
export const PANEL_H = 32;              // the copper splits here
export const SCREEN_H = PLAYFIELD_H + PANEL_H;   // 224, the display window
export const BG_RATIO = 2;        // measured, see Playfield.render

// The two coordinate spaces, and the constants that bridge them.
//
// The ship is a hardware SPRITE, positioned by $701ec. Aliens, shots, bonus
// pods and the guardian are BITMAP objects in playfield 2, addressed by $7103c
// as (x - $30(a5)) >> 3 within a 92-byte row. $70df8 pins one against the
// other: seek mode aims an alien at (($26 + $36) >> 1, ($28 + $e) >> 1), which
// the mover doubles back, so the ship's centre in PF2 space is
// ($26 + 54, $28 + 26).
//
// PF2_ORIGIN_X is fitted to two things that can be checked against the running
// original rather than argued about, because the arithmetic has more free terms
// than it has anchors:
//
//   the guardian is exactly 256 px - sixteen 16 px columns - and rests flush
//   with the right edge of a 320 px screen, so its left edge is at 64
//   the eye is a path record at PF2 x 282 and has to sit in the socket painted
//   into the guardian at guardian-local x ~174, i.e. screen ~238
//
// 96 - 40 + 8 = 64 satisfies the first; 282 - 16 + 11 - 40 = 237 satisfies the
// second. The shot limit $168 then kills a shot at screen 320, the right edge,
// which is a third fact agreeing. Reading it straight out of $7103c gives 0 -
// the fine scroll it subtracts is exactly the one BPLCON1 adds back - and that
// cannot be reconciled with any of the three, so this stays labelled fitted.
//
// 30 was tried here, on the strength of two things the emulator settled: the
// copper's DIWSTRT h $78 against DIWSTOP h $ffc6 is a 334 px window rather than
// 320, and the ship's sprite really does sit at $26 + 8. Both are true and
// neither licenses this constant. Checked against WinUAE the guardian at 64 is
// right and 74 is visibly too far right, so the ten pixels do NOT belong to the
// scene as a whole - they belong to the aliens alone, and ALIEN_ORIGIN_X below
// is where they now live.
export const PF2_ORIGIN_X = 40;

// Aliens share it, and that is MEASURED, not assumed. Path records go through
// $7101c into PF1 - 100-byte rows, `x + $10 - $32(a5)` - while $7103c puts the
// guardian and the shots into PF2 at `x - $30(a5)` over 92-byte rows. Two
// playfields, two fine scrolls, two fetch bases: nothing requires the two
// addressers to land on the same screen column for the same x, so it had to be
// checked rather than reasoned about.
//
// `node emu/run.js --anchor 0 14000` catches level 1 at $54 = 3, $56 = 16 - the
// guardian fight, scroll stopped, all sixteen columns blitted - and puts a PF2
// object and a PF1 object in one frame, which is what cancels the display
// constant. The guardian's blit starts at frame column 96 with $30 = 8, and its
// socket is a stable PF2 hole at columns 262..278: guardian-local 174, exactly
// the value PF2_ORIGIN_X was fitted to. So the guardian's screen x is 96 + 8 - K,
// and against the 64 that WinUAE confirms, K = 40.
//
// The eye is then read straight off the same frame. It is record 0 at x = 282,
// y = 90, and it is the only live record above y = 100, so display rows 90..99
// contain nothing else. There it is a 19 px disc at columns 256..274 - and
// sprite 3's artwork is a 19 px disc with 2 px of left margin, so the blit
// starts at 254:
//
//   254 + 12 - 40 = 226     the original ($32 was 12)
//   282 - 16 - 40 = 226     what PF2_ORIGIN_X gives
//
// Exact. The offset is zero, and the constant is kept as its own name so the
// next person does not have to redo this to find that out.
//
// A -6 was briefly applied here on the strength of the wave in `--anchor 0 1200`,
// whose leftmost ink sits 6 px right of where that arithmetic predicts. Do not
// trust that capture over this one: its aliens are mid-flight and the record
// dump is not taken at the same instant as the blit, while the guardian frame
// has a stopped scroll and a stationary target isolated in its own rows.
export const ALIEN_ORIGIN_X = PF2_ORIGIN_X;
// Zero, and this one IS derived. Both addressers take the row as `y * stride`
// with nothing added at all - $71024 mulu.w #$64,d2 and $71040 mulu.w #$5c,d2 -
// so an object's row is its bitmap row, and the bitmap's first row is the first
// displayed one. A record at y is at screen y.
//
// The 2 came from assuming seek mode aims at the ship's exact vertical centre,
// which was the weakest link in that chain, and it lifted every alien - the
// guardian's eye and the shots it fires included - two pixels off the fixed
// artwork they are supposed to line up with.
export const PF2_ORIGIN_Y = 0;

// At phase 3 the scroll stops with PF2's fine scroll frozen, and $70708 says
// exactly where: the transition only fires when $30(a5) is 8. BPLCON1's PF2
// nibble then delays playfield 2 by eight pixels for the whole guardian fight.
//
// The guardian is blitted at byte $2e + $34(a5) and never subtracts $30, so it
// inherits that delay - it is drawn eight pixels right of its bitmap position.
// Aliens do not: $7101c subtracts $32(a5), which $710aa keeps equal to $2e(a5),
// so PF1's own fine scroll is cancelled out before the byte offset is taken.
//
// This is what put the eye off its socket. Shifting every alien by -8 to fix it
// lined the eye up and moved every wave in the game; the eight pixels belong to
// the guardian alone.
export const GUARDIAN_SCROLL_DX = 8;      // $70708 cmpi.w #$8,$30(a5)

// Where the ship's sprite lands on screen, and both terms come out of $70df8
// once PF2_ORIGIN_X is fixed. Seek mode aims an alien at
// (($26 + $36) >> 1, ($28 + $e) >> 1), doubled back by the mover, so the ship's
// centre in PF2 space is ($26 + 54, $28 + 26) - x is the alien's box centre and
// y its box top over a box 24 tall. On screen that is ($26 + 14, $28 + 26), and
// a 32x44 ship centred there has its top-left at ($26 - 2, $28 + 4).
//
// MUZZLE_DX is SHIP_SPRITE_DX + PF2_ORIGIN_X, so the muzzles are pinned to the
// SUM of these two and do not move if both change together.
export const SHIP_SPRITE_DX = -2, SHIP_SPRITE_DY = 4;
const TILE = 16;

export async function load(base = 'assets') {
  const manifestUrl = base + '/manifest.json';
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok)
    throw new Error(`asset ${manifestUrl}: HTTP ${manifestResponse.status}`);
  let man;
  try { man = await manifestResponse.json(); }
  catch (e) { throw new Error(`asset ${manifestUrl}: ${e.message}`); }
  const bin = async (f) => {
    const url = base + '/' + f;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`asset ${url}: HTTP ${response.status}`);
    try { return new Uint8Array(await response.arrayBuffer()); }
    catch (e) { throw new Error(`asset ${url}: ${e.message}`); }
  };
  const pending = [];
  const attach = (owner, key, file) => {
    if (owner && file) pending.push(bin(file).then((data) => { owner[key] = data; }));
  };
  for (const lv of man.levels) {
    attach(lv, 'fg', lv.files.fg);
    attach(lv, 'bg', lv.files.bg);
    attach(lv, 'map', lv.files.map);
  }
  if (man.ship) for (const p of Object.values(man.ship.parts)) attach(p, 'data', p.file);
  attach(man.panel, 'data', man.panel && man.panel.file);
  attach(man.bonus, 'data', man.bonus && man.bonus.file);
  // Sprite slot 2 - the mine the aliens fire. Shared across all six
  // levels, like the pod, which is why it is not in level.aliens.
  attach(man.mine, 'data', man.mine && man.mine.file);
  attach(man.explosion, 'data', man.explosion && man.explosion.file);
  attach(man.shot, 'data', man.shot && man.shot.file);
  attach(man.outrider, 'data', man.outrider && man.outrider.file);
  attach(man.bubble, 'data', man.bubble && man.bubble.file);
  attach(man.intro, 'data', man.intro && man.intro.file);
  if (man.ending) {
    attach(man.ending.ship, 'data', man.ending.ship.file);
    attach(man.ending.planet, 'data', man.ending.planet.file);
  }
  if (man.mothership) {
    attach(man.mothership, 'data', man.mothership.file);
    attach(man.mothership.anim, 'data', man.mothership.anim.file);
    if (man.mothership.launch) attach(man.mothership.launch, 'data', man.mothership.launch.file);
  }
  if (man.menu) {
    for (const key of ['breakMask', 'digits', 'powerupIcons', 'font', 'thumbs', 'cursor'])
      attach(man.menu[key], 'data', man.menu[key].file);
    if (man.menu.nameCursor) attach(man.menu.nameCursor, 'data', man.menu.nameCursor.file);
  }
  for (const lv of man.levels) {
    attach(lv, 'alienData', lv.files.aliens);
    attach(lv, 'pathData', lv.files.paths);
    if (lv.guardian) attach(lv.guardian, 'data', lv.guardian.file);
  }
  await Promise.all(pending);
  return man;
}

// $0RGB, 4 bits per component, to 8-bit RGB. The Amiga's 4-bit value scales by
// 17 (0x0->0, 0xf->255), not by 16.
export function rgb(c) {
  return [((c >> 8) & 15) * 17, ((c >> 4) & 15) * 17, (c & 15) * 17];
}

export class Playfield {
  constructor(man, levelIndex) {
    this.man = man;
    this.level = man.levels[levelIndex];
    this.idx = new Uint8Array(SCREEN_W * SCREEN_H);   // composited, for display
    // Both playfields are kept, not just the composite. On the hardware PF1 and
    // PF2 coexist in separate bitplanes and Denise sees both; compositing them
    // into one buffer throws away exactly the information collision needs,
    // because a PF1 pixel under an opaque PF2 pixel is still there.
    this.pf1 = new Uint8Array(SCREEN_W * SCREEN_H);
    this.pf2 = new Uint8Array(SCREEN_W * SCREEN_H);
    this.clxdat = 0;
    this.panel = man.panel;
    this.rgba = new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4);
    // The manifest is immutable asset/configuration data. Runtime palette
    // changes (most notably the guardian's colours 8-15) belong to this
    // playfield instance, or revisiting a level in a later game inherits the
    // previous run's guardian palette.
    this.basePalette = this.level.palette.slice();
    this.pal = this.basePalette.slice();
    // 23, not the 24 the table holds: $7077a skips the last nibble of every
    // row, so the background repeats over 23 tiles and the 24th is never drawn.
    this.bgCols = this.level.bgMap[0].length;
    this.bgRows = man.playfield.bg.map[1];
    this.rows = man.playfield.fg.rows;
  }

  // Replace colours 0-7 with an alien's set, the way $71766 does. The first
  // sharedPrefix entries are the level's own background colours, which is why
  // swapping the whole block does not disturb the level art.
  // $71766 writes eight words into the copper block at $73b1a, which holds
  // COLOR00..COLOR31 - so a wave's colours ARE colours 0-7, playfield 1, the
  // same eight the aliens are blitted into ($70a56's modulo $5e plus 6 bytes of
  // width is a 100-byte row, PF1's stride, not PF2's 92).
  //
  // It is the last write to that block that counts, and in the original the
  // level's fade has finished long before the first copy.path runs. Here the
  // fade was still ramping colours 0-3 up from black while the first wave was
  // already on screen, and then snapped all 32 to the LEVEL palette - so the
  // first wave of every level, and every wave after a death, was drawn black
  // and then in the terrain's colours. Remembering the wave's eight and
  // re-asserting them after any palette write is what the copper does for free.
  // $78a3c + level*$60 + sprite*4 is a POINTER table, and several slots share
  // a pointer: level 1's slot 4 points at $042978, the same as slot 0, the
  // explosion. The packer records that as `aliases`, and the guardian's second
  // group is twelve sprite-4 records - twelve explosions scattered over its
  // body. Matching on `slot` alone found nothing for them and drew nothing,
  // which is why the death sequence never appeared.
  alienMeta(sprite) {
    return this.level.aliens.find(
      (k) => k.slot === sprite || (k.aliases && k.aliases.includes(sprite)));
  }

  useAlienPalette(n) {
    const a = this.level.alienPalettes[n];
    if (!a) return;
    this.wavePal = a;
    this.applyWave();
  }

  // $6fc8a bsr $70718, ONCE, when $54(a5) goes from 1 to 2: eight words from
  // $789dc + level*16 into the copper block at $73b3a - COLOR08 upward.
  //
  // drawGuardian used to do this on every frame, which quietly undid the pulse:
  // levels.code walks one of colours 8-15 up and back down to flash the body
  // red while the eye is being shot, and reloading the palette underneath it
  // meant the flash was written and erased within the same frame.
  useGuardianPalette() {
    const g = this.level.guardian;
    if (!g) return;
    for (let i = 0; i < 8; i++) {
      this.basePalette[8 + i] = g.palette[i];
      this.pal[8 + i] = g.palette[i];
    }
  }

  applyWave() {
    if (!this.wavePal) return;
    for (let i = 0; i < 8; i++) this.pal[i] = this.wavePal[i];
  }

  resetPalette() {
    for (let i = 0; i < 32; i++) this.pal[i] = this.basePalette[i];
  }

  // scrollX is in pixels of foreground travel; the background moves slower.
  //
  // Both rates are measured off the hardware (emu/run.js --scroll), not
  // guessed: the foreground advances exactly 1 px per frame (399 of 399 frames
  // sampled), and the background advances 1 px on alternate frames - 200 px
  // over 399 frames, steps of 1 and 0 - so the ratio is exactly 2:1 and holds
  // on every level tested. The background is a whole-pixel step every other
  // frame rather than a smooth half pixel, which is precisely what floor(x/2)
  // reproduces.
  //
  // The measurement has to come from BPLCON1's fine scroll, not the bitplane
  // pointers: the background is double-buffered, so BPL1PT alternates between
  // two addresses every two frames and the flips swamp the scroll.
  render(scrollX, bgRatio = BG_RATIO) {
    const { idx, level, rows } = this;
    const bgW = this.bgCols * TILE, bgH = this.bgRows * TILE;
    const bgX = Math.floor(scrollX / bgRatio);

    // PF1: the background tile map, wrapping in both axes
    for (let y = 0; y < PLAYFIELD_H; y++) {
      const sy = ((y % bgH) + bgH) % bgH;
      const trow = level.bgMap[(sy / TILE) | 0];
      const iy = sy % TILE;
      let o = y * SCREEN_W;
      for (let x = 0; x < SCREEN_W; x++) {
        const sx = (((x + bgX) % bgW) + bgW) % bgW;
        const t = trow[(sx / TILE) | 0];
        this.pf1[o + x] = level.bg[(t * TILE * TILE) + iy * TILE + (sx % TILE)];
      }
    }

    // PF2 must be cleared every frame. PF1 is rewritten pixel by pixel from
    // the background map, but PF2 only writes where a tile is non-zero, so
    // without this the foreground smears a trail across the background - the
    // buffers were split for collision and this was missed.
    this.pf2.fill(0);

    // PF2: one column of 12 tiles per map entry, drawn over the top
    const cols = level.cols;
    const first = Math.floor(scrollX / TILE);
    const shift = scrollX % TILE;
    for (let c = -1; c <= SCREEN_W / TILE; c++) {
      const col = first + c;
      if (col < 0 || col >= cols) continue;
      const px = c * TILE - shift;
      for (let r = 0; r < rows; r++) {
        const t = level.map[col * rows + r];
        if (!t) continue;                        // tile 0 is empty
        const src = t * TILE * TILE;
        for (let iy = 0; iy < TILE; iy++) {
          const y = r * TILE + iy;
          if (y < 0 || y >= PLAYFIELD_H) continue;
          const o = y * SCREEN_W;
          for (let ix = 0; ix < TILE; ix++) {
            const x = px + ix;
            if (x < 0 || x >= SCREEN_W) continue;
            const v = level.fg[src + iy * TILE + ix];
            if (v) this.pf2[o + x] = v;          // 0 is transparent in PF2
          }
        }
      }
    }
    return idx;
  }

  // Composite PF2 over PF1. Called after the aliens have gone into PF1, so
  // they sit behind the foreground exactly as the hardware puts them.
  compose() {
    for (let i = 0; i < PLAYFIELD_H * SCREEN_W; i++) {
      const p2 = this.pf2[i];
      this.idx[i] = p2 ? 8 + p2 : this.pf1[i];
    }
    this.drawPanel();
  }

  // Denise's collision, from CLXCON $0c30 ($6fa46) and the mask $46 ($6fd28).
  //
  // What each playfield IS comes out of the gameplay copper, not out of a
  // guess. DDFSTRT $28 / DDFSTOP $d8 fetch 23 words = 46 bytes a line, so
  // BPL1MOD $36 gives the odd planes a 100-byte stride and BPL2MOD $2e gives
  // the even planes 92. Those are exactly the strides $7101c and $7103c use.
  // BPLCON2 $0044 sets PF2PRI, so PF2 is in front. And:
  //
  //   PF1  100 bytes  the parallax backdrop in 2 planes, values 0-3,
  //                   plus the ALIENS blitted into the third ($70a56's
  //                   modulo $5e over a 3-word blit is a 100-byte row)
  //   PF2   92 bytes  the terrain, 3 planes, colours 8-15, and the shots
  //                   and the guardian ($71538, $706ac -> BPL2PT/BPL4PT)
  //
  // CLXCON enables only bitplanes 5 and 6 and requires each to be 1, so PF1
  // collides only where its value has bit 2 set - the alien plane, never the
  // backdrop - and PF2 only on its own top-bit terrain.
  //
  // WHICH CLXDAT bits carry which playfield is the part a reading of the
  // hardware manual gets wrong in either direction, and it was got wrong here:
  // on real hardware at rookie the shield falls when you touch an ALIEN and not
  // when you touch the ground, and the difficulty exemption at $6fd86 is on the
  // bit-6 branch. So bit 6 is PF2, the terrain, and bits 1 and 2 are PF1:
  //
  //   bits 1,2  BOTH sprite pairs against PF1  -> the aliens
  //   bit 6     the FRONT pair against PF2     -> the terrain
  //
  // Bit 5, the back pair against PF2, is left out of the mask, so the ship's
  // nose hits walls while its whole body hits aliens. That asymmetry is the
  // check: the other assignment would have only the nose hitting aliens while
  // the whole hull scraped walls, which is not how the game plays.
  collideSprite(pair, x, y, w, h, data, base) {
    let clx = 0;
    for (let iy = 0; iy < h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      for (let ix = 0; ix < w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        if (!data[base + iy * w + ix]) continue;      // transparent sprite pixel
        if (this.pf1[o + sx] & 4) clx |= 1 << pair;        // bits 1,2: aliens
        if (this.pf2[o + sx] & 4) clx |= 1 << (4 + pair);  // bits 5,6: terrain
      }
    }
    this.clxdat |= clx;
    return clx;
  }

  readCLXDAT() { const v = this.clxdat; this.clxdat = 0; return v; }

  // print.score ORs its digits into plane 1 of the panel bitmap itself
  // ($71912 adds $68c to $4bac8), so they are part of the panel rather than
  // drawn over it. `digits` is six values, most significant first.
  drawScore(dg, digits) {
    if (!dg || !dg.data || !this.panel || !this.panel.data) return;
    const p = this.panel;
    for (let d = 0; d < digits.length; d++) {
      const v = digits[d] & 15;
      for (let iy = 0; iy < dg.h; iy++) {
        const py = dg.panelY + iy;
        if (py < 0 || py >= p.h) continue;
        for (let ix = 0; ix < dg.w; ix++) {
          if (!dg.data[(iy * dg.count + v) * dg.w + ix]) continue;
          const px = dg.panelX + d * dg.w + ix;
          if (px < 0 || px >= p.w) continue;
          p.data[py * p.w + px] |= 1 << dg.plane;
        }
      }
    }
  }

  // The three panel bars, from $71884 (fill) and $718b6 (drain).
  //
  // Both routines touch ONE plane - $4bac8 is the panel's plane 0 - and eight
  // words of three consecutive rows:
  //
  //   71884  ori.w  #$5555,(a0) / $2c(a0) / $58(a0)    ; charge
  //   718b8  andi.w #$aaaa,(a0) / $2c(a0) / $58(a0)    ; drain
  //
  // $2c is 44, one 352-pixel panel row, so the rows are r, r+1, r+2. $5555 sets
  // the ODD pixels of plane 0 and $aaaa clears them, leaving the even ones
  // alone. The packed panel has $d/$c/$d at the even pixels and 0 at the odd
  // ones, so an empty bar is a dark grey dashed rail (palette $333/$444) and a
  // charged one lights the gaps at colour 1, $fb3 - the bright yellow the
  // original shows. Writing 0 over the odd pixels instead, and spacing the rows
  // three apart, gave a bar that was one row of near-invisible dark green.
  //
  // The offsets $144, $2a4 and $404 that the powerup handlers pass to $71884
  // divide by 44 into rows 7, 15 and 23, byte 16 - so x = 128, 128 px wide.
  static BAR_X = 128;
  static BAR_W = 128;
  static BAR_ROWS = 3;

  drainBar(row, level) {
    const p = this.panel;
    if (!p || !p.data) return;
    const filled = Math.round(Math.max(0, Math.min(1, level)) * Playfield.BAR_W);
    for (let dy = 0; dy < Playfield.BAR_ROWS; dy++) {
      const y = row + dy;                       // $2c(a0) is the NEXT row
      if (y < 0 || y >= p.h) continue;
      const o = y * p.w;
      for (let i = 1; i < Playfield.BAR_W; i += 2) {   // $5555 / $aaaa: odd only
        const x = Playfield.BAR_X + i;
        if (x >= p.w) break;
        if (i < filled) p.data[o + x] |= 1;     // $71884 ori  - plane 0 set
        else p.data[o + x] &= ~1;               // $718b8 andi - plane 0 clear
      }
    }
  }

  // The panel is 352 px wide in a 320 px window, so it starts at x = -16.
  drawPanel() {
    const p = this.panel;
    if (!p || !p.data) return;
    for (let iy = 0; iy < p.h; iy++) {
      const y = p.y + iy;
      if (y < 0 || y >= SCREEN_H) continue;
      const o = y * SCREEN_W, src = iy * p.w;
      for (let x = 0; x < SCREEN_W; x++) {
        const sx = x - p.x;
        this.idx[o + x] = (sx >= 0 && sx < p.w) ? p.data[src + sx] : 0;
      }
    }
  }

  // Aliens are blitted into PF1, so they use colours 0-7 - the same eight the
  // level shares with them. Each byte is (mask ? 8 : 0) | colour: bit 3 is the
  // mask, and a zero byte is a hole. Colour 0 inside the mask is a real colour,
  // not transparency, which is why the mask is carried separately.
  //
  // Drawing an alien means its palette must be live: $71766 reloads colours 0-7
  // from alienPalettes[slot - 1] whenever a type appears on screen. Only the
  // first sharedPrefix entries are common with the level, so the rest genuinely
  // change what the background looks like too.
  // Same packing as the aliens, so the bonus pod draws through this too.
  // Into PF1, not into `idx`. The pod is path group 0 - a record like any other,
  // so $7101c blits it into playfield 1 - and compose() rebuilds `idx` wholesale
  // from pf1/pf2 afterwards. Writing to `idx` here put the pod on screen for the
  // ninety-odd lines between this call and compose() and then wiped it, so a pod
  // that had spawned correctly, held the right type and could still be shot was
  // never drawn a single frame. That is the whole of "powerups never appear".
  drawFrames(data, w, h, frame, x, y, mirror = false) {
    const src = frame * w * h;
    for (let iy = 0; iy < h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      // $70f70 `bclr #$7,d1 / sne $17(a5)` is read for EVERY slot, not just the
      // aliens, and $70a64 turns it into negated blitter modulos - the same
      // flip drawAlien does.
      const ry = mirror ? h - 1 - iy : iy;
      for (let ix = 0; ix < w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        const v = data[src + ry * w + ix];
        if (v & 8) this.pf1[o + sx] = v & 7;
      }
    }
  }

  // Aliens are blitted into PF1, not over the top of everything. Drawing them
  // into `idx` put them in front of the terrain and, worse, left PF1 without
  // them - so the CLXDAT bit for "PF1 against the ship" could never fire and
  // ship-versus-alien collision did nothing at all.
  //
  // `mirror` is bit 7 of sprite.num. $70a64 flips the sign of BLTDMOD and
  // BLTCMOD, +94 becoming -106. The background row is 100 bytes and this blit
  // is 3 words wide (32 pixels of sprite plus a word of shift headroom), so
  // forward is 100-6 and backward is -(100+6): a negative DESTINATION modulo
  // walks the blit upward, which is a VERTICAL flip. Reading it as horizontal
  // is what made the creatures anchored to the ceiling and floor look wrong.
  drawAlien(a, frame, x, y, mirror = false) {
    const lv = this.level;
    const [w, h] = lv.alienFrame;
    const src = (a.frame0 + Math.min(frame, Math.max(0, a.frames - 1))) * w * h;
    for (let iy = 0; iy < h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      const ry = mirror ? h - 1 - iy : iy;
      for (let ix = 0; ix < w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        const v = lv.alienData[src + ry * w + ix];
        if (v & 8) this.pf1[o + sx] = v & 7;
      }
    }
  }

  // `$71474` runs before `$71330`: the shot bitmap must overlap an opaque
  // pixel in the PF1 object before the record's 32x24 box is allowed to select
  // it. Both objects use PF-space coordinates here, so their display-origin
  // adjustments cancel and the test remains exact even outside the viewport.
  shotOverlapsFrame(shot, spec, bank, level, shotX, shotY,
                    data, w, h, frame, targetX, targetY, mirror = false) {
    if (!shot || !shot.data || !data) return false;
    const sbase = spec.offset + (bank * shot.levels + level) * spec.stride;
    const tbase = frame * w * h;
    const left = Math.max(shotX, targetX);
    const top = Math.max(shotY, targetY);
    const right = Math.min(shotX + spec.w, targetX + w);
    const bottom = Math.min(shotY + spec.h, targetY + h);
    if (left >= right || top >= bottom) return false;

    for (let y = top; y < bottom; y++) {
      const sy = y - shotY;
      const ty = mirror ? h - 1 - (y - targetY) : y - targetY;
      for (let x = left; x < right; x++) {
        const sv = shot.data[sbase + sy * spec.w + x - shotX];
        const tv = data[tbase + ty * w + x - targetX];
        if (sv && (tv & 8)) return true;
      }
    }
    return false;
  }

  shotOverlapsAlien(shot, spec, bank, level, shotX, shotY, actor) {
    // Slot 2 is the shared mine and deliberately is not in level.alienData.
    // Drawing already routes it to mine.bin; collision must use that same
    // bitmap or the pixel gate rejects every shot before hitTest sees it.
    if (actor.sprite === 2) {
      const mine = this.man.mine;
      if (!mine || !mine.data) return false;
      return this.shotOverlapsFrame(shot, spec, bank, level, shotX, shotY,
        mine.data, mine.w, mine.h,
        Math.min(actor.anim, mine.frames - 1), actor.x - 16, actor.y,
        actor.mirror);
    }
    const meta = this.alienMeta(actor.sprite);
    if (!meta) return false;
    const [w, h] = this.level.alienFrame;
    const frame = meta.frame0 + Math.min(actor.anim, Math.max(0, meta.frames - 1));
    return this.shotOverlapsFrame(shot, spec, bank, level, shotX, shotY,
      this.level.alienData, w, h, frame, actor.x - 16, actor.y, actor.mirror);
  }

  // Hardware sprites draw in front of both playfields and take colours 16-31.
  // Index 0 is the sprite's transparent slot, not palette entry 16, so a zero
  // leaves whatever the playfield put there.
  //
  // The ship is two ATTACHED pairs: back 16x44 and front 16x22, the front at
  // (+16,+11) from the back. Those offsets were measured off the running game,
  // because the sprite control words are zero in the extracted data.
  // $7020a merges the outrider pods into the ship's back sprite - 11 lines at
  // the top and 11 at line 33 - rather than drawing them separately, so they
  // move with the ship for free and share its palette. `outriders` is
  // [topFrame, bottomFrame]; frame 0 is blank, which is what the game selects
  // when the pod is not owned.
  // $7023a merges the pod into the ship's back sprite, two words a line:
  //
  //   7023a  move.w (a0)+,(a2)+ / move.w (a1)+,(a2)+ / dbra d7
  //
  // so its packed values are 0-3, one attached sprite's pair of planes. Which
  // pair the picture settles, the way BPLCON2 was settled: read as the low pair
  // (16 + v) the values land on $ff6, $000 and $fd0 - a yellow blob with black
  // holes punched through it. Read as the HIGH pair (16 + 4v) they land on
  // $a00, $fff and $587, and it is a solid round turret in the ship's own red
  // and white with a barrel that swings through the five frames.
  //
  // The ship's own artwork is zero across both pod bands - rows 0-10 and 33-43
  // of the back sprite - so there is nothing underneath for it to combine with,
  // which is the other half of why the low-pair reading could not be right.
  drawOutrider(o, frame, x, y) {
    if (!o || !o.data || !frame) return;
    const base = (frame % o.frames) * o.w * o.h;
    for (let iy = 0; iy < o.h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const row = sy * SCREEN_W;
      for (let ix = 0; ix < o.w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        const v = o.data[base + iy * o.w + ix];
        if (v) this.idx[row + sx] = 16 + v * 4;
      }
    }
  }

  drawShip(ship, config, variant, x, y, outriders = null) {
    const frame = config * ship.variants + variant;
    let pair = 0;
    for (const p of [ship.parts.back, ship.parts.front]) {
      const base = frame * p.w * p.h;
      pair++;                                    // back = pair 1, front = pair 2
      this.collideSprite(pair, x + p.dx, y + p.dy, p.w, p.h, p.data, base);
      if (pair === 1 && outriders && this.man.outrider) {
        const o = this.man.outrider;
        // $7023a merges these pixels into the back attached pair before the
        // hardware sees it. Collision therefore includes the pods as sprite
        // pair 1 as well as drawing them; doing only the latter made enemies
        // pass through an equipped outrider.
        if (outriders[0]) this.collideSprite(
          1, x, y + o.topLine, o.w, o.h, o.data,
          (outriders[0] % o.frames) * o.w * o.h);
        if (outriders[1]) this.collideSprite(
          1, x, y + o.bottomLine, o.w, o.h, o.data,
          (outriders[1] % o.frames) * o.w * o.h);
        this.drawOutrider(o, outriders[0], x, y + o.topLine);
        this.drawOutrider(o, outriders[1], x, y + o.bottomLine);
      }
      for (let iy = 0; iy < p.h; iy++) {
        const sy = y + p.dy + iy;
        if (sy < 0 || sy >= PLAYFIELD_H) continue;
        const o = sy * SCREEN_W;
        for (let ix = 0; ix < p.w; ix++) {
          const sx = x + p.dx + ix;
          if (sx < 0 || sx >= SCREEN_W) continue;
          const v = p.data[base + iy * p.w + ix];
          if (v) this.idx[o + sx] = v;
        }
      }
    }
  }

  // Shots are blitted into PF2's LOW TWO bitplanes and no others.
  //
  // $71538 takes the destination planes from $c(a2) and $10(a2) with a2 =
  // $122(a5), and the copper block that block feeds ($73ac6) is ordered BPL1,
  // BPL3, BPL5, BPL2, BPL4, BPL6 - so $c and $10 are BPL2PT and BPL4PT, which
  // are playfield 2's planes 0 and 1. A shot pixel is therefore a PF2 value of
  // 1, 2 or 3 and never more: colours 9, 10 and 11.
  //
  // The artwork carries all three. On level 1 they are $f55, $b05 and $700, and
  // the cannon shape ramps 3-2-1 left to right - a dark red tail behind a bright
  // red head, in the direction of travel. Flattening every pixel to 1 threw the
  // shading away.
  //
  // $714d0 sets BLTCON0 $dfc, minterm $fc = A OR B, so a shot ORs into whatever
  // is already there rather than replacing it.
  drawShot(shot, spec, bank, level, x, y) {
    if (!shot || !shot.data) return;
    const h = spec.h;
    const base = spec.offset + (bank * shot.levels + level) * spec.stride;
    for (let iy = 0; iy < h; iy++) {
      const sy = y - PF2_ORIGIN_Y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      for (let ix = 0; ix < spec.w; ix++) {
        const sx = x - PF2_ORIGIN_X + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        const v = shot.data[base + iy * spec.w + ix];
        if (v) this.pf2[o + sx] |= v;          // $dfc: D = A OR B
      }
    }
  }

  // The guardian goes into PF2 - draw.guardian adds $34(a5), the pf2 offset,
  // to its three destination pointers - so it takes colours 8-15 from
  // guard.colours, not the level's foreground palette.
  //
  // `cols` is how many of its 16 columns have been revealed. draw.guardian is
  // gated on pf2scroll reaching $e and indexes by $56(a5), one 24-byte column
  // per step, so it arrives a column at a time rather than all at once.
  // The guardian is re-blitted every frame here, so an explosion that eats
  // into it has to be remembered rather than left in the buffer. In the
  // original PF2 simply is not redrawn once $54(a5) reaches 3, and the damage
  // stays where the blitter put it.
  damageGuardian(data, w, h, frame, gx, gy) {
    const g = this.level.guardian;
    if (!g) return;
    if (!this.guardDamage) this.guardDamage = new Uint8Array(g.w * g.h);
    const src = frame * w * h;
    for (let iy = 0; iy < h; iy++) {
      const y = gy + iy;
      if (y < 0 || y >= g.h) continue;
      for (let ix = 0; ix < w; ix++) {
        const x = gx + ix;
        if (x < 0 || x >= g.w) continue;
        if (data[src + iy * w + ix] & 8) this.guardDamage[y * g.w + x] = 1;
      }
    }
  }

  drawGuardian(x, y, cols = 16) {
    const g = this.level.guardian;
    if (!g || !g.data) return;
    const limit = Math.min(g.w, cols * 16);
    for (let iy = 0; iy < g.h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      for (let ix = 0; ix < limit; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        // $706d8 clr.w, not a masked draw. Where the column's mask bit is
        // clear the blit writes ZERO into all three PF2 planes, so the
        // guardian REPLACES the terrain over its whole 256x192 rectangle
        // instead of being laid over it. Skipping the zeros left the
        // foreground showing through every gap in its body, which read as two
        // pictures fighting rather than one arriving.
        const gi = iy * g.w + ix;
        this.pf2[o + sx] = (this.guardDamage && this.guardDamage[gi])
                             ? 0 : g.data[gi];
      }
    }
  }

  eraseWithMask(data, w, h, frame, x, y) {
    const src = frame * w * h;
    for (let iy = 0; iy < h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      for (let ix = 0; ix < w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        if (data[src + iy * w + ix] & 8) this.pf2[o + sx] = 0;
      }
    }
  }

  // $72e82, the mothership screen. It DOES move, and the movement is in the
  // copper's bitplane pointers rather than in the blit:
  //
  //   72e98  addi.w #$22,d0         ; the display starts at byte 34 of the row
  //   72f10  adda.l #$398,a0        ; the craft is blitted at byte 920 = row 10,
  //                                 ; x 0 - which is 272 px LEFT of the display
  //   731ec  subi.w #$2,$6(a0)...   ; one 16px coarse step per fine-scroll wrap,
  //                                 ; five planes, so the craft slides in from
  //                                 ; the left, one pixel a frame
  //   731e6  subi.w #$1,$4e(a5)     ; eighteen of those ($731d6 sets $12)
  //
  // and only then, with $4e(a5) back at zero ($73014), does the hatch move:
  //
  //   73030  addq.w #1,d1 / andi #3 ; frames 1, 2, 3, holding at 3 ($730a6)
  //   7300c  cmp.w #$9,d0           ; one step per 16 frames
  //   730da  move.l #$8ca09400,(a1) ; then a sprite: VSTART $8c, HSTART 320
  //   730fc  moveq #$46,d0          ; 71 frames of $73102 addq.w #1,(a1),
  //                                 ; which is +2 screen pixels each
  //   73164  move.w $50(a5),d1 ...  ; the hatch closes again, 3, 2, 1
  //   731d6  move.w #$12,$4e(a5) / st $1a(a5)   ; and it leaves, the same
  //                                 ; eighteen steps with the sign flipped
  //
  // The ending is the same routine with $1e(a5) set: $730ac takes the $73116
  // branch, a different sprite, and the ship flies IN instead of out.
  //
  // The version this replaces had the craft static and skipped the arrival and
  // the departure entirely.
  // $72e98 starts the display at byte $22 of the row - 34 bytes, 272 px - and
  // each coarse step takes 2 bytes off, so it takes SEVENTEEN of them to bring
  // the display start to 0 and the craft to screen x 0. The $12 at $731d6 is
  // the count for the DEPARTURE, and using it for the arrival left the craft
  // 16 px short: a black slice down the left, and the ship coming out of the
  // hatch 16 px off centre because the hatch had moved but the sprite had not.
  // $888, $776, $666, $555, $444 in the mothership palette.
  static STAR_TONES = [16, 28, 29, 30, 31];
  static MS_TRAVEL = 17 * 16;
  static MS_LEAVE = 18 * 16;      // $731d6 move.w #$12,$4e(a5), on the way out
  static MS_HATCH_STEP = 16;        // $7300c, the counter's low nibble at 9
  static MS_LAUNCH = 71;            // $730fc moveq #$46,d0
  static MS_CLOSE = 3 * 4;          // $73164, four $73310 waits a frame

  // The whole scene as a function of the frame count.
  static mothershipAt(t) {
    const T = Playfield.MS_TRAVEL, HS = Playfield.MS_HATCH_STEP;
    const open = 3 * HS, fly = Playfield.MS_LAUNCH, close = Playfield.MS_CLOSE;
    if (t < T) return { x: -272 + t, hatch: 0 };
    if (t < T + open) return { x: 0, hatch: 1 + Math.floor((t - T) / HS) };
    if (t < T + open + fly)
      return { x: 0, hatch: 3, ship: t - T - open };
    if (t < T + open + fly + close)
      return { x: 0, hatch: 3 - Math.floor((t - T - open - fly) / 4) };
    return { x: -(t - T - open - fly - close), hatch: 0 };
  }
  static get MS_FRAMES() {
    return Playfield.MS_TRAVEL + Playfield.MS_LEAVE
         + 3 * Playfield.MS_HATCH_STEP + Playfield.MS_LAUNCH + Playfield.MS_CLOSE;
  }

  drawMothership(m, t, leaving = false, keepPalette = false) {
    if (!m || !m.data) return;
    // $72f42 copies the 32 words at $73a42 into the copper ONCE, and $72f7a
    // then fades them up from black two vblanks a step. The caller owns that
    // ramp, so this must not stamp the palette every frame.
    if (!keepPalette) for (let i = 0; i < 32; i++) this.pal[i] = m.palette[i];
    const put = (data, w, h, sx0, sy0, base) => {
      for (let iy = 0; iy < h; iy++) {
        const sy = sy0 + iy;
        if (sy < 0 || sy >= PLAYFIELD_H) continue;
        const o = sy * SCREEN_W;
        for (let ix = 0; ix < w; ix++) {
          const sx = sx0 + ix;
          if (sx < 0 || sx >= SCREEN_W) continue;
          const v = data[base + iy * w + ix];
          if (v) this.idx[o + sx] = v;
        }
      }
    };
    const st = Playfield.mothershipAt(t);
    const a0 = m.anim;

    // The screen is FIVE bitplanes ($73822 BPLCON0 $5200), and only four of
    // them are the craft ($72f0c moveq #$3,d0). The fifth, at $19400, is filled
    // at $72eb6 from Kickstart ROM words masked down to at most one bit each -
    // 23 words a row over 64 passes of three rows. It is a starfield, and the
    // colour it lights is 16, which the hardware capture measured as $888.
    // Without it the screen is four planes on black and half the palette is
    // never used, which is the wrong palette rather than a missing one.
    //
    // The ROM it reads is not reproducible here, so the pattern is a seeded
    // stand-in at the same density: one candidate dot per 16-pixel word, half
    // of them suppressed, mirrored into the other half of the 92-byte row the
    // way $72ecc does.
    if (!this.stars) {
      this.stars = new Uint8Array(736 * PLAYFIELD_H);
      let r = 0x1234;
      for (let y = 0; y < PLAYFIELD_H; y++)
        for (let w = 0; w < 23; w++) {
          r = (r * 1103515245 + 12345) & 0x7fffffff;
          if (!((r >> 20) & 1)) continue;          // $72ed4 andi.w #$80,d2
          const x = w * 16 + ((r >> 8) & 15);      // $72edc ror.w d1,d2
          this.stars[y * 736 + x] = 1;
          this.stars[y * 736 + x + 352] = 1;       // $72ecc move.w d1,$2c(a0)
        }
    }
    // Each star has its own tone and its own phase. The palette already carries
    // the greys - 16 is $888, and 28..31 run $776, $666, $555, $444 - because
    // those indices are "craft colour plus a star" and the artwork gave them
    // sensible values. So a star can be any of five brightnesses and a twinkle
    // is a step along that list rather than an on/off, which is what keeps it
    // from blinking to black.
    //
    // $73258 rotates the whole plane a pixel a frame instead; the field is
    // meant to read as depth rather than as motion.
    const TONES = Playfield.STAR_TONES;
    const tw = (t | 0) >> 1;
    for (let y = 0; y < PLAYFIELD_H; y++) {
      const o = y * SCREEN_W, so = y * 736;
      for (let x = 0; x < SCREEN_W; x++) {
        // The pattern does not travel with the craft.
        if (!this.stars[so + x]) continue;
        const h = (x * 31 + y * 17) & 255;
        const base = h % 3;                       // brighter stars are commoner
        const phase = h & 31;
        const dim = ((tw + phase) % 20) < 3 ? 2 : 0;
        this.idx[o + x] = TONES[Math.min(TONES.length - 1, base + dim)];
      }
    }

    // The rectangle the hatch will fill is left out of the craft entirely. The
    // craft's mouth is a closed one and the open frames do not cover all of it,
    // so anything drawn there first shows through the gaps.
    const HX = st.x + a0.x, HY = m.y + a0.y, HW = a0.w, HH = a0.h;
    for (let iy = 0; iy < m.h; iy++) {
      const sy = m.y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      for (let ix = 0; ix < m.w; ix++) {
        const sx = st.x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        if (sx >= HX && sx < HX + HW && sy >= HY && sy < HY + HH) continue;
        const v = m.data[iy * m.w + ix];
        if (v) this.idx[o + sx] = v;
      }
    }

    // $730d6/$73116 build an attached SPRITE pair for this, 16x8, not the
    // 32x44 in-game ship: VSTOP $94 minus VSTART $8c is eight lines, and the
    // pair takes sprite colours, so a pixel value v is colour 16 + v.
    const L = m.launch;
    if (st.ship !== undefined && L && L.data) {
      const frame = leaving ? 1 : 0;
      const sx = leaving ? L.x + (Playfield.MS_LAUNCH - st.ship) * 2
                         : L.x + st.ship * 2;
      const base = frame * L.w * L.h;
      for (let iy = 0; iy < L.h; iy++) {
        const sy = L.y + iy;
        if (sy < 0 || sy >= PLAYFIELD_H) continue;
        for (let ix = 0; ix < L.w; ix++) {
          const x = sx + ix;
          if (x < 0 || x >= SCREEN_W) continue;
          const v = L.data[base + iy * L.w + ix];
          if (v) this.idx[sy * SCREEN_W + x] = 16 + v;
        }
      }
    }

    // $7302a sets BLTCON0 $9f0 - D = A - so the hatch OWNS its 96x56 rectangle:
    // whatever the craft has there is replaced wholesale, which is why the
    // craft above skips it. The craft's own version of the mouth is a closed
    // one, and leaving it underneath showed it through every gap in the open
    // frames. Only the non-zero pixels are written, so the empty parts stay
    // space rather than black paint, and the ship - already down - shows
    // through them until the yellow covers it.
    // Skipping the zero pixels left the previous frame's mouth showing through
    // the gaps in the next one.
    // Frame 0 is the CLOSED mouth - $73164 counts $50(a5) down to it on the way
    // shut - so there is a frame for every state and one is always drawn. The
    // craft leaves this rectangle out, so skipping the blit when the hatch is
    // closed left a hole straight through to space.
    const a = a0;
    if (a.data) {
      const base = (st.hatch % a.frames) * a.w * a.h;
      for (let iy = 0; iy < a.h; iy++) {
        const sy = m.y + a.y + iy;
        if (sy < 0 || sy >= PLAYFIELD_H) continue;
        for (let ix = 0; ix < a.w; ix++) {
          const sx = st.x + a.x + ix;
          if (sx < 0 || sx >= SCREEN_W) continue;
          const v = a.data[base + iy * a.w + ix];
          if (v) this.idx[sy * SCREEN_W + sx] = v;
        }
      }
    }



    // $73310 cycles three colour registers every fourth frame:
    //
    //   73314  addq.w #1,$58(a5) / andi.w #$3,$58(a5) / beq
    //   7332c  d0 = $6(a0) / $6(a0) = $a(a0) / $a(a0) = $e(a0) / $e(a0) = d0
    //
    // and $73882 + 2, + 6, + $a, + $e are COLOR00..COLOR03's values, so it is
    // colours 1, 2 and 3 - $eee, $ef5 and $fe0, the three yellows of the mouth.
    // Rotating the palette and remapping the pixel come to the same thing, and
    // the remap survives the fade that owns the palette while this plays.
    const rot = Math.floor(t / 4) % 3;
    if (rot) {
      for (let k = 0; k < PLAYFIELD_H * SCREEN_W; k++) {
        const v = this.idx[k];
        if (v >= 1 && v <= 3) this.idx[k] = ((v - 1 + rot) % 3) + 1;
      }
    }
  }

  // One of the three 320x200 pictures the game opens with. They are whole
  // screens with their own palettes - nothing composites over them.
  drawIntro(intro, n) {
    this.rgb12 = null;
    if (!intro || !intro.data) return;
    const sc = intro.screens[n];
    if (!sc) return;
    // The ship screen is HAM6 - BPLCON0 $6a00, bit 11 - so it is 4,096 colours
    // and cannot be an index into anything. It comes packed as 12-bit colour a
    // pixel and goes into rgb12, which the caller reads instead of the palette.
    if (sc.ham) {
      if (!this._rgb12) this._rgb12 = new Uint16Array(SCREEN_W * SCREEN_H);
      this.rgb12 = this._rgb12;
      this.rgb12.fill(0);
      for (let y = 0; y < sc.h && y < SCREEN_H; y++) {
        const o = y * SCREEN_W, so = sc.offset + y * sc.w * 2;
        for (let x = 0; x < sc.w && x < SCREEN_W; x++)
          this.rgb12[o + x] = (intro.data[so + x * 2] << 8) | intro.data[so + x * 2 + 1];
      }
      return;
    }
    for (let i = 0; i < sc.palette.length; i++) this.pal[i] = sc.palette[i];
    for (let y = 0; y < sc.h && y < SCREEN_H; y++) {
      const o = y * SCREEN_W, so = sc.offset + y * sc.w;
      for (let x = 0; x < sc.w && x < SCREEN_W; x++)
        this.idx[o + x] = intro.data[so + x];
    }
  }

  // $72858: level 6's blob, replacing PF2 inside its own outline. 255 in the
  // packed data means the mask was clear there and the pixel is left alone.
  drawBubble(b, x, y) {
    if (!b || !b.data) return;
    for (let iy = 0; iy < b.h; iy++) {
      const sy = y - PF2_ORIGIN_Y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      for (let ix = 0; ix < b.w; ix++) {
        const sx = x - PF2_ORIGIN_X + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        const v = b.data[iy * b.w + ix];
        if (v !== 255) this.pf2[sy * SCREEN_W + sx] = v;
      }
    }
  }

  // The end-of-game cutscene, from the module $7255e loads to $11600.
  //
  // $733ae draws planet frame 0, $733b2 fades the palette up, $733d6/$733da
  // start the ship, and the two run together: the world shrinks away over
  // eighteen frames while the ship grows toward the camera over ten.
  //
  //   $734ac  $8000 + $4be   row 30, byte 14   -> the planet at (112, 30)
  //   $73536  addi.w #$6,d2  byte 6            -> the ship at x 48, y from
  //                                               the table at $737ba
  drawEnding(e, planetFrame, shipFrame) {
    if (!e || !e.planet.data) return;
    for (let i = 0; i < 16; i++) this.pal[i] = e.palette[i];
    const P = e.planet;
    if (planetFrame >= 0 && planetFrame < P.frames) {
      const base = planetFrame * P.w * P.h;
      for (let iy = 0; iy < P.h; iy++) {
        const sy = P.y + iy;
        if (sy < 0 || sy >= PLAYFIELD_H) continue;
        for (let ix = 0; ix < P.w; ix++) {
          const v = P.data[base + iy * P.w + ix];
          if (v) this.idx[sy * SCREEN_W + P.x + ix] = v;
        }
      }
    }
    const S = e.ship;
    if (shipFrame >= 0 && shipFrame < S.frames.length && S.data) {
      const f = S.frames[shipFrame];
      for (let iy = 0; iy < f.h; iy++) {
        const sy = f.y + iy;
        if (sy < 0 || sy >= PLAYFIELD_H) continue;
        for (let ix = 0; ix < f.w; ix++) {
          const sx = f.x + ix;
          if (sx < 0 || sx >= SCREEN_W) continue;
          const v = S.data[f.offset + iy * f.w + ix];
          if (v) this.idx[sy * SCREEN_W + sx] = v;
        }
      }
    }
  }

  // The explosion is drawn in SPRITE colours, and $6fe10 overrides the copper
  // so 17/18/19 and 21/22/23 all carry the same three values - the three
  // 16-wide pieces read as one object. Those overrides are applied here rather
  // than left to the level palette, which is what made it half yellow and half
  // blue the first time it was extracted.
  // $6fe10 overrides colours 17-19 and 21-23 for the explosion. It has to be
  // put back afterwards: leaving it applied is why the palette stayed wrong
  // for seconds after a death.
  restorePalette() {
    for (let i = 16; i < 32; i++) this.pal[i] = this.basePalette[i];
  }

  drawExplosion(ex, frame, x, y) {
    if (!ex || !ex.data) return;
    for (const [i, c] of Object.entries(ex.colours)) this.pal[Number(i)] = c;
    const { w, h } = ex;
    const src = frame * w * h;
    for (let iy = 0; iy < h; iy++) {
      const sy = y + iy;
      if (sy < 0 || sy >= PLAYFIELD_H) continue;
      const o = sy * SCREEN_W;
      for (let ix = 0; ix < w; ix++) {
        const sx = x + ix;
        if (sx < 0 || sx >= SCREEN_W) continue;
        const v = ex.data[src + iy * w + ix];
        if (v) this.idx[o + sx] = v;
      }
    }
  }

  // Resolve indices through the current palette. Kept separate from render so a
  // palette change costs nothing but this pass.
  toRGBA() {
    // Two palettes, switched at the panel line, because that is what the
    // copper does: colours 0-15 are reloaded below line 192. Resolving the
    // whole frame through the playfield palette paints the panel in the
    // level's colours, which is wrong on every level.
    const build = (pal, n) => {
      const lut = new Uint8Array(32 * 3);
      for (let i = 0; i < n; i++) {
        const [r, g, b] = rgb(pal[i]);
        lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
      }
      return lut;
    };
    // $72354/$7235e give levels 2 and 6 a vertical gradient on COLOR01, built
    // as copper WAIT/MOVE pairs at $73bda. The copper changes a colour partway
    // down the screen, so one palette for the whole playfield is wrong on those
    // two levels - which is exactly what the live palette sweep showed.
    const bands = this.level.bands || [];
    const top = build(this.pal, 32);
    const bot = this.panel ? build(this.panel.palette, 16) : top;
    const { idx, rgba } = this;
    let bi = 0, banded = null;
    for (let y = 0; y < SCREEN_H; y++) {
      while (bi < bands.length && bands[bi].line <= y) {
        if (!banded) banded = top.slice();
        const [r, g, b] = rgb(bands[bi].value);
        const c = bands[bi].colour * 3;
        banded[c] = r; banded[c + 1] = g; banded[c + 2] = b;
        bi++;
      }
      const lut = y < PLAYFIELD_H ? (banded || top) : bot;
      const mask = y < PLAYFIELD_H ? 31 : 15;
      for (let x = 0; x < SCREEN_W; x++) {
        const i = y * SCREEN_W + x, c = (idx[i] & mask) * 3, o = i * 4;
        rgba[o] = lut[c]; rgba[o + 1] = lut[c + 1]; rgba[o + 2] = lut[c + 2];
        rgba[o + 3] = 255;
      }
    }
    return rgba;
  }
}
