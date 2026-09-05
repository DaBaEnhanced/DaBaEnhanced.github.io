// Menace - taking damage, from check.collision at $6fd18.
//
// There are two separate pools and they work quite differently.
//
// $62(a5) is a 16-bit SHIELD BIT FIELD, not a counter. A hit shifts it right
// and the bit shifted out decides whether the hit was absorbed:
//
//   6fd52  move.w $62(a5),d2
//   6fd56  move.w $1a6(a5),d1   ; level
//   6fd5a  lsr.w #1,d1          ; level / 2
//   6fd5c  andi.w #$6,d0        ; terrain (PF2) or alien (bit 6)?
//   6fd6e  addq.w #5,d1         ;   terrain shifts 5 more
//   6fd8e  addq.w #3,d1         ;   alien shifts 3 more
//   6fd70  lsr.w d1,d2
//   6fd72  bcs -> absorbed, store the shifted value
//
// So a bigger shift eats more of the field at once, and the field runs out
// after a few hits. The shift grows with the level, so later levels burn
// through the shield faster - a difficulty curve expressed as a shift count.
//
// $42(a5) is ENERGY, and it is only touched once the field is empty:
//
//   6fd96  subq.w #2,$42(a5)
//   6fd9e  bmi -> death
//   6fda2  move.w #$ffff,$62(a5)   ; refill the field
//
// Measured on the running game at level 1 start: energy 128, shield $ffff.
// Powerup type 6 refills energy to $80 ($6feda), which is why it was mislabelled
// "lasers" when the powerup table was first read.
//
// Death stops the music outright ($6fdb4 jsr $5038c) and plays effect $8a on
// all four channels.

// The panel's three bars are three identical counters, and they are AMMO, not
// decoration:
//
//   $3e(a5)  CANNONS  refilled to $80 by $6ff14, spent 2 at a time by $7048a
//   $40(a5)  LASERS   refilled to $80 by $6ff4a, spent 2 at a time by $704c2
//   $42(a5)  SHIELD   refilled to $80 by $6feda, spent 2 at a time by $6fd96
//
// $70328 and $70332 test the counter BEFORE firing, so an empty weapon simply
// does not fire. $719be sets $42 to $80 at level init, which is where the 128
// measured off the running game comes from.
export const START_ENERGY = 0x80;
export const FULL_BAR = 0x80;
export const COST = 2;
export const FULL_SHIELD = 0xffff;
export const ENERGY_PER_HIT = 2;
export const DEATH_SFX = 0x8a;

// A fresh level starts with the two weapon bars EMPTY. $71980 copies the
// carried loadout from $7407c only when $1a0(a5) is set - continuing a game -
// and the fresh path at $719be sets nothing but $42(a5) (energy $80) and
// $62(a5) (the shield). $3e and $40 stay zero, and so do the $e/$f flags that
// gate the weapons they feed, so you start with weapon $8 and nothing else.
//
// There is no timed refill anywhere: $3e and $40 are only ever decremented by 2
// ($7048a, $704c2) or set to $80 by their own powerup ($6ff14, $6ff4a), which
// sets the flag in the same breath. And $71872/$71876 CLEAR both flags when the
// guardian arrives, so the extra weapons do not come to the guardian fight.
export const START_BAR = 0;

export class Damage {
  constructor() {
    this.energy = START_ENERGY;      // $42(a5)
    this.cannons = START_BAR;        // $3e(a5)
    this.lasers = START_BAR;         // $40(a5)
    this.shield = FULL_SHIELD;       // $62(a5), the bit field
    this.dead = false;
  }

  // $70328 / $70332: no ammo, no shot. Returns false when the weapon is empty.
  spend(which) {
    const k = which === 'cannons' ? 'cannons' : 'lasers';
    if (this[k] <= 0) return false;
    this[k] -= COST;                 // $7048a / $704c2
    return true;
  }

