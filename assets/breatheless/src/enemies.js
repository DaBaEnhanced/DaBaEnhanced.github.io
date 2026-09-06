// Enemies, projectiles and pickups, from Sorgenti/Objects.asm:AnimateObjects.
//
// The 12 per-object `param` bytes in the OGLD are typed by objtype; the mapping
// is in TMapMain.asm:InitObjects and is not guessable from the data alone:
//
//   ENEMY (2)      p1 attack distance (used squared)   p2 score value
//                  p3 strength (hit points)            p5 gun index
//                  p7 power (contact damage)           p8 speed
//                  p9 attack probability               p10 subtype (bit flags)
//   PICKTHING (3)  p1 subtype  p2 value
//                  subtype 0 health, 1 shields, 2 energy, 3 credits,
//                          4 green key, 5 yellow key, 6 red key, 7 blue key
//
// The parameter reading is corroborated by the data: p3 orders exactly by enemy
// toughness (Cyborg 1 = 6 ... Giant Alien = 640) and p2 by score value.
//
// Enemy heading uses the same basis as the player: 2048 units per turn,
// direction = (cos, sin), 0 = +X.  The AI ticks at 25Hz (`and.b #1,d0` in
// AOMainLoop), half the render rate.

import { MAP_SIZE, BLOCK_SIZE } from './level.js';
import { PLAYER_WIDTH } from './movement.js';
import { buildGuns, playerFire, enemyFire } from './weapons.js';

const MAX_ENEMY_DIST = 20 * BLOCK_SIZE;             // TMap.i, beyond this enemies idle
const MAX_ENEMY_DIST_SQ = MAX_ENEMY_DIST * MAX_ENEMY_DIST;
const TURN = 256;                                   // one octant of 2048
const ENEMY_MAX_RISE = 24;

// Death animation (DestroyEnemy / CEDcaduta). The fall runs frames 42..44 and
// settles on 129, the body on the ground. An enemy has no fall animation when
// frame 41 equals frame 42 -- "ultimo frame fire = primo frame caduta?" -- and
// those simply explode. 7 of the 12 enemies fall; 5 do not.
const FALL_FIRST = 42, FALL_LAST = 44, CORPSE_FRAME = 129;
const FALL_DELAY = 8;                               // obj_cont1 between frames
const ANIM_TICKS = 4;                               // animstep: Canimcounter >> 2
// WALKANIM (Objects.asm:106) is `animcont = (VBTimer & $1c) >> 2`: a single
// global 0..7 counter shared by every walking enemy, not a per-object one.
//
// The 0..7 matters more than the sharing. Each facing owns 16 frame slots but
// only 0..7 are the walk cycle -- four images held two frames each. Slots 8..15
// are padding that repeats the last walk image, EXCEPT in facing 2, where they
// hold the shared poses: frame 40 is the firing pose and 42..44 are the death
// fall. Cycling animCount through all 16 therefore made an enemy walking on one
// particular bearing flash its own death animation, which is exactly what
// "enemies doing the being-hit sprite even if I didn't fire" was.
const WALK_FRAMES = 8;
const FIRE_FRAME = 40;                              // CEDgofire's obj_animcont
const FALL_SPEED = 5;

// obj_status values, from CEDpunlist
export const ST = {
  SEEK: 0, RANDOM: 1, NEWDIR_SEEK: 2, NEWDIR_RANDOM: 3,
  PREP_FIRE: 4, HIT: 5, NEAR_PLAYER: 6,
  FIRE: -1, FALLING: -3,
};

const PICKUP = ['health', 'shields', 'energy', 'credits',
                'keyGreen', 'keyYellow', 'keyRed', 'keyBlue'];

// CollectItem does not return a name, it returns a MESSAGE NUMBER in d0, keyed
// off the same subtype: health 8, shields 9, energy 10, credits 11, and the
// four keys 0 to 3. Keeping that here, beside the names it belongs to, means
// there is one table rather than two that have to agree -- a second lookup
// keyed on the strings had already drifted (it expected `green`, the pickup is
// called `keyGreen`) and every key collected reported ITEM ERROR.
const PICKUP_MESSAGE = [8, 9, 10, 11, 0, 1, 2, 3];

// Explosion objects index themselves by their own param1 (InitObjects builds
// ExplObj[] that way). An enemy names its death explosion in param4, a shot
// names its impact explosion in param9.
const EXPL_SLOT = 0;

