// Turns an extracted level JSON into flat typed arrays the renderer can walk.
//
// Map cells are 64 world units (BLOCK_SIZE). map[z*128 + x] holds a block index:
//   0  = void, never entered
//   >0 = open block, ray passes through
//   <0 = solid wall, ray stops here; the block index is -value
// (Sorgenti/3d.asm RayCastX: `bmi` stops the ray, then `neg.w` recovers the index.)

export const MAP_SIZE = 128;
export const BLOCK_SIZE = 64;

// Edge order, from the diagram in Sorgenti/TMap.i:
//        Edge4 (-Z)
//   Edge3 (-X) [] Edge1 (+X)
//        Edge2 (+Z)
export const EDGE_XPOS = 0, EDGE_ZPOS = 1, EDGE_XNEG = 2, EDGE_ZNEG = 3;

import { buildTriggerBlocks } from './effects.js';

export function buildLevel(json, assets) {
  const nb = json.blocks.length, ne = json.edges.length;

  const B = {
    floorH: new Int16Array(nb), ceilH: new Int16Array(nb),
    floorTex: new Int16Array(nb), ceilTex: new Int16Array(nb),
    skyCeil: new Uint8Array(nb), illum: new Int16Array(nb), fog: new Uint8Array(nb),
    edges: new Int32Array(nb * 4),
    effect: new Uint8Array(nb), trigger: new Uint8Array(nb),
    trigger2: new Uint8Array(nb), attrs: new Uint8Array(nb),
  };
  json.blocks.forEach((b, i) => {
    B.floorH[i] = b.floorH; B.ceilH[i] = b.ceilH;
    B.floorTex[i] = b.floorTex; B.ceilTex[i] = b.ceilTex;
    B.skyCeil[i] = b.skyCeil; B.illum[i] = b.illum; B.fog[i] = b.fog;
    for (let e = 0; e < 4; e++) B.edges[i * 4 + e] = b.edges[e];
    B.effect[i] = b.effect; B.trigger[i] = b.trigger;
    B.trigger2[i] = b.trigger2; B.attrs[i] = b.attrs;
  });

  const E = {
    normTex: new Int32Array(ne), upTex: new Int32Array(ne),
    lowTex: new Int32Array(ne), attr: new Uint16Array(ne),
  };
  json.edges.forEach((e, i) => {
    E.normTex[i] = e.normTex; E.upTex[i] = e.upTex;
    E.lowTex[i] = e.lowTex; E.attr[i] = e.attr;
  });

  // Level texture slot 0 means "no texture"; slots 1..N name entries in the TGLD.
  const tex = [null];
  const slotOf = new Map();
  const addTex = (name, a = assets) => {
    if (slotOf.has(name)) return slotOf.get(name);
    const t = a.texByName[name];
    const slot = tex.length;
    tex.push(t ? { name, w: t.w, h: t.h, frames: t.frames, offsets: t.offsets,
                   scale: t.scale ?? 1, frame: 0,
                   shift: Math.log2(t.h) | 0 } : null);
    slotOf.set(name, slot);
    return slot;
  };
  for (const name of json.textures) addTex(name);
  // A texture whose tx_AnimCount links to a second record is a switch face: the
  // pressed state. It is a full texture in the file, not a frame, so it gets a
  // slot of its own here and SwitchManagement swaps the edge over to it. These
  // slots sit past the level's own list, which nothing indexes into by number.
  for (const name of [...json.textures]) {
    const t = assets.texByName[name];
    if (t?.link && assets.texByName[t.link]) {
      tex[slotOf.get(name)].link = addTex(t.link);
    }
  }

  const map = Int16Array.from(json.map);

  // Object slot 0 is the "no object" entry in the editor's table, and every
  // level uses exactly one such map object to mark where the player spawns.
  // Its heading is stored as an octant (the file keeps angle>>8, and a full
  // turn is 2048 units -- see (angle+128)>>8 & 7 in Objects.asm:DrawObjects).
  const blockOf = (x, z) => {
    const v = (x < 0 || z < 0 || x >= MAP_SIZE * BLOCK_SIZE || z >= MAP_SIZE * BLOCK_SIZE)
      ? 0 : map[((z / BLOCK_SIZE) | 0) * MAP_SIZE + ((x / BLOCK_SIZE) | 0)];
    return v < 0 ? -v : v;
  };
  const objs = json.mapObjects
    .filter((o) => o.obj !== 0)
    .map((o) => {
      const name = json.objectNames[o.obj - 1] ?? null;
      const def = name ? assets.manifest.objects.entries[name] ?? null : null;
      const blk = blockOf(o.x, o.y);
      return {
        name, def,
        x: o.x, z: o.y,                 // the file's "y" is the world Z axis
        y: B.floorH[blk],               // objects sit on their block's floor
        heading: (o.heading & 7) * 256, // stored as an octant; 2048 per turn
        blockIllum: B.illum[blk], blockFog: B.fog[blk],
        effect: o.effect, animCount: 0, stopped: false,
      };
    });
  const marker = json.mapObjects.find((o) => o.obj === 0);
  const start = marker
    ? { x: marker.x, z: marker.y, heading: (marker.heading & 7) * Math.PI / 4 }
    : { x: 64 * 64, z: 64 * 64, heading: 0 };

  const triggerBlocks = buildTriggerBlocks({ B });

  return { json, map, B, E, tex, objs, start, triggerBlocks,
           // Switching between the original art and the HD set rebuilds only
           // this table; the geometry, the objects and the effect state are
           // untouched, so it can be done mid-level without losing anything.
           rebuildTextures(a) {
             slotOf.clear();
             tex.length = 1;
             for (const name of json.textures) addTex(name, a);
             for (const name of [...json.textures]) {
               const t = a.texByName[name];
               if (t?.link && a.texByName[t.link]) {
                 tex[slotOf.get(name)].link = addTex(t.link, a);
               }
             }
           },
           manifest: assets.manifest,
           blockAt(x, z) {
             if (x < 0 || z < 0 || x >= MAP_SIZE || z >= MAP_SIZE) return 0;
             return map[z * MAP_SIZE + x];
           } };
}