  // $6ff14 and $6ff4a fill a WEAPON bar; $6feda fills energy. Two different
  // things, and they had the same name - a second `refill()` further down the
  // class silently replaced this one, so every weapon pod topped up the energy
  // and left its own bar at zero.
  refillBar(which) { this[which] = FULL_BAR; }

  // `clx` is raw CLXDAT; `level` is 0-based; `musicState` is $10(a5);
  // `expert` is $1a8(a5), set by F2 at $71bba.
  //
  // $6fd7c..$6fd8a gates ALIEN damage on difficulty:
  //
  //   6fd7c  cmpi.w #$2,$54(a5)
  //   6fd82  bge $6fd8e          ; take it
  //   6fd86  tst.w $1a8(a5)
  //   6fd8a  beq $70716          ; rookie and not that state -> no damage
  //
  // So on rookie an alien touching the ship costs nothing. Terrain always
  // hurts. Ignoring $1a8 makes both difficulties play like expert, which is
  // the harder one - the sort of difference that reads as "this feels unfair"
  // rather than as a bug.
  //
  // Returns 'absorbed', 'hurt', 'dead', or null when nothing connected.
  // $6fd20, the whole collision handler.
  //
  // The mask $46 splits into two branches, and which playfield each one carries
  // is settled by how the game plays on real hardware rather than by a reading
  // of the CLXDAT table: at rookie the shield falls on ALIEN contact and not on
  // the ground, and the difficulty exemption sits on the bit-6 branch. So
  //
  //   bits 1,2  both sprite pairs vs PF1  -> the ALIENS   (shift level/2 + 5)
  //   bit 6     the front pair vs PF2     -> the TERRAIN  (shift level/2 + 3)
  //
  // and the terrain branch is the one rookie is spared:
  //
  //   6fd7c  cmpi.w #$2,$54(a5) / bge   ; from the guardian phase on it hurts
  //   6fd86  tst.w $1a8(a5) / beq       ; rookie - the ground does nothing
  //
  // `field` is $5e(a5): the force field makes the ship immune to everything
  // ($6fd40), and $6fd48 does the same during guardian state 3.
  hit(clx, level = 0, musicState = 0, expert = false, opts = {}) {
    const bits = clx & 0x46;                 // $6fd28 andi.w #$46,d0
    if (!bits || this.dead) return null;
    if (opts.field) return null;             // $6fd40 tst.w $5e(a5)
    if (musicState === 3) return null;       // $6fd48 cmpi.b #$3,$10(a5)
    if (!(bits & 0x6) && !expert && !opts.guardianPhase) return null;

    // $6fd56/$6fd5a: the shift STARTS at the level number halved.
    let sh = level >> 1;
    if (bits & 0x6) {                        // $6fd5c - an alien
      // $6fd64 only overrides when $10(a5) is NON-zero, which it is once the
      // guardian is on its way. Passing a hardcoded 1 made every touch shift
      // the shield by 8 instead of 5 for the whole level.
      if (musicState !== 0) sh = 3;          // $6fd6c moveq #$3,d1
      sh += 5;                               // $6fd6e
    } else {
      sh += 3;                               // $6fd8e - the terrain
    }

    // lsr.w d1,d2 leaves the LAST bit shifted out in the carry, which is
    // bit (shift - 1) of the value before the shift.
    const carry = sh > 0 ? (this.shield >> (sh - 1)) & 1 : 0;
    this.shield = (this.shield >>> sh) & 0xffff;
    if (carry) return 'absorbed';            // $6fd72 bcs / $6fd92 bcs

    this.energy -= ENERGY_PER_HIT;           // $6fd96
    if (this.energy < 0) { this.dead = true; return 'dead'; }
    this.shield = FULL_SHIELD;               // $6fda2
    return 'hurt';
  }

  refillEnergy() { this.energy = START_ENERGY; }   // powerup type 6, $6feda
}