/** The unnormalised direction of heading octant n, used by the seek test. */
const OCTANT = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export class World {
  constructor(level, hooks = {}) {
    this.level = level;
    this.hooks = hooks;
    this.rng = 0x1234;
    this.shots = [];
    this.guns = buildGuns(hooks.manifest ?? level.manifest ?? {});
    this.explosions = new Map();
    for (const [name, def] of Object.entries(
        (hooks.manifest ?? level.manifest ?? {})?.objects?.entries ?? {})) {
      if (def.objtype === 'EXPLOSION') this.explosions.set(def.params[EXPL_SLOT], { name, def });
    }
    this.acc = 0;                                   // 25Hz accumulator
    for (const o of level.objs) this.initObject(o);
  }

  rnd(max) {                                        // Objects.asm:Rnd
    this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
    return (this.rng >> 8) % (max + 1);
  }

  initObject(o) {
    const d = o.def;
    if (!d) return;
    o.alive = true;
    o.width = d.radius;
    o.height = d.height;
    const p = d.params;
    if (d.objtype === 'ENEMY') {
      o.kind = 'enemy';
      o.attackDistSq = p[0] * p[0];
      o.score = p[1];
      o.strength = p[2];
      o.gun = p[4];
      o.power = p[6];
      o.enemySpeed = p[7];
      o.speed = p[7];
      o.attackProb = p[8];
      o.subtype = p[9];
      o.status = ST.SEEK;
      o.cont1 = 0x0f; o.cont2 = 4;                  // obj_cont1 = $0f04
      o.rotdir = 0;
      o.playerColl = 0;
      o.attackDelay = this.rnd(64);
      o.inView = false;
      // an enemy with a nonzero trigger tag stays asleep until ActiveEnemy fires
      o.inactive = o.effect || 0;
    } else if (d.objtype === 'PICKTHING') {
      o.kind = 'pickup';
      o.subtype = p[0] & 0xff;
      o.value = p[1];
    } else {
      o.kind = 'thing';
    }
  }

  /** Spawn an explosion sprite; it animates once and disappears. */
  boom(slot, x, z, y) {
    const e = this.explosions.get(slot);
    if (!e) return null;
    const blk = this.blockOf(x, z);
    const o = {
      name: e.name, def: e.def, kind: 'explosion',
      x, z, y, heading: 0, animCount: 0, stopped: true, alive: true,
      blockIllum: this.level.B.illum[blk], blockFog: this.level.B.fog[blk],
      width: e.def.radius, height: e.def.height, timer: 0,
    };
    this.level.objs.push(o);
    return o;
  }

  stepExplosions(ticks) {
    for (let i = this.level.objs.length - 1; i >= 0; i--) {
      const o = this.level.objs[i];
      if (o.kind !== 'explosion') continue;
      o.timer += ticks * 0.5;                     // AnimateObjects runs at 25Hz
      o.animCount = Math.floor(o.timer);
      if (o.animCount < o.def.frames.length) continue;

      // An enemy converted by DEexpl stores its former image in obj_oldimage.
      // The explosion's signed param2 decides what the SAME object becomes at
      // the end: zero vanishes, negative restores enemy frame 128, positive
      // leaves the explosion's final frame. Projectile explosions have no old
      // image and always disappear.
      const leave = (o.def.params[1] << 16) >> 16;
      if (o.oldEnemyDef && leave) {
        o.remains = true;
        o.status = ST.FALLING;
        o.animCount = leave < 0 ? 128 : o.def.frames.length - 1;
        if (leave < 0) {
          o.name = o.oldEnemyName;
          o.def = o.oldEnemyDef;
          o.kind = 'enemy';
        } else {
          o.kind = 'thing';
        }
        delete o.oldEnemyName;
        delete o.oldEnemyDef;
      } else {
        this.level.objs.splice(i, 1);
      }
    }
  }

  /** ActiveEnemy opcode: wake every enemy tagged with this trigger. */
  activate(trigger) {
    let n = 0;
    for (const o of this.level.objs) {
      if (o.kind === 'enemy' && o.alive && o.inactive === trigger) {
        o.inactive = 0; n++;
      }
    }
    return n;
  }

  /** CTRL_OBJ_COLLISION: is one probed cell passable from `fromBlock`? */
  cellOk(o, cx, cz, fromBlock) {
    if (cx < 0 || cz < 0 || cx >= MAP_SIZE || cz >= MAP_SIZE) return false;
    const v = this.level.map[cz * MAP_SIZE + cx];
    if (v <= 0) return false;                       // solid or void
    const B = this.level.B;
    if (B.attrs[v] & 8) return false;               // bl_Attributes bit 3: enemy blocker
    const rise = B.floorH[v] - B.floorH[fromBlock];
    if (Math.abs(rise) > ENEMY_MAX_RISE) return false;
    const lowCeil = Math.min(B.ceilH[v], B.ceilH[fromBlock]);
    const base = rise >= 0 ? B.floorH[v] : B.floorH[fromBlock];
    return lowCeil - base >= o.height;
  }

  /**
   * CT0..CT7 (Objects.asm), selected by the enemy's heading octant. An enemy
   * does not test the single cell it is moving into -- it probes THREE points
   * offset by its own radius, so a body that is wider than it is fast cannot
   * clip a corner. Axis-aligned octants probe the leading edge and both of its
   * corners; diagonal octants probe the two axis neighbours and the diagonal.
   * Probes that land back in the enemy's own cell are skipped, as in the macro.
   */
  canStand(o, nx, nz, fromBlock) {
    const oct = (o.heading >> 8) & 7;
    const [dx, dz] = OCTANT[oct];
    const w = o.width;
    const pts = (dx && dz)
      ? [[nx + dx * w, nz], [nx, nz + dz * w], [nx + dx * w, nz + dz * w]]
      : dx
        ? [[nx + dx * w, nz - w], [nx + dx * w, nz], [nx + dx * w, nz + w]]
        : [[nx - w, nz + dz * w], [nx, nz + dz * w], [nx + w, nz + dz * w]];
    const ownX = Math.floor(o.x / BLOCK_SIZE), ownZ = Math.floor(o.z / BLOCK_SIZE);
    for (const [px, pz] of pts) {
      const cx = Math.floor(px / BLOCK_SIZE), cz = Math.floor(pz / BLOCK_SIZE);
      if (cx === ownX && cz === ownZ) continue;     // CTexit: same cell, no test
      if (!this.cellOk(o, cx, cz, fromBlock)) return false;
    }
    return true;
  }

  /** MNctrlobjcoll: on a cell change, things and enemies already in the
   *  destination force the mover to choose a new direction. */
  destinationHasBlockingObject(mover, cx, cz) {
    return this.level.objs.some((o) => {
      if (o === mover || o.hidden) return false;
      const blocking = !o.remains
        && (o.kind === 'thing' || (o.kind === 'enemy' && o.alive));
      return blocking && Math.floor(o.x / BLOCK_SIZE) === cx
        && Math.floor(o.z / BLOCK_SIZE) === cz;
    });
  }

  /** Turn one octant toward the player (CEDseek / EPangleTable). */
  seekTurn(o, dx, dz) {
    const oct = (o.heading >> 8) & 7;
    const [ox, oz] = OCTANT[oct];
    const cross = ox * dz - oz * dx;                // EPT0..EPT7 in closed form
    if (cross > 0) o.heading = (o.heading + TURN) & 2047;
    else if (cross < 0) o.heading = (o.heading - TURN) & 2047;
  }

  update(ticks, player) {
    this.acc += ticks;
    while (this.acc >= 2) { this.acc -= 2; this.step(player); }   // 25Hz
    this.moveShots(ticks, player);
    this.stepExplosions(ticks);
  }

  /** WALKANIM: the frame every walking enemy is on this tick. */
  walkFrame() {
    return (Math.floor(this.vbTimer ?? 0) >> 2) & (WALK_FRAMES - 1);
  }

  step(player) {
    this.vbTimer = (this.vbTimer ?? 0) + 2;         // step() runs every 2 ticks
    for (const o of this.level.objs) {
      if (o.kind !== 'enemy') continue;
      if (!o.alive) { this.stepFall(o); continue; }
      if (o.inactive) continue;
      this.stepEnemy(o, player);
    }
  }

  /** CEDcaduta: step the fall every FALL_DELAY ticks, then settle as remains. */
  stepFall(o) {
    if (o.remains || o.status !== ST.FALLING) return;
    if (--o.fallTimer > 0) return;
    o.fallTimer = FALL_DELAY;
    const f = o.def.frames;
    const next = o.animCount + 1;
    const ended = o.animCount >= FALL_LAST
      || !f[next] || f[next].src === f[o.animCount].src;
    if (!ended) { o.animCount = next; return; }
    o.animCount = CORPSE_FRAME;
    o.remains = true;      // obj_type 10, moved to the Things list
    // No explosion here: CEDcadutaend settles the body and returns. Only
    // enemies WITHOUT a fall animation take the DEexpl path and explode.
  }

  stepEnemy(o, player) {
    const B = this.level.B;
    let block = this.blockOf(o.x, o.z);

    // proposed position
    const a = (o.heading / 2048) * Math.PI * 2;
    const nx = o.x + Math.cos(a) * o.speed;
    const nz = o.z + Math.sin(a) * o.speed;

    const dx = player.x - nx, dz = player.z - nz;
    const distSq = dx * dx + dz * dz;

    // far-away enemies are not simulated unless they were on screen last frame
    if (!o.inView && distSq > MAX_ENEMY_DIST_SQ) return;
    o.inView = false;

    // --- fire ---
    if (distSq <= o.attackDistSq) {
      if (--o.attackDelay <= 0) {
        if (o.status >= 0) {
          o.status = ST.PREP_FIRE;
          o.cont1 = 1; o.cont2 = 4;
          o.speed = 0;
        }
        o.attackDelay = (this.rnd(o.attackProb) << 2) + o.attackProb + 8;
        return;
      }
    }

    // --- player contact ---
    const hitR = o.width * o.width + 2 * PLAYER_WIDTH * PLAYER_WIDTH;
    if (distSq <= hitR) {
      if (--o.playerColl <= 0) {
        o.playerColl = 10;
        player.damage?.(o.power);
      }
      if (o.subtype & 4) {                          // clings to the player
        o.status = ST.NEAR_PLAYER; o.cont1 = 3; o.cont2 = 1; o.speed = 0;
        return this.chooseDir(o, player);
      }
      return this.blocked(o, player);
    }
    if (o.playerColl > 0) o.playerColl--;

    // --- geometry ---
    const cx = Math.floor(nx / BLOCK_SIZE), cz = Math.floor(nz / BLOCK_SIZE);
    if (!this.cellOk(o, cx, cz, block)) return this.blocked(o, player);
    if (!this.canStand(o, nx, nz, block)) return this.blocked(o, player);
    const nextBlock = this.blockOf(nx, nz);
    const changedCell = cx !== Math.floor(o.x / BLOCK_SIZE)
      || cz !== Math.floor(o.z / BLOCK_SIZE);
    if (changedCell && this.destinationHasBlockingObject(o, cx, cz)) {
      return this.blocked(o, player);
    }

    o.x = nx; o.z = nz;
    o.block = nextBlock;
    o.y = B.floorH[o.block];
    o.blockIllum = B.illum[o.block];
    o.blockFog = B.fog[o.block];

    if (--o.cont1 <= 0) this.chooseDir(o, player);
    // MNnochgdir: a negative status (firing, falling) and status 5 (hit) keep
    // whatever frame they were given; everything else walks.
    if (o.status >= 0 && o.status !== ST.HIT) o.animCount = this.walkFrame();
  }

  /** MNnewdir: a blocked enemy picks a new direction next tick. */
  blocked(o, player) {
    if (o.status > -3) { o.status = ST.NEWDIR_SEEK; o.cont1 = 3; o.cont2 = 1; }
    o.speed = 0;
    if (--o.cont1 <= 0) this.chooseDir(o, player);
  }

  /** ChooseEnemyDir, dispatched on obj_status. */
  chooseDir(o, player) {
    const dx = player.x - o.x, dz = player.z - o.z;
    switch (o.status) {
      case ST.SEEK:
        o.speed = o.enemySpeed; o.cont1 = 15;
        if (--o.cont2 <= 0) { o.cont2 = 2; o.status = ST.RANDOM; return this.randomTurn(o); }
        return this.seekTurn(o, dx, dz);

      case ST.RANDOM:
        o.speed = o.enemySpeed; o.cont1 = 15;
        if (--o.cont2 <= 0) { o.cont2 = 5; o.status = ST.SEEK; return this.seekTurn(o, dx, dz); }
        return this.randomTurn(o);

      case ST.NEWDIR_SEEK:
      case ST.NEWDIR_RANDOM: {
        // keep turning the same way until unstuck (obj_rotdir latches the side)
        if (!o.rotdir) {
          const oct = (o.heading >> 8) & 7;
          const [ox, oz] = OCTANT[oct];
          o.rotdir = (ox * dz - oz * dx) < 0 ? -1 : 1;
        }
        o.heading = (o.heading + o.rotdir * TURN) & 2047;
        o.cont1 = 0x2f; o.cont2 = 5;
        o.status = ST.SEEK;
        o.speed = o.enemySpeed;
        return;
      }

      case ST.PREP_FIRE:
        // CEDgofire. Subtype bit 0 set means the enemy fires on the move; clear
        // means it plants itself and shows the firing pose.
        o.status = ST.FIRE;
        if (o.subtype & 1) { o.cont1 = 1; o.cont2 = 1; }
        else {
          o.animCount = FIRE_FRAME;
          o.cont1 = 10; o.cont2 = 1;               // obj_cont1 = $0a01
          o.speed = 0;
        }
        return;

      case ST.FIRE: {
        // CEDfire: shoot, then pick seek or random and go back to walking.
        this.enemyFire(o, player);
        o.speed = o.enemySpeed;
        const r = this.rnd(2);
        o.status = r;                              // Rnd(2) gives 0, 1 or 2
        if (r === 0) { o.cont1 = 2; o.cont2 = 4; }  // $0204
        else { o.cont1 = 2; o.cont2 = 2; }          // $0202
        o.rotdir = 0;
        o.animCount = this.walkFrame();             // bra CEDwalkanim
        return;
      }

      case ST.HIT: {
        // CEDcolpito: the same shape -- a random new status, then walk again.
        const r = this.rnd(2);
        o.status = r;
        if (r === 0) { o.cont1 = 1; o.cont2 = 4; }  // $0104
        else { o.cont1 = 1; o.cont2 = 2; }          // $0102
        o.speed = o.enemySpeed;
        o.animCount = this.walkFrame();
        return;
      }

      case ST.NEAR_PLAYER:
        o.speed = o.enemySpeed; o.cont1 = 8;
        o.status = ST.SEEK;
        return this.seekTurn(o, dx, dz);

      case ST.FALLING:
        return;                                     // death animation runs itself

      default:
        o.status = ST.SEEK; o.speed = o.enemySpeed; o.cont1 = 15;
    }
  }

  randomTurn(o) {
    const r = this.rnd(32767);
    if (r <= 24576) return;                         // 75% keep going
    o.heading = (o.heading + (r > 28672 ? TURN : -TURN)) & 2047;
  }

  // ---- projectiles ------------------------------------------------------
  enemyFire(o, player) {
    const s = enemyFire(this, o, player);
    if (s) this.hooks.onSound?.('enemyFire', o, s.gun);
    return s;
  }

  /** Player weapon shot; see weapons.js for the gun table. */
  playerFire(player, opts) {
    const ok = playerFire(this, player, opts);
    this.hooks.onSound?.(ok ? 'playerFire' : 'weaponEmpty');
    return ok;
  }

  // `stopReason` records why a projectile ended, purely so a harness can tell a
  // bullet that correctly struck a wall or a step from one that flew through a
  // target it should have hit. Nothing in the game reads it.
  moveShots(ticks, player) {
    const B = this.level.B;
    this.shots = this.shots.filter((s) => {
      if (s.accel && s.speed < s.maxSpeed) {
        s.speed = Math.min(s.maxSpeed, s.speed + s.accel * ticks);
      }
      const step = s.speed * ticks;
      s.x += s.dx * step; s.z += s.dz * step;
      s.travelled += step;
      // MSloop: the height comes from the total distance and the slope, not
      // from a velocity integrated per tick.
      s.y = s.y0 + (s.hheading * s.travelled) / 32768;
      // MSloop: `cmp.w o_param4(a3),d5 / bgt MSstop` -- the range is the gun's
      // own o_param4, from 192 units for the flamethrower to 8192 for PFR5.
      if (s.travelled > s.range) { s.stopReason = 'range'; return false; }
      // Frames advance by animstep, which AnimateObjects derives as one frame
      // per four ticks; numframes wraps back to zero.
      s.animAcc += ticks;
      while (s.animAcc >= ANIM_TICKS) {
        s.animAcc -= ANIM_TICKS;
        if (++s.animCount >= s.def.frames.length) s.animCount = 0;
      }
      const cx = Math.floor(s.x / BLOCK_SIZE), cz = Math.floor(s.z / BLOCK_SIZE);
      if (cx < 0 || cz < 0 || cx >= MAP_SIZE || cz >= MAP_SIZE) {
        s.stopReason = 'edge'; return false;
      }
      const off = cz * MAP_SIZE + cx;
      const v = this.level.map[off];
      if (v <= 0) { s.stopReason = 'wall'; this.impact(s); return false; }
      s.blockIllum = B.illum[v]; s.blockFog = B.fog[v];
      // Order matters, and it is not the obvious one. MSloop does the wall test
      // (CollTestTable2), then the object test, and only reaches the floor and
      // ceiling test at MSnochgbl -- after the collision, and only when the map
      // offset actually changed. Testing the floor first kills a shot on the
      // step an enemy is standing on, one tick before it can hit them.
      if (s.fromPlayer) {
        for (const o of this.level.objs) {
          // MSctrlobjcoll1 rejects obj_type > 2, so scenery (0) and enemies (2)
          // stop a bullet while pickups (3) and explosions (5) do not, and a
          // zero-width object is skipped outright.
          if (o.hidden || !o.width) continue;
          const enemy = o.kind === 'enemy';
          if (!enemy && (o.kind !== 'thing' || o.remains)) continue;
          if (enemy && !o.alive) continue;      // obj_status -3: already falling
          const ex = o.x - s.x, ez = o.z - s.z;
          // `add.w obj_width(a6),d4` -- the test is against the SUM of the two
          // radii, not the target's alone. Using only the enemy's made every
          // gun's hit window between 20% and 60% too small.
          const rr = o.width + s.width;
          if (ex * ex + ez * ez > rr * rr) continue;
          // There is deliberately no vertical test here. Only the enemy-shot
          // path (the one that hits the player) compares heights; MSctrlobjcoll
          // is purely a plan-view distance check, so a shot fired from a ledge
          // still hits a target standing below it.
          s.stopReason = enemy ? 'enemy' : 'scenery';
          this.impact(s);
          if (!enemy) return false;             // scenery just stops the bullet
          const dir = Math.round((Math.atan2(s.dz, s.dx) / (2 * Math.PI)) * 2048) & 2047;
          this.hurtEnemy(o, s.power, dir);
          return false;
        }
      } else {
        // The player's own hit test, from the enemy-shot branch. The doubling
        // of PLAYER_WIDTH^2 is commented out in the original, and obj_width
        // there is the SHOT's, the player contributing only the constant.
        const px = player.x - s.x, pz = player.z - s.z;
        if (px * px + pz * pz <= s.width * s.width + PLAYER_WIDTH * PLAYER_WIDTH) {
          // `move.w PlayerY,d0 / add.w obj_width,d0 / addq.w #3,d0 /
          //  cmp.w d7,d0 / blt MSctrlobjout` -- a shot passing above the
          //  player's head misses.
          if (s.y <= player.y + s.width + 3) {
            s.stopReason = 'player';
            player.damage?.(s.power);
            this.impact(s);
            return false;
          }
        }
      }
      // MSnochgbl: only a block the projectile has just entered gets tested,
      // and `sub.w obj_height(a6),d3` makes a tall projectile clip the ceiling
      // sooner than a short one.
      if (off !== s.mapOffset) {
        s.mapOffset = off;
        if (s.y < B.floorH[v] || s.y > B.ceilH[v] - s.height) {
          s.stopReason = s.y < B.floorH[v] ? 'floor' : 'ceiling';
          this.impact(s); return false;
        }
      }
      return true;
    });
  }

  impact(s) {
    this.boom(s.gun?.def.params[8] ?? 0, s.x, s.z, s.y);
    this.hooks.onImpact?.(s);
  }

  // ---- damage and death -------------------------------------------------
  hurtEnemy(o, amount, killerHeading) {
    if (o.kind !== 'enemy' || !o.alive) return false;
    // `btst #1,obj_subtype` -- set means the enemy shrugs the hit off and keeps
    // moving; clear means it stops dead for a moment. obj_cont1 = $0201.
    if (!(o.subtype & 2)) {
      o.status = ST.HIT; o.cont1 = 2; o.cont2 = 1; o.speed = 0;
    }
    o.strength -= amount;
    if (o.strength > 0) {
      this.hooks.onSound?.('enemyHit', o);
      return false;
    }
    o.alive = false;
    o.stopped = true;      // sprite: index by animCount instead of facing
    this.hooks.onKill?.(o, o.score);

    const f = o.def.frames;
    const hasFall = f[FALL_FIRST] && f[FALL_LAST - 1]
      && f[FALL_FIRST - 1].src !== f[FALL_FIRST].src;
    if (!hasFall) {
      // DEexpl removes this object from the enemy list and inserts that very
      // object into the explosion list. obj_oldimage retains the enemy image
      // so the completed explosion can restore it when param2 is negative.
      const e = this.explosions.get(o.def.params[3]);       // enemy param4
      if (!e) return true;
      o.oldEnemyName = o.name;
      o.oldEnemyDef = o.def;
      o.name = e.name;
      o.def = e.def;
      o.kind = 'explosion';
      o.status = ST.FALLING;
      o.animCount = 0;
      o.timer = 0;
      o.remains = false;
      o.hidden = false;
      return true;
    }
    o.status = ST.FALLING;
    o.animCount = FALL_FIRST;
    o.fallTimer = FALL_DELAY;
    o.speed = FALL_SPEED;                          // it topples the way it was hit
    if (killerHeading !== undefined) o.heading = killerHeading;
    return true;
  }

  // ---- pickups ----------------------------------------------------------
  collectPickups(player) {
    const taken = [];
    for (const o of this.level.objs) {
      if (o.kind !== 'pickup' || !o.alive) continue;
      const dx = player.x - o.x, dz = player.z - o.z;
      // CtrlCollObj uses radius² + 2*PLAYER_WIDTH² and requires a strictly
      // smaller squared distance.
      if (dx * dx + dz * dz >= o.width * o.width + 2 * PLAYER_WIDTH ** 2) continue;
      const what = PICKUP[o.subtype] ?? `subtype${o.subtype}`;
      // CollectItem may reject capped resources and duplicate keys. The object
      // is removed only after the inventory mutation succeeds.
      if (!player.give?.(what, o.value)) continue;
      o.alive = false; o.hidden = true;
      taken.push({ what, value: o.value, obj: o,
                   // Mess12 is the wrong-type warning, which is what an unknown
                   // subtype should genuinely produce.
                   msg: PICKUP_MESSAGE[o.subtype] ?? 12 });
    }
    return taken;
  }

  /** CtrlCollPlayerObj for non-pickup things/enemies. The original does not
   *  push the player out; it adds a quarter-turn that decays on later movement
   *  passes, steering the player around the object. */
  collidePlayerObjects(player) {
    for (const o of this.level.objs) {
      if (o.hidden || !o.width) continue;
      if (o.remains || (o.kind !== 'thing' && !(o.kind === 'enemy' && o.alive))) continue;
      const dx = o.x - player.x, dz = o.z - player.z;
      if (dx * dx + dz * dz >= o.width * o.width + 2 * PLAYER_WIDTH ** 2) continue;
      const moveX = player.moveVectorX ?? Math.cos(player.heading);
      const moveZ = player.moveVectorZ ?? Math.sin(player.heading);
      const cross = dx * moveZ - dz * moveX;
      player.objectTurn = cross >= 0 ? -512 : 512;
      return o;
    }
    return null;
  }

  /** Blocks obstructed by living enemies. The source stores remains separately:
   *  they do not stop a door, and are removed when it finishes closing. */
  occupiedBlocks() {
    const set = new Set();
    for (const o of this.level.objs) {
      if (o.kind !== 'enemy' || !o.alive) continue;
      set.add(o.block ?? this.blockOf(o.x, o.z));
    }
    return set;
  }

  /** RemoveRemains: a fully closed door crushes bodies left on its blocks. */
  removeRemainsOnBlocks(blocks) {
    const occupied = new Set(blocks);
    let removed = 0;
    for (let i = this.level.objs.length - 1; i >= 0; i--) {
      const o = this.level.objs[i];
      if (!o.remains) continue;
      if (!occupied.has(o.block ?? this.blockOf(o.x, o.z))) continue;
      this.level.objs.splice(i, 1);
      removed++;
    }
    return removed;
  }

  blockOf(x, z) {
    const cx = Math.floor(x / BLOCK_SIZE), cz = Math.floor(z / BLOCK_SIZE);
    if (cx < 0 || cz < 0 || cx >= MAP_SIZE || cz >= MAP_SIZE) return 0;
    const v = this.level.map[cz * MAP_SIZE + cx];
    return v < 0 ? -v : v;
  }
}
