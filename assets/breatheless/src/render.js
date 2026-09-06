// Breathless software renderer, producing an 8-bit palette-index framebuffer.
//
// Transcribed from Sorgenti/3d.asm (Render3d / RayCastX) and
// Sorgenti/DrawScreen.asm (MakeFrame).  It stays in palette-index space from
// start to finish, exactly like the original; the WebGPU pass only resolves
// indices through the palette and scales up.
//
// Geometry.  View direction is (cos h, sin h) -- movement.asm loads
// CPlayerViewDirX from costable and CPlayerViewDirZ from sintable.  Rays are
//     rayDir = viewDir*128 + perp*(sx/2),   perp = (-viewDirZ, +viewDirX)
// with sx running -160..+160 across the window whatever its pixel width, then
// scaled by windowYratio = windowH / 110.  Because the component along viewDir
// is constant, the ray parameter T is already perpendicular distance -- there is
// no fisheye correction in the original and none here.
//
// Projection:  screenY = (playerY - height) / T + centreY.
// Wall light level is floor(2*T*windowYratio), which reduces to distance/64 --
// one light step per map block -- clamped to 0..31.

import { MAP_SIZE, BLOCK_SIZE, EDGE_XPOS, EDGE_ZPOS, EDGE_XNEG, EDGE_ZNEG } from './level.js';
import { drawSprites } from './sprites.js';

const MAX_BLOCK_VIEW = 32;      // Sorgenti/TMap.i -- vtable entries per column
const MAX_DDA_STEPS = 512;      // safety stop; the original relies on walled maps
const STD_HALF_WIDTH = 160;     // WINDOW_STANDARD_WIDTH
const STD_HEIGHT = 110;         // WINDOW_STANDARD_HEIGHT
const FOCAL = 128;              // the "D" in 3d.asm's ray construction
const SKY_WIDTH = 256;          // SKY_BRUSH_WIDTH
const SKY_STD_HEIGHT = 200;     // SKY_STANDARD_HEIGHT

export class Renderer {
  constructor(assets, width = 320, height = 200) {
    this.assets = assets;
    this.resize(width, height);
    this.globalLight = 0;
    this.drawObjects = true;
    // Clear colour. Palette index 0 is legitimate black, so "was this pixel
    // written?" cannot be answered by testing for 0. Rendering the same frame
    // twice with different clear values and diffing does answer it, at zero
    // cost to the normal path.
    this.clearValue = 0;
  }

  resize(w, h) {
    this.W = w; this.H = h;
    this.halfW = w >> 1; this.halfH = h >> 1;
    this.yratio = h / STD_HEIGHT;                 // windowYratio
    this.skyYratio = SKY_STD_HEIGHT / h;          // SkyYratio
    this.frame = new Uint8Array(w * h);           // palette indices
    this.flat = new Int32Array(w * h);            // per-pixel flat id (see below)
    this.rayX = new Float64Array(w);
    this.rayZ = new Float64Array(w);
    // per-column clip table -- the original's `vtable`, used to occlude sprites
    this.vtT = new Float64Array(w * MAX_BLOCK_VIEW);
    this.vtTop = new Int16Array(w * MAX_BLOCK_VIEW);
    this.vtBot = new Int16Array(w * MAX_BLOCK_VIEW);
    this.vtN = new Int32Array(w);
  }

  setCamera(cam) {
    const vx = Math.cos(cam.heading), vz = Math.sin(cam.heading);
    const W = this.W, yr = this.yratio;
    for (let i = 0; i < W; i++) {
      const sx = STD_HALF_WIDTH * ((2 * i) / W - 1);   // -160 .. +160
      this.rayX[i] = (vx * FOCAL - vz * (sx / 2)) * yr;
      this.rayZ[i] = (vz * FOCAL + vx * (sx / 2)) * yr;
    }
    this.cam = cam;
  }

