// Touch controls: two thumbsticks over the view.
//
// Left stick moves, right stick looks. Both are "floating" -- the stick appears
// wherever the finger lands rather than at a fixed spot -- because a fixed pad
// on a phone means looking at the screen to find it, and the whole point is not
// having to.
//
// A TAP (a touch that neither travels far nor lasts long) does the action for
// its side: right taps fire, left taps use doors and switches. That is the
// entire button set. Running is always on, because there is no comfortable way
// to hold a modifier on a phone and the game plays better running.
//
// The left stick feeds the same direction bitmask the keyboard produces, so
// movement goes through `movingdirtable` exactly as it does on a keyboard --
// diagonals are a 45 degree rotation of one speed, not a vector sum. The right
// stick feeds `mousepos`, so looking goes through the same
// `(delta * sensitivity) >> 2` the mouse does.

const DEAD = 8;             // px of travel before a stick registers at all
const RANGE = 56;           // px from the origin for a full deflection
const TAP_MS = 250;         // longer than this and it is a hold, not a tap
const TAP_PX = 12;          // further than this and it is a drag, not a tap
const LOOK_GAIN = 1.6;      // px of finger travel -> units of mouse movement

export class Touch {
  constructor(canvas, input, hooks = {}) {
    this.canvas = canvas;
    this.input = input;
    this.hooks = hooks;
    this.sticks = new Map();          // pointerId -> stick state
    // Touch controls appear on a device that actually has a touchscreen. A
    // headless harness has neither matchMedia nor a canvas that reports a size,
    // so the check has to survive their absence rather than assume a browser.
    this.enabled = !!(globalThis.matchMedia?.('(pointer: coarse)')?.matches);
    this.dir = { x: 0, y: 0 };        // left stick deflection, -1..1
    if (!this.enabled) return;

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.down(e), opts);
    canvas.addEventListener('pointermove', (e) => this.move(e), opts);
    canvas.addEventListener('pointerup', (e) => this.up(e), opts);
    canvas.addEventListener('pointercancel', (e) => this.up(e), opts);
    // Stop the browser treating a drag as a scroll or a double-tap as zoom.
    canvas.style.touchAction = 'none';
  }

  /** Which half of the canvas a touch started in. */
  side(e) {
    const r = this.canvas.getBoundingClientRect();
    return (e.clientX - r.left) < r.width / 2 ? 'move' : 'look';
  }

  down(e) {
    if (!this.enabled || e.pointerType === 'mouse') return;
    e.preventDefault();
    const side = this.side(e);
    // One stick per side; a second finger on the same side is ignored.
    for (const s of this.sticks.values()) if (s.side === side) return;
    this.sticks.set(e.pointerId, {
      side, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      t0: performance.now(), moved: 0,
    });
    this.canvas.setPointerCapture?.(e.pointerId);
  }

  move(e) {
    const s = this.sticks.get(e.pointerId);
    if (!s) return;
    e.preventDefault();
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    s.moved = Math.max(s.moved, Math.hypot(e.clientX - s.x0, e.clientY - s.y0));
    s.x = e.clientX; s.y = e.clientY;

    if (s.side === 'look') {
      // Feed the mouse path: movement.asm reads `mousepos` and scales it by
      // MouseSensitivity, so the touch sensitivity slider is the mouse one.
      this.input.addMouse(dx * LOOK_GAIN, dy * LOOK_GAIN);
    }
  }

  up(e) {
    const s = this.sticks.get(e.pointerId);
    if (!s) return;
    e.preventDefault();
    this.sticks.delete(e.pointerId);
    const held = performance.now() - s.t0;
    if (s.moved < TAP_PX && held < TAP_MS) {
      // A tap, not a drag. Right side shoots, left side opens things.
      if (s.side === 'look') this.hooks.onFire?.();
      else this.hooks.onUse?.();
    }
    if (s.side === 'move') this.dir = { x: 0, y: 0 };
  }

  /**
   * Called once a frame. Returns the left stick as a direction bitmask in the
   * same 1=right 2=left 4=back 8=forward encoding `movingdirtable` uses, so the
   * movement code cannot tell a thumb from a keyboard.
   */
  direction() {
    let bits = 0;
    for (const s of this.sticks.values()) {
      if (s.side !== 'move') continue;
      const dx = s.x - s.x0, dy = s.y - s.y0;
      if (Math.hypot(dx, dy) < DEAD) continue;
      const nx = Math.max(-1, Math.min(1, dx / RANGE));
      const ny = Math.max(-1, Math.min(1, dy / RANGE));
      this.dir = { x: nx, y: ny };
      // A stick is analogue and the direction table is not, so quantise: a
      // component counts once it is past a third of full deflection, which
      // gives the eight compass directions with usable diagonals.
      if (ny < -0.33) bits |= 8;
      if (ny > 0.33) bits |= 4;
      if (nx > 0.33) bits |= 1;
      if (nx < -0.33) bits |= 2;
    }
    return bits;
  }

  /** Draw both sticks into the composite, in palette indices. */
  draw(fb, W, H) {
    if (!this.enabled) return;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const toX = (cx) => Math.round(((cx - r.left) / r.width) * W);
    const toY = (cy) => Math.round(((cy - r.top) / r.height) * H);
    for (const s of this.sticks.values()) {
      const ox = toX(s.x0), oy = toY(s.y0);
      ring(fb, W, H, ox, oy, Math.round((RANGE / r.width) * W), 21);
      disc(fb, W, H, toX(s.x), toY(s.y), 4, s.side === 'look' ? 61 : 195);
    }
  }
}

function ring(fb, W, H, cx, cy, rad, colour) {
  if (rad < 2) return;
  const put = (x, y) => {
    if (x >= 0 && y >= 0 && x < W && y < H) fb[y * W + x] = colour;
  };
  // Midpoint circle: no trig, and no partial pixels to worry about.
  let x = rad, y = 0, err = 1 - rad;
  while (x >= y) {
    for (const [a, b] of [[x, y], [y, x], [-x, y], [-y, x],
                          [-x, -y], [-y, -x], [x, -y], [y, -x]]) {
      put(cx + a, cy + b);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
}

function disc(fb, W, H, cx, cy, rad, colour) {
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y > rad * rad) continue;
      const px = cx + x, py = cy + y;
      if (px >= 0 && py >= 0 && px < W && py < H) fb[py * W + px] = colour;
    }
  }
}
