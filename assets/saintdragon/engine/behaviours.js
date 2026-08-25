'use strict';
// In the browser engine.js defines these as globals; under Node they have to be
// pulled in explicitly so this file can be exercised by tools/check_fields.js.
if (typeof module !== 'undefined' && typeof INPUT === 'undefined') {
  const E = require('./engine.js');
  for (const k of ['INPUT', 'INPUT_HEADING', 'HEADING_NONE', 'PLAY_AREA', 'DIR_FRAMES',
                   'SCROLL_RATE', 'COLLIDE_DEFAULT', 'COLLIDE_BIAS_X', 'GROUND_SCROLL', 'ENTRY_LEAD', 'ENEMY_POOL',
                   'World', 'GameObject', 'wait', 'waitHard',
                   'clampDirection', 'inputVector', 'resetTrail', 'cos256', 'sin256'])
    if (E[k] !== undefined) global[k] = E[k];
}
// Enemy behaviours transcribed from the disassembly, one generator each.
// Addresses in the comments are the original routines so the two can be
// diffed. See build/alt/enemy_map.json for the full 80-behaviour catalogue.

// $63c8 -- shared by 11 wrapper routines that differ only in launch heading.
// A homing projectile: fly out on the given heading, then steer toward the
// player at up to 6 angle units per step, updating the facing frame.
//
//   $f0(a6) += 1              count this enemy
//   $2a(a5) = $4e40           score value
//   $26(a5) = $200            speed
//   $6416 / $75b2             face and set velocity from the heading
//   wait 15 frames
//   70 x { alive? ; turn <=6 toward player ; reface ; wait 4 }
//   die ; $f0(a6) -= 1 ; terminate
// $63c8 brackets its own lifetime with $f0(a6): addq at $63c8, subq at $640e.
// That is the live-projectile count the $6774 family gates on.
function* homingMissile(o, world, launchAngle) {
  world.projectiles = (world.projectiles || 0) + 1;      // $63c8
  try {
    yield* homingMissileBody(o, world, launchAngle);
  } finally {
    world.projectiles--;                                 // $640e
  }
}

function* homingMissileBody(o, world, launchAngle) {
  world.enemyCount++;
  o.depth = 0x4e40;                  // $2a, from the spawner
  o.scoreAward = 0x4e40;
  o.speed = 0x200;                   // $26; /256 in setVelocity -> 2 px/frame
  o.angle = launchAngle & 0xff;      // the wrapper's parameter, written to $28
  o.faceFromAngle();
  o.setVelocity();
  yield* wait(o, 15);
  for (let i = 0; i < 70; i++) {
    if (!o.alive()) break;
    o.turnTowardPlayer(6);
    o.faceFromAngle();
    yield* wait(o, 4);
  }
  o.die();
  world.enemyCount--;
}

// The eleven wrappers ($635c, $6364, $636c, $6374, $637c, $6384, $638c,
// $6394, $639c, $63a4, $63ac): each writes one constant to $28 and branches
// to $63c8, so they collapse to a parameter table.
const HOMING_LAUNCH = [
  { at: '$635c', angle: 0x8c }, { at: '$6364', angle: 0x88 },
  { at: '$636c', angle: 0x84 }, { at: '$6374', angle: 0xf4 },
  { at: '$637c', angle: 0xf8 }, { at: '$6384', angle: 0xfc },
  { at: '$638c', angle: 0x40 }, { at: '$6394', angle: 0xa0 },
  { at: '$639c', angle: 0xb0 },
];

// A stand-in for the player so the homing maths has a target. The real player
// object is at $13e(a6); its control routine has not been transcribed yet.
// The original reads a digital joystick, so movement is 8-way at a fixed rate
// rather than analogue. This walks a square so the tail's rotation frames can
// be checked against every direction in turn.
// $52a6 sets the player's speed to $200. That one constant gives both the
// movement rate -- 2 px/frame through the sin/cos path, where $7a38 is sin*256
// -- and exactly one trail slot per frame through the <<7 in $5a76.
// Resource 2 idx 0-9 is five vertical tilts in two banks. $5730 maps a normal
// pose to its shooting twin and $5770 maps it back, so the tilt survives the
// bank switch. The ladder runs full-down .. level .. full-up.
const HEAD = {
  down2: 0x0002, down1: 0x0202, level: 0x0402, up1: 0x0602, up2: 0x0802,
};
// $5730 / $5770: the two banks, paired by tilt.
const HEAD_SHOOTING = new Map([
  [0x0002, 0x0a02], [0x0202, 0x0c02], [0x0402, 0x0e02],
  [0x0602, 0x1002], [0x0802, 0x1202],
]);
const HEAD_NORMAL = new Map([...HEAD_SHOOTING].map(([k, v]) => [v, k]));

// $56d6: the tilt transitions, each an inline script for $7c38 terminated by
// $b000. The head animates through the intermediate pose rather than snapping.
const TILT_UP        = [HEAD.up1,   HEAD.up2];    // $56ee, vy < 0
const TILT_DOWN      = [HEAD.down1, HEAD.down2];  // $56fa, vy > 0
const TILT_FROM_UP   = [HEAD.up1,   HEAD.level];  // $570c, levelling out
const TILT_FROM_DOWN = [HEAD.down1, HEAD.level];  // $5718, levelling out

const PLAYER_SPEED = 0x200;
const STEP = 2;

// A stand-in for the player so the homing maths and the trail have a target.
// It walks diagonally and BOUNCES off the play area rather than pushing into
// it: $59cc rewrites the direction bits at an edge, so a patrol that ignores
// the rewrite just buzzes against the boundary. The real control routine has
// not been transcribed; this only has to move plausibly.
//
// $59cc gives no left-hand bound, so the demo adds one of its own.
const DEMO_LEFT = 40;

function* playerStub(o, world) {
  o.speed = PLAYER_SPEED;
  o.depth = 0x4e20;                 // in front of every body segment
  o.setHandle(HEAD.level);          // resource 2 idx 2
  let code = INPUT.RIGHT | INPUT.DOWN;
  o.repeat = 0;
  for (;;) {
    let held = clampDirection(code, o.x, o.y);        // $59cc
    if (o.x <= DEMO_LEFT) held = (held & ~INPUT.LEFT) | INPUT.RIGHT;
    if (held !== code) code = held;                   // bounce, do not fight it

    // $57fe: fire on the press edge, then every FIRE_REPEAT frames held
    o.input = held | INPUT.FIRE;                      // $96(a5); demo holds fire
    if (o.input & INPUT.FIRE) {
      if (!(o.prevInput & INPUT.FIRE)) o.repeat = 0;
      if (--o.repeat <= 0) {
        fire(world, o.x, o.y, world.pickupLevel || 0);
        o.repeat = FIRE_REPEAT;
      }
    }
    o.prevInput = o.input;                            // $98(a5)
    o.dir = held & 0x0f;                              // $a0(a5)

    // $57b4: heading straight from the joystick mask. Velocity is cleared and
    // rebuilt every frame ($57da/$57de), so releasing the stick stops the
    // player dead -- digital movement, no inertia.
    const prevVy = o.vy;                              // $9c(a5) <- $1a(a5)
    o.vx = 0; o.vy = 0;
    const heading = INPUT_HEADING[held & 0x0f];       // $57ee
    o.angle = heading;                                // $28(a5)
    if (heading !== HEADING_NONE) {                   // $57e2 bmi
      o.speed = PLAYER_SPEED;
      o.setVelocity();                                // $75b2
    }

    // $56d6: retilt only when the vertical velocity actually changes, and
    // animate through the intermediate pose rather than snapping.
    if (o.vy !== prevVy) {
      if (o.vy < 0)      o.playFrames(TILT_UP);
      else if (o.vy > 0) o.playFrames(TILT_DOWN);
      else               o.playFrames(prevVy < 0 ? TILT_FROM_UP : TILT_FROM_DOWN);
    }
    // $5722 -> $572c: while firing, swap the pose into the shooting bank.
      o.__invulnerable = false;      // $48 = $ff: projectiles are not shootable
    const swap = (o.input & INPUT.FIRE) ? HEAD_SHOOTING : HEAD_NORMAL;
    const twin = swap.get(o.handle);
    if (twin !== undefined) o.setHandle(twin);

    yield;
  }
}

// Firing, from $57fe / $5826 / $5842.
//
//   $57fe  edge-triggered: fires at once on a fresh press, then auto-repeats
//          every 8 frames while held ($9a(a5), seeded with #$8 at $52c2)
//   $5826  refuses to fire while $174(a6) has reached the per-level limit
//   $5842  plays sound id $48 (72), then fans out by weapon level
//
// Each helper ($58b0..$58d0) just loads an angle offset into d1 and spawns the
// shot routine at $61b0, so the levels collapse to a table of offsets.
const WEAPON = [
  { shots: [0],                 limit: 3  },
  { shots: [-2, 2],             limit: 6  },
  { shots: [-4, 0, 4],          limit: 9  },
  { shots: [-6, -2, 2, 6],      limit: 12 },
  { shots: [-8, -4, 0, 4, 8],   limit: 15 },
];
const FIRE_SOUND = 72;              // $48
const FIRE_SOUND_VOLUME = 0x40 / 0x100; // $5846-$584a: d2=$40
const FIRE_REPEAT = 8;              // frames, $9a(a5)

// $0c24e: the death explosion, called from 70 sites. It offsets to (x-5, y-15)
// and plays an inline script of resource 27 frames 2, 1, 0 -- then opcode 2
// (set flag $76) and opcode 3 (stop).
const EXPLOSION = [0x041b, 0x021b, 0x001b];
const EXPLOSION_DX = -5, EXPLOSION_DY = -15;

function* explosion(o, world, x, y) {
  o.x = x + EXPLOSION_DX;
  o.y = y + EXPLOSION_DY;
  o.depth = ENEMY_DEPTH;
  o.playFrames(EXPLOSION);          // hold 4 per frame, the $7c38 default
  while (o.scriptOn) yield;         // opcode 3 ends it
}

// $0d172 and five siblings: fly straight, curve, then straighten.
//
//   $d19c  clr $92 ; run 100 frames      straight
//   $d1ac  $92 = 2                       turn rate
//   $d1b2  if y >= $5c: neg $92          flip by height
//   $d1be  if vx >= 0:  neg $92          flip by direction
//   $d1c8  run 60 frames                 curving
//   $d1d0  clr $92 ; run 15 then 30      straight again
//
// $d210 applies $92 through $75ae, which is the instruction directly above
// $75b2: it adds the delta to the heading and recomputes velocity. So $92 is a
// per-frame TURN, not a positional offset -- the object arcs.
const CURVE_FLIP_Y = 0x5c;      // $d1b2
const CURVE_ENTRIES = {
  '$0d158': { x: -0x18, y: 0x34, heading: 0x00, preserveX: true },
  '$0d160': { x: -0x18, y: 0x84, heading: 0x00, preserveX: true },
  '$0d166': { x: -0x18, y: 0x5c, heading: 0x00, preserveX: true },
  '$0d172': { x: 0x170, y: 0x34, heading: 0x80, preserveX: true },
  '$0d17a': { x: 0x170, y: 0x84, heading: 0x80, preserveX: true },
  '$0d180': { x: 0x170, y: 0x5c, heading: 0x80, preserveX: true },
};
const CURVE_FRAMES = [0x0821, 0x0a21, 0x0c21, 0x0e21,
                      0x1021, 0x1221, 0x1421, 0x1621,
                      0x1821, 0x1a21, 0x1c21, 0x1e21,
                      0x0021, 0x0221, 0x0421, 0x0621]; // $d232

