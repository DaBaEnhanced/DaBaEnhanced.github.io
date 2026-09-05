// Menace - the level state machine, from $71814 and $713a4.
//
// $10(a5) drives the whole arc of a level, and the three paths table entries
// after the zero are its cast. For level 1 the zero is at index 18:
//
//   index 19  sprite 3, 25 hits   loaded at state 0, with tune 0
//   index 20  sprite 4, 128 hits  loaded at state 2, music stopped - the boss
//   index 21  sprite 3, 20 hits   loaded at $717fa, state $ff
//
// The dispatch:
//
//   71814  tst.b $10(a5)
//   71818  beq $71832     ; state 0 -> tune 0, load index 19, state := 1
//   7181c  cmpi.b #$2,$10(a5)
//   71822  beq $71852     ; state 2 -> load index 20, STOP the music, state := 3
//   71826  cmpi.b #$3,$10(a5)
//   7182c  beq $71dc0     ; state 3 -> tune 2, level complete
//
// State 2 is set in exactly one place, and it is a kill, not a timer:
//
//   713a4  cmpi.b #$3,$a(a0)   ; the object that just died was type 3
//   7138a  seq $12(a5)         ; which also arms levels.code's colour pulse
//   713ae  move.b #$2,$10(a5)
//
// So index 19 puts a type-3 object out at the start of the level; killing it
// silences the music and brings the guardian in. Phase 4 guessed those three
// entries were "guardian, explosion and death" from the data alone - the first
// is really a gatekeeper and the second is the boss.

// Also covers $71dfc's end-of-level branch and $71e7e's advance.
export const S_START = 0, S_PLAYING = 1, S_GUARDIAN_DUE = 2, S_GUARDIAN = 3,
             S_PARKED = 0xff;

// $54(a5) is a separate counter from $10(a5): the level's SCROLL phase, and it
// is what makes a level end instead of scrolling for ever.
//
//   phase 0  normal play. check.path spawns waves ($71710 returns for 1 and 2)
//   phase 1  $705d8 sets it when the map column pointer hits the $ff terminator
//            - the same byte map_columns() scans for
//   phase 2  $6fc86 advances it and $6fc8a loads the guardian palette; from
//            here $70590 makes drawfgnds draw the GUARDIAN rather than
//            foreground columns, revealing it as the scroll continues
//   phase 3  $70692 checks the guardian's column counter has reached 16 - the
//            reveal is complete - and only then does $70708/$70712 advance the
//            phase when pf2scroll hits 8. Keying it on the scroll alone fires
//            within sixteen pixels and skips the whole reveal.
//            $7172a then hands control to the gatekeeper/guardian machine.
//
// Alien damage is also gated on it - $6fd7c takes it only at phase >= 2.
export const PH_PLAY = 0, PH_MAP_END = 1, PH_GUARDIAN_IN = 2, PH_END = 3;

export class LevelPhase {
  constructor(cols) {
    this.cols = cols;
    this.phase = PH_PLAY;
    // $22(a5), the coarse-cell counter. $6fc6a counts it down from $17 and
    // $6fc72 reloads it, clearing $34(a5) - the byte offset PF2 scrolls
    // through. PF2's row is 92 bytes and a line fetches 46, so $34 walks one
    // half of the ring, 0 to 46, and starts over every 24 cells.
    this.c22 = 0x17;
    this.lastCell = null;
    // $56(a5): how many 16px guardian columns have been blitted.
    this.guardStep = 0;
  }

  // Called every frame. `col` is the scroll position in map columns, `cell`
  // the 16-pixel coarse cell index - the work below happens once per cell,
  // which is what $30(a5) reaching a particular value gates in the original.
  step(col, cell) {
    if (this.phase === PH_PLAY && col >= this.cols - 1) {
      // $705c8: the level ends when the column stream hits $ff. It does not
      // wrap, and nothing about it involves killing anything.
      this.phase = PH_MAP_END;             // $705d8 move.w #$1,$54(a5)
      return 'mapEnd';
    }
    if (cell === this.lastCell) return null;
    this.lastCell = cell;
    const wrapped = (--this.c22 <= 0);
    if (wrapped) this.c22 = 0x17;          // $6fc72, and $6fc78 clears $34

    if (this.phase === PH_MAP_END && wrapped) {
      // $6fc7c: on that same wrap, $54 goes 1 -> 2, $70718 loads colours 8-15
      // from $789dc + level*16 into the copper at $73b3a, and $6fc8e switches
      // the shot artwork to bank $1b0.
      this.phase = PH_GUARDIAN_IN;
      this.guardStep = 0;
      return 'guardianPalette';
    }
    if (this.phase === PH_GUARDIAN_IN) {
      this.guardStep++;                    // $706fa addq.w #1,$56(a5)
      // $706fe/$70708: $22 back down to 6 is seventeen cells after the reload,
      // one more than the sixteen columns, and then $54 becomes 3.
      if (this.guardStep >= 17) { this.phase = PH_END; return 'end'; }
    }
    return null;
  }

  // $70692 stops at sixteen; the columns keep scrolling after that.
  get guardCols() { return Math.min(16, this.guardStep); }

  get spawnsWaves() { return this.phase === PH_PLAY; }        // $71710
  get drawsGuardian() { return this.phase >= PH_GUARDIAN_IN; }  // $70590
  // $7266c cmpi.w #$2,$54(a5): the DANGER voice belongs to this phase and only
  // this one - while the guardian is scrolling in, not once the fight starts.
  get warning() { return this.phase === PH_GUARDIAN_IN; }     // $7266c
  get aliensHurt() { return this.phase >= PH_GUARDIAN_IN; }   // $6fd7c
  get scrolls() { return this.phase < PH_END; }               // $6fbec
  get fighting() { return this.phase === PH_END; }            // $71724
}

export class LevelState {
  constructor(level) {
    this.level = level;
    this.state = S_START;
    this.zero = level.pathTable.indexOf(-1);   // the gap in the table
    this.tune = null;                          // what the music should be doing
    this.spawn = null;                         // a path index to launch, once
    this.pulse = false;                        // $12(a5)
  }

  get gateIndex() { return this.zero + 1; }
  get bossIndex() { return this.zero + 2; }
  get deathIndex() { return this.zero + 3; }

  // Call once per dispatch, as $71814 is. Returns what changed.
  step() {
    if (this.state === S_START) {
      this.state = S_PLAYING;
      this.tune = 0;                           // $7183a moveq #$0,d0
      this.spawn = this.gateIndex;             // $71846
      return 'start';
    }
    if (this.state === S_GUARDIAN_DUE) {
      this.state = S_GUARDIAN;
      this.tune = 'stop';                      // $71868 jsr $5038c
      this.spawn = this.bossIndex;             // $71860
      return 'guardian';
    }
    return null;
  }

  // $713a4: a type-3 object dying is what summons the guardian.
  noteKill(spriteType) {
    if (spriteType !== 3 || this.state !== S_PLAYING) return false;
    this.pulse = true;                         // $7138a seq $12(a5)
    this.state = S_GUARDIAN_DUE;               // $713ae
    return true;
  }

  // $7182c -> $71dc0, which starts tune 2.
  complete() {
    if (this.state !== S_GUARDIAN) return false;
    this.tune = 2;
    return true;
  }

  // $7180a: the gate timeout launches the next group directly and parks the
  // normal 0/2/3 dispatcher at $ff.
  park() { this.state = S_PARKED; this.spawn = null; }
}
