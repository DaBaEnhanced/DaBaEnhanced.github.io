import { decodeRGB12 } from './textures.js';

function requireRange(view, offset, bytes, label) {
  if (offset < 0 || offset + bytes > view.byteLength) {
    throw new Error(`truncated vector ${label}`);
  }
}

export function decodeVectorObject(buffer) {
  const view = buffer instanceof DataView ? buffer : new DataView(buffer);
  requireRange(view, 0, 6, 'header');
  const pointCount = view.getUint16(0);
  const frameCount = view.getUint16(2);
  requireRange(view, 4, frameCount * 2, 'frame table');
  if (!pointCount || !frameCount) throw new Error('empty vector descriptor');

  const frameOffsets = Array.from({ length: frameCount }, (_, index) =>
    view.getUint16(4 + index * 2));
  const frames = frameOffsets.map(offset => {
    requireRange(view, offset, pointCount * 6, 'point frame');
    return Array.from({ length: pointCount }, (_, index) => ({
      x: view.getInt16(offset + index * 6),
      y: view.getInt16(offset + index * 6 + 2),
      z: view.getInt16(offset + index * 6 + 4),
    }));
  });

  const partDescriptors = [];
  let cursor = 4 + frameCount * 2;
  while (true) {
    requireRange(view, cursor, 4, 'part table');
    const polygonOffset = view.getInt16(cursor);
    const sortPointOffset = view.getUint16(cursor + 2);
    cursor += 4;
    if (polygonOffset < 0) break;
    if (sortPointOffset % 10) {
      throw new Error(`unaligned PolygonObj sort point ${sortPointOffset}`);
    }
    partDescriptors.push({ polygonOffset, sortPointOffset });
    if (partDescriptors.length > 32) throw new Error('PolygonObj exceeds PartBuffer');
  }

  const parts = partDescriptors.map(descriptor => {
    const polygons = [];
    cursor = descriptor.polygonOffset;
    while (true) {
      requireRange(view, cursor, 2, 'polygon list');
      const edgeCountMinusOne = view.getInt16(cursor);
      if (edgeCountMinusOne < 0) break;
      const vertexCount = edgeCountMinusOne + 1;
      const polygonBytes = 18 + edgeCountMinusOne * 4;
      requireRange(view, cursor, polygonBytes, 'polygon');
      const holeFlags = view.getUint16(cursor + 2);
      const vertices = Array.from({ length: vertexCount }, (_, index) => {
        const at = cursor + 4 + index * 4;
        const point = view.getUint16(at);
        if (point >= pointCount) throw new Error(`vector point ${point} exceeds ${pointCount}`);
        return { point, u: view.getUint8(at + 2), v: view.getUint8(at + 3) };
      });
      const attributes = cursor + 8 + edgeCountMinusOne * 4;
      // putinlines reads one more point/UV tuple after its final listed vertex.
      // Retail loops repeat the first point number there, but some deliberately
      // use different U/V bytes to put the texture seam on the closing edge.
      const closingVertex = {
        point: view.getUint16(attributes),
        u: view.getUint8(attributes + 2),
        v: view.getUint8(attributes + 3),
      };
      if (closingVertex.point >= pointCount) {
        throw new Error(`vector closing point ${closingVertex.point} exceeds ${pointCount}`);
      }
      polygons.push({
        vertices, closingVertex,
        holes: Boolean(holeFlags & 0xff),
        textureOffset: view.getUint16(attributes + 4),
        brightnessDivisor: Math.max(1, view.getUint16(attributes + 6)),
        gouraud: Boolean(view.getUint8(attributes + 9)),
      });
      cursor += polygonBytes;
    }
    return { ...descriptor, polygons };
  });
  return { pointCount, frameCount, frames, parts };
}

export class VectorObjects {
  constructor(manifest, objects, textureMaps, palette) {
    this.manifest = manifest;
    this.objects = objects;
    this.textureMaps = textureMaps;
    this.palette = palette;
  }

  static async load(root = 'assets/vectors/') {
    const response = await fetch(`${root}index.json`);
    if (!response.ok) throw new Error(`vector manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.format !== 'alien-breed-3d-vector-objects-v1') {
      throw new Error('unknown vector-object format');
    }
    const entries = Object.entries(manifest.objects);
    const loaded = await Promise.all([
      ...entries.map(([, object]) => fetch(`${root}${object.file}`).then(checkedBuffer)),
      fetch(`${root}${manifest.textureMaps.file}`).then(checkedBuffer),
      fetch(`${root}${manifest.palette.file}`).then(checkedBuffer),
    ]);
    const objects = new Map(entries.map(([id, object], index) => {
      if (loaded[index].byteLength !== object.bytes) throw new Error(`invalid vector object ${id}`);
      return [Number(id), decodeVectorObject(loaded[index])];
    }));
    const textureMaps = new Uint8Array(loaded.at(-2));
    const palette = new DataView(loaded.at(-1));
    if (textureMaps.length !== 65536 || palette.byteLength !== 15 * 256 * 2) {
      throw new Error('invalid vector texture assets');
    }
    return new VectorObjects(manifest, objects, textureMaps, palette);
  }

  get(descriptor) { return this.objects.get(descriptor); }

  sample(textureOffset, u, v, brightness, holes = false) {
    const x = modulo(Math.floor(u), 64), y = modulo(Math.floor(v), 64);
    const at = y * 1024 + x * 4 + textureOffset;
    if (at < 0 || at >= this.textureMaps.length) return [255, 0, 255];
    const texel = this.textureMaps[at];
    if (holes && texel === 0) return null;
    const row = Math.max(0, Math.min(14, Math.floor(brightness)));
    return decodeRGB12(this.palette.getUint16((row * 256 + texel) * 2));
  }
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

async function checkedBuffer(response) {
  if (!response.ok) throw new Error(`asset request failed: HTTP ${response.status}`);
  return response.arrayBuffer();
}
