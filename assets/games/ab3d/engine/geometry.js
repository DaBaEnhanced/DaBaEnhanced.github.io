import { SOURCE_SINE } from '../assets/sine-table.js';

export function edgeEnd(edge) {
  return { x: edge.x + edge.dx, z: edge.z + edge.dz };
}

function signedWord(value) {
  const word = value & 0xffff;
  return word & 0x8000 ? word - 0x10000 : word;
}

function sourceProjectedDivsWord(dividend, divisor) {
  const sourceDividend = dividend | 0;
  const sourceDivisor = signedWord(divisor);
  if (!sourceDivisor) return signedWord(sourceDividend);
  const quotient = Math.trunc(sourceDividend / sourceDivisor);
  // Abreed3d_2Player.s:RotateLevelPts lines 1809-1823 performs DIVS directly
  // in the 25.7 side long. A 68000 quotient overflow leaves that destination
  // long unchanged, after which ADD.W #47 consumes its original low word.
  return quotient < -32768 || quotient > 32767
    ? signedWord(sourceDividend) : signedWord(quotient);
}

export function sourceRoomEdgeSide(cameraX, cameraZ, edge) {
  // orderzones:InsertList subtracts into words, performs two signed MULS, and
  // compares the wrapping SUB.L result with zero.
  const x = signedWord(Math.floor(cameraX) - signedWord(edge.x));
  const z = signedWord(Math.floor(cameraZ) - signedWord(edge.z));
  return (Math.imul(x, signedWord(edge.dz)) -
    Math.imul(z, signedWord(edge.dx))) | 0;
}

// Abreed3d_2Player.s:RotateLevelPts (lines 1764-1823) rotates signed-word
// point deltas with the released SineTable, keeps the wrapping MULS/ADD.L
// results, and projects the 25.7 side numerator with signed DIVS. Points behind
// the view are pinned to source column 0 or 96 according to the side sign.
function sourceRotatedPoint(point, camera) {
  const angleUnits = camera.angleUnits === undefined
    ? Math.round((camera.angle || 0) / (Math.PI * 2) * 4096) * 2 & 8190
    : Math.trunc(camera.angleUnits) & 8190;
  const sinWord = SOURCE_SINE[angleUnits >> 1];
  const cosWord = SOURCE_SINE[((angleUnits + 2048) & 8190) >> 1];
  const dx = signedWord(signedWord(point[0]) - signedWord(Math.floor(camera.x)));
  const dz = signedWord(signedWord(point[1]) - signedWord(Math.floor(camera.z)));

  let sideProduct = (Math.imul(dx, cosWord) - Math.imul(dz, sinWord)) | 0;
  sideProduct = (sideProduct + sideProduct) | 0;
  const sideWord = signedWord(sideProduct >> 16);
  const wobble = Math.trunc((camera.bobbleAcross || 0) * 128) | 0;
  const sideLong = ((sideWord << 7) + wobble) | 0;

  let depthProduct = (Math.imul(dx, sinWord) + Math.imul(dz, cosWord)) | 0;
  depthProduct = (depthProduct << 2) | 0;
  const depth = signedWord(depthProduct >> 16);
  return { depth, sideLong };
}

export function sourceProjectedColumn(point, camera, width = 96) {
  const { depth, sideLong } = sourceRotatedPoint(point, camera);
  let sourceColumn;
  // The behind-point branch at lines 1809-1817 tests the low word of the
  // rotated side long, not the JavaScript sign of the complete long.
  if (depth <= 0) sourceColumn = signedWord(sideLong) > 0 ? 96 : 0;
  else sourceColumn = signedWord(47 + sourceProjectedDivsWord(sideLong, depth));
  return { depth, screen: sourceColumn * width / 96 };
}

// The explicitly labelled sharp browser mode draws between the original
// columns. Its walls use the same RotateLevelPts sideLong/depth pair as the
// source path, but retain the quotient instead of applying the 68000 DIVS
// truncation. Portal clips must use that identical projection or a quantized
// clip can end one or two pixels before the continuous wall and expose the
// backdrop/previous room. This helper is never used by the retail 96x80 path.
export function continuousProjectedColumn(point, camera, width = 192, projection = null) {
  const { depth, sideLong } = sourceRotatedPoint(point, camera);
  if (depth <= 0) {
    return { depth, screen: signedWord(sideLong) > 0 ? width : 0 };
  }
  const screen = projection
    ? projection.centerX + sideLong / depth * projection.pixelScale
    : (47 + sideLong / depth) * width / 96;
  return { depth, screen };
}