  /**
   * CLookHeight, in pixels, from CLookHeightNum.
   *
   *   ComputeVars:  LookHeightRatio = windowYratio * LOOKHEIGHT_STEP
   *   DMracalc:     CLookHeight = (CLookHeightNum * LookHeightRatio) >> 16
   *
   * with `windowYratio = window_height / WINDOW_STANDARD_HEIGHT` and
   * LOOKHEIGHT_STEP = 1. So the look offset is a fraction of the WINDOW, not a
   * fixed number of pixels: CLookHeightNum's +/-72 is 65% of the view at every
   * window height, which is what keeps looking up and down feeling the same at
   * any size.
   *
   * The port used CLookHeightNum directly as a pixel offset. That is right only
   * when the window is exactly 110 rows tall, and wrong everywhere else: 36% of
   * the view at 320x200, 9% at 4x -- where it became obvious -- and 120% at the
   * smallest window, which is more travel than there is screen.
   */
  lookOffset(cam) {
    return Math.round((cam.lookHeight | 0) * this.yratio);
  }

  /** Wall/flat shading row: MakeFrame's 2*T*windowYratio. */
  lightRow(T, illum, fog) {
    let l = Math.floor(2 * T * this.yratio) + illum;
    if (!fog) l += this.globalLight;
    return (fog ? 8192 : 0) + Math.max(0, Math.min(31, l)) * 256;
  }

  /** Sprite shading row: DrawObjects halves the distance term. See sprites.js. */
  spriteLight(depth, illum, fog) {
    let l = Math.floor(depth / 128) + illum;
    if (!fog) l += this.globalLight;
    return (fog ? 8192 : 0) + Math.max(0, Math.min(31, l)) * 256;
  }

  /** Clip window open at world depth `depth` in column x, or null if occluded. */
  clipAt(x, depth) {
    const T = depth / (FOCAL * this.yratio);
    const n = this.vtN[x], base = x * MAX_BLOCK_VIEW;
    for (let i = 0; i < n; i++) {
      if (this.vtT[base + i] > T) {
        return { top: this.vtTop[base + i], bottom: this.vtBot[base + i] };
      }
    }
    return null;
  }

  render(level, cam, extra = null) {
    // Render3d adds PlayerYOsc only to the sampled camera position. Collision,
    // floor following and projectiles continue to use the physical eye height.
    const viewCam = cam.yOsc ? { ...cam, y: cam.y + cam.yOsc } : cam;
    this.exits = { wall: 0, vtableFull: 0, ddaLimit: 0, mapEdge: 0, windowClosed: 0 };
    this.setCamera(viewCam);
    this.frame.fill(this.clearValue);
    this.flat.fill(0);
    const centreY = this.halfH + this.lookOffset(viewCam);
    for (let x = 0; x < this.W; x++) this.column(level, viewCam, x, centreY);
    this.drawFlats(level, viewCam, centreY);
    if (this.drawObjects) drawSprites(this, level, viewCam, centreY, extra);
    return this.frame;
  }

