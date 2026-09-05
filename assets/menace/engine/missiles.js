// Menace - the player's weapons, from update.missiles at $710b2 and the five
// spawn sites reached from get.firekey at $7029a.
//
// There are FIVE weapons, not two. Each has its own active-bit byte, its own
// slot array, its own artwork, its own speed and its own hit offset:
//
//  bit byte  slots      n  art               BLTSIZE rows  step        hit
//   $8(a5)   $9e..$b6   4  +$10               $82    2     x += $a     (+8,+2)
//   $9(a5)   $be..$d6   4  +$20              $142    5     x += 8      (+$c,+4)
//   $a(a5)   $de..$f6   4  +$00               $82    2     x += $10    (+$10,0)
//   $b(a5)   $fe..$106  2  $74d64             $c2    3     dx,dy $7424e (+1,+1)
//   $c(a5)   $10e..$116 2  $74d64             $c2    3     dx,dy $74258 (+1,+1)
//
// The last two are the outrider pods' guns, and they are the reason the pods
// visibly swivel: each slot carries a signed dx,dy byte pair taken from a
// five-entry table indexed by ($44(a5) - 1) * 2, and $44(a5) is the same value
// $7020a uses to pick which of the six outrider frames is drawn. The tables are
// mirrors - (+5,0) (+5,-5) (0,-5) (-5,-5) (-5,0) up top, downward below - so
// the pods shoot where they point, from straight ahead round to straight back.
//
// Every loop sits in the ODD branch of vloop, so all of this runs at 25 Hz.
import { SHIP_SPRITE_DX, SHIP_SPRITE_DY, PF2_ORIGIN_X, PF2_ORIGIN_Y } from './engine.js?v=224303';

export const SLOTS = 4;

// $7031e, indexed before a volley spends ammunition or searches for slots.
const FIRE_SFX = [22, 21, 3, 7];
export const fireSfx = (cannons, lasers) =>
  FIRE_SFX[(cannons > 0 ? 1 : 0) | (lasers > 0 ? 2 : 0)];

// Where a shot appears relative to the ship as the engine draws it.
//
// The spawn sites add a constant to $26/$28(a5) and store the result as a PF2
// coordinate, so the muzzle offset is exact - but the ship is a hardware SPRITE
// and PF2 is a bitmap, and the two spaces do not share an origin. Both origins
// are recoverable:
//
//   $701ec  sprite HSTART = $26(a5) + $80, VSTART = $28(a5) + $21
//   copper  DIWSTRT $1f78 -> the display window opens at hpos $78, line $1f
//           so the ship's top-left is drawn at ($26 + 8, $28 + 2)
//   $70df8  seek mode aims an alien at (($26 + $36) >> 1, ($28 + $e) >> 1),
//           which the mover doubles back: the ship's CENTRE in PF2 space is
//           ($26 + 54, $28 + 26) - the alien's x is its box centre and its y
//           its box top, and the box is 24 tall.
//
// The ship is 32x44, so its centre on screen is ($26 + 24, $28 + 24), and
// therefore screen = PF2 - (30, 2). A shot spawned at ($26 + dx, $28 + dy) in
// PF2 space lands at (dx - 38, dy - 4) from the ship's drawn top-left.
//
// Three independent checks agree. The x limit $168 puts a shot's death 10px
// past the right edge rather than 40. The outrider bounds $10..$168 and
// $9..$ba map to -14..330 and 7..184, which brackets a 320x192 playfield. And
// the two pod guns come out at (0, +2) and (0, +36), inside pods that
// export_sprites placed - by an unrelated route, $7023a's merge into the ship's
// back sprite - at y+0 and y+33.
//
// This replaces MUZZLE_BIAS, a -26 fudge fitted by eye to a picture.
export const MUZZLE_DX = SHIP_SPRITE_DX + PF2_ORIGIN_X;   // 8 + 30 = 38
export const MUZZLE_DY = SHIP_SPRITE_DY + PF2_ORIGIN_Y;   // 4 + 0  = 4

export const X_LIMIT = 0x168;   // $710fe / $7116c / $711d4 / $7123e
export const X_MIN = 0x10;      // $71246, the outrider guns only
export const Y_MAX = 0xba;      // $71258
export const Y_MIN = 0x9;       // $71260