function* curvingEnemy(o, world, spec) {
  // called from waveEnemy once the object is positioned and moving
  const phases = spec.phases || [];
  let turn = 0;
  for (let i = 0; i < phases.length; i++) {
    const ph = phases[i];
    if (i === 1) {                       // the turn is set between phase 0 and 1
      turn = spec.turnRate || 0;
      if (o.y >= CURVE_FLIP_Y) turn = -turn;      // $d1b2
      if (o.vx < 0) turn = -turn;                 // $d1be-$d1c4
    } else if (i === 2) {
      turn = 0;                          // $d1d0 clears it
      // $89cc clears $16/$1a/$1e/$22 -- velocity AND acceleration. The object
      // comes to a full stop for the two waits, and $d1e8 sets it moving again.
      o.vx = 0; o.vy = 0; o.ax = 0; o.ay = 0;      // $d1d4
    } else if (i > 2) {
      turn = 0;
    }
    for (let f = 0; f <= (ph.frames || 0); f++) {
      if (o.__diesWithOwner && !o.owner) return;   // $9c28, see waveChild
      if (turn && ph.step === '$0d210') {
        o.angle = (o.angle + turn) & 0xff;        // $75ae
        o.setVelocity();                          // $75b2
      }
      if (ph.step === '$0d210')
        o.setHandle(CURVE_FRAMES[((o.angle + 8) & 0xff) >> 4]); // $d21e
      if (o.x + world.leftExtent(o) < -48) return;
      yield;
    }
    // $d1de: an aimed shot sits BETWEEN the 15-frame and the 30-frame wait --
    // the two phases either side of it looked like one pause, so the whole
    // family flew its arc and never fired.
    if (i === 2 && world.spawnAimedShot) world.spawnAimedShot(o);
  }
  o.setVelocity();                       // $d1e8 $d210 puts it back in motion
  o.setHandle(CURVE_FRAMES[((o.angle + 8) & 0xff) >> 4]);
  for (;;) {
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
}

// $09fbe -- a ground gunner. 11 records in stage 1, the largest single
// untranscribed handler.
//
//   $9fbe  y = $6a(a6) - $b        stand on the ground
//   $9fca  $92 = $64 (100)         the pause length
//   $9fdc  hp $40, score 3
//   $9fe8  frame script res 7: 0,1,2,3 then opcode 1 -- a looping walk cycle
//   $9ff0  bsr $8730               lock to the terrain scroll
//   $9ff4  bsr $8240               advance until x <= $150 (336)
//   loop:  $a010 walk, $a04c pause 100, fire via $6774, wait 20
//
// The +-1 nudges to $16 cancel out; the enemy rides the terrain and the timing
// is what matters.
const GUNNER_WALK = [0x0007, 0x0207, 0x0407, 0x0607, 0x9000];  // 0x9000 = loop
// $7d5c(N) runs N+1 frames -- `subq.w #1,(a7); bpl` counts N down to 0 inclusive.
const GUNNER_HOLD = 101;       // $92 = $64, +1
const GUNNER_LONG = 81;        // $a032 moveq #$50, +1
const GUNNER_SHORT = 21;       // $a06e / $a078 moveq #$14, +1
// $a03c: (rand & $1f) + $50 -- the pause between the two halves of the gait
const GUNNER_WAIT = () => ((Math.random() * 32) | 0) + 0x50 + 1;

function* groundGunner(o, world, spec) {
  allocDefaults(o);
  // $9fbe sets the lane, then $9fd8 runs the entry gate before anything else.
  o.x = SPAWN_TEMPLATE.x;
  if (world.ground !== undefined) o.y = world.ground - 0x0b;   // $9fc4
  yield* entryGate(o, world, spec.trigger || 0);               // $8abc

  o.hp = 0x40;                 // $9fdc
  o.scoreAward = 3;            // $9fe2
  o.collides = true;
    o.__invulnerable = false;      // $48 = $ff: projectiles are not shootable
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  // $9fe8 installs [$0007, $b000] -- res 7 frame 0 -- BEFORE $8730 and $8240.
  // The port only called playFrames inside the gait loop below, so the gunner
  // had no sprite while it crossed the gap between the spawn edge and x = 336:
  // it popped into existence at 330 instead of walking in. It also made
  // leftExtent() return 0 here, so the entry offset was computed against no
  // artwork at all.
  o.playFrames([0x0007, 0xb000]);                              // $9fe8
  o.vx = -GROUND_SCROLL;       // $8730
  o.vy = 0;
  o.x += world.leftExtent(o);

  while (o.x > 336) { if (o.done) return; yield; }             // $8240

  // $6774: the shot is refused while live projectiles ($f0) >= 10.
  const fire = () => {
    // $6774: the capped spawn of $6268, which used to increment a counter and
    // fire nothing at all.
    if (world.spawnAimedShot) world.spawnAimedShot(o);
    world.gunnerFired = (world.gunnerFired || 0) + 1;
  };
  const run = function* (n) { for (let i = 0; i < n; i++) { if (o.done) return true; yield; } };

  // The GAIT. $a010 and $a04c each nudge $16 before the walk and put it back
  // after, so the gunner alternates between moving FASTER than the scrolling
  // ground and slower than it -- which is what reads on screen as walking.
  // Base vx is -1 from the terrain lock, so the two halves run at -2 and 0.
  // The port had the waits and the firing but none of this, and flew the
  // gunner at a flat -2 throughout.
  const base = -GROUND_SCROLL;
  for (;;) {
    // $a010: faster for $92 frames, back to base, pause, fire, wait
    o.vx = base - 1;                                           // $a010 subq
    o.playFrames(GUNNER_WALK);
    if (yield* run(GUNNER_HOLD)) return;
    o.scriptOn = false;                                        // $a02a
    o.vx = base;                                               // $a02e addq
    if (yield* run(GUNNER_LONG)) return;
    fire();                                                    // $a038

    // $a04c: the other half, nudged the OTHER way -- stationary on screen
    // while the ground passes beneath it, so it visibly stops before firing.
    if (yield* run(GUNNER_WAIT())) return;                     // $a03c-$a048
    o.vx = base + 1;                                           // $a04c addq
    o.playFrames(GUNNER_WALK);
    if (yield* run(GUNNER_HOLD)) return;
    o.scriptOn = false;                                        // $a066
    o.vx = base;                                               // $a06a subq
    if (yield* run(GUNNER_SHORT)) return;
    fire();                                                    // $a074
    if (yield* run(GUNNER_SHORT)) return;                      // $a078
  }
}

// $09f8e / $09fa2 enter $09fb4 after their mound has passed the entry gate,
// then share the standalone gunner's leftward gait and aimed firing cycle.
function* moundGunner(o, world) {
  o.hp = 0x40;
  o.scoreAward = 3;
  o.collides = true;
  o.__invulnerable = false;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.playFrames([0x0007, 0xb000]);
  o.vx = -GROUND_SCROLL;
  o.vy = 0;

  while (o.x > 336) { if (o.done) return; yield; }
  const shoot = () => {
    if (world.spawnAimedShot) world.spawnAimedShot(o);
    world.gunnerFired = (world.gunnerFired || 0) + 1;
  };
  const run = function* (frames) {
    for (let i = 0; i < frames; i++) { if (o.done) return true; yield; }
    return false;
  };
  const base = -GROUND_SCROLL;
  const walkFrames = o.__addr === '$09f8e' ? 0x37 + 1 : 0x1a + 1; // $92, $7d5c
  for (;;) {
    o.vx = base - 1;
    o.playFrames(GUNNER_WALK);
    if (yield* run(walkFrames)) return;
    o.scriptOn = false;
    o.vx = base;
    if (yield* run(GUNNER_LONG)) return;
    shoot();
    if (yield* run(GUNNER_WAIT())) return;
    o.vx = base + 1;
    o.playFrames(GUNNER_WALK);
    if (yield* run(walkFrames)) return;
    o.scriptOn = false;
    o.vx = base;
    if (yield* run(GUNNER_SHORT)) return;
    shoot();
    if (yield* run(GUNNER_SHORT)) return;
  }
}

// $0ae24 -- 9 records, res 19. Scattered flier that reverses at the left edge.
//   $ae30  y += (rand & $7f) - $40      scatter -64..+63
//   $ae44  50/50 between res19 idx 0 and idx 1
//   $ae58  hp $a0, score 4
//   $ae64  vx = $ffff2000 = -0.875
//   $ae6c  advance until x <= 336
//   $ae8a  each frame: if x <= 0 -> vx = $800, ax = $40 (drift back right)
const SCATTER_HP = 0xa0, SCATTER_SCORE = 4;
const SCATTER_VX = -0.875, SCATTER_REVERSE_VX = 0x800 / 65536, SCATTER_AX = 0x40 / 65536;

function* scatterFlier(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  yield* entryGate(o, world, spec.trigger || 0);
  o.y += ((Math.random() * 128) | 0) - 64;              // $ae30
  o.setHandle(Math.random() < 0.5 ? 0x0013 : 0x0213);   // $ae44
  o.hp = SCATTER_HP; o.scoreAward = SCATTER_SCORE;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = SCATTER_VX; o.vy = 0;
  o.x += world.leftExtent(o);
  while (o.x > 336) { if (o.done) return; yield; }      // $8240
  for (;;) {
    if (o.done) return;
    if (o.x <= 0) {                                     // $ae92
      o.vx = SCATTER_REVERSE_VX;
      o.ax = SCATTER_AX;
    }
    yield;
  }
}

// $0d26a and three siblings -- 29 records between them, res 38. Four lanes,
// four sprites, one shared tail.
//   $d26a/$d276/$d282/$d28e  y = 30 / 80 / 100 / 130, sprite $26/$226/$426/$226
//   $d2b4  vx -= 1
//   $d2b8  death handler $d2f4 -> spawns $cf7c
//   $d2c0  hp $1e0 (480), score 5
//   $d2cc  on stage 5 only: vy = $8000 = 0.5
// $d25e and $d264 are extra entries that decrement vx once more, then branch
// into the $d282 / $d28e lanes.
const HEAVY_LANES = { '$0d26a': [30, 0x0026], '$0d276': [80, 0x0226],
                      '$0d282': [100, 0x0426], '$0d28e': [130, 0x0226],
                      '$0d25e': [100, 0x0426], '$0d264': [130, 0x0226],
                      // $d252 does the same subq as $d25e/$d264 and falls into
                      // $d26a, so it is that lane one pixel faster. It was
                      // absent from both tables, which left it undispatched and
                      // flying at the default speed.
                      '$0d252': [30, 0x0026] };
const HEAVY_EXTRA_VX = { '$0d25e': -1, '$0d264': -1, '$0d252': -1 };

function* heavyFlier(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  const lane = HEAVY_LANES[spec.__addr] || [80, 0x0226];
  o.y = lane[0];
  yield* entryGate(o, world, spec.trigger || 0);
  o.setHandle(lane[1]);                                 // $d2b0
  o.hp = 0x1e0; o.scoreAward = 5;                       // $d2c0 / $d2c6
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__onDeath = (self, wd) => fragmentDeathEffect(wd, self); // $d2b8 -> $d2f4
  o.vx = -1 + (HEAVY_EXTRA_VX[spec.__addr] || 0);      // $d2b4 (+ $d25e/$d264)
  o.vy = (spec.__stage === '5') ? 0.5 : 0;             // $d2d4
  o.x += world.leftExtent(o);
  for (;;) { if (o.done) return; yield; }               // $7d46
}

// $0a4f4 / $0a4fa -- 30 records, res 48. A swooper: it picks a turn direction
// from where it is relative to the player's box, then curves while decelerating.
//   $a4f4  y -= $60   (entry A falls through into B)
//   $a4fa  y += $30
//   $a512  hp $a0, score 6, speed $200
//   $a532  run 51 frames straight
//   $a536  $92 = $10                     turn rate 16
//   $a53c  y > $5c -> neg.b $93 | y == $5c -> clear | y < $5c -> keep
//   $a550  x >= $a8 -> neg.b $93
//   loop:  run 36 ; $26 -= $40 ; turn by $92 via $75ae
// neg.b on the LOW byte turns $10 into $F0, which is -16 mod 256 -- exactly the
// right value in the angle space, so the byte trick is deliberate.
const SWOOP_HP = 0xa0, SWOOP_SCORE = 6;
const SWOOP_TURN = 0x10, SWOOP_STRAIGHT = 51, SWOOP_STEP = 36, SWOOP_DECEL = 0x40;

function spawnThreeShotFormation(world, from) {             // $67a0
  const player = world.player;
  if (!player || (world.projectiles || 0) >= PROJECTILE_POOL) return;
  const base = Math.round(Math.atan2(player.y - from.y, (player.x + 8) - from.x) *
                          256 / (2 * Math.PI)) & 0xff;
  for (const offset of [0, -0x10, 0x10])
    world.spawnChildOf(from, function* (shot, wd) {
      shot.x = from.x; shot.y = from.y;
      yield* boss1FormationShot(shot, wd, (base + offset) & 0xff);
    }, {});
}

function* swooper(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  // three entry points fall through one another: $a4f4 (-$60 then +$30),
  // $a4fa (+$30), and $a500 (no lane change at all).
  // four fall-through entries: $a4dc enters from the LEFT (x = -32, heading 0),
  // $a4f4 (-$60 then +$30), $a4fa (+$30), $a500 (no lane change).
  // $38 bit 0: these three enter from the LEFT edge, so the artwork -- drawn
  // facing left like everything else in a left-scrolling game -- has to be
  // mirrored horizontally or they fly backwards.
  const leftEntry = ['$0a4dc', '$0a4e2', '$0a4d6'].includes(spec.__addr);
  if (leftEntry) o.flipX = true;
  o.y = SPAWN_TEMPLATE.y + (spec.__addr === '$0a4d6' ? -0x60 + 0x30
                          : spec.__addr === '$0a4dc' ? 0x30
                          : spec.__addr === '$0a4e2' ? 0
                          : spec.__addr === '$0a4f4' ? -0x60 + 0x30
                          : spec.__addr === '$0a4fa' ? 0x30 : 0);
  if (leftEntry) { o.x = -32; o.__heading = 0; }        // $a4e2 / $a4e8
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = SWOOP_HP; o.scoreAward = SWOOP_SCORE;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.angle = o.__heading !== undefined ? o.__heading : DEFAULT_HEADING;
  o.speed = 0x200;                           // $a51e
  o.setVelocity();                           // $a524
  o.setHandle(0x0030);                       // $a52c, res 48 index 0
  o.x += world.leftExtent(o);

  for (let i = 0; i <= SWOOP_STRAIGHT; i++) { if (o.done) return; yield; }

  let turn = SWOOP_TURN;                     // $a536
  if (o.y > 0x5c) turn = -turn;              // $a546
  else if (o.y === 0x5c) turn = 0;           // $a54c
  if (o.x >= 0xa8) turn = -turn;             // $a558

  for (let step = 0; step < 3; step++) {
    for (let i = 0; i <= SWOOP_STEP; i++) { if (o.done) return; yield; }
    o.speed = Math.max(0, o.speed - SWOOP_DECEL);   // $a562
    o.angle = (o.angle + turn) & 0xff;              // $75ae
    o.setVelocity();
  }
  o.speed = 0; o.setVelocity();                      // $a58a/$a58e
  o.scriptOn = false;                                // $a592
  for (let i = 0; i <= 0x32; i++) { if (o.done) return; yield; }
  spawnThreeShotFormation(world, o);                 // $a59c -> $67a0
  for (let i = 0; i <= 0x1e; i++) { if (o.done) return; yield; }
  o.speed = 0x100; o.setVelocity();                  // $a5a6/$a5ac
  for (;;) { if (o.done) return; yield; }
}

// $0af7c / $0af98 -- 25 records, res 16. A matched ceiling/floor pair.
//   $af7c  y = $68(a6) + $e   ceiling, $92 = +0.5, bset #1,$39 (flipped)
//   $af98  y = $6a(a6) - $e   floor,   $92 = -0.5
//   $afb8  hp $40, score 3
//   $afc4  $16 high word = -1 -> vx = -1.0
// $68 is the ceiling level from the stage descriptor's +$e, the counterpart to
// the ground level at +$10.
const EMPLACE_HP = 0x40, EMPLACE_SCORE = 3, EMPLACE_OFFSET = 0x0e;

function* emplacement(o, world, spec) {
  allocDefaults(o);
  const ceiling = spec.__addr === '$0af7c';
  o.x = SPAWN_TEMPLATE.x;
  o.y = ceiling ? (world.ceiling || 0) + EMPLACE_OFFSET
                : (world.ground || 0) - EMPLACE_OFFSET;
  o.flip = ceiling;                           // $af90 bset #1,$39
  o.step = ceiling ? 0.5 : -0.5;              // $92
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = EMPLACE_HP; o.scoreAward = EMPLACE_SCORE;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = -1; o.vy = 0;                        // $afc4
  o.playFrames([0x0010, 0x0a10, 0x0810, 0x0610, 0x8028,
                0x0410, 0x8032, 0x0210, 0x0010, 0xb000]); // $afca-$aff0
  o.x += world.leftExtent(o);
  while (o.x > 336) { if (o.done) return; yield; }   // $afd2 $8240

  // The whole of this was missing: the port set vx = -1 and then yielded
  // forever, so an emplacement drifted flat across the screen and never fired
  // or lifted off.
  for (let i = 0; i < 0x1e; i++) { if (o.done) return; yield; }   // $afd6, 30
  spawnThreeShotFormation(world, o);                  // $aff2 -> $67a0
  for (let i = 0; i < 0x32; i++) { if (o.done) return; yield; }   // $aff6, 50
  o.ax = -0x800 / 65536;                      // $affc, it accelerates away
  o.vy = o.step;                              // $b004, $1a = $92: it lifts off
  for (;;) { if (o.done) return; yield; }     // $b00a $7d46
}

// $0b638 -- 9 records, res 51. A heavy ground unit.
//   $b644  hp $280 (640), score 5
//   $b650  y = $6a(a6) - $16 (22)
//   $b668  advance until x <= 336, then hold for $c8 (200) frames
// $0b638 uses lane -$16; the $0b58e / $0b5e0 siblings use -$17, and $b58e
// additionally starts at x = -$10 ($b5b2) with $92 = 4.
const B6F6_SCRIPT = [0x0233, 0x0433, 0x0633, 0x0833, 0x0a33, 0x0c33,
                     0x0e33, 0x1033, 0x1233, 0x0033, 0xa000, 0xb000]; // $b6f6

function* res51Walk(o, repeats) {                         // $b68c/$b6c4
  for (let pass = 0; pass < repeats; pass++) {
    o.playFrames(B6F6_SCRIPT);
    o.vx += 2;                                           // $b69a/$b6cc
    yield* waitScript(o);
    o.vx -= 2;                                           // $b6a6/$b6d8
  }
}

function res51Spread(o, world, xOffset) {                 // $b714/$b720
  o.x += xOffset; o.y -= 8;
  for (const heading of [0xa0, 0xb0, 0xc0, 0xd0, 0xe0])
    if (world.spawnProjectile) world.spawnProjectile(o, heading);
  o.y += 8; o.x -= xOffset;
}

function* heavyGround(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  const lane = spec.__addr === '$0b638' ? 0x16 : 0x17;
  o.y = (world.ground || 0) - lane;
  if (spec.__addr === '$0b58e') { o.x = -0x10; o.step = 4; }
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x280; o.scoreAward = 5;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = -GROUND_SCROLL; o.vy = 0;
  o.setHandle(spec.__addr === '$0b58e' ? 0x0233 : 0x0033);
  o.x += world.leftExtent(o);

  if (spec.__addr === '$0b58e') {                       // $b58e-$b5d2
    o.flipX = true;                                      // $b68c $38 = 1
    let repeats = 4;
    for (;;) {
      yield* res51Walk(o, repeats);
      for (let frame = 0; frame < 0x1e; frame++) { if (o.done) return; yield; }
      res51Spread(o, world, -8);
      for (let frame = 0; frame < 0x3c; frame++) { if (o.done) return; yield; }
      repeats = 2;
    }
  }

  while (o.x > 336) { if (o.done) return; yield; }   // $b610/$b668 $8240

  if (spec.__addr === '$0b5e0') {                       // $b614-$b62a
    for (let frame = 0; frame < 0x64; frame++) { if (o.done) return; yield; }
    for (;;) {
      yield* res51Walk(o, 2);
      for (let frame = 0; frame < 0x1e; frame++) { if (o.done) return; yield; }
      res51Spread(o, world, 0);
      for (let frame = 0; frame < 0x3c; frame++) { if (o.done) return; yield; }
    }
  }

  // $b66c: every $c8 frames it fires $b720, the five-way spread
  // ($6394 / $639c / $63a4 / $63ac / $63b4, launched from y - 8).
  for (;;) {                                          // $b66c .. $b67e
    for (let i = 0; i < 0xc8; i++) { if (o.done) return; yield; }   // $b672
    res51Spread(o, world, 0);                                       // $b67a
  }
}

// $0ba0a -- 10 records, res 41 (the stage 3 foreground objects). A ground
// emplacement that releases a stream of its own.
//   $ba0e  y = $6a(a6) + 4          sits on the ground
//   $ba36  $44 = $7d06              collidable, death handler $6772
//   $ba54  x += 8
//   $ba6e  11 x $baa2 every $19+1 (26) frames
const BA0A_COUNT = 11, BA0A_INTERVAL = 26;
const BAA2_SCRIPT = [0x0018, 0x0218, 0x0418, 0x0618, 0x0818, 0x9000]; // $bae0

function* res41Fling(o, world, x, y) {                 // $0baa2
  allocDefaults(o);
  o.x = x; o.y = y;
  o.depth += 8;                                       // $bab6
  // $80fe copies the terrain-locked parent's vx; $baa2 changes only vy/ax/ay.
  // Starting from zero made the scrolling emitter move left underneath the
  // plane, so the launch looked diagonally backward instead of near-vertical.
  o.vx = -GROUND_SCROLL; o.vy = 2;
  o.ax = 0x100 / 65536;
  o.ay = -0xae0 / 65536;                              // $bac0: $fffff520
  if (o.y >= 0x5c) { o.vy = -o.vy; o.ay = -o.ay; }   // $bad0-$badc
  o.__invulnerable = true;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.playFrames(BAA2_SCRIPT);
  const delay = 0x20 + ((Math.random() * 8) | 0);      // $baf6-$bb02
  for (let frame = 0; frame < delay; frame++) { if (o.done) return; yield; }
  o.ay = 0;
  o.ax = -(0x600 + ((Math.random() * 0x800) | 0)) / 65536; // $bb0a-$bb1c
  o.__invulnerable = false;
  if (world.spawnAimedShot) world.spawnAimedShot(o);  // $bb24
  for (;;) { if (o.done) return; yield; }
}

function* groundEmitter(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  // $b9f2 is the ceiling variant: y = $68(a6) - 4, with flag bit 1 set.
  // $ba0a / $ba0e sit on the ground at +4.
  const ceiling = spec.__addr === '$0b9f2' || spec.__addr === '$0b9ee';
  o.y = ceiling ? (world.ceiling || 0) - 4 : (world.ground || 0) + 4;
  o.flip = ceiling;
  // only $ba0a sets $92 ($ba0a: st $92) -- the others leave it clear, so they
  // never reach the child-emitting loop at $ba6e.
  o.__emits = spec.__addr === '$0ba0a' || spec.__addr === '$0b9ee';
  yield* entryGate(o, world, spec.trigger || 0);
  o.collides = true;                                   // $ba36
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = -GROUND_SCROLL; o.vy = 0;
  o.x += 8;                                            // $ba54
  o.setHandle(world.firstHandleOfResource(41));
  o.x += world.leftExtent(o);
  while (o.x > 336) { if (o.done) return; yield; }     // $8240
  if (!o.__emits) { for (;;) { if (o.done) return; yield; } }   // $ba68 beq
  for (let n = 0; n < BA0A_COUNT; n++) {               // $ba6e
    if (o.done) return;
    if (world.streamBudget > 0) {
      world.streamBudget--;
      const x = o.x, y = o.y;                          // $80fe snapshots position
      const kid = world.spawnChildOf(o, function* (c, wd) {
        try { yield* res41Fling(c, wd, x, y); }
        finally { wd.streamBudget++; }
      }, {});
      kid.__fromStream = false;   // released by its own finally
    }
    for (let i = 0; i <= BA0A_INTERVAL; i++) { if (o.done) return; yield; }
  }
  for (;;) { if (o.done) return; yield; }
}

// $0b978/$0b98a -- the two-slice res41 static base. The field extractor marks
// both entries as ground-relative after following their shared tail, but $b978
// explicitly reads the ceiling line and $b98a explicitly reads the ground.
function* staticBase41(o, world, spec) {
  allocDefaults(o);
  const ground = spec.__addr === '$0b98a';
  o.x = SPAWN_TEMPLATE.x;
  o.y = ground ? (world.ground || 0) - 0x0b
               : (world.ceiling || 0) + 0x0b;             // $b978/$b990
  o.flip = ground;                                         // $b98a: $38 = 2
  o.depth = 0x12c;                                         // $b9d0
  o.setHandle(0x0229);                                     // $b984/$b99c
  o.__invulnerable = true;
  // Keep the left edge outside the canvas while $8abc waits for its trigger.
  // Applying this after the gate exposed half the slice throughout the wait.
  o.x += world.leftExtent(o);
  yield* entryGate(o, world, spec.trigger || 0);
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = -GROUND_SCROLL; o.vy = 0;                         // $b9d6
  while (o.x > 336) { if (o.done) return; yield; }
  for (;;) { if (o.done) return; yield; }
}

// Stage 5 structures and a stage 3 terrain unit.
//
// $0ee74 -- 8 records, res 56. Ground structure, hp $80, score 4.
//   $ee80  y = $6a(a6) - $a
//   script: hold 50, frame 0, hold 4, frames 1,2, setflag, setloop, frames 3,4
const EE74_SCRIPT = [0x8032, 0x0038, 0x8004, 0x0238, 0x0438, 0xa000, 0xc000,
                     0x0638, 0x0838];

function* groundStructure(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = (world.ground || 0) - 0x0a;              // $ee80
  yield* entryGate(o, world, spec.trigger || 0);
  o.x += world.leftExtent(o);
  yield* groundStructureBody(o, world);
}

function* groundStructureBody(o, world) {         // shared $ee8c tail
  o.hp = 0x80; o.scoreAward = 4;                 // $eea4 / $eeaa
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = -GROUND_SCROLL; o.vy = 0;               // $8730
  o.playFrames(EE74_SCRIPT);

  while (o.x > 336) { if (o.done) return; yield; }          // $8240
  if (world.spawnAimedShot) world.spawnAimedShot(o);        // $eeb8 -> $6774
  world.gunnerFired = (world.gunnerFired || 0) + 1;
  // $74cc: hold until the frame script raises $76 (its opcode 2)
  while (o.scriptOn && !o.scriptFlag) { if (o.done) return; yield; }
  o.ax = -0x400 / 65536;                         // $eec2
  o.vy = -0x8000 / 65536;                        // $eeca  it lifts off
  for (;;) { if (o.done) return; yield; }        // $7d46
}

// $8730 -> $873a: lock to the terrain. It reads the scroll parameter block at
// $ccc(a6), takes the longword at +$3e and negates it into $16 -- so this sets
// the HORIZONTAL velocity only. $1a is left holding whatever the wave record
// gave the object, which is what $c31a goes on to test.
function terrainLock(o, world) {
  o.vx = -GROUND_SCROLL;
}

// $74cc: clear $76, then step frames until the frame script raises it again
// (script opcode 2). A hold that lasts exactly as long as the current stretch
// of animation rather than a fixed frame count.
function* waitScript(o) {
  o.scriptFlag = 0;                                  // $74cc clr.w $76
  while (!o.done && o.scriptOn && !o.scriptFlag) yield;
}

// $80fe with a literal routine address: spawn one named child at an offset.
// The wave-record path already does this for spec.children; several handlers
// also do it inline, mid-choreography.
function spawnRoutineChild(o, world, routine, dx, dy, extra) {
  if (!world.childRoutines) return null;
  const cf = world.childRoutines[routine];
  if (!cf) return null;
  const child = { ...cf, __routine: routine,
                  __parentX: o.x + (dx || 0), __parentY: o.y + (dy || 0) };
  if (extra) Object.assign(child, extra);
  return world.spawnChildOf(o, (co, wd) => waveChild(co, wd, child), {});
}

// $0c2fa / $0c2fe -- 13 records, res 26. Terrain-locked, hp $80, score 3.
//   $c2fa  subq.w #1,$92 then falls into $c2fe
//   $c316  bsr $8730          lock to the terrain
//   $c31a  animate only when $1a (vy) is non-zero
const C2FA_SCRIPT = [0x0a1a, 0x0c1a, 0x0e1a, 0x101a, 0x121a, 0xa000,
                     0x8028, 0x141a, 0x8018, 0x161a, 0x181a, 0x1a1a,
                     0x1c1a, 0x1e1a, 0xa000, 0x8028, 0x1c1a, 0x8018,
                     0x1a1a, 0x181a, 0x161a, 0xa000, 0xb000];       // $c320
// $c354: the still variant, used when the object arrives with no vy.
const C354_SCRIPT = [0x8028, 0x001a, 0x8004, 0x021a, 0x041a, 0x061a,
                     0x081a, ...C2FA_SCRIPT];                       // $c354

function* terrainUnitShot(o, world, spec) {                         // $62f2/$633a
  const ceiling = !!spec.__ceiling;                                // inherited $92
  let heading;
  if (spec.__routine === '$062f2') {
    o.y += 4;                                                      // $6306
    heading = 0x76;                                                // $630a
  } else {
    o.x += 4;                                                      // $633a
    o.y += ceiling ? 4 : -4;                                      // $6344/$6350
    heading = ceiling ? 0x30 : 0xd0;                               // $6348/$6354
  }
  yield* homingMissile(o, world, heading);                          // $63c8
}

function* terrainUnit(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = SPAWN_TEMPLATE.y;      // no explicit lane: the $825e template supplies it
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x80; o.scoreAward = 3;                 // $c30a / $c310
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  terrainLock(o, world);                         // $8730 -- vx only, vy survives
  // $c31a tst.l $1a: the two frame scripts are chosen on the entry velocity.
  o.playFrames(o.vy !== 0 ? C2FA_SCRIPT : C354_SCRIPT);

  // $c394: $92 tells the two entry points apart. $0c2fa decrements it so it is
  // non-zero and the structure hangs from the CEILING, mirrored; $0c2fe leaves
  // it at zero and the structure stands on the ground. One routine, both banks.
  const ceilingVariant = spec.__addr === '$0c2fa';
  o.flip = ceilingVariant;
  if (ceilingVariant) {
    o.y = (world.ceiling !== undefined ? world.ceiling : 0) + 0xa;   // $c39a
  } else {
    o.y = (world.ground !== undefined ? world.ground : 182) - 0xa;   // $c3ae
  }
  o.y -= o.vy * 16;                              // $c3ba  asl.l #4 then subtract
  o.x += world.leftExtent(o);

  // $50 is the OFF-SCREEN handler, not a hide flag. $07ddc skips the bounds
  // check when its high byte is $ff, and $08060 calls it once the object leaves
  // the play area ($7d40 by default). So `$50 = $ff` means "do not cull me" and
  // `clr.b $50` puts culling back. Reading it as "invisible" is what made these
  // objects pop into existence part way across the screen.
  o.__noCull = true;                             // $c3c4 $50 = $ff
  for (let i = 0; i <= 0x10; i++) { if (o.done) return; yield; }     // $c3ca
  o.vy = 0;                                      // $c3d0 clr.l $1a, it settles
  yield* waitScript(o);                          // $c3d4
  if (o.done) return;
  for (let i = 0; i <= 0x1e; i++) { if (o.done) return; yield; }     // $c3d8
  o.__noCull = false;                            // $c3de culling restored

  // $c3e2 / $c408: two children, each inheriting $92 so they know which bank
  // they belong to, with a beat of animation between them.
  spawnRoutineChild(o, world, '$062f2', 0, 0, { __ceiling: ceilingVariant });
  yield* waitScript(o);                          // $c3f6
  if (o.done) return;
  o.flipX = true;                                // $c3fa ori.w #1,$38
  o.x += 2;                                      // $c400
  yield* waitScript(o);                          // $c404
  if (o.done) return;
  spawnRoutineChild(o, world, '$0633a', 0, 0, { __ceiling: ceilingVariant });
  for (;;) { if (o.done) return; yield; }        // $c41c
}

// $0ed9c (res 58) and $0f0d6 (res 59) -- stage 5 ceiling and ground structures.
// Both install the collision handler $7d06 and the death handler $6772.
function* stage5Structure(o, world, spec) {
  allocDefaults(o);
  const isEd9c = spec.__addr === '$0ed9c';
  const res = isEd9c ? 58 : 59;
  o.x = SPAWN_TEMPLATE.x;
  o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  o.collides = true;                             // $44 = $7d06
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__invulnerable = true;                       // $48=$6772, $4c/$54=$ff
  o.setHandle(res === 58 ? 0x003a : 0x003b);

  if (isEd9c) {
    // $0ed9c: terrain-locked, it advances into shot and then, a beat later,
    // lets a second structure out behind it.
    o.y = (world.ceiling !== undefined ? world.ceiling : 0) + 0x0c; // $edd2-$eddc
    terrainLock(o, world);                       // $ede0 $8730
    o.x += world.leftExtent(o);
    while (o.x > 336) { if (o.done) return; yield; }                // $ede4 $8240
    for (let i = 0; i <= 0x96; i++) { if (o.done) return; yield; }  // $ede8, 150
    spawnRoutineChild(o, world, '$0ee14', 0, 0);                    // $edf0
  } else {
    // $0f0d6: it sits on the ground line with a companion 39px above it, and
    // $92 carries that gap to the child.
    o.vx = -GROUND_SCROLL; o.vy = 0;
    const gap = 0x27;                            // $f0d6 moveq #$27 -> $92
    o.y = (world.ground !== undefined ? world.ground : 182) - 0x10; // $f104/$f10a
    o.x += 0x10;                                                    // $f110
    o.x += world.leftExtent(o);
    spawnRoutineChild(o, world, '$0f14e', 0, -gap);                 // $f116/$f128
  }
  for (;;) { if (o.done) return; yield; }        // $7d46
}

function* stage5TubeMissile(o, world) {                   // $ee14
  o.y -= 0x14;
  o.depth += 1;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__invulnerable = true;                                // $48=$6772, $4c/$54=$ff
  o.playFrames([0x023a, 0x043a, 0x063a, 0x9000]);
  terrainLock(o, world);
  o.ay = 0x600 / 65536;                                   // $ee52
  for (;;) { if (o.done) return; yield; }
}

function* stage5StructureTop(o, world) {                   // $f14e
  o.depth += 1;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__invulnerable = true;                                // $48=$6772, $4c/$54=$ff
  o.playFrames([0x023b, 0xb000]);                         // slice 3 above chain 0-2
  terrainLock(o, world);
  for (;;) { if (o.done) return; yield; }
}

// $0b846 -- 6 records, res 52. Budget-limited, jittered, terrain-locked.
//   $b85c  $a2(a6)++ ; if > 6 bail out      a third pool, separate from $a0/$f0
//   $b868  hp $190 (400), score 4
//   $b874  x += rand & $3f ; y -= rand & $3f
//   $b88c  script res52 idx 0,1 looping ; $b896 terrain lock
//   $b8c6  $a2(a6)-- on the way out
const B846_GROUP_MAX = 6;

function* jitteredUnit(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  yield* jitteredUnitBody(o, world);
}

function* jitteredUnitBody(o, world, spec) {              // shared $b85c tail
  world.groupBudget++;                                   // $b85c
  try {
    if (world.groupBudget > B846_GROUP_MAX) return;      // $b866
    o.hp = 0x190; o.scoreAward = 4;                      // $b868 / $b86e
    o.collides = true;
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    o.x += (Math.random() * 64) | 0;                     // $b874
    o.y -= (Math.random() * 64) | 0;                     // $b880
    o.playFrames([0x0034, 0x0234, 0x9000]);              // $b88c
    o.vx = -GROUND_SCROLL; o.vy = 0;                     // $8730
    o.x += world.leftExtent(o);
    for (;;) {
      // $b8ce-$b924: pursue a randomized lane around the player's current Y.
      const targetY = (world.player ? world.player.y : 0x5c) +
                      ((Math.random() * 0x40) | 0) - 0x20;
      const speed = (0x6000 + ((Math.random() * 0x4000) | 0)) / 65536;
      do {
        if (o.done) return;
        const delta = o.y - targetY;
        o.vy = delta < 0 ? speed : -speed;
        // $b958: drift left only while approaching and before x reaches $a8.
        o.vx = o.x > 0xa8 && o.vy !== 0 ? -0x8000 / 65536 : 0;
        yield;
      } while (Math.abs(o.y - targetY) > 8);

      // $b926-$b956: stop, usually fire $6852, then hold for 40..71 frames.
      o.vx = o.vy = 0;
      if (Math.random() * 0xffff >= 0x4ccc && world.spawnCarrier)
        world.spawnCarrier(o);
      const delay = 0x28 + ((Math.random() * 0x20) | 0);
      for (let frame = 0; frame <= delay; frame++) {
        if (o.done) return;
        yield;
      }
    }
  } finally {
    world.groupBudget--;                                 // $b8c6
  }
}

// $0be5a..$0bf8e -- res 28 formation spawners. The ordinary entries use the
// four fixed lanes at $bffc/$c004/$c00c/$c014; $bfdc/$bfec are the top and
// bottom lanes with vertical drift.
const RES28_FORMATIONS = {
  '$0be5a': [[20, 0], [68, 0], [116, 0], [164, 0]],
  '$0beaa': [[20, 0]],
  '$0bed6': [[68, 0]],
  '$0bf02': [[116, 0]],
  '$0bf2e': [[164, 0]],
  '$0bf58': [[20, 0], [164, 0]],
  '$0bf8e': [[20, 0x9000 / 65536], [164, -0x9000 / 65536]],
};
const RES28_RECOIL = [0x0e1c, 0x021c, 0x001c, 0xa000, 0xb000]; // $c06e

function* res28Child(o, world, x, y, vy) {                   // $bfdc-$c0b2
  allocDefaults(o);
  o.x = x; o.y = y;
  o.vx = -1; o.vy = vy;
  o.hp = 0x1e0; o.scoreAward = 5;                           // $c034/$c03a
  o.depth = 0xc8;                                           // $c046
  o.flipX = false; o.__noCull = true;                       // $38 = 8, $50=$44dc
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.setHandle(0x041c);                                      // $c04c
  while (o.x > 336) { if (o.done) return; yield; }           // $c05a
  for (let frame = 0; frame <= 0x28; frame++) { if (o.done) return; yield; }
  o.vx = o.vy = o.ax = o.ay = 0;                            // $c064
  for (let frame = 0; frame <= 0x28; frame++) { if (o.done) return; yield; }
  o.playFrames(RES28_RECOIL);
  yield* waitScript(o);                                     // $c07c
  const sweep = function* (vx, boundary, flipX) {
    o.flipX = flipX; o.vx = vx;
    while (vx < 0 ? o.x > boundary : o.x < boundary) {
      if (o.done) return false;
      yield;
    }
    o.y = 0xb8 - o.y;                                      // $c104
    return true;
  };
  if (!(yield* sweep(-8, -0xa0, false))) return;             // $c0b6
  if (!(yield* sweep(8, 0x1f0, true))) return;               // $c0da
  yield* sweep(-8, -0xa0, false);                           // $c09c
}

function spawnRes28Formation(o, world, formation) {
  for (const [y, vy] of formation) {
    const x = o.x;
    world.spawnChildOf(o, (child, wd) => res28Child(child, wd, x, y, vy), {});
  }
}

function* childSpawner(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  spawnRes28Formation(o, world, RES28_FORMATIONS[spec.__addr] || []);
  return;                                                // $bfc2 terminates
}

// $090fc -- 5 records, res 50: the tiger, a 4-slice chained sprite.
//   $9108  y = $6a(a6) - $15 (21)
//   $9114  x += $30 (48)
//   $911a  $2a = $384 (900)   draw depth
//   $9120  $92 = $32 (50)
//   $9126  $58 = $8746        one-shot death handler
// $090fc -- the tiger. Its animation is in two halves, and res 50's atlas
// layout is that split: three single 32px objects, then five wide chains (one
// of 96px, four of 112px). The singles are the tiger raising its head; the
// chains are the leap.
//
//   $09120  $92 = $0032   head frame 1     $8240 advance in, then hold 20
//   $0915c  $92 = $0232   head frame 2     hold 20
//   $09168  $92 = $0432   head frame 3     hold 25
//   $09174  vx -= $28000  the jump, 2.5 px/frame further left
//   $0917c  vy  = $fffb8000                -4.5, the leap
//   $09184  ay  = $2000                    0.125, gravity
//   $0918c  bsr $7c38     a frame script whose inline data holds $0e32
//
// $92 carries a SPRITE HANDLE here, not the behaviour index it holds on other
// object types. The port used to set one handle, $0632 -- the first jump chain,
// frozen as a still -- and then cycle o.altHandle, a field nothing reads.
// ---------------------------------------------------------------------------
// $099a4 / $099b4 -- THE RES 11 MISSILE LAUNCHER.
//
//   $099a4  y -= $34, res $b, then straight into $99cc (the gate is skipped:
//           it is spawned as the child of an already-gated hill)
//   $099cc  $48 = $9a36 ; $99d4 hp $180 ; $99da score 3
//   $099e8  $8730 ; $099ec $8240 ; $099f0 wait $1e
//   $09a0a  loop: x -= 8, $62c6, $62c6, x += 8, wait $96 (150)
//
// $062c6 is a capped spawn of $063bc, and $063bc is not the plain shot:
//
//   $63bc  $28 = $14e(a6)          the shared launch heading
//   $63c2  $14e ^= $18             ... which flips for the next one
//
// before falling into $063c8, the homing missile. $0194e starts $14e at $80, so
// successive missiles leave alternately straight left and down-left and then
// turn toward the player six units every four frames for seventy passes.
//
// Two per volley, a hundred and fifty frames apart. The port had this handler on
// the generic path, so it drew and moved and never fired anything.
const MISSILE_PAIR_DX = 8;             // $9a10 / $9a1c
const MISSILE_INTERVAL = 0x96;         // $9a20, 150 frames
const MISSILE_SETTLE = 0x1e;           // $99f0
const MISSILE_HEADING0 = 0x80;         // $0194e
const MISSILE_HEADING_FLIP = 0x18;     // $63c2

function* res11Launcher(o, world, spec) {
  // waveChildBody has applied resource 11, hp $180, score 3 and the terrain
  // lock; $099a4's own `y -= $34` is applied by hillWithChild's offset table.
  while (o.x > 336) {                              // $099ec $8240
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
  for (let i = 0; i <= MISSILE_SETTLE; i++) {      // $099f0
    if (o.done) return;
    yield;
  }
  for (;;) {                                       // $09a0a
    if (o.done) return;
    o.x -= MISSILE_PAIR_DX;                        // $9a10
    if (world.spawnMissile) { world.spawnMissile(o); world.spawnMissile(o); }
    o.x += MISSILE_PAIR_DX;                        // $9a1c
    for (let i = 0; i <= MISSILE_INTERVAL; i++) {  // $9a20
      if (o.done) return;
      if (o.x + world.leftExtent(o) < -48) return;
      yield;
    }
  }
}

// ---------------------------------------------------------------------------
// $09d2a -- THE RES 9 RIDERS on top of the $092b0 structure.
//
// $09340 makes three of them, walking $a0 down from 3 and offsetting each by
// `((n - 1) << 5) - 4` -- so +28, -4 and -36 from the structure's x once its own
// `x += $30` has been applied.
//
//   $9d3c  score 2 ; $9d42 $92 = 0
//   $9d46  $12 += (rand & 3) - $32        about 50 above
//   $9d56  depth $1f3 ; $9d5c frames [$80a0, $0009, $0209, $b000]
//   $9d68  $8730 terrain lock
//   $9d6c  $12 -= $32                     another 50: it starts ~100 above
//   $9d72  depth += 1 ; $9d76 $8240
//   $9d7a  $1a = 1 as a word              vy = +1, it descends into place
//   $9d80  wait $32 (50) ; $9d86 clr.w $1a -- and stops
//   $9d8a  loop: wait $1e (30), $9db8, wait $28 (40)
//
// $9db8 only fires when the player is low enough: it reads $13e(a6), takes the
// player y less $10, and skips the whole attack if that is above its own y.
//
// $80a0 is a control word -- opcode 0, hold $a0 -- so the two frames are held
// for 160 apiece. These barely animate; they descend, settle and shoot.
const RIDER_SCRIPT = [0x80a0, 0x0009, 0x0209, 0xb000];   // $9d60
const RIDER_EXTEND = [0x8008, 0x0409, 0x0809, 0xa000, 0xb000];
const RIDER_FIRE_EXTENDED = [0x800c, 0x0a09, 0xa000, 0x0809, 0xb000];
const RIDER_RETRACT = [0x8008, 0x0409, 0xa000, 0xb000];
const RIDER_FIRE_RETRACTED = [0x800c, 0x0609, 0xa000, 0x0409, 0xb000];
const RIDER_DEPTH = 0x1f3;              // $9d56
const RIDER_RISE = 0x32;                // $9d4e / $9d6c, applied twice
const RIDER_DESCENT = 0x32;             // $9d80, 50 frames of vy = 1
const RIDER_WAIT_A = 0x1e;              // $9d90
const RIDER_WAIT_B = 0x28;              // $9d9a
const RIDER_SHOT_HEADING = 0x60;        // $9dfe moveq #$60 -> $687e
const RIDER_OFFSETS = [28, -4, -36];    // $9350-$935a, ((n-1)<<5)-4 for n = 2,1,0
const RIDER_REVEAL = 0x64;              // $930c: $09418 d0 = $64, 101 hidden frames

function* res9Rider(o, world, ox, oy) {
  allocDefaults(o);
  o.__addr = '$09d2a';
  o.scoreAward = 2;                              // $9d3c
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.x = ox;
  o.y = oy - RIDER_RISE - ((Math.random() * 4) | 0)   // $9d46
          - RIDER_RISE;                                // $9d6c
  o.depth = RIDER_DEPTH + 1;                     // $9d56 then $9d72
  o.playFrames(RIDER_SCRIPT);                    // $9d5c
  terrainLock(o, world);                         // $9d68
  o.x += world.leftExtent(o);
  while (o.x > 336) {                            // $9d76 $8240
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
  o.vy = 1;                                      // $9d7a
  for (let i = 0; i <= RIDER_DESCENT; i++) {     // $9d80
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
  o.vy = 0;                                      // $9d86
  let extended = false;                          // $92: 0 or $ffff
  for (;;) {                                     // $9d8a
    for (let i = 0; i <= RIDER_WAIT_A; i++) {    // $9d90
      if (o.done) return;
      if (o.x + world.leftExtent(o) < -48) return;
      yield;
    }
    // $09db8 reads the player only as a GATE -- `player y - $10` against its own
    // y, and it abandons the attack when the player is above it. The shot
    // itself is $09e30: `$12 += 6`, then $687e with d0 = $60 from $9dfe. That
    // is the FIXED-heading spawner, not $6774's aimed one, so the round leaves
    // on a set line and never tracks.
    const p = world.player;
    if (p && !p.done && world.spawnProjectile) {
      let heading;
      if ((p.y - 0x10) >= o.y) {
        if (!extended) {
          o.playFrames(RIDER_EXTEND);               // $9dd0
          yield* waitScript(o);                     // $9dde
          extended = true;                          // $9de2
        }
        o.playFrames(RIDER_FIRE_EXTENDED);          // $9dec
        yield* waitScript(o);                       // $9dfa
        heading = RIDER_SHOT_HEADING;
      } else {
        if (extended) {
          o.playFrames(RIDER_RETRACT);              // $9e08
          yield* waitScript(o);                     // $9e14
          extended = false;                         // $9e18
        }
        o.playFrames(RIDER_FIRE_RETRACTED);         // $9e1c
        yield* waitScript(o);                       // $9e2a
        heading = 0x70;
      }
      if (!o.done) {
        o.y += 6;                                   // $9e30
        world.spawnProjectile(o, heading);
        o.y -= 6;                                   // $9e38
      }
    }
    for (let i = 0; i <= RIDER_WAIT_B; i++) {    // $9d9a
      if (o.done) return;
      if (o.x + world.leftExtent(o) < -48) return;
      yield;
    }
  }
}

// ---------------------------------------------------------------------------
// $08746 -- THE DEATH EXPLOSION. Two blasts, not one, and not res 27.
//
//   $8746  x -= $14 (20) ; $80fe $88ec        the first blast, left of centre
//   $8758  x += $28 (40) ; $80fe $88e6        the second, right of centre
//
// and $88e6 is simply $88ec behind a ten-frame wait ($88e8 moveq #$a / $8076),
// so the pair go off staggered rather than together.
//
// $88ec plays sound $45 and runs the script at $88fe:
//
//   2605 2805 2a05 2c05 2e05 3005 3205 3405 3605 a000 b000
//
// which is RES 5, frames 19 through 27 -- nine of them -- then $8990 sets the
// depth to $2b2 (690, behind the enemies) and waits the script out.
//
// The port fired $0c24e for every death instead. That routine exists, but it is
// one specific effect built on res 27, which is why res 27 kept appearing
// whenever anything was shot.
const DEATH_EXPLOSION = [0x2605, 0x2805, 0x2a05, 0x2c05, 0x2e05,
                         0x3005, 0x3205, 0x3405, 0x3605, 0xa000, 0xb000];  // $88fe
const DEATH_DEPTH = 0x2b2;        // $8992
const DEATH_SOUND = 0x45;         // $88ec
const DEATH_DX = 0x14;            // $8746 / $8758
const DEATH_DELAY = 0xa;          // $88e8
const HIT_BURST = [0x1405, 0x1605, 0x1805, 0x1a05, 0x1c05,
                   0x1e05, 0x2005, 0x2205, 0x2405, 0xa000, 0xb000]; // $8976

function* deathBlast(o, world, x, y, delay) {
  o.x = x; o.y = y;
  o.depth = DEATH_DEPTH;                       // $8992
  o.collides = false;
  for (let i = 0; i < delay; i++) {            // $88e8 $8076
    if (o.done) return;
    yield;
  }
  world.lastSound = DEATH_SOUND;               // $88f6 $69b6
  o.playFrames(DEATH_EXPLOSION);               // $88fa $7c38
  while (o.scriptOn) {                         // $8998 $74e2
    if (o.done) return;
    yield;
  }
}

function* hitBurst(o, world, x, y) {
  o.x = x; o.y = y;
  o.depth = DEATH_DEPTH;
  o.collides = false;
  o.playFrames(HIT_BURST);                         // $8946 -> $8976
  while (o.scriptOn) { if (o.done) return; yield; }
}

const FRAGMENT_SCRIPTS = [
  [0x0006, 0x0206, 0x0406, 0x0606, 0xb000],
  [0x0e06, 0x0c06, 0x0a06, 0x0806, 0x0606, 0x0406, 0x0206, 0x0006, 0xb000],
  [0x1006, 0x1206, 0x1406, 0x1606, 0x1806, 0x1a06, 0x1c06, 0x1e06, 0xb000],
  [0x2006, 0x1e06, 0x1c06, 0x1a06, 0x1806, 0x1606, 0x1406, 0x1206, 0xb000],
];

function* fragmentParticle(o, world, x, y) {
  o.x = x; o.y = y;
  o.depth = DEATH_DEPTH;
  o.collides = false;
  o.vx = (((Math.random() * 0x200) | 0) - 0x100) / 256; // $cfac-$cfbc
  o.vy = -(((Math.random() * 0x400) | 0) + 0xfa) / 256; // $cfc0-$cfd2
  o.ay = 0x2000 / 65536;                               // $cfd6
  o.playFrames(FRAGMENT_SCRIPTS[(Math.random() * 4) | 0]);
  for (let i = 0; i <= 0x6d; i++) {                    // $d066: 9 + 101 frames
    if (o.done) return;
    yield;
  }
}

function* fragmentShower(o, world, x, y) {
  o.x = x; o.y = y;
  o.noDraw = true;
  for (let i = 0; i < 5; i++) {                        // $cf7c
    world.spawn((part, wd) => fragmentParticle(part, wd, x, y), {});
    for (let wait = 0; wait <= 6; wait++) yield;       // $cf92/$8076
  }
}

function smallDeathEffect(world, src) {
  world.spawn((blast, wd) => explosion(blast, wd, src.x, src.y), {}); // $c24e
}

function fragmentDeathEffect(world, src) {
  world.spawn((shower, wd) => fragmentShower(shower, wd, src.x, src.y), {}); // $d2f4
  world.spawn((burst, wd) => hitBurst(burst, wd, src.x, src.y), {});          // $88ca
}

function centeredBurstDeathEffect(world, src) {
  world.spawn((burst, wd) => hitBurst(burst, wd, src.x, src.y), {});          // $88d8
}

function centeredBlastDeathEffect(world, src) {
  world.spawn((blast, wd) => deathBlast(blast, wd, src.x, src.y, 0), {});     // $876c
}

function pairedBlastDeathEffect(world, src) {
  const x = src.x, y = src.y;
  world.spawn((o, wd) => deathBlast(o, wd, x - DEATH_DX, y, 0), {});          // $874c
  world.spawn((o, wd) => deathBlast(o, wd, x + DEATH_DX, y, DEATH_DELAY), {}); // $875e
}

const CHILD_DEATH_EFFECTS = {
  '$0b19a': (world, src) => {                              // $887e
    const x = src.x, y = src.y;
    world.spawn((burst, wd) => hitBurst(burst, wd, x - 0x10, y), {});
    world.spawn((blast, wd) => deathBlast(blast, wd, x + 0x10, y, 0), {});
  },
  '$0b22e': (world, src) => {                              // $b2be -> $88a0
    const x = src.x, y = src.y;
    world.spawn((burst, wd) => hitBurst(burst, wd, x - 0x28, y), {});
    world.spawn((burst, wd) => hitBurst(burst, wd, x + 0x18, y), {});
    world.spawn((blast, wd) => deathBlast(blast, wd, x - 0x08, y, 0), {});
  },
};

// The allocator installs $7d12, which branches to $88ca: one centered hit
// burst. Only enemies that explicitly replace $58 with $8746 get the pair.
function installDeathExplosion(world) {
  world.onDeath = (src) => centeredBurstDeathEffect(world, src);             // $7d12
}

// ---------------------------------------------------------------------------
// $0516c -- THE WEAPON CAPSULE. Twenty-one handlers share it.
//
//   $517a  $16 -= 1 as a word            vx = -1
//   $517e  $8abc                          gate
//   $5182  $44 = $ff                      IT DOES NOT TOUCH THE PLAYER
//   $5194  $48 = $51c2                    but it can be shot
//   $519c  $2a = $64                      depth 100, in front
//   $51a2  frames [$1e03, $b000]          res 3 index 15 -- the SEALED capsule
//
// and $51c2, the shot handler, does not subtract hit points:
//
//   $51c2  $48 = $ff, $4c = $ff           no further damage
//   $51ce  sound $45
//   $51f2  jsr ($92)                      hand over to the per-handler routine
//
// which for $04c62 is $4c8e:
//
//   $4c8e  $44 = $4ca2                    NOW it responds to the player
//   $4c96  frames [$0203, $b000]          res 3 index 1 -- the CONTENTS
//
// So each of the twenty-one handlers is one capsule type, and the frame the
// extractor recorded is what the capsule turns into AFTER it is shot. The port
// was showing that revealed frame from the moment it appeared, and giving the
// capsule a collision box that damaged the player -- which is the wrong sprite
// drifting in from the right.
const CAPSULE_SEALED = 0x1e03;      // $51a6
const CAPSULE_DEPTH = 0x64;         // $519c
const CAPSULE_SOUND = 0x45;         // $51ce
const CAPSULE_OPENING = [0x2003, 0x2203, 0x2403, 0x2603,
                         0x2803, 0x2a03, 0x2c03, 0x2e03,
                         0xa000, 0xb000];             // $51fe-$5210

function* weaponCapsule(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  if (spec.y !== undefined) o.y = spec.y;
  else if (spec.dy !== undefined) o.y = SPAWN_TEMPLATE.y + spec.dy;
  else o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);       // $517e
  o.vx = INSTALL_516C_VX; o.vy = 0;                    // $517a
  o.collides = false;                                  // $5182 $44 = $ff
  o.shotCollides = true;                               // $5194 $48 = $51c2
  o.depth = CAPSULE_DEPTH;                             // $519c
  o.hp = spec.hp !== undefined ? spec.hp : ALLOC.hp;
  o.scoreAward = 0;
  o.setHandle(CAPSULE_SEALED);                         // $51a2
  o.x += world.leftExtent(o);

  // $51c2 -> jsr ($92): being shot opens it instead of destroying it.
  o.__onShot = (self, _amount, wd) => {
    if (self.__opening || self.__opened) return;       // $51c2 clears $48
    self.__opening = true;
    self.shotCollides = false;                         // $51c2 clears $48/$4c
    self.__pickup = true;
    wd.lastSound = CAPSULE_SOUND;                      // $51ce
    self.playFrames(CAPSULE_OPENING);                  // $51dc -> $51fa
  };
  for (;;) {                                           // $51aa
    if (o.done) return;
    if (o.__opening && o.scriptFlag) {                 // $51e6/$51ea
      o.__opening = false;
      o.__opened = true;
      if (spec.handle !== undefined) o.setHandle(spec.handle);    // contents
      o.collides = true;                               // $4c8e $44 = $4ca2
      o.onHitPlayer = (self, wd) => { wd.collectPickup(self); };
    }
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
}

// ---------------------------------------------------------------------------
// $09082 / $090aa -- THE MOUND, and the res 8 runner it lets out.
//
//   $09082  acquire $1237 (res 55 index 9) and res 8 ; $9092 x += $10
//   $090aa  gate ; $90ae y = $6a(a6) - $10 ; $90ba depth $190 ; $90c0 $30 = $1237
//   $090ca  $8730 terrain lock ; $90ce $8240 come on screen
//   $090d2  wait $28 (40) ; $90d8 spawn $9f34 ; $90e4 run while alive
//
// The mound acquires res 8 for a passenger it releases forty frames after it
// arrives. The port drew the mound and never spawned the passenger, which is
// the enemy that runs diagonally away from it.
//
// $09f34 is that passenger:
//
//   $9f3c  hp $20, score 2 ; $9f48 depth += 1 (just in front of the mound)
//   $9f4c  frames 0008 0208 0408 0208 9000  -- a looping four-step run
//   $9f5a  $16 = $ffff as a WORD, then $9f60 x -= 8, then
//   $9f64  $16 = $4000 as a LONG            vx = +0.25, to the RIGHT
//   $9f6c  $22 = $fffffc00                  ay = -0.0156, accelerating UP
//   $9f74  wait $64 (100) ; $9f7a $6774 fire ; $9f7e run while alive
//
// Rightward drift under upward acceleration is what makes the diagonal.
const MOUND_HANDLE = 0x1237;             // $90c0
const MOUND_DEPTH = 0x190;               // $90ba
const MOUND_ENTRY_DX = 0x10;             // $9092
const MOUND_RELEASE = 0x28;              // $90d2, 40 frames
const RUNNER_SCRIPT = [0x0008, 0x0208, 0x0408, 0x0208, 0x9000];   // $9f50
const RUNNER_VX = 0x4000 / 65536;        // $9f64, +0.25
const RUNNER_AY = -0x400 / 65536;        // $9f6c, -0.0156
const RUNNER_FIRE_DELAY = 0x64;          // $9f74

function* res8Runner(o, world) {
  allocDefaults(o);
  o.__addr = '$09f34';
  o.hp = 0x20; o.scoreAward = 2;                 // $9f3c / $9f42
  o.depth = (o.depth || MOUND_DEPTH) + 1;        // $9f48
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.playFrames(RUNNER_SCRIPT);                   // $9f4c
  o.x -= 8;                                      // $9f60
  o.vx = RUNNER_VX;                              // $9f64
  o.vy = 0;
  o.ay = RUNNER_AY;                              // $9f6c
  for (let i = 0; i <= RUNNER_FIRE_DELAY; i++) { // $9f74
    if (o.done) return;
    yield;
  }
  if (world.spawnAimedShot) world.spawnAimedShot(o);   // $9f7a $6774
  for (;;) { if (o.done) return; yield; }        // $9f7e $7d46
}

// waveChildBody has already applied everything the extractor got right --
// handle $1237, ground - $10, depth $190, the terrain lock and the 40-frame
// phase. What it cannot express is the spawn at the end of that wait.
// $09082: the same bush, entered one instruction earlier so it sits 16px right.
// waveChildBody has already applied the extracted fields.
function* mound(o, world, spec) {
  o.x += MOUND_ENTRY_DX;                               // $9092
  o.collides = false;          // the planted bush is scenery, like $0909a
  o.__invulnerable = true;
  yield* bushRelease(o, world);
}

// ---------------------------------------------------------------------------
// $09a54 -- THE TREE. Five objects, and the port was drawing none of them.
//
// $09a54 itself is invisible and does almost nothing: it picks a height, makes
// one retained child, hands it a direction, and then waits for it to die.
//
//   $9a64  y = (rand & $3f) + $30      48..111
//   $9a74  $80d0 $9aa6                 the real enemy
//   $9a78  $96(a0) = 2                 ... or -2 at $9a86, on a coin flip
//   $9a8a  spin until $60 (the retained child) is gone, then release res $a
//
// The port had this handler as { uses: 5, resource: 10 } with no children at
// all, so five records in stage 1 produced five invisible spawners and nothing
// else. This is the "tree that extends down and shoots downward".
//
// $09aa6 is the head, and each link spawns the next through $80d0 after a short
// wait, passing $96 along, then falls into the shared tail at $9b44:
//
//   $9b44  $2a = d1 (depth) ; $7cb8 d0 (handle)
//   $9b4c  $44 = $7d06                 it hurts the player
//   $9b5c  $48 = $ff ; $4c = $ff       but takes no damage: only the head does
//
// and every link then runs $9b72:
//
//   $9b76  $26 = $180, $28 = $80       speed 1.5, heading left
//   $9b86  $8240                       come on screen
//   $9b8a  $9be0                       sway
//   $9b8e  $9ba0                       curl (and, for the head, fire)
//   $9b92  loop: $9be0 forever
//
// $9be0 is the sway: heading $68, hold table[$92] frames, heading $98, hold
// table[$92+1], with $92 wrapping at 16. The table at $9c04 is
// 40 40 30 20 15 10 10 10 ... -- long slow strokes settling into a fast flutter.
// Because each link is spawned 3-6 frames after the one above it, the stroke
// travels down the chain and the whole thing ripples.
//
// $9ba0 is the curl: heading 0, then sixteen frames of `$28 += $96`, which is
// where the +-2 the spawner chose finally matters -- it decides which way the
// tree bends. The head ($94 = $ffff, set at $9ac8) also spawns $9c3a first.
const TREE_HOLD = [40, 40, 30, 20, 15, 10, 10, 10,
                   10, 10, 10, 10, 10, 10, 10, 10];        // $9c04
// $9b76 writes $180 into $26, and setVelocity() is what divides by 256 -- the
// field is RAW. Pre-dividing here made every link crawl at 0.006 px/frame, so
// the tree sat just off the left edge and took thousands of frames to arrive.
const TREE_SPEED = 0x180;              // $9b76, raw $26 -> 1.5 px/frame
const TREE_HEAD_A = 0x68;              // $9be0
const TREE_HEAD_B = 0x98;              // $9be8
const TREE_CURL_STEPS = 0x10;          // $9bc2
const TREE_SHOT_HEADING = 0x40;        // straight down

// handle, depth and the wait before this link appears. $9aa6 / $9adc / $9afa /
// $9b18 / $9b36 -- the last one spawns nothing further.
const TREE_LINKS = [
  { at: '$09aa6', handle: 0x020a, depth: null,  delay: 0, head: true },
  { at: '$09adc', handle: 0x040a, depth: 0x321, delay: 4 },
  { at: '$09afa', handle: 0x060a, depth: 0x322, delay: 6 },
  { at: '$09b18', handle: 0x060a, depth: 0x323, delay: 4 },
  { at: '$09b36', handle: 0x080a, depth: 0x324, delay: 3 },
];

function* treeLink(o, world, spec, n, dir) {
  const cfg = TREE_LINKS[n];
  allocDefaults(o);
  o.__addr = cfg.at;
  o.x = spec.__x; o.y = spec.__y;
  for (let i = 0; i < cfg.delay; i++) { if (o.done) return; yield; }   // $8076

  // each link makes the next one before doing anything else
  if (n + 1 < TREE_LINKS.length) {
    world.spawnRetained(o, (c, wd) =>
      treeLink(c, wd, { __x: o.x, __y: o.y }, n + 1, dir), {});
  }
  if (cfg.depth !== null) o.depth = cfg.depth;      // $9b44
  o.setHandle(cfg.handle);                         // $9b48 $7cb8
  o.collides = true;                               // $9b4c: contact -> $7d06
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  // $9b5c makes only the four tail links immune. The head branches around
  // $9b44 and owns the chain's $80 hit points with a normal damage handler.
  o.__invulnerable = !cfg.head;
  if (cfg.head) { o.hp = 0x80; o.scoreAward = 3; } // $9ab4 / $9aba

  let phase = 0;                                   // $92
  o.speed = TREE_SPEED;                            // $9b76
  o.angle = 0x80;                                  // $9b7c
  o.setVelocity();                                 // $9b82
  // NO leftExtent shift here. That is a port convention for wide objects
  // entering on their leftmost pixel, and $09aa6 does not do it. Applying it
  // moved each link by its OWN hotspot -- 20, 7, 5, 5 and 2 -- which scrambled
  // the order the spawn delays create and left the tail bunched into about
  // twelve pixels with the second segment AHEAD of the head.
  //
  // The spacing is entirely the delays: each link waits 4, 6, 4 or 3 frames
  // before it starts moving, and $8240 preserves that lag rather than
  // synchronising them, because a link that starts later crosses x = 336 later
  // and by then the one in front has travelled on.
  while (o.x > 336) {                              // $9b86 $8240
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }

  const swing = function* (heading) {              // $9bee
    o.angle = heading & 0xff;
    const hold = TREE_HOLD[phase];
    phase = (phase + 1) & 0xf;                     // $9bf6
    for (let i = 0; i <= hold; i++) {              // $9c20
      if (o.done) return true;
      if (!cfg.head && !o.owner) { o.hp = 0; return true; } // $9c28
      if (o.x + world.leftExtent(o) < -48) return true;
      o.setVelocity();                             // $9c32 $75b2
      yield;
    }
    return false;
  };
  const sway = function* () {                      // $9be0
    if (yield* swing(TREE_HEAD_A)) return true;
    return yield* swing(TREE_HEAD_B);
  };

  if (yield* sway()) return;                       // $9b8a

  // $9ba0: the head fires once, then every link curls.
  if (cfg.head && world.spawnTreeShot)
    world.spawnTreeShot(o);                        // $9bb2 $9c3a -> $644c
  o.angle = 0;                                     // $9bbe
  for (let i = 0; i < TREE_CURL_STEPS; i++) {      // $9bc2
    if (o.done) return;
    if (!cfg.head && !o.owner) { o.hp = 0; return; } // $9c28
    o.angle = (o.angle + dir) & 0xff;              // $9bcc / $9bd0
    o.setVelocity();
    yield;
  }
  for (;;) {                                       // $9b92
    if (yield* sway()) return;
  }
}

// $09a54: the spawner. Invisible by design -- it never sets a handle.
function* treeSpawner(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  yield* entryGate(o, world, spec.trigger || 0);
  o.y = 0x30 + ((Math.random() * 0x40) | 0);       // $9a60-$9a6c
  const dir = (Math.random() < 0.5) ? 2 : -2;      // $9a78 / $9a86
  const tree = world.spawnRetained(o, (c, wd) =>
    treeLink(c, wd, { __x: o.x, __y: o.y }, 0, dir), {});
  while (tree && !tree.done) {                     // $9a8a-$9a92
    if (o.done) return;
    yield;
  }
  for (let i = 0; i <= 0x32; i++) { if (o.done) return; yield; }   // $9a94
}

// ---------------------------------------------------------------------------
// $091b0 -- THE $92 FOLLOWER, and why the tiger looked headless.
//
// $80d0 spawns a RETAINED child, and $091b0 is the one the tiger uses. It is not
// an enemy at all: it is a second draw slot that tracks its owner and renders
// whatever handle the owner keeps in $92.
//
//   $91b4  d0 = $5c(a5)              the owner pointer; gone means gone
//   $91bc  $e(a5)  = $e(a0)          copy the owner x
//   $91c2  $12(a5) = $12(a0)         copy the owner y
//   $91c8  $66(a5) = $66(a0)
//   $91ce  $2a(a5) = $2a(a0)         copy the owner depth
//   $91d4  $30(a5) = $92(a0)         MY HANDLE = the owner $92
//   $91da  beq $91e2                 owner cleared it -> terminate
//
// So an object with a $92 handle draws TWO sprites: its own, animated by its
// own frame script, and this one on top. Clearing $92 removes the second.
function* handleFollower(o, world, owner) {
  o.depth = owner.depth;
  o.collides = false;
  for (;;) {                                     // $91b4
    if (owner.done) return;                      // $91b8 the owner pointer
    o.x = owner.x;                               // $91bc
    o.y = owner.y;                               // $91c2
    o.depth = owner.depth;                       // $91ce
    o.flip = owner.flip; o.flipX = owner.flipX;
    const h = owner.head;                        // $91d4 $30 = $92(a0)
    if (!h) return;                              // $91da
    o.setHandle(h);
    yield;                                       // $91dc
  }
}

// ---------------------------------------------------------------------------
// $090fc -- THE TIGER.
//
//   $9108  y = $6a(a6) - $15      stand on the ground
//   $9114  x += $30 ; $911a depth $384
//   $9120  $92 = $0032            the head, drawn by the follower below
//   $9132  $80d0 $91b0            spawn that follower
//   $9146  frame script [$0632, $b000]  -- ONE body frame, then stop
//   $9152  $8240
//   $9156  wait 20 ; $915c $92 = $0232 ; wait 20 ; $9168 $92 = $0432 ; wait 25
//   $9174  vx -= 2.5 ; $917c vy = -4.5 ; $9184 ay = 0.125
//   $918c  frame script [$8014, $0832, $0a32, $0c32, $0e32, $b000]
//   $919c  clr.w $92              the head follower dies here
//
// The two halves finally make sense together. While the tiger crouches, its own
// sprite is the single body frame $0632 and the follower draws the head on top,
// raising it through $0032 -> $0232 -> $0432. When it leaps, the body script
// switches to four WIDE chains that already contain the head, so $92 is cleared
// to stop a second one being drawn over it.
//
// The port had been calling setHandle with the HEAD frames, so the crouch drew a
// head and no body, and the leap drew a body whose head was really part of the
// chain. $8014 is a control word -- opcode 0, hold = $14 -- so the leap runs at
// 20 frames a frame, not the 6 that was standing in for it.
const TIGER_HEAD = [[0x0032, 20], [0x0232, 20], [0x0432, 25]];   // $9120/$915c/$9168
const TIGER_REST = [0x0632, 0xb000];                             // $914a
const TIGER_LEAP = [0x8014, 0x0832, 0x0a32, 0x0c32, 0x0e32, 0xb000];   // $9190

function* tiger(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = (world.ground || 0) - 0x15;              // $9108
  yield* entryGate(o, world, spec.trigger || 0);
  o.x += 0x30;                                   // $9114
  o.depth = 0x384;                               // $911a
  o.head = TIGER_HEAD[0][0];                     // $9120 $92 = $0032
  o.hp = 0x200; o.scoreAward = 5;                // $913a / $9140
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__onDeath = (self, wd) => pairedBlastDeathEffect(wd, self); // $9126 -> $8746
  o.vx = -GROUND_SCROLL; o.vy = 0;

  // $9132: the follower is spawned BEFORE the body script, and $9136 bails out
  // of the whole routine if it could not be allocated.
  world.spawnChildOf(o, (c, wd) => handleFollower(c, wd, o), {});

  o.playFrames(TIGER_REST);                      // $9146
  o.x += world.leftExtent(o);
  while (o.x > 336) { if (o.done) return; yield; }          // $9152 $8240

  for (const [h, hold] of TIGER_HEAD) {          // $9156 / $9162 / $916e
    o.head = h;
    for (let i = 0; i <= hold; i++) { if (o.done) return; yield; }
  }

  o.vx -= 0x28000 / 65536;                       // $9174, a further -2.5
  o.vy = -0x48000 / 65536;                       // $917c $fffb8000 = -4.5
  o.ay = 0x2000 / 65536;                         // $9184, 0.125
  o.playFrames(TIGER_LEAP);                      // $918c
  o.head = 0;                                    // $919c, the follower ends
  for (;;) { if (o.done) return; yield; }        // $91a0 $7d46
}

// $0909a -- 5 records. Places the res 55 bush (game index 9) on the ground.
// $0909a acquires $1237 and res 8 and then FALLS THROUGH into $090aa -- it is
// the same routine as the bush $092b0 plants, minus $09082's `x += $10`. So an
// isolated bush releases a res 8 runner exactly like the ones under the trees
// do; the port had this as a sprite placer and nothing else.
function* bushPlacer(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  yield* entryGate(o, world, spec.trigger || 0);       // $090aa
  o.y = (world.ground !== undefined ? world.ground : 182) - 0x10;   // $90ae
  o.depth = BUSH_DEPTH;                                // $90ba
  o.setHandle(BUSH_HANDLE);                            // $90c0
  o.collides = false;          // scenery: see the note on treeLink
  o.__invulnerable = true;
  terrainLock(o, world);                               // $90ca
  o.vy = 0;
  o.x += world.leftExtent(o);
  yield* bushRelease(o, world);                        // $90ce onward
}

// The shared tail of $090aa: come on screen, wait forty frames, let the runner
// out, then coast.
function* bushRelease(o, world) {
  while (o.x > 336) {                                  // $90ce $8240
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
  for (let i = 0; i <= MOUND_RELEASE; i++) {           // $90d2
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
  world.spawnChildOf(o, function* (c, wd) {            // $90d8
    c.x = o.x; c.y = o.y; c.depth = o.depth;
    yield* res8Runner(c, wd);
  }, {});
  for (;;) {                                           // $90e4 $7d46
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
}

const EF_TERMINAL_A = [0x8014, 0x0039, 0x0239, 0x0439, 0x0639, 0x9000];
const EF_TERMINAL_B = [0x8014, 0x0839, 0x0a39, 0x0c39, 0x0e39, 0x1039, 0x9000];

function installEfStructureHit(o, state) {                 // $f0b4 / $f088
  o.collides = true;
  o.onHitPlayer = (self, world) => { world.damage(self, 1); };
  o.__onShot = (_self, amount, world) => {
    const terminal = state.terminal;
    if (terminal && !terminal.done) world.applyDamage(terminal, amount);
  };
  o.__bodyInvulnerable = true;                             // $4c = $ff
}

function* efStructureTerminal(o, world, state, level) {    // $efe6
  allocDefaults(o);
  o.__addr = '$0efe6';
  o.depth = 0x258;
  o.level = level;
  o.hp = 0x5f0; o.scoreAward = 0x3e8;
  o.x += 1; o.y += 0x1a;                                  // $f00a/$f010
  state.terminal = o;
  installEfStructureHit(o, state);
  o.playFrames(Math.random() * 0xffff < 0x7fff ? EF_TERMINAL_B : EF_TERMINAL_A);
  terrainLock(o, world);                                   // $f048
  while (o.x > 336) { if (o.done) return; yield; }         // $8240
  for (;;) { if (o.done) return; yield; }
}

function* efStructureLink(o, world, state, level, terminalAt) { // $ef8a
  allocDefaults(o);
  o.__addr = '$0ef8a';
  o.depth = 0x258;
  o.level = level;
  o.hp = 0x10; o.scoreAward = 0;
  o.y += 0x20;
  installEfStructureHit(o, state);
  let child;
  if (level >= terminalAt) {
    child = world.spawnRetained(o, (next, wd) => {
      next.x = o.x; next.y = o.y;
      return efStructureTerminal(next, wd, state, level + 1);
    }, {});
  } else {
    child = world.spawnRetained(o, (next, wd) => {
      next.x = o.x; next.y = o.y;
      return efStructureLink(next, wd, state, level + 1, terminalAt);
    }, {});
  }
  o.setHandle(0x1439);                                     // inline $1439,$b000
  terrainLock(o, world);
  while (o.x > 336) { if (o.done) return; yield; }
  while (!o.done && child && !child.done) {
    o.hitFlash = child.hitFlash;                           // $f064-$f066
    yield;
  }
  return;                                                  // non-root links collapse
}

function* efStructureRoot(o, world, spec, terminalAt) {    // $ef2a
  allocDefaults(o);
  o.__addr = '$0ef2a';
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);            // trigger inherited by $80fe
  o.depth = 0x258;
  o.level = 0;
  o.hp = 0x10; o.scoreAward = 0;
  o.y = (world.ceiling !== undefined ? world.ceiling : 0) + 0x0f;
  const state = { terminal: null };
  installEfStructureHit(o, state);
  const child = world.spawnRetained(o, (next, wd) => {
    next.x = o.x; next.y = o.y;
    return efStructureLink(next, wd, state, 1, terminalAt);
  }, {});
  o.setHandle(0x1239);                                     // inline $1239,$b000
  terrainLock(o, world);
  while (o.x > 336) { if (o.done) return; yield; }
  while (!o.done) {
    if (child && !child.done) o.hitFlash = child.hitFlash;
    yield;                                                 // level 0 survives the collapse
  }
}

// $eee2/$eefa/$ef12 seed variants 3/2/1 respectively, then terminate.
function* variantSeeder(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  world.spawnChildOf(o, function* (c, wd) {
    yield* efStructureRoot(c, wd, spec, spec.variant);
  }, {});
  return;                                                  // $eef6/$ef0e/$ef26
}

// $09a54 -- 5 records, res 10. Spawns one retained child with a randomised
// +-2 variant, then waits for it to die before exiting.
//   $9a60  y = (rand & $3f) + $30      absolute lane 48..111
//   $9a74  bsr $80d0                   spawn and retain at $60
//   $9a78  child $96 = 2 ; $9a86 negate it on a coin flip
//   $9a8a  yield while $60 is non-null
//   $9a94  wait 50, release, terminate
function* retainedSpawner(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  yield* entryGate(o, world, spec.trigger || 0);
  o.y = ((Math.random() * 64) | 0) + 0x30;             // $9a60
  const variant = Math.random() < 0.5 ? 2 : -2;        // $9a78 / $9a86
  const kid = world.spawnChildOf(o, function* (c, wd) {
    allocDefaults(c);
    c.x = o.x; c.y = o.y; c.variant = variant;
    c.vx = -GROUND_SCROLL; c.vy = 0;
    c.collides = true;
    c.onHitPlayer = (self, w2) => { w2.damage(self, 1); };
    c.setHandle(wd.firstHandleOfResource(10));
    for (;;) { if (c.x + wd.leftExtent(c) < -48) return; yield; }
  }, {});
  while (kid && !kid.done) { if (o.done) return; yield; }   // $9a8a
  for (let i = 0; i <= 50; i++) { if (o.done) return; yield; }
  return;                                              // $9aa2
}

// $0a5c0 -- 5 records, res 52. Accelerating unit: constant vx with small
// acceleration on both axes, then four scripted phases.
//   $a5de  vx = $ffff4000 (-0.75)
//   $a5e6  ax = $38, $a5ee  ay = $6
function* acceleratingEscort(o, world, parent, dx, dy) {    // $a70a
  allocDefaults(o);
  o.x = parent.x + dx; o.y = parent.y + dy;
  o.hp = 0xc0;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.setHandle(Math.random() < 0.5 ? 0x0013 : 0x0213);      // $a718 -> $a832
  o.vx = -GROUND_SCROLL; o.vy = 0;
  while (o.x > 336) { if (o.done) return; yield; }         // $a71c
  for (;;) {
    if (o.done || o.x + world.leftExtent(o) < -48) return;
    yield;
  }
}

function* acceleratingUnit(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = -0x4000 / 65536 - 0.5;                        // $ffff4000 = -0.75
  o.vy = 0;
  o.ax = 0x38 / 65536;                                 // $a5e6
  o.ay = 0x06 / 65536;                                 // $a5ee
  const escorts = [                                       // $a63e-$a6a4
    world.spawnChildOf(o, (c, wd) => acceleratingEscort(c, wd, o, 0, -0x0e), {}),
    world.spawnChildOf(o, (c, wd) => acceleratingEscort(c, wd, o, 0x0e, 0x0e), {}),
    world.spawnChildOf(o, (c, wd) => acceleratingEscort(c, wd, o, -0x0a, 4), {}),
  ];
  o.playFrames([0x0034, 0x0234, 0x9000]);               // $a624
  o.hp = 0x7d00; o.scoreAward = 5;                      // $a62e/$a634
  o.x += world.leftExtent(o);
  while (o.x > 336) { if (o.done) return; yield; }      // $a63a
  while (escorts.some(c => !c.done)) {                  // $a6a8
    if (o.done) return;
    yield;
  }
  o.hp = 0x140;                                         // $a6bc
  o.vx = 0x1000 / 65536;
  o.ax = 0x200 / 65536;
  for (let frame = 0; frame <= 0x32; frame++) { if (o.done) return; yield; }
  o.ax = -o.ax;                                         // $a6dc
  for (;;) {
    const y = o.y; o.y += 5;
    if (world.spawnCarrier) world.spawnCarrier(o);      // $a6fc -> $6852
    o.y = y;
    const wait = 0x32 + ((Math.random() * 0x40) | 0);
    for (let frame = 0; frame <= wait; frame++) { if (o.done) return; yield; }
  }
}

// $09210 / $0921a -- 7 records, res 55. A ground hill that carries a routine
// pointer in $92 and spawns it as a child.
//   $9210  $92 = $99a4   |  $921a  $92 = $9fa2
//   $9222  sprite $0e37 (res 55 game index 7, a 4-slice chain)
//   $9226  y = $6a(a6) - $21 (33)
//   $9256  $44 = $7d06 collidable, $48 = $6772 death
//   $9272  x += $30 ; $9278 terrain lock
//   $927c  spawn whatever $92 holds, then $8240 advance
function* hillWithChild(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  // $9210/$921a: lane -$21 with sprite $0e37. $91f6: lane -$c with $1037.
  const alt = spec.__addr === '$091f6';
  o.y = (world.ground || 0) - (alt ? 0x0c : 0x21);      // $9208 / $9226
  yield* entryGate(o, world, spec.trigger || 0);
  o.setHandle(alt ? 0x1037 : 0x0e37);                   // chain heads
  o.collides = true;                                    // $9256 $44 = $7d06
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__invulnerable = true;                              // $925e $48 = $6772, a bare rts
  o.x += 0x30;                                          // $9272
  o.vx = -GROUND_SCROLL; o.vy = 0;                      // $8730
  o.x += world.leftExtent(o);
  // $927c: $92 holds a ROUTINE ADDRESS, and $9288 spawns exactly that. All
  // three are transcribed, so run the real companion rather than a stand-in.
  // Each companion offsets ITSELF before running its body, and none of those
  // offsets survived into child_routines.json -- so the port dropped all three
  // at the hill's own anchor, which is why they sat inside the mound instead of
  // standing on it.
  //
  //   $099a4  y -= $34            res 11, the missile shooter
  //   $09fa2  x += $a,  y -= $28  res 7, $92 = $1a
  //   $09f8e  x += $1e, y -= $1a  res 7, $92 = $37
  const COMPANION = {
    '$091f6': { routine: '$09f8e', dx: 0x1e, dy: -0x1a },
    '$09210': { routine: '$099a4', dx: 0,    dy: -0x34 },
    '$0921a': { routine: '$09fa2', dx: 0xa,  dy: -0x28 },
  };
  const companion = COMPANION[spec.__addr];
  if (companion)
    spawnRoutineChild(o, world, companion.routine, companion.dx, companion.dy);
  while (o.x > 336) { if (o.done) return; yield; }      // $8240
  for (;;) { if (o.done) return; yield; }               // $7d46
}

// $0ab16 -- 3 records, res 17. Another carrier: it acquires res $11, spawns one
// $ab58 through $80fe, clears that child's $92 and gives it a randomised
// heading ($28 = $80 + (rand & $1f) - $10, i.e. 128 +- 16), then terminates.
//
// The child is the real enemy, and it builds a train. At $abbc it waits 7
// frames, and while its $92 is under 5 it spawns another copy of itself,
// copying its heading across and incrementing $92 -- so one record becomes a
// five-segment chain flying in formation on a shared heading. Each segment
// then runs the byte script at $ac32, rewinding whenever it reads a negative.
//
// $abec sets $26 = $200. That is the value this port had been carrying as an
// invented DEFAULT_SPEED, now read from the code rather than assumed.
const AB58_SPEED = 0x200;               // $0abec
const AB58_CHAIN = 6;                   // $0abc2: indices 0..5, then bcc
const repeatCommand = (count, duration, turn) =>
  Array.from({ length: count }, () => [duration, turn]);
const AB58_PATH = [                                             // $ac32
  [10, 0], [4, -20],
  ...repeatCommand(20, 6, 16), ...repeatCommand(16, 8, -16),
  [10, -24], [10, -20], ...repeatCommand(2, 10, -16),
  ...repeatCommand(4, 10, 16), ...repeatCommand(8, 10, -16),
  ...repeatCommand(4, 10, 16), ...repeatCommand(4, 10, -16),
  ...repeatCommand(4, 10, 16), ...repeatCommand(4, 10, -16),
  ...repeatCommand(4, 10, 16), ...repeatCommand(4, 10, -16),
  ...repeatCommand(4, 10, 16),
];

function* ab58Segment(o, world, heading, index, root) {
  allocDefaults(o);
  const damageRoot = root || o;
  o.depth = (o.depth || 0) + index + 8;                 // $ab60-$ab6a
  o.hp = 0x1e0; o.scoreAward = 5;                       // $ab6e / $ab74
  o.collides = true;
  o.onHitPlayer = (self, w2) => { w2.damage(self, 1); };
  if (index > 0) {
    o.hp = 0x10;                                        // $ab8e
    o.__damageTo = damageRoot;                          // $ab9c -> $cd22
    o.__bodyDamageTo = damageRoot;                      // $aba4 -> $cd22
    o.__onDeath = (self, wd) => centeredBurstDeathEffect(wd, self); // $abac -> $88d8
  }
  o.setHandle(index === 0 ? 0x0011 : 0x0211);             // $ab80/$abb4
  for (let i = 0; i <= 7; i++) { if (o.done) return; yield; }   // $abbc, $8076
  if (index + 1 < AB58_CHAIN) {                         // $abc2
    world.spawnChildOf(o, function* (c, wd) {
      c.x = o.x; c.y = o.y;
      yield* ab58Segment(c, wd, heading, index + 1, damageRoot); // $abd4-$abe0
    }, {});
  }
  o.angle = heading & 0xff;
  o.speed = AB58_SPEED;                                 // $abec, raw $26
  o.setVelocity();                                      // $abf2, $75b2
  while (o.x > 336) { if (o.done) return; yield; }      // $abf6, $8240
  for (;;) {
    for (const [duration, turn] of AB58_PATH) {
      for (let frame = 0; frame <= duration; frame++) {   // $acd8
        if (index > 0 && damageRoot.done) {
          centeredBurstDeathEffect(world, o);             // owner gone -> hp 0 -> $88d8
          return;
        }
        if (o.done || o.x + world.leftExtent(o) < -48) return;
        yield;
      }
      o.angle = (o.angle + turn) & 0xff;                  // $ac20 -> $75ae
      o.setVelocity();
    }
  }
}

function* headingSpawner(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  const heading = (0x80 + ((Math.random() * 32) | 0) - 0x10) & 0xff;   // $ab34
  world.spawnChildOf(o, function* (c2, wd) {
    c2.x = o.x; c2.y = o.y;
    yield* ab58Segment(c2, wd, heading, 0);
  }, {});
  return;                                               // $ab54
}

// $0b766 -- 3 records, res 47. A heavy unit: hp $c80 (3200), score $14 (20).
//   $b766/$b76e/$b776  lanes 76 / 100 / 112
//   $b79e  $50 = $ff        one handler disabled
//   $b7a4  x += $20 ; $b7aa terrain lock ; $b7ae death handler $8746
//   $b7c0  three calls to $b7dc
const B766_LANES = { '$0b766': 0x4c, '$0b76e': 0x64, '$0b776': 0x70 };

// $b7dc: one firing cycle. Called three times, and both barrels fire from an
// offset lane rather than the object's own -- up 8 for the first, down 8 for
// the second -- which is what makes it read as a twin mount.
function* b7dcCycle(o, world) {
  const wait = 0x64 + ((Math.random() * 0x20) | 0);   // $b7e0/$b7e4, 100..131
  for (let i = 0; i <= wait; i++) { if (o.done) return; yield; }   // $b7e8
  o.y -= 8;                                          // $b7ec
  if (world.spawnCarrier) world.spawnCarrier(o);     // $b7f0 $6852
  o.y += 8;                                          // $b7f4
  for (let i = 0; i <= 0x14; i++) { if (o.done) return; yield; }   // $b7f8
  o.y += 8;                                          // $b7fe
  if (world.spawnCarrier) world.spawnCarrier(o);     // $b802
  o.y -= 8;                                          // $b806
}

function* heavyUnit(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = B766_LANES[spec.__addr] !== undefined ? B766_LANES[spec.__addr] : 0x4c;
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0xc80; o.scoreAward = 0x14;                   // $b792 / $b798
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__onDeath = (self, wd) => pairedBlastDeathEffect(wd, self); // $b7ae -> $8746
  o.x += 0x20;                                         // $b7a4
  terrainLock(o, world);                               // $b7aa $8730
  o.vy = 0;
  o.setHandle(world.firstHandleOfResource(47));
  o.x += world.leftExtent(o);
  // $b7c0/$b7c2/$b7c4: three cycles, then the routine falls through and ends.
  for (let n = 0; n < 3; n++) {
    if (o.done) return;
    yield* b7dcCycle(o, world);
  }
  for (;;) { if (o.done) return; yield; }
}

// $0a378 -- 3 records, res 45. Rises, then reverses under acceleration.
//   $a384  hp $500 (1280), score 5
//   $a390  y = $6a(a6) + $30      starts BELOW the ground line
//   $a39c  x = $13c (316)
//   $a3a2  vy = $fffd (-3)  ; $a3a8 ay = $7c0
//   $a3c2  ax = $180 ; run $50 (81) frames
//   $a3d4  vx = 0 ; ax = $fffff800 ; vy = $500
function* riser(o, world, spec) {
  allocDefaults(o);
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x500; o.scoreAward = 5;                      // $a384 / $a38a
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.y = (world.ground || 0) + 0x30;                    // $a390
  o.x = 0x13c;                                         // $a39c
  o.vy = -3;                                           // $a3a2
  o.ay = 0x7c0 / 65536;                                // $a3a8
  o.setHandle(0x002d);
  o.__noCull = true;                                   // $a3b8
  o.ax = 0x180 / 65536;                                // $a3c2
  for (let i = 0; i <= 0x50; i++) { if (o.done) return; yield; }
  o.__noCull = false;                                  // $a3d0
  o.vx = 0;                                            // $a3d4
  o.ax = -0x800 / 65536;                               // $a3d8
  o.vy = 0x500 / 65536;                                // $a3e0
  o.ay = 0x60 / 65536;                                 // $a3e8

  const volley = function* (headings, script) {
    const y = o.y;
    for (let index = 0; index < headings.length; index++) {
      o.y = y - 0x0c - index * 4;
      if (world.spawnProjectile) world.spawnProjectile(o, headings[index]);
    }
    o.y = y;
    for (let frame = 0; frame <= 0x0c; frame++) { if (o.done) return false; yield; }
    for (let frame = 0; frame <= 0x3c; frame++) { if (o.done) return false; yield; }
    o.playFrames(script);
    o.ax = -o.ax;
    for (let frame = 0; frame <= 0x46; frame++) { if (o.done) return false; yield; }
    return true;
  };
  const leftScript = [0x002d, 0x042d, 0x062d, 0x082d, 0x0a2d, 0x0c2d, 0xb000];
  const rightScript = [0x002d, 0x082d, 0x062d, 0x042d, 0x022d, 0x002d, 0xb000];
  if (!(yield* volley([0x84, 0x88, 0x8c], leftScript))) return;   // $a402
  if (!(yield* volley([0xfc, 0xf8, 0xf4], rightScript))) return;  // $a42a
  yield* volley([0x84, 0x88, 0x8c], leftScript);                  // $a3f4
}

function* multiSpawner(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  spawnRes28Formation(o, world, RES28_FORMATIONS[spec.__addr] || []);
  return;                                              // $bea6 -> $bfc2
}

// $0bd52 / $0bcba -- 5 records, res 25. Ground units carrying $92/$94/$96
// parameters and a randomised wait loop.
//   $bd52  x = -$20, $96 = 1,  y = ground - $d
//   $bcba           $96 = -2, y = ground - $25
//   $bd8c  hp $40, score 2 ; loop: wait (rand & $1f) + $32
// Four entry points, two on the ground and two on the ceiling. The ground pair
// reads $6a(a6) and SUBTRACTS its lane (the object stands on the floor); the
// ceiling pair reads $68(a6) and ADDS it (the object hangs below the roof), and
// mirrors the sign of the $92/$94 firing angles to match.
//   $0bcba  ground  $96 -2  $92 -$60  $94 -$50  lane $25         one-shot
//   $0bd52  ground  $96  1  $92 -$60  $94 -$50  lane $0d  x -$20 looping
//   $0bc94  ceiling $96 -2  $92 +$60  $94 +$50  lane $25         one-shot
//   $0bd26  ceiling $96  1  $92 +$60  $94 +$50  lane $0d  x -$20 looping
// Shared tail ($bcd8 / $bd76): acquire res $19, sound $4a, entry gate, hp $40,
// score 2, $be36, $8240; then either one pass or a randomised loop.
const BD52_CFG = {
  '$0bcba': { x: null,  v: -2, lane: 0x25, ceiling: false, loop: false },
  '$0bd52': { x: -0x20, v:  1, lane: 0x0d, ceiling: false, loop: true  },
  '$0bc94': { x: null,  v: -2, lane: 0x25, ceiling: true,  loop: false },
  '$0bd26': { x: -0x20, v:  1, lane: 0x0d, ceiling: true,  loop: true  },
};
const BD52_WALK_NEG = [0x0019, 0x0219, 0x0419, 0x9000];       // $be4c
const BD52_WALK_POS = [0x0419, 0x0219, 0x0019, 0x9000];       // $be3e
const BD52_ATTACK = [0x800a, 0x0419, 0x0619, 0xa000, 0x0619,
                     0x0819, 0xa000, 0x0819, 0xa000, 0xb000]; // $bde4
const BD52_RECOVER = [0x8008, 0x0619, 0x0419, 0xa000, 0xb000]; // $be22

function* paramUnit(o, world, spec) {
  allocDefaults(o);
  const cfg = BD52_CFG[spec.__addr] || BD52_CFG['$0bd52'];
  o.x = cfg.x !== null ? cfg.x : SPAWN_TEMPLATE.x;
  const sign = cfg.ceiling ? 1 : -1;
  const base = cfg.ceiling ? (world.ceiling || 0) : (world.ground || 0);
  o.y = base + sign * cfg.lane;
  o.variant = cfg.v;                                   // $96
  o.flip = cfg.ceiling;                                // $bc9a/$bd32: $38 = 2
  const aimA = sign * 0x60;                            // $92
  const aimB = sign * 0x50;                            // $94
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = spec.hp !== undefined ? spec.hp : 0x40;       // $bd8c
  o.scoreAward = spec.score !== undefined ? spec.score : 2;   // $bd92
  o.setHandle(0x0019);                                 // $bd76: acquire res $19
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  // $be36: vx comes straight from $96, so the sprite's facing and its drift
  // are the same number.
  o.vx = cfg.v; o.vy = 0;
  const walkScript = cfg.v < 0 ? BD52_WALK_NEG : BD52_WALK_POS;
  o.playFrames(walkScript);                            // $be36
  o.x += world.leftExtent(o);
  while (o.x > 336) { if (o.done) return; yield; }     // $8240

  // $bdd6: decelerate by one toward rest, then fire -- always at $94, and at
  // $92 as well on a roughly 1-in-3 roll ($86fe >= $5999 of $ffff).
  function* attack() {
    o.vx -= cfg.v < 0 ? -1 : 1;                        // $bdd6 sub.w d0
    o.playFrames(BD52_ATTACK);                         // $bde4
    yield* waitScript(o);
    if (Math.random() * 0xffff >= 0x5999 && world.spawnProjectile)
      world.spawnProjectile(o, aimA);
    yield* waitScript(o);
    if (world.spawnProjectile) world.spawnProjectile(o, aimB);
    yield* waitScript(o);
    o.playFrames(BD52_RECOVER);                        // $be22
    yield* waitScript(o);
    o.playFrames(walkScript);                          // $be36
  }

  if (!cfg.loop) {                                     // $bcba: one pass
    for (let i = 0; i <= 0x32; i++) { if (o.done) return; yield; }
    yield* attack();
    for (;;) { if (o.done) return; yield; }            // $7d46
  }
  for (;;) {                                           // $bda0
    if (o.done) return;
    const wait = ((Math.random() * 32) | 0) + 0x32;    // $bda6
    for (let i = 0; i <= wait; i++) { if (o.done) return; yield; }
    yield* attack();
  }
}

// $0c118 .. $0c15e -- six entries into one set-piece at $c1a4 (res $1b, sound
// $48). It flies in, halts, and then tears itself apart on a fixed schedule:
//
//   hp $140, score 6, one-shot death handler $58 = $876c
//   ax = $400 ; $8240 advance until x <= 336
//   30 frames ; $89cc halt ; 20 frames
//   4 x $c24e ; 45 frames
//   ax = $400, ay = $600 (negated on a coin flip) ; 4 x $c24e ; negate ay
//   45 frames ; 2 x $c24e ; run while alive ; release and terminate
//
// The entries differ only in where it starts and how it drifts:
const C118_CFG = {
  '$0c118': { dy: -0x14, vx: -2 },
  '$0c120': { dy:  0x10, vx: -2 },
  '$0c128': { dy:  0x34, vx: -2 },
  '$0c136': { ground: true, dx: -0x50, vy: -3, ay:  0x200 / 65536 },
  '$0c14a': { ceiling: true, dx: -0x50, vy: 3, ay: -0x200 / 65536 },
  '$0c15e': { y: 0x14, vx: -6, vy: 1, ay: -0x200 / 65536 },
};
const C24E_RECOIL = [0x041b, 0x021b, 0x001b, 0xa000, 0xb000]; // $c266

function* crashDiver(o, world, spec) {
  allocDefaults(o);
  const cfg = C118_CFG[spec.__addr] || C118_CFG['$0c118'];
  o.x = SPAWN_TEMPLATE.x;
  if (cfg.ground) o.y = world.ground || 0;
  else if (cfg.ceiling) o.y = world.ceiling || 0;
  else if (cfg.y !== undefined) o.y = cfg.y;
  else o.y = SPAWN_TEMPLATE.y + cfg.dy;
  if (cfg.dx) o.x += cfg.dx;
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x140; o.scoreAward = 6;                      // $c1ba / $c1c0
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__onDeath = (self, wd) => centeredBlastDeathEffect(wd, self); // $c1c6 -> $876c
  o.vx = cfg.vx || 0; o.vy = cfg.vy || 0;
  o.ax = 0x400 / 65536;                                // $c1d6
  if (cfg.ay) o.ay = cfg.ay;
  o.playFrames([0x001b, 0xb000]);                       // $c1ce
  o.x += world.leftExtent(o);
  while (o.x > 336) { if (o.done) return; yield; }      // $c1de $8240
  const boom = function* () {                           // $c24e
    const x = o.x - 5, y = o.y - 0x0f;
    if ((world.projectiles || 0) < PROJECTILE_POOL) {   // $68a6
      world.spawn((fx, wd) => boss1Charge(fx, wd, { x: x - 0x18, y }), {});
      world.spawnChildOf(o, function* (shot, wd) {
        shot.x = x; shot.y = y; shot.__addr = '$066a4';
        yield* crashDiverShot(shot, wd);
      }, {});
    }
    o.playFrames(C24E_RECOIL);
    yield* waitScript(o);
    for (let frame = 0; frame <= 2; frame++) { if (o.done) return; yield; }
  };
  const run = function* (n) {
    for (let i = 0; i <= n; i++) { if (o.done) return true; yield; }
    return false;
  };
  if (yield* run(0x1e)) return;                        // $c1e2
  o.vx = o.vy = o.ax = o.ay = 0;                       // $89cc halt
  if (yield* run(0x14)) return;                        // $c1ec
  yield* boom(); yield* boom(); yield* boom(); yield* boom(); // $c1f2..$c1f8
  if (yield* run(0x2d)) return;                        // $c1fa
  o.ax = 0x400 / 65536;                                // $c200
  o.ay = 0x600 / 65536;                                // $c208
  if (Math.random() * 0xffff >= 0x7fff) o.ay = -o.ay;  // $c210 coin flip
  yield* boom(); yield* boom(); yield* boom(); yield* boom(); // $c21e..$c224
  o.ay = -o.ay;                                        // $c226
  if (yield* run(0x2d)) return;                        // $c22a
  yield* boom(); yield* boom();                        // $c230 / $c232
  for (;;) { if (o.done) return; yield; }              // $7d46
}

// $099b4 -- res 11 ground unit, hp $180, score 3, death handler $9a36.
function* groundUnit11(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = (world.ground || 0) - 0x14;                    // $99ba
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x180; o.scoreAward = 3;                      // $99d4 / $99da
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__afterDamage = (self, _amount, killed, wd) => {
    if (killed) return;                             // $9a3a beq skips the bursts
    wd.spawn((burst, world2) => hitBurst(burst, world2, self.x, self.y - 8), {});
    wd.spawn((burst, world2) => hitBurst(burst, world2, self.x, self.y + 8), {});
  };
  o.vx = -GROUND_SCROLL; o.vy = 0;
  o.setHandle(world.firstHandleOfResource(11));
  o.x += world.leftExtent(o);
  for (;;) { if (o.done) return; yield; }
}

const A866_SCRIPT = [                                      // $a9ac
  [6,16], [6,16], [6,16], [6,16], ['volley'],
  [6,16], [6,16], [6,16], [6,16], [6,16], [6,16], [6,16], [6,16], ['effect'],
  [6,16], [6,16], [6,16], [6,16], [1,8], [1,8], [1,8], [2,8],
  [6,-4], [6,4], [6,-4], [6,4], [2,8], [1,8], [1,8], [1,8],
  [6,-16], [6,-16], [6,-16], [6,-16], [6,-16], [6,-16], [6,-16], [6,-16],
  [6,-16], [6,-16], [6,-16], [6,-16], [6,-16], [6,-16], [6,-16], [6,-16],
  [120,0], [120,0],
];

function a866Volley(o, world) {                            // $aa26 -> $66fc
  for (const angle of [0x88, 0x84, 0x80, 0x7c, 0x78])
    if (world.spawnProjectile) world.spawnProjectile(o, angle);
}

function* a866Segment(o, world, index, root) {             // $a866
  allocDefaults(o);
  root ||= o;
  o.depth = SPAWN_TEMPLATE.depth + index + 8;             // $a87a-$a884
  o.hp = index === 0 ? 0x140 : 0x10;
  o.scoreAward = index === 0 ? 5 : 0;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.setHandle(index === 0 ? 0x0402 : 0x1402);              // $a89a/$a8e8
  o.flipX = index === 0;                                   // $a8a2
  if (index > 0) {
    o.__damageTo = root;                                   // $aaae owner walk
    o.__bodyDamageTo = root;
    o.__onDeath = (self, wd) => pairedBlastDeathEffect(wd, self); // $a8e0
  }
  for (let frame = 0; frame <= 5; frame++) { if (o.done) return; yield; }
  if (index < 5)
    world.spawnRetained(o, function* (child, wd) {
      child.x = o.x; child.y = o.y;
      yield* a866Segment(child, wd, index + 1, root);
    }, {});
  o.x = 0x110; o.y = (world.ceiling || 0) - 0x10;          // $a91a-$a926
  o.angle = 0x40; o.speed = 0x200; o.setVelocity();        // $a92c-$a938
  o.__noCull = true;
  for (let frame = 0; frame <= 0x1e; frame++) { if (o.done) return; yield; }
  o.__noCull = false;
  for (;;) {
    for (const command of A866_SCRIPT) {
      if (o.done || (index > 0 && root.done)) return;
      if (command[0] === 'volley') {
        if (index === 0) a866Volley(o, world);
        continue;
      }
      if (command[0] === 'effect') {
        if (index === 0)
          world.spawn((fx, wd) => hitBurst(fx, wd, o.x - 0x0c, o.y + 8), {});
        continue;
      }
      const [duration, turn] = command;
      for (let frame = 0; frame <= duration; frame++) {
        if (o.done || (index > 0 && root.done)) return;
        yield;
      }
      o.angle = (o.angle + turn) & 0xff;
      o.setVelocity();                                    // $a992 -> $75ae
    }
  }
}

// $0a850 -- spawns the real $a866 formation, clears its index, then terminates.
function* clearSpawner(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  world.spawnChildOf(o, function* (root, wd) {
    root.x = o.x; root.y = o.y;
    yield* a866Segment(root, wd, 0, root);
  }, {});
}

// $0c17a -- res 27. Falls with decaying vertical acceleration.
//   $c17a  y = $32 (50) ; vx = -3 ; vy = 1 ; ay = $fffffe00
function* faller(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = 0x32;
  yield* entryGate(o, world, spec.trigger || 0);
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.vx = -3; o.vy = 1;                                 // $c180 / $c186
  o.ay = -0x200 / 65536;                               // $c18c
  o.setHandle(world.firstHandleOfResource(27));
  o.x += world.leftExtent(o);
  for (;;) { if (o.done) return; yield; }
}

// $0b01a / $0c4e6 / $0d6d4 / $0dd2e all OPEN with `bsr $8ae2; beq $7ec6` --
// the shared entry gate, terminating if the object died on the way in. That is
// the preamble, not the routine: each one continues past it into a segmented
// enemy whose body is a run of children ($0b01a: 6, $0c4e6: 4, $0dd2e: 1 --
// $0de66, in the boss region). They are handled by the generic waveEnemy path,
// which already applies the extracted fields and spawns spec.children.

// $09482 -- the stage 1 boss.
//
//   $993e  acquire res 14/15 and sound 70
//   $80d0  spawn and retain the body ($94de)
//   hp $1f40 (8000), score 0, x -= $3c, y -= $b, speed $100
//   $971e  attach the frame script
//   $959a  become vulnerable: install the $7d06 hit handler, x += 56
//   $48 = $ff  (no death handler -- the boss does not explode on contact)
//   $9610  the flight path, below
//   $996c  teardown: release sound 75, res 6, sound 70
//
// $9610 is a waypoint list. Each `move.l #$xxxxyyyy,$92(a5)` writes the pair
// $92 = target x and $94 = target y, and $9744 flies there at the current $26
// speed. The list runs forever ($96d2 branches back to the top).
const BOSS1_PATH = [
  [0x100, 0x100, 0x5c], [0x100, 0x088, 0x3c], [0x100, 0x088, 0x64],
  [0x100, 0x0f0, 0x6e], [0x100, 0x0f0, 0x78], [0x200, 0x0c8, 0x78],
  [0x100, 0x0f0, 0x3c], [0x100, 0x0c8, 0x5c], [0x400, 0x020, 0x5c],
  [0x100, 0x0a8, 0x28], [0x100, 0x000, 0x32], [0x100, 0x000, 0x78],
  [0x100, 0x0a8, 0x6e],
];

const BOSS1_PHASE_HP = 0x0fa0;                              // $9884
const BOSS1_ATTACK_RELOAD = 0x0c8;                          // $9788
const BOSS1_BODY_INITIAL = 0x1f4;                           // $94f0
const BOSS1_BODY_RELOAD = 0x19a;                            // $9850
const BOSS1_CHARGE = [0x0005, 0x0205, 0x0405, 0x0605, 0x0805,
                      0x0a05, 0x0c05, 0x0e05, 0x1005, 0x1205,
                      0xa000, 0xb000];                       // $8918
const BOSS1_MISSILE = [0x0404, 0x0604, 0x9000];             // $cf48

function* boss1Missile(o, world, from) {
  allocDefaults(o);
  o.__enemyShot = 'boss1Missile';
  o.x = from.x - 0x0c; o.y = from.y + 0x0e;                 // $979a + $cf28/$cf2e
  o.vx = -4; o.vy = 0; o.ax = 0; o.ay = 0;                 // $cf32
  o.depth = 0x4a38;
  o.collides = true;
  o.__invulnerable = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.playFrames(BOSS1_MISSILE);
  for (;;) {
    if (o.done || o.x < -48) return;
    yield;
  }
}

function* boss1Charge(o, world, from) {
  o.x = from.x; o.y = from.y; o.depth = DEATH_DEPTH;
  o.__boss1Smoke = true;                                    // $8918
  o.collides = false;
  o.playFrames(BOSS1_CHARGE);
  while (o.scriptOn) { if (o.done) return; yield; }
}

function boss1FragmentAttack(world, from) {                  // $98ce -> $cf7c twice
  world.spawn((o, wd) => fragmentShower(o, wd, from.x, from.y), {});
  world.spawn((o, wd) => fragmentShower(o, wd, from.x, from.y), {});
}

function* boss1FormationShot(o, world, angle) {              // $6518
  allocDefaults(o);
  o.__enemyShot = 'boss1FormationShot';
  world.projectiles = (world.projectiles || 0) + 1;
  try {
    o.depth = 0x4e40;
    o.speed = 0x180;
    o.angle = angle & 0xff;
    o.collides = true;
    o.__invulnerable = true;
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    o.setHandle(0x2604);                                    // $653e inline script
    o.setVelocity();
    for (;;) {
      if (o.done || o.x < -48 || o.x > 400 || o.y < -48 || o.y > 260) return;
      yield;
    }
  } finally {
    world.projectiles--;
  }
}

function boss1Formation(world, from) {                       // $67cc
  const p = world.player;
  if (!p || (world.projectiles || 0) >= PROJECTILE_POOL) return;
  const x = from.x, y = from.y;                              // $80fe copies $e/$12
  const base = Math.round(Math.atan2(p.y - from.y, (p.x + 8) - from.x) * 256 /
                          (2 * Math.PI)) & 0xff;
  for (const offset of [0, -0x24, -0x18, -0x0c, 0x0c, 0x18, 0x24])
    world.spawnChildOf(from, function* (shot, wd) {
      shot.x = x; shot.y = y;
      yield* boss1FormationShot(shot, wd, (base + offset) & 0xff);
    }, {});
}

const B01A_SEGMENTS = [
  { addr: '$0b112', xOffset: 0,  y: -0x44, depth: 0x31e,
    ayStep: -2.625, handle: 0x0016, attackDy: 6,
    attacks: ['aimed', 'carrier'] },
  { addr: '$0b19a', xOffset: -1, y: -0x36, depth: 0x31d,
    ayStep: -1.875, handle: 0x0216, attackDy: 14,
    attacks: ['aimed', 'carrier'] },
  { addr: '$0b22e', xOffset: 9,  y: -0x20, depth: 0x31c,
    ayStep: -1, handle: 0x0416, attackDy: 0,
    attacks: [null, null] },
];

function b01aAttack(world, o, attack) {
  if (attack === 'aimed' && world.spawnAimedShot) world.spawnAimedShot(o);
  if (attack === 'carrier' && world.spawnCarrier) world.spawnCarrier(o);
}

function* b01aSteppedMove(o, delta) {                        // $b504/$b528
  for (let step = 0; step < 7; step++) {
    o.y += delta;
    for (let frame = 0; frame < 3; frame++) {
      if (o.done) return false;
      yield;
    }
  }
  return true;
}

function* b01aMotion(o, world, cfg) {                        // $b452
  let alternate = 0;
  o.vy = 0;
  if (!(yield* b01aSteppedMove(o, -cfg.ayStep))) return;
  o.vy = -1;
  let reverseTimer = 0x3a, attackTimer = 0x32;
  for (;;) {
    if (o.done) return;
    if (--attackTimer === 0) {
      const savedVy = o.vy;
      o.vy = 0;
      if (!(yield* b01aSteppedMove(o, cfg.ayStep))) return;
      for (let frame = 0; frame < 8; frame++) { if (o.done) return; yield; }
      const y = o.y;
      o.y += cfg.attackDy;
      b01aAttack(world, o, cfg.attacks[alternate]);
      o.y = y;
      alternate ^= 1;
      for (let frame = 0; frame < 0x14; frame++) { if (o.done) return; yield; }
      if (!(yield* b01aSteppedMove(o, -cfg.ayStep))) return;
      o.vy = savedVy;
      attackTimer = 0x32;
    }
    if (--reverseTimer === 0) {
      o.vy = -o.vy;
      reverseTimer = 0x74;
    }
    yield;
  }
}

function* b01aSegment(o, world, boss, cfg, mirrored) {
  allocDefaults(o);
  o.__addr = cfg.addr;
  o.x = boss.x + cfg.xOffset;
  o.y = mirrored ? 0xb8 - cfg.y : cfg.y;                     // $b562
  o.flip = mirrored;                                         // $b582
  o.depth = cfg.depth;
  o.__noCull = true;                                         // $b128/$b1aa/$b23e
  o.hp = boss.hp; o.scoreAward = 0;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  if (CHILD_DEATH_EFFECTS[cfg.addr])
    o.__onDeath = (self, wd) => CHILD_DEATH_EFFECTS[cfg.addr](wd, self);
  o.setHandle(cfg.handle);
  for (let frame = 0; frame < 0x6b; frame++) {
    if (o.done || boss.done) return;
    yield;
  }
  const motion = mirrored
    ? { ...cfg, ayStep: -cfg.ayStep, attackDy: -cfg.attackDy }
    : cfg;
  yield* b01aMotion(o, world, motion);
}

function* stage2Phase2Attacker(o, world) {                   // $b3b6
  allocDefaults(o);
  o.hp = 0x80; o.scoreAward = 2;
  o.depth = 0x320;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.setHandle(0x0217);
  o.angle = 0x80; o.speed = 0; o.setVelocity();
  o.__noCull = true;
  for (let frame = 0; frame < 0x12c; frame++) {              // $b3f6
    if (o.done) return;
    o.angle = (o.angle + 1) & 0xff;
    o.speed += 3;
    o.setVelocity();
    yield;
  }
  if (world.spawnAimedShot) world.spawnAimedShot(o);         // $b408
  o.__noCull = false;
  for (;;) {
    if (o.done) return;
    o.angle = (o.angle + 1) & 0xff;
    o.speed += 3;
    o.setVelocity();
    yield;
  }
}

function* stage2BossPhase2Death(o, world) {                  // $b36a
  o.vx = o.vy = o.ax = o.ay = 0;
  o.collides = false;
  world.score += o.scoreAward;
  o.scoreAward = 0;
  world.spawnChildOf(o, function* (emitter, wd) {            // $835a d0=$18,d1=6
    emitter.x = o.x; emitter.y = o.y;
    for (let burst = 0; burst < 0x18; burst++) {
      const x = emitter.x + ((Math.random() * 0x20) | 0) - 0x10;
      const y = emitter.y + ((Math.random() * 0x20) | 0) - 0x10;
      wd.spawn((fx, world2) => hitBurst(fx, world2, x, y), {});
      for (let frame = 0; frame <= 6; frame++) yield;
    }
  }, {});
  for (let frame = 0; frame <= 0x0c; frame++) yield;
  yield;                                                     // $8714
  for (let frame = 0; frame <= 0x12c; frame++) yield;
  o.x = 0x190;                                               // $b38c
}

function* stage2BossPhase2(o, world) {                       // $b2c6
  allocDefaults(o);
  o.__addr = '$0b2c6';
  o.hp = 0x12c0; o.scoreAward = 0x28;
  o.depth = 0x320;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.setHandle(0x0017);
  o.__onLethal = (self) => {
    self.dying = true;
    self.__invulnerable = true;
    self.hp = 0;
  };
  world.registerBoss(o);
  for (;;) {
    if (o.dying) { yield* stage2BossPhase2Death(o, world); return; }
    o.vy = 0;
    for (let attacker = 0; attacker < 8; attacker++) {       // $b394
      world.spawnChildOf(o, function* (child, wd) {
        child.x = o.x; child.y = o.y;
        yield* stage2Phase2Attacker(child, wd);
      }, {});
      for (let frame = 0; frame <= 0x23; frame++) {
        if (o.done) return;
        if (o.dying) { yield* stage2BossPhase2Death(o, world); return; }
        yield;
      }
    }
    o.vy = o.y < 0x5c ? 0.5 : -0.5;                         // $b354
    for (let frame = 0; frame <= 0x64; frame++) {
      if (o.done) return;
      if (o.dying) { yield* stage2BossPhase2Death(o, world); return; }
      yield;
    }
  }
}

function* stage2Boss(o, world, spec) {                       // $0b01a
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x3c0; o.scoreAward = 0; o.depth = 0x320;
  o.setHandle(0x0017);
  o.collides = false;
  o.__onDeath = (self, wd) => {                              // $b436
    wd.spawnChildOf(self, function* (phase2, world2) {
      phase2.x = self.x; phase2.y = self.y;
      yield* stage2BossPhase2(phase2, world2);
    }, {});
  };
  o.vx = -2; o.vy = 0;
  while (o.x >= 0xf6) { if (o.done) return; yield; }         // $b54e
  o.vx = 0;
  world.registerBoss(o);
  for (const cfg of B01A_SEGMENTS) {
    world.spawnChildOf(o, (c, wd) => b01aSegment(c, wd, o, cfg, false), {});
    world.spawnChildOf(o, (c, wd) => b01aSegment(c, wd, o, cfg, true), {});
  }
  for (let frame = 0; frame < 0x6b; frame++) { if (o.done) return; yield; }
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  yield* b01aMotion(o, world, { ayStep: 0, attackDy: 0, attacks: [null, null] });
}

const C4E6_AUX = [
  { addr: '$0cbc4', y: 0x60, script: [0x001f, 0x021f, 0x041f, 0x061f, 0x9000], vy: -1 },
  { addr: '$0cbe6', y: 0x90, script: [0x081f, 0x0a1f, 0x0c1f, 0x0e1f, 0x9000], vy: 1 },
  // These two constants are hardware scan-line coordinates; the visible
  // canvas starts at $80. Keeping the raw values put both patrols below-screen.
  { addr: '$0ca9c', y: 0xe2 - 0x80, patrol: true, vy: -1 },
  { addr: '$0caaa', y: 0x152 - 0x80, patrol: true, vy: 1 },
];

function* c4e6Aux(o, world, boss, cfg) {
  allocDefaults(o);
  o.__addr = cfg.addr;
  o.x = boss.x; o.y = cfg.patrol ? cfg.y : (world.ground || 0) + cfg.y;
  o.__noCull = true;
  if (!cfg.patrol) {                                      // $cbc4/$cbe6
    o.playFrames(cfg.script);
    o.collides = true; o.__invulnerable = true;           // $cc5a
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    o.vy = -1;                                            // $cc12
    for (let frame = 0; frame <= 0xbd; frame++) { if (o.done) return; yield; }
    o.vx = o.vy = o.ax = o.ay = 0;                        // $cc20
    while (world.stage3AuxCount > 0) { if (o.done) return; yield; }
    for (let frame = 0; frame <= 0x28; frame++) { if (o.done) return; yield; }
    o.vy = cfg.vy;                                        // $cc28
    for (let frame = 0; frame <= 0x64; frame++) { if (o.done) return; yield; }
    return;
  }

  o.flip = cfg.vy > 0;                                    // $caaa, $38 = 2
  o.setHandle(0x001e);                                     // res30 indices 0+1
  o.__onDeath = () => { world.stage3AuxCount--; };
  let shotTimer = world.stage3AuxTimerFlip ? 0x5e : 0x8c; // $cae2-$caf4
  world.stage3AuxTimerFlip = !world.stage3AuxTimerFlip;
  for (let frame = 0; frame <= 0xbd; frame++) { if (o.done) return; yield; }
  o.vy = cfg.vy;
  for (let frame = 0; frame <= 0x10; frame++) { if (o.done) return; yield; }
  o.collides = true;                                       // $cb08
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  const move = function* (vx, vy) {                        // $cb70
    o.vx = vx; o.vy = vy;
    for (let frame = 0; frame < 0x2e; frame++) {
      if (o.done) return false;
      if (--shotTimer === 0) {
        if (world.spawnCarrier) world.spawnCarrier(o);      // $cb90
        shotTimer = 0x8c;
      }
      yield;
    }
    return true;
  };
  let upperHalf = cfg.vy < 0;
  for (;;) {
    if (world.stage3AuxCount !== 2) {
      world.applyDamage(o, o.hp);                          // $cbb4 clears the partner
      return;
    }
    if (upperHalf) {
      if (!(yield* move(-1, 0))) return;
      for (let pass = 0; pass < 3; pass++) if (!(yield* move(0, 1))) return;
      if (!(yield* move(1, 0))) return;
    }
    if (!(yield* move(1, 0))) return;
    for (let pass = 0; pass < 3; pass++) if (!(yield* move(0, -1))) return;
    if (!(yield* move(-1, 0))) return;
    upperHalf = true;
  }
}

function* c4e6Follower(o, world, boss, cfg = {}) {           // $c9e8/$ca2a
  allocDefaults(o);
  o.__addr = cfg.addr || '$0c9e8';
  o.setHandle(cfg.handle || 0x0a1e);
  o.collides = true;
  o.__invulnerable = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  for (;;) {
    if (!o.owner || boss.done) return;
    o.x = boss.x; o.y = boss.y + (cfg.dy || 0x16);
    o.depth = boss.depth + 4;
    o.hp = boss.hp; o.hitFlash = boss.hitFlash;
    yield;
  }
}

function* c4e6Steer(o, tx, ty, frames) {                    // $c690/$c6a4
  for (let frame = 0; frame < frames; frame++) {
    if (o.done || o.dying) return false;
    o.vx -= o.vx / 64;
    o.vx += o.x < tx ? 0x800 / 65536 : -0x800 / 65536;
    o.vy -= o.vy / 128;
    o.vy += o.y < ty ? 0x100 / 65536 : -0x100 / 65536;
    yield;
  }
  return true;
}

const C4E6_ATTACK_PATTERNS = [                              // $c734/$c745/$c756/$c765
  [0, 0, 2, 0, 0, 0, 3, 3, 1, 1, 2, 1, 2, 2, 2, 2],
  [0, 0, 3, 0, 0, 0, 2, 2, 1, 1, 3, 1, 3, 3, 0, 3],
  [0, 2, 0, 0, 3, 3, 1, 1, 2, 0, 2, 2, 2, 2],
  [0, 3, 0, 0, 2, 1, 2, 0, 3, 1, 2, 2, 2, 2],
];

function* c4e6AttackSegment(o, world, index, pattern, root, baseDepth) { // $cc7c
  allocDefaults(o);
  o.__addr = '$0cc7c';
  o.depth = baseDepth + index;
  o.__noCull = true;
  o.scoreAward = 0x0a;
  if (index === 0) {
    o.hp = 0x3c0;                                      // root carries chain health
    root = o;
  } else {
    o.hp = 0x10;
    o.collides = true;
    o.__damageTo = root;                               // $cd22 walks to the root
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  }
  const delay = (Math.random() * 10) | 0;              // $ccd2 -> $8076 #9
  for (let frame = 0; frame <= delay; frame++) { if (o.done) return; yield; }
  if (index < 5) {                                     // $ccd8-$ccf6
    const x = o.x, y = o.y;
    world.spawnRetained(o, function* (child, wd) {
      child.x = x; child.y = y;
      yield* c4e6AttackSegment(child, wd, index + 1, pattern, root, baseDepth);
    }, {});
  }
  const moves = [
    { vx: -2, vy: 0, handle: 0x021e, flipX: false, flip: false },
    { vx: 2, vy: 0, handle: 0x021e, flipX: true, flip: false },
    { vx: 0, vy: -2, handle: 0x041e, flipX: false, flip: false },
    { vx: 0, vy: 2, handle: 0x041e, flipX: false, flip: true },
  ];
  for (const command of pattern) {                     // $ccfa-$cd1c
    const move = moves[command];
    o.vx = move.vx; o.vy = move.vy;
    o.flipX = move.flipX; o.flip = move.flip;
    o.setHandle(move.handle);
    for (let frame = 0; frame < 0x19; frame++) {       // $cdd8-$ce00
      if (o.done || root.done) return;
      if (index) o.hitFlash = root.hitFlash;            // $cde8-$cdf6
      yield;
    }
  }
}

function c4e6Attack(o, world) {                             // $c6e8 -> $cc7c
  o.__c4e6Attacks = (o.__c4e6Attacks || 0) + 1;
  o.playFrames([0x8050, 0x081e, 0x061e, 0xb000]);           // $c6e8
  const pattern = C4E6_ATTACK_PATTERNS[(Math.random() * 4) | 0];
  const x = o.x - 0x10, y = o.y - 4;
  world.spawnChildOf(o, function* (root, wd) {
    root.x = x; root.y = y;
    yield* c4e6AttackSegment(root, wd, 0, pattern, root, o.depth + 8);
  }, {});
}

const C4E6_PHASES = [
  { addr: '$0c7c2', next: 1, dy: -8, follower: true, score: 0 },
  { addr: '$0c854', next: 2, dy: 0,  follower: false, score: 0 },
  { addr: '$0c8ce', next: null, dy: 0, follower: false, score: 0x28 },
];
const C4E6_SPIRAL_HANDLES = [
  0x081d, 0x0a1d, 0x0c1d, 0x0e1d, 0x101d, 0x121d, 0x141d, 0x161d,
  0x181d, 0x1a1d, 0x1c1d, 0x1e1d, 0x001d, 0x021d, 0x041d, 0x061d,
];

function* c4e6PhaseSpiralShot(o, world, x, y, delay) {      // $ce08
  allocDefaults(o);
  o.__addr = '$0ce08';
  o.x = x; o.y = y;
  o.depth = 0x4a38;
  o.collides = true; o.__invulnerable = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  for (let frame = 0; frame < delay; frame++) yield;
  o.angle = 0x80; o.speed = 0x480;
  for (let turn = 0; turn <= 0x0a; turn++) {
    o.setHandle(C4E6_SPIRAL_HANDLES[((o.angle + 8) >> 4) & 0x0f]);
    o.setVelocity();
    for (let frame = 0; frame <= 5; frame++) { if (o.done) return; yield; }
    o.angle = (o.angle + 0x10) & 0xff;                     // $ce60/$7570
  }
  for (;;) { if (o.done) return; yield; }
}

function c4e6PhaseSpiral(o, world) {                        // $c774 -> $ce08
  o.__c4e6PhaseAttacks = (o.__c4e6PhaseAttacks || 0) + 1;
  world.playSound(0x49);                                    // $c798-$c7a2
  for (let index = 0; index < 8; index++) {
    const x = o.x, y = o.y;
    world.spawn((shot, wd) => c4e6PhaseSpiralShot(
      shot, wd, x, y, index * 2 + ((Math.random() * 4) | 0)), {});
  }
}

function* c4e6PhaseBolt(o, world, x, y) {                    // $cf3c
  allocDefaults(o);
  o.__addr = '$0cf3c';
  o.x = x; o.y = y;
  o.vx = -5; o.vy = 0;
  o.depth = 0x4a38;
  o.collides = true; o.__invulnerable = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.playFrames([0x0404, 0x0604, 0x9000]);
  for (;;) { if (o.done) return; yield; }
}

function c4e6PhaseBoltAttack(o, world) {                     // $c7a8 -> $cf3c
  o.__c4e6PhaseAttacks = (o.__c4e6PhaseAttacks || 0) + 1;
  world.spawn((shot, wd) => c4e6PhaseBolt(shot, wd, o.x, o.y), {});
}

function spawnStage3BossPhase(world, from, index) {
  const cfg = C4E6_PHASES[index];
  return world.spawn((phase, wd) => stage3BossPhase(phase, wd, cfg), {
    x: from.x,
    y: from.y + cfg.dy,
    depth: from.depth,
  });
}

function* stage3BossFinalDeath(o, world) {                   // $c940
  o.__invulnerable = true;
  o.vx = o.vy = o.ax = o.ay = 0;
  for (let burst = 0; burst < 0x10; burst++) {              // $879e #$10,#$30
    const x = o.x + ((Math.random() * 0x30) | 0) - 0x18;
    const y = o.y + ((Math.random() * 0x30) | 0) - 0x18;
    world.spawn((fx, wd) => hitBurst(fx, wd, x, y), {});
    for (let frame = 0; frame < 3; frame++) yield;
  }
  pairedBlastDeathEffect(world, o);                         // $8722
  for (let frame = 0; frame < 0x190; frame++) yield;        // $7d7e #$190
  world.score += o.scoreAward || 0;
  o.done = true;
  world.releaseLinks(o);
}

function* stage3BossPhase(o, world, cfg) {                    // $c7c2/$c854/$c8ce
  allocDefaults(o);
  o.__addr = cfg.addr;
  o.hp = 0x0c80; o.scoreAward = cfg.score;                   // $c968
  o.depth = o.depth || SPAWN_TEMPLATE.depth + 8;
  o.setHandle(0x0c1e);                                      // $c98e inline script
  o.collides = true; o.__noCull = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  if (cfg.next === null) {
    o.__onLethal = (self) => { self.dying = true; self.hp = 0; };
  } else {
    o.__onDeath = (self, wd) => {
      pairedBlastDeathEffect(wd, self);
      spawnStage3BossPhase(wd, self, cfg.next);
    };
  }
  world.registerBoss(o);
  if (cfg.follower)
    world.spawnRetained(o, (c, wd) => c4e6Follower(c, wd, o, {
      addr: '$0ca2a', handle: 0x101e, dy: 0x1c,
    }), {});

  for (;;) {                                                // $c99a-$c9e2
    const randomY = 0x3c + ((Math.random() * 0x40) | 0);
    if (!(yield* c4e6Steer(o, 0x100, randomY, 0x50))) break;
    c4e6PhaseSpiral(o, world);                              // $c774
    if (!(yield* c4e6Steer(o, 0x100, randomY, 0x50))) break;
    if (!(yield* c4e6Steer(o, 0xc6, 0x5c, 0x28))) break;
    c4e6PhaseBoltAttack(o, world);                          // $c7a8
    if (!(yield* c4e6Steer(o, 0xc6, 0x5c, 0x28))) break;
  }
  if (o.dying) yield* stage3BossFinalDeath(o, world);
}

function* stage3Boss(o, world, spec) {                       // $0c4e6
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x1f40; o.scoreAward = 0; o.depth = SPAWN_TEMPLATE.depth + 8;
  o.x = 0xfa; o.y = 0xdc;
  o.setHandle(0x061e);
  o.collides = true;
  o.__noCull = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__onDeath = (self, wd) => {
    pairedBlastDeathEffect(wd, self);
    spawnStage3BossPhase(wd, self, 0);                       // $c66e -> $c7c2
  };
  world.registerBoss(o);
  world.stage3AuxCount = 2;                                // $152, the patrol pair
  world.stage3AuxTimerFlip = false;
  for (const cfg of C4E6_AUX)
    world.spawnChildOf(o, (c, wd) => c4e6Aux(c, wd, o, cfg), {});
  while (world.stage3AuxCount > 0) { if (o.done) return; yield; } // $c57e/$cc44
  for (let frame = 0; frame <= 0x28; frame++) { if (o.done) return; yield; }
  world.spawnRetained(o, (c, wd) => c4e6Follower(c, wd, o), {});
  o.y = 0x60;                                            // $c592
  for (let frame = 0; frame < 0x64; frame++) { if (o.done) return; yield; }
  c4e6Attack(o, world);                                  // $c5ba
  for (let frame = 0; frame < 0x32; frame++) { if (o.done) return; yield; }
  o.vx = 3;
  for (let frame = 0; frame < 0x16; frame++) { if (o.done) return; yield; }
  o.vx = 0; o.ay = -0x200 / 65536;
  for (let frame = 0; frame < 0x14; frame++) { if (o.done) return; yield; }
  o.ay = 0;
  for (;;) {
    const randomY = 0x3c + ((Math.random() * 0x40) | 0);
    if (!(yield* c4e6Steer(o, 0x110, randomY, 0x6e))) return;
    c4e6Attack(o, world);
    if (!(yield* c4e6Steer(o, 0x110, randomY, 0x6e))) return;
    if (!(yield* c4e6Steer(o, 0xc0, 0x5c, 0x3c))) return;
    c4e6Attack(o, world);
    if (!(yield* c4e6Steer(o, 0xc0, 0x5c, 0x50))) return;
  }
}

// ---------------------------------------------------------------------------
// THE STAGE 1 BOSS IS FOUR OBJECTS, NOT ONE.
//
// $09482 spawns $094de through $80d0, which spawns $09516, which spawns $09570.
// Each sets its own index in $a0 and nudges its position before the shared
// $959a moves it again, so the four end up in a fixed formation:
//
//   $94a2  head spawns seg1 at P      $94b2 head x -= $3c ; $94b8 y -= $b
//   $94e6  seg1 spawns seg2 at P      $94ea $a0 = 1
//   $9524  seg2 y += $20              $952e spawns seg3 there ; $9532 x -= $16
//   $957e  seg3 x += $23
//   $959a  ALL of them: x += $38, y += $20
//
// so relative to the head: seg1 (60, 11), seg2 (38, 43), seg3 (95, 43).
//
// $9806 installs $980e as the per-frame routine, and $9822 is what makes them a
// creature rather than four enemies:
//
//   $9824  $36(a5) = $36(a0)    hit points copied FROM the owner
//   $9836  $16(a5) = $16(a0)    and the velocity, both components
//   $983c  $1a(a5) = $1a(a0)
//   $9818  owner gone -> $981a clr.w $36, die with it
//
// Copying the owner velocity every frame is the same thing as holding a
// constant offset, which is how this is ported. Damage is handled by $098f6,
// installed in $48 at $94f6: `sub.w d0,$36(a0)` -- it lands on the owner.
//
// The port had none of this. It drew the head and nothing else.
const BOSS1_FLICKER = [0x8001, 0x180e, 0x1a0e, 0x1c0e, 0x1e0e, 0x1a0e, 0x1e0e,
                       0x1a0e, 0x1c0e, 0x1c0e, 0x1e0e, 0x1c0e, 0x1a0e, 0x1c0e,
                       0x1a0e, 0x1e0e, 0x1a0e, 0x9000];        // $953c
const BOSS1_HEAD_SCRIPT = [0x8010, 0x020e, 0x000e, 0xa000, 0xb000];   // $9722
const BOSS1_DESTROYED_HEAD = [0x040e, 0xa000, 0xb000];                // $98ac
const BOSS1_REAR_RIGHT = [0x8001, 0x080e, 0x0a0e, 0x0c0e, 0x0e0e,
                          0x0a0e, 0x0e0e, 0x0a0e, 0x0c0e, 0x9000]; // $96ee
const BOSS1_REAR_LEFT = [0x8001, 0x100e, 0x120e, 0x140e, 0x160e,
                         0x120e, 0x160e, 0x120e, 0x140e, 0x9000]; // $9708
const BOSS1_SEGMENTS = [
  { idx: 1, dx: 60, dy: 11, at: '$094de', script: [0x000f, 0xb000] },   // res $f
  { idx: 2, dx: 38, dy: 43, at: '$09516', script: BOSS1_FLICKER },      // res $e
  { idx: 3, dx: 95, dy: 43, at: '$09570', script: [0x080e, 0xb000] },   // res $e
];

function* boss1Segment(o, world, head, cfg) {
  allocDefaults(o);
  o.__addr = cfg.at;
  o.playFrames(cfg.script);
  o.collides = true;                             // $959a installs $7d06 in $44
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  if (cfg.idx === 1) o.__damageTo = head;        // $94f6 $48 = $98f6
  else o.__invulnerable = true;                  // $951a/$9574 disable $48/$4c
  o.scoreAward = 0;                              // the owner carries the award
  let attackTimer = BOSS1_BODY_INITIAL;          // $94f0; reloads through $9850
  let facing = 0;
  for (;;) {                                     // $980e
    if (head.done) { o.hp = 0; o.done = true; return; }        // $981a
    o.x = head.x + cfg.dx;                       // $9836/$983c as an offset
    o.y = head.y + cfg.dy;
    o.depth = head.depth;
    o.hp = head.hp;                              // $9824
    o.hitFlash = head.hitFlash;                  // $982a $66
    if (cfg.idx === 3 && head.bossVx && Math.sign(head.bossVx) !== facing) {
      facing = Math.sign(head.bossVx);            // $9878 -> $96d8
      o.playFrames(facing < 0 ? BOSS1_REAR_LEFT : BOSS1_REAR_RIGHT);
    }
    if (cfg.idx === 1 && --attackTimer < 0) {     // $984a
      attackTimer = BOSS1_BODY_RELOAD;
      if (head.bossPhase) boss1FragmentAttack(world, o); // $9856/$98ce
      if (Math.random() * 0xffff >= 0x3333) boss1Formation(world, o); // $9860
    }
    yield;
  }
}

function* boss1DeathSequence(o, world) {
  const centerX = o.x, centerY = o.y;
  o.collides = false;
  o.shotCollides = false;
  o.vx = 0; o.vy = 0; o.ax = 0; o.ay = 0;
  o.playFrames(BOSS1_DESTROYED_HEAD);
  for (let frame = 0; frame < 0xb4; frame++) {
    o.x = centerX + ((frame & 2) ? 2 : -2);
    o.y = centerY + ((frame & 4) ? 1 : -1);
    if ((frame % 18) === 0) {
      const dx = ((frame / 18) & 1) ? 18 : -18;
      world.spawn((burst, wd) => hitBurst(burst, wd, centerX + dx, centerY), {});
      world.lastSound = DEATH_SOUND;
    }
    if (frame === 48 || frame === 112) boss1FragmentAttack(world, o);
    if (frame === 80)
      world.spawn((blast, wd) => deathBlast(blast, wd, centerX, centerY, 0), {});
    yield;
  }
  o.x = centerX; o.y = centerY;
  pairedBlastDeathEffect(world, o);
}

function* stage1Boss(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);
  o.hp = 0x1f40; o.scoreAward = 0;
  world.registerBoss(o);          // the stage ends when this dies                     // $94a6 / $94ac
  o.x -= 0x3c; o.y -= 0x0b;                            // $94b2 / $94b8
  o.speed = 0x100 / 256;                               // $94be
  o.collides = true;                                   // $959a installs $7d06
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.x += 56; o.y += 32;                                // $959a
  o.playFrames(BOSS1_HEAD_SCRIPT);                     // $94c4 $971e
  o.bossPhase = 0;                                      // $9492 $9a
  o.attackTimer = 0;                                    // $9496 $9c
  o.firing = false;                                     // $949a $9e
  o.__onLethal = (self) => {
    self.dying = true;
    self.__invulnerable = true;
    self.hp = 0;
  };
  // $949e/$94a2: the rest of the creature. Spawned as retained children in the
  // original; here each simply holds its offset and dies with the head.
  for (const cfg of BOSS1_SEGMENTS)
    world.spawnChildOf(o, (c, wd) => boss1Segment(c, wd, o, cfg), {});
  const attackStep = function* () {
    if (!o.bossPhase && o.hp <= BOSS1_PHASE_HP) {       // $987e-$98a8
      o.bossPhase = 1;
      o.x += 1;                                         // net +$20-$1f
      fragmentDeathEffect(world, o);                    // $9890/$887e transition burst
      boss1FragmentAttack(world, o);                    // $98a4/$98ce
      o.playFrames(BOSS1_DESTROYED_HEAD);               // $98a8 exposed second-stage head
    }
    if (o.speed !== 1 || --o.attackTimer >= 0) return false; // $9776
    o.attackTimer = BOSS1_ATTACK_RELOAD;
    o.firing = true;
    if (!o.bossPhase) {
      o.playFrames(BOSS1_HEAD_SCRIPT);                  // $9798 -> $971e
      world.spawnChildOf(o, (shot, wd) => boss1Missile(shot, wd, o), {}); // $979e
      while (o.scriptOn && !o.scriptFlag) yield;        // $97ae -> $97f0
    } else {
      world.spawn((fx, wd) => boss1Charge(fx, wd, o), {}); // $97bc
      for (const dy of [2, 10, 6]) {
        const y = o.y; o.y += dy;
        if (world.spawnCarrier) world.spawnCarrier(o);       // $97da -> $6852
        o.y = y;
        for (let i = 0; i < 8; i++) yield;
      }
    }
    o.firing = false;
    return true;
  };
  for (;;) {                                           // $9610, forever
    for (const [speed, tx, ty] of BOSS1_PATH) {
      o.speed = speed / 256;
      // $9744: fly toward ($92,$94) at $26 until it arrives.
      for (;;) {
        if (o.done) return;
        if (o.dying) { yield* boss1DeathSequence(o, world); return; }
        if (yield* attackStep()) { yield; continue; }
        const dx = tx - o.x, dy = ty - o.y;
        const d = Math.hypot(dx, dy);
        if (d <= o.speed || d === 0) { o.x = tx; o.y = ty; break; }
        o.bossVx = (dx / d) * o.speed;
        o.x += (dx / d) * o.speed;
        o.y += (dy / d) * o.speed;
        yield;
      }
    }
  }
}

// $0ce86 -- the boss's attack. It is not one projectile but a chain of four:
// each copy spawns the next through $80d0 while its $92 is under 3, passing its
// own index on incremented, so one call produces indices 0..3.
//
//   $ce8a  acquire res 29
//   $ce90  wait 6 frames
//   $ce94  hp $20
//   $ceb6  $89cc halt, then $26 = $400 (speed 4), $28 = $80 (heading left)
//   $ceca  ten passes of: turn up to 4 toward the player ($7570), $cef6,
//          then run 4 frames -- so it homes, but only coarsely and only for
//          40 frames, after which it flies straight ($7d46)
//   $ceea  release res 29 and terminate
const CE86_CHAIN = 4;          // $ce9a cmpi.w #$3
const CE86_SPEED = 0x400;      // $ceba
const CE86_TURN = 4;           // $ced0
const CE86_PASSES = 0xa;       // $cec6
const CE86_STEP = 4;           // $ceda

function* bossShot(o, world, index) {
  allocDefaults(o);
  o.hp = 0x20;                                          // $ce94
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  const h = world.firstHandleOfResource(29);
  if (h !== undefined) o.setHandle(h);
  for (let i = 0; i <= 6; i++) { if (o.done) return; yield; }   // $ce90
  if (index < CE86_CHAIN - 1) {                         // $ce9a
    world.spawnChildOf(o, function* (c, wd) {
      c.x = o.x; c.y = o.y;
      yield* bossShot(c, wd, index + 1);                // $ceac, $92 + 1
    }, {});
  }
  o.vx = o.vy = o.ax = o.ay = 0;                        // $ceb6, $89cc
  o.speed = CE86_SPEED;                                 // $ceba, raw $26
  o.angle = 0x80;                                       // $cec0, left
  o.setVelocity();
  for (let n = 0; n < CE86_PASSES; n++) {               // $ceca
    if (o.done) return;
    o.turnTowardPlayer(CE86_TURN);                      // $ced2, $7570
    for (let i = 0; i <= CE86_STEP; i++) {              // $cedc
      if (o.done) return;
      yield;
    }
  }
  for (;;) { if (o.done) return; yield; }               // $cee6, $7d46
}

// ---------------------------------------------------------------------------
// $0dd2e -- the stage 5 boss.
//
// It is the only object in the game that stops the world: $dd36 raises the
// $104 freeze, which is what $51b6 and friends test before integrating, so the
// scroll and every ordinary enemy stand still while it is alive.
//
//   $dd3a  acquire res 23, and res 29 through the inner path ($8aac)
//   $dd52  x = $a8, y = $5c
//   $dd64  push 11 and count down, spawning $de66 twelve times through $80fe
//          and writing the counter into each child's $92 -- so segment N knows
//          it is segment N
//   $dd8c  hp $3200 (12800), score $50 (80)
//   $dd9e  the director loop, below
//   $ddb8  on death: release 29 and 23, $8a70, wait 50, CLEAR the freeze
//
// $dee2 gives each segment its own step routine from the jump table at $def2 --
// twelve separate dances, extracted by tools/export_boss.py into boss5.json
// rather than transcribed by hand. They share one closed vocabulary:
//
//   halt    $deb4  stop and wait for the director to release you ($135)
//   moveTo         teleport to an absolute position
//   cue     $ed38  raise $137: "I am in place"
//   go      $df22  halt, then set heading and speed, run $13a frames,
//                 stop dead and raise the cue
//   go2     $df2c  the same without the leading halt
//   flyTo   $df4c  fly to a point, +2 speed a frame, until within 4px
//   speed          set $26 outright
//
// The director and the segments rendezvous through those flags: $de16 pulses
// $135 to release them, then spins until $137 comes back.

const BOSS5_FLAGS = {
  damage: 0x134,   // open while the boss can be hurt
  release: 0x135,  // pulse: segments waiting in `halt` may proceed
  active: 0x136,
  inPlace: 0x137,  // segments raise this once they have reached their mark
  live: 0x138,     // live segment count
  duration: 0x13a, // how long each manoeuvre runs
};

function* bossSegment(o, world, index, script, boss) {
  allocDefaults(o);
  o.__addr = '$0de66';
  const d = world.boss5;
  o.hp = d.segment.hp;                                  // $de7a
  o.scoreAward = d.segment.score;                       // $de80
  o.flags = d.segment.flags;                            // $de6e
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.setHandle(d.segment.handle);                        // $de66, res 23
  world.bossState.live++;                               // $de92
  try {
    scriptLoop: for (;;) {                              // $de96-$dea2 re-enters $94
      for (const op of script.ops) {
      if (o.done) return;
      switch (op.op) {
        case 'halt':                                    // $deb4
          o.vx = o.vy = o.ax = o.ay = 0;
          while (!world.bossState.release) {
            if (o.done) return;
            updateBossSegmentPresentation(o, world);
            yield;
          }
          break;
        case 'moveTo':
          if (op.x !== undefined) o.x = op.x;
          if (op.y !== undefined) o.y = op.y;
          break;
        case 'cue':                                     // $ed38
          world.bossState.inPlace = true;
          updateBossSegmentPresentation(o, world);
          yield;
          break;
        case 'speed':
          o.speed = op.value;                           // raw $26
          break;
        case 'go':                                      // $df22
          // $df26: this entry halts and waits for the release FIRST.
          o.vx = o.vy = 0;
          while (!world.bossState.release) {
            if (o.done) return;
            updateBossSegmentPresentation(o, world);
            yield;
          }
          // fall through
        case 'go2':                                     // $df2c
          o.angle = op.heading & 0xff;                  // $df2c
          o.speed = op.speed;                           // $df30, raw $26
          o.setVelocity();                              // $df34
          for (let i = 0; i < world.bossState.duration; i++) {   // $13a
            if (o.done) return;
            updateBossSegmentPresentation(o, world);
            yield;
          }
          o.vx = o.vy = 0;                              // $df40 / $df44
          world.bossState.inPlace = true;               // $df48 -> $ed38
          break;
        case 'flyTo':                                   // $df4c
          // Not a heading move. d0/d1 are a target point: accelerate by 2 each
          // frame along the heading toward it, and stop once inside 4px of it
          // in BOTH axes ($df72-$df8c).
          for (;;) {
            if (o.done) return;
            o.speed += 2;                               // $df64 addq.w #2,$26
            o.angle = Math.round(
              (Math.atan2(op.y - o.y, op.x - o.x) / (2 * Math.PI)) * 256) & 0xff;
            o.setVelocity();                            // $df68
            if (Math.abs(op.x - o.x) <= 4 && Math.abs(op.y - o.y) <= 4) break;
            updateBossSegmentPresentation(o, world);
            yield;
          }
          break;
        case 'return':
          continue scriptLoop;
        default:
          break;
      }
    }
    }
  } finally {
    world.bossState.live--;
  }
}

function updateBossSegmentPresentation(o, world) {         // $ed58-$ed98
  const state = world.bossState;
  const flickerVisible = state.active && (world.frame & 1);
  const damageVisible = !state.active && state.damage;
  o.noDraw = !(flickerVisible || damageVisible);            // $38 bit $20
  o.collides = damageVisible;
  o.__invulnerable = !damageVisible;
}

// $01f44/$01f50/$01f5c: the three res 49 title-logo chains. Each object is
// held for eight frames after the title routine places it at y=$20.
function* presentationSprite(o, world, handle, x, y, depth, addr) {
  allocDefaults(o);
  o.__addr = addr;
  o.x = x; o.y = y;
  o.depth = depth;
  o.__invulnerable = true;
  o.setHandle(handle);
  for (;;) yield;
}

function installTitlePresentation(world) {
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0031, 0x5c, 0x20, 0x10, '$01f44'), {});
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0231, 0xa8, 0x20, 0x10, '$01f50'), {});
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0431, 0xf4, 0x20, 0x10, '$01f5c'), {});
  // $1cec: "?" centred at (168,89) is the SAINT DRAGON wordmark. $1cfc's
  // "!!;!!!!!@" uses ! as padding, placing STORM and JALECO at x 128/224.
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0831, 0xa8, 0x59, 0x10, '$01cec'), {});
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0631, 0x80, 0x7a, 0x10, '$01cfc'), {});
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0a31, 0xe0, 0x7a, 0x10, '$01cfc'), {});
}

