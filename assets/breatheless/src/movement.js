// Player movement and wall collision, from Sorgenti/movement.asm:DoMovement.
//
// The collision model is not a circle test.  The player's fractional position
// inside its 64-unit block is compared against PLAYER_WIDTH on each axis to
// build a 4-bit "which edges am I near" mask; that mask selects one of the
// CollTestTable routines, which test the adjacent blocks and return a mask of
// directions that are blocked; SetCoordTable then snaps the coordinate back to
// PLAYER_WIDTH from the offending edge.  Corners test the diagonal block too,
// and pick which axis to stop based on which side of the diagonal we are on.

import { MAP_SIZE, BLOCK_SIZE } from './level.js';

export const PLAYER_WIDTH = 16;         // TMap.i
export const PLAYER_HEIGHT = 56;
export const PLAYER_EYES_HEIGHT = 54;
export const PLAYER_MAX_RISE = 24;
const HEADROOM = PLAYER_HEIGHT + 8;     // TESTBLOCK compares against this

const DIR_XPOS = 1, DIR_ZPOS = 2, DIR_XNEG = 4, DIR_ZNEG = 8;

// movement.asm's gait tables. PlayerSpeed has four fractional bits in the
// original, while the port stores world units/tick, so speed is multiplied by
// 16 before indexing these tables.
const OSC_SPEED = [
  0,0,1,2,3,3,4,5,6,6,7,8,9,9,10,11,
  12,12,13,14,15,15,16,17,18,18,19,20,21,21,22,23,
  24,24,25,26,27,27,28,29,30,30,31,32,33,33,34,35,
  36,36,36,36,37,37,37,37,38,38,38,38,39,39,39,39,
  40,40,40,40,41,41,41,41,41,42,42,42,42,42,43,43,
  43,43,43,44,44,44,44,44,44,45,45,45,45,45,45,45,
  46,46,46,46,46,46,46,46,47,47,47,47,47,47,47,47,
  48,48,
];
const OSC_WAVE = [
  0,0,1,1,2,2,3,3,4,4,5,5,6,6,6,7,
  7,7,7,6,6,6,5,5,4,4,3,3,2,2,1,1,
  0,0,-1,-1,-2,-2,-3,-3,-4,-4,-5,-5,-6,-6,-6,-7,
  -7,-7,-7,-6,-6,-6,-5,-5,-4,-4,-3,-3,-2,-2,-1,-1,
];
const OSC_AMP = [
  -1,-1,-1,-1,0,0,0,0,0,0,0,0,0,1,1,1,
  -2,-2,-2,-1,-1,0,0,0,0,0,0,0,1,1,2,2,
  -2,-2,-2,-1,-1,0,0,0,0,0,0,0,1,1,2,2,
  -3,-3,-2,-2,-2,-1,-1,0,0,0,1,1,2,2,2,3,
  -3,-3,-2,-2,-2,-1,-1,0,0,0,1,1,2,2,2,3,
  -4,-4,-3,-3,-2,-1,-1,0,0,0,1,1,2,3,3,4,
  -4,-4,-3,-3,-2,-1,-1,0,0,0,1,1,2,3,3,4,
  -5,-5,-4,-3,-3,-2,-1,-1,0,1,1,2,3,3,4,5,
  -5,-5,-4,-3,-3,-2,-1,-1,0,1,1,2,3,3,4,5,
  -6,-5,-4,-4,-3,-2,-2,-1,0,1,2,2,3,4,4,5,
  -6,-5,-4,-4,-3,-2,-2,-1,0,1,2,2,3,4,4,5,
  -7,-6,-5,-4,-4,-3,-2,-1,0,1,2,3,4,4,5,6,
  -7,-6,-5,-4,-4,-3,-2,-1,0,1,2,3,4,4,5,6,
  -8,-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,
  -8,-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,
  -8,-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,
];

