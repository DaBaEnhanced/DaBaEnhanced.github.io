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

/**
 * Whether a pointerdown should ask for pointer lock.
 *
 * Lives here, next to the thing it protects, because the rule is about touch:
 * **a touch pointer must never take pointer lock.** Under lock the browser
 * freezes `clientX`/`clientY` and updates only `movementX`/`movementY` -- which
 * is exactly what a mouse wants and exactly fatal for the thumbsticks, which
 * read `clientX`/`clientY`. Asking for lock on the first tap killed both sticks
 * after the single `pointermove` that landed before the lock engaged: one
 * rotation of the view and then nothing, while tap-to-fire kept working,
 * because a tap never needs the coordinates to change.
 *
 * It is a free function so a harness can assert the rule directly. Inline in
 * main.js's listener it was unreachable from any test, which is why a phone
 * found it and 31 harnesses did not.
 */
export function shouldGrabPointer({ pointerType, mouseOn, playing, locked }) {
  if (pointerType === 'touch' || pointerType === 'pen') return false;
  return !!mouseOn && !!playing && !locked;
}

const DEAD = 8;             // px of travel before a stick registers at all
const RANGE = 56;           // px from the origin for a full deflection
const TAP_MS = 250;         // longer than this and it is a hold, not a tap
const TAP_PX = 12;          // further than this and it is a drag, not a tap

// Looking is a RATE, not a displacement.
//
// It used to feed finger travel straight in as mouse movement, which made the
// screen a trackpad: one swipe turned you as far as the swipe was long, and to
// turn around you had to lift and swipe again. A stick that holds a deflection
// should keep turning while it is held, like the analogue stick it is drawn to
// look like, so deflection maps to angular VELOCITY and the finger can sit
// still at the edge and spin.
const LOOK_RATE = 820;      // mouse units per second at full deflection
// Weak exponential: a cubic blended with the linear response. Fine aim lives in
// the middle of the stick where the curve is shallow, and the fast turn lives
// at the rim. Pure cubic is too dead in the centre to track a moving target.
const LOOK_EXPO = 0.35;     // 0 = linear, 1 = pure cubic

/** Deflection (-1..1) to response (-1..1), past the deadzone, with expo. */
function curve(n) {
  const dead = DEAD / RANGE;
  const a = Math.min(1, Math.abs(n));
  if (a <= dead) return 0;
  // Rescaled past the deadzone so the response GROWS from zero rather than
  // stepping to a finite value the instant the stick clears it.
  const t = (a - dead) / (1 - dead);
  return Math.sign(n) * ((1 - LOOK_EXPO) * t + LOOK_EXPO * t * t * t);
}

export class Touch {
  /**
   * `surface` is where the thumbs are read, and it is deliberately NOT the
   * canvas. The canvas is letterboxed -- black bands down the sides in
   * landscape, along the bottom in portrait -- and those bands are the most
   * comfortable place on a phone to rest a thumb, because they are the only
   * part of the screen not showing the game. Reading input from the canvas
   * alone made the one region a player naturally reaches for the one region
   * that did nothing.
   */
  constructor(canvas, input, hooks = {}, surface = canvas) {
    this.canvas = canvas;
    this.surface = surface ?? canvas;
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
    const surf = this.surface;
    surf.addEventListener('pointerdown', (e) => this.down(e), opts);
    surf.addEventListener('pointermove', (e) => this.move(e), opts);
    surf.addEventListener('pointerup', (e) => this.up(e), opts);
    surf.addEventListener('pointercancel', (e) => this.up(e), opts);
    // A pointer whose capture is taken away sends no further events to us, so
    // its stick has to go with it. Without this the stick survives as a corpse
    // that blocks its whole half of the screen -- see `down`.
    surf.addEventListener('lostpointercapture', (e) => this.up(e), opts);
    // Stop the browser treating a drag as a scroll or a double-tap as zoom.
    surf.style.touchAction = 'none';
    if (canvas !== surf) canvas.style.touchAction = 'none';
    this.pads = this.buildPads();
  }

  /** Which half of the input surface a touch started in. */
  side(e) {
    const r = this.surface.getBoundingClientRect();
    return (e.clientX - r.left) < r.width / 2 ? 'move' : 'look';
  }

  /**
   * Two always-visible stick markers, as DOM rather than framebuffer pixels.
   *
   * They have to be DOM: the whole point is that they sit in the letterbox
   * bands, and the framebuffer by definition cannot reach outside the picture.
   * Drawn faintly when idle so a thumb knows where to land without looking, and
   * brightened while held.
   */
  buildPads() {
    const doc = globalThis.document;
    if (!doc?.createElement || !this.surface.append) return null;
    const mk = (r, colour) => {
      const el = doc.createElement('div');
      el.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;' +
        `width:${r * 2}px;height:${r * 2}px;margin:${-r}px 0 0 ${-r}px;` +
        `border:2px solid ${colour};transition:opacity .18s;opacity:.22;` +
        'box-sizing:border-box;z-index:5;';
      this.surface.append(el);
      return el;
    };
    // The surface must be a positioning context or the markers land relative to
    // the page instead of the picture.
    const cs = globalThis.getComputedStyle?.(this.surface);
    if (cs && cs.position === 'static') this.surface.style.position = 'relative';
    return {
      move: { ring: mk(RANGE, '#8fb3ff'), knob: mk(11, '#8fb3ff') },
      look: { ring: mk(RANGE, '#ffcf6b'), knob: mk(11, '#ffcf6b') },
    };
  }