function* introDragonAscent(o, world) {                 // $08bb6
  allocDefaults(o);
  o.__addr = '$08bb6';
  o.x = 0xad; o.y = 0xa3; o.depth = 0xc8;
  o.__invulnerable = true;
  o.playFrames([
    0x1442, 0x1642, 0x1842, 0x1a42, 0x1c42, 0x1e42,
    0xa000, 0xc000,
    0x2042, 0x2242, 0x2442, 0x2642, 0x2842, 0x2a42, 0x2c42, 0x2e42,
    0x9000,
  ]);                                                   // $8bc8-$8bea
  while (!o.scriptFlag) yield;                          // $8bea, $74cc
  o.vy = -2; o.ay = -1 / 16;                           // $8bee/$8bf6
  while (o.y > -80) yield;
}

// $8b2e: the egg opens through res66 handles 2-9, then $8bb6 launches the
// revealed dragon upward through handles 10-23.
function* introEgg(o, world) {
  allocDefaults(o);
  o.__addr = '$08b0c';
  o.x = 0xad; o.y = 0xa3; o.depth = 0x64;
  o.__invulnerable = true;
  for (let index = 2; index <= 9; index++) {
    o.setHandle((index << 9) | 0x42);
    for (let hold = 0; hold < 4; hold++) yield;
  }
  world.playSound(0x44);                                // $8b66-$8b70
  world.playSound(0x44);                                // $8b74-$8b7e
  for (;;) yield;
}