/** Update PlayerYOsc and emit GlobalSound5 at the source's gait phase. */
export function updateWalkOscillation(player, ticks, onStep = null) {
  if (player.falling) {
    player.yOsc = 0;
    return 0;
  }
  if (!player.speed) {
    player.oscPhase = 0;
    player.oscTickAcc = 0;
    player.yOsc = 0;
    return 0;
  }

  player.oscTickAcc = (player.oscTickAcc ?? 0) + Math.max(0, ticks);
  let whole = Math.floor(player.oscTickAcc);
  player.oscTickAcc -= whole;
  let steps = 0;
  while (whole-- > 0) {
    const fixed = Math.round(player.speed * 16);
    const mag = Math.min(Math.abs(fixed), OSC_SPEED.length - 1);
    const phaseStep = OSC_SPEED[mag] * Math.sign(fixed);
    player.oscPhase = ((player.oscPhase ?? 0) + phaseStep) & 0x3ff;
    const phase = player.oscPhase >> 4;

    const atStep = fixed < 0 ? phase <= 46 : phase >= 50;
    if (atStep) {
      if (!player.stepLatched) {
        player.stepLatched = true;
        steps++;
        onStep?.();
      }
    } else {
      player.stepLatched = false;
    }

    const wave = OSC_WAVE[phase];
    const band = Math.min(15, (mag & ~7) >> 3);
    player.yOsc = OSC_AMP[band * 16 + wave + 8];
  }
  return steps;
}

/** InitPlayerPos2: atomically move the player and rebuild all position-derived
 * state. Teleport uses map-cell coordinates but callers pass world X/Z here. */
export function relocatePlayer(level, player, x, z) {
  player.x = x; player.z = z;
  let block = level.blockAt(Math.floor(x / BLOCK_SIZE), Math.floor(z / BLOCK_SIZE));
  if (block < 0) block = -block;
  player.block = block;
  player.floorH = level.B.floorH[block];
  player.y = player.floorH + PLAYER_EYES_HEIGHT;
  player.targetY = player.y;
  player.falling = false;
  player.fallHeight = 0;
  player.verticalSpeed = 0;
  return player;
}

/** TESTBLOCK: can the player move into cell (nx,nz) from a block with these heights? */
function testBlock(level, nx, nz, curFloor, curCeil) {
  if (nx < 0 || nz < 0 || nx >= MAP_SIZE || nz >= MAP_SIZE) return false;
  const v = level.map[nz * MAP_SIZE + nx];
  if (v < 0) return false;                          // solid wall
  const B = level.B;
  const rise = B.floorH[v] - curFloor;
  if (rise >= 0) {
    if (rise > PLAYER_MAX_RISE) return false;       // step too tall to climb
    const lowCeil = Math.min(curCeil, B.ceilH[v]);
    return lowCeil - B.floorH[v] > HEADROOM;        // do we fit?
  }
  return B.ceilH[v] - curFloor > HEADROOM;          // stepping down
}

/**
 * Resolve a proposed position against walls.
 * Returns the corrected {x, z}. `cur` is the block the player is standing in.
 */
export function collide(level, x, z, curBlock) {
  const B = level.B;
  const curFloor = B.floorH[curBlock], curCeil = B.ceilH[curBlock];
  const cx = Math.floor(x / BLOCK_SIZE), cz = Math.floor(z / BLOCK_SIZE);
  const fx = x - cx * BLOCK_SIZE, fz = z - cz * BLOCK_SIZE;

  let near = 0;
  if (fx < PLAYER_WIDTH) near |= DIR_XNEG;
  else if (fx >= BLOCK_SIZE - PLAYER_WIDTH) near |= DIR_XPOS;
  if (fz < PLAYER_WIDTH) near |= DIR_ZNEG;
  else if (fz >= BLOCK_SIZE - PLAYER_WIDTH) near |= DIR_ZPOS;
  if (near === 0) return { x, z };

  const free = (dx, dz) => testBlock(level, cx + dx, cz + dz, curFloor, curCeil);
  let blocked = 0;
  if (near & DIR_XPOS) { if (!free(1, 0)) blocked |= DIR_XPOS; }
  if (near & DIR_XNEG) { if (!free(-1, 0)) blocked |= DIR_XNEG; }
  if (near & DIR_ZPOS) { if (!free(0, 1)) blocked |= DIR_ZPOS; }
  if (near & DIR_ZNEG) { if (!free(0, -1)) blocked |= DIR_ZNEG; }

  // Corner: only if neither axis blocked do we consult the diagonal, and then
  // we stop the axis we are furthest into (CTT3/6/9/12).
  if (blocked === 0 && (near & (DIR_XPOS | DIR_XNEG)) && (near & (DIR_ZPOS | DIR_ZNEG))) {
    const dx = (near & DIR_XPOS) ? 1 : -1;
    const dz = (near & DIR_ZPOS) ? 1 : -1;
    if (!free(dx, dz)) {
      if (near === (DIR_XPOS | DIR_ZPOS)) {          // CTT3
        blocked |= fx <= fz ? DIR_XPOS : DIR_ZPOS;
      } else if (near === (DIR_XNEG | DIR_ZPOS)) {   // CTT6
        blocked |= fx >= 63 - fz ? DIR_XNEG : DIR_ZPOS;
      } else if (near === (DIR_XPOS | DIR_ZNEG)) {   // CTT9
        blocked |= 63 - fx >= fz ? DIR_XPOS : DIR_ZNEG;
      } else {                                       // CTT12
        blocked |= fx >= fz ? DIR_XNEG : DIR_ZNEG;
      }
    }
  }

  // SetCoordTable: snap back to PLAYER_WIDTH from the blocking edge
  let ox = x, oz = z;
  if (blocked & DIR_XPOS) ox = cx * BLOCK_SIZE + (BLOCK_SIZE - PLAYER_WIDTH);
  if (blocked & DIR_XNEG) ox = cx * BLOCK_SIZE + PLAYER_WIDTH;
  if (blocked & DIR_ZPOS) oz = cz * BLOCK_SIZE + (BLOCK_SIZE - PLAYER_WIDTH);
  if (blocked & DIR_ZNEG) oz = cz * BLOCK_SIZE + PLAYER_WIDTH;
  return { x: ox, z: oz };
}

