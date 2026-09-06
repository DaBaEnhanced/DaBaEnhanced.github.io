// The effect / trigger machine, from Sorgenti/Animations.asm.
//
// A block carries `effect` (an index into the level's fx lists) and `trigger` /
// `trigger2` (which effects act on this block).  Walking onto a block with an
// effect list activates every entry in that list; each entry names a trigger
// number, an effect opcode and two parameters, and the effect then animates
// every block carrying that trigger number.
//
// Opcodes are EffectRoutineTable in Animations.asm.  Across all 20 levels only
// 14 of the 17 are used: 1-8, 11-17 minus 9/10 (LightUp/LightDown never appear,
// though LinkedLight, which mirrors them, does).
//
// Everything moves at `ticks` units per 50Hz tick -- the original's Canimcounter
// is literally "how many 50ths have passed since last time", used directly as a
// pixel count, so movement speed is one unit per tick.

export const FX = {
  CEIL_UP: 1, FLOOR_UP: 2, CEIL_DOWN: 3, FLOOR_DOWN: 4,
  DOOR_UP: 5, DOOR2: 6, FLOOR_UP_DOWN: 7, FLOOR_DOWN_UP: 8,
  LIGHT_UP: 9, LIGHT_DOWN: 10, TERMINAL: 11, DOOR_DOWN: 12,
  LINKED_LIGHT: 13, END_LEVEL: 14, TELEPORT: 15, BLINKING_LIGHT: 16,
  ACTIVE_ENEMY: 17,
};

export const FX_NAMES = {
  1: 'CeilUp', 2: 'FloorUp', 3: 'CeilDown', 4: 'FloorDown', 5: 'DoorUp',
  6: 'Door2', 7: 'FloorUpDown', 8: 'FloorDownUp', 9: 'LightUp', 10: 'LightDown',
  11: 'Terminal', 12: 'DoorDown', 13: 'LinkedLight', 14: 'EndLevel',
  15: 'Teleport', 16: 'BlinkingLight', 17: 'ActiveEnemy',
};

const STATUS_DONE_REARM = -1;     // StopEffect1: the trigger may fire again
const STATUS_DONE_LOCK = -2;      // StopEffect2: one-shot

export class Effects {
  constructor(level, hooks = {}) {
    this.level = level;
    this.hooks = hooks;             // { onEndLevel, onTerminal, onTeleport, onSound }
    this.active = [];
    this.busyTrigger = new Map();   // trigger number -> effect code currently running
    this.log = [];
    this.rng = 0x1234;
    // Key gating. `eff_key` is 1..4 for Green/Yellow/Red/Blue, matching the
    // player's own flags; SwitchManagement consumes the key once it is used.
    // `allKeys` is a development override for exploring locked levels.
    // Canimcounter is "how many whole 50ths have passed", and every routine
    // uses it directly as a PIXEL count. Block heights live in Int16Arrays, so
    // advancing by a fractional tick adds 0.83 to an integer array and stores
    // zero: the effect's counter drains, the door sound plays, and the geometry
    // never moves. Accumulate and step whole ticks only, as the original does.
    this.tickAcc = 0;
    this.allKeys = !!hooks.allKeys;
    this.player = null;
    this.world = null;          // set by the caller so doors can see enemies
  }

  /** Shared-style deterministic random value in the inclusive range 0..max. */
  rnd(max) {
    this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
    return (this.rng >> 8) % (max + 1);
  }

  /** Activate a block's 1-based effect list. Walk activation ignores eff_key;
   *  SwitchManagement alone checks it and consumes used keys after the list. */
  trigger(listNum, { fromSwitch = false } = {}) {
    const list = this.level.json.fxlists[listNum - 1];
    if (!list) return 0;
    const usedKeys = new Set();
    let activated = 0;
    for (const e of list) {
      if (!e.trigger) continue;
      if (this.busyTrigger.get(e.trigger) === e.effect) continue;  // already running
      if (fromSwitch && e.key && !this.hasKey(e.key)) {
        this.hooks.onLocked?.(e.key);
        break;                                  // SMout: do not run later entries
      }
      if (fromSwitch && e.key) usedKeys.add(e.key);
      const blocks = this.level.triggerBlocks.get(e.trigger) ?? [];
      this.active.push({
        effect: e.effect, trigger: e.trigger, blocks,
        status: 0, param1: e.p1, param2: e.p2, var1: 0, var2: 0, link: null,
        enemyOnBlocks: false,
      });
      activated++;
      this.busyTrigger.set(e.trigger, e.effect);
      this.log.push(`fire ${FX_NAMES[e.effect] ?? e.effect} trig=${e.trigger} ` +
                    `p1=${e.p1} p2=${e.p2} blocks=${blocks.length}`);
    }
    for (const key of usedKeys) this.player?.useKey(key);
    return activated;
  }

