// The automap, from Sorgenti/Map.asm.
//
// Two halves that run at different times. AutoMapping runs every frame while
// playing and records what the player has seen: three Bresenham rays, one
// straight ahead and one either side, marching cell by cell until they hit a
// solid block or a closed door, setting a bit per cell touched. MapMode (TAB)
// then draws those cells full screen.
//
// The drawing is a grid of 4x4 pixel cells -- DrawBlock writes a nibble (four
// pixels) across four consecutive rows of a 40-byte bitplane -- so the 320x200
// screen is exactly 80 by 50 cells, with the player held at column 39, row 24
// and the window clamped to the map's edges.
//
// Walls are not drawn as walls. Every boundary between two cells gets a line
// whose colour says what the boundary means to a player:
//
//   2    impassable: a solid block, or a floor step higher than PLAYER_MAX_RISE
//   16   passable
//   195  passable, but the ceiling height or texture changes -- a doorway
//
// and two cells that agree on floor height, ceiling height and both textures
// get no line at all, so a single room reads as one open space.

import { MAP_SIZE } from './level.js';
import { PLAYER_MAX_RISE } from './movement.js';

export const MAP_W = 80, MAP_H = 50;      // cells on screen
export const CELL = 4;                    // pixels per cell
const VIEW_X = 39, VIEW_Y = 24;           // where the player sits in that window
const MAX_X = MAP_SIZE - MAP_W, MAX_Z = MAP_SIZE - MAP_H;

const FILL = 243;                         // an explored, open cell
const L_SOLID = 2, L_OPEN = 16, L_STEP = 195;
const PLAYER_A = 41, PLAYER_B = 243;      // the marker blinks between these

// PlayerMapPics: a 3x3 arrow per octant, three rows of three bits each.
const ARROWS = [
  [0b100, 0b111, 0b100], [0b110, 0b110, 0b001], [0b111, 0b010, 0b010],
  [0b011, 0b011, 0b100], [0b001, 0b111, 0b001], [0b100, 0b011, 0b011],
  [0b010, 0b010, 0b111], [0b001, 0b110, 0b110],
];

export class Automap {
  constructor() {
    this.seen = new Uint8Array(MAP_SIZE * MAP_SIZE);   // one byte per cell
    this.open = false;
    this.timer = 0;
  }

  reset() { this.seen.fill(0); this.open = false; }

  /**
   * AutoMapping: three rays, offset by -1, 0 and +1 cells perpendicular to
   * whichever axis dominates the view direction.
   */
  trace(level, cam) {
    const cx = Math.floor(cam.x / 64), cz = Math.floor(cam.z / 64);
    if (cx < 0 || cz < 0 || cx >= MAP_SIZE || cz >= MAP_SIZE) return;
    for (const side of [-1, 0, 1]) this.ray(level, cam, cx, cz, side);
  }

  ray(level, cam, cx, cz, side) {
    const { map, B } = level;
    // `asr.l #8` on the view direction, then the sign is split off into the
    // step so the error term works on magnitudes.
    const vx = Math.cos(cam.heading), vz = Math.sin(cam.heading);
    let ax = Math.abs(Math.round(vx * 256)), az = Math.abs(Math.round(vz * 256));
    const sx = vx < 0 ? -1 : 1, sz = vz < 0 ? -1 : 1;
    let x = cx, z = cz;
    // The lateral offset goes across the dominant axis, so the three rays
    // stay side by side rather than fanning out.
    if (ax > az) z += side; else x += side;

    let d = (ax > az ? ax : az) >> 1;
    let last = -1;
    for (let step = 0; step < MAP_SIZE * 2; step++) {
      if (x < 0 || z < 0 || x >= MAP_SIZE || z >= MAP_SIZE) return;
      this.seen[z * MAP_SIZE + x] = 1;          // the wall it stops on is seen
      const v = map[z * MAP_SIZE + x];
      if (v <= 0) return;                       // solid or void: the ray stops
      if (v !== last) {
        last = v;
        // `cmp.w (a3)+,d2` on floor against ceiling: a shut door is a cell
        // with no gap in it, and the ray does not see past one.
        if (B.floorH[v] === B.ceilH[v]) return;
      }
      if (ax > az) {
        d -= az;
        if (d <= 0) { d += ax; z += sz; }
        x += sx;
      } else {
        d -= ax;
        if (d <= 0) { d += az; x += sx; }
        z += sz;
      }
    }
  }

