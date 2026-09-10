import { SOURCE_SINE } from '../assets/sine-table.js';

export const PLAYER_TICKS_PER_SECOND = 50;
export const STANDING_HEIGHT = 48;
export const CROUCHED_HEIGHT = 32;
export const STANDING_STEP = 40;
export const CROUCHED_STEP = 10;

export const SOURCE_ANGLE_UNITS = 8192;
const FIXED_ONE = 65536;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const signedWord = value => (value & 0x8000) ? (value & 0xffff) - 0x10000 : value & 0xffff;

const signedHighProduct = (first, second) =>
  signedWord(Math.floor(Math.imul(signedWord(first), signedWord(second)) / 65536));

// plr1control.s:PLR1_keyboard_control `.nobug1`/`.nobug2`. The released
// routine negates each signed 16.16 speed, arithmetic-shifts by three, and
// adds one only on its positive branch before adding the result back. This is
// observably different from multiplying negative speeds by 7/8.
export function sourceDampVelocity(speedFixed) {
  const speed = speedFixed | 0;
  let correction = (-speed) | 0;
  // NEG.L $80000000 wraps to $80000000 and therefore takes BLE `.nobug`,
  // just like every other non-positive result. Do not special-case overflow.
  if (correction > 0) correction = ((correction >> 3) + 1) | 0;
  else correction >>= 3;
  return (speed + correction) | 0;
}

// plr1control.s:PLR1_keyboard_control forms 3*PLR1s_angspd with word
// additions, shifts it arithmetically by two, then adds one only when the
// shifted word is negative. This is truncation toward zero for ordinary
// values, but the intermediate word wrapping is part of the released path.
export function sourceDampAngularVelocity(speed) {
  let result = signedWord(speed);
  const doubled = signedWord(result + result);
  result = signedWord(result + doubled) >> 2;
  if (result < 0) result = signedWord(result + 1);
  return result;
}

// plr1control.s:PLR1_keyboard_control tests individual KeyMap bytes in source
// order. Keeping the buttons separate matters when opposites are held: back
// overwrites forward, and right strafe transforms the result left by a prior
// left-strafe test. force_sidestep_key replaces (rather than combines with)
// the dedicated strafe keys by the two turn-key bytes.
export function sourceKeyboardControlWords(input, acceleration) {
  const value = name => Object.hasOwn(input, name) ? Boolean(input[name]) : null;
  let turnLeft = value('turnLeft') ?? (Number(input.turning) < 0);
  let turnRight = value('turnRight') ?? (Number(input.turning) > 0);
  let strafeLeft = value('strafeLeft') ?? (Number(input.sideways) < 0);
  let strafeRight = value('strafeRight') ?? (Number(input.sideways) > 0);
  if (input.forceSidestep) {
    strafeLeft = turnLeft;
    strafeRight = turnRight;
    turnLeft = false;
    turnRight = false;
  }

  let turnDelta = 0;
  if (turnLeft) turnDelta = signedWord(turnDelta - 10);
  if (turnRight) turnDelta = signedWord(turnDelta + 10);

  const step = signedWord(acceleration);
  let forwardWord = 0;
  const forwardPressed = value('forwardPressed') ?? (Number(input.forward) > 0);
  const backwardPressed = value('backwardPressed') ?? (Number(input.forward) < 0);
  if (forwardPressed) forwardWord = signedWord(-step);
  if (backwardPressed) forwardWord = step;

  let sidewaysWord = 0;
  if (strafeLeft) {
    sidewaysWord = signedWord(sidewaysWord + step);
    sidewaysWord = signedWord(sidewaysWord + step) >> 1;
  }
  if (strafeRight) {
    sidewaysWord = signedWord(sidewaysWord + step);
    sidewaysWord = signedWord(sidewaysWord + step) >> 1;
    sidewaysWord = signedWord(-sidewaysWord);
  }
  return { turnDelta, forwardWord, sidewaysWord };
}