  hasKey(n) {
    if (this.allKeys) return true;
    return !!this.player?.keys[n - 1];
  }

  /** Space pressed facing an edge: SwitchManagement in movement.asm.
   *  The player must be within +/-224 of a cardinal heading (of 2048), and the
   *  block being faced must carry the matching "edge N switch" attribute bit.
   *  Attribute bits 4..7 correspond to Edge1..Edge4. */
  pressSwitch(player) {
    const B = this.level.B;
    const h = ((Math.round((player.heading / (2 * Math.PI)) * 2048) % 2048) + 2048) % 2048;
    const near = (c) => Math.abs(((h - c + 1024 + 2048) % 2048) - 1024) <= 224;
    // Each direction names an attribute bit AND the edge of the neighbouring
    // block that faces back at the player -- the face the button is painted on.
    // Edge1 is +X, Edge2 +Z, Edge3 -X, Edge4 -Z (TMap.i), which are indices
    // 0, 1, 2, 3 here.
    let dx = 0, dz = 0, bit = 0, edge = 0;
    if (near(1024))      { dx = -1; bit = 0x10; edge = 0; }  // facing -X, its Edge1
    else if (near(512))  { dz = 1;  bit = 0x80; edge = 3; }  // facing +Z, its Edge4
    else if (near(0))    { dx = 1;  bit = 0x40; edge = 2; }  // facing +X, its Edge3
    else if (near(1536)) { dz = -1; bit = 0x20; edge = 1; }  // facing -Z, its Edge2
    else return false;

    const cx = Math.floor(player.x / 64) + dx, cz = Math.floor(player.z / 64) + dz;
    let v = this.level.blockAt(cx, cz);
    if (v < 0) v = -v;
    if (!v || !(B.attrs[v] & bit)) return false;
    // SMnoct1/2/3: the edge's three textures each swap to their linked record
    // if they have one and are not animated. This is the whole visible half of
    // pressing a switch -- without it the wall button never changes and the
    // press reads as having done nothing, whatever the trigger did.
    this.flipSwitchFace(v, edge);
    if (!B.effect[v]) return false;
    const activated = this.trigger(B.effect[v], { fromSwitch: true });
    if (activated) this.hooks.onSound?.('switch');
    return true;
  }

  /** Swap one edge's normal, upper and lower textures to their pressed faces. */
  flipSwitchFace(block, edge) {
    const { E, B, tex } = this.level;
    const e = B.edges[block * 4 + edge];
    if (!e) return false;
    let changed = false;
    for (const which of ['normTex', 'upTex', 'lowTex']) {
      const slot = E[which][e];
      const t = slot > 0 ? tex[slot] : null;
      // `cmp.w #1,tx_Animation(a1) / bgt` -- an animated texture is left alone.
      if (!t || t.frames > 1 || !t.link) continue;
      E[which][e] = t.link;
      changed = true;
    }
    return changed;
  }

  stop(fx, rearm) {
    fx.status = rearm ? STATUS_DONE_REARM : STATUS_DONE_LOCK;
  }

  /**
   * Animations.asm animates the textures before it runs any effect list, and
   * gives them their own clock: `divu #8,d6` advances one brush per 8 ticks --
   * 6.25 frames a second at 50Hz -- carrying the remainder in TextAnimCounter,
   * and clamping to at most 2 advances in a pass.
   *
   * Atxmu/Atxcd add a rule this deliberately does NOT reproduce: two
   * consecutive passes may not both be 0, nor both be 2. On the Amiga a frame
   * took 2 to 5 ticks, so the quotient flickered between 0 and 1 and that rule
   * smoothed it. At 60fps a pass is 0.83 ticks, the quotient is 0 for nine
   * frames out of ten, and the rule instead forces an advance every other
   * frame -- 30 a second instead of 6.25, five times too fast. The accumulator
   * alone is smooth at this frame rate, which is what the rule was reaching for.
   */
  animateTextures(ticks) {
    this.texAcc = (this.texAcc ?? 0) + Math.max(0, ticks);
    let steps = Math.floor(this.texAcc / 8);
    if (steps <= 0) return;
    this.texAcc -= steps * 8;
    if (steps > 2) steps = 2;              // Atxmu: never more than 2 in a pass
    for (const t of this.level.tex) {
      if (!t || t.frames <= 1) continue;
      t.frame = (t.frame + steps) % t.frames;
    }
  }