  /**
   * MNfixloop: a cell nobody walked through but which has explored cells on
   * both sides counts as explored. Three rays leave one-cell holes, and this
   * closes them.
   */
  fillGaps() {
    const s = this.seen, out = Uint8Array.from(s);
    const at = (x, z) => (x < 0 || z < 0 || x >= MAP_SIZE || z >= MAP_SIZE)
      ? 0 : s[z * MAP_SIZE + x];
    for (let z = 0; z < MAP_SIZE; z++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        if (s[z * MAP_SIZE + x]) continue;
        if ((at(x - 1, z) && at(x + 1, z)) || (at(x, z - 1) && at(x, z + 1))) {
          out[z * MAP_SIZE + x] = 1;
        }
      }
    }
    this.seen = out;
  }

  /** The colour of the boundary between blocks `a` and `b`, or 0 for none. */
  edgeColour(B, a, b) {
    if (a === b) return 0;
    if (a <= 0) return b > 0 ? L_SOLID : 0;
    if (b <= 0) return L_SOLID;
    const rise = Math.abs(B.floorH[b] - B.floorH[a]);
    if (rise !== 0) return rise > PLAYER_MAX_RISE ? L_SOLID : L_OPEN;
    if (B.ceilH[b] !== B.ceilH[a]) return L_STEP;
    if (B.floorTex[b] !== B.floorTex[a]) return L_OPEN;
    if (B.ceilTex[b] !== B.ceilTex[a]) return L_STEP;
    return 0;                                   // the same room on both sides
  }

  draw(fb, W, H, level, cam) {
    const { map, B } = level;
    fb.fill(0);
    this.fillGaps();

    // The window follows the player but stops at the map's edges, and the
    // marker slides across the window instead when it does.
    const pcx = Math.floor(cam.x / 64), pcz = Math.floor(cam.z / 64);
    let ox = pcx - VIEW_X, oz = pcz - VIEW_Y;
    let px = VIEW_X, pz = VIEW_Y;
    if (ox < 0) { px += ox; ox = 0; } else if (ox > MAX_X) { px += ox - MAX_X; ox = MAX_X; }
    if (oz < 0) { pz += oz; oz = 0; } else if (oz > MAX_Z) { pz += oz - MAX_Z; oz = MAX_Z; }

    const put = (x, y, c) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      fb[y * W + x] = c;
    };
    const blockAt = (x, z) => (x < 0 || z < 0 || x >= MAP_SIZE || z >= MAP_SIZE)
      ? 0 : map[z * MAP_SIZE + x];

    for (let row = 0; row < MAP_H; row++) {
      const mz = oz + row, sy = row * CELL;
      for (let col = 0; col < MAP_W; col++) {
        const mx = ox + col, sx = col * CELL;
        if (!this.seen[mz * MAP_SIZE + mx]) continue;
        const v = blockAt(mx, mz);
        if (v > 0) {
          for (let y = 0; y < CELL; y++) {
            for (let x = 0; x < CELL; x++) put(sx + x, sy + y, FILL);
          }
        }
        // DrawUpLine: the boundary with the cell above, four pixels across.
        const up = this.edgeColour(B, v, blockAt(mx, mz - 1));
        if (up) for (let x = 0; x < CELL; x++) put(sx + x, sy, up);
        // DrawLeftLine: the boundary with the cell to the left, four down.
        const left = this.edgeColour(B, v, blockAt(mx - 1, mz));
        if (left) for (let y = 0; y < CELL; y++) put(sx, sy + y, left);
      }
    }

    // The marker blinks: `VBTimer2 & 8` picks the colour.
    const colour = (this.timer & 8) ? PLAYER_B : PLAYER_A;
    const oct = ((Math.round((cam.heading / (2 * Math.PI)) * 2048) + 128) >> 8) & 7;
    const art = ARROWS[oct];
    const bx = px * CELL, by = pz * CELL;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (art[r] & (1 << (2 - c))) put(bx + c, by + 1 + r, colour);
      }
    }
  }
}
