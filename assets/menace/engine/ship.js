// Menace - the player ship, from moveship at $70038.
//
// moveship is the ONE routine in vloop that appears in both branches, so it is
// the only thing running at 50 Hz. Everything else - collision, missiles,
// input handling, the path VM - runs at 25 Hz. Ticking this at 25 or the rest
// at 50 gives a game that looks right and plays wrong.
//
// Movement is accumulator based, not direct. Holding a direction moves the
// velocity one step per frame toward +/- maxSpeed; releasing it decays the
// velocity one step per frame toward zero. Position is simply pos += vel with
// no scaling ($70174).
//
// Bounds are enforced by disabling the input AND zeroing the velocity, not by
// clamping the position ($700ae/$700b0):
//   x in 0..$10a (266), y in 0..$96 (150)
//
// maxSpeed is $24(a5). It is runtime state, not a constant: $6ff7e increments
// it on every speedup pickup. Read off the running game at level 1 start it is
// 2, and the ship starts at (112, 84).

// Implements $70038 moveship, $70510 read input, $6fbb8 the mouse read from
// JOY0DAT into $64/$66(a5), $702d0 get.firekey, and
// $701ec/$708aa, which build and place the ship's four sprite control words.
export const SHIP_X_MAX = 0x10a, SHIP_Y_MAX = 0x96;
// $24(a5) starts at 2 and $6ff7e increments it per speedup, refused at 8
// ($6ff68), so six speedups is the whole range.
export const SHIP_START = { x: 112, y: 84, speed: 2 };
export const SHIP_MAX_SPEED = 8;

// $38(a5) selects the pitched sprite: $fdd0 up, 0 level, $230 down. Those are
// -560 / 0 / +560, the ship variant stride found in Phase 3, and $7018c adds
// the value straight to the sprite data pointer.
export const PITCH_UP = 0, PITCH_LEVEL = 1, PITCH_DOWN = 2;

export class Ship {
  constructor(opts = {}) {
    this.x = opts.x ?? SHIP_START.x;
    this.y = opts.y ?? SHIP_START.y;
    this.maxSpeed = opts.speed ?? SHIP_START.speed;
    this.xvel = 0;
    this.yvel = 0;
    this.pitch = PITCH_LEVEL;
    this.config = 0;
  }

  // One 50 Hz frame. `input` is {up, down, left, right}.
  step(input) {
    const max = this.maxSpeed, min = -max;
    let { up, down, left, right } = input;

    // $70084..$700c4 - out of bounds kills both the direction and the velocity
    if (this.y < 0) { up = false; this.yvel = 0; }
    if (this.y > SHIP_Y_MAX) { down = false; this.yvel = 0; }
    if (this.x < 0) { left = false; this.xvel = 0; }
    if (this.x > SHIP_X_MAX) { right = false; this.xvel = 0; }

    if (up) {
      this.pitch = PITCH_UP;
      if (this.yvel > min) this.yvel--;
    } else if (down) {
      this.pitch = PITCH_DOWN;
      if (this.yvel < max) this.yvel++;
    } else {
      this.pitch = PITCH_LEVEL;
      if (this.yvel) this.yvel += this.yvel < 0 ? 1 : -1;   // $70158 decay
    }

    if (right) {
      if (this.xvel < max) this.xvel++;
    } else if (left) {
      if (this.xvel > min) this.xvel--;
    } else if (this.xvel) {
      this.xvel += this.xvel < 0 ? 1 : -1;                  // $7013e decay
    }

    this.x += this.xvel;                                    // $70174
    this.y += this.yvel;
    return this;
  }
}