function installIntroPresentation(world) {
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0042, 0x57, 0x5a, 0x7fff, '$08c06'), {});
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0242, 0xf7, 0x5a, 0x7fff, '$08c06'), {});
  world.spawn(introEgg, {});
  world.spawn(introDragonAscent, {});                    // $8b5a-$8b62
}

// $0dbf0-$0dc58: after the stage-5 boss, the eight-slice res 67 dragon enters
// terrain-locked from x=$238. The original $d0 stop is for a 320-pixel display;
// this 368-pixel playfield needs x=$f0 to preserve the same right-edge contact.
function* stage5DragonExit(o, world) {
  allocDefaults(o);
  o.__addr = '$0dbd8';
  o.x = 0x238; o.y = 0x78;
  o.depth = 0;
  o.__invulnerable = true;
  o.setHandle(0x0043);
  terrainLock(o, world);
  while (o.x > 0xf0) yield;
  o.vx = o.vy = o.ax = o.ay = 0;
  world.scrollRate = 0;
  for (let frame = 0; frame < 0x1f4; frame++) yield;
  world.postBossDone = true;
}

// $08c80 acquires res 65 for the ending. Its principal sprite follows the
// $08cc0 frame list, entering from (200,124) with the traced velocity.
function* outroPresentation(o, world) {
  allocDefaults(o);
  o.__addr = '$08c80';
  o.x = 0xc8; o.y = 0x7c;
  o.vx = -0.5; o.vy = -0.25;
  o.depth = 0x10;
  o.__invulnerable = true;
  const handles = [0x0441, 0x0641, 0x0841, 0x0a41, 0x0c41, 0x0e41, 0x1041];
  for (;;) {
    for (const handle of handles) {
      o.setHandle(handle);
      for (let hold = 0; hold < 8; hold++) yield;
    }
  }
}