// newtwo.s:PLR1_Control derives all viewpoint wobble from p1_bobble. Vertical
// d1 is also subtracted from thingheight so the player's feet do not move.
// xwobble is added to camera-space X, while the two multiply-high words are
// the separately rounded floor-renderer origin corrections.
export function sourceBobbleState(bobbleAngle, viewAngle, crouched = false) {
  const bobbleSin = signedWord(sourceAngleTrig(bobbleAngle).sinWord);
  let vertical = bobbleSin > 0 ? signedWord(-bobbleSin) : bobbleSin;
  vertical = signedWord(vertical + 16384) >> 4;
  if (!crouched) vertical = signedWord(vertical + vertical);
  const acrossWord = bobbleSin >> 6;
  const { sinWord, cosWord } = sourceAngleTrig(viewAngle);
  const floorZOffset = signedHighProduct(sinWord, acrossWord) >> 7;
  const floorXOffset = signedWord(-(signedHighProduct(cosWord, acrossWord) >> 7));
  return {
    verticalOffsetFixed: vertical,
    verticalOffset: vertical / 256,
    acrossOffset: acrossWord / 128,
    floorXOffset,
    floorZOffset,
  };
}

export function sourceAngleTrig(angleUnits) {
  const offset = Math.trunc(angleUnits) & 8190;
  return {
    sinWord: SOURCE_SINE[offset >> 1],
    cosWord: SOURCE_SINE[(offset + 2048) >> 1],
  };
}

export function radiansToSourceAngle(radians) {
  return Math.round(radians / (Math.PI * 2) * SOURCE_ANGLE_UNITS / 2) * 2 & 8190;
}

export function sourceAngleRadians(angleUnits) {
  return (Math.trunc(angleUnits) & 8190) / SOURCE_ANGLE_UNITS * Math.PI * 2;
}

// plr1control.s keeps movement in 16.16 fixed point and updates it from the
// 50 Hz interrupt. Keeping the state here also preserves the characteristic
// acceleration and coast instead of making movement depend on browser FPS.
export class SourcePlayerMotion {
  constructor() { this.reset(); }

  reset() {
    this.accumulator = 0;
    // Browser presentation may inspect how many exact 50 Hz source steps were
    // consumed, but never feeds this metadata back into movement arithmetic.
    this.lastTicks = 0;
    this.angularVelocity = 0;
    this.xVelocityFixed = 0;
    this.zVelocityFixed = 0;
    this.height = STANDING_HEIGHT;
    this.targetHeight = STANDING_HEIGHT;
    this.crouched = false;
    this.yVelocity = 0;
    this.bobbleAngle = 0;
  }

  syncCameraBobble(camera) {
    const state = sourceBobbleState(
      this.bobbleAngle, camera.angleUnits || 0, this.crouched);
    camera.bobbleAngle = this.bobbleAngle;
    camera.bobbleAcross = state.acrossOffset;
    camera.bobbleFloorX = state.floorXOffset;
    camera.bobbleFloorZ = state.floorZOffset;
    camera.viewY = camera.y + state.verticalOffset;
    camera.collisionY = camera.viewY;
    camera.collisionHeight = this.height - state.verticalOffset;
    return state;
  }

  toggleCrouch() {
    this.crouched = !this.crouched;
    this.targetHeight = this.crouched ? CROUCHED_HEIGHT : STANDING_HEIGHT;
    return this.crouched;
  }

  forceCrouch(clearance) {
    if (clearance <= STANDING_HEIGHT + 12) {
      this.crouched = true;
      this.targetHeight = CROUCHED_HEIGHT;
    }
  }

  advance(seconds, camera, input, clearance, move) {
    this.accumulator += Math.max(0, seconds) * PLAYER_TICKS_PER_SECOND;
    const ticks = Math.min(15, Math.floor(this.accumulator));
    this.lastTicks = ticks;
    this.accumulator -= ticks;
    let changed = false;
    for (let tick = 0; tick < ticks; tick++) {
      this.forceCrouch(typeof clearance === 'function' ? clearance() : clearance);
      changed = this.advanceHeight(
        camera, input.floorHeight(),
        typeof input.waterHeight === 'function' ? input.waterHeight() : Number.POSITIVE_INFINITY,
      ) || changed;
      changed = this.advanceMovement(camera, input, move) || changed;
    }
    return changed;
  }