  // ---- one screen column ------------------------------------------------
  column(level, cam, x, centreY) {
    const { map, B, E } = level;
    const H = this.H;
    const px = cam.x, pz = cam.z, py = cam.y;
    const rx = this.rayX[x], rz = this.rayZ[x];

    let cx = Math.floor(px / BLOCK_SIZE), cz = Math.floor(pz / BLOCK_SIZE);
    const stepX = rx > 0 ? 1 : -1, stepZ = rz > 0 ? 1 : -1;
    const adx = Math.abs(rx) || 1e-9, adz = Math.abs(rz) || 1e-9;
    const tDeltaX = BLOCK_SIZE / adx, tDeltaZ = BLOCK_SIZE / adz;
    let tMaxX = (rx > 0 ? (cx + 1) * BLOCK_SIZE - px : px - cx * BLOCK_SIZE) / adx;
    let tMaxZ = (rz > 0 ? (cz + 1) * BLOCK_SIZE - pz : pz - cz * BLOCK_SIZE) / adz;

    let prev = level.blockAt(cx, cz);
    if (prev < 0) prev = -prev;
    let clipTop = 0, clipBottom = H;
    const vbase = x * MAX_BLOCK_VIEW;
    let vn = 0;

    // The original's DDA has no step limit -- it runs until it meets a solid
    // block (RayCastX exits only via `bmi`).  MAX_BLOCK_VIEW caps the number of
    // *recorded* block changes, not the number of cells stepped through, which
    // matters in the large outdoor areas where a ray crosses many empty cells.
    for (let step = 0; step < MAX_DDA_STEPS; step++) {
      if (clipBottom <= clipTop) { this.exits.windowClosed++; break; }
      if (vn >= MAX_BLOCK_VIEW - 1) { this.exits.vtableFull++; break; }

      let T, edge, uWorld;
      if (tMaxX < tMaxZ) {
        T = tMaxX; tMaxX += tDeltaX; cx += stepX;
        edge = stepX > 0 ? EDGE_XNEG : EDGE_XPOS;          // the face we look at
        uWorld = pz + T * rz;
        if (edge === EDGE_XNEG) uWorld = -uWorld;          // 3d.asm `not.l` on Edge3
      } else {
        T = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ;
        edge = stepZ > 0 ? EDGE_ZNEG : EDGE_ZPOS;
        uWorld = px + T * rx;
        if (edge === EDGE_ZPOS) uWorld = -uWorld;          // `not.l` on Edge2
      }
      if (cx < 0 || cz < 0 || cx >= MAP_SIZE || cz >= MAP_SIZE) { this.exits.mapEdge++; break; }
      if (T <= 0) break;

      const raw = map[cz * MAP_SIZE + cx];
      const solid = raw < 0;
      const cur = solid ? -raw : raw;
      if (!solid && cur === prev) continue;              // same block: no seam

      // record the clip window as it stands *before* this seam is drawn,
      // exactly as MakeFrame stores clipymin/clipymax into the vtable
      this.vtT[vbase + vn] = T;
      this.vtTop[vbase + vn] = clipTop;
      this.vtBot[vbase + vn] = clipBottom;
      vn++;

      const lit = this.lightRow(T, B.illum[prev], B.fog[prev]);
      const invT = 1 / T;
      const yOf = (h) => (py - h) * invT + centreY;
      const ceilCur = B.ceilH[cur], ceilPrev = B.ceilH[prev];
      const floorCur = B.floorH[cur], floorPrev = B.floorH[prev];
      const eIdx = B.edges[cur * 4 + edge];

      // ---- ceiling side ----
      if (solid || ceilCur !== ceilPrev || B.ceilTex[cur] !== B.ceilTex[prev]
          || B.illum[cur] !== B.illum[prev]) {
        const yl = yOf(ceilCur), yh = yOf(ceilPrev);
        if (yl > yh) {                                    // step down: upper wall
          this.fillCeilingSpan(x, clipTop, Math.min(yh, clipBottom), prev);
          clipTop = Math.max(clipTop, Math.ceil(yh));
          const t = this.texOf(level, E.upTex[eIdx]);
          if (t) this.wall(t, x, yh, yl, ceilPrev - ceilCur, uWorld, lit,
                           clipTop, clipBottom, (E.attr[eIdx] & 1) !== 0);
          clipTop = Math.max(clipTop, Math.min(Math.ceil(yl), clipBottom));
        } else {
          // Ceiling steps UP: what stays visible is the PREVIOUS block's
          // ceiling, down to yh.  MakeFrame calls FillCeiling with d7 = yh
          // here, not yl -- filling to yl leaves the rows between them to be
          // claimed by a later, wrong seam, or by nothing at all.
          this.fillCeilingSpan(x, clipTop, Math.min(yh, clipBottom), prev);
          clipTop = Math.max(clipTop, Math.ceil(yh));
        }
      } else {
        const yh = yOf(ceilPrev);
        this.fillCeilingSpan(x, clipTop, Math.min(yh, clipBottom), prev);
        clipTop = Math.max(clipTop, Math.ceil(yh));
      }

      // ---- floor side ----
      if (solid || floorCur !== floorPrev || B.floorTex[cur] !== B.floorTex[prev]
          || B.illum[cur] !== B.illum[prev]) {
        const yh = yOf(floorCur), yl = yOf(floorPrev);
        if (yl > yh) {                                    // step up: lower wall
          this.fillFloorSpan(x, Math.max(yl, clipTop), clipBottom, prev);
          clipBottom = Math.min(clipBottom, Math.ceil(yl));
          const t = this.texOf(level, E.lowTex[eIdx]);
          if (t) this.wall(t, x, yh, yl, floorPrev - floorCur, uWorld, lit,
                           clipTop, clipBottom, (E.attr[eIdx] & 2) !== 0);
          clipBottom = Math.min(clipBottom, Math.max(Math.ceil(yh), clipTop));
        } else {
          // Floor steps DOWN: the previous block's floor is nearer and wins
          // down to yl.  MakeFrame adds d6 (= yl - yh) back before calling
          // FillFloor, which is exactly "fill from yl", not from yh.
          this.fillFloorSpan(x, Math.max(yl, clipTop), clipBottom, prev);
          clipBottom = Math.min(clipBottom, Math.ceil(yl));
        }
      } else {
        const yl = yOf(floorPrev);
        this.fillFloorSpan(x, Math.max(yl, clipTop), clipBottom, prev);
        clipBottom = Math.min(clipBottom, Math.ceil(yl));
      }

      if (solid) {
        const t = this.texOf(level, E.normTex[eIdx]);
        if (t) this.wall(t, x, yOf(ceilCur), yOf(floorCur),
                         ceilCur - floorCur, uWorld, lit, clipTop, clipBottom);
        this.vtN[x] = vn;
        this.exits.wall++;
        return;                                        // ray stops at a wall
      }
      prev = cur;
    }
    if (this.exits) this.exits.ddaLimit++;
    // ran out of blocks without hitting a wall: everything past here is open
    this.vtT[vbase + vn] = Infinity;
    this.vtTop[vbase + vn] = clipTop;
    this.vtBot[vbase + vn] = clipBottom;
    this.vtN[x] = vn + 1;
  }