function installOutroPresentation(world) {
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0041, 0x57, 0x5a, 0x7fff, '$08fae'), {});
  world.spawn((o, wd) => presentationSprite(o, wd, 0x0241, 0xf7, 0x5a, 0x7fff, '$08fae'), {});
  world.spawn(outroPresentation, {});
}

function* stage5Boss(o, world, spec) {
  const d = world.boss5;
  if (!d) { yield* waveEnemy(o, world, spec); return; }
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);        // $8ae2

  world.bossState = { release: false, inPlace: false, active: false,
                      damage: false, live: 0, duration: d.boss.cycle[0] };
  world.acquireFreeze();                                // $dd36, st $104
  o.x = d.boss.x; o.y = d.boss.y;                       // $dd52 / $dd58
  o.hp = d.boss.hp; o.scoreAward = d.boss.score;
  world.registerBoss(o);          // the stage ends when this dies        // $dd8c / $dd92
  o.__onLethal = (self) => {
    self.hp = 0;
    self.dying = true;
    self.__invulnerable = true;
    world.bossState.damage = false;
  };
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  const h = world.firstHandleOfResource(d.boss.resource);
  if (h !== undefined) o.setHandle(h);

  // $dd64: eleven down to zero, so twelve segments, each told its index.
  for (let i = d.boss.segments - 1; i >= 0; i--) {
    const script = d.steps[String(i)];
    if (!script) continue;
    world.spawnChildOf(o, function* (c, wd) {
      c.x = o.x; c.y = o.y;
      yield* bossSegment(c, wd, i, script, o);
    }, {});
  }
  yield;                                                // $dd80, $7eb6

  const run = function* (n) {
    for (let i = 0; i < n; i++) { if (o.done || o.dying) return true; yield; }
    return false;
  };
  // $de16: release the segments, then wait until one reports back in place.
  const rendezvous = function* () {
    if (world.bossState.live === 0) return false;       // $de1a
    world.bossState.inPlace = false;                    // $de1c
    world.bossState.release = true;                     // $de20
    yield;
    world.bossState.release = false;                    // $de28
    while (!world.bossState.inPlace) {                  // $de36
      if (o.done || o.dying) return true;
      yield;
    }
    return false;
  };
  // $de06: flag active, hold 80 frames, clear.
  const beActive = function* () {
    world.bossState.active = true;
    if (yield* run(d.boss.activeFrames)) return true;
    world.bossState.active = false;
    return false;
  };
  // $ddda: one attack cycle.
  const attack = function* () {
    if (yield* rendezvous()) return true;               // $de16
    if (yield* beActive()) return true;                 // $de06
    world.bossState.damage = true;                      // $ddde, st $134
    if (yield* run(d.boss.attackWait)) return true;     // $ddfe
    if (yield* rendezvous()) return true;
    if (yield* run(d.boss.attackWait)) return true;
    if (yield* rendezvous()) return true;
    world.spawnChildOf(o, function* (c, wd) {           // $ddea, $ce86
      c.x = o.x; c.y = o.y;
      yield* bossShot(c, wd, 0);
    }, {});
    if (yield* run(d.boss.attackWait)) return true;
    if (yield* beActive()) return true;
    world.bossState.damage = false;                     // $ddfa, sf $134
    return false;
  };

  try {
    for (;;) {                                          // $dd98 .. $ddb6
      for (const dur of d.boss.cycle) {                 // 52, 52, 26, 52
        world.bossState.duration = dur;                 // $13a
        if (yield* attack()) break;
      }
      if (o.dying || o.done) break;
    }
    if (o.dying) {
      o.vx = o.vy = o.ax = o.ay = 0;
      for (let frame = 0; frame <= 0x32; frame++) yield; // $ddcc-$ddd0, $8076
      world.score += o.scoreAward || 0;
      o.scoreAward = 0;
    }
  } finally {
    // $ddb8: whatever happens, the freeze must come back down or the rest of
    // the game stays stopped.
    world.releaseFreeze();                              // $ddd2, clr $104
  }
}

// ---------------------------------------------------------------------------
// $0d6d4 -- the stage 4 boss.
//
//   $d6dc  acquire res 35, then 36 and 37 through the inner path, sound 70
//   $d6fe  $92 = 0            <- the boss half of the pair
//   $d702  x = $64
//   $d70c  lea $d7c2 / $80d0  spawn and RETAIN a partner, retrying until it takes
//   $d716  $98 = $64 on self AND on the partner
//   $d720  $44 = $7d06 vulnerable, $48 = $d77e death, $4c/$54 disabled
//   $d73c  hp = $3e80 (16000), score = $28 (40)
//   $d750  bsr $d7f8          the choreography, below
//
// The partner at $d7c2 runs the SAME script. The only thing separating them is
// $92: the boss has 0, the partner $ffff. Two places test it, in opposite
// senses, which divides the work between them:
//
//   $d928 (attack)  fires only when $92 is NON-zero  -> the partner shoots
//   $d984 (mines)   spawns only when $92 is ZERO     -> the boss lays them
//
// $98 is the move-duration counter, seeded to 100 on both. At the end of every
// lap the script subtracts 25 while it is above 25, and once it stops shrinking
// it adds three extra spawn passes instead -- so the fight tightens and then
// thickens.
const BOSS4 = {
  x: 0x64, y: -0x20,                 // $d702 / $d7fe
  hp: 0x3e80, score: 0x28,           // $d73c / $d742
  resource: 35, duration: 0x64,      // $d6dc / $d716
  partnerHandle: 0x223,              // $d7c2, res 35 game index 1
  shrink: 0x19,                      // $d8ac / $d8c2
};

function* boss4Script(o, world) {
  // $d9d8 runs N+1 tethered steps; the partner copies its owner at x + $5f.
  const moveFor = function* (n) {
    for (let i = 0; i <= n; i++) {
      if (o.done) return true;
      if (o.dying) return true;
      if (o.variant && o.owner && !o.owner.done) {
        if (o.owner.dying) {
          const owner = o.owner;
          while (!owner.done) {
            o.x = owner.x + 0x5f; o.y = owner.y;
            o.vx = owner.vx; o.vy = owner.vy;
            o.hp = owner.hp; o.hitFlash = owner.hitFlash;
            yield;
          }
          return true;
        }
        o.x = o.owner.x + 0x5f;
        o.y = o.owner.y;
        o.vx = o.owner.vx;
        o.vy = o.owner.vy;
        o.ax = o.owner.ax;
        o.ay = o.owner.ay;
        o.hp = o.owner.hp;
        o.hitFlash = o.owner.hitFlash;
      }
      yield;
    }
    o.vx = 0; o.vy = 0;
    return false;
  };
  const vyMove = function* (dir) {                 // $d8ec / $d8f4
    o.vy = dir;
    return yield* moveFor(0x14);                   // both branch to $d906
  };
  const forDur = function* () { return yield* moveFor(o.moveDur); };   // $d8e4
  // $d9ae: four capped aimed-shot passes, each followed by twenty-one frames.
  const spawnPass = function* () {
    for (let i = 0; i < 4; i++) {
      if (o.done) return true;
      if (!o.variant && world.spawnAimedShot) world.spawnAimedShot(o); // $6774
      if (yield* moveFor(0x14)) return true;
    }
    return false;
  };
  // $d984: four passes; the spawn itself only happens for $92 == 0.
  const minePasses = function* () {
    for (let i = 0; i < 4; i++) {
      if (o.done) return true;
      if (!o.variant) {                            // $d992 tst.w $92 / bne
        world.spawnChildOf(o, function* (c, wd) {
          c.x = o.x; c.y = o.y;
          yield* boss4Mine(c, wd);
        }, {});
      }
      if (yield* moveFor(0x64)) return true;       // $d9a0
    }
    return false;
  };
  // $d928: only fires when $92 is non-zero, i.e. only the partner.
  const attack = function* (which) {
    if (yield* moveFor(0x1e)) return true;         // $d93a
    for (let i = 0; i < 5; i++) {                  // $d940
      if (o.done) return true;
      if (o.variant) {                             // $d94e tst.w $92 / beq
        world.spawnChildOf(o, function* (c, wd) {
          c.x = o.x; c.y = o.y;
          yield* boss4Shot(c, wd, which);
        }, {});
      }
      if (yield* moveFor(0x28)) return true;       // $d95c
    }
    return yield* moveFor(0x64);                   // $d978
  };
  const fireOffset = function* () {                // $d8cc
    o.x -= 0x28;
    if (world.spawnBossShot) world.spawnBossShot(o);
    o.x += 0x28;
  };

  o.y = BOSS4.y;                                   // $d7fe
  o.vy = 1;                                        // $d804
  if (yield* moveFor(0xa6)) return;                // $d80a, $d8fc
  if (yield* spawnPass()) return;                  // $d80e
  if (yield* attack(0xdb04)) return;               // $d812, $d916
  o.vx = -1;                                       // $d816
  if (yield* moveFor(0x14)) return;                // $d81c
  if (yield* spawnPass()) return;                  // $d820
  if (yield* attack(0xdb04)) return;               // $d824
  if (yield* vyMove(-1)) return;                   // $d828
  if (yield* vyMove(-1)) return;                   // $d82c
  if (yield* spawnPass()) return;                  // $d830
  if (yield* attack(0xdb0c)) return;               // $d834, $d920
  o.vx = 1; if (yield* moveFor(0x5a)) return;      // $d838, $d902
  o.vx = 1; if (yield* moveFor(0x14)) return;      // $d842
  if (yield* minePasses()) return;                 // $d84c
  o.vy = 1; if (yield* moveFor(0x14)) return;      // $d850
  if (yield* forDur()) return;                     // $d85a
  o.vx = 1; if (yield* moveFor(0x14)) return;      // $d85e
  if (yield* forDur()) return;                     // $d868

  for (;;) {                                       // $d86c .. $d8c8
    if (o.done) return;                            // $d870 alive test
    if (yield* vyMove(-1)) return;                 // $d874, $d8de ...
    if (yield* forDur()) return;
    yield* fireOffset();                           // $d878
    if (yield* vyMove(-1)) return;                 // $d87c
    if (yield* forDur()) return;
    if (yield* vyMove(-1)) return;                 // $d880
    if (yield* minePasses()) return;               // $d884
    if (yield* forDur()) return;                   // $d888
    yield* fireOffset();                           // $d88c
    if (yield* vyMove(1)) return;                  // $d890, $d8e2 ...
    if (yield* forDur()) return;
    yield* fireOffset();                           // $d894
    if (yield* vyMove(1)) return;                  // $d898
    if (yield* forDur()) return;
    if (yield* vyMove(1)) return;                  // $d89c
    if (yield* minePasses()) return;               // $d8a0
    if (yield* forDur()) return;                   // $d8a4
    yield* fireOffset();                           // $d8a8
    if (o.moveDur > BOSS4.shrink) o.moveDur -= BOSS4.shrink;   // $d8c2
    else {
      if (yield* spawnPass()) return;              // $d8b4
      if (yield* spawnPass()) return;
      if (yield* spawnPass()) return;
    }
  }
}

// $0db0c / $0db04 -- the partner's shot. $db0c picks its vertical direction
// from the player's height and a random roll, falling back to $db04's -1:
//   $db10  if the player's y >= $7c, or a roll under $f332, use +1, else -1
//   $db28  acquire res 36, x -= 8, depth $2c0, hp $c0, score 4, vx = 4
//   $db6a  fly RIGHT until x >= $118, then stop and drift by $92
function* boss4Shot(o, world, which) {
  allocDefaults(o);
  let dir = -1;                                    // $db04
  if (which === 0xdb0c) {
    const p = world.player;
    if ((p && p.y >= 0x7c) || Math.random() * 0xffff >= 0xf332) dir = 1;
  }
  o.x -= 8;                                        // $db30
  o.depth = 0x2c0;                                 // $db34
  o.hp = 0xc0; o.scoreAward = 4;                   // $db58 / $db5e
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  const frames = Array.from({ length: 13 }, (_, i) => (i << 9) | 36);
  o.setHandle(frames[0]);
  o.vx = 4;                                        // $db64
  let animTick = 0;
  while (o.x < 0x118) {
    if (o.done) return;
    o.setHandle(frames[Math.min(11, (animTick / 4) | 0)]); // inline $0024..$1624
    animTick++;
    yield;
  }
  o.vx = 0;                                        // $db7c
  o.vy = dir;                                      // $db80, $1a = $92
  for (let i = 0; i <= 0xa; i++) { if (o.done) return; yield; }
  for (;;) {                                       // $db8c-$dbb2
    if (o.done) return;
    const delay = 0x19 + ((Math.random() * 0x10) | 0);
    for (let i = 0; i <= delay; i++) { if (o.done) return; yield; }
    o.setHandle(frames[12]);                        // inline $8008,$1824,$1624,$b000
    for (let i = 0; i < 8; i++) { if (o.done) return; yield; }
    o.setHandle(frames[11]);
    if ((world.projectiles || 0) < PROJECTILE_POOL) {
      world.spawnChildOf(o, function* (shot, wd) {
        shot.x = o.x - 8; shot.y = o.y; shot.__addr = '$0644c';
        yield* treeShot(shot, wd);
      }, {});
    }
  }
}

function spawnBoss4MineBurst(o, world) {                       // $6868 -> $6570
  if ((world.projectiles || 0) >= PROJECTILE_POOL) return;
  for (let i = 0; i < 2; i++) {
    world.spawnChildOf(o, function* (shot, wd) {
      allocDefaults(shot);
      shot.x = o.x; shot.y = o.y;
      wd.projectiles = (wd.projectiles || 0) + 1;
      try {
        shot.depth = 0x4a38;
        shot.vx = -3; shot.vy = 0; shot.ax = 0; shot.ay = 0;
        shot.collides = true; shot.__invulnerable = true;
        shot.onHitPlayer = (self, w2) => { w2.damage(self, 1); };
        shot.setHandle(0x2a04);
        for (;;) { if (shot.done) return; yield; }
      } finally {
        wd.projectiles--;
      }
    }, {});
  }
}

function* stage5ColumnPiece(o, world) {                    // $f1f4
  o.setHandle(0x043b);
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__invulnerable = true;                                 // $48=$6772, $4c/$54=$ff
  o.playFrames([0x043b, 0xb000]);
  terrainLock(o, world);
  while (o.x > 336) { if (o.done) return; yield; }         // $8240
  for (;;) { if (o.done) return; yield; }
}

function* stage5ColumnSpawner(o, world, spec) {             // $f196-$f1f0
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x;
  o.y = (world.ground !== undefined ? world.ground : 182) - 9;
  yield* entryGate(o, world, spec.trigger || 0);
  for (let index = 0; index < spec.count; index++) {
    spawnRoutineChild(o, world, '$0f1f4', 0, 0);
    o.y -= 0x10;                                           // $f1d2
  }
  spawnRoutineChild(o, world, '$0ee6a', 0, 0);             // every entry sets $92
}