  update(ticks, player) {
    const B = this.level.B;
    this.animateTextures(ticks);
    this.tickAcc += Math.max(0, ticks);
    const d = Math.floor(this.tickAcc);
    if (d <= 0) return;
    this.tickAcc -= d;
    // AWnext clears the "enemy on one of my blocks" bit each pass and the enemy
    // code sets it again while it stands there; CEDcaduta keeps it set for a
    // body left behind. Doors and Door2 test it and refuse to close.
    const occupied = this.world?.occupiedBlocks();
    for (const fx of this.active) {
      if (fx.status < 0) continue;
      fx.enemyOnBlocks = occupied ? fx.blocks.some((b) => occupied.has(b)) : false;
      this.run(fx, d, player, B);
    }
    // reap finished effects; StopEffect1 re-arms the trigger, StopEffect2 does not
    this.active = this.active.filter((fx) => {
      if (fx.status >= 0) return true;
      if (fx.status === STATUS_DONE_REARM) this.busyTrigger.delete(fx.trigger);
      return false;
    });
  }

  /** Move a height field on every block of the effect by up to `d`, capped by var1. */
  slide(fx, d, field, sign) {
    const B = this.level.B, arr = B[field];
    const step = Math.min(d, fx.var1);
    for (const b of fx.blocks) arr[b] += sign * step;
    fx.var1 -= step;
    return fx.var1 <= 0;
  }

  playerOnBlocks(fx, player) { return fx.blocks.includes(player.block); }

  run(fx, d, player, B) {
    switch (fx.effect) {
      case FX.CEIL_UP:
      case FX.FLOOR_UP:
      case FX.CEIL_DOWN:
      case FX.FLOOR_DOWN: {
        if (fx.status === 0) { fx.status = 1; fx.var1 = fx.param1; }
        const field = (fx.effect === FX.CEIL_UP || fx.effect === FX.CEIL_DOWN)
          ? 'ceilH' : 'floorH';
        const sign = (fx.effect === FX.CEIL_UP || fx.effect === FX.FLOOR_UP) ? 1 : -1;
        if (this.slide(fx, d, field, sign)) this.stop(fx, false);
        return;
      }

      // Three-phase openers.  status 1 = open, 2 = pause, 3 = close.
      // Closing is blocked while the player (or an enemy) is on one of the
      // blocks; the original then reverses back to the open phase.
      // Doors hold open while the player or an enemy is on them (DUpause /
      // DUdown test for it).  Lifts do NOT -- FUDpause and FUDdown have no such
      // check, which is what lets a lift carry the player back down.
      case FX.DOOR_UP:       return this.threePhase(fx, d, player, ['ceilH'], [1], true);
      case FX.DOOR_DOWN:     return this.threePhase(fx, d, player, ['floorH'], [-1], true);
      case FX.DOOR2:         return this.threePhase(fx, d, player, ['ceilH', 'floorH'], [1, -1], true);
      case FX.FLOOR_UP_DOWN: return this.threePhase(fx, d, player, ['floorH'], [1], false);
      case FX.FLOOR_DOWN_UP: return this.threePhase(fx, d, player, ['floorH'], [-1], false);

      case FX.LIGHT_UP:
      case FX.LIGHT_DOWN: {
        if (fx.status === 0) {
          fx.status = 1;
          fx.var1 = fx.param1 << 8;
          fx.rate = fx.param2 ? (fx.param1 << 8) / fx.param2 : fx.var1;
          fx.acc = 0;
        }
        let change = Math.min(fx.rate * d, fx.var1);
        fx.acc += change;
        const whole = Math.floor(fx.acc / 256); fx.acc -= whole * 256;
        const sign = fx.effect === FX.LIGHT_UP ? -1 : 1;   // "up" = brighter = lower value
        for (const b of fx.blocks) {
          B.illum[b] = Math.max(0, Math.min(127, B.illum[b] + sign * whole));
        }
        fx.var1 -= change;
        if (fx.var1 <= 0) this.stop(fx, false);
        return;
      }

      case FX.BLINKING_LIGHT: {
        if (fx.status === 0) {
          fx.status = 1; fx.var1 = 50;
          fx.var2 = B.illum[fx.blocks[0]] ?? 0;            // remember the base level
        }
        fx.var1 -= d;
        if (fx.var1 > 0) return;
        // Alternate between param1 and the stored level. The flash itself lasts
        // 10 ticks; the restored interval is param2, or a newly chosen random
        // 0..150 ticks when param2 is zero (BLLnornd in Animations.asm).
        const toLit = fx.status === 2;
        const value = toLit ? fx.var2 : fx.param1;
        for (const b of fx.blocks) B.illum[b] = value;
        fx.status = toLit ? 1 : 2;
        fx.var1 = toLit ? (fx.param2 || this.rnd(150)) : 10;
        return;
      }

      case FX.LINKED_LIGHT: {
        // Mirrors the progress of the effect running on trigger `param2`.
        if (fx.status === 0) {
          const src = this.active.find((o) => o.trigger === fx.param2);
          if (!src || src.status === 0) return;       // source not initialized yet
          if (!src.param1) { this.stop(fx, false); return; }
          fx.link = src;
          fx.var2 = B.illum[fx.blocks[0]] ?? 0;
          fx.status = 1;
          return;
        }
        const src = fx.link;
        if (!src || !src.param1) { this.stop(fx, false); return; }
        if (src.status < 0) {
          // A re-arming source restores the original light and re-arms this
          // effect too. A permanently stopped source retains its last value.
          if (src.status === STATUS_DONE_REARM) {
            for (const b of fx.blocks) B.illum[b] = fx.var2;
            this.stop(fx, true);
          } else {
            this.stop(fx, false);
          }
          return;
        }
        if (src.status === 2) return;                  // hold at the open value
        const moved = src.status === 1 ? src.param1 - src.var1 : src.var1;
        const change = Math.floor((moved * fx.param1) / src.param1);
        const value = fx.var2 - change;
        for (const b of fx.blocks) B.illum[b] = Math.max(0, Math.min(127, value));
        return;
      }

      case FX.END_LEVEL:
        this.hooks.onEndLevel?.();
        this.stop(fx, false);
        return;

      case FX.TERMINAL:
        this.hooks.onTerminal?.(fx.param1);
        this.stop(fx, true);
        return;

      case FX.TELEPORT: {
        // Tnoinit: the sound, the freeze and the fog fade all start here, and
        // the move happens 32 ticks later when the counter runs out.
        if (fx.status === 0) {
          fx.status = 1; fx.var1 = 32;
          this.hooks.onSound?.('teleport');
          this.hooks.onTeleportStart?.();
        }
        fx.var1 -= d;
        if (fx.var1 > 0) return;
        this.hooks.onTeleport?.(fx.param1, fx.param2);      // destination map cell
        // Teleport ends through StopEffect1 in Animations.asm: the pad must be
        // usable again after the player steps away and returns.
        this.stop(fx, true);
        return;
      }

      case FX.ACTIVE_ENEMY: {
        // Wakes every enemy tagged with this trigger, after a param1 delay.
        // It is the single most common opcode in the game (519 uses).
        if (fx.status === 0) { fx.status = 1; fx.var1 = fx.param1; }
        fx.var1 -= d;
        if (fx.var1 <= 0) { this.hooks.onActivateEnemy?.(fx.trigger); this.stop(fx, false); }
        return;
      }

      default:
        this.stop(fx, false);
    }
  }