/**
 * One movement tick.  `player` carries x/z/heading/y plus falling state.
 * `ticks` is elapsed 50Hz ticks (the original's unit throughout).
 */
export function movePlayer(level, player, wishX, wishZ, ticks, fx) {
  let block = level.blockAt(Math.floor(player.x / BLOCK_SIZE),
                           Math.floor(player.z / BLOCK_SIZE));
  if (block < 0) block = -block;

  const fixed = collide(level, player.x + wishX, player.z + wishZ, block);
  player.x = fixed.x; player.z = fixed.z;

  let nb = level.blockAt(Math.floor(player.x / BLOCK_SIZE),
                         Math.floor(player.z / BLOCK_SIZE));
  if (nb < 0) nb = -nb;
  player.block = nb;
  // PlayerMoved follows the BLOCK number, not the map-cell coordinate. Many
  // adjacent cells deliberately share one block record.
  const movedBlock = nb !== block;
  const triggerInitial = !!player.pendingInitialEffect;
  player.pendingInitialEffect = false;

  // falling: a drop of PLAYER_MAX_RISE or more starts a fall
  const drop = level.B.floorH[block] - level.B.floorH[nb];
  if (!player.falling && drop >= PLAYER_MAX_RISE) {
    player.falling = true; player.fallHeight = drop;
  }

  const targetY = level.B.floorH[nb] + PLAYER_EYES_HEIGHT;
  player.targetY = targetY;
  // PlayerSpeedY accelerates by 0.5 toward +/-10 and CPlayerY approaches
  // NewPlayerY for stairs, lifts and falls alike.
  const deltaY = targetY - player.y;
  const maxSpeedY = deltaY === 0 ? 0 : (deltaY > 0 ? 10 : -10);
  const accelY = 0.5 * ticks;
  const vy = player.verticalSpeed ?? 0;
  player.verticalSpeed = vy < maxSpeedY
    ? Math.min(maxSpeedY, vy + accelY) : Math.max(maxSpeedY, vy - accelY);
  if (deltaY !== 0) {
    const nextY = player.y + player.verticalSpeed * ticks;
    const arrived = deltaY > 0 ? nextY >= targetY : nextY <= targetY;
    if (arrived) {
      player.y = targetY;
      player.verticalSpeed = 0;
      if (player.falling) {
        player.falling = false;
        // over 256 units of drop costs 4 health per 128 units
        if (player.fallHeight > 256) player.damage?.((player.fallHeight >> 7) << 2);
      }
    } else {
      player.y = nextY;
    }
  }

  // hurt blocks: attribute bits 0-1 encode 0/2/5/10 health every 50 ticks
  const type = level.B.attrs[nb] & 3;
  if (type && !player.falling) {
    // The source uses zero as the uninitialised state: first contact arms a
    // 50-tick timer without applying damage. Only an already-armed timer is
    // decremented and allowed to hurt the player.
    if ((player.hurtTimer ?? 0) <= 0) {
      player.hurtTimer = 50;
    } else {
      player.hurtTimer -= ticks;
      if (player.hurtTimer <= 0) {
        player.hurtTimer = 50;
        player.damage?.([0, 2, 5, 10][type]);
      }
    }
  } else {
    player.hurtTimer = 0;
  }

  // entering a block with an effect list fires it, unless it is switch-operated
  if ((triggerInitial || movedBlock) && !player.falling && fx) {
    const list = level.B.effect[nb];
    if (list && (level.B.attrs[nb] & 0xf0) === 0) fx.trigger(list);
  }
  return player;
}