  texOf(level, slot) { return slot > 0 ? (level.tex[slot] || null) : null; }

  // ---- textured vertical wall strip -------------------------------------
  /**
   * One textured wall strip.
   *
   * Texture rows map 1:1 to WORLD units -- the step is `dimWall / numPixels`
   * in every Stretch macro, and the unpegged case subtracts a world height
   * from a texture height, which only makes sense if they share a unit. A
   * 64x128 door texture therefore covers 128 world units, not "one block";
   * scaling it by texHeight/BLOCK_SIZE squashes every tall texture into a
   * short opening, which is what doors looked like before this was fixed.
   *
   * `unpegged` is ed_Attribute bit 0 for an upper texture and bit 1 for a
   * lower one: instead of starting at v = 0 (texture top at the wall top) the
   * texture is aligned to the wall's BOTTOM, v starting at texHeight - dimWall.
   */
  wall(tex, x, yTop, yBot, worldH, uWorld, lit, clipTop, clipBottom, unpegged) {
    const span = yBot - yTop;
    if (span <= 0) return;
    const { textures, lighting } = this.assets;
    const base = tex.offsets[tex.frame], tw = tex.w, th = tex.h;
    // `scale` is texels per world unit: 1 for the Amiga's own art, 4 for an HD
    // set. Every Stretch macro maps one world unit to one texture row, so the
    // world-space quantities below are the ones that have to be converted --
    // the projection itself is untouched, because the texture getting bigger
    // does not move anything.
    const ts = tex.scale ?? 1;
    let u = Math.floor(uWorld * ts) % tw; if (u < 0) u += tw;

    const vStep = worldH * ts / span;            // texels per screen row
    const v0 = unpegged ? th - worldH * ts : 0;
    let y0 = Math.ceil(yTop), y1 = Math.ceil(yBot);
    if (y0 < clipTop) y0 = clipTop;
    if (y1 > clipBottom) y1 = clipBottom;
    if (y0 < 0) y0 = 0;
    if (y1 > this.H) y1 = this.H;
    if (y0 >= y1) return;

    let v = v0 + (y0 - yTop) * vStep;
    const fb = this.frame, flat = this.flat, W = this.W;
    for (let y = y0; y < y1; y++, v += vStep) {
      let vv = Math.floor(v) % th; if (vv < 0) vv += th;
      const o = y * W + x;
      fb[o] = lighting[lit + textures[base + vv * tw + u]];
      flat[o] = 0;
    }
  }

  // ---- flat span recording: +id = ceiling of block, -id = floor ----------
  fillCeilingSpan(x, y0, y1, block) {
    y0 = Math.max(0, Math.ceil(y0)); y1 = Math.min(this.H, Math.ceil(y1));
    const flat = this.flat, W = this.W, id = block + 1;
    for (let y = y0; y < y1; y++) if (flat[y * W + x] === 0) flat[y * W + x] = id;
  }

