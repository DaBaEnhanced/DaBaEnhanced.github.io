// Keyboard and mouse handling, from Sorgenti/devices.asm and movement.asm.
//
// The original's defaults are Amiga raw key codes in devices.asm:ActiveKeyConfig:
//   ForwardKey  $4C cursor up      BackwardKey   $4D cursor down
//   RotateLeft  $4F cursor left    RotateRight   $4E cursor right
//   SideLeftKey $31 Z              SideRightKey  $32 X
//   FireKey     $64 LEFT ALT       AccelKey      $63 CTRL (run)
//   ForceSide   $60 LEFT SHIFT     SwitchKey     $40 SPACE
//   LookUp      $3D keypad 7       ResetLook     $2D keypad 4
//   LookDown    $1D keypad 1
// so Ctrl is *run*, not fire, space opens doors and presses switches, and Shift
// held converts the rotate keys into strafing (ForceSideKey). Alt is awkward in
// a browser, so Enter is accepted as a second fire key; WASD is accepted
// alongside the cursor keys, and Z/X still strafe.
//
// devices.asm also ships a MouseKeyConfig, selected by ActiveControl = 1. It
// rebinds RotateLeft/Right and ForceSide to $2C -- a code no key produces, so
// they are switched off -- and moves SideLeft/SideRight onto the cursor keys.
// With the mouse steering, the cursor keys strafe.

export class Input {
  constructor(target = window, isBound = null) {
    this.down = new Set();
    this.isBound = isBound;
    this.mouseDX = 0;              // devices.asm: mousepos, ie_X accumulated
    this.mouseDY = 0;              // not read by the original; see applyInput
    target.addEventListener('keydown', (e) => {
      this.down.add(e.code);
      if (HANDLED.has(e.code) || this.isBound?.(e.code)) e.preventDefault();
    });
    // CapsLock reports keydown when it goes on and, in some browsers, only
    // reports keyup when it goes off again -- so it must never be treated as a
    // held key. main.js reads it as an edge and flips a toggle.
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => { this.down.clear(); });
  }
  has(...codes) { return codes.some((c) => this.down.has(c)); }

  /** IECLASS_RAWMOUSE with IEQUALIFIERB_RELATIVEMOUSE: `move.w ie_X,mousepos`. */
  addMouse(dx, dy) { this.mouseDX += dx; this.mouseDY += dy; }

  /** movement.asm reads mousepos and clears it in the same breath. */
  takeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return [dx, dy];
  }
}

const HANDLED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyZ', 'KeyX',
  'PageUp', 'PageDown', 'Home', 'CapsLock',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'ShiftLeft', 'ShiftRight', 'Enter', 'Tab',
]);

// Used when no Config is supplied -- harnesses that drive applyInput directly.
// The real table lives in Config.ACTIONS and is rebindable (conf_page3).
const DEFAULT_KEYS = {
  forward: ['ArrowUp', 'KeyW'], backward: ['ArrowDown', 'KeyS'],
  rotateLeft: ['ArrowLeft'], rotateRight: ['ArrowRight'],
  sideLeft: ['KeyA', 'KeyZ'], sideRight: ['KeyD', 'KeyX'],
  fire: ['Space', 'Enter', 'AltLeft', 'AltRight'], accel: ['CapsLock'],
  forceSide: ['ShiftLeft', 'ShiftRight'],
  lookUp: ['PageUp', 'Numpad7'], resetLook: ['Home', 'Numpad4'],
  lookDown: ['PageDown', 'Numpad1'], switch: ['KeyE', 'KeyF'],
};

// Fallbacks used when no Config is supplied. These are TMapMain's engine
// defaults, not guesses: PlayerWalkSpeed 4<<4, PlayerRunSpeed 6<<4,
// PlayerRotWalkSpeed 8, PlayerRotRunSpeed 20, both accelerations 4.
export const SPEED = {
  walk: 4, run: 6,                 // world units per 50Hz tick
  rotWalk: 8, rotRun: 20,          // 1/2048 of a turn per tick
  accel: 4 / 16, rotAccel: 4,
  lookStep: 1,
};

const UNIT = (2 * Math.PI) / 2048;         // one heading unit, in radians
const QUARTER = 512, EIGHTH = 256;         // movingdirtable's offsets

