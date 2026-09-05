// Menace - the bonus pod, from $716c4, $71434 and $70b54.
//
// The pod is paths table ENTRY 0. That entry looked inert when the path VM was
// first run - both its records have x.pos == 0 - but it is a template that
// $716f2 fills in at spawn:
//
//   716de  movea.l $3c898.l,a0   ; table entry 0
//   716e4  st $15(a5)            ; a bonus is out
//   716e8  clr.w $48(a5)         ; type := 0
//   716f2  move.w d1,$4(a0)      ; x into record 0
//   716f6  move.w d2,$6(a0)      ; y into record 0
//
// It also explains why copy.path's cursor wraps to entry 1 and never revisits
// entry 0: entry 0 is not a wave at all.
//
// The spawn position is where an alien died. process.aliens records it as the
// alien's animation runs out ($70b5c clr.w $2(a0) / $70b60 move.w d1,$2a(a5)).
//
// SHOOTING THE POD CYCLES ITS TYPE. $71434 runs when a shot hits while a bonus
// is out: every fifth hit advances the type by one, capped at 6, and writes the
// type into anim.num - so the frame shown IS the type. Seven types, seven
// frames at $69f28. Collect it at the type you want.
//
//   71442  subq.w #1,$4a(a5)   ; five hits per step
//   7144a  move.w #$5,$4a(a5)
//   71454  cmp.w #$6,d1        ; stops at 6, it does not wrap
//   71468  move.b d1,$b(a0)    ; frame := type
//
// Collection is the PF2 collision, gated on $15(a5) - see powerups.js.

export const HITS_PER_STEP = 5;   // $7144a
export const MAX_TYPE = 6;        // $71454
const CYCLE_SFX = 0x113;          // effect $13 on channel 1 ($71438)

import { PathVM, REC } from './paths.js?v=224303';

export class Bonus {
  constructor(level) {
    this.level = level;
    this.vm = new PathVM(level);
    this.active = false;          // $15(a5)
    this.x = 0;
    this.y = 0;
    this.type = 0;                // $48(a5)
    this.hits = HITS_PER_STEP;    // $4a(a5)
    this.deathX = 0;              // $2a(a5)
    this.deathY = 0;              // $2c(a5)
  }

  // $70b60 - an alien finishing its animation records where it died.
  noteDeath(x, y) { this.deathX = x; this.deathY = y; }

  // $716c4 - only if something died since the last pod ($716c8 beq).
  // The pod is a path group, not a static object: $716de takes table entry 0
  // and $716f2/$716f6 write the spawn position into its first record, then it
  // runs through process.aliens like anything else. Treating it as a fixed
  // sprite is why it did not move.
  spawn() {
    if (!this.deathX) return false;
    if (!this.vm.spawnAt(0)) return false;
    const b = this.vm.buf;
    // group + $4 / + $6 are record 0's x.pos / y.pos, and the buffer starts
    // after the size word, so they land at +2 / +4 here.
    b[2] = (this.deathX >> 8) & 0xff; b[3] = this.deathX & 0xff;
    b[4] = (this.deathY >> 8) & 0xff; b[5] = this.deathY & 0xff;
    b[11] = 0;                          // $716fa clr.b $d(a0) - anim.num
    // $716fe/$71700/$71704/$71706 - and without this the pod was gone in two
    // seconds, which is why no powerup ever seemed to appear:
    //
    //   6716fe  lsr.w #1,d2         ; d2 = death y, halved
    //   071700  move.w #$200,d1
    //   071704  or.w d2,d1          ; d1 = $0200 | (y >> 1)
    //   071706  move.w d1,$18(a0)   ; record byte 24 - the script's first
    //                               ;   waypoint, so buf index 22
    //
    // Path coordinates are stored halved ($ec doubles them back), so this is
    // the waypoint "x = 2, y = where it died": the pod drifts LEFT across the
    // whole screen at the height of the kill. Leaving the file's own bytes
    // there ran whatever path group 0 shipped with, which terminated at once.
    b[22] = 0x02;
    b[23] = (this.deathY >> 1) & 0xff;
    this.active = true;
    this.x = this.deathX;
    this.y = this.deathY;
    this.type = 0;
    this.hits = HITS_PER_STEP;
    this.deathX = this.deathY = 0;
    return true;
  }

  // One 25 Hz tick, alongside the wave's own VM.
  tick(shipX, shipY) {
    if (!this.active) return;
    const acts = this.vm.tick(shipX, shipY);
    const live = acts.find((a) => a.x || a.y);
    if (!live) { this.active = false; return; }
    this.x = live.x;
    this.y = live.y;
    // $71468 keeps anim.num equal to the type, so the frame follows it.
    const b = this.vm.buf;
    if (b) b[11] = this.type;
  }

  // A shot connecting with the pod. Returns the effect to play.
  shot() {
    if (!this.active) return null;
    if (--this.hits === 0) {
      this.hits = HITS_PER_STEP;
      if (this.type < MAX_TYPE) this.type++;
    }
    return CYCLE_SFX;
  }

  clear() { this.active = false; }

  // the pod's frame is its type ($71468)
  get frame() { return this.type; }
}
