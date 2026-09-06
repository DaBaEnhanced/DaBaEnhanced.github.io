// Object (sprite) rendering, from Sorgenti/Objects.asm:DrawObjects.
//
// Sprites are stored as RG8 (palette index, alpha) in sprites.bin, one pixel per
// world unit -- the same scale as wall textures, where a 64-pixel texture spans
// one 64-unit block.
//
// Projection uses the same 1/T the walls use vertically.  Horizontally the
// original multiplies the lateral offset by 9/8 ("Aggiusta la z"), which is a
// cheap stand-in for the true pixel aspect 256/(128*windowYratio) = 1.1 at the
// default 320x200 window.  We use the exact factor instead, so sprites line up
// with wall geometry at every window size; at 320x200 this moves a sprite at the
// screen edge by about 2% of half-width against the original.
//
// Lighting deliberately differs from walls: MakeFrame uses 2*T*windowYratio
// (= distance/64) while DrawObjects uses T*windowYratio (= distance/128), with
// the doubling `add.l d0,d0` commented out in the original source.  Sprites
// therefore attenuate at half the rate of walls.  That asymmetry is reproduced,
// not corrected.

import { MAP_SIZE } from './level.js';

const OBJTYPE_SHOT = 4, OBJTYPE_EXPLOSION = 5;

/** Pick the frame index for an object, per DrawObjects' animation branches. */
export function frameIndexFor(def, obj, playerHeading) {
  const n = def.frames.length;
  if (def.animtype !== 'DIRECTIONAL') {
    return Math.min(obj.animCount | 0, n - 1);
  }
  // DOAnimDirezionale: `tst.b obj_status / bpl DOadnostop`. A NEGATIVE status --
  // firing (-1) and falling (-3) -- indexes the frame list directly, because
  // those poses are shared across facings and live at absolute indices (40 for
  // the firing pose, 42..44 for the fall, 129 for the body). Only a walking
  // enemy gets the octant treatment. `stopped` covers the dead-and-settled case
  // where the port has no status left to read.
  if (obj.stopped || (obj.status | 0) < 0) {
    return Math.min(obj.animCount | 0, n - 1);
  }
  // DrawObjects does `bset #7,obj_bmstatus` here to mark the enemy as on-screen.
  // The AI reads that flag to keep simulating enemies the player can see even
  // when they are past MAX_ENEMY_DIST, so it has to be set from the renderer.
  obj.inView = true;
  // ((angle+128)>>8)&7 gives the octant; the sprite sheet is 16 frames per facing
  const objOct = (((obj.heading | 0) + 128) >> 8) & 7;
  const plOct = ((playerHeading + 128) >> 8) & 7;
  const rel = (objOct + 6 - plOct) & 7;
  return Math.min(rel * 16 + (obj.animCount | 0), n - 1);
}

/**
 * `extra` carries the live projectiles. In the original they are ordinary
 * objects linked into the same per-block lists DrawObjects walks, so they are
 * projected, depth-sorted and occluded exactly like everything else; here they
 * live in their own array only because the shot loop wants them contiguous.
 * Leaving them out of this function is what made bullets invisible.
 */
