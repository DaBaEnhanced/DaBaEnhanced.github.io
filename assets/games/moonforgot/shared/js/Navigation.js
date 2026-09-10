export const DEFAULT_NAV_RADIUS = 18;
export const DEFAULT_NAV_DEPTH = 50;

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function lerp(from, to, amount) { return from + (to - from) * amount; }

export function nodeRadius(node, fallback = DEFAULT_NAV_RADIUS) {
  return Number.isFinite(node?.radius) && node.radius > 0 ? node.radius : fallback;
}

export function nodeDepth(node, fallback = DEFAULT_NAV_DEPTH) {
  return Number.isFinite(node?.depth) ? node.depth : fallback;
}

export function nearestNode(nodes, point) {
  return (nodes ?? []).reduce((best, node) => !best || distance(node, point) < distance(best, point) ? node : best, null);
}

export function navigationSegments(nodes) {
  const byId = new Map((nodes ?? []).map((node) => [node.id, node]));
  const seen = new Set(); const segments = [];
  for (const node of nodes ?? []) for (const link of node.links ?? []) {
    const other = byId.get(link); if (!other || other === node) continue;
    const key = [String(node.id), String(other.id)].sort().join("\u0000");
    if (seen.has(key)) continue; seen.add(key);
    segments.push({ key, a: node, b: other, length: distance(node, other) });
  }
  return segments;
}

export function toggleNavigationLink(nodes, firstId, secondId) {
  if (firstId === secondId) return null;
  const first = (nodes ?? []).find((node) => node.id === firstId); const second = (nodes ?? []).find((node) => node.id === secondId);
  if (!first || !second) return null;
  first.links ??= []; second.links ??= [];
  const linked = first.links.includes(secondId) || second.links.includes(firstId);
  first.links = first.links.filter((id) => id !== secondId); second.links = second.links.filter((id) => id !== firstId);
  if (!linked) { first.links.push(secondId); second.links.push(firstId); }
  return !linked;
}

export function projectPointToSegment(point, a, b) {
  const dx = b.x - a.x; const dy = b.y - a.y; const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
  const x = lerp(a.x, b.x, t); const y = lerp(a.y, b.y, t);
  return { x, y, t, distance: Math.hypot(point.x - x, point.y - y), radius: lerp(nodeRadius(a), nodeRadius(b), t), scale: lerp(a.scale ?? 1, b.scale ?? 1, t), depth: lerp(nodeDepth(a), nodeDepth(b), t) };
}

function attachmentCandidates(nodes, point, allowedNodeIds) {
  const segments = navigationSegments(nodes); const connected = new Set(); const candidates = [];
  for (const segment of segments) {
    connected.add(segment.a.id); connected.add(segment.b.id);
    if (allowedNodeIds && (!allowedNodeIds.has(segment.a.id) || !allowedNodeIds.has(segment.b.id))) continue;
    const projection = projectPointToSegment(point, segment.a, segment.b);
    candidates.push({ ...projection, segment, a: segment.a, b: segment.b, outside: Math.max(0, projection.distance - projection.radius) });
  }
  for (const node of nodes ?? []) {
    if (connected.has(node.id) || (allowedNodeIds && !allowedNodeIds.has(node.id))) continue;
    const nodeDistance = distance(point, node); const radius = nodeRadius(node);
    candidates.push({ x: node.x, y: node.y, t: 0, distance: nodeDistance, radius, scale: node.scale ?? 1, depth: nodeDepth(node), segment: null, a: node, b: node, outside: Math.max(0, nodeDistance - radius) });
  }
  return candidates;
}

function nearestAttachment(nodes, point, allowedNodeIds) {
  return attachmentCandidates(nodes, point, allowedNodeIds).reduce((best, candidate) => {
    if (!best || candidate.outside < best.outside - .0001) return candidate;
    if (Math.abs(candidate.outside - best.outside) <= .0001 && candidate.distance < best.distance) return candidate;
    return best;
  }, null);
}

function constrainWithAttachment(point, attachment) {
  if (!attachment) return { point: { ...point }, attachment: null };
  const scale = point.scale ?? attachment.scale;
  if (attachment.distance <= attachment.radius || attachment.distance === 0) return { point: { ...point, scale }, attachment };
  const ratio = attachment.radius / attachment.distance;
  return { point: { x: attachment.x + (point.x - attachment.x) * ratio, y: attachment.y + (point.y - attachment.y) * ratio, scale }, attachment };
}

export function constrainToNavigation(nodes, point) {
  if (!nodes?.length) return { ...point };
  return constrainWithAttachment(point, nearestAttachment(nodes, point)).point;
}

export function pointInNavigation(nodes, point) {
  const attachment = nearestAttachment(nodes ?? [], point);
  return Boolean(attachment && attachment.distance <= attachment.radius);
}

export function scaleAtPosition(nodes, point, fallback = 1) {
  if (point?.scale !== undefined) return point.scale;
  return nearestAttachment(nodes ?? [], point ?? { x: 0, y: 0 })?.scale ?? fallback;
}

export function depthAtPosition(nodes, point, fallback = DEFAULT_NAV_DEPTH) {
  if (Number.isFinite(point?.depth)) return point.depth;
  return nearestAttachment(nodes ?? [], point ?? { x: 0, y: 0 })?.depth ?? fallback;
}

