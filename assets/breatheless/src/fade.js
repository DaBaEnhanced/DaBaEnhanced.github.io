// Screen fades, from TMapMain.asm:Fade.
//
// The fade is not a palette ramp. It runs the finished 3D view through the same
// 32-level lighting tables the walls and sprites use, at a level that walks up
// and back down:
//
//     lea LightingTable,a1
//     btst #0,TEtype ; beq Fnofog ; lea 8192(a1),a1   ; fog table instead
//     lea (a1,d0.w),a1                                ; d0 = TransEffect
//     ...
//     Floop1  move.b (a0),d0 ; move.b (a1,d0.w),(a0)+ ; every pixel, remapped
//
// so `TransEffect` is a byte offset into the table -- 0 to 8192 in steps of 256,
// one step per light level, one level per tick (`Canimcounter`, clamped to 32).
// Fading through the normal table darkens to black; through the fog table it
// washes out to grey instead, which is what a teleport uses.
//
// TEdir picks the direction and TEtype carries two flags:
//   bit 0  0 = black fade, 1 = fog fade
//   bit 1  0 = out and back again, 1 = one direction only
//
// The three callers, with the longs they write to TransEffect/TEdir/TEtype:
//   $1f000100  level start   level 31, downward, black    (start black, clear)
//   $04000001  teleport      level  4, upward,   fog, both ways
//   $04000002  level end     level  4, upward,   black, one way (fade to black)
//
// While a fade runs the original sets ProgramState = -1, which freezes the
// world; Fend puts it back to 1 on the way out.

const STEP = 256;                  // one lighting level
const MAX = 8192;                  // 32 levels
const FOG = 8192;                  // the fog table follows the normal one

export class Fade {
  constructor(lighting) {
    this.lighting = lighting;
    this.value = 0;                // TransEffect
    this.dir = 0;                  // TEdir: 0 rises, non-zero falls
    this.type = 0;                 // TEtype
    this.active = false;
    this.tickAcc = 0;
  }

  /**
   * `long` is the value the original writes, e.g. 0x04000001 for a teleport.
   * `freeze` says whether the world stops while it runs -- the teleport sets
   * ProgramState = -1, the level-start fade has that line commented out.
   * `onEnd` fires once the fade has finished, which for a one-directional fade
   * means reaching the far end rather than coming back (TMendfade waits on
   * `cmp.w #8192-256,TransEffect`).
   */
  start(long, { freeze = false, onEnd = null } = {}) {
    this.value = (long >>> 16) & 0xffff;
    this.dir = (long >>> 8) & 0xff;
    this.type = long & 0xff;
    this.active = true;
    this.freeze = freeze;
    this.onEnd = onEnd;
    this.done = false;
    this.tickAcc = 0;
  }

  cancel() { this.active = false; this.value = 0; this.dir = 0; this.tickAcc = 0; }

  /** True while the world should stay frozen (ProgramState = -1). */
  get freezing() { return this.active && this.freeze; }

  /**
   * Advance and apply. Returns true if it wrote to the frame.
   * `ticks` is Canimcounter -- the whole 50ths since the last frame.
   */
  apply(frame, ticks) {
    if (!this.active) return false;
    this.tickAcc += Math.max(0, ticks);
    const wholeTicks = Math.min(32, Math.floor(this.tickAcc));
    this.tickAcc -= wholeTicks;
    const d = wholeTicks * STEP;

    if (d && this.dir) {
      this.value -= d;
      if (this.value <= 0) { this.end(); return false; }
    } else if (d) {
      this.value += d;
      if (this.value >= MAX) {
        this.value = MAX - STEP;
        // bit 1 set: stop at the far end instead of coming back. The screen
        // stays at that level -- black, or fog -- and the caller is told.
        if (this.type & 2) {
          if (!this.done) { this.done = true; this.onEnd?.(); }
        } else {
          this.dir = 1;
        }
      }
    }

    const base = ((this.type & 1) ? FOG : 0) + this.value;
    const lut = this.lighting;
    for (let i = 0; i < frame.length; i++) frame[i] = lut[base + frame[i]];
    return true;
  }

  end() {
    this.value = 0; this.dir = 0; this.active = false; this.tickAcc = 0;
    if (!this.done) { this.done = true; this.onEnd?.(); }
  }
}