  advanceHeight(camera, floorHeight, waterHeight = Number.POSITIVE_INFINITY) {
    if (this.height !== this.targetHeight) {
      const direction = Math.sign(this.targetHeight - this.height);
      this.height += direction * Math.min(4, Math.abs(this.targetHeight - this.height));
    }
    camera.height = this.height;
    camera.crouched = this.crouched;
    const target = floorHeight - this.height;
    let delta = target - camera.y;
    if (delta <= 0) {
      this.yVelocity -= 2;
      if (this.yVelocity >= 0) this.yVelocity = 0;
      camera.y += this.yVelocity;
      delta -= this.yVelocity;
      if (delta >= 0) {
        this.yVelocity = 0;
        camera.y += delta;
      }
    } else {
      camera.y += this.yVelocity;
      // fall.s:PLR1_fall `.aboveground` adds 256 to the 24.8 velocity: one
      // world unit per source tick. At or below ToZoneWater it caps only the
      // velocity (after the position add) to 2*256.
      this.yVelocity += 1;
      if (camera.y >= waterHeight && this.yVelocity >= 2) this.yVelocity = 2;
    }
    this.syncCameraBobble(camera);
    return this.height !== this.targetHeight || camera.y !== target || this.yVelocity !== 0;
  }

  advanceMovement(camera, input, move) {
    // plr1control.s checks run_key before PLR1_Ducked. Ducking halves d2 but
    // does not cancel the running turn cap or replace the original d2=3.
    const running = Boolean(input.running);
    const maximumTurn = running ? 60 : 35;
    let acceleration = running ? 3 : 2;
    if (this.crouched) acceleration >>= 1;

    const controls = sourceKeyboardControlWords(input, acceleration);
    this.angularVelocity = signedWord(
      sourceDampAngularVelocity(this.angularVelocity) + controls.turnDelta);
    this.angularVelocity = clamp(this.angularVelocity, -maximumTurn, maximumTurn);
    const oldAngle = Number.isInteger(camera.angleUnits)
      ? camera.angleUnits : radiansToSourceAngle(camera.angle || 0);
    camera.angleUnits = (oldAngle + this.angularVelocity * 2) & 8190;
    camera.angle = sourceAngleRadians(camera.angleUnits);

    const clumpStep = signedWord(-controls.forwardWord);
    this.bobbleAngle = (this.bobbleAngle - clumpStep * 64) & 8190;
    this.syncCameraBobble(camera);
    this.xVelocityFixed = sourceDampVelocity(this.xVelocityFixed);
    this.zVelocityFixed = sourceDampVelocity(this.zVelocityFixed);
    const { sinWord, cosWord } = sourceAngleTrig(camera.angleUnits);
    this.xVelocityFixed = (this.xVelocityFixed -
      Math.imul(signedWord(sinWord), controls.forwardWord) -
      Math.imul(signedWord(cosWord), controls.sidewaysWord)) | 0;
    this.zVelocityFixed = (this.zVelocityFixed -
      Math.imul(signedWord(cosWord), controls.forwardWord) +
      Math.imul(signedWord(sinWord), controls.sidewaysWord)) | 0;
    const dx = this.xVelocityFixed / FIXED_ONE;
    const dz = this.zVelocityFixed / FIXED_ONE;
    camera.xVelocity = dx;
    camera.zVelocity = dz;
    if (Math.abs(dx) < 1 / FIXED_ONE && Math.abs(dz) < 1 / FIXED_ONE) {
      camera.sourceXDifference = 0;
      camera.sourceZDifference = 0;
      return false;
    }
    const oldX = camera.x;
    const oldZ = camera.z;
    // The fourth value is the exact d3 used by PLR1_clumptime: keyboard
    // direction times walk/run/duck acceleration, independent of coasting and
    // of whether collision later shortens the actual displacement.
    move(dx, dz, -controls.forwardWord, clumpStep);
    // newtwo.s derives XDIFF1/ZDIFF1 from the actual post-collision player
    // word position, shifts by four, and divides by TempFrames. This method
    // advances one source tick at a time, so TempFrames is one here.
    camera.sourceXDifference = signedWord(
      signedWord(Math.floor(camera.x) - Math.floor(oldX)) << 4);
    camera.sourceZDifference = signedWord(
      signedWord(Math.floor(camera.z) - Math.floor(oldZ)) << 4);
    return true;
  }
}