// The trigger, from $7029a - reached from moveship, so this runs at 50 Hz.
//
//   7029e  bne $702a8          ; held?
//   702a2  clr.b $d(a5)        ; released -> clear the latch
//   702a8  tst.w $74(a5)       ; frame countdown
//   702ac  bne $702c8          ;   still running -> reload, no shot
//   702b0  move.w #$3,$74(a5)
//   702be  tst.b $d(a5)        ; already fired during this press?
//   702c2  beq $70322          ;   no -> fire
//
// This is NOT autofire, and that is the whole feel of the weapon. $74(a5) is
// reloaded to 3 on EVERY held check and decremented once per frame by the VERTB
// handler ($72972), so holding the button can never let it reach zero. With the
// $d(a5) latch on top, a press yields exactly one shot and the button has to be
// released - for at least three frames - before the next.
export const FIRE_RELOAD = 3;    // $702b0 / $702c8

export class Trigger {
  constructor() {
    this.latch = false;          // $d(a5)
    this.count = 0;              // $74(a5)
  }

  // One 50 Hz frame. Returns true on the frame a shot should be spawned.
  step(held) {
    if (this.count) this.count--;          // $72972, in the VERTB handler
    if (!held) { this.latch = false; return false; }
    if (this.count) { this.count = FIRE_RELOAD; return false; }
    this.count = FIRE_RELOAD;
    if (this.latch) return false;
    this.latch = true;
    return true;
  }
}

export class Weapons {
  // `specs` is manifest.weapons - the five entries pack_web.py reads out of
  // update.missiles, in bit order $8..$c.
  constructor(specs) {
    this.specs = specs;
    this.banks = specs.map((w) =>
      Array.from({ length: w.n }, () => ({ live: false, x: 0, y: 0,
                                           life: 0, dx: 0, dy: 0 })));
  }

  // $70322 get.firekey. Which weapons fire is a function of what the ship is
  // carrying: $8 always; $9 and $a only with the corresponding pod ($e/$f(a5))
  // AND ammo left ($3e/$40(a5)); $b and $c only with the outriders ($4/$5(a5)).
  // `armed` is {laser, beam, podTop, podBot} and `aim` is $44(a5), 0-5.
  fire(ship, armed = {}, aim = 0) {
    const out = [];
    for (let i = 0; i < this.specs.length; i++) {
      const w = this.specs[i];
      if (i === 1 && !armed.laser) continue;
      if (i === 2 && !armed.beam) continue;
      if (i === 3 && !(armed.podTop && aim)) continue;
      if (i === 4 && !(armed.podBot && aim)) continue;
      for (const s of this.banks[i]) {
        if (s.live) continue;
        s.live = true;
        s.x = ship.x + w.dx;         // PF2 space, exactly as $7044a stores it
        s.y = ship.y + w.dy;
        s.life = w.life;
        if (w.dirs) { const d = w.dirs[aim - 1]; s.dx = d[0]; s.dy = d[1]; }
        out.push(i);
        break;
      }
    }
    return out;
  }

  // One 25 Hz tick. update.missiles walks each bank BACKWARDS - `lea $d6(a5),a4`
  // then `subq.w #8,a4` with d7 counting 3 down to 0 - which is observable,
  // because a shot's collision can free a slot in the same tick ($71124 bclr).
  tick() {
    for (let i = 0; i < this.specs.length; i++) {
      const w = this.specs[i], arr = this.banks[i];
      for (let j = arr.length - 1; j >= 0; j--) {
        const s = arr[j];
        if (!s.live) continue;
        if (--s.life === 0) { s.live = false; continue; }
        if (w.dirs) {
          s.x += s.dx; s.y += s.dy;
          if (s.x >= X_LIMIT || s.x < X_MIN) { s.live = false; continue; }
          if (s.y >= Y_MAX || s.y < Y_MIN) { s.live = false; continue; }
        } else {
          s.x += w.step;
          if (s.x >= X_LIMIT) { s.live = false; }
        }
      }
    }
  }

  // Live shots, each tagged with the weapon it came from, so the caller can
  // pick the right artwork and the right hit offset.
  get live() {
    const out = [];
    for (let i = 0; i < this.specs.length; i++)
      for (const s of this.banks[i]) if (s.live) out.push({ s, w: i });
    return out;
  }

  kill(shot) { shot.live = false; }
}
