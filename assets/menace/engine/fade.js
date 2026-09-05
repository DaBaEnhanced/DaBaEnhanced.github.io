// Menace - the palette fade, from $7238c.
//
// It only ever counts UP. For each colour it compares the current value with
// the target one nibble at a time and increments that nibble if they differ:
//
//   723aa  cmp.w d2,d3 / beq / addq.w #1,d1     ; blue
//   723be  cmp.w d2,d3 / beq / addi.w #$10,d1   ; green
//   723d4  cmp.w d2,d3 / beq / addi.w #$100,d1  ; red
//   723e2  moveq #$1,d5                         ; something changed
//
// There is no downward step and no clamping - a nibble above its target wraps
// around through 15 to reach it, and the increments are applied to the whole
// word so a nibble rolling over carries into the next. Implementing this as a
// signed approach toward the target would look similar most of the time and
// diverge exactly when a colour has to come down.
//
// $7231e drives it: fade the first four colours until nothing changes, then
// snap all 32 ($72348 moveq #$1f,d7). The caller loops on d5, so the fade runs
// as fast as the vblank allows rather than over a fixed number of frames.

// Implements $7238c the fade step, $7231e the driver, $7236a its helper, and
// the $72374 / $72630 / $725f8 / $723f0 wrappers around them.
export function fadeStep(pal, target, count) {
  let changed = false;
  for (let i = 0; i < count; i++) {
    const want = target[i] & 0xfff;
    let cur = pal[i] & 0xfff;
    if (cur === want) continue;
    if ((want & 0x00f) !== (cur & 0x00f)) cur += 0x001;
    if ((want & 0x0f0) !== (cur & 0x0f0)) cur += 0x010;
    if ((want & 0xf00) !== (cur & 0xf00)) cur += 0x100;
    pal[i] = cur & 0xfff;
    changed = true;
  }
  return changed;
}

export class Fade {
  // $7231e fades `lead` colours, then snaps the whole palette.
  constructor(target, lead = 4) {
    this.target = target.slice();
    this.lead = lead;
    this.done = false;
  }

  start(pal) {
    for (let i = 0; i < this.lead; i++) pal[i] = 0;
    this.done = false;
  }

  tick(pal) {
    if (this.done) return false;
    if (!fadeStep(pal, this.target, this.lead)) {
      for (let i = 0; i < this.target.length; i++) pal[i] = this.target[i];
      this.done = true;                    // $72344 - snap the rest
      return false;
    }
    return true;
  }
}
