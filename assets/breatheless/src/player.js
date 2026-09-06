// Player state: health, shields, energy, keys, and the damage split.
//
// PlayerHit (Sorgenti/Scores.asm) does not simply subtract from health --
// **75% of the damage goes to shields**, rounded up, capped by whatever shields
// remain; only the rest reaches health. That is why shields feel like more than
// a second health bar: at full shields you take a quarter of the damage.
//
// Keys are Green, Yellow, Red, Blue in that order. Effect entries name one in
// `eff_key` as 1..4, and the pickup subtypes are 4..7, so both index the same
// four flags. A key is CONSUMED when it opens something (SwitchManagement
// clears it after use).

import { PLAYER_EYES_HEIGHT } from './movement.js';

export const KEYS = ['green', 'yellow', 'red', 'blue'];

export const MAX = {
  health: 100, shields: 100, energy: 9999, credits: 99999,  // TMap.i
};

/**
 * InitScores2 (Scores.asm) snapshots the carried state at the start of every
 * level and restores it when a level is replayed after death (`PlayAgain`).
 * Health, shields, energy, credits, score, weapons and the active weapon all
 * carry forward -- but `clr.l GreenKey` means the four KEYS are wiped at every
 * level start, so a key never travels between levels.
 */
export const CARRIED = ['health', 'shields', 'energy', 'credits', 'score',
                        'weapon'];

export function snapshot(p) {
  const s = {};
  for (const k of CARRIED) s[k] = p[k];
  s.weapons = p.weapons.slice();
  return s;
}

export function restore(p, s) {
  if (!s) return;
  for (const k of CARRIED) p[k] = s[k];
  p.weapons = s.weapons.slice();
  p.keys = [false, false, false, false];   // clr.l GreenKey at every level start
}

export function makePlayer(level, hooks = {}) {
  let blk = level.blockAt(Math.floor(level.start.x / 64), Math.floor(level.start.z / 64));
  if (blk < 0) blk = -blk;
  return {
    x: level.start.x, z: level.start.z,
    y: level.B.floorH[blk] + PLAYER_EYES_HEIGHT,
    targetY: level.B.floorH[blk] + PLAYER_EYES_HEIGHT,
    verticalSpeed: 0,
    floorH: level.B.floorH[blk],
    heading: level.start.heading, lookHeight: 0,
    block: blk, falling: false, fallHeight: 0, hurtTimer: 0,
    // InitPlayerPos sets PlayerMoved so the starting block's walk effect runs
    // on the first movement pass, even before the player changes blocks.
    pendingInitialEffect: true,
    health: 100, shields: 100, energy: 1000, credits: 0,     // TMap.i initial values
    score: 0,
    keys: [false, false, false, false],
    // PlayerWeapons: 0 = not owned, 1 = owned, 2 = boosted. Weapons are
    // acquired through CollectWeapon, which the terminal shop drives. Only the
    // first weapon starts owned.
    weapons: [1, 0, 0, 0, 0, 0],
    weapon: 0, speed: 0, dead: false, redFlash: 0,
    yOsc: 0, oscPhase: 0, oscTickAcc: 0, stepLatched: false,
    running: false,          // AccelKey, held in the original, a toggle here
    hooks,

    // Cheats. KIcheat (F9) tops everything up once; these two hold it there.
    // They are the port's own, not the original's, so they are named as such
    // in the HUD and are off unless the player asks.
    godMode: false, infiniteEnergy: false,

    damage(n) {
      if (this.dead || n <= 0 || this.godMode) return;
      // 75% to shields, rounded up, limited by what is left
      let toShield = Math.ceil((n * 3) / 4);
      if (toShield > this.shields) toShield = this.shields;
      this.shields -= toShield;
      const toHealth = n - toShield;
      this.health -= toHealth;
      this.redFlash = 13;                       // RedScreenCont, in 50Hz ticks
      this.hooks.onHurt?.(n, toShield, toHealth);
      if (this.health <= 0) {
        this.health = 0;
        this.dead = true;
        this.hooks.onDeath?.();
      }
    },

    give(what, value) {
      switch (what) {
        case 'health':
          if (this.health >= MAX.health) return false;
          this.health = Math.min(MAX.health, this.health + value); return true;
        case 'shields':
          if (this.shields >= MAX.shields) return false;
          this.shields = Math.min(MAX.shields, this.shields + value); return true;
        case 'energy':
          if (this.energy >= MAX.energy) return false;
          this.energy = Math.min(MAX.energy, this.energy + value); return true;
        case 'credits':
          if (this.credits >= MAX.credits) return false;
          this.credits = Math.min(MAX.credits, this.credits + value); return true;
        default: {
          const k = KEYS.indexOf(what.replace(/^key/, '').toLowerCase());
          if (k < 0 || this.keys[k]) return false;
          this.keys[k] = true;
          return true;
        }
      }
    },

    /** Bitmask in the form the effect machine's `eff_key` expects (1..4). */
    keyMask() {
      return this.keys.reduce((m, held, i) => m | (held ? 1 << i : 0), 0);
    },

    /** CollectWeapon: acquiring a weapon you already have does nothing. */
    collectWeapon(slot) {
      if (slot < 0 || slot >= this.weapons.length) return false;
      if (this.weapons[slot]) return false;
      this.weapons[slot] = 1;
      return true;
    },

    useKey(n) {                                  // eff_key is 1-based
      if (n >= 1 && n <= 4) this.keys[n - 1] = false;
    },

    tick(ticks) {
      // The cheats are held rather than applied once, so a pickup or a
      // terminal purchase cannot leave them half on.
      if (this.godMode) { this.health = 100; this.shields = 100; }
      if (this.infiniteEnergy) this.energy = 1000;
      if (this.redFlash > 0) this.redFlash = Math.max(0, this.redFlash - ticks);
    },
  };
}
