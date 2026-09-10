export function resolveAssetUrl(source, baseUrl) {
  if (!source) return null;
  return new URL(source, baseUrl).href;
}

export function animationFrameSource(frame) {
  return typeof frame === "string" ? frame : frame?.src ?? frame?.dataUrl ?? null;
}

export function animationLoopRange(animation) {
  const count = animation?.frames?.length ?? 0;
  if (!count) return { start: 0, end: -1, length: 0 };
  const start = Number.isInteger(animation.loopStart) ? Math.max(0, Math.min(count - 1, animation.loopStart)) : 0;
  const end = Number.isInteger(animation.loopEnd) ? Math.max(start, Math.min(count - 1, animation.loopEnd)) : count - 1;
  return { start, end, length: end - start + 1 };
}

export function animationFrameIndex(animation, timeMs, playback = {}) {
  const count = animation?.frames?.length ?? 0;
  if (!count) return -1;
  const fps = animation.fps ?? 8; const frame = Math.max(0, Math.floor(timeMs * fps / 1000));
  const { start, end, length } = animationLoopRange(animation); const looping = playback.looping ?? animation.loop !== false;
  if (looping) return frame < start ? frame : start + (frame - start) % length;
  const changedAt = Number(playback.loopChangedAtMs);
  if ((animation.loop !== false || playback.loopWasEnabled) && Number.isFinite(changedAt) && changedAt > 0) {
    const changedFrame = Math.floor(changedAt * fps / 1000);
    if (changedFrame >= start) {
      const finalLoopFrame = start + (Math.floor((changedFrame - start) / length) + 1) * length - 1;
      if (frame <= finalLoopFrame) return start + (frame - start) % length;
      return Math.min(count - 1, end + frame - finalLoopFrame);
    }
  }
  return Math.min(count - 1, frame);
}

export function animationDurationMs(animation, fallback = 0) {
  const frames = animation?.frames?.length ?? 0; const fps = Number(animation?.fps);
  return frames && fps > 0 ? frames / fps * 1000 : fallback;
}