// $0da26 -- what the boss lays while the partner shoots.
function* boss4Mine(o, world) {
  allocDefaults(o);
  o.__addr = '$0da26';
  o.x -= 0x46;
  o.hp = 0x30; o.scoreAward = 3; o.depth = 0x2c0;
  o.collides = true;
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  const frames = Array.from({ length: 8 }, (_, i) => (i << 9) | 37);
  let animTick = 0;
  const step = function* (framesToRun) {
    for (let i = 0; i <= framesToRun; i++) {
      if (o.done) return true;
      const frame = animTick < 6 * 4 ? (animTick / 4) | 0 : 6 + (((animTick / 4) | 0) & 1);
      o.setHandle(frames[frame]);                    // $0025..$0e25 loop
      animTick++;
      yield;
    }
    return false;
  };
  if (yield* step(0xa)) return;
  spawnBoss4MineBurst(o, world);
  o.ax = -0x800 / 0x10000;
  if (yield* step(0x14)) return;
  o.ax = 0x600 / 0x10000;
  if (yield* step(0x1e)) return;
  o.ax = -0x200 / 0x10000; o.ay = -0x300 / 0x10000;
  if (yield* step(0x14)) return;
  o.ax = 0xe00 / 0x10000; o.ay = 0x300 / 0x10000;
  if (yield* step(0x14)) return;
  o.ay = 0;
  if (yield* step(0x14)) return;
  o.ax = -0x200 / 0x10000; o.vy = 0;
  for (;;) {
    o.ay = (Math.random() * 0x10000 < 0x7fff ? 1 : -1) * (0xe00 / 0x10000);
    if (yield* step(0x28)) return;
    spawnBoss4MineBurst(o, world);
    o.ay = -o.ay;
    if (yield* step(0x28)) return;
  }
}

function* stage4Boss(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  yield* entryGate(o, world, spec.trigger || 0);   // $8ae2
  o.variant = 0;                                   // $d6fe, $92 = 0
  o.x = BOSS4.x;                                   // $d702
  o.moveDur = BOSS4.duration;                      // $d716
  o.hp = BOSS4.hp; o.scoreAward = BOSS4.score;
  world.registerBoss(o);          // the stage ends when this dies     // $d73c / $d742
  o.__onLethal = (self) => { self.hp = 0; self.dying = true; };       // $d77e
  o.collides = true;                               // $d720 installs $7d06
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  const h = world.firstHandleOfResource(BOSS4.resource);
  if (h !== undefined) o.setHandle(h);

  // $d70c: $80d0, the RETAINED spawn -- this pair really does die together,
  // which is the one case the blanket owner-death rule was generalising from.
  world.spawnRetained(o, function* (c, wd) {
    allocDefaults(c);
    c.x = o.x; c.y = o.y;
    c.variant = -1;                                // $d7d0, $92 = $ffff
    c.moveDur = BOSS4.duration;                    // $d7ca
    c.__diesWithOwner = true;
    c.collides = true;                             // $d7e2
    c.onHitPlayer = (self, w2) => { w2.damage(self, 1); };
    c.setHandle(BOSS4.partnerHandle);              // $d7c2
    yield* boss4Script(c, wd);                     // $d7ea, the same script
  }, {});
  yield;                                           // $d708

  yield* boss4Script(o, world);                    // $d750
  if (o.dying) {
    o.__invulnerable = true;
    o.vx = o.vy = o.ax = o.ay = 0;                 // $d78c $89cc
    world.spawn((fx, wd) => hitBurst(fx, wd, o.x + 0x12, o.y), {}); // $d79c
    yield;                                          // $d7ac $8722
    for (let i = 0; i <= 0x15e; i++) {             // $d7b4 $7d7e
      o.vy = (i & 1) ? -2 : 2;
      yield;
    }
    o.vx = o.vy = 0;
    world.score += o.scoreAward || 0;
    o.done = true;
    world.releaseLinks(o);
  }
}

// The four section/stage-control records, which until now produced no object
// at all and were counted as "unimplemented" by the sweep.
//
//   $083e2  gate, $8406, then addq.w #1,$116(a6)   next section, bump counter
//   $083f6  gate, $8406                            next section
//   $08296  clr.w $18(a6)
//   $0829e  gate, st $27(a6), $18 = 1, st $26(a6)  end of stage
//
// $8406 itself is NOT implemented, and deliberately. It copies $a2..$b2 of the
// marker object into the scroll globals $106/$10a/$10e/$112 and repoints the
// wave list $c86 -- but $80f4 initialises only $e..$2e from the template, the
// record's parameter in d0 is never stored on the object at all, and nothing on
// the spawn path writes $a2 upward. So those fields are uninitialised at the
// point $8406 reads them, which means the mechanism is not understood well
// enough to port. Bumping the counter and raising the end-of-stage flags is
// what can be done honestly; swapping the scroll parameters is not.
function* sectionMarker(o, world, spec) {
  allocDefaults(o);
  o.x = SPAWN_TEMPLATE.x; o.y = SPAWN_TEMPLATE.y;
  const addr = spec.__addr;
  if (addr === '$08296') {                        // no gate: $8296 acts at once
    world.stageFlag18 = 0;                        // clr.w $18(a6)
    return;
  }
  yield* entryGate(o, world, spec.trigger || 0);  // $8abc
  if (addr === '$083e2') {
    world.sectionCounter++;                       // $83ee addq.w #1,$116(a6)
    world.saveCheckpoint(spec.waveIndex + 1);     // $8406: marker record + 6
  } else if (addr === '$083f6') {
    world.saveCheckpoint(spec.waveIndex + 1);     // $8406: marker record + 6
  } else if (addr === '$0829e') {
    world.endOfStage = true;                      // st $27 / st $26
    world.stageFlag18 = 1;                        // move.w #$1,$18(a6)
  }
  return;                                         // bra $7ec6
}

// ---------------------------------------------------------------------------
// ENEMY PROJECTILES
//
// $687e is the spawner every armed enemy goes through:
//
//   $6884  refuse while $f0 (live projectiles) is already 10
//   $6890  spawn $649c through $80fe, inheriting the firer's position
//   $689a  $28(a0) = d0, the heading
//
// $649c is the shot itself. It takes an $f0 slot for its lifetime, halts,
// sets speed $200, installs $676a as its hit handler, and picks its frame from
// the heading:
//
//   $64d2  d0 = $29 sign extended; if negative, negate it and set $38 = 2
//   $64e2  d0 = (d0 >> 4) - 4, doubled, indexed into the table at $650e
//
// That index only ever lands on 0..4 -- the entries either side of them are not
// frames at all -- so |angle| runs 64..128, the left-facing arc, and the $38
// flip mirrors up against down. The five frames are res 4, sprites 31 down
// to 27.
const SHOT_RES = 4;                  // preloaded by $9032 along with 2, 3 and 5
const SHOT_FRAME_TOP = 31;           // $650e[0]; the table runs 31 down to 27
const AIMED_SHOT_HANDLE = 0x2804;     // $6268 inline frame script
const TREE_SHOT_HANDLE = 0x2c04;      // $644c inline frame script
const CARRIER_FRAMES = [0x2e04, 0x3004, 0x3204, 0x3004]; // $669c
// $26 is stored RAW, exactly as the game holds it: setVelocity() is the thing
// that divides by 256. Pre-dividing here (and in five other places written
// earlier -- the res 17 train, the boss shot, and three sites in the stage 5
// dances) scaled those objects to 1/256 of their intended speed. The two in
// stage1Boss are NOT of this kind: that boss steers itself with a manual
// `o.x += (dx/d) * o.speed`, so its speed really is px/frame.
const ENEMY_SHOT_SPEED = 0x200;      // $64b0 -- the player's is $800
const SHOT_DEPTH = 0x4e40;           // $64a6
const PROJECTILE_POOL = 10;          // $6884 cmpi.w #$a,$f0

function shotFrame(world, angle) {
  const a = ((angle & 0xff) ^ 0x80) - 0x80;          // sign extend $29
  let i = (Math.abs(a) >> 4) - 4;                    // $64e2
  if (i < 0) i = 0; else if (i > 4) i = 4;
  // The table at $650e holds HANDLES -- 3e04 3c04 3a04 3804 3604 -- and the
  // high bits of a handle are the GAME index, which is not the sprite's
  // position in the atlas. Indexing the atlas array by 31..27 picked out
  // atlas entries 31..27, which for res 4 are 16x3 slivers; the handles
  // actually resolve to atlas 37..33, the 16x13 .. 16x6 bullets. Every enemy
  // shot in the game was being drawn three pixels tall.
  const handle = ((SHOT_FRAME_TOP - i) << 9) | SHOT_RES;   // $650e
  const it = world.byHandle.get(handle);
  return { handle, item: it, flip: a < 0 };          // $64dc sets $38 = 2
}

// $649c -- the standard enemy shot.
function* enemyShot(o, world, angle) {
  allocDefaults(o);
  o.__enemyShot = 'enemyShot';
  world.projectiles = (world.projectiles || 0) + 1;   // $64a2 addq.w #1,$f0
  try {
    o.depth = SHOT_DEPTH;                             // $64a6
    o.vx = 0; o.vy = 0; o.ax = 0; o.ay = 0;           // $64ac $89cc
    o.speed = ENEMY_SHOT_SPEED;                        // $64b0, raw $26
    o.angle = angle & 0xff;
    o.collides = true;                                // $64b6 installs $676a
    o.__invulnerable = true;      // $064c6 $48 = $ff, and $58 = $ff: an enemy
                                  // shot cannot be shot down and never explodes
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    const f = shotFrame(world, angle);
    if (f.item) { o.setHandle(f.handle); o.parts = null; }
    o.flip = f.flip;
    o.setVelocity();                                  // $64f0 $75b2
    world.lastSound = 0x4a;                           // $64f4, sound $4a
    for (;;) {                                        // $6502 $7d46
      if (o.done) return;
      if (o.x < -48 || o.x > 400 || o.y < -48 || o.y > 260) return;
      yield;
    }
  } finally {
    world.projectiles--;                              // $6506 subq.w #1,$f0
  }
}

// $6268 -- the aimed shot, which $6774 fires on the same $f0 cap. It aims at
// the player ($756e) and then jitters the heading by (rand & $f) - 8.
function* aimedShot(o, world) {
  allocDefaults(o);
  o.__enemyShot = 'aimedShot';
  world.projectiles = (world.projectiles || 0) + 1;   // $62b6
  try {
    o.depth = SHOT_DEPTH;                             // $6284
    o.ax = 0; o.ay = 0;                               // $6292 / $6296
    o.speed = 0x180;                                  // $629a, raw $26 = 1.5 px
    const p = world.player;
    let a = 0x80;
    if (p) {
      a = Math.round((Math.atan2(p.y - o.y, p.x - o.x) / (2 * Math.PI)) * 256);
    }
    a += ((Math.random() * 16) | 0) - 8;               // $62a4-$62ae
    o.angle = a & 0xff;
    o.collides = true;                                 // $6268 installs $676a
    o.__invulnerable = true;      // $06278 $48 = $ff / $0627e $58 = $ff
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    o.setHandle(AIMED_SHOT_HANDLE);                    // $6268 $7c38
    o.parts = null;
    o.flip = false;
    o.setVelocity();                                   // $62b2
    for (;;) {
      if (o.done) return;
      if (o.x < -48 || o.x > 400 || o.y < -48 || o.y > 260) return;
      yield;
    }
  } finally {
    world.projectiles--;                               // $62be
  }
}

// $63c8 -- the homing missile. Speed 2, and for 70 passes it turns at most 6
// toward the player every 4 frames ($7570 / $7d5c), refreshing its facing frame
// from $6416 each time, then flies straight.
const HOMING_PASSES = 0x46;      // $63ea
const HOMING_TURN = 6;           // $63f4
const HOMING_STEP = 4;           // $63fe

function* homingMissile(o, world, angle) {
  allocDefaults(o);
  o.__enemyShot = 'homingMissile';
  world.projectiles = (world.projectiles || 0) + 1;    // $63c8 addq.w #1,$f0
  try {
    o.depth = SHOT_DEPTH;                              // $63cc
    o.vx = 0; o.vy = 0; o.ax = 0; o.ay = 0;            // $63d2 $89cc
    o.speed = ENEMY_SHOT_SPEED;                         // $63d6, raw $26
    o.angle = angle & 0xff;
    o.collides = true;
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    const face = () => {                               // $6416
      o.faceFromAngle();
      o.flip = false;
    };
    face();
    o.setVelocity();                                   // $63e0
    for (let i = 0; i <= 15; i++) { if (o.done) return; yield; }   // $63e4
    for (let n = 0; n < HOMING_PASSES; n++) {          // $63ee
      if (o.done) return;
      o.turnTowardPlayer(HOMING_TURN);                 // $63f6 $7570
      face();
      for (let i = 0; i <= HOMING_STEP; i++) {         // $6400
        if (o.done) return;
        yield;
      }
    }
    for (;;) {                                         // $640a $7d46
      if (o.done) return;
      if (o.x < -48 || o.x > 400 || o.y < -48 || o.y > 260) return;
      yield;
    }
  } finally {
    world.projectiles--;                               // $640e
  }
}

// Attach the spawners the behaviours call. $687e and $62dc are the two entry
// points; both refuse once $f0 has reached 10.
function installProjectiles(world) {
  // $687e: spawn $649c at the firer's position with heading d0.
  world.spawnProjectile = (from, angle) => {
    if ((world.projectiles || 0) >= PROJECTILE_POOL) return null;   // $6884
    return world.spawnChildOf(from, function* (c, wd) {
      c.x = from.x; c.y = from.y; c.__addr = '$0649c';
      yield* enemyShot(c, wd, angle);
    }, {});
  };
  // $6774: the capped aimed shot at $6268.
  world.spawnAimedShot = (from) => {
    if ((world.projectiles || 0) >= PROJECTILE_POOL) return null;   // $677a
    return world.spawnChildOf(from, function* (c, wd) {
      c.x = from.x; c.y = from.y; c.__addr = '$06268';
      yield* aimedShot(c, wd);
    }, {});
  };
  // $6852: the twin-cannon launcher, on the same $f0 cap as the rest.
  world.spawnCarrier = (from) => {
    if ((world.projectiles || 0) >= PROJECTILE_POOL) return null;   // $6858
    const x = from.x, y = from.y;                          // $80fe snapshots $e/$12
    return world.spawnChildOf(from, function* (c, wd) {
      c.x = x; c.y = y; c.__addr = '$06600';
      yield* carrierShot(c, wd);
    }, {});
  };
  // $9c3a waits 16 frames, then $678a spawns the distinct $644c round.
  world.spawnTreeShot = (from) => world.spawnChildOf(from, function* (c, wd) {
    c.x = from.x; c.y = from.y; c.__addr = '$09c3a';
    for (let i = 0; i <= 0x10; i++) { if (c.done) return; yield; }
    if ((wd.projectiles || 0) >= PROJECTILE_POOL) return;
    wd.spawnChildOf(c, function* (shot, world2) {
      shot.x = c.x - 8; shot.y = c.y; shot.__addr = '$0644c';
      yield* treeShot(shot, world2);
    }, {});
  }, {});
  // $062c6 -> $063bc: the launcher's missile. It takes the shared heading in
  // $14e(a6) and flips that global by $18 on the way out, so a pair leaves on
  // two different lines before either starts homing.
  world.spawnMissile = (from) => {
    if ((world.projectiles || 0) >= PROJECTILE_POOL) return null;   // $62cc
    if (world.missileHeading === undefined)
      world.missileHeading = MISSILE_HEADING0;                      // $0194e
    const heading = world.missileHeading;                           // $63bc
    world.missileHeading ^= MISSILE_HEADING_FLIP;                   // $63c2
    return world.spawnChildOf(from, function* (c, wd) {
      c.x = from.x; c.y = from.y; c.__addr = '$063bc';
      yield* homingMissile(c, wd, heading);                         // $63c8
    }, {});
  };
  // $62dc: fire a homing missile at heading $76, from y + 4.
  world.spawnBossShot = (from) => {
    if ((world.projectiles || 0) >= PROJECTILE_POOL) return null;
    return world.spawnChildOf(from, function* (c, wd) {
      c.x = from.x; c.y = from.y + 4; c.__addr = '$063c8';   // $6306 addq.w #4,$12
      yield* homingMissile(c, wd, 0x76);               // $630a $28 = $76
    }, {});
  };
}

// ---------------------------------------------------------------------------
// THE PLAYER
//
// $0525e sets the object up and $052d8 is its loop. What matters here:
//
//   $529e  x = $ffc80000, so it flies in from off the left
//   $52a6  $26 = $200
//   $52bc  $170 = $64 -- 100 frames of grace on arrival
//   $52c2  $9a = 8, the autofire divider
//   $52d4  $560a fills all 64 trail slots with the current position
//   $52e0  st $f8, the flag the stage loop and wave dispatcher both watch
//   $52fc  if the object is not alive, jump to the death path at $5350
//
// Input goes through $057b4, which indexes the 16-entry table at $57ee with the
// joystick mask and REBUILDS the velocity every frame -- releasing the stick
// stops the dragon dead rather than letting it coast. Entry $ff means "no
// heading", which is what the contradictory pairs (up+down, left+right) give.
//
// Damage is one hit. $7d06 clears $36 outright unless $3a is still running, so
// the cooldown IS the invulnerability, and there are no hit points to speak of.
// engine.js already carries this table as INPUT_HEADING, straight from $57ee;
// a second copy here was redundant and would have drifted.
const PLAYER_START_X = -56;          // $529e $ffc80000
const PLAYER_SPAWN_GRACE = 0x64;     // $52bc $170
const PLAYER_DEPTH = 0x4e20;         // $5286
const PLAYER_FIRE_DIVIDER = 8;       // $52c2 $9a
const PLAYER_DEATH_HOLD = 0x64;      // $5394, 100 frames before the hand-off

// $5690 does NOT clamp the position -- it clamps the INPUT MASK, clearing the
// direction bit that would carry the player further out of bounds:
//
//   x <  8      bclr #2   drop LEFT        x > $138   bclr #3   drop RIGHT
//   y <  $6c    bclr #0   drop UP          y >= $6e   bclr #1   drop DOWN
//
// $6c and $6e are the ceiling + 8 and ground - 6 that $02148 derives. Clamping
// the position instead leaves the player one frame of velocity outside the
// bound, which is exactly the 2px overshoot this produced when it was written
// the other way round.
function clampInput(held, o, world) {
  const lo = (world.ceiling !== undefined ? world.ceiling : 0) + 8;   // $6c
  const hi = (world.ground !== undefined ? world.ground : 182) - 6;   // $6e
  if (o.x < 8) held &= ~INPUT.LEFT;
  if (o.x > 0x138) held &= ~INPUT.RIGHT;
  if (o.y < lo) held &= ~INPUT.UP;
  if (o.y >= hi) held &= ~INPUT.DOWN;
  return held;
}

function* playerObject(o, world) {
  world.playerActive = true;                       // $52e0 st $f8
  o.depth = PLAYER_DEPTH;                          // $5286
  o.speed = 0x200;                                 // $52a6, raw $26
  o.x = PLAYER_START_X;                            // $529e
  o.y = (world.ground !== undefined ? world.ground : 182) / 2;
  o.setHandle(HEAD.level);
  o.hitCooldown = 0;                               // $3a
  o.grace = PLAYER_SPAWN_GRACE;                    // $170
  o.fireDiv = PLAYER_FIRE_DIVIDER;                 // $9a
  o.prevInput = 0;
  world.shotCount = 0;                             // $52b0 clr.w $174
  for (let i = 0; i < 64; i++) world.trail[i] = { x: o.x, y: o.y };   // $560a

  for (;;) {                                       // $52d8 .. $534e
    // $52fc: the loop tests its own liveness and branches to $5350 itself.
    // Nothing kills the object from outside -- a hit clears $36 and the loop
    // notices, which is what lets the death path actually run.
    if (o.done || o.hp <= 0) break;
    if (o.hitCooldown > 0) o.hitCooldown--;        // $3a

    let held;
    if (o.grace > 0) {                             // $5932-$5974 arrival input
      const grace = o.grace--;
      held = INPUT.RIGHT | (((grace + 8) & 0x10) ? INPUT.DOWN : INPUT.UP);
      if (!o.grace) held = 0;                      // $5952 clears velocity
    } else {
      held = clampInput((world.input || 0) & 0xf, o, world);       // $5690
    }
    o.moveInput = held;                              // $598a, effective $a0 mask
    const heading = INPUT_HEADING[held];           // $57b4 / $57ee
    // $57da/$57de clear and rebuild $16/$1a each frame, so no input means no
    // movement at all rather than drifting on. The ENGINE integrates: adding
    // the velocity here as well moved the player twice per frame.
    o.vx = 0; o.vy = 0;
    if (heading !== -1) {
      o.angle = heading & 0xff;
      world.lastPlayerHeading = o.angle;             // $57d0 -> $122(a6)
      o.setVelocity();
    }

    // $57fe: fire on the press edge, then once every $9a frames while held.
    if (world.input & INPUT.FIRE) {
      if (!(o.prevInput & INPUT.FIRE)) o.fireDiv = 0;
      if (--o.fireDiv <= 0) {
        fire(world, o.x, o.y, world.pickupLevel || 0);
        o.fireDiv = PLAYER_FIRE_DIVIDER;
      }
    }
    o.prevInput = world.input || 0;
    yield;
  }

  // $5350: the death path. Two sounds, a death effect, then the object drops
  // below the ground line, waits, and hands $13e over to its successor while
  // clearing $f8 -- which is what lets the stage loop and the wave dispatcher
  // both notice.
  world.playSound(0x44);                           // $5366, twice through $69b6
  world.playSound(0x44);
  world.playerDying = true;
  if (world.onDeath) world.onDeath(o);             // $5380, $8332 burst
  o.y = (world.ground !== undefined ? world.ground : 182) + 0x40;   // $5384
  o.vx = 0; o.vy = 0;
  for (let i = 0; i < PLAYER_DEATH_HOLD; i++) yield;                // $5394
  world.playerActive = false;                      // $53a8 clr.w $f8
  world.playerDied();
}

// $6600 -- the twin-cannon munition. Not a plain shot: its template carries a
// flat vx of -4 for each inherited $664a child, while $8076 holds the invisible
// emitter without physics between four releases. The separated children form
// one long moving laser train.
//
//   $6600  clear $1e/$22 (accel) and $1a (vy)
//   $660c  $16 = $fffc0000, so vx = -4 exactly
//   $661a  sound $4b through $69b6
//   $6628  four spawns of $664a, $8076 waiting 4 frames between them
//
// $664a uses the global four-frame animation at $6686 and travels left with the
// inherited -4 velocity. The pool cap can trim the third of three simultaneous
// trains to two units, exactly as $6852/$664a do through $f0.
const CARRIER_VX = -4;              // $660c
const CARRIER_COUNT = 4;            // $6628
const CARRIER_INTERVAL = 4;         // $663a

function* treeShot(o, world) {
  allocDefaults(o);
  world.projectiles = (world.projectiles || 0) + 1;
  try {
    o.depth = SHOT_DEPTH;
    o.vx = -3; o.vy = 0; o.ax = 0; o.ay = 0;           // $644c
    o.collides = true;
    o.__invulnerable = true;
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    o.setHandle(TREE_SHOT_HANDLE);
    for (;;) { if (o.done) return; yield; }
  } finally {
    world.projectiles--;
  }
}

function* carrierFragment(o, world) {
  allocDefaults(o);
  world.projectiles = (world.projectiles || 0) + 1;       // $664a
  try {
    o.depth = 0x4a38;
    o.vx = CARRIER_VX; o.vy = 0; o.ax = 0; o.ay = 0;
    o.collides = true;
    o.__invulnerable = true;
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    for (;;) {
      o.setHandle(CARRIER_FRAMES[(world.frame >> 1) & 3]); // $6686/$669c
      if (o.done) return;
      yield;
    }
  } finally {
    world.projectiles--;
  }
}

function* carrierShot(o, world) {
  allocDefaults(o);
  o.ax = 0; o.ay = 0; o.vy = 0;                   // $6600 / $6604 / $6608
  // $660c is inherited by each child, but $8076 does not integrate the
  // emitter while it waits, leaving one fixed muzzle for the whole train.
  o.vx = 0;
  o.collides = false;                             // carrier never sets a frame
  world.lastSound = 0x4b;                         // $661a
  for (let n = 0; n < CARRIER_COUNT; n++) {       // $6628
    if (o.done) return;
    if ((world.projectiles || 0) < PROJECTILE_POOL) {
      world.spawnChildOf(o, function* (c, wd) {
        c.x = o.x; c.y = o.y; c.__addr = '$0664a';
        yield* carrierFragment(c, wd);
      }, {});
    }
    for (let i = 0; i <= CARRIER_INTERVAL; i++) {  // $663a $8076
      if (o.done) return;
      yield;
    }
  }
}

// $66a4 -- the fast round emitted by res27's $c24e recoil event through $68a6.
function* crashDiverShot(o, world) {
  allocDefaults(o);
  world.projectiles = (world.projectiles || 0) + 1;       // $66ec
  try {
    o.depth = 0x4a38;                                     // $66d4
    o.vx = -8; o.vy = 0; o.ax = 0; o.ay = 0;             // $66da/$66de
    o.collides = true;
    o.__invulnerable = true;                              // $66c0/$66ce
    o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
    o.setHandle(0x3404);                                  // $66e4
    world.lastSound = 0x48;                               // $66aa
    for (;;) { if (o.done) return; yield; }
  } finally {
    world.projectiles--;                                  // $66f4
  }
}

// ---------------------------------------------------------------------------
// THE $0d3xx / $0d4xx SET PIECES
//
// Six handlers built from a tiny movement vocabulary rather than from a frame
// script. Each primitive sets a velocity and then holds it for a number of
// frames, and $d618 -- "wait $3a", 58 frames -- is the unit they are all
// measured in:
//
//   $d596  vx -1.5              one unit          ($d5c8)
//   $d5a4  vx -1.0    wait 40 + three units       ($d5c4)
//   $d5b8  vx -1.5              three units
//   $d5d8  vx +1.0    wait 40 + three units       ($d5f8)
//   $d5ec  vx +1.5              three units
//   $d5fe  vy +1.5              one unit
//   $d60c  vy -1.5              one unit
//   $d61e  vy +1.0    wait 100
//   $d630  vy -1.0    wait 100
//
// Every one of them clears the other axis outright, so these are straight runs
// joined at right angles, not curves.
//
// $d642 is the shared prologue: acquire res $20, gate, hp $280, score 8, take
// the next depth from the $156(a6) counter (so successive set pieces layer
// behind one another), install the hit handlers, then hide via $50 for one unit
// before revealing. $d692 is the epilogue -- two more units, then release.
const D618 = 0x3a;                  // the unit: 58 frames

const SET_MOVES = {
  '$0d596': { vx: -1.5, vy: 0, wait: D618 },
  '$0d5a4': { vx: -1.0, vy: 0, wait: 0x28 + 3 * D618 },
  '$0d5b8': { vx: -1.5, vy: 0, wait: 3 * D618 },
  '$0d5ca': { vx: 1.5, vy: 0, wait: D618 },
  '$0d5d8': { vx: 1.0, vy: 0, wait: 0x28 + 3 * D618 },
  '$0d5ec': { vx: 1.5, vy: 0, wait: 3 * D618 },
  '$0d5fe': { vx: 0, vy: 1.5, wait: D618 },
  '$0d60c': { vx: 0, vy: -1.5, wait: D618 },
  '$0d61e': { vx: 0, vy: 1.0, wait: 0x64 },
  '$0d630': { vx: 0, vy: -1.0, wait: 0x64 },
};

// band/offset entries read the ceiling at run time; a plain y is absolute.
const SET_PIECES = {
  // $d304  x $190, y $24, vx -1.5
  '$0d304': { x: 0x190, y: 0x24, vx: -1.5, vy: 0,
              steps: ['$0d5b8', '$0d5fe', '$0d5ec'] },
  // $d330  x $ffc0 -- it enters from the LEFT and flies right
  '$0d330': { x: -0x40, y: 0x88, vx: 1.5, vy: 0,
              steps: ['$0d5ec', '$0d60c', '$0d5b8'] },
  '$0d35c': { x: -0x20, y: 0x30, vx: 1.5, vy: 0,
              steps: ['$0d5fe'] },
  '$0d380': { x: 0x170, y: 0x30, vx: -1.5, vy: 0,
              steps: ['$0d5fe'] },
  // $d3a4  x $170, y $88
  '$0d3a4': { x: 0x170, y: 0x88, vx: -1.5, vy: 0,
              steps: ['$0d596', { wait: 0x1e }, '$0d60c'] },
  '$0d3d2': { x: -0x40, y: 0x38, vx: 1.5, vy: 0, steps: ['$0d5ec'] },
  '$0d3da': { x: -0x40, y: 0x80, vx: 1.5, vy: 0, steps: ['$0d5ec'] },
  '$0d3e2': { x: -0x40, y: 0x28, vx: 1.5, vy: 0, steps: ['$0d5ec'] },
  '$0d3ea': { x: -0x40, y: 0x5c, vx: 1.5, vy: 0, steps: ['$0d5ec'] },
  '$0d3f2': { x: -0x40, y: 0x90, vx: 1.5, vy: 0, steps: ['$0d5ec'] },
  '$0d416': { x: 0x190, y: 0x30, vx: -1.5, vy: 0,
              steps: ['$0d596', '$0d5fe', '$0d5b8'] },
  '$0d442': { x: -0x40, y: 0x30, vx: 1.5, vy: 0,
              steps: ['$0d5ca', '$0d5fe', '$0d5ec'] },
  // $d46e/$d4bc/$d506 hang above the ceiling and descend into view.
  '$0d46e': { x: 0x38, band: 'ceiling', off: -0x20, vx: 0, vy: 1.0,
              hp: 0x7ff0, score: 2, depthBias: -8,
              steps: ['$0d61e', '$0d5d8', '$0d630', '$0d5a4', '$0d61e'] },
  '$0d4bc': { x: 0x118, band: 'ceiling', off: -0x20, vx: 0, vy: 1.0,
              hp: 0x7ff0, score: 2, depthBias: -8,
              steps: ['$0d61e', '$0d630', '$0d5a4', '$0d61e', '$0d5d8'] },
  // $d506 does not manoeuvre: it descends for 25 frames, drops its
  // acceleration and then simply runs until it is killed ($d542 $7d46).
  '$0d506': { x: 0xa8, band: 'ceiling', off: -0x20, vx: 0, vy: 1.0,
              hp: 0x7ff0, score: 2,
              steps: [{ vy: 1.0, wait: 0x19 }, { clearAccel: true, hold: true }] },
  '$0d54e': { x: 0xa8, band: 'ground', off: 0x20, vx: 0, vy: -1.0,
              hp: 0x7ff0, score: 2,
              steps: [{ vy: -1.0, wait: 0x19 }, { clearAccel: true, hold: true }] },
};

function* setPieceFollower(o, world, owner) {                 // $d6a0
  allocDefaults(o);
  o.__addr = '$0d6a0';
  o.collides = false;                                        // $89de
  o.__invulnerable = true;
  o.setHandle(0x0220);                                       // inline $0220,$b000
  for (;;) {
    if (owner.done) return;
    o.noDraw = !(world.frame & 1);                           // $d6c8 / $100 toggled at $2058
    o.x = owner.x;
    o.y = owner.y;
    o.vx = owner.vx;
    o.vy = owner.vy;
    o.ax = owner.ax;
    o.ay = owner.ay;
    yield;
  }
}

function* setPiece(o, world, spec) {
  const cfg = SET_PIECES[spec.__addr];
  if (!cfg) { for (;;) { if (o.done) return; yield; } }
  allocDefaults(o);
  o.x = cfg.x;
  if (cfg.band === 'ceiling')
    o.y = (world.ceiling !== undefined ? world.ceiling : 0) + cfg.off;
  else if (cfg.band === 'ground')
    o.y = (world.ground !== undefined ? world.ground : 0) + cfg.off;
  else o.y = cfg.y;

  // $d480 and friends set $1a before calling $d642, and $d642 gates. The gate
  // can hold for most of $348 scroll units, and this engine integrates position
  // every frame regardless of whether an object has entered yet -- so applying
  // the descent up front walked these three off the bottom of the screen before
  // they ever acquired a sprite. Position first, motion once it is really in.
  yield* entryGate(o, world, spec.trigger || 0);              // $d64a
  o.vx = cfg.vx || 0;
  o.vy = cfg.vy || 0;
  o.hp = 0x280;                                              // $d64e
  o.scoreAward = 8;                                          // $d654
  world.setPieceDepth = (world.setPieceDepth || 0);
  o.depth = world.setPieceDepth++;                           // $d65a / $d660
  o.collides = true;                                         // $d66c $7d06
  o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.__onDeath = (self, wd) => pairedBlastDeathEffect(wd, self); // $d664 -> $8746
  o.setHandle(world.firstHandleOfResource(32));              // $d646 res $20
  // the handler's own overrides land AFTER the prologue
  if (cfg.hp !== undefined) o.hp = cfg.hp;                   // $d48c etc
  if (cfg.score !== undefined) o.scoreAward = cfg.score;
  if (cfg.depthBias) o.depth += cfg.depthBias;               // $d498 subq #8
  o.__noCull = true;                                         // $d684 $50 = $ff
  world.spawnRetained(o, (part, wd) => setPieceFollower(part, wd, o), {}); // $d67c
  for (let i = 0; i <= D618; i++) { if (o.done) return; yield; }   // $d68a
  o.__noCull = false;                                        // $d68c

  for (const st of cfg.steps) {
    if (o.done) return;
    const mv = typeof st === 'string' ? SET_MOVES[st] : st;
    if (!mv) continue;
    // $89cc clears $16/$1a/$1e/$22: the object stops dead, it does not coast.
    if (mv.clearAccel) { o.vx = 0; o.vy = 0; o.ax = 0; o.ay = 0; }   // $89cc
    if (mv.vx !== undefined) o.vx = mv.vx;
    if (mv.vy !== undefined) o.vy = mv.vy;
    if (mv.hold) { for (;;) { if (o.done) return; yield; } } // $7d46
    for (let i = 0; i <= (mv.wait || 0); i++) {
      if (o.done) return;
      yield;
    }
  }
  // $d692: two more units, then the resource is released and it terminates.
  for (let i = 0; i <= 2 * D618; i++) { if (o.done) return; yield; }
}

// ---------------------------------------------------------------------------
// $09ebc -- THE ZIG-ZAG. The first enemy in the game.
//
// $09e70/$09e78/$09e80 are three lanes (y 60 / 92 / 124) of one carrier, and
// the carrier itself is invisible: all it does is pick a number and let eleven
// of these out at 25-frame intervals ($80a8, d0 = $a, d1 = $19).
//
//   $9e86  d0 = (rand & $1f) + $28        40..71
//   $9e92  move.w d0,$16(a5)              parked in $16 -- a PARAMETER, not a
//                                         velocity; nothing ever integrates it
//
// and the child reads it straight back out:
//
//   $9ebc  tst.w $a0(a6) ; ble $7ec6      no pool slot, no enemy
//   $9ec4  subq.w #1,$a0(a6)              take one
//   $9ed0  move.w $16(a5),$92(a5)         inherit the carrier's number
//   $9ee8  $16 = $fffe0000                vx = -2.0, flat, never changes
//   $9ef0  $1a = (rand & $1fff) - $9000   vy = -0.5625 .. -0.4375: UP, and slow
//   $9f04  $8240                          hold until it is on screen
//   $9f08  loop forever:
//   $9f0e      d0 = (rand & $1f) + $92    40..102 frames
//   $9f1a      wait d0
//   $9f1e      neg.l $1a(a5)              flip the drift
//
// So: half a pixel a frame, held for 40..102 frames, then reversed -- about 35
// pixels each way. That is the large, slow zig-zag, and because every child of
// one carrier inherits the same $92 they sway together with only their own
// 0..31 jitter separating them.
//
// The port had this child as { resource: 13, vx: -2 } and nothing else, so the
// entire opening wave flew dead straight.
const ZIGZAG_VX = -0x20000 / 65536;        // $9ee8, -2.0
const ZIGZAG_VY_MASK = 0x1fff;             // $9ef4
const ZIGZAG_VY_BIAS = 0x9000;             // $9efa
const ZIGZAG_JITTER = 0x1f;                // $9f12
const CARRIER_PARAM_MASK = 0x1f;           // $9e8a
const CARRIER_PARAM_BASE = 0x28;           // $9e8e

