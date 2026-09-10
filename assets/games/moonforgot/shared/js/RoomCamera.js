const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function roomWorldSize(room, viewport) {
  return { width: Math.max(viewport.width, finite(room?.worldWidth, viewport.width)), height: Math.max(viewport.height, finite(room?.worldHeight, viewport.height)) };
}

export function roomCameraSettings(room, viewport) {
  const camera = room?.camera ?? {};
  return { marginX: clamp(finite(camera.marginX, viewport.width * .3), 0, viewport.width / 2), marginY: clamp(finite(camera.marginY, viewport.height * .25), 0, viewport.height / 2), followSpeed: Math.max(0, finite(camera.followSpeed, 8)), focusX: clamp(finite(camera.focusX, .5), 0, 1), focusY: clamp(finite(camera.focusY, .72), 0, 1) };
}

export function clampRoomCamera(camera, room, viewport) {
  const world = roomWorldSize(room, viewport); return { x: clamp(finite(camera?.x, 0), 0, world.width - viewport.width), y: clamp(finite(camera?.y, 0), 0, world.height - viewport.height) };
}

export function snapRoomCamera(room, viewport, target) {
  const settings = roomCameraSettings(room, viewport); return clampRoomCamera({ x: finite(target?.x, 0) - viewport.width * settings.focusX, y: finite(target?.y, 0) - viewport.height * settings.focusY }, room, viewport);
}

// Scene-focus actions use the visual center of the viewport. This deliberately
// differs from player following, whose configurable focus is normally lower so
// more of the room remains visible above the character.
export function snapRoomCameraToFocus(room, viewport, target) {
  return clampRoomCamera({ x: finite(target?.x, 0) - viewport.width / 2, y: finite(target?.y, 0) - viewport.height / 2 }, room, viewport);
}

export function interpolateRoomCamera(from, to, progress) {
  const bounded = clamp(finite(progress, 0), 0, 1); const eased = bounded * bounded * (3 - 2 * bounded);
  return { x: finite(from?.x, 0) + (finite(to?.x, 0) - finite(from?.x, 0)) * eased, y: finite(from?.y, 0) + (finite(to?.y, 0) - finite(from?.y, 0)) * eased };
}

export function updateRoomCamera(camera, room, viewport, target, deltaSeconds) {
  const settings = roomCameraSettings(room, viewport); const current = clampRoomCamera(camera, room, viewport); let x = current.x; let y = current.y;
  if (target.x < current.x + settings.marginX) x = target.x - settings.marginX; else if (target.x > current.x + viewport.width - settings.marginX) x = target.x - viewport.width + settings.marginX;
  if (target.y < current.y + settings.marginY) y = target.y - settings.marginY; else if (target.y > current.y + viewport.height - settings.marginY) y = target.y - viewport.height + settings.marginY;
  const desired = clampRoomCamera({ x, y }, room, viewport); const amount = settings.followSpeed <= 0 ? 1 : Math.min(1, Math.max(0, deltaSeconds) * settings.followSpeed);
  return clampRoomCamera({ x: current.x + (desired.x - current.x) * amount, y: current.y + (desired.y - current.y) * amount }, room, viewport);
}

export function screenToRoom(point, camera) { return { x: point.x + (camera?.x ?? 0), y: point.y + (camera?.y ?? 0) }; }