  /** Where each stick rests when nothing is touching it. */
  homes() {
    const s = this.surface.getBoundingClientRect();
    const c = this.canvas.getBoundingClientRect();
    // Prefer the centre of the letterbox band, which is the whole point of
    // this: a thumb there covers nothing worth seeing. When there is no band to
    // speak of -- a display that happens to match the aspect ratio -- fall back
    // to insetting from the edges so the markers stay reachable.
    const leftBand = c.left - s.left, rightBand = s.right - c.right;
    const pad = RANGE + 14;
    const y = Math.min(s.height - pad, Math.max(pad, s.height * 0.72));
    return {
      move: { x: leftBand > pad ? leftBand / 2 : pad, y },
      look: { x: rightBand > pad ? s.width - rightBand / 2 : s.width - pad, y },
    };
  }

  down(e) {
    if (!this.enabled || e.pointerType === 'mouse') return;
    e.preventDefault();
    const side = this.side(e);
    // One stick per side, and the NEWEST finger owns it.
    //
    // This used to ignore the new touch and keep the old stick, which is only
    // correct while every pointerup arrives. A single lost up or cancel -- a
    // browser reclaiming the gesture, a capture taken away, an element
    // re-created underneath the finger -- left a stick that no event could ever
    // reach again, and because `down` then returned early, that half of the
    // screen was dead for the rest of the session. "Everything gets stuck" is
    // what that looks like from the sofa.
    //
    // Dropping the stale one instead costs nothing a player would notice (a
    // second finger on the same half is not a gesture the game has) and makes
    // every failure self-healing on the next touch.
    for (const [id, st] of this.sticks) if (st.side === side) this.sticks.delete(id);
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
    s.moved = Math.max(s.moved, Math.hypot(e.clientX - s.x0, e.clientY - s.y0));
    s.x = e.clientX; s.y = e.clientY;
    // Nothing is fed to the mouse here any more. Looking is integrated once a
    // frame from the held deflection instead -- see `lookRate`.
  }

  /**
   * Called once a frame with the frame's length in seconds. Turns the right
   * stick's deflection into mouse movement, so looking goes through the same
   * `(delta * MouseSensitivity) >> 2` the real mouse does and the sensitivity
   * setting still means something.
   */
  lookRate(dt) {
    if (!(dt > 0)) return;
    for (const s of this.sticks.values()) {
      if (s.side !== 'look') continue;
      const rx = curve((s.x - s.x0) / RANGE);
      const ry = curve((s.y - s.y0) / RANGE);
      if (rx === 0 && ry === 0) continue;
      this.input.addMouse(rx * LOOK_RATE * dt, ry * LOOK_RATE * dt);
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

  /**
   * Called once a frame. Updates the DOM markers when there are any, and
   * otherwise falls back to drawing into the framebuffer.
   *
   * The framebuffer path cannot show a stick resting in a letterbox band --
   * there are no pixels out there to write -- so it survives only for the case
   * where no DOM surface was available.
   */
  draw(fb, W, H) {
    if (!this.enabled) return;
    if (this.pads) { this.updatePads(); return; }

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

  /** Park each marker at its home, or under the thumb that owns it. */
  updatePads() {
    const s = this.surface.getBoundingClientRect();
    if (!s.width || !s.height) return;
    const home = this.homes();
    const live = { move: null, look: null };
    for (const st of this.sticks.values()) live[st.side] = st;

    for (const side of ['move', 'look']) {
      const pad = this.pads[side], st = live[side];
      const at = st ? { x: st.x0 - s.left, y: st.y0 - s.top } : home[side];
      pad.ring.style.transform = `translate(${at.x}px,${at.y}px)`;
      pad.ring.style.opacity = st ? '.75' : '.22';
      // The knob shows the deflection, clamped to the ring so it never escapes
      // the control it belongs to however far the thumb travels.
      let kx = at.x, ky = at.y;
      if (st) {
        const dx = st.x - st.x0, dy = st.y - st.y0;
        const d = Math.hypot(dx, dy);
        const k = d > RANGE ? RANGE / d : 1;
        kx += dx * k; ky += dy * k;
      }
      pad.knob.style.transform = `translate(${kx}px,${ky}px)`;
      pad.knob.style.opacity = st ? '.9' : '.18';
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