// $9e70/$9e78/$9e80: carriers that hand a number to their children through $16.
const STREAM_PARAM92 = new Set(['$09e70', '$09e78', '$09e80']);

// $9eda, the inline data after the $7c38 call: frames 0,1,2,3,2,1 of res $d and
// then $9000, whose opcode (bits 14..12 = 1) loops to the start. A ping-pong
// wing beat, not a static sprite.
const ZIGZAG_SCRIPT = [0x000d, 0x020d, 0x040d, 0x060d, 0x040d, 0x020d, 0x9000];

function* zigzagFlier(o, world, spec) {
  // $9ebc: the pool test comes first, and an empty pool means this enemy simply
  // never exists. waveChild already took the slot on our behalf.
  o.playFrames(ZIGZAG_SCRIPT);                           // $9ed6 $7c38
  o.vx = ZIGZAG_VX;                                      // $9ee8
  const r = (Math.random() * 0x100000000) | 0;
  o.vy = (((r & ZIGZAG_VY_MASK) - ZIGZAG_VY_BIAS) | 0) / 65536;   // $9ef0-$9f00
  // $92 comes from the carrier; fall back to the same range if it is absent.
  const base = spec.__param92 !== undefined
    ? spec.__param92
    : CARRIER_PARAM_BASE + ((Math.random() * (CARRIER_PARAM_MASK + 1)) | 0);

  while (o.x > 336) {                                    // $9f04 $8240
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
  for (;;) {                                             // $9f08
    const hold = ((Math.random() * (ZIGZAG_JITTER + 1)) | 0) + base;   // $9f0e-$9f16
    for (let i = 0; i <= hold; i++) {                    // $9f1a $7d5c
      if (o.done) return;
      if (o.x + world.leftExtent(o) < -48) return;
      yield;
    }
    o.vy = -o.vy;                                        // $9f1e neg.l $1a
  }
}

// ---------------------------------------------------------------------------
// $09ca4 / $09cb8 -- THE WEAVE, and its mirror partner.
//
// $09c48 is the carrier: it picks a lane, sets the ACCELERATION, and streams
// eleven of these out at 18-frame intervals.
//
//   $9c4c  y = (rand & $1f) + $3c          lane 60..91
//   $9c58  $22 = $1000                     ay = 0.0625, inherited by the stream
//   $9c84  $80a8 d0 = $a, d1 = $12         eleven children, 18 frames apart
//
// $09ca4 is the entry, and the first thing it does is make a twin:
//
//   $9ca4  neg.l $22(a5)                   flip the acceleration...
//   $9ca8  spawn $9cb8                     ...so the sibling inherits it flipped
//   $9cb4  neg.l $22(a5)                   then put ours back
//
// so the pair weave in opposite phase and cross each other. $9cb8 is the shared
// body, which is also where the sibling starts -- it is the same routine minus
// the twinning.
//
//   $9ce4  push $22 then clear it          no weave while it is still off screen
//   $9cec  $16 = $fffe8000                 vx = -1.5
//   $9cf4  $8240                           come on screen
//   $9cf8  restore $22                     and only now start accelerating
//   $9cfc  loop: wait 20, neg $22, wait 40, neg $22, wait 20
//
// $9d24 is the unit -- "wait $14", 20 frames. With ay = 0.0625 held for 20
// frames the vertical speed reaches 1.25 px/frame before it is turned around,
// which is a broad smooth S rather than the sharp zig-zag of $09ebc. Two
// different oscillators, and the port had both as straight lines.
const WEAVE_SCRIPT = [0x000c, 0x020c, 0x040c, 0x060c, 0x080c,
                      0x0a0c, 0x0c0c, 0x0e0c, 0x100c, 0x9000];   // $9cd0
const WEAVE_VX = -0x18000 / 65536;      // $9cec, -1.5
const WEAVE_AY = 0x1000 / 65536;        // $9c58, 0.0625
const WEAVE_UNIT = 0x14;                // $9d24, 20 frames

function* weaveFlier(o, world, spec) {
  const ay0 = spec.__parentAy !== undefined ? spec.__parentAy : WEAVE_AY;

  // $9ca4: only the twinning entry makes a partner, and it hands over the
  // flipped acceleration. $9cb8 (the mirror) falls straight through to the body.
  if (!spec.__mirror) {
    // $9cb8 opens with `tst.w $a0(a6) ; ble $7ec6 ; subq.w #1,$a0(a6)`, so the
    // twin takes a pool slot of its own and simply does not appear when the
    // pool is dry. Spawning it outside the budget would put more enemies on
    // screen than the original ever allows.
    if (world.streamBudget > 0) {
      world.streamBudget--;
      const twin = world.spawnChildOf(o, function* (c, wd) {
        c.x = o.x; c.y = o.y;
        // $80fe copies the parent's fields into the child. The twin does not go
        // through waveChildBody, so without this it kept the raw defaults --
        // depth 0 above all else, which painted it over the whole scene.
        c.depth = o.depth; c.hp = o.hp; c.scoreAward = o.scoreAward;
        c.boxX = o.boxX; c.boxY = o.boxY;
        c.collides = o.collides; c.onHitPlayer = o.onHitPlayer;
        c.__addr = '$09cb8';
        try {
          yield* weaveFlier(c, wd, { ...spec, __mirror: true, __parentAy: -ay0 });
        } finally {
          wd.streamBudget++;
        }
      }, {});
      twin.__fromStream = false;      // released by its own finally
    }
  }

  o.playFrames(WEAVE_SCRIPT);                    // $9ccc $7c38
  o.vx = WEAVE_VX;                               // $9cec
  o.vy = 0;
  o.ay = 0;                                      // $9ce8, parked while entering
  while (o.x > 336) {                            // $9cf4 $8240
    if (o.done) return;
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
  o.ay = ay0;                                    // $9cf8, the weave begins

  const hold = function* (n) {
    for (let i = 0; i <= n; i++) {
      if (o.done) return true;
      if (o.x + world.leftExtent(o) < -48) return true;
      yield;
    }
    return false;
  };
  for (;;) {                                     // $9cfc
    if (yield* hold(WEAVE_UNIT)) return;         // $9d02
    o.ay = -o.ay;                                // $9d04
    if (yield* hold(WEAVE_UNIT)) return;         // $9d08
    if (yield* hold(WEAVE_UNIT)) return;         // $9d0a
    o.ay = -o.ay;                                // $9d0c
    if (yield* hold(WEAVE_UNIT)) return;         // $9d10
  }
}

const C452_FRAMES = [0x082e, 0x0a2e, 0x0c2e, 0x0e2e, 0x102e, 0x122e,
                     0x142e, 0x162e, 0x002e, 0x022e, 0x042e, 0x062e];

function* turningChild46(o, world) {                       // $c452
  o.speed = 0x880;                                         // $c45a
  o.angle = 0x80;                                          // $c460
  const top = !(world.c452LaneToggle || false);            // $c47a not.w $150
  world.c452LaneToggle = top;
  const turn = top ? -2 : 2;                               // $c46e/$c480
  o.y = top ? 0x16 : 0xa2;                                 // $c474/$c484
  const face = () => {
    const index = Math.min(11, Math.floor((o.angle & 0xff) / 0x16));
    o.setHandle(C452_FRAMES[index]);                        // $c4ba
  };
  face();
  o.setVelocity();                                         // $c46a
  while (o.x > 336) { if (o.done) return; yield; }         // $c48a
  for (;;) {                                               // $c48e
    if (o.done) return;
    o.turnBy(turn);                                        // $c494 -> $75ae
    o.vy /= 4;                                             // $c49c asr.l #2
    face();
    yield;
  }
}

const AD42_VARIANTS = [
  { y: 0x5c, handle: 0x0012, fireDy: -10 },                // $ad52
  { y: 0x44, handle: 0x0212, fireDy: -2 },                 // $ad64
  { y: 0x8c, handle: 0x0412, fireDy: 10 },                 // $ad76
  { y: 0x2c, handle: 0x0612, fireDy: 0 },                  // $ad88
];

function* reversingChild18(o, world) {                     // $ad42
  const variantIndex = world.ad42Variant || 0;             // $154
  world.ad42Variant = (variantIndex + 1) & 3;               // $adb0/$adb4
  const variant = AD42_VARIANTS[variantIndex];
  o.y = variant.y;
  o.setHandle(variant.handle);
  o.hp = 0xa0; o.scoreAward = 4;                           // $adba/$adc0
  o.vx = -0xe000 / 65536; o.vy = 0; o.ax = 0; o.ay = 0;   // $adc6
  while (o.x > 336) { if (o.done) return; yield; }         // $adce
  for (;;) {                                               // $add2
    if (o.done) return;
    if (o.vx < 0 && variant.fireDy && Math.random() * 0x10000 >= 0x9999 &&
        world.spawnCarrier) {                              // $adde-$ae02
      const x = o.x, y = o.y;
      o.x -= 4; o.y += variant.fireDy;
      world.spawnCarrier(o);
      o.x = x; o.y = y;
    }
    for (let frame = 0; frame < 0x64; frame++) {           // $ae06/$ae8a
      if (o.done) return;
      if (o.x <= 0) {
        o.vx = 0x800 / 65536;                              // $ae98
        o.ax = 0x40 / 65536;                               // $aea0
      }
      yield;
    }
  }
}

const AF16_SCRIPT = [0x0014, 0x0214, 0x9000];              // $af26

function* oscillatingChild20(o, world) {                   // $af16
  o.vx = -2; o.vy = 0;
  o.playFrames(AF16_SCRIPT);
  while (o.x > 336) { if (o.done) return; yield; }         // $af32
  const halfCycle = function* (vy) {
    o.vy = vy;
    for (let frame = 0; frame < 0x1e; frame++) {
      if (o.done) return false;
      yield;
    }
    return true;
  };
  if (!(yield* halfCycle(-0.5))) return;                    // $af36/$af60
  if (!(yield* halfCycle(0.5))) return;                     // $af38/$af6e
  if (Math.random() * 0x10000 >= 0x9999 && world.spawnAimedShot)
    world.spawnAimedShot(o);                               // $af3a-$af44
  for (;;) {
    if (!(yield* halfCycle(-0.5))) return;
    if (!(yield* halfCycle(0.5))) return;
  }
}

function* arcingChild19(o, world, spec) {                  // $a782/$a7ac
  const ceiling = spec.__routine === '$0a782';
  o.y = ceiling ? (world.ceiling || 0) - 0x10
                : (world.ground || 0) + 0x10;
  o.vy = ceiling
    ? (0x3e000 + ((Math.random() * 0x2000) | 0)) / 65536
    : (((Math.random() * 0x2000) | 0) - 0x40000) / 65536;
  o.ay = ceiling ? -0x1000 / 65536 : 0x1000 / 65536;
  o.hp = 0x40; o.scoreAward = 3;
  o.x = 0x130 - ((Math.random() * 0x100) | 0);           // $a7f0-$a7f6
  o.vx = (((Math.random() * 0x20000) | 0) - 0x10000) / 65536;
  o.setHandle(Math.random() < 0.5 ? 0x0013 : 0x0213);    // $a832
  o.__noCull = true;
  for (let frame = 0; frame < 0x32; frame++) { if (o.done) return; yield; }
  o.__noCull = false;
  for (;;) { if (o.done) return; yield; }
}

function* mirroredChild21(o, world, spec) {                // $a1e8/$a1ec
  const mirrored = spec.__routine === '$0a1e8';            // $a1e8 st $92
  o.setHandle(0x0015);                                     // $a200
  o.y = (world.ground || 0) + ((Math.random() * 0x10) | 0);
  o.x += (Math.random() * 0x10) | 0;
  o.vx = -GROUND_SCROLL;
  o.ax = -(0x120 + ((Math.random() * 0x400) | 0)) / 65536; // $a228-$a23a
  o.ay = -0x300 / 65536;
  if (mirrored) {
    o.y = 0xb8 - o.y;                                     // $a24c/$a250
    o.ay = -o.ay;                                         // $a256
    o.flip = true;
  } else o.flip = false;
  o.__noCull = true;
  for (let frame = 0; frame < 0x32; frame++) { if (o.done) return; yield; }
  o.__noCull = false;
  for (;;) { if (o.done) return; yield; }
}

const A27E_FALL_SCRIPT = [0x8050, 0x0015, 0x8004, 0x0215, 0x0415, 0xb000];
const A27E_LAND_SCRIPT = [0x8008, 0x0615, 0xa000, 0x0815, 0x0a15,
                          0x0c15, 0x0e15, 0x1015, 0x9000];
const A27E_EXIT_SCRIPT = [0x8004, 0x0215, 0x0015, 0xb000];

function* landingChild21(o, world) {                       // $a27e
  o.playFrames(A27E_FALL_SCRIPT);                          // $a292
  o.y = (world.ceiling || 0) - ((Math.random() * 0x10) | 0);
  o.x += 0x20 - ((Math.random() * 0x80) | 0);             // $a2b4-$a2c0
  o.vx = -GROUND_SCROLL; o.vy = 2;
  o.ax = 0; o.ay = -0x380 / 65536;
  o.__noCull = true;
  const landingY = (world.ground || 0) - 0x0e;
  while (o.y < landingY) { if (o.done) return; yield; }    // $a2e8-$a2fc
  o.y = landingY;
  o.vx = -GROUND_SCROLL; o.vy = o.ax = o.ay = 0;          // $a2fe-$a308
  for (let frame = 0; frame <= 0x14; frame++) { if (o.done) return; yield; }
  o.playFrames(A27E_LAND_SCRIPT);                          // $a312
  while (!o.scriptFlag) { if (o.done) return; yield; }     // $a328
  o.vx -= 0xc000 / 65536;
  for (let frame = 0; frame <= 0x14; frame++) { if (o.done) return; yield; }
  if (world.spawnAimedShot) world.spawnAimedShot(o);       // $a33a
  for (let frame = 0; frame <= 0x1e; frame++) { if (o.done) return; yield; }
  o.playFrames(A27E_EXIT_SCRIPT);                          // $a344
  o.__noCull = false;
  o.ax = -0x120 / 65536;
  o.ay = -0x100 / 65536;
  for (;;) { if (o.done) return; yield; }
}

const BBD4_SCRIPT = [0x0022, 0x0222, 0x9000];              // $bbfa

function* streamChild34(o, world, spec) {                   // $bbd4/$bbd8
  const lower = spec.__routine === '$0bbd8';
  const launchY = 0x20 + ((Math.random() * 0x80) | 0) / 16;
  o.y = 0x5c + (lower ? launchY : -launchY);                // $bc48/$bc10
  o.vx = (-0x48000 + ((Math.random() * 0x80) | 0)) / 65536;
  o.vy = (0x10000 + ((Math.random() * 0x80) | 0)) / 65536;
  o.ax = (0x800 + ((Math.random() * 0x80) | 0)) / 65536;
  o.ay = (-0x280 + ((Math.random() * 0x80) | 0)) / 65536;
  if (lower) { o.vy = -o.vy; o.ay = -o.ay; }               // $bbda-$bbe2
  o.playFrames(BBD4_SCRIPT);
  const delay = (Math.random() * 0x10) | 0;                // $bc04-$bc0c
  for (let frame = 0; frame <= delay; frame++) { if (o.done) return; yield; }
  while (o.x > 336) { if (o.done) return; yield; }          // $bc16
  if (Math.random() * 0x10000 >= 0xcccc && world.spawnAimedShot)
    world.spawnAimedShot(o);                               // $bc1a-$bc24
  for (let frame = 0; frame <= 0xc8; frame++) { if (o.done) return; yield; }
  if (world.spawnAimedShot) world.spawnAimedShot(o);        // $bc30
  for (;;) { if (o.done) return; yield; }
}

// Child routines with a transcribed behaviour of their own. Checked before the
// generic velocity path, which can only express "one constant vector".
const CHILD_BEHAVIOURS = {
  '$062f2': terrainUnitShot,
  '$0633a': terrainUnitShot,
  '$0a1e8': mirroredChild21,
  '$0a1ec': mirroredChild21,
  '$0a27e': landingChild21,
  '$0a782': arcingChild19,
  '$0a7ac': arcingChild19,
  '$0bbd4': streamChild34,
  '$0bbd8': streamChild34,
  '$09ebc': zigzagFlier,
  '$09ca4': weaveFlier,
  '$0ad42': reversingChild18,
  '$0af16': oscillatingChild20,
  '$0c452': turningChild46,
  '$0b832': jitteredUnitBody,
  '$0ee14': stage5TubeMissile,
  '$0ee6a': (o, world) => groundStructureBody(o, world, false),
  '$0f14e': stage5StructureTop,
  '$0f1f4': stage5ColumnPiece,
  '$09082': mound,
  '$099a4': res11Launcher,
  '$09f8e': moundGunner,
  '$09fa2': moundGunner,
};

// $516c: the common enemy install, shared by 19 wave handlers.
//   $92(a5) = descriptor      a code pointer, not a data record
//   $44/$4c/$54 = $ff         ignore the damage handlers
//   $48(a5) = $51c2           death handler (plays sound $45)
//   $2a(a5) = $64             draw depth
// The wrapper before it sets the spawn lane in $12(a5); the descriptor routine
// sets the live sprite through an inline $7c38 script.
//
// DERIVED: lane, depth, sprite, death sound.
// NOT DERIVED: horizontal motion. The descriptor's per-frame handler is not yet
// transcribed, so these drift with the scroll -- a placeholder, not the real
// movement.
// $825e: the template $80f4 copies into every wave-spawned object ($e..$2d).
// These are the real spawn defaults -- previously invented here.
const SPAWN_TEMPLATE = {
  x: 368,          // $0e, the screen right edge
  y: 92,           // $12, the default lane
  vx: 0, vy: 0,    // $16 / $1a
  speed: 0,        // $26
  heading: 0xc0,   // $28
  depth: 0x2bc,    // $2a = 700
};

// $516c's family overrides the template depth with $64; everything else keeps
// the template's 700.
// $90aa: the bush at the foot of the stage 1 scenery. Every value is derived:
//   $9082  addi.w #$10,$e(a5)      x + 16
//   $90ae  y = $6a(a6)             the stage ground level
//   $90b4  subi.w #$10,$12(a5)     y - 16
//   $90ba  move.w #$190,$2a(a5)    depth 400, in front of the tree (498/500)
//   $90c0  move.w #$1237,$30(a5)   game index 9 of res 55 = the bush chain
// $bc48: y = -((rand & $7f) >> 4 + $20), i.e. spawns 32..39px above the screen.
const RANDOM_Y_MIN = 0x20;

const BUSH_HANDLE = 0x1237, BUSH_DEPTH = 0x190, BUSH_DX = 0x10, BUSH_DY = -0x10;
const TREE_X_OFFSET = 0x30;   // $92e6

// $8190-$81ae: what the allocator gives every object before the handler runs.
const ALLOC = { box: 8, hp: 0x10, score: 1, cooldown: 0x19 };

// $81dc gives every object these before its handler runs. Hand-transcribed
// behaviours bypass waveEnemy, so they must apply them explicitly or they
// inherit GameObject's zeros instead of the game's defaults.
function allocDefaults(o) {
  o.hp = ALLOC.hp;              // $819c
  o.scoreAward = ALLOC.score;   // $81a2
  o.boxX = ALLOC.box;           // $8190
  o.boxY = ALLOC.box;           // $8196
  // $8120 copies the $825e template into $e..$2e, and $2a -- the depth -- is
  // inside that range. Leaving it at 0 put every hand-transcribed behaviour
  // that does not set its own depth at the very front of the paint order, on
  // top of the player and, more visibly, on top of the enemy shots at $4e40.
  o.depth = SPAWN_TEMPLATE.depth;   // $825e +$2a = $2bc
}

// The $0516c "enemy install" family: 21 wave handlers, 84 records, every one
// of them reached as `lea <routine>(pc),a0 ; bsr $516c`. $516c sets up the
// object itself, and two of the things it sets were invisible to the field
// extractor because of HOW it sets them:
//
//   $5178  subq.w #1,$16(a5)     velocity, as a DECREMENT of the template's
//                                $16 (which is 0), so vx = -1
//   $519c  move.w #$64,$2a(a5)   depth 100, overriding the template's 700
//
// The extractor looks for moves into a field, so the `subq` never registered
// and all 21 handlers came through with no velocity at all. They then fell to
// the DEFAULT_SPEED fallback, which gave them 0x200 on the default heading --
// vx = -2, exactly double the speed the game runs them at. This was the last
// real thing that fallback was standing in for.
//
// $51aa then loops $51b6 for life, which is just the standard physics step
// ($7d98, or $7db4 while the $104 freeze is up) -- it adds no motion.
const INSTALL_516C = new Set([
  '$04bea', '$04bf2', '$04c0c', '$04c62', '$04c7c', '$04cc4', '$04d00',
  '$04d1a', '$04d46', '$04d68', '$04d9c', '$04e0c', '$04e14', '$04e26',
  '$04ed0', '$04ed8', '$04f20', '$04f68', '$04fb0', '$050d0', '$050ea',
]);
const INSTALL_516C_VX = -1;         // $5178
const ENEMY_DEPTH = 0x64;           // $519c
const ENEMY_DEATH_SOUND = 0x45;
// ENTRY_LEAD lives in engine.js -- it is also the level's start scroll.
const DEFAULT_HEADING = 0x80;       // $28(a5), left
// The $825e template sets $26 to ZERO -- an enemy with no explicit speed does
// not move under its own power in the game; its motion comes from a behaviour
// routine. Substituting a speed here made every unhandled enemy drift left at a
// uniform 2 px/frame, which masked three real gaps (longword velocity stores,
// the $80a8 stream spawner, the scroll rate) behind plausible-looking motion.
// Now that those are covered, only 7 handlers / 20 records are left without a
// motion source, and they should be visibly still rather than quietly faked.
// The $825e template sets $26 to ZERO, so this 0x200 is INVENTED, not derived.
// Retiring it was tried and reverted: the check that said only 7 handlers / 20
// records lacked a motion source counted WAVE HANDLERS, but most enemies on
// screen are $80a8 stream children, whose routines mostly carry no explicit
// velocity either. With the default at 0 they stood still, never drifted off
// screen, and accumulated -- peak object count went from 41 to 139 on stage 2.
// The right order is: find the child routines' real motion, THEN retire this.
// $0abec sets $26 = $200 outright, which corroborates this value. It survives
// only as a fallback for a handler that sets no speed and no velocity -- and
// as of the carrier fix no object in any of the five stages reaches it, so it
// is no longer standing in for anything (tools/speed_audit.js checks this).
const DEFAULT_SPEED = 0x200;        // $0abec

// $8abc: the screen-entry gate. An object is created when the scroll reaches
// its record's trigger, then held until the scroll has advanced a further
// $348, at which point it enters with a sub-pixel x correction.
// $8abc: hold the object until the scroll reaches its record's trigger plus
// $348, then back-date its position by however far the scroll overshot in the
// final step.
//
// The trigger MUST come from the record ($8500 puts it in $2c(a5)), which means
// it has to be read off the object at call time. The dispatch table builds one
// spec per handler at start-up, so a trigger captured in that closure is simply
// absent: entryGate then computed d against a trigger of 0 and every object it
// gated entered thousands of pixels off the left edge, to be culled on the
// frame it was born. Whole handlers looked "implemented but silent" that way.
function* entryGate(o, world, trigger) {
  for (;;) {
    const d = (trigger + ENTRY_LEAD) - world.scroll;
    if (d <= 0) { o.x += d; return; }      // $8ad6
    yield;                                  // $8ad0
  }
}

// A wave enemy built from the fields extracted out of its handler
// (web/assets/handler_fields.json): resource, lane, heading, speed, hp, score.
//
// DERIVED: entry gate, lane, depth, heading/speed where the handler sets them,
// hit points, score, death sound, and which resource the graphics come from.
// APPROXIMATED: the sprite INDEX within that resource -- $8a98 acquires the
// resource but the index is set by the handler's body, which is not yet read.
function* waveEnemy(o, world, spec) {
  // start from the $825e template, then apply what the handler overrides
  o.x = spec.x !== undefined ? spec.x : SPAWN_TEMPLATE.x;
  o.y = SPAWN_TEMPLATE.y;
  o.depth = spec.depth !== undefined ? spec.depth : SPAWN_TEMPLATE.depth;
  o.deathSound = ENEMY_DEATH_SOUND;
  // $44 holds the hit handler. An object collides only if its handler installs
  // one; the allocator leaves it unset, and $516c writes $ff to disable it
  // outright. Scenery (the tree, the bush) never touches $44 and must not
  // collide -- 40 of 139 handlers install one, 2 disable it, 97 leave it alone.
  o.collides = spec.harmless ? false : true;   // $08144, see above
  if (o.collides) o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  o.hp = spec.hp !== undefined ? spec.hp : ALLOC.hp;            // $36
  o.scoreAward = spec.score !== undefined ? spec.score : ALLOC.score;  // $2e
  o.boxX = spec.boxX !== undefined ? spec.boxX : ALLOC.box;     // $32
  o.boxY = spec.boxY !== undefined ? spec.boxY : ALLOC.box;     // $34
  // $38(a5) low two bits: bit 1 mirrors vertically, bit 0 horizontally. This is
  // how a single routine draws for both the floor and the ceiling bank.
  if (spec.mirror & 2) o.flip = true;
  if (spec.mirror & 1) o.flipX = true;
  // Scenery that cannot be shot away -- see anchors.json / extract_anchors.py.
  if (spec.invulnerable) o.__invulnerable = true;
  // $6a(a6): ground-standing objects take their y from the stage's ground
  // level plus a fixed offset, instead of a lane.
  if ((o.__addr || spec.__addr) === '$0aeda') {
    o.y = 0x3c + ((Math.random() * 0x40) | 0);          // $aee6-$aef2
  }
  else if (spec.groundRelative && world.ground !== undefined) {
    o.y = world.ground + (spec.groundOffset || 0);
    o.__snapGround = true;   // resolved once the sprite is known, below
  }
  // $68(a6): the ceiling bank, the mirror image of the same idea. A negative
  // offset starts the object ABOVE the line and it descends into view -- see
  // $0d46e, which pairs ceiling-32 with vy = +1.
  else if (spec.ceilingRelative && world.ceiling !== undefined) {
    o.y = world.ceiling + (spec.ceilingOffset || 0);
  }
  else if (spec.y !== undefined) o.y = spec.y;         // absolute lane
  else if (spec.dy !== undefined) o.y += spec.dy;      // relative to the template
  yield* entryGate(o, world, spec.trigger || 0);
  // $16/$1a: some handlers write velocity directly (the high word of the 16.16
  // field, so whole px/frame) instead of going through speed+heading. Those
  // move on a fixed vector and must not be overwritten by $75b2.
  if (spec.terrainLocked) {
    o.vx = -GROUND_SCROLL;                             // $8730 sets $16 only...
    o.vy = spec.vy || 0;                               // ...so an explicit $1a survives
  } else if (spec.vx !== undefined || spec.vy !== undefined) {
    o.vx = spec.vx || 0;
    o.vy = spec.vy || 0;
  } else {
    o.angle = (spec.heading !== undefined ? spec.heading : DEFAULT_HEADING) & 0xff;
    if (spec.__carrier) { o.speed = 0; o.vx = o.vy = 0; }   // spawner: no motion
    else {
      o.speed = spec.speed !== undefined ? spec.speed : DEFAULT_SPEED;
      if (spec.speed === undefined) o.__usedDefaultSpeed = true;   // for auditing
      o.setVelocity();                                 // $75b2
    }
  }
  // a composite ($93e4 list) overrides the single-sprite path entirely
  // $92e6 and friends: many handlers shift x after the entry gate. That both
  // positions the object and pushes wide ones fully off-screen so they slide in
  // instead of popping into view.
  const preOffsetX = o.x;
  if (spec.xOffset) o.x += spec.xOffset;

  if (spec.parts) {
    o.parts = spec.parts; o.setHandle(spec.parts[0].handle);
    o.x += world.leftExtent(o);        // enter on the leftmost pixel
    // $9300 -> $09340: three res 9 riders sit on top of this structure. They
    // were never spawned, which is why res 9 appeared nowhere in stage 1.
    // The generic dispatch sets o.__addr, not spec.__addr -- read it off the
    // object or this never matches.
    if ((o.__addr || spec.__addr) === '$092b0') {
      // $092b0 IS the tree -- eight res 55 parts making a trunk and a canopy,
      // with the res 9 riders hanging in the top of it. Like every other piece
      // of scenery its hit box is the allocator's 8x8 at the anchor, so in the
      // original you cannot realistically shoot it; with only $10 hit points
      // from $819c, one hit was felling it here.
      o.__invulnerable = true;
      for (const dx of RIDER_OFFSETS)
        world.spawn((c, wd) => res9Rider(c, wd, o.x + dx, o.y), {});
      // $09308 calls $89de, which writes $ff over $44, $48, $4c, $50 and $54 --
      // the tree goes completely inert. $0930c then runs $09418 for 101 frames
      // and $09312 does `clr.b $50`, putting only the off-screen handler back.
      // The tree is VISIBLE throughout; what those 101 frames buy is immunity
      // from culling while it crosses in. Treating $50 as "hidden" made it
      // invisible for two hundred pixels and then pop into view mid-screen.
      o.__noCull = true;
      o.__cullAfter = RIDER_REVEAL;
    }
    // $92d8 spawns a child ($90aa) that plants a bush at the tree's foot:
    // y = $6a(a6) - $10, depth $190 = 400, sprite $1237 (res 55 index 9).
    // Its lower depth puts it in front, covering the join at the base.
    if (spec.bush && world.ground !== undefined) {
      world.spawn(function* (b, wd) {
        b.setHandle(BUSH_HANDLE);
        // $92d8 spawns this child BEFORE the tree's own +48 ($92e6), and $80fe
        // copies the parent's x as it stands then. So the bush sits at the
        // pre-offset x plus its own +16 -- 32px left of the tree's anchor.
        // bush = pre-offset x + $10, tree = pre-offset x + $30, so the bush
        // sits 32px left of the tree's anchor -- taken from the tree's final x
        // so it inherits the same entry shift.
        b.x = o.x + (BUSH_DX - TREE_X_OFFSET); b.y = wd.ground + BUSH_DY;
        b.depth = BUSH_DEPTH; b.setHandle(BUSH_HANDLE);
        for (;;) { b.x += o.vx; if (b.x < -48) return; yield; }
      }, {});
    }
  }
  else if (spec.handle !== undefined) o.setHandle(spec.handle);
  // A stream parent never gets a sprite. Every one of the 16 in the game has
  // the same body -- acquire a resource, entry gate, $80a8, release, terminate
  // -- and not one of them calls $7cb8, so not one of them has a frame. The
  // resource it acquires is for its CHILDREN (parent and child acquire the
  // same id), and the fields it sets are the template $80fe copies into them.
  // Giving the parent that resource drew a spurious enemy and, having no
  // velocity of its own, sent it down the invented-speed path.
  else if (spec.resource !== undefined && !spec.__carrier) {
    const h = world.firstHandleOfResource(spec.resource);
    if (h !== undefined) o.setHandle(h);
  }
  // Ground scenery stands ON the ground line. For res 55 the handler's offset
  // is exactly the negative of the sprite's base offset for two of the three
  // chains (-33 vs +33, -16 vs +16) so they land flush; the third pairs -12
  // with a +15 base and ends up 3px sunk. The raw templates are correct and so
  // is the -12, so something the port does not model adjusts it. Snapping the
  // base to the ground reproduces what the game shows.
  if (o.__snapGround && o.sprite) {
    const base = world.baseOffset(o);
    if (base !== null) o.y = world.ground - base;
  }

  if (!spec.parts && !spec.preserveX) o.x += world.leftExtent(o); // enter by artwork
  // $80a8(routine, count, interval): release a STREAM of enemies -- count+1
  // children of one routine, `interval` frames apart, spawned from the parent's
  // position. This is what a "wave" actually is; 16 handlers use it and it
  // accounts for roughly 870 enemies across the five stages. Without it every
  // one of those records produced a single enemy.
  // $9e8e: this carrier family parks a random $28..$47 in $16 for no reason
  // except to hand it to its children through $92 at $9ed0. It is a parameter
  // travelling in a velocity field, which is why nothing looked wrong about it.
  if (STREAM_PARAM92.has(spec.__addr))
    o.__param92 = CARRIER_PARAM_BASE + ((Math.random() * (CARRIER_PARAM_MASK + 1)) | 0);

  if (spec.stream && world.childRoutines) {
    const cf = world.childRoutines[spec.stream.routine];
    if (cf) {
      for (let i = 0; i < spec.stream.count; i++) {
        // $0a1ec: a stream child checks $a0(a6) and terminates at once if the
        // pool is empty, so a stream of 26 does not always yield 26 enemies.
        if (world.streamBudget <= 0) break;
        world.streamBudget--;
        const child = { ...cf, trigger: spec.trigger, __routine: spec.stream.routine,
                        __parentX: o.x, __parentY: o.y,
                        __param92: o.__param92, __parentAy: o.ay };
        const kid = world.spawnChildOf(o, (co, wd) => waveChild(co, wd, child), {});
        kid.__fromStream = true;
        for (let f = 0; f < spec.stream.interval; f++) {
          if (o.x + world.leftExtent(o) < -48) return;
          yield;                                   // $8076 waits between spawns
        }
      }
    }
  }

  // $80fe/$80f4: many handlers spawn a formation rather than one enemy. Each
  // child gets the parent's position plus the offsets applied between the lea
  // and the spawn call, and runs with its own extracted fields.
  if (spec.children && world.childRoutines) {
    for (const c of spec.children) {
      const cf = world.childRoutines[c.routine];
      if (!cf) continue;
      const child = { ...cf, trigger: spec.trigger, __routine: c.routine,
                      __parentX: o.x + c.dx, __parentY: o.y + c.dy };
      world.spawnChildOf(o, (co, wd) => waveChild(co, wd, child), {});
    }
  }

  // $0d172's family: fly straight, curve, straighten. Everything else just
  // runs the default physics step, which the loop below already does.
  if (spec.turnRate !== undefined && spec.phases) {
    yield* curvingEnemy(o, world, spec);
    return;
  }


  for (;;) {
    if (o.x + world.leftExtent(o) < -48) return;   // cull on the artwork, too
    yield;
  }
}

// Three child routines set their velocity in a way the extractor cannot follow,
// so they arrive with none and would fall to the DEFAULT_SPEED fallback.
//
// $0ca9c / $0caaa are a mirror pair. Each sets $92 -- to -1 and +1 respectively
// -- and their shared tail at $cabc holds it for 189 frames before executing
// `move.w $92(a5),$1a(a5)` at $cafc: the velocity IS the $92 they were given.
// The extractor sees a move between two object fields, not a constant, so it
// records nothing.
//
// $0de66 is the stage 5 boss segment. Its motion never comes from $16/$1a at
// all -- it comes from the dance in its jump table entry -- so it correctly has
// no velocity of its own and must not be given one.
// $0a7ac is a ground-launched spray: it takes its x AND both velocity
// components from the RNG, as 16.16 longs, which is why none of the three
// registered. Read straight off $a7b8-$a80a:
//
//   $a7b8  vy = (rand & $1fff) - $40000     -4.00 .. -3.50 px/frame, upward
//   $a7f0  x  = $130 - (rand & $ff)         49 .. 304
//   $a7fa  vx = (rand & $1ffff) - $10000    -1.00 .. +1.00 px/frame
//
// with ay = $1000 pulling it back down -- so it is thrown up off the ground and
// falls, drifting either way. Entries may be numbers or functions; a function
// is re-evaluated per object, which is the point for these.
const CHILD_VELOCITY = {
  '$0ca9c': { vy: -1, delay: 0xbd },   // $caa2 $92 = $ffff, applied at $cafc
  '$0caaa': { vy: 1, delay: 0xbd },    // $cab6 $92 = $1
  '$0de66': { vy: 0, vx: 0 },          // driven by its dance, not by velocity
  '$0a7ac': {
    vy: () => (((Math.random() * 0x2000) | 0) - 0x40000) / 65536,
    vx: () => (((Math.random() * 0x20000) | 0) - 0x10000) / 65536,
    x: () => 0x130 - ((Math.random() * 256) | 0),
  },
};

const childField = (v) => (typeof v === 'function' ? v() : v);

// A formation member. It is already past the entry gate (the parent waited), so
// it takes the parent's position directly and runs on its own fields.
function* waveChild(o, world, spec) {
  // NOT $f0. That counts live enemy PROJECTILES -- its increment/decrement
  // pairs bracket routines in $62b6..$66f4, one of which is $63c8, the homing
  // missile, and all ten of its `cmpi.w #$a` gates are in the projectile
  // spawners at $6774..$68a6. Counting formation children here was counting a
  // different population than the cap applies to, which let the figure drift
  // past 10 with nothing to enforce it.
  try {
    yield* waveChildBody(o, world, spec);
  } finally {
    if (o.__fromStream) world.streamBudget++; // $9d1c / $9f2c
  }
}

function* waveChildBody(o, world, spec) {
  // Attribute every child to the routine that made it. This used to be set only
  // on the DEFAULT_SPEED audit path, so all children -- formations, streams,
  // companions -- collapsed into one "(child)" bucket and there was no way to
  // tell a routine that never spawned from one whose children were simply
  // unlabelled.
  o.__addr = spec.__routine || '(child)';
  o.x = spec.__parentX;
  o.y = spec.__parentY;
  o.depth = spec.depth !== undefined ? spec.depth : SPAWN_TEMPLATE.depth;
  o.hp = spec.hp !== undefined ? spec.hp : ALLOC.hp;
  o.scoreAward = spec.score !== undefined ? spec.score : ALLOC.score;
  o.collides = spec.harmless ? false : true;   // $08144, see above
  if (o.collides) o.onHitPlayer = (self, wd) => { wd.damage(self, 1); };
  if (CHILD_DEATH_EFFECTS[spec.__routine])
    o.__onDeath = (self, wd) => CHILD_DEATH_EFFECTS[spec.__routine](wd, self);
  if (spec.handle !== undefined) {
    o.setHandle(typeof spec.handle === 'string' ? parseInt(spec.handle.slice(1), 16) : spec.handle);
  } else if (spec.resource !== undefined) {
    const h = world.firstHandleOfResource(spec.resource);
    if (h !== undefined) o.setHandle(h);
  }
  if (spec.groundRelative && world.ground !== undefined && o.sprite) {
    const base = world.baseOffset(o);
    if (base !== null) o.y = world.ground - base;
  } else if (spec.y !== undefined) o.y = spec.y;
  if (spec.terrainLocked) { o.vx = -GROUND_SCROLL; o.vy = spec.vy || 0; }
  else if (spec.vx !== undefined || spec.vy !== undefined) {
    // $bc48 builds these as `random + base`, but the random source ($bc88 =
    // $86fe & $7f) yields 0..127 -- and the velocity fields are 16.16, so that
    // term is at most 0.002 px/frame. The randomness is negligible HERE; it is
    // the spawn y (a plain word) that gets a real spread. An earlier version of
    // this applied a fabricated +/-0.75 spread to velocity, three orders of
    // magnitude too large.
    o.vx = spec.vx || 0;
    o.vy = spec.vy || 0;
    if (spec.randomised) o.y -= RANDOM_Y_MIN + ((Math.random() * 128) | 0 >> 4);
    if (spec.ax) o.ax = spec.ax;
    if (spec.ay) o.ay = spec.ay;
  } else {
    const cv = CHILD_VELOCITY[spec.__routine];
    if (cv) {
      o.vx = childField(cv.vx) || 0;
      o.vy = 0;
      if (cv.x !== undefined) o.x = childField(cv.x);
      if (cv.delay) o.__applyVyAfter = { frames: cv.delay, vy: childField(cv.vy) };
      else o.vy = childField(cv.vy) || 0;
    } else {
      o.angle = (spec.heading !== undefined ? spec.heading : DEFAULT_HEADING) & 0xff;
      o.speed = spec.speed !== undefined ? spec.speed : DEFAULT_SPEED;
      if (spec.speed === undefined) {
        o.__usedDefaultSpeed = true;                // same audit as waveEnemy
      }
      o.setVelocity();
    }
  }
  // A child with its own transcription runs that instead of coasting on the
  // single constant vector the generic path can express.
  const bespoke = CHILD_BEHAVIOURS[spec.__routine];
  if (bespoke) {
    yield* bespoke(o, world, spec);
    return;
  }
  let held = 0;
  for (;;) {
    // $cabc: the pair above stand still, then take their velocity from $92.
    if (o.__applyVyAfter) {
      if (++held >= o.__applyVyAfter.frames) {
        o.vy = o.__applyVyAfter.vy;                 // $cafc
        o.__applyVyAfter = null;
      }
    }
    // This used to read `if (o.owner && o.owner.done) return;`, which killed a
    // formation member the moment its spawner was culled. The spawner sits at
    // the same place as its children and drifts at the same speed, so the first
    // member to reach the left edge took the whole rest of the wave with it --
    // entire formations vanishing mid-screen.
    //
    // The disassembly does not say that. $9c28 tests `tst.l $5c`: whether the
    // owner POINTER is null, not whether the owner is dead. And $7ec6 clears
    // that pointer only for the RETAINED child at $60, the single one from
    // $80d0. Children spawned by $80fe or $80a8 keep their owner and outlive it.
    if (o.__diesWithOwner && !o.owner) return;    // $9c28, retained child only
    if (o.x + world.leftExtent(o) < -48) return;
    yield;
  }
}

// $83e2: not an enemy. It reloads the stage parameter block ($8406 copies
// $a2..$b2 into $106/$10a/$10e/$112/$c86), i.e. it advances the level to its
// next section. Present in all five stages.
// Wave records that are not enemies at all but section markers. $8406 copies
// the object's $a2..$b2 into the scroll globals $106/$10a/$10e/$112 and points
// $c86 at the next wave sub-list, so these advance the stage rather than spawn:
//   $083e2  gate, $8406, then addq.w #1,$116(a6)   -- next section, bump counter
//   $083f6  gate, $8406                            -- next section
//   $08296  clr.w $18(a6)                          -- clear the stage flag
//   $0829e  gate, st $27(a6), $18 = 1, st $26(a6)  -- raise end-of-stage flags
const CONTROL_HANDLERS = new Set(['$083e2', '$083f6', '$08296', '$0829e']);

// Build the scheduler's handler table. Only handlers with real extracted data
// produce an enemy; the rest are left unimplemented rather than spawning an
// invisible placeholder that would inflate the object count and mislead.
function buildWaveHandlers(fields, wrappers, composites, anchors) {
  const table = {};
  const generic = new Set();      // handlers that fell through to waveEnemy
  const unimplemented = [];
  for (let [addr, f] of Object.entries(fields || {})) {
    // $6a(a6)/$68(a6): objects that belong to a band read the band line out of
    // the globals rather than carrying a lane, because the line moves per stage
    // -- that is how one handler sits correctly in five different levels. The
    // offsets and the $38 mirror bits are extracted mechanically into
    // anchors.json; merge them in before anything dispatches. Existing
    // groundRelative data wins, so nothing already correct is disturbed.
    const anc = anchors && anchors[addr];
    if (anc) {
      f = { ...f };
      if (anc.band === 'ground' && !f.groundRelative) {
        f.groundRelative = true;
        f.groundOffset = anc.offset || 0;
      } else if (anc.band === 'ceiling' && !f.ceilingRelative) {
        f.ceilingRelative = true;
        f.ceilingOffset = anc.offset || 0;
      }
      if (anc.mirror && f.mirror === undefined) f.mirror = anc.mirror;
      if (anc.terrain && f.terrainLocked === undefined) f.terrainLocked = true;
      // $48 holding $06772 (a bare rts) or $ff means shots do nothing to it.
      if (anc.invulnerable) f.invulnerable = true;
      if (anc.harmless) f.harmless = true;      // $44 = $ff
    }
    if (CONTROL_HANDLERS.has(addr)) {
      const cm = { ...f, __addr: addr };
      table[addr] = (o, world) => sectionMarker(o, world, {
        ...cm, trigger: o.trigger, waveIndex: o.waveIndex,
      });
      continue;
    }
    // Behaviours transcribed directly from the disassembly set their own
    // handle, so they run whether or not the extractor isolated a resource --
    // they must be dispatched ahead of the resource gate below.
    if (BD52_CFG[addr]) {
      const pu = { ...f, __addr: addr, trigger: undefined };
      table[addr] = (o, world) => paramUnit(o, world, { ...pu, trigger: o.trigger });
      continue;
    }
    if (C118_CFG[addr]) {
      const cd = { ...f, __addr: addr };
      table[addr] = (o, world) => crashDiver(o, world, { ...cd, trigger: o.trigger });
      continue;
    }
    if (SET_PIECES[addr]) {
      const sp = { ...f, __addr: addr };
      table[addr] = (o, world) => setPiece(o, world, { ...sp, trigger: o.trigger });
      continue;
    }
    if (addr === '$0d6d4') {
      const b4 = { ...f };
      table[addr] = (o, world) => stage4Boss(o, world, { ...b4, trigger: o.trigger });
      continue;
    }
    if (addr === '$0dd2e') {
      const b5 = { ...f };
      table[addr] = (o, world) => stage5Boss(o, world, { ...b5, trigger: o.trigger });
      continue;
    }
    if (addr === '$09482') {
      const b1 = { ...f };
      table[addr] = (o, world) => stage1Boss(o, world, { ...b1, trigger: o.trigger });
      continue;
    }
    if (addr === '$0b01a') {
      const b2 = { ...f };
      table[addr] = (o, world) => stage2Boss(o, world, { ...b2, trigger: o.trigger });
      continue;
    }
    if (addr === '$0c4e6') {
      const b3 = { ...f };
      table[addr] = (o, world) => stage3Boss(o, world, { ...b3, trigger: o.trigger });
      continue;
    }
    // A handler with no isolated `resource` is not necessarily un-spawnable.
    // The resource is the low 9 bits of a handle, so an explicit handle names
    // it outright -- and a set of handles the extractor could not corroborate
    // still determines it whenever they all agree on those 9 bits, differing
    // only in game index (i.e. they are frames of one object). Beyond that, a
    // handler that spawns children is a real carrier even with no sprite of its
    // own. Only a handler with no visual and no children is genuinely nothing.
    const f2 = { ...f };
    if (f2.resource === undefined) {
      const hs = (f2.handles_uncorroborated || []).map((h) => parseInt(h.slice(1), 16));
      if (typeof f2.handle === 'string' || typeof f2.handle === 'number') {
        const h = typeof f2.handle === 'string' ? parseInt(f2.handle.slice(1), 16) : f2.handle;
        f2.resource = h & 0x1ff;
        f2.__resourceFrom = 'handle';
      } else if (hs.length && new Set(hs.map((h) => h & 0x1ff)).size === 1) {
        f2.resource = hs[0] & 0x1ff;
        f2.handle = hs[0];                    // first frame of the agreeing set
        f2.__resourceFrom = 'agreeing handles';
      } else if (f2.children || f2.spawnsChildren) {
        f2.__carrier = true;                  // real object, no sprite of its own
        f2.__resourceFrom = 'carrier';
      } else {
        unimplemented.push(addr);
        continue;
      }
    }
    f = f2;
    // handles arrive from JSON as "$xxxx" strings; setHandle needs a number.
    const spec = { ...f };
    if (typeof spec.handle === 'string') spec.handle = parseInt(spec.handle.slice(1), 16);
    if (spec.stream && spec.handle === undefined) spec.__carrier = true;
    if (INSTALL_516C.has(addr)) {
      const wrapper = wrappers && wrappers[addr];
      if (wrapper && wrapper.sprites && wrapper.sprites.length)
        spec.handle = parseInt(wrapper.sprites[0].slice(1), 16);
      const cap = { ...spec, __addr: addr };
      table[addr] = (o, world) => weaponCapsule(o, world, { ...cap, trigger: o.trigger });
      continue;
    }
    const parts = composites && composites[addr];
    if (parts) { spec.parts = parts.parts; spec.bush = true; }
    // transcribed behaviours override the generic waveEnemy
    if (addr === '$09fbe') {
      const gs = { ...spec };
      table[addr] = (o, world) => groundGunner(o, world, { ...gs, trigger: o.trigger });
      continue;
    }
    if (addr === '$09210' || addr === '$0921a' || addr === '$091f6') {
      const hc = { ...spec, __addr: addr };
      table[addr] = (o, world) => hillWithChild(o, world, { ...hc, trigger: o.trigger });
      continue;
    }
    if (addr === '$0ab16') {
      const hs = { ...spec };
      table[addr] = (o, world) => headingSpawner(o, world, { ...hs, trigger: o.trigger });
      continue;
    }
    // $09a54 was handled here by retainedSpawner, which made ONE anonymous
    // retained child and nothing else. The real routine is a five-link tree --
    // see treeSpawner below, which supersedes this.
    if (addr === '$0a5c0') {
      const as = { ...spec };
      table[addr] = (o, world) => acceleratingUnit(o, world, { ...as, trigger: o.trigger });
      continue;
    }
    // $09082 has NO wave records -- it exists only as a child of $092b0, so it
    // is wired through CHILD_BEHAVIOURS rather than dispatched here.
    if (addr === '$09a54') {
      const tr = { ...f, __addr: addr };
      table[addr] = (o, world) => treeSpawner(o, world, { ...tr, trigger: o.trigger });
      continue;
    }
    if (addr === '$090fc') {
      const tg = { ...spec };
      table[addr] = (o, world) => tiger(o, world, { ...tg, trigger: o.trigger });
      continue;
    }
    if (addr === '$0909a') {
      const bp = { ...spec };
      table[addr] = (o, world) => bushPlacer(o, world, { ...bp, trigger: o.trigger });
      continue;
    }
    if (addr === '$0eee2' || addr === '$0eefa') {
      const vs = { ...spec, variant: addr === '$0eee2' ? 3 : 2 };
      table[addr] = (o, world) => variantSeeder(o, world, { ...vs, trigger: o.trigger });
      continue;
    }
    if (addr === '$0f196' || addr === '$0f19e' || addr === '$0f1a6' || addr === '$0f1ae') {
      const counts = { '$0f196': 1, '$0f19e': 2, '$0f1a6': 3, '$0f1ae': 4 };
      const column = { ...spec, count: counts[addr] };
      table[addr] = (o, world) => stage5ColumnSpawner(o, world, { ...column, trigger: o.trigger });
      continue;
    }
    if (addr === '$0b846') {
      const js = { ...spec };
      table[addr] = (o, world) => jitteredUnit(o, world, { ...js, trigger: o.trigger });
      continue;
    }
    if (addr === '$0bed6' || addr === '$0bf02' || addr === '$0bf2e' || addr === '$0bf58' || addr === '$0beaa') {
      const cs = { ...spec, __addr: addr };
      table[addr] = (o, world) => childSpawner(o, world, { ...cs, trigger: o.trigger });
      continue;
    }
    if (addr === '$0ee74') {
      const zs = { ...spec };
      table[addr] = (o, world) => groundStructure(o, world, { ...zs, trigger: o.trigger });
      continue;
    }
    if (addr === '$0c2fa' || addr === '$0c2fe') {
      const ts = { ...spec, __addr: addr };
      table[addr] = (o, world) => terrainUnit(o, world, { ...ts, trigger: o.trigger });
      continue;
    }
    if (addr === '$0ed9c' || addr === '$0f0d6' || addr === '$0f0d2') {
      const s5 = { ...spec, __addr: addr };
      table[addr] = (o, world) => stage5Structure(o, world, { ...s5, trigger: o.trigger });
      continue;
    }
    if (addr === '$0b638' || addr === '$0b58e' || addr === '$0b5e0') {
      const bs = { ...spec, __addr: addr };
      table[addr] = (o, world) => heavyGround(o, world, { ...bs, trigger: o.trigger });
      continue;
    }
    if (addr === '$099b4') {
      const g11 = { ...spec };
      table[addr] = (o, world) => groundUnit11(o, world, { ...g11, trigger: o.trigger });
      continue;
    }
    if (addr === '$0a850') {
      const cl = { ...spec };
      table[addr] = (o, world) => clearSpawner(o, world, { ...cl, trigger: o.trigger });
      continue;
    }
    if (addr === '$0c17a') {
      const fl = { ...spec };
      table[addr] = (o, world) => faller(o, world, { ...fl, trigger: o.trigger });
      continue;
    }
    if (addr === '$0b766' || addr === '$0b76e' || addr === '$0b776') {
      const hu = { ...spec, __addr: addr };
      table[addr] = (o, world) => heavyUnit(o, world, { ...hu, trigger: o.trigger });
      continue;
    }
    if (addr === '$0a378') {
      const rz = { ...spec };
      table[addr] = (o, world) => riser(o, world, { ...rz, trigger: o.trigger });
      continue;
    }
    if (addr === '$0be5a' || addr === '$0bf8e') {
      const ms = { ...spec, __addr: addr };
      table[addr] = (o, world) => multiSpawner(o, world, { ...ms, trigger: o.trigger });
      continue;
    }
    if (addr === '$0ba0a' || addr === '$0ba0e' || addr === '$0b9f2' || addr === '$0b9ee') {
      const gs = { ...spec, __addr: addr };
      table[addr] = (o, world) => groundEmitter(o, world, { ...gs, trigger: o.trigger });
      continue;
    }
    if (addr === '$0b978' || addr === '$0b98a') {
      const base41 = { ...spec, __addr: addr };
      table[addr] = (o, world) => staticBase41(o, world, { ...base41, trigger: o.trigger });
      continue;
    }
    if (addr === '$0af7c' || addr === '$0af98') {
      const es = { ...spec, __addr: addr };
      table[addr] = (o, world) => emplacement(o, world, { ...es, trigger: o.trigger });
      continue;
    }
    if (addr === '$0a4f4' || addr === '$0a4fa' || addr === '$0a500' || addr === '$0a4dc' || addr === '$0a4e2' || addr === '$0a4d6') {
      const ws = { ...spec, __addr: addr };
      table[addr] = (o, world) => swooper(o, world, { ...ws, trigger: o.trigger });
      continue;
    }
    if (addr === '$0ae24') {
      const ss = { ...spec };
      table[addr] = (o, world) => scatterFlier(o, world, { ...ss, trigger: o.trigger });
      continue;
    }
    if (HEAVY_LANES[addr]) {
      const hs = { ...spec, __addr: addr };
      table[addr] = (o, world) => heavyFlier(o, world, { ...hs, __stage: world.stage, trigger: o.trigger });
      continue;
    }
    if (CURVE_ENTRIES[addr]) {
      const curve = { ...spec, ...CURVE_ENTRIES[addr], __addr: addr };
      table[addr] = (o, world) => {
        o.__addr = addr;
        return waveEnemy(o, world, { ...curve, trigger: o.trigger });
      };
      continue;
    }
    generic.add(addr);       // fell through to waveEnemy: the wrapper pass may override
    table[addr] = (o, world) => { o.__addr = addr; return waveEnemy(o, world, { ...spec, trigger: o.trigger }); };
  }
  // The 19 wrappers carry an exact sprite handle and a lane, but everything
  // else (collides, hp, score, velocity...) still comes from the field scan --
  // MERGE, do not replace, or those fields are silently lost.
  //
  // This pass REPLACES table[addr], so it must skip anything the pass above
  // transcribed by hand -- otherwise a bespoke behaviour is built and then
  // quietly thrown away. That is what happened to the weapon capsules: the
  // capsule dispatch ran, and then this loop overwrote all twenty-one of them
  // with waveEnemy, so they kept drawing their post-hit frame. A handler only
  // reaches here if the pass above had nothing better for it.
  for (const [addr, w] of Object.entries(wrappers || {})) {
    if (!generic.has(addr)) continue;
    const handle = w.sprites.length ? parseInt(w.sprites[0].slice(1), 16) : undefined;
    const base = { ...(fields && fields[addr]) };
    if (typeof base.handle === 'string') base.handle = parseInt(base.handle.slice(1), 16);
    const spec = { ...base, y: w.y, handle, depth: ENEMY_DEPTH };
    if (INSTALL_516C.has(addr)) { spec.vx = INSTALL_516C_VX; spec.vy = 0; }
    table[addr] = (o, world) => { o.__addr = addr; return waveEnemy(o, world, { ...spec, trigger: o.trigger }); };
  }
  // Tag every spawned object with the handler that made it, on EVERY dispatch
  // path. Only the generic waveEnemy path used to do this, so the transcribed
  // behaviours -- all three bosses, the tiger, the whole hand-written set --
  // produced objects that no audit could attribute, and a per-handler check
  // read them as "this handler produced nothing at all".
  //
  // The same wrapper carries the indestructible flag, for the same reason: only
  // waveEnemy read spec.invulnerable, so the hand-written handlers -- the hills,
  // the emitters, the stage 5 structures and the stage 1 boss -- stayed
  // shootable however the data was marked. Setting it here covers every path at
  // once. It is applied BEFORE the behaviour runs so a handler can still clear
  // it deliberately.
  for (const addr of Object.keys(table)) {
    if (addr.startsWith('__')) continue;
    const inner = table[addr];
    const invuln = !!(anchors && anchors[addr] && anchors[addr].invulnerable);
    table[addr] = (o, world) => {
      o.__addr = addr;
      if (invuln) o.__invulnerable = true;     // $48 holds $06772 or $ff
      return inner(o, world);
    };
  }
  table.__unimplemented = unimplemented;
  return table;
}

// $61b0: a player shot.
//   $44/$48/$4c/$54/$58 = $ff   the shot ignores the damage handlers
//   $e(a5) += $10               spawns 16 px ahead of the head
//   $26(a5) = $800              8 px/frame
//   $174(a6) counts live shots  -- what the $58aa limit is checked against
// The sprite is not set here and $61b0 makes no $7cb8 call, so the handle
// below is still a placeholder.
const SHOT_SPEED = 0x800;
const SHOT_X_OFFSET = 0x10;
// $06176 is the shot's step, and it expires the shot itself rather than waiting
// for it to leave the world:
//   $6176  cmpi.w #$160,$e(a5) / bcc $6188      x >= 352 ...
//   $6188  bsr $7d40                            ... mark dead
// Letting the engine's off-screen cull do it instead kept each shot alive for
// another 288px, and since $174 counts LIVE shots and the weapon limit is
// checked against that count, the player's fire rate was being throttled by
// shots that should already have expired.
const SHOT_EXPIRE_X = 0x160;

function* playerShot(o, world, angle) {
  o.speed = SHOT_SPEED;
  o.depth = 0x8011;                 // $2a, from $5842's caller
  o.x += SHOT_X_OFFSET;
  o.angle = angle & 0xff;
  o.setVelocity();
  o.setHandle(0x0004);              // placeholder frame
  o.__playerShot = true;            // $06192 stamps these into the grid
  o.__stopsOnHit = true;            // $61f6: cleared grid bit -> $7d40
  world.shotCount = (world.shotCount || 0) + 1;
  try {
    for (;;) {
      if (!o.alive()) break;
      if (o.x >= SHOT_EXPIRE_X) break;          // $6176 / $7d40
      const ceiling = (world.ceiling || 0) + 8; // $6136-$613c
      const ground = (world.ground || 0) - 8;   // $6146-$614c
      if ((world.shotCeiling && o.y < ceiling) ||
          (world.shotGround && o.y >= ground)) {
        o.vy = -o.vy;                           // $6154
      }
      yield;
    }
  } finally { world.shotCount--; }
}

// $05f14, weapon index 1. $05826 emits the green spread first and $058f2 then
// dispatches this independent projectile, so the orange fireball accompanies
// the main shots rather than replacing them. $17e selects its animation tier;
// $17a gives this family its own one-shot live limit ($591e[1] = 1).
const FIREBALL_FRAMES = [
  [0x0804, 0x0a04, 0x9000],
  [0x0c04, 0x0e04, 0x9000],
  [0x1004, 0x1204, 0x9000],
];
const SECONDARY_LIMITS = [4, 1, 4, 4];                    // $591e
const SECONDARY_STATIC_FRAMES = {
  0: [0x1804, 0x1604, 0x1404],                           // $5edc-$5ef4
  2: [0x1e04, 0x1c04, 0x1a04],                           // $602e-$604a
};
const SECONDARY_SPREAD_FRAMES = [
  [0x2404, 0x2204, 0x2004, 0xb000],
  [0x2404, 0x2204, 0xb000],
  [0x2404, 0xb000],
];

function* secondaryShot(o, world, spec) {
  world.weaponShotCount = (world.weaponShotCount || 0) + 1;
  try {
    o.depth = 0x4e21;
    o.x += spec.dx || 0;
    o.y += spec.dy || 0;
    if (spec.frames) o.playFrames(spec.frames);
    else o.setHandle(spec.handle);
    if (spec.angle !== undefined) {
      o.angle = spec.angle & 0xff;
      o.speed = spec.speed || SHOT_SPEED;
      o.setVelocity();
    } else {
      o.vx = spec.vx || 0;
      o.vy = spec.vy || 0;
    }
    o.__playerShot = true;
    o.__stopsOnHit = spec.stopsOnHit !== false;
    for (;;) {
      if (o.done || o.x >= SHOT_EXPIRE_X || o.x < -48 || o.y < -48 || o.y > 230) return;
      if (spec.reflectTerrain) {
        const ceiling = (world.ceiling || 0) + 8;
        const ground = (world.ground || 0) - 8;
        if ((world.shotCeiling && o.y < ceiling && o.vy < 0) ||
            (world.shotGround && o.y >= ground && o.vy > 0)) {
          o.vy = -o.vy;                                // $6154
          o.y += o.vy * 2;                              // $615e/$6162
        }
      }
      yield;
    }
  } finally {
    world.weaponShotCount--;
  }
}

function* playerFireball(o, world, level) {
  const tier = Math.min(level || 0, FIREBALL_FRAMES.length - 1);
  world.weaponShotCount = (world.weaponShotCount || 0) + 1;
  try {
    o.depth = 0x4e21;                              // $5f3a
    o.x += [0x10, 0x16, 0x20][tier];              // $5f5e/$5f74/$5f90
    o.y += [0, 1, 2][tier];                       // $5f64/$5f78
    o.vx = 6; o.vy = 0;                           // $5f8c-$5f96
    o.playFrames(FIREBALL_FRAMES[tier]);
    o.__playerShot = true;
    o.__stopsOnHit = true;                          // $610c -> $616c
    for (;;) {
      if (o.done || o.x >= SHOT_EXPIRE_X) return; // $610c -> $616c/$6176
      yield;
    }
  } finally {
    world.weaponShotCount--;
  }
}

function fireSecondary(world, x, y) {
  const type = Math.min(3, Math.max(0, world.weaponIndex || 0));
  const tier = Math.min(2, world.weaponLevel || 0);
  const room = SECONDARY_LIMITS[type] - (world.weaponShotCount || 0);
  if (room <= 0) return false;
  const spawn = (spec) => world.spawn((o, wd) => secondaryShot(o, wd, spec), { x, y });

  if (type === 0) {
    const handle = SECONDARY_STATIC_FRAMES[0][tier];
    spawn({ handle, dx: 10, vx: 5, vy: -5, reflectTerrain: true, stopsOnHit: false });
    if (room > 1)
      spawn({ handle, dx: 10, vx: 5, vy: 5, reflectTerrain: true, stopsOnHit: false }); // $5e7c mirror
  } else if (type === 1) {
    world.spawn((o, wd) => playerFireball(o, wd, tier), { x, y });
  } else if (type === 2) {
    const handle = SECONDARY_STATIC_FRAMES[2][tier];
    for (let i = 0; i < Math.min(room, 4); i++)
      spawn({ handle, dx: 4, dy: i - 2, vx: 7 + i * 0.5, vy: 0, stopsOnHit: false }); // $5fae stream
  } else {
    const frames = SECONDARY_SPREAD_FRAMES[tier];
    const heading = world.lastPlayerHeading || 0;
    spawn({ frames, dx: 8, angle: heading - 3, speed: SHOT_SPEED });
    if (room > 1)
      spawn({ frames, dx: 8, angle: heading + 3, speed: SHOT_SPEED }); // $606a-$608a
  }
  return true;
}

// $5826/$5842: fan out according to the level, honouring the concurrent limit.
function fire(world, x, y, level) {
  const w = WEAPON[Math.min(level, WEAPON.length - 1)];
  let fired = false;
  if ((world.shotCount || 0) < w.limit) {
    for (const off of w.shots)
      world.spawn((o, wd) => playerShot(o, wd, off), { x, y });
    world.playSound(FIRE_SOUND, undefined, FIRE_SOUND_VOLUME);
    fired = true;
  }
  if (fireSecondary(world, x, y)) fired = true;
  return fired;
}

if (typeof module !== 'undefined')
  module.exports = { homingMissile, HOMING_LAUNCH, playerStub };

// $5cdc / $5d5c -- a dragon tail segment. It does not move under its own
// power: each frame it reads the head's recorded position from the trail ring
// at its own offset behind the head.
//
//   $58(a5) = $5d28                     install the segment handler
//   $36 <- $124(a6)  $66 <- $126(a6)    hp and hit-flash come from globals
//   $40 <- $128(a6)
//   loop: alive? ; d0 = player $92 ; d1 = own $92
//         $5ac8 -> trail slot ; move.l (a0)+,$e ; move.l (a0)+,$12
// Resource 2 holds the whole dragon:
//   idx 0-9   head poses (tilt up/down, and the shooting frames)
//   idx 10    the mid body segment -- ONE sprite, it does not rotate
//   idx 11-18 the tail section in 8 rotations
// The table at $5dee selects among the tail rotations and lives inside $5d5c,
// the tail-end routine -- it does NOT apply to the body segments.
const DRAGON = {
  head:  [0x0002, 0x0202, 0x0402, 0x0602, 0x0802,
          0x0a02, 0x0c02, 0x0e02, 0x1002, 0x1202],   // idx 0-9
  body:  0x1402,                                     // idx 10, fixed
  // $5dee, indexed by the SIGN of the movement delta ($5dbe-$5ddc):
  //   dx>0 -> base 8, dx=0 -> 0, dx<0 -> $10;  dy>0 -> +2, dy=0 -> +0, dy<0 -> +4
  tail: {                                            // idx 11-18, 8 rotations
    '1,0': 0x1602, '1,1': 0x1802, '0,1': 0x1a02, '-1,1': 0x1c02,
    '-1,0': 0x1e02, '-1,-1': 0x2002, '0,-1': 0x2202, '1,-1': 0x2402,
  },
};

// The tail picks its frame from which way it just moved, so it needs the
// previous position; a zero delta keeps the current frame ($5dbc beq).
function tailFrame(dx, dy) {
  const sx = Math.sign(Math.round(dx)), sy = Math.sign(Math.round(dy));
  if (!sx && !sy) return null;
  return DRAGON.tail[sx + ',' + sy] || null;
}

// $5630 gives segment N the depth $4e26 - N (counter 4..1) and the tail end
// $4e26, so the further down the body, the further back it draws.
function* tailSegment(o, world, offset, handle, rotates, depth) {
  o.depth = depth === undefined ? 0x4e26 : depth;   // $2a
  o.trailOffset = offset;                // $92 on this object
  o.hp = world.segmentHp || 8;           // $124(a6)
  o.hitFlash = 0;                        // $126(a6)
  o.speed = 0;                           // segments never integrate velocity
  if (handle) o.setHandle(handle);
  for (;;) {
    if (!o.alive() || world.playerDying) break;
    const t = world.trailAt(offset);     // $5ac8
    const dx = t.x - o.x, dy = t.y - o.y;
    o.x = t.x; o.y = t.y;
    o.vx = 0; o.vy = 0;
    if (rotates) {                       // only the tail end rotates
      const h = tailFrame(dx, dy);
      if (h !== null) o.setHandle(h);
    }
    yield;
  }
  if (world.playerDying && o.alive()) {             // $5d28 -> $877a/$8788
    for (let frame = 0; frame < (o.__deathDelay || 0); frame++) yield;
    o.depth = DEATH_DEPTH;
    o.playFrames(CAPSULE_OPENING);                  // $878e -> $51fa
    while (o.scriptOn) yield;
  }
  o.die();
}

// $5630: the dragon is FOUR body segments spaced 6 trail slots apart
// ($13c(a6) steps by -6), plus one tail end running $5d5c.
const DRAGON_SEGMENTS = 4;
const DRAGON_SPACING = 6;
const TAIL_DEATH_DELAYS = [47, 12, 41, 6, 3];       // $5d3e, indexed by $94

if (typeof module !== 'undefined') {
  module.exports.tailSegment = tailSegment;
  module.exports.WEAPON = WEAPON;
  module.exports.fire = fire;
  module.exports.playerShot = playerShot;
  module.exports.DRAGON = DRAGON;
  module.exports.tailFrame = tailFrame;
  module.exports.DRAGON_SEGMENTS = DRAGON_SEGMENTS;
  module.exports.DRAGON_SPACING = DRAGON_SPACING;
  module.exports.buildWaveHandlers = buildWaveHandlers;
  module.exports.waveEnemy = waveEnemy;
  module.exports.waveChild = waveChild;
  module.exports.groundGunner = groundGunner;
  module.exports.moundGunner = moundGunner;
  module.exports.scatterFlier = scatterFlier;
  module.exports.heavyFlier = heavyFlier;
  module.exports.swooper = swooper;
  module.exports.emplacement = emplacement;
  module.exports.heavyGround = heavyGround;
  module.exports.groundEmitter = groundEmitter;
  module.exports.groundStructure = groundStructure;
  module.exports.terrainUnit = terrainUnit;
  module.exports.stage5Structure = stage5Structure;
  module.exports.jitteredUnit = jitteredUnit;
  module.exports.childSpawner = childSpawner;
  module.exports.tiger = tiger;
  module.exports.bushPlacer = bushPlacer;
  module.exports.variantSeeder = variantSeeder;
  module.exports.retainedSpawner = retainedSpawner;
  module.exports.acceleratingUnit = acceleratingUnit;
  module.exports.hillWithChild = hillWithChild;
  module.exports.headingSpawner = headingSpawner;
  module.exports.heavyUnit = heavyUnit;
  module.exports.riser = riser;
  module.exports.multiSpawner = multiSpawner;
  module.exports.paramUnit = paramUnit;
  module.exports.groundUnit11 = groundUnit11;
  module.exports.clearSpawner = clearSpawner;
  module.exports.faller = faller;
  module.exports.CONTROL_HANDLERS = CONTROL_HANDLERS;
  module.exports.sectionMarker = sectionMarker;
  module.exports.installProjectiles = installProjectiles;
  module.exports.playerObject = playerObject;
  module.exports.setPiece = setPiece;
  module.exports.zigzagFlier = zigzagFlier;
  module.exports.weaveFlier = weaveFlier;
  module.exports.handleFollower = handleFollower;
  module.exports.boss1Segment = boss1Segment;
  module.exports.treeSpawner = treeSpawner;
  module.exports.mound = mound;
  module.exports.weaponCapsule = weaponCapsule;
  module.exports.deathBlast = deathBlast;
  module.exports.res9Rider = res9Rider;
  module.exports.res11Launcher = res11Launcher;
  module.exports.installDeathExplosion = installDeathExplosion;
  module.exports.res8Runner = res8Runner;
  module.exports.SET_PIECES = SET_PIECES;
  module.exports.enemyShot = enemyShot;
  module.exports.aimedShot = aimedShot;
  module.exports.homingMissile = homingMissile;
  module.exports.crashDiver = crashDiver;
  module.exports.stage1Boss = stage1Boss;
  module.exports.stage2Boss = stage2Boss;
  module.exports.stage3Boss = stage3Boss;
  module.exports.stage5Boss = stage5Boss;
  module.exports.stage4Boss = stage4Boss;
  module.exports.boss4Script = boss4Script;
  module.exports.bossShot = bossShot;
  module.exports.bossSegment = bossSegment;
}