export function drawSprites(r, level, cam, centreY, extra = null) {
  const { W, H, frame, yratio } = r;
  const sprites = r.assets.sprites, lighting = r.assets.lighting;
  const vx = Math.cos(cam.heading), vz = Math.sin(cam.heading);
  const plHeadingUnits = Math.round((cam.heading / (2 * Math.PI)) * 2048) & 2047;

  // horizontal scale: screen column = W/2 + (4W/5) * lateral / depth
  const hScale = (4 * W) / 5;
  const vScale = 128 * yratio;                 // vertical: 1/T = vScale / depth

  const { B, map } = level;

  // DrawObjects reads an object's block AT DRAW TIME -- `move.l obj_blockpun,a4`
  // then `bl_Illumination(a4)` -- and, for everything except shots (type 4) and
  // explosions (type 5), snaps its Y to that block's floor:
  //
  //   DOloop1.2  move.l obj_blockpun(a2),a1
  //              cmp.b #4,d0 / beq DOnomy ; cmp.b #5,d0 / beq DOnomy
  //              move.w bl_FloorHeight(a1),obj_y(a2)
  //
  // The port cached illumination, fog and Y when the level was built and only
  // refreshed them for an enemy that successfully moved. So a pickup, a corpse,
  // a piece of scenery or an enemy standing still kept whatever the block was
  // like at load time -- and since four effect opcodes change a block's
  // illumination at runtime (LightUp, LightDown, LinkedLight, BlinkingLight),
  // anything standing on a light that changed simply did not change with it,
  // and anything standing on a lift did not ride it.
  const refresh = (o) => {
    const cx = (o.x / 64) | 0, cz = (o.z / 64) | 0;
    if (cx < 0 || cz < 0 || cx >= MAP_SIZE || cz >= MAP_SIZE) return;
    let blk = map[cz * MAP_SIZE + cx];
    if (blk < 0) blk = -blk;
    if (!blk) return;
    o.blockIllum = B.illum[blk];
    o.blockFog = B.fog[blk];
    // Shots and explosions carry their own height; everything else sits on the
    // floor of whatever block it is standing in, this frame.
    if (o.kind !== 'shot' && o.kind !== 'explosion') o.y = B.floorH[blk];
  };

  const vis = [];
  const consider = (o) => {
    if (!o.def || o.hidden) return;
    const dx = o.x - cam.x, dz = o.z - cam.z;
    const depth = dx * vx + dz * vz;
    if (depth <= 1) return;
    refresh(o);
    const lateral = dz * vx - dx * vz;
    vis.push({ o, depth, lateral });
  };
  for (const o of level.objs) consider(o);
  if (extra) for (const o of extra) consider(o);
  vis.sort((a, b) => b.depth - a.depth);       // far to near
  const total = level.objs.length + (extra ? extra.length : 0);
  r.stats = { considered: total, inFront: vis.length, drawn: 0, pixels: 0 };

  for (const { o, depth, lateral } of vis) {
    const def = o.def;
    const fi = frameIndexFor(def, o, plHeadingUnits);
    const f = def.frames[fi];
    if (!f || f.w === 0 || f.h === 0) continue;

    const invD = 1 / depth;
    // A sprite frame is stored at `scale` texels per world unit. Its SIZE in
    // the world is unchanged by that, so the projection uses the world size and
    // only the texel walk below uses the stored size.
    const fs = f.scale ?? 1;
    const worldW = f.w / fs, worldH = f.h / fs;
    const wS = worldW * vScale * invD;
    const hS = worldH * vScale * invD;
    if (wS < 0.5 || hS < 0.5) continue;

    const xLeft = W / 2 + hScale * (lateral - f.xoff) * invD;
    // DrawObjects adds the look offset exactly once:
    //   d3 = (PlayerY - obj_y - yoffset) * 128 / distance
    //   add.w window_height2,d3      ; the centre of the window
    //   sub.w d1,d3                  ; minus the projected height -> the top
    //   add.w LookHeight,d3          ; and the look offset, once
    // `centreY` is already window_height2 + lookHeight, so adding lookHeight
    // again here moved sprites at twice the rate of the walls and floors they
    // stand on -- which reads as them sliding the wrong way when you look up.
    const yBot = (cam.y - o.y - f.yoff) * vScale * invD + centreY;
    const yTop = yBot - hS;

    r.stats.drawn++;
    const lit = r.spriteLight(depth, o.blockIllum, o.blockFog);
    const uStep = f.w / wS, vStep = f.h / hS;

    let x0 = Math.ceil(xLeft), x1 = Math.ceil(xLeft + wS);
    if (x0 < 0) x0 = 0;
    if (x1 > W) x1 = W;

    for (let x = x0; x < x1; x++) {
      const clip = r.clipAt(x, depth);
      if (!clip) continue;                     // fully hidden behind geometry
      let u = Math.floor((x - xLeft) * uStep);
      if (u < 0) u = 0; else if (u >= f.w) u = f.w - 1;

      let y0 = Math.ceil(yTop), y1 = Math.ceil(yBot);
      if (y0 < clip.top) y0 = clip.top;
      if (y1 > clip.bottom) y1 = clip.bottom;
      if (y0 < 0) y0 = 0;
      if (y1 > H) y1 = H;

      let v = (y0 - yTop) * vStep;
      const col = f.off + u * 2;
      for (let y = y0; y < y1; y++, v += vStep) {
        let vv = v | 0;
        if (vv < 0) vv = 0; else if (vv >= f.h) vv = f.h - 1;
        const s = col + vv * f.w * 2;
        if (sprites[s + 1] === 0) continue;    // transparent
        frame[y * W + x] = lighting[lit + sprites[s]];
        r.stats.pixels++;
      }
    }
  }
}

export { OBJTYPE_SHOT, OBJTYPE_EXPLOSION };