  /** open -> pause -> close, shared by DoorUp / DoorDown / Door2 / the lifts. */
  threePhase(fx, d, player, fields, signs, holdForPlayer) {
    const B = this.level.B;
    if (fx.status === 0) {
      fx.status = 1; fx.var1 = fx.param1;
      this.hooks.onSound?.('doorStart');
    }
    const move = (dir) => {
      const step = Math.min(d, fx.var1);
      for (let i = 0; i < fields.length; i++) {
        const arr = B[fields[i]];
        for (const b of fx.blocks) arr[b] += dir * signs[i] * step;
      }
      fx.var1 -= step;
      return step;
    };

    if (fx.status === 1) {                       // opening
      move(1);
      if (fx.var1 > 0) return;
      this.hooks.onSound?.('doorStop');
      fx.var1 = fx.param2;
      if (fx.var1 === 0) { this.stop(fx, false); return; }
      fx.status = 2;
      return;
    }
    if (fx.status === 2) {                       // waiting
      if (holdForPlayer && (this.playerOnBlocks(fx, player) || fx.enemyOnBlocks)) return;
      fx.var1 -= d;
      if (fx.var1 > 0) return;
      fx.var1 = fx.param1; fx.status = 3;
      this.hooks.onSound?.('doorStart');
      return;
    }
    // closing -- if the player is underneath, reopen instead of crushing
    if (holdForPlayer && (this.playerOnBlocks(fx, player) || fx.enemyOnBlocks)) {
      fx.var1 = fx.param1 - fx.var1;
      fx.status = 1;
      return;
    }
    move(-1);
    if (fx.var1 > 0) return;
    this.hooks.onSound?.('doorStop');
    if (holdForPlayer) this.world?.removeRemainsOnBlocks?.(fx.blocks);
    this.stop(fx, true);        // doors and lifts are WR: the trigger re-arms
  }
}

/** trigger number -> the blocks it animates (bl_Trigger and bl_Trigger2). */
export function buildTriggerBlocks(level) {
  const m = new Map();
  const add = (t, b) => {
    if (!t) return;
    if (!m.has(t)) m.set(t, []);
    if (!m.get(t).includes(b)) m.get(t).push(b);
  };
  for (let b = 0; b < level.B.trigger.length; b++) {
    add(level.B.trigger[b], b);
    add(level.B.trigger2[b], b);
  }
  return m;
}
