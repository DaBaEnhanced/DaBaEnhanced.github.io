// Weapons, from Sorgenti/Objects.asm:PlayerFire / PlayerShot.
//
// SHOT objects (objtype 4) carry their own stats in the OGLD param bytes, and
// `p7` is the *gun slot* the shot belongs to.  InitObjects builds the lookup:
//     move.b o_param7(a3),d1 ; lea GunObj1(a5),a4 ; move.l a3,(a4,d1.w*4)
// Slots 0-5 are the player's six weapons; 10-14 are the enemy guns, which is
// exactly the range the enemies' own `gun` param (p5) takes.  So an enemy does
// not carry its projectile's damage — it names a gun, and the gun carries it.
//
//   p1 (low byte) damage      p2 base speed      p3 energy cost per shot
//   p5 acceleration           p6 maximum speed   p7 gun slot
//   p8 flamethrower flag      p12 spawn height above the block floor
//
// Player arsenal, in slot order — the progression is unmistakable:
//   0 PFR1 simple shot   dmg  1  energy  1
//   1 PFR2 fireball      dmg  3  energy  2
//   2 PFR3 plasma gun    dmg  9  energy  6
//   3 FLAM flamethrower  dmg  5  energy  1   (continuous)
//   4 PFR4 magnetic gun  dmg 23  energy 10
//   5 PFR5 death machine dmg 72  energy 23

export const PLAYER_GUNS = 6;
const PLAYER_EYES_HEIGHT = 54;          // TMap.i
const SPAWN_AHEAD = 16;          // PlayerShot puts the projectile 16 units out
const BOOST_SPREAD = 8;          // a boosted weapon fires at -8 and +8

/** Index every SHOT definition by its gun slot. */
export function buildGuns(manifest) {
  const guns = new Map();
  for (const [name, def] of Object.entries(manifest?.objects?.entries ?? {})) {
    if (def.objtype !== 'SHOT') continue;
    const p = def.params;
    guns.set(p[6], {
      name, def,
      damage: p[0] & 0xff,
      baseSpeed: p[1],
      energy: p[2],
      accel: p[4],
      maxSpeed: p[5],
      slot: p[6],
      flame: p[7] === 1,
      yOffset: p[11],
    });
  }
  return guns;
}

/**
 * Spawn one projectile. `heading` is in the 2048-unit basis.
 * Returns the shot, or null if there was not enough energy.
 */
export function spawnShot(world, gun, { x, z, floorH, heading, lookNum = 0,
                                        hheading = null, fromPlayer, owner,
                                        carrySpeed = 0, spendEnergy = true,
                                        player }) {
  if (fromPlayer && spendEnergy && player && !player.infiniteEnergy) {
    if (player.energy < gun.energy) return null;      // PFesci2: "weapon empty"
    player.energy -= gun.energy;
  }
  const a = (heading / 2048) * Math.PI * 2;
  const dx = Math.cos(a), dz = Math.sin(a);
  // PlayerShot adds half the player's forward speed to the projectile's base
  const speed = gun.baseSpeed + Math.max(0, carrySpeed) / 2;
  const shot = {
    x: x + dx * SPAWN_AHEAD, z: z + dz * SPAWN_AHEAD,
    y: floorH + gun.yOffset,
    dx, dz,
    // obj_hheading is a SLOPE, not a speed. PlayerShot sets it to
    // `LookHeightNum << 8` (the step=1 scale), and MSloop turns it into a
    // height from the distance travelled so far, not from elapsed time:
    //
    //     move.w obj_hheading(a6),d7
    //     muls.w d5,d7          ; d5 = obj_distance, the TOTAL travelled
    //     add.l  d7,d7          ; x2
    //     swap   d7             ; >>16
    //     add.w  obj_y0(a6),d7  ; y = y0 + hheading*distance/32768
    //
    // The port integrated a per-tick `vy` instead, which makes the climb
    // depend on the projectile's speed: a shot accelerating from 3 to 12 units
    // a tick rose between 3 and 11 times too steeply. Keeping y0 and the slope
    // and recomputing from `travelled` is both correct and self-correcting.
    y0: floorH + gun.yOffset,
    hheading: hheading ?? ((lookNum | 0) << 8),
    speed, accel: gun.accel, maxSpeed: gun.maxSpeed,
    power: gun.damage, gun, travelled: 0,
    // A projectile is an object like any other: it has a body with a radius and
    // a height, it is drawn from its own sprite frames, and it dies at the range
    // its o_param4 gives.  MSctrlobjcoll sums the two radii, so the shot's own
    // width is half of every hit test it takes part in.
    def: gun.def, kind: 'shot',
    width: gun.def.radius, height: gun.def.height,
    range: gun.def.params[3],
    heading, animCount: 0, animAcc: 0, mapOffset: -1,
    blockIllum: 0, blockFog: 0,
    fromPlayer: !!fromPlayer, owner,
  };
  world.shots.push(shot);
  return shot;
}

/**
 * PlayerFire: one press fires once, or twice with a spread if the weapon is
 * boosted. The flamethrower fires continuously while held.
 */
export function playerFire(world, player, { boosted = false } = {}) {
  const gun = world.guns.get(player.weapon ?? 0);
  if (!gun) return false;
  const heading = Math.round((player.heading / (2 * Math.PI)) * 2048) & 2047;
  const common = {
    x: player.x, z: player.z, floorH: player.floorH ?? (player.y - 54),
    lookNum: player.lookHeight ?? 0, fromPlayer: true, owner: player,
    carrySpeed: player.speed ?? 0, player,
  };
  if (boosted && !gun.flame) {
    const a = spawnShot(world, gun, { ...common, heading: (heading - BOOST_SPREAD) & 2047 });
    if (!a) return false;
    // the second barrel is free: PlayerFire passes a6<>0 to skip the energy cost
    spawnShot(world, gun, { ...common, heading: (heading + BOOST_SPREAD) & 2047,
                            spendEnergy: false });
    return true;
  }
  return !!spawnShot(world, gun, { ...common, heading });
}

/**
 * Enemy fire: the enemy names a gun slot, the gun supplies the projectile.
 *
 * EnemiesFire spawns the shot at the ENEMY's own `o_param12` above its block
 * floor -- not the gun's -- and aims by solving for the slope that puts the
 * shot at the player's height once it has flown the distance between them:
 *
 *     d0 = PlayerY - obj_y(enemy) - PLAYER_EYES_HEIGHT
 *     swap d0 / clr.w d0 / asr.l #1,d0     ; d0 * 32768
 *     divs.w d4,d0                         ; / distance
 *
 * so at `travelled == distance` the height gained is exactly that difference.
 * The result is clamped to a signed word, keeping its sign on overflow.
 */
export function enemyFire(world, o, player) {
  const gun = world.guns.get(o.gun);
  if (!gun) return null;
  const dx = player.x - o.x, dz = player.z - o.z;
  const heading = Math.round((Math.atan2(dz, dx) / (2 * Math.PI)) * 2048) & 2047;
  const dist = Math.hypot(dx, dz);
  const rise = player.y - o.y - PLAYER_EYES_HEIGHT;
  let hh = dist > 0 ? Math.trunc((rise * 32768) / dist) : 0;
  if (hh > 32767) hh = 32767; else if (hh < -32767) hh = -32767;   // EFnoovf
  const muzzle = (o.def?.params?.[11] ?? 0);
  return spawnShot(world, gun, {
    x: o.x, z: o.z, floorH: o.y + muzzle - gun.yOffset,
    heading, hheading: hh, fromPlayer: false, owner: o,
  });
}
