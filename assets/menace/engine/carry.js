// State copied by $71b0c into $7407c and restored by $71980 after the globals
// template is reloaded for the next level. Everything not represented here is
// deliberately level-local.
export function captureCarry({ ship, power, damage, score }) {
  return {
    outriderTop: power.outriders >= 1,      // $4(a5)
    outriderBottom: power.outriders >= 2,   // $5(a5)
    cannonArmed: power.cannons,             // $e(a5)
    laserArmed: power.lasers,               // $f(a5)
    config: ship.config,                    // $1c(a5)
    maxSpeed: ship.maxSpeed,                // $24(a5)
    cannonAmmo: damage.cannons,             // $3e(a5)
    laserAmmo: damage.lasers,               // $40(a5)
    energy: damage.energy,                  // $42(a5)
    score: score.score.slice(),             // $96(a5)
  };
}

export function applyCarry(carry, { ship, power, damage, score }) {
  power.outriders = Number(carry.outriderTop) + Number(carry.outriderBottom);
  power.cannons = !!carry.cannonArmed;
  power.lasers = !!carry.laserArmed;
  ship.config = carry.config;
  ship.maxSpeed = carry.maxSpeed;
  damage.cannons = carry.cannonAmmo;
  damage.lasers = carry.laserAmmo;
  damage.energy = carry.energy;
  // Shield is not in $7407c. The globals template supplies zero on a carried
  // level; only a later pickup can refill the bit field.
  damage.shield = 0;
  damage.dead = false;
  score.score = carry.score.slice();
  // Pending points are also absent from the carry block.
  score.pending = [0, 0, 0, 0];
}
