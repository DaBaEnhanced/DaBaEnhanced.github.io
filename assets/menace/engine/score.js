// Menace - scoring, from print.score at $718d0.
//
// The score is four bytes of BCD at $96(a5) and pending points are four more
// at $9a(a5). Every pass adds one into the other with `abcd`, adds the same
// amount into a PER-LEVEL total at $1be(a5) + level*4 - the figures the
// end-of-level tally prints - and then clears the pending value:
//
//   718e4  abcd -(a3),-(a4)   x4    ; score += pending
//   71900  abcd -(a3),-(a4)   x4    ; level total += pending
//   71908  clr.l $9a(a5)
//
// BCD matters: the powerup that awards "1000 POINT BONUS" writes $1000, which
// is 1000 read as BCD and 4096 read as binary. Every score value in the game is
// written that way.
//
// Digits are drawn into the panel bitmap itself, not composited over it -
// $71912 adds $68c to $4bac8, which is plane 1, row 6, x 32 - so they OR bit 1
// into whatever the panel already has there.

// Implements $718d0 print.score, its BCD core at $718d8, and the per-level
// totals at $1be(a5).
export const DIGITS = 6;
export const DIRECT_KILL_ROOKIE = 0x0150;
export const DIRECT_KILL_EXPERT = 0x0300;
export const LINKED_KILL = 0x0750;
export const GUARDIAN_PART_ROOKIE = 0x0030;
export const GUARDIAN_PART_EXPERT = 0x0070;

function bcdAdd(a, b) {
  // four BCD bytes, least significant last, with carry - what abcd does
  const out = a.slice();
  let carry = 0;
  for (let i = 3; i >= 0; i--) {
    let lo = (out[i] & 15) + (b[i] & 15) + carry;
    carry = 0;
    if (lo > 9) { lo -= 10; carry = 1; }
    let hi = (out[i] >> 4) + (b[i] >> 4) + carry;
    carry = 0;
    if (hi > 9) { hi -= 10; carry = 1; }
    out[i] = (hi << 4) | lo;
  }
  return out;
}

export class Score {
  constructor(levels = 6) {
    this.score = [0, 0, 0, 0];                 // $96(a5)
    this.pending = [0, 0, 0, 0];               // $9a(a5)
    this.perLevel = Array.from({ length: levels }, () => [0, 0, 0, 0]);
  }

  // Award sites use move.l, so a later award in the same pass REPLACES an
  // earlier pending value. The BCD addition happens only in tick().
  award(bcd) {
    this.pending = [(bcd >>> 24) & 0xff, (bcd >>> 16) & 0xff,
                    (bcd >>> 8) & 0xff, bcd & 0xff];
  }

  // $713b8 writes the difficulty award for the primary victim. Every
  // kills.what companion then writes $750 at $713d4, so one or more linked
  // kills leave $750 pending rather than adding it to the primary award.
  awardKill(expert, linkedKills = 0) {
    this.award(expert ? DIRECT_KILL_EXPERT : DIRECT_KILL_ROOKIE);
    if (linkedKills) this.award(LINKED_KILL);
  }

  // $70a44, reached while a visible sprite-4 guardian part is drawn.
  awardGuardianPart(expert) {
    this.award(expert ? GUARDIAN_PART_EXPERT : GUARDIAN_PART_ROOKIE);
  }

  // $718d0, called once per pass of the odd branch - 25 Hz.
  tick(level) {
    if (!this.pending.some((v) => v)) return false;
    this.score = bcdAdd(this.score, this.pending);
    if (this.perLevel[level])
      this.perLevel[level] = bcdAdd(this.perLevel[level], this.pending);
    this.pending = [0, 0, 0, 0];
    return true;
  }

  // six digits, most significant first ($71918 rol.l #8 then #4 per digit)
  digits() {
    const out = [];
    for (let i = 1; i < 4; i++) {
      out.push((this.score[i] >> 4) & 15, this.score[i] & 15);
    }
    return out.slice(-DIGITS);
  }

  toString() { return this.digits().join(''); }
}