  fillFloorSpan(x, y0, y1, block) {
    y0 = Math.max(0, Math.ceil(y0)); y1 = Math.min(this.H, Math.ceil(y1));
    const flat = this.flat, W = this.W, id = -(block + 1);
    for (let y = y0; y < y1; y++) if (flat[y * W + x] === 0) flat[y * W + x] = id;
  }

  // ---- second pass: horizontal flat spans, plus sky ----------------------
  drawFlats(level, cam, centreY) {
    const { B } = level;
    const { textures, lighting } = this.assets;
    const flat = this.flat, fb = this.frame, W = this.W, H = this.H;
    const px = cam.x, pz = cam.z, py = cam.y;
    // Sky panning, from DrawScreen.asm's sky column and movement.asm:DMout.
    //
    //   CSkyRotation = CPlayerHeading / 2 * 256    (movement.asm:661)
    //   SkyRotation  = CSkyRotation >> 8           (3d.asm:86)
    //   column = ((currentx * SkyXratio + SkyRotation<<12) >> 12) & 255
    //   SkyXratio = (SKY_BRUSH_WIDTH << 12) / window_width
    //
    // which reduces to  column = (x * 256 / W + heading/2) mod 256, with
    // heading in the 2048-unit basis. So the brush spans exactly one window
    // width, and a full turn pans it 1024 columns -- four times round.
    //
    // The port had `heading / 8`, a quarter of that, which left the sky nearly
    // stuck to the view: turning moved it so much less than the walls that it
    // read as the sky rotating WITH the player rather than past them.
    const headingUnits = (cam.heading / (2 * Math.PI)) * 2048;
    const skyRot = headingUnits / 2;
    // The sky pans with CLookHeight too (`move.l LookHeight(a5),d0` in the sky
    // column), not with the raw counter.
    const look = this.lookOffset(cam);

    for (let y = 0; y < H; y++) {
      const dy = y - centreY;
      const row = y * W;
      let x = 0;
      while (x < W) {
        const id = flat[row + x];
        if (id === 0) { x++; continue; }
        let x2 = x;
        while (x2 < W && flat[row + x2] === id) x2++;

        const isFloor = id < 0, b = Math.abs(id) - 1;

        if (!isFloor && B.skyCeil[b]) {
          // Sky is drawn raw -- no lighting table, no perspective.
          // Column comes from screen x plus rotation; row from (y - lookHeight)
          // scaled by SkyYratio; above the brush we repeat its topmost pixel.
          const tex = level.tex[B.ceilTex[b]];
          if (tex) {
            const base = tex.offsets[tex.frame], tw = tex.w, th = tex.h;
            const ts = tex.scale ?? 1;
            for (let i = x; i < x2; i++) {
              let u = Math.floor(((i * SKY_WIDTH) / W + skyRot) * ts) % tw;
              if (u < 0) u += tw;
              let v = Math.floor((y - look) * this.skyYratio * ts);
              if (v < 0) v = 0; else if (v >= th) v = th - 1;
              fb[row + i] = textures[base + v * tw + u];
            }
          }
          x = x2; continue;
        }

        if (dy === 0) { x = x2; continue; }     // the horizon row is degenerate
        const h = isFloor ? B.floorH[b] : B.ceilH[b];
        const slot = isFloor ? B.floorTex[b] : B.ceilTex[b];
        const tex = slot > 0 ? level.tex[slot] : null;
        const T = (py - h) / dy;
        if (tex && T > 0) {
          const lit = this.lightRow(T, B.illum[b], B.fog[b]);
          const base = tex.offsets[tex.frame], tw = tex.w, th = tex.h;
          const n = x2 - x, denom = Math.max(1, n - 1);
          const wx0 = px + T * this.rayX[x], wz0 = pz + T * this.rayZ[x];
          const dux = (px + T * this.rayX[x2 - 1] - wx0) / denom;
          const dvz = (pz + T * this.rayZ[x2 - 1] - wz0) / denom;
          const ts = tex.scale ?? 1;
          let wx = wx0, wz = wz0;
          for (let i = x; i < x2; i++, wx += dux, wz += dvz) {
            let u = Math.floor(wx * ts) % tw; if (u < 0) u += tw;
            let v = Math.floor(wz * ts) % th; if (v < 0) v += th;
            fb[row + i] = lighting[lit + textures[base + v * tw + u]];
          }
        }
        x = x2;
      }
    }
  }
}
