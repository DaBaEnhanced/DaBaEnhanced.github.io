// Menace - powerup pickups, from the dispatcher at $6fe88.
//
// Collection is not a separate hit test. $6fe88 is handed CLXDAT and masks it
// with $6 - the two PF2 bits - so a pod is picked up by the same playfield
// collision that kills you on terrain. The difference is $15(a5): set while a
// bonus is present ($716e4), and only then does the collision become a pickup.
//
//   6fe8a  andi.w #$6,d1     ; PF2 collision bits
//   6fe92  tst.b $15(a5)     ; is a bonus out?
//   6fe9a  move.w $48(a5),d1 ; which type
//
// $48(a5) is the type, cleared when a wave spawns ($716e8). Seven cases, which
// is exactly the seven bonus frames at $69f28.
//
// Two of them change $1c(a5), the SHIP CONFIG - the index moveship's sprite
// lookup uses ($70022 mulu.w #$690). So collecting outriders changes the ship's
// artwork; that is the same four configs recovered in Phase 3, not a separate
// attachment drawn on top.
//
// Speed is capped: $6ff68 cmpi.w #$8,$24(a5) skips the speed effect at 8.
// Starting from 2 that is six speedups; a later pod is still consumed by the
// common tail and restores the shield, but adds no speed, sound, or counter.

export const MAX_SPEED = 8;      // $6ff68
export const FIELD_TIME = 0x300; // $6ff92 move.w #$300,$5e(a5)

// type -> what it does and which effect it plays. Effects are the low byte;
// $6fff0 plays one on all four channels.
// The names are the game's own, from the string table at $7447a, and they
// correct three guesses made from the handler order alone. $9a(a5) = $1000 is
// a BCD score of 1000, not a shield; types 1 and 2 are the two weapons, which
// is why they write $1c(a5) - taking a weapon changes the ship's artwork; and
// type 4 is the outrider. "SPEEDUP - MAX X6" and "OUTRIDER- MAX X2" confirm
// the caps found in the code: speed 2 to 8 is six pickups, config +1 and +2 is
// two outriders.
export const TYPES = [
  { n: 0, name: '1000 POINT BONUS',  sfx: 0x80, score: 0x1000 },
  { n: 1, name: 'CANNONS & ENERGY',  sfx: 0x81 },
  { n: 2, name: 'LASERS & ENERGY',   sfx: 0x84 },
  { n: 3, name: 'SPEEDUP - MAX X6',  sfx: 0x87, speed: 1 },
  { n: 4, name: 'OUTRIDER- MAX X2',  sfx: 0x85, outrider: true },
  { n: 5, name: 'FORCE FIELD',       sfx: 0x83, field: FIELD_TIME },
  { n: 6, name: 'FULL SHIELD POWER', sfx: 0x86, energy: true },
];

export class Powerups {
  constructor() {
    this.collected = new Array(TYPES.length).fill(0);  // $1d6..$1db counters
    this.field = 0;                                    // $5e(a5)
    this.cannons = false;              // $e(a5), weapon $9's gate
    this.lasers = false;               // $f(a5), weapon $a's gate
    // $6ffb4 sets $4(a5) and $6ffc4 sets $5(a5) - two separate pickups,
    // the top pod then the bottom one. They gate weapons $b and $c and
    // decide which of the two outrider frames $7020a draws.
    this.outriders = 0;
    this.onEnergy = null;       // set by the caller to refill $42(a5)
    this.onShield = null;       // and $62(a5), which $6ffd8 does for every pod
    this.onRefill = null;       // and $3e / $40, the weapon bars
  }

  // $71872/$71876, reached when the guardian is summoned: both weapon
  // flags are cleared. The bars keep whatever is left in them, but
  // nothing can fire from them until the next pickup.
  disarmForGuardian() { this.cannons = false; this.lasers = false; }

  // Collection and effect are separate outcomes. In particular, a speed pod
  // at the cap skips its counter and sound but still reaches $6ffc8's common
  // tail: it restores the shield and the pod is consumed.
  collect(type, ship) {
    const t = TYPES[type];
    if (!t) return { consumed: false, sfx: null };
    if (t.speed) {
      // $6ff68 branches around the speed change, sound and counter, but not
      // around the shared shield/consume tail at $6ffc8.
      if (ship.maxSpeed >= MAX_SPEED) {
        if (this.onShield) this.onShield();
        return { consumed: true, sfx: null };
      }
      ship.maxSpeed += t.speed;
    }
    if (t.field) this.field = t.field;
    if (t.outrider) this.outriders = Math.min(2, this.outriders + 1);
    // A weapon pod does one of TWO things, and which one depends on whether you
    // already have the weapon:
    //
    //   6ff08  tst.b $e(a5) / beq $6ff22
    //   6ff14  move.w #$80,$3e(a5) / bsr $71884   ; already owned - fill the bar
    //   6ff22  st $e(a5) / addq.b #1,$1c(a5)      ; first one - arm it, and the
    //   6ff2a  bsr $70022                         ; ship changes shape
    //
    // So the first pod arms the weapon with an EMPTY magazine and the second
    // fills it. The config step is +1 for cannons ($6ff26) and +2 for lasers
    // ($6ff5c), which is how the four ship shapes are reached.
    if (t.n === 1) {
      if (this.cannons) { if (this.onRefill) this.onRefill('cannons'); }
      else { this.cannons = true; ship.config = Math.min(3, ship.config + 1); }
    }
    if (t.n === 2) {
      if (this.lasers) { if (this.onRefill) this.onRefill('lasers'); }
      else { this.lasers = true; ship.config = Math.min(3, ship.config + 2); }
    }
    if (t.energy && this.onEnergy) this.onEnergy();
    // $6ffd8 move.w #$ffff,$62(a5) is on the common tail of EVERY pod handler,
    // so any pickup restores the shield bit field - not just the shield pod.
    // Three touches of the terrain are worth as much as a 1000-point bonus.
    if (this.onShield) this.onShield();
    this.collected[type]++;
    return { consumed: true, sfx: t.sfx };
  }

  // $70060 counts the field down one per frame at 50 Hz, alongside moveship.
  tick() { if (this.field) this.field--; }
}