// movingdirtable (movement.asm:1380), indexed by the direction bitmask
// 1=right 2=left 4=back 8=forward. Each entry is a heading offset and a sign;
// the player always moves at PlayerSpeed along heading+offset, so a diagonal is
// a 45-degree rotation rather than a vector sum.
//
// This table is also what settles which way strafing goes. Entry 1 (right) is
// offset +512 with sign +1, so strafe-right is heading + a quarter turn:
// (cos(h+90), sin(h+90)) = (-sin h, cos h). The port had that vector bound to
// the LEFT key, which is why strafing was mirrored.
const MOVING_DIR = {
  1: [QUARTER, 1], 2: [QUARTER, -1],
  4: [0, -1], 5: [-EIGHTH, -1], 6: [EIGHTH, -1],
  8: [0, 1], 9: [EIGHTH, 1], 10: [-EIGHTH, 1],
};

// updspeedtable (movement.asm:1403), rows = new direction, columns = old.
// +1 means clear PlayerSpeed, -1 means negate it, 0 means leave it alone --
// which is what lets a straight run become a diagonal without losing momentum.
const UPD_SPEED = {
  1: { 4: 1, 5: -1, 6: 1, 8: 1, 10: 1 },
  2: { 4: 1, 5: 1, 8: 1, 9: 1, 10: -1 },
  4: { 1: 1, 2: 1, 9: 1, 10: 1 },
  5: { 1: -1, 2: 1, 8: 1 },
  6: { 1: 1, 8: 1 },
  8: { 1: 1, 2: 1, 5: 1, 6: 1 },
  9: { 2: 1, 4: 1 },
  10: { 1: 1, 2: -1, 4: 1 },
};

/** Accelerate `cur` toward `max` by `accel`, clamping instead of overshooting. */
function approach(cur, max, accel) {
  if (cur === max) return max;
  if (cur < max) return Math.min(max, cur + accel);
  return Math.max(max, cur - accel);
}

/**
 * `touchDir` is an optional direction bitmask from the on-screen stick, in the
 * same 1=right 2=left 4=back 8=forward encoding the keys produce. It is ORed
 * with the keyboard, so both work at once and neither is a special case below.
 */
