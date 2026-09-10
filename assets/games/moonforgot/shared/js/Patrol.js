import { findPath, scaleAtPosition } from "./Navigation.js";
import { characterMovementSpeed, movementFacing } from "./Characters.js";

export function createPatrolState(placement, nodes = []) {
  const route = placement.patrol?.nodes ?? [];
  const nearestRouteNode = route.map((id) => nodes.find((node) => node.id === id)).filter(Boolean).reduce((best, node) => !best || Math.hypot(node.x - placement.x, node.y - placement.y) < Math.hypot(best.x - placement.x, best.y - placement.y) ? node : best, null);
  return {
    x: placement.x, y: placement.y, facing: placement.facing ?? "right", scale: scaleAtPosition(nodes, placement, 1),
    path: [], routeIndex: Math.max(0, route.indexOf(nearestRouteNode?.id)), waitRemaining: 0, stopped: false, moving: false, patrolEnabled: placement.patrol?.enabled !== false
  };
}

export function updatePatrolState(state, placement, nodes, character, dt, directionSettings = {}) {
  const patrol = placement.patrol; const route = patrol?.nodes ?? [];
  state.moving = false;
  if (!patrol || state.patrolEnabled === false || route.length < 2 || state.stopped || state.paused) return state;
  if (state.waitRemaining > 0) { state.waitRemaining = Math.max(0, state.waitRemaining - dt); return state; }
  if (!state.path.length) {
    const destination = nodes.find((node) => node.id === route[state.routeIndex]);
    if (!destination) return state;
    state.path = findPath(nodes, state, destination).filter((node, index, path) => index === 0 || Math.hypot(node.x - path[index - 1].x, node.y - path[index - 1].y) > .001);
  }
  const target = state.path[0]; if (!target) return state;
  const dx = target.x - state.x; const dy = target.y - state.y; const distance = Math.hypot(dx, dy); const targetScale = target.scale ?? state.scale ?? 1;
  state.facing = movementFacing({ dx, dy, currentScale: state.scale ?? 1, targetScale, previousFacing: state.facing }, directionSettings);
  const speed = characterMovementSpeed(character, state.facing); const step = Math.min(distance, speed * dt); state.moving = distance > .01;
  state.scale = distance ? state.scale + (targetScale - state.scale) * (step / distance) : targetScale;
  if (distance <= speed * dt) {
    state.x = target.x; state.y = target.y; state.scale = targetScale; state.path.shift();
    if (!state.path.length) {
      state.moving = false; state.waitRemaining = Math.max(0, patrol.wait ?? 1);
      if (state.routeIndex >= route.length - 1 && patrol.loop === false) state.stopped = true;
      else state.routeIndex = (state.routeIndex + 1) % route.length;
    }
  } else { state.x += dx / distance * step; state.y += dy / distance * step; }
  return state;
}
