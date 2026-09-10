// Browser-only touch adapter, explicitly requested for play.html and carried
// over from the sibling Breathless port's web/src/touch.js control design.
// It does not add gameplay rules: the left stick feeds the existing AB3D
// forward/back/strafe booleans, while the right stick calls the same camera
// turn/pitch path used by relative mouse input. Pitch is consumed only by the
// explicitly labelled Enhanced Sharp mode; original and sharp stay horizontal
// exactly as AB3D. A short left tap fires and a short right tap operates,
// matching the current Breathless port.

export function shouldGrabPointer({ pointerType, playing, locked, touchEnabled }) {
  if (pointerType === 'touch' || pointerType === 'pen' || touchEnabled) return false;
  return Boolean(playing && !locked);
}

const DEAD = 8;
const RANGE = 56;
const TAP_MS = 250;
const TAP_PX = 12;
const LOOK_RATE = 620;
const LOOK_EXPO = .35;

function curve(value) {
  const dead = DEAD / RANGE;
  const magnitude = Math.min(1, Math.abs(value));
  if (magnitude <= dead) return 0;
  const distance = (magnitude - dead) / (1 - dead);
  return Math.sign(value) *
    ((1 - LOOK_EXPO) * distance + LOOK_EXPO * distance * distance * distance);
}

export class TouchControls {
  constructor(canvas, hooks = {}, surface = canvas) {
    this.canvas = canvas;
    this.surface = surface || canvas;
    this.hooks = hooks;
    this.sticks = new Map();
    this.enabled = Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches);
    if (!this.enabled) return;

    const options = { passive: false };
    this.surface.addEventListener('pointerdown', event => this.down(event), options);
    this.surface.addEventListener('pointermove', event => this.move(event), options);
    this.surface.addEventListener('pointerup', event => this.up(event), options);
    this.surface.addEventListener('pointercancel', event => this.up(event), options);
    this.surface.addEventListener('lostpointercapture', event => this.up(event), options);
    this.surface.style.touchAction = 'none';
    this.canvas.style.touchAction = 'none';
    this.pads = this.buildPads();
  }

  side(event) {
    const bounds = this.surface.getBoundingClientRect();
    return event.clientX - bounds.left < bounds.width / 2 ? 'move' : 'look';
  }

  buildPads() {
    if (this.surface === this.canvas || !globalThis.document?.createElement) return null;
    const make = (radius, colour) => {
      const element = document.createElement('div');
      element.className = 'touch-stick-marker';
      element.style.cssText =
        `width:${radius * 2}px;height:${radius * 2}px;margin:${-radius}px 0 0 ${-radius}px;` +
        `border-color:${colour}`;
      this.surface.append(element);
      return element;
    };
    return {
      move: { ring: make(RANGE, '#8fb3ff'), knob: make(11, '#8fb3ff') },
      look: { ring: make(RANGE, '#d8e230'), knob: make(11, '#d8e230') },
    };
  }

  down(event) {
    if (!this.enabled || event.pointerType === 'mouse' ||
        event.target.closest?.('.play-toolbar')) return;
    event.preventDefault();
    const side = this.side(event);
    for (const [pointerId, stick] of this.sticks) {
      if (stick.side === side) this.sticks.delete(pointerId);
    }
    this.sticks.set(event.pointerId, {
      side,
      x0: event.clientX, y0: event.clientY,
      x: event.clientX, y: event.clientY,
      started: performance.now(), moved: 0,
    });
    this.surface.setPointerCapture?.(event.pointerId);
    this.hooks.onWake?.();
  }

  move(event) {
    const stick = this.sticks.get(event.pointerId);
    if (!stick) return;
    event.preventDefault();
    stick.moved = Math.max(stick.moved,
      Math.hypot(event.clientX - stick.x0, event.clientY - stick.y0));
    stick.x = event.clientX;
    stick.y = event.clientY;
  }

  up(event) {
    const stick = this.sticks.get(event.pointerId);
    if (!stick) return;
    event.preventDefault();
    this.sticks.delete(event.pointerId);
    const held = performance.now() - stick.started;
    if (stick.moved < TAP_PX && held < TAP_MS) {
      if (this.hooks.onConfirm?.()) return;
      if (stick.side === 'move') this.hooks.onFire?.();
      else this.hooks.onUse?.();
    }
  }

  direction() {
    let bits = 0;
    for (const stick of this.sticks.values()) {
      if (stick.side !== 'move') continue;
      const dx = stick.x - stick.x0;
      const dy = stick.y - stick.y0;
      if (Math.hypot(dx, dy) < DEAD) continue;
      const x = Math.max(-1, Math.min(1, dx / RANGE));
      const y = Math.max(-1, Math.min(1, dy / RANGE));
      if (y < -.33) bits |= 8;
      if (y > .33) bits |= 4;
      if (x > .33) bits |= 1;
      if (x < -.33) bits |= 2;
    }
    return {
      forwardPressed: Boolean(bits & 8),
      backwardPressed: Boolean(bits & 4),
      strafeLeft: Boolean(bits & 2),
      strafeRight: Boolean(bits & 1),
    };
  }

  lookRate(elapsed) {
    if (!(elapsed > 0)) return;
    for (const stick of this.sticks.values()) {
      if (stick.side !== 'look') continue;
      const horizontal = curve((stick.x - stick.x0) / RANGE) * LOOK_RATE * elapsed;
      const vertical = curve((stick.y - stick.y0) / RANGE) * LOOK_RATE * elapsed;
      if (horizontal || vertical) this.hooks.onLook?.(horizontal, vertical);
    }
  }

  release() {
    this.sticks.clear();
  }

  homes() {
    const surface = this.surface.getBoundingClientRect();
    const canvas = this.canvas.getBoundingClientRect();
    const pad = RANGE + 14;
    const leftBand = canvas.left - surface.left;
    const rightBand = surface.right - canvas.right;
    const below = surface.bottom - canvas.bottom;
    if (leftBand > pad && rightBand > pad) {
      const y = Math.min(surface.height - pad, Math.max(pad, surface.height * .72));
      return { move: { x: leftBand / 2, y },
        look: { x: surface.width - rightBand / 2, y } };
    }
    if (below > pad) {
      const y = Math.min(surface.height - pad, surface.height - below / 2);
      return { move: { x: surface.width * .22, y },
        look: { x: surface.width * .78, y } };
    }
    const y = Math.min(surface.height - pad, Math.max(pad, surface.height * .78));
    return { move: { x: pad, y }, look: { x: surface.width - pad, y } };
  }

  updatePads() {
    if (!this.pads) return;
    const homes = this.homes();
    const live = { move: null, look: null };
    for (const stick of this.sticks.values()) live[stick.side] = stick;
    for (const side of ['move', 'look']) {
      const pad = this.pads[side];
      const stick = live[side];
      const home = homes[side];
      pad.ring.style.transform = `translate(${home.x}px,${home.y}px)`;
      pad.ring.style.opacity = stick ? '.8' : '.25';
      let x = home.x, y = home.y;
      if (stick) {
        const dx = stick.x - stick.x0, dy = stick.y - stick.y0;
        const distance = Math.hypot(dx, dy);
        const clamp = distance > RANGE ? RANGE / distance : 1;
        x += dx * clamp;
        y += dy * clamp;
      }
      pad.knob.style.transform = `translate(${x}px,${y}px)`;
      pad.knob.style.opacity = stick ? '.9' : '.18';
    }
  }
}