export function applyInput(input, cam, dt, config = null, touchDir = 0) {
  const ticks = dt * 50;                       // original ran at 50Hz
  const mouse = config?.mouseOn ?? false;
  // AccelKey is held in the original. Here it is a TOGGLE (CapsLock by default),
  // because holding a modifier for the whole game is unpleasant and CapsLock
  // does not repeat sensibly. `cam.running` is flipped by main.js on a fresh
  // press; ForceSideKey (shift) is still a hold, and touch sets it permanently.
  const running = !!cam.running;
  const speed = running ? (config?.playerRunSpeed ?? SPEED.run)
    : (config?.playerWalkSpeed ?? SPEED.walk);
  const rotMax = running ? (config?.playerRotRunSpeed ?? SPEED.rotRun)
    : (config?.playerRotWalkSpeed ?? SPEED.rotWalk);
  const accel = (config?.playerAccel ?? SPEED.accel) * ticks;
  const rotAccelBase = config?.playerRotAccel ?? SPEED.rotAccel;

  // Every action goes through the conf_page3 binding table rather than a
  // literal key code, so rebinding actually reaches the movement code.
  const K = config?.keys ?? DEFAULT_KEYS;
  const acceptsMovementInput = !cam.falling;
  const down = (action) => acceptsMovementInput && input.has(...(K[action] ?? []));

  // ForceSideKey: holding shift turns the rotate keys into strafe keys.
  // In mouse mode nothing special is needed here any more -- MouseKeyConfig
  // binds ForceSide and both rotate keys to $2C, a code no key produces, and
  // puts the cursor keys on SideLeft/SideRight. The table says all of that, so
  // reading the table is enough.
  const forceSide = down('forceSide');
  const turnLeft = down('rotateLeft');
  const turnRight = down('rotateRight');
  const sideways = forceSide;

  let dir = 0;
  if (down('forward')) dir |= 8;
  if (down('backward')) dir |= 4;
  if (down('sideRight') || (sideways && turnRight)) dir |= 1;
  if (down('sideLeft') || (sideways && turnLeft)) dir |= 2;
  if (acceptsMovementInput) dir |= touchDir & 15;
  if ((dir & 3) === 3) dir &= ~3;              // both strafe keys cancel
  if ((dir & 12) === 12) dir &= ~12;

  // ---- rotation ----------------------------------------------------------
  const [mdx, mdy] = input.takeMouse();
  if (acceptsMovementInput && mouse && mdx !== 0) {
    // DMnomouse is skipped entirely when the mouse is steering, so there is no
    // rotational inertia in mouse mode -- the view goes exactly where the
    // mouse puts it. `muls.w MouseSensitivity,d2 / lsr.l #2` is a divide by
    // four after scaling, so sensitivity 4 is 1:1 and the default 5 is 1.25:1.
    const sens = config?.mouseSensitivity ?? 5;
    cam.heading += Math.trunc((mdx * sens) / 4) * UNIT;
  } else {
    let target = 0;
    if (!sideways) {
      if (turnRight) target = rotMax;
      if (turnLeft) target = -rotMax;
    }
    const cur = cam.rotSpeed ?? 0;
    // DMrotdra: nudge the acceleration up by one when stopping or reversing,
    // "in modo da diminuire l'inerzia".
    const nudge = (target === 0 || target * cur < 0) ? 1 : 0;
    cam.rotSpeed = approach(cur, target, (rotAccelBase + nudge) * ticks);
    cam.heading += cam.rotSpeed * ticks * UNIT;
  }

  // ---- walking -----------------------------------------------------------
  const entry = MOVING_DIR[dir];
  if (entry) {
    const old = cam.moveDir ?? 0;
    if (old !== dir) {
      const rule = UPD_SPEED[dir]?.[old] ?? 0;
      if (rule > 0) cam.speed = 0;
      else if (rule < 0) cam.speed = -(cam.speed ?? 0);
    }
    cam.moveDir = dir;
    cam.walkMax = entry[1] * speed;
  } else if (acceptsMovementInput) {
    cam.walkMax = 0;                           // nomoving: coast to a stop
  }
  cam.speed = approach(cam.speed ?? 0, cam.walkMax ?? 0, accel);

  const objectTurn = cam.objectTurn ?? 0;
  const moveAngle = cam.heading
    + ((MOVING_DIR[cam.moveDir ?? 8]?.[0] ?? 0) + objectTurn) * UNIT;
  cam.moveVectorX = Math.cos(moveAngle);
  cam.moveVectorZ = Math.sin(moveAngle);
  if (cam.speed !== 0) {
    const a = moveAngle;
    // movement.asm:378 loads X from costable and Z from sintable.
    cam.x += Math.cos(a) * cam.speed * ticks;
    cam.z += Math.sin(a) * cam.speed * ticks;
  }
  // AMovingDir decays toward zero after contributing to this movement pass.
  if (objectTurn) {
    const decay = 64 * ticks;
    cam.objectTurn = objectTurn > 0
      ? Math.max(0, objectTurn - decay) : Math.min(0, objectTurn + decay);
  }

  // ---- looking -----------------------------------------------------------
  // An addition, not a reproduction: devices.asm stores only ie_X in mousepos,
  // so the original's mouse mode steers and nothing more, and looking up and
  // down stays on keypad 7/4/1. Driving CLookHeightNum from ie_Y uses the same
  // machinery and the same +/-72 clamp, and is what a mouse is expected to do
  // now; set MOUSE LOOK to OFF in the control page for the original's
  // horizontal-only behaviour.
  if (mouse && mdy !== 0 && (config?.mouseLook ?? true)) {
    const sens = config?.mouseSensitivity ?? 5;
    cam.lookHeight -= Math.trunc((mdy * sens) / 4);
  }
  // CLookHeightNum clamps to +/-72 (movement.asm:DMraiselook / DMlowerlook).
  if (down('lookUp')) cam.lookHeight += SPEED.lookStep * ticks * 2;
  if (down('lookDown')) cam.lookHeight -= SPEED.lookStep * ticks * 2;
  if (down('resetLook')) cam.lookHeight = 0;
  cam.lookHeight = Math.max(-72, Math.min(72, cam.lookHeight));
}
