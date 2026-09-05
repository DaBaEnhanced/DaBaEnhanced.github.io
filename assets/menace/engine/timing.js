// Browser animation callbacks are only a wake-up source.  Menace itself runs
// on a 50 Hz clock, so elapsed wall time is converted to a bounded number of
// 20 ms simulation steps before any game state is touched.
export const STEP_MS = 20;
export const MAX_STEPS_PER_FRAME = 5;

export class FrameClock {
  constructor(now = 0, stepMs = STEP_MS, maxSteps = MAX_STEPS_PER_FRAME) {
    this.stepMs = stepMs;
    this.maxSteps = maxSteps;
    this.last = now;
    this.acc = 0;
  }

  reset(now) {
    this.last = now;
    this.acc = 0;
  }

  advance(now) {
    let elapsed = now - this.last;
    this.last = now;
    if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = 0;

    // Never replay more than a small scheduling hiccup.  In particular, a
    // suspended background tab must not turn minutes of absence into minutes
    // of game updates on its first visible callback.
    const budget = this.stepMs * this.maxSteps;
    this.acc = Math.min(this.acc + elapsed, budget);
    const steps = Math.floor(this.acc / this.stepMs);
    this.acc -= steps * this.stepMs;
    return steps;
  }
}
