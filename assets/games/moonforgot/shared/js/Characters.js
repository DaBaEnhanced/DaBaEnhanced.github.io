export const DEFAULT_CHARACTER_STATES = ["idle_left", "idle_right", "idle_front", "idle_back", "walk_left", "walk_right", "walk_front", "walk_back"];

export function characterStateName(moving, facing = "right") {
  const direction = ["left", "right", "front", "back"].includes(facing) ? facing : "right";
  return `${moving ? "walk" : "idle"}_${direction}`;
}

export function movementFacing({ dx = 0, dy = 0, currentScale = 1, targetScale = currentScale, previousFacing = "right" }, settings = {}) {
  const horizontalScore = Math.abs(dx);
  const scaleDelta = targetScale - currentScale;
  // Convert perspective scaling to a screen-space cue before comparing it with
  // lateral travel. The old 720 default made even tiny scale changes dominate.
  const scaleScore = Math.abs(scaleDelta) * (settings.scaleWeight ?? 120);
  const verticalScore = Math.abs(dy) * (settings.verticalWeight ?? .75);
  const depthScore = Math.max(scaleScore, verticalScore);
  const previousWasDepth = previousFacing === "front" || previousFacing === "back";
  const dominance = settings.depthDominance ?? 1.15;
  const hysteresis = settings.directionHysteresis ?? .15;
  const depthThreshold = Math.max(.1, dominance - (previousWasDepth ? hysteresis : 0));
  if (depthScore > horizontalScore * depthThreshold && depthScore > .5) {
    if (scaleScore >= verticalScore && Math.abs(scaleDelta) >= (settings.scaleEpsilon ?? .005)) return scaleDelta < 0 ? "back" : "front";
    if (Math.abs(dy) > .25) return dy < 0 ? "back" : "front";
  }
  if (Math.abs(dx) > .25) return dx < 0 ? "left" : "right";
  if (Math.abs(dy) > .25) return dy < 0 ? "back" : "front";
  return previousFacing;
}

export function characterMovementSpeed(character, facing) {
  const lateralSpeed = Math.max(.01, character?.speed ?? 48);
  return facing === "front" || facing === "back" ? Math.max(.01, character?.depthSpeed ?? lateralSpeed * .7) : lateralSpeed;
}

export function resolveCharacterState(character, requestedState) {
  const states = character?.animations ?? {};
  let stateName = states[requestedState] ? requestedState : states.idle_right ? "idle_right" : Object.keys(states)[0];
  let specification = states[stateName]; let mirrored = false; const visited = new Set();
  while (specification?.mirror) {
    if (visited.has(stateName)) return null;
    visited.add(stateName); mirrored = !mirrored; stateName = specification.mirror; specification = states[stateName];
  }
  return specification ? { stateName, specification, mirrored } : null;
}

export function characterSpriteMetrics(character) {
  const width = Math.max(1, character?.sprite?.width ?? character?.sprite?.frameWidth ?? 48);
  const height = Math.max(1, character?.sprite?.height ?? character?.sprite?.frameHeight ?? 72);
  return { width, height, anchor: { x: character?.anchor?.x ?? width / 2, y: character?.anchor?.y ?? height } };
}

export function characterWorldBounds(character, placement, scale = placement?.scale ?? 1) {
  const { width, height, anchor } = characterSpriteMetrics(character); const bounds = character?.bounds ?? { x: 0, y: 0, width, height };
  return { x: placement.x + (bounds.x - anchor.x) * scale, y: placement.y + (bounds.y - anchor.y) * scale, width: bounds.width * scale, height: bounds.height * scale };
}