export function levelBounds(level) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  const include = (x, z) => {
    minX = Math.min(minX, x); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxZ = Math.max(maxZ, z);
  };
  for (const edge of level.edges) {
    include(edge.x, edge.z);
    include(edge.x + edge.dx, edge.z + edge.dz);
  }
  include(level.player1.x, level.player1.z);
  include(level.player2.x, level.player2.z);
  return { minX, minZ, maxX, maxZ, width: maxX - minX, height: maxZ - minZ };
}

export function edgeOwners(level) {
  const owners = Array.from({ length: level.edges.length }, () => []);
  for (const zone of level.zones) {
    for (const edgeId of zone.edgeIds) owners[edgeId].push(zone.id);
  }
  return owners;
}

export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
    : 0;
  const x = start.x + amount * dx;
  const z = start.z + amount * dz;
  return Math.hypot(point.x - x, point.z - z);
}

export function pointInZone(level, zoneId, x, z) {
  const zone = level.zones[zoneId];
  if (!zone) return false;
  let inside = false;
  for (const edgeId of zone.edgeIds) {
    const edge = level.edges[edgeId];
    const x2 = edge.x + edge.dx, z2 = edge.z + edge.dz;
    if ((edge.z > z) !== (z2 > z) &&
        x < (x2 - edge.x) * (z - edge.z) / (z2 - edge.z) + edge.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function reachableZoneAt(level, currentZone, x, z) {
  const candidates = new Set([currentZone]);
  for (const edgeId of level.zones[currentZone]?.edgeIds || []) {
    const joined = level.edges[edgeId].joinZone;
    if (joined >= 0) candidates.add(joined);
  }
  for (const zoneId of candidates) {
    if (pointInZone(level, zoneId, x, z)) return zoneId;
  }
  return null;
}

// Port of ab3d/orderzones. The returned order is the order used by the draw
// loop (far rooms first); the assembly builds a linked list and then walks its
// final array backwards.
export function sourceRoomOrder(level, currentZone, camera) {
  const entries = level.zones[currentZone]?.visibility;
  if (!entries?.length) return level.zones.map(zone => zone.id);

  const nodes = [{ room: -1, previous: -1, next: entries.length ? 1 : -1 }];
  const workspace = new Map();
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    nodes.push({
      room: entry.zone,
      previous: index,
      next: index + 1 < entries.length ? index + 2 : -1,
    });
    workspace.set(entry.zone, entry.visibilityMask >>> 0);
  }

  let cursor = entries.length;
  for (let pass = 0; pass <= 100 && cursor > 0; pass++) {
    const current = cursor;
    const previous = nodes[current].previous;
    if (previous < 0) break;
    cursor = previous;
    const zone = level.zones[nodes[current].room];
    let mask = workspace.get(zone.id) || 0;
    let bit = 0;
    for (const edgeId of zone.edgeIds) {
      const edge = level.edges[edgeId];
      if (edge.joinZone < 0) {
        bit += 3;
        continue;
      }
      // alienbreed3d2_CPORT/ab3d/orderzones:InsertList consumes three bits for
      // every edge. Bit zero says that JoinZone is in the draw list. Bit one
      // says the camera-side result is cached; bit two is that result. The
      // previous port treated bit zero as the cache flag and consumed only two
      // bits, shifting all later edge decisions and corrupting painter order.
      const joinIsInDrawList = (mask >>> (bit & 31)) & 1;
      if (!joinIsInDrawList) {
        bit += 3;
        continue;
      }
      bit++;
      const known = (mask >>> (bit & 31)) & 1;
      let mustMove;
      if (known) {
        bit++;
        mustMove = Boolean((mask >>> (bit & 31)) & 1);
      } else {
        mask = (mask | (1 << (bit & 31))) >>> 0;
        const side = sourceRoomEdgeSide(camera.x, camera.z, edge);
        bit++;
        mustMove = side > 0;
        if (mustMove) mask = (mask | (1 << (bit & 31))) >>> 0;
      }
      if (mustMove) {
        let found = nodes[current].previous;
        while (found >= 0 && nodes[found].room !== edge.joinZone) {
          found = nodes[found].previous;
        }
        if (found > 0) {
          const oldPrevious = nodes[current].previous;
          const oldNext = nodes[current].next;
          nodes[oldPrevious].next = oldNext;
          if (oldNext >= 0) nodes[oldNext].previous = oldPrevious;

          const insertPrevious = nodes[found].previous;
          nodes[current].previous = insertPrevious;
          nodes[current].next = found;
          nodes[insertPrevious].next = current;
          nodes[found].previous = current;
        }
      }
      bit++;
    }
    workspace.set(zone.id, mask);
  }

  const finalOrder = [];
  for (let node = nodes[0].next; node >= 0; node = nodes[node].next) {
    finalOrder.push(nodes[node].room);
  }
  return finalOrder.reverse();
}

// Reproduce the horizontal room clipping performed by NEWsetlclip and
// NEWsetrclip in the original 68000 renderer. The retail level embeds its
// ordered potentially-visible room list in every zone; the clips stream names
// boundary points, while pointConnections supplies the other end used to
// determine which side of the boundary faces the view.
function visibleRooms(
    level, currentZone, camera, width, projectPoint, continuous, projection = null) {
  const entries = level.zones[currentZone]?.visibility;
  if (!entries) {
    return level.zones.map(zone => ({ zone: zone.id, left: 0, right: width }));
  }
  const projected = new Map();
  const project = pointId => {
    if (projected.has(pointId)) return projected.get(pointId);
    const point = level.points[pointId];
    if (!point) return null;
    const result = projectPoint(point, camera, width, projection);
    projected.set(pointId, result);
    return result;
  };
  const rooms = [];
  for (const entry of entries) {
    let left = 0, right = width;
    if (entry.clip) {
      for (const pointId of entry.clip.leftPoints) {
        const point = project(pointId);
        if (!point || point.depth <= 0 || !Number.isFinite(point.screen)) continue;
        const connectedId = level.pointConnections[pointId]?.[1];
        const connected = project(connectedId);
        if (connected && Number.isFinite(connected.screen) && connected.screen > point.screen) continue;
        const boundary = continuous ? point.screen - .5 : point.screen;
        if (boundary > left) left = boundary;
      }
      for (const pointId of entry.clip.rightPoints) {
        const point = project(pointId);
        if (!point || point.depth <= 0 || !Number.isFinite(point.screen)) continue;
        const connectedId = level.pointConnections[pointId]?.[0];
        const connected = project(connectedId);
        if (connected && Number.isFinite(connected.screen) && connected.screen < point.screen) continue;
        const boundary = continuous ? point.screen + .5 : point.screen + width / 96;
        if (boundary < right) right = boundary;
      }
    }
    left = Math.max(0, Math.ceil(left));
    right = Math.min(width, Math.floor(right));
    if (left < right) rooms.push({ zone: entry.zone, left, right });
  }
  const byZone = new Map(rooms.map(room => [room.zone, room]));
  return sourceRoomOrder(level, currentZone, camera)
    .map(zone => byZone.get(zone))
    .filter(Boolean);
}


export function sourceVisibleRooms(level, currentZone, camera, width = 96) {
  return visibleRooms(
    level, currentZone, camera, width, sourceProjectedColumn, false);
}

// Browser-only companion to sourceVisibleRooms. Rounding after the +/- half
// pixel bias applies the same centre-sampling convention as sharp walls and
// planes: a shared portal boundary cannot leave an unowned output pixel.
export function continuousVisibleRooms(
    level, currentZone, camera, width = 192, projection = null) {
  return visibleRooms(
    level, currentZone, camera, width, continuousProjectedColumn, true, projection);
}

export function validateLevel(level) {
  if (level.format !== 'alien-breed-3d-level-v1') throw new Error('unexpected level format');
  if (!level.zones.length || !level.edges.length || !level.points.length) throw new Error('empty level data');
  if (!Number.isInteger(level.endZone) || level.endZone < 0 || level.endZone >= level.zones.length) {
    throw new Error('invalid campaign end zone');
  }
  if (!level.render || level.render.length !== level.zones.length) throw new Error('invalid render-list table');
  for (const [index, zone] of level.zones.entries()) {
    if (zone.id !== index) throw new Error(`zone ${index} has id ${zone.id}`);
    for (const edge of zone.edgeIds) {
      if (edge < 0 || edge >= level.edges.length) throw new Error(`zone ${index} has invalid edge ${edge}`);
    }
    for (const point of zone.pointIds) {
      if (point < 0 || point >= level.points.length) throw new Error(`zone ${index} has invalid point ${point}`);
    }
    if (!Array.isArray(zone.visibility) || !zone.visibility.length ||
        zone.visibility[0].zone !== index) {
      throw new Error(`zone ${index} has invalid visibility list`);
    }
    if (!zone.teleport || zone.teleport.zone < -1 ||
        zone.teleport.zone >= level.zones.length) {
      throw new Error(`zone ${index} has invalid teleport destination`);
    }
    for (const visible of zone.visibility) {
      if (visible.zone < 0 || visible.zone >= level.zones.length) {
        throw new Error(`zone ${index} sees invalid zone ${visible.zone}`);
      }
      for (const point of [
        ...(visible.clip?.leftPoints || []), ...(visible.clip?.rightPoints || []),
      ]) {
        if (point < 0 || point >= level.pointConnections.length) {
          throw new Error(`zone ${index} clip has invalid point ${point}`);
        }
      }
    }
  }
  for (const edge of level.edges) {
    if (edge.joinZone < -1 || edge.joinZone >= level.zones.length) {
      throw new Error(`edge ${edge.id} has invalid joined zone ${edge.joinZone}`);
    }
  }
  for (const [zoneId, render] of level.render.entries()) {
    for (const command of [...render.lower, ...render.upper]) {
      if (command.leftPoint !== undefined &&
          (command.leftPoint >= level.points.length || command.rightPoint >= level.points.length)) {
        throw new Error(`zone ${zoneId} render command has invalid points`);
      }
      if (command.textureBank !== undefined && (command.textureBank < 0 || command.textureBank >= 14)) {
        throw new Error(`zone ${zoneId} uses invalid texture bank ${command.textureBank}`);
      }
    }
  }
  if (!level.dynamics || level.dynamics.switches.length !== 8 ||
      level.dynamics.waterAnimations.length !== 21) {
    throw new Error('invalid dynamic geometry tables');
  }
  if (!Array.isArray(level.objects) || level.objects.length !== level.objectCount ||
      level.objectCount !== level.objectPointCount + 1) {
    throw new Error('invalid object table');
  }
  for (const [name, pool] of Object.entries(level.objectPools || {})) {
    if (!Number.isInteger(pool.start) || !Number.isInteger(pool.count) || pool.count !== 20 ||
        pool.start < 0 || pool.start + pool.count > level.objects.length ||
        level.objects.slice(pool.start, pool.start + pool.count)
          .some(object => object.type !== 2 || object.zone >= 0)) {
      throw new Error(`invalid ${name} object pool`);
    }
  }
  if (!level.objectPools?.playerShots || !level.objectPools?.alienShots) {
    throw new Error('missing projectile object pools');
  }
  for (const [index, object] of level.objects.entries()) {
    if (object.id !== index || object.zone < -1 || object.zone >= level.zones.length ||
        !Number.isInteger(object.render?.graphicType) ||
        !Number.isInteger(object.render?.frame) ||
        !Number.isInteger(object.render?.width) ||
        !Number.isInteger(object.render?.height) ||
        !Number.isInteger(object.render?.sourceWidth) ||
        !Number.isInteger(object.render?.sourceHeight) ||
        !Number.isInteger(object.parameter) ||
        object.position.x !== (object.position.xFixed >> 16) ||
        object.position.z !== (object.position.zFixed >> 16)) {
      throw new Error(`invalid object ${index}`);
    }
  }
  const commandsByOffset = new Map(level.render.flatMap(render => [...render.lower, ...render.upper])
    .map(command => [command.sourceOffset, command]));
  for (const [kind, records] of [
    ['door', level.dynamics.doors], ['lift', level.dynamics.lifts],
  ]) {
    for (const record of records) {
      if (record.zone < 0 || record.zone >= level.zones.length) {
        throw new Error(`${kind} has invalid zone ${record.zone}`);
      }
      const plane = commandsByOffset.get(record.planeRenderOffset);
      if (plane?.type !== (kind === 'door' ? 'roof' : 'floor')) {
        throw new Error(`${kind} has invalid plane command`);
      }
      for (const wall of record.walls) {
        if (wall.edge < 0 || wall.edge >= level.edges.length ||
            !commandsByOffset.has(wall.renderOffset)) {
          throw new Error(`${kind} has invalid wall binding`);
        }
      }
    }
  }
  for (const [index, item] of level.dynamics.switches.entries()) {
    if (item.zone < 0) {
      if (item.descriptorOffset !== 0) throw new Error(`unused switch ${index} has graphics`);
      continue;
    }
    if (item.zone >= level.zones.length || item.point < 0 || item.point + 1 >= level.points.length) {
      throw new Error(`switch ${index} has invalid zone or points`);
    }
    const wall = commandsByOffset.get(item.wallRenderOffset);
    if (wall?.type !== 'wall' || wall.leftPoint !== item.point ||
        wall.rightPoint !== item.point + 1 || wall.textureBank !== 11) {
      throw new Error(`switch ${index} has invalid wall descriptor`);
    }
  }
  return true;
}
