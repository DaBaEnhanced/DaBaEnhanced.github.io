// Menace - the per-level colour pulse, from levels.code at $7264e.
//
// levels.code dispatches on $1a6(a5) to one routine per level, and every one of
// them is the same shape: ramp one copper colour up, then back down, then stop.
//
//   726f8  tst.b $12(a5) / beq        ; only while armed
//   72700  lea $73b4c(pc),a0          ; the colour to pulse
//   7270c  addi.w #$100,(a0)          ; step
//   72710  cmpi.w #$f00,(a0)          ; upper bound
//   72714  seq $11(a5)                ; reverse at the top
//   7271a  subi.w #$100,(a0)
//   7271e  cmpi.w #$700,(a0)          ; lower bound
//   7272a  clr.b $12(a5)              ; one full cycle, then disarm
//
// $12(a5) is armed by $7138a - the same instruction that sets music state 2
// when the type-3 gatekeeper dies. So the pulse is not decoration: it is the
// game telling the player the guardian is on its way, and it runs exactly once.
//
// The colour and bounds differ per level, and level 5 steps the BLUE nibble
// while the others step red.

// Implements $7264e levels.code and its six per-level branches ($726f8,
// $72730, $727a8, $727e0, $72820, $72858).
// $7264e also runs an alarm, before it reaches the per-level pulse:
//
//   7266c  cmpi.w #$2,$54(a5)   ; only during the guardian's approach
//   72676  tst.w $5091c.l       ; and only while the music is off
//   7268a  subq.w #1,$70(a5)    ; every ten ticks
//   72692  move.w #$a,$70(a5)
//   72698  move.w #$82,d0 / bsr $6fff0   ; effect $82 on ALL FOUR channels
//
// So the silence after the music stops is not silence: a four-channel pulse
// marks the guardian coming in. $6fff0 rather than $6ffe0 is what puts it on
// every voice at once.
export const ALARM_SFX = 0x82;
export const ALARM_PERIOD = 10;

export class Alarm {
  constructor() { this.count = ALARM_PERIOD; this.alt = false; }

  // Returns the effect when it should sound, else null.
  //
  // `busy` is $515c4, the driver's "a sample is still playing" flag, and where
  // it is tested is the whole behaviour:
  //
  //   072680  tst.b $515c4.l / bne $726aa     ; still sounding - do NOTHING
  //   07268a  subq.w #1,$70(a5) / bne $726aa  ; only counts down when free
  //   072692  move.w #$a,$70(a5)
  //
  // The test is BEFORE the countdown, so the ten ticks are ten ticks of
  // SILENCE, not ten ticks of wall clock: the gap starts when the voice ends.
  // Counting down regardless gives one every ten ticks flat, which over the
  // guardian's arrival is eight of them on top of each other instead of four.
  //
  // `$7169e` and the rest of that block sit above $716b0's `not.b $18(a5)`
  // gate, so the timer runs on alternate passes - 12.5 Hz, not 25.
  tick(phase, busy) {
    if (phase !== 2) { this.count = ALARM_PERIOD; this.alt = false; return null; }
    if (busy) return null;                       // $72680
    this.alt = !this.alt;
    if (!this.alt) return null;                  // the alternate pass
    if (--this.count > 0) return null;           // $7268a
    this.count = ALARM_PERIOD;                   // $72692
    return ALARM_SFX;
  }
}

export class LevelEffect {
  constructor(spec) {
    this.spec = spec || null;
    this.armed = false;      // $12(a5)
    this.falling = false;    // $11(a5)
    this.value = null;
  }

  // $71384/$7138a run on EVERY shot-versus-alien hit:
  //
  //   71384  cmpi.b #$3,$a(a0)
  //   7138a  seq $12(a5)
  //
  // so a type-3 hit SETS the flag and anything else CLEARS it. Taking no
  // argument at all - which is what this did - armed it on every hit in the
  // game, and since the ramp settles at `lo` rather than back where it started,
  // one shot at an ordinary enemy left a colour quietly shifted until the next
  // wave's palette load put it back.
  //
  // And the ramp only makes sense against the GUARDIAN palette. Every level's
  // `lo` is the value that colour has once $70718 has loaded it:
  //
  //   level   colour   in the level palette   in the guardian palette   lo
  //     1       12            $8a7                    $700            $700
  //     2       15            $acd                    $755            $755
  //     4       11            $962                    $700            $700
  //     5       10            $641                    $331            $331
  //
  // so during the fight the ramp starts where it ends and the flash leaves the
  // colour exactly where it was. Outside it, $72710's test for EQUALITY with hi
  // can never succeed and the add rolls past $fff instead. `guardian` is
  // $10(a5) being non-zero - the only state in which this terminates.
  //
  // The ramp's own position ($11(a5) and the register) is untouched by the
  // flag, so re-arming mid-flash must not restart it.
  arm(on = true, guardian = true) {
    if (!this.spec || !guardian) return;
    if (!on) { this.armed = false; return; }
    this.armed = true;
  }

  // One pass of levels.code. Mutates the playfield palette in place.
  tick(pal) {
    const s = this.spec;
    if (!s || !this.armed) return false;
    if (this.value === null) this.value = pal[s.colour] & 0xfff;
    if (!this.falling) {
      const next = this.value + s.step;
      this.value = next & 0xfff;
      if (next > 0xfff || this.value >= s.hi) { this.value = s.hi; this.falling = true; }
    } else {
      this.value = (this.value - s.step) & 0xfff;
      if (this.value <= s.lo) {
        this.value = s.lo;
        this.falling = false;
        this.armed = false;               // $7272a - one cycle and done
      }
    }
    pal[s.colour] = this.value;
    return true;
  }
}
