import { animationLoopRange } from "../../../shared/js/Assets.js";

export function crossedAnimationFrames(previous, current, frameCount, looping = true, loopStart = 0, loopEnd = frameCount - 1) {
  if (!Number.isInteger(current) || current < 0 || frameCount < 1) return [];
  if (!Number.isInteger(previous) || previous < 0) return [current];
  if (current === previous) return [];
  if (current > previous) return Array.from({ length: current - previous }, (_, index) => previous + index + 1);
  if (!looping) return [current];
  const wrappedStart = Math.max(0, Math.min(frameCount - 1, loopStart)); const wrappedEnd = Math.max(wrappedStart, Math.min(frameCount - 1, loopEnd));
  if (previous < wrappedStart || previous > wrappedEnd || current < wrappedStart || current > wrappedEnd) return [current];
  return [...Array.from({ length: wrappedEnd - previous }, (_, index) => previous + index + 1), ...Array.from({ length: current - wrappedStart + 1 }, (_, index) => wrappedStart + index)];
}

export function resolveAnimationSound(event, overrides = new Map()) {
  const override = event.cue && overrides.has(event.cue) ? overrides.get(event.cue) : undefined;
  if (override !== undefined) return override?.sound ? { sound: override.sound, volume: override.volume ?? event.volume } : null;
  return event.sound ? { sound: event.sound, volume: event.volume } : null;
}

export class AnimationSoundSystem {
  constructor(game) { this.game = game; this.instances = new Map(); }
  update(instanceId, animation, frameIndex) {
    if (!animation || frameIndex < 0) { this.reset(instanceId); return; }
    const previous = this.instances.get(instanceId); const sameAnimation = previous?.animationId === animation.id;
    const range = animationLoopRange(animation); const crossed = crossedAnimationFrames(sameAnimation ? previous.frameIndex : null, frameIndex, animation.frames?.length ?? 0, animation.loop !== false, range.start, range.end);
    this.instances.set(instanceId, { animationId: animation.id, frameIndex });
    if (!(animation.soundEvents?.length && crossed.length)) return;
    const frames = new Set(crossed);
    for (const event of animation.soundEvents) if (frames.has(event.frame ?? 0)) {
      const resolved = resolveAnimationSound(event, this.game.animationSoundOverrides); if (!resolved) continue;
      Promise.resolve(this.game.audio.playSound(resolved.sound, { volume: resolved.volume ?? 1 })).catch((error) => this.game.handleError?.(error));
    }
  }
  reset(instanceId) { this.instances.delete(instanceId); }
  clear() { this.instances.clear(); }
}