export function resolveWalkTarget(nodes, walkTo) {
  if (!walkTo || walkTo.enabled === false) return null;
  const nodeId = walkTo.nodeId ?? walkTo.node;
  if (nodeId) {
    const node = (nodes ?? []).find((candidate) => candidate.id === nodeId);
    return node ? { x: node.x, y: node.y, scale: node.scale ?? 1, facing: walkTo.facing } : null;
  }
  return Number.isFinite(walkTo.x) && Number.isFinite(walkTo.y) ? { x: walkTo.x, y: walkTo.y, scale: walkTo.scale, facing: walkTo.facing } : null;
}

function reachableNodeIds(segments, attachment) {
  const adjacency = new Map();
  for (const { a, b } of segments) {
    if (!adjacency.has(a.id)) adjacency.set(a.id, new Set()); if (!adjacency.has(b.id)) adjacency.set(b.id, new Set());
    adjacency.get(a.id).add(b.id); adjacency.get(b.id).add(a.id);
  }
  const found = new Set(); const queue = [attachment.a.id, attachment.b.id];
  while (queue.length) { const id = queue.shift(); if (found.has(id)) continue; found.add(id); queue.push(...(adjacency.get(id) ?? [])); }
  return found;
}

function addEdge(graph, from, to, cost) {
  if (!graph.has(from)) graph.set(from, []); if (!graph.has(to)) graph.set(to, []);
  graph.get(from).push({ id: to, cost }); graph.get(to).push({ id: from, cost });
}

function addAttachmentEdges(graph, virtualId, attachment) {
  if (attachment.a.id === attachment.b.id) { addEdge(graph, virtualId, attachment.a.id, 0); return; }
  const length = attachment.segment.length;
  addEdge(graph, virtualId, attachment.a.id, attachment.t * length);
  addEdge(graph, virtualId, attachment.b.id, (1 - attachment.t) * length);
}

function shortestGraphPath(graph, startId, targetId) {
  const pending = new Set(graph.keys()); const costs = new Map([[startId, 0]]); const previous = new Map();
  while (pending.size) {
    let current = null; let bestCost = Infinity;
    for (const id of pending) if ((costs.get(id) ?? Infinity) < bestCost) { current = id; bestCost = costs.get(id); }
    if (current === null) break; pending.delete(current); if (current === targetId) break;
    for (const edge of graph.get(current) ?? []) {
      const cost = bestCost + edge.cost; if (cost >= (costs.get(edge.id) ?? Infinity)) continue;
      costs.set(edge.id, cost); previous.set(edge.id, current);
    }
  }
  if (!costs.has(targetId)) return null;
  const path = []; let cursor = targetId;
  while (cursor !== undefined) { path.unshift(cursor); if (cursor === startId) break; cursor = previous.get(cursor); }
  return path[0] === startId ? path : null;
}

function pushWaypoint(path, point) {
  const waypoint = { x: point.x, y: point.y, scale: point.scale ?? 1 }; const previous = path.at(-1);
  if (previous && distance(previous, waypoint) < .001) { previous.scale = waypoint.scale; return; }
  path.push(waypoint);
}

export function findPath(nodes, start, target) {
  if (!nodes?.length) return [{ ...target, scale: target.scale ?? start.scale ?? 1 }];
  const segments = navigationSegments(nodes); const startAttachment = nearestAttachment(nodes, start);
  if (!startAttachment) return [{ ...target, scale: target.scale ?? start.scale ?? 1 }];
  const reachable = reachableNodeIds(segments, startAttachment); const targetAttachment = nearestAttachment(nodes, target, reachable);
  if (!targetAttachment) return [{ x: startAttachment.x, y: startAttachment.y, scale: startAttachment.scale }];
  const constrained = constrainWithAttachment(target, targetAttachment).point;
  const graph = new Map(); const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const segment of segments) addEdge(graph, segment.a.id, segment.b.id, segment.length);
  for (const node of nodes) if (!graph.has(node.id)) graph.set(node.id, []);
  const startId = Symbol("walk-start"); const targetId = Symbol("walk-target");
  addAttachmentEdges(graph, startId, startAttachment); addAttachmentEdges(graph, targetId, targetAttachment);
  if (startAttachment.segment?.key && startAttachment.segment.key === targetAttachment.segment?.key) addEdge(graph, startId, targetId, Math.abs(startAttachment.t - targetAttachment.t) * startAttachment.segment.length);
  if (!startAttachment.segment && startAttachment.a.id === targetAttachment.a.id) addEdge(graph, startId, targetId, 0);
  const graphPath = shortestGraphPath(graph, startId, targetId); const path = [];
  if (distance(start, startAttachment) > .001) pushWaypoint(path, { x: startAttachment.x, y: startAttachment.y, scale: startAttachment.scale });
  if (!graphPath) return path;
  for (const id of graphPath.slice(1, -1)) { const node = byId.get(id); if (node) pushWaypoint(path, node); }
  pushWaypoint(path, { x: targetAttachment.x, y: targetAttachment.y, scale: targetAttachment.scale }); pushWaypoint(path, constrained);
  return path;
}

export function pointInShape(point, shape) {
  if (shape.type === "rectangle") return point.x >= shape.x && point.x <= shape.x + shape.width && point.y >= shape.y && point.y <= shape.y + shape.height;
  if (shape.type === "circle") return Math.hypot(point.x - shape.x, point.y - shape.y) <= shape.radius;
  if (shape.type !== "polygon") return false;
  let inside = false; const points = shape.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]; const [xj, yj] = points[j];
    if ((yi > point.y) !== (yj > point.y) && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
