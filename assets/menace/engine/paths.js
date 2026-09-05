// Menace - the alien path VM.
//
// Transcribed from process.aliens at $70acc, not inferred from the data. The
// distinction matters: the scripts parse cleanly under more than one model, and
// the wrong one moves aliens smoothly in the wrong shapes.
//
// A script is a stream of byte pairs, and each pair is a TARGET WAYPOINT, not a
// delta:
//
//   70ba0  move.b $e(a0),d5       ; speed
//   70ba4  move.b $0(a0,d0.w),d3  ; script byte X
//   70bc6  lsl.w  #1,d3           ; target = byte * 2
//   70bc8  cmp.w  d3,d1           ; against current x.pos
//   70bd6  sub.w  d5,d1           ; step toward it by speed
//   70bde  move.w d3,d1           ; clamp on arrival
//
// Both axes must arrive before the script advances two bytes ($70c7c). A zero
// word ends it ($70c82); a byte whose high nibble is $E dispatches through the
// vector table at $70cac.
//
// Targets are stored halved, which is why seek mode computes (shipX + off) >> 1
// and the mover doubles it again.
//
// Records are 22 bytes, chained by next.path at word 0 ($70d00 adda.w), twelve
// at most ($70ada moveq #$b,d7). copy.path block-copies a group into RAM at
// $34500 and the VM mutates that copy, so a spawn is a copy, never a view.

// Implements $7196c level init (the globals block at $740ae, including the
// $3a path cursor), $70acc process.aliens, $7169e check.path, $71738 copy.path,
// $70f34 save.aliens (unnecessary without a real playfield to restore),
// $71404 the kill routine, and the vector table at $70cac - all sixteen
// opcodes.
export const REC = 22;
const NEXT = 0, XPOS = 2, YPOS = 4, KILLS = 6, TBL = 8, SPRITE = 10, ANIM = 11,
      ADELAY = 12, ADELAY2 = 13, SPEED = 14, PAUSE = 15, MODE = 16,
      LOOPOFF = 17, LOOPCNT = 18, HITS = 19, NANIM = 20, SEEKCNT = 21;

// mode bits, from the btst sites in $70acc..$70d8c
const M_ALT = 0x01, M_SEEKING = 0x02, M_ENDFLAG = 0x04, M_ANIMPP = 0x08,
      M_ANIMDIR = 0x10, M_SEEKXY = 0x20, M_SEEKX = 0x40, M_SEEKY = 0x80;

// $7172e decrements $4c(a5) before testing it. A value of 15 therefore opens
// the first wave on the fifteenth check.path pass, not one pass later.
export function tickSpawnDelay(delay) {
  const next = Math.max(0, delay - 1);
  return { delay: next, ready: next === 0 };
}

export class PathVM {
  constructor(level) {
    this.level = level;
    this.buf = null;           // the working copy, standing in for $34500
    this.actors = [];
    this.unimplemented = new Map();
    // $71404 plays effect $101 on every self-destruct. A shot-kill reaches the
    // same routine and the caller already plays hit()'s 0x01 for that, so only
    // the two seek endings queue here - otherwise a shot would fire it twice.
    this.sfxQueue = [];
    // $3a(a5), a byte offset into the paths table. $740ae initialises it to 4,
    // not 0 ($7196c copies that block over the globals), so the first wave of a
    // level is table entry 1. Entry 0 is the bonus pod template and is never
    // launched as a wave.
    this.cursor = (level.pathCursor !== undefined) ? level.pathCursor : 4;
    this.spriteNum = 0;        // the group's type, for the palette load
    // $16(a5), written by $70d10-$70d14 whenever a path script terminates.
    // `btst #2 / seq` makes it non-zero when bit 2 is CLEAR; check.path then
    // suppresses the pending bonus pod. A bit-2 record ending last clears the
    // latch and permits the pod instead.
    this.bonusBlocked = false;
  }

  // copy.path ($71738). Groups launch SEQUENTIALLY through the table, one at a
  // time, and $3a(a5) is the cursor:
  //
  //   7173e  move.w $3a(a5),d0
  //   7174a  move.l (a0),d1      ; the entry
  //   7174c  bne $7175c
  //   71750  moveq #$4,d0        ; a zero entry restarts at offset 4...
  //   71758  move.l $4(a0),d1    ; ...taking entry 1, never entry 0
  //   7175c  addq.w #4,d0
  //
  // So entry 0 is used once at the start and never revisited, which is why
  // level 1's entry 0 can be an inert group without that being a bug.
  //
  // $71766 then loads colours 0-7 from alien.colours indexed by the group's
  // first record's sprite.num (group + $c). The palette is therefore per GROUP,
  // loaded at spawn - and since check.path only spawns the next group once the
  // current one is gone, one set of eight colours is always enough. That
  // settles the question left open when aliens were first rendered.
  // $716d4/$71738 reload $4c(a5) with 10 and $7172e counts it down, so waves
  // are ten ticks apart rather than back to back. Without it a cleared wave is
  // replaced instantly and the level never breathes.
  static SPAWN_DELAY = 10;
  // ...but the globals template at $740ae carries $4c = $f, so the very first
  // wave of a level waits fifteen passes rather than ten. $716d4/$71738 reload
  // with ten from then on.
  static SPAWN_DELAY_FIRST = 15;
  // $740ae + $6a = $3e7. Set once, when $7196c copies the template over the
  // globals, and never reloaded - so it is a budget for the whole game, not
  // per level, and it only runs down while $10(a5) is 1.
  static GATE_TIMER = 999;

  spawnNext() {
    const tab = this.level.pathTable;
    let i = this.cursor >> 2;
    if (i >= tab.length || tab[i] < 0) i = 1;      // the zero entry wraps to 1
    this.cursor = (i + 1) << 2;
    return this.spawnAt(i);
  }

  // copy.path: read the size word, copy the records that follow. The VM works
  // on the copy, exactly as the original works on $34500.
  spawn(slot) { return this.spawnAt(slot); }

  spawnAt(slot) {
    const off = this.level.pathTable[slot];
    if (off === undefined || off < 0) return false;
    const src = this.level.pathData;
    const size = (src[off] << 8) | src[off + 1];
    // $717a6/$717ae/$717b0: read the size word, copy (size/4)+1 longs
    this.buf = src.slice(off + 2, off + 2 + ((size >> 2) + 1) * 4);
    this.bonusBlocked = false;                        // $717b6 clr.b $16(a5)
    // $7176a: the group's type is the first record's sprite.num, at group + $c
    this.spriteNum = src[off + 12] & 0x7f;
    return true;
  }

  s8(v) { return v > 127 ? v - 256 : v; }
  u16(o) { return (this.buf[o] << 8) | this.buf[o + 1]; }
  i16(o) { const v = this.u16(o); return v > 32767 ? v - 65536 : v; }
  w16(o, v) { this.buf[o] = (v >> 8) & 0xff; this.buf[o + 1] = v & 0xff; }

  // One 25 Hz step. process.aliens runs in the even branch of vloop, so this is
  // called every second frame - never every frame.
  tick(shipX, shipY) {
    this.shipX = shipX;
    this.shipY = shipY;
    const b = this.buf;
    this.actors.length = 0;
    if (!b) return this.actors;
    let a = 0;

    for (let rec = 0; rec < 12; rec++) {
      if (a + REC > b.length) break;
      let mode = b[a + MODE];
      let freed = false;
      const tbl = this.u16(a + TBL);
      let x = this.i16(a + XPOS), y = this.i16(a + YPOS);

      // $70ae8: a zero x.pos is an inert record - skipped, but still emitted.
      // Level 1's group 0 is two such records and legitimately spawns nothing;
      // sprite.num 0 is the same idea at $70b74. Dropping them here instead of
      // emitting them would diverge from the render list the original builds.
      const inert = this.u16(a + XPOS) === 0;

      // $70aec/$70af0: every record that is still ALIVE wipes the pending bonus
      // position. $2a/$2c therefore survive the walk only when the record that
      // finished exploding had no living record after it in the list - the pod
      // marks the LAST thing on screen to die, not merely the last to explode.
      //
      // Without this the position of any death at all was kept, and the inert
      // records parked at x = 2, y = 0 die like the rest: the pod was being
      // spawned in the top-left corner, off the play area, which is why no
      // powerup was ever seen.
      if (!inert) this.lastDeath = null;

      // animation: anim.delay counts down, then anim.num steps. Bit 3 selects
      // ping-pong, bit 4 is the current direction.
      // The buffer is a Uint8Array, so a bare `--` on a zero byte wraps to 255
      // rather than going negative. $70af8 is `subq.b #1,$c(a0) / bne`, which
      // tests the byte AFTER decrementing, so a delay of 0 wraps there too -
      // but the ping-pong branch below compares against a signed -1, and that
      // has to be written out rather than relying on JS arithmetic.
      // $70ae8 `beq $70cec` skips a zero-x record ENTIRELY - the animation
      // included - and jumps straight to the emit. Running the animation for one
      // anyway is what stopped every powerup: a freed record keeps sprite.num 0,
      // so its explosion cycled forever and re-fired the death position with
      // x = 0 on every pass, overwriting the real one before check.path could
      // read it. 180 deaths were being recorded per run and $2a was 0 at every
      // single wave clear.
      if (!inert) {
      b[a + ADELAY] = (b[a + ADELAY] - 1) & 0xff;
      if (b[a + ADELAY] === 0) {
        b[a + ADELAY] = b[a + ADELAY2];
        const n = b[a + NANIM];
        if (n) {
          if (mode & M_ANIMPP) {
            // $70b2c subq.b #1,$b(a0) / bpl - steps down while non-negative
            if (b[a + ANIM] === 0) { b[a + ANIM] = 1; mode ^= M_ANIMDIR; }
            else if (mode & M_ANIMDIR) b[a + ANIM]--;
            else if (++b[a + ANIM] >= n) mode ^= M_ANIMDIR;
          } else if (++b[a + ANIM] > n) {
            // $70b42..$70b50: anim.num resets when it passes num.anims, so the
            // valid range is 0..num.anims inclusive - num.anims + 1 frames.
            b[a + ANIM] = 0;
            // $70b54: if sprite.num is 0 the animation that just finished was
            // the death explosion, so the slot is freed here and this is where
            // the bonus pod's spawn position comes from.
            if (!b[a + SPRITE]) {
              this.lastDeath = { x: this.u16(a + XPOS), y: this.u16(a + YPOS) };
              this.w16(a + XPOS, 0);
              // $70d0a does `clr.w d1` before falling into the emit, so the
              // record goes out with x = 0 on this very tick and draw.aliens
              // skips it. Emitting the old position instead showed frame 0
              // again after frame 7 - the explosion appearing to restart.
              freed = true;
            }
          }
        }
      }
      }

      // $70b74/$70b78: sprite.num 0 goes STRAIGHT to the emit. It touches
      // neither the pause counter nor the script. Letting a sprite-0 record
      // fall through to the pause branch advanced its script and cleared
      // x.pos, which killed the death explosion two ticks in.
      const dying = b[a + SPRITE] === 0;
      if (!inert && !dying && !b[a + PAUSE]) {
        const speed = b[a + SPEED];
        let tx = b[a + tbl] ?? 0, ty = b[a + tbl + 1] ?? 0;

        // $70d1c: seek modes replace the script's target with the ship's
        // position and set the other axis to -1, meaning "no target here".
        //
        // Three SEQUENTIAL btst, not a chain of else-ifs, and every one of them
        // also counts $15(a0) - SEEKCNT - down. A seek is timed, and what
        // happens when the timer runs out is different for each:
        //
        //   70d34  subq.b #1,$15(a0) / bne / bclr #$6,d6   seek.x just stops
        //   70d58  subq.b #1,$15(a0) / bne / bclr #$7,d6   seek.y just stops
        //   70d80  subq.b #1,$15(a0) / bne / bsr $71404    seek.xy EXPLODES
        //
        // The last is the kamikaze: a record that dives at the ship and blows
        // itself up when the counter expires. SEEKCNT was being written by the
        // $e7/$e8/$e9 handlers and then never read, so no seek ever ended.
        //
        // That is what stopped the game dead. A record with M_SEEKXY set also
        // carrying M_ALT feeds the ship's ABSOLUTE position into the relative
        // branch below, so it adds ~108 px a tick forever: level 4 group 5
        // record 11 reached x 15756 and stayed alive there. $3c(a5) ORs every
        // record's x together and check.path's caller ($716a8) returns early
        // while it is non-zero, so one runaway record means no wave ever spawns
        // again - the world scrolls on with nothing in it.
        let selfDestruct = false;
        if (mode & M_SEEKX) {
          tx = (shipX + 0x36) >> 1; ty = -1;
          if (--b[a + SEEKCNT] === 0) mode &= ~M_SEEKX;      // $70d3c
        }
        if (mode & M_SEEKY) {
          ty = (shipY + 0x0e) >> 1; tx = -1;
          if (--b[a + SEEKCNT] === 0) mode &= ~M_SEEKY;      // $70d60
        }
        if (mode & M_SEEKXY) {
          tx = (shipX + 0x38) >> 1; ty = (shipY + 0x10) >> 1;
          if (--b[a + SEEKCNT] === 0) {
            this.kill(a); selfDestruct = true;
            this.sfxQueue.push(0x01);                        // $71426 effect $101
          }
        }
        // $70d88 rts lands back at $70bb0 `tst.b $a(a0) / beq $70c40`, and
        // sprite.num is 0 by then, so the record does NOT move on the tick it
        // detonates - it goes straight to the emit.
        if (selfDestruct) {
          b[a + MODE] = mode;
          this.actors.push({ x, y, sprite: 0, mirror: false, anim: b[a + ANIM] });
          a += this.u16(a + NEXT);
          continue;
        }

        // $70bb8 btst #$0,d6 / bne $70c30 - mode bit 0 selects a SECOND
        // movement mode, and $e2 toggle.offset flips between them:
        //
        //   70c30  ext.w d3 / ext.w d4   ; the script bytes are SIGNED
        //   70c34  add.w d3,d1           ; x += d3, a relative step
        //   70c36  add.w d4,d2
        //   70c38  clr.b $6(a5)          ; both axes count as arrived, so the
        //   70c3c  clr.b $7(a5)          ;   script advances every tick
        //
        // Absolute waypoints and signed deltas are not interchangeable: read a
        // delta of $fc as 252 rather than -4 and the alien travels down instead
        // of up. The snake weaves in this mode, which is why it ran along y=0.
        if (mode & M_ALT) {
          const dx = tx > 127 ? tx - 256 : tx;
          const dy = ty > 127 ? ty - 256 : ty;
          x = (x + dx) | 0;
          y = (y + dy) | 0;
          this.w16(a + XPOS, x & 0xffff);
          this.w16(a + YPOS, y & 0xffff);
          mode = this.advance(a, mode);          // arrives every tick
          b[a + MODE] = mode;
          this.actors.push({ x, y, sprite: b[a + SPRITE] & 0x7f,
                             mirror: (b[a + SPRITE] & 0x80) !== 0,
                             anim: b[a + ANIM] });
          a += this.u16(a + NEXT);
          continue;
        }

        let movingX = false, movingY = false;
        if (tx >= 0) {
          const t = tx << 1;
          if (x !== t) {
            movingX = true;
            x = x > t ? Math.max(t, x - speed) : Math.min(t, x + speed);
            if (x === t) movingX = false;
          }
        }
        if (ty >= 0) {
          const t = ty << 1;
          if (y !== t) {
            movingY = true;
            y = y > t ? Math.max(t, y - speed) : Math.min(t, y + speed);
            if (y === t) movingY = false;
          }
        }
        this.w16(a + XPOS, x & 0xffff);
        this.w16(a + YPOS, y & 0xffff);

        // $70c50/$70c54: once BOTH axes have arrived, a seek.xy record does not
        // advance its script - it detonates. That is the kamikaze's other end,
        // the one where it actually reaches you.
        //
        //   70c50  bne $70cec        ; still moving, end the tick
        //   70c54  btst #$5,d6
        //   70c5c  bsr $71404        ; arrived AND seeking -> explode
        //   70c64  ...               ; arrived otherwise -> advance the script
        if (!movingX && !movingY) {
          if (mode & M_SEEKXY) { this.kill(a); this.sfxQueue.push(0x01); }
          else if (mode & M_SEEKING) {
            // $70c64-$70c78: seek.mode does not advance after its first
            // interception. Each arrival rewrites the CURRENT target to the
            // ship's latest position and consumes one repeat. Only the final
            // arrival clears bit 1 and resumes the script after that target.
            b[a + tbl] = ((this.shipX + 0x36) >> 1) & 0xff;
            b[a + tbl + 1] = ((this.shipY + 0x0e) >> 1) & 0xff;
            b[a + SEEKCNT] = (b[a + SEEKCNT] - 1) & 0xff;
            if (b[a + SEEKCNT] === 0) {
              mode &= ~M_SEEKING;
              mode = this.advance(a, mode);
            }
          } else mode = this.advance(a, mode);
        }
      } else if (!inert && !dying && b[a + PAUSE] && b[a + PAUSE] !== 0xff) {
        // $70b8e/$70b92: count down, and on reaching zero fall into the
        // advance at $70c64.
        if (--b[a + PAUSE] === 0) mode = this.advance(a, mode);
      }

      b[a + MODE] = mode;
      // Bit 7 of sprite.num is not just a tag to mask off. $70f70 does
      // `bclr #$7,d1 / sne $17(a5)`, and $70a64 uses that flag to negate the
      // blitter's C and D modulos and add $8fc to the source - the alien is
      // drawn MIRRORED. The emulator's render list shows sprites $8a-$8d in
      // level 1, which are 10-13 with the bit set, so a wave really does mix
      // mirrored and unmirrored copies of the same artwork.
      this.actors.push({ x: (inert || freed) ? 0 : x, y: (inert || freed) ? 0 : y,
                         sprite: b[a + SPRITE] & 0x7f,
                         mirror: (b[a + SPRITE] & 0x80) !== 0,
                         anim: b[a + ANIM] });
      // $70d00 adda.w $0(a0),a0 - and next.path really can be 0, which parks
      // the loop on the same record for its remaining dbra iterations. That is
      // harmless because such a record is inert, and substituting a default
      // stride would walk into bytes the original never reads.
      a += this.u16(a + NEXT);
      // and nothing else. The original is a bare `dbra d7` over twelve records
      // with no early exit, so a record whose next.path is 0 simply parks the
      // pointer and gets emitted again for the iterations that are left. The
      // break that used to be here tested the record BEFORE the advance for
      // inertness against the NEXT one's next.path, which stopped the loop one
      // record early: level 4's second group ends with six inert projectile
      // records and then its vulnerable core, and the core was dropped from the
      // render list until those projectiles woke up - a hole in the middle of
      // the creature and a piece that wandered in a hundred ticks late.
    }
    return this.actors;
  }

  // Shot against alien, from $71330.
  //
  //   71352  subi.w #$10,d4    ; alien x - 16
  //   71356  cmp.w d4,d1 / blt ; miss to the left
  //   7135c  addi.w #$20,d4    ; alien x + 16
  //   71360  cmp.w d4,d1 / bgt ; miss to the right
  //   71366  move.w $4(a0),d4  ; alien y
  //   7136a  cmp.w d4,d2 / blt ; miss above
  //   71370  addi.w #$18,d4    ; alien y + 24
  //   71374  cmp.w d4,d2 / bgt ; miss below
  //
  // So the box is 32 wide CENTRED on x and 24 tall measured DOWN from y - the
  // alien frame size, but anchored differently on each axis. Guessing a
  // symmetric box would make every alien harder to hit from above than below.
  //
  // $13(a0) is hits.num. Bit 7 set means indestructible ($7137a btst #$7), and
  // it is tested before the decrement, so such an alien absorbs shots without
  // ever counting down. A non-fatal hit plays effect $06 on channel 1
  // ($71396 move.w #$106,d0 / jsr $6ffe0).
  //
  // `overlaps`, when supplied, is the $71474 pixel gate. The record box still
  // selects what was hit, but transparent artwork inside that box must not be
  // allowed to consume a shot or decrement its hit count.
  // Returns null for a miss, else {killed, sprite}.
  hitTest(sx, sy, overlaps = null) {
    const b = this.buf;
    if (!b) return null;
    let a = 0;
    for (let rec = 0; rec < 12; rec++) {
      if (a + REC > b.length) break;
      const spr = b[a + SPRITE], ax = this.u16(a + XPOS);
      if (!spr || !ax) { const n = this.u16(a + NEXT); if (!n) break; a += n; continue; }
      const ay = this.u16(a + YPOS);
      if (sx >= ax - 16 && sx <= ax + 16 && sy >= ay && sy <= ay + 24) {
        const target = { x: ax, y: ay, sprite: spr & 0x7f, raw: spr,
                         anim: b[a + ANIM], mirror: (spr & 0x80) !== 0 };
        if (overlaps && !overlaps(target)) {
          const n = this.u16(a + NEXT);
          if (!n) break;
          a += n;
          continue;
        }
        this.lastHit = rec;
        // $7137a btst #$7,$13(a0) / bne $71400 skips EVERYTHING for an
        // indestructible record - the $7138a seq included - so hitting one
        // neither arms the flash nor disarms it.
        // A mine is shared sprite slot 2. Some projectile templates carry
        // $80 while dormant, but once visible they must remain shootable; a
        // literal application of the generic indestructible flag made those
        // mines absorb every player shot forever.
        const sprite = spr & 0x7f;
        if ((b[a + HITS] & 0x80) && sprite !== 2)
          return { killed: false, armored: true, sprite, raw: spr,
                   invulnerable: true, x: ax, y: ay };
        if (sprite === 2 && (b[a + HITS] & 0x80)) b[a + HITS] = 1;
        const left = --b[a + HITS];
        if (left === 0) {
          this.kill(a);
          // kills.what, the word at record+6, is a BITMASK of which other
          // records die with this one ($713be..$713e8) - that is how a
          // multi-part creature goes up as a unit instead of leaving fragments.
          let mask = this.u16(a + KILLS), o = 0, linkedKills = 0;
          for (let k = 0; k < 12 && mask; k++) {
            if (mask & 1) { this.kill(o); linkedKills++; }
            mask >>= 1;
            const nx = this.u16(o + NEXT);
            if (!nx) break;
            o += nx;
          }
          // $71426 plays effect $01 on channel 1 as the alien dies.
          return { killed: true, linkedKills, sprite, raw: spr,
                   x: ax, y: ay, sfx: 0x01 };
        }
        // $71396 plays effect $06 on channel 1 for a hit that does not kill.
        return { killed: false, sprite: spr & 0x7f, raw: spr, x: ax, y: ay, sfx: 0x06 };
      }
      const n = this.u16(a + NEXT);
      if (!n) break;
      a += n;
    }
    return null;
  }

  // $71404. A killed alien is NOT removed: sprite.num becomes 0, which is
  // slot 0 - explosion1 - and it plays that as an eight-frame animation in
  // place. The slot is freed only when the animation runs out ($70b5c), and
  // that is also the moment the bonus spawn position is recorded.
  //
  // Reading sprite.num 0 as "an inert placeholder" is why nothing exploded.
  kill(a) {
    const b = this.buf;
    if (a + REC > b.length) return;
    b[a + ANIM] = 0;                             // $71404
    b[a + SPRITE] = 0;                           // $71408 - the explosion
    b[a + NANIM] = 7;                            // $7140c
    b[a + ADELAY] = 2;                           // $71412
    b[a + ADELAY2] = 2;                          // $71418
    b[a + MODE] &= ~M_ANIMPP;                    // $7141e
  }

  // $717ca, the guardian gate's timer cleanup. `$6a(a5)` counts down while
  // $10(a5) is 1 and, when it reaches zero, this runs INSTEAD of check.path:
  //
  //   0717d0  adda.w $0(a0),a0     ; step once - so this starts at record 1
  //   0717d4  tst.b $a(a0) / beq   ; already an explosion? -> the second branch
  //   0717dc  moveq #$a,d7         ; eleven records
  //   0717de  bsr $71404           ; explode it, effect $101 and all
  //   0717ec  dbra d7,$717de
  //   0717f2  tst.w $2(a0) / bne   ; still alive -> wait
  //
  // Record 0 - the eye - is deliberately skipped: the timer clears away the
  // gate's projectiles and leaves the thing you have to shoot.
  gateCleanup() {
    const b = this.buf;
    if (!b) return 'none';
    let a = this.u16(NEXT);                     // $717d0
    if (a + REC > b.length) return 'none';
    if (b[a + SPRITE]) {                        // $717d4
      for (let i = 0; i <= 10; i++) {           // $717dc moveq #$a,d7
        this.kill(a);
        this.sfxQueue.push(0x01);               // $71426, through $71404
        const n = this.u16(a + NEXT);           // $717e2
        if (!n) break;
        a += n;
        if (a + REC > b.length) break;
      }
      return 'killed';
    }
    return this.u16(a + XPOS) ? 'waiting' : 'done';   // $717f2
  }

  // $70c7c: step two bytes; a zero word ends the script, a byte with high
  // nibble $E dispatches through the vector table at $70cac.
  //
  // Where each handler branches back to matters, and is the part a guess would
  // get wrong. Most end `bra $70c64`, which rejoins just before the two-byte
  // step, so they advance normally. $e7/$e8/$ea go straight to $70c7c. $e1
  // (when it loops) and $e5 go to $70cec, which ends the tick WITHOUT
  // advancing - stepping anyway would skip a pair every time.
  //
  // Handlers that take an extra pair do their own `addq.w #2,d0` first, so the
  // extra bytes are consumed by moving tbl, never by a separate skip.
  advance(a, mode) {
    const b = this.buf;
    let tbl = this.u16(a + TBL) + 2;
    this.w16(a + TBL, tbl);

    for (;;) {
      if (((b[a + tbl] << 8) | b[a + tbl + 1]) === 0) {
        this.w16(a + XPOS, 0);                   // $70d0c - the slot dies
        this.bonusBlocked = !(mode & M_ENDFLAG); // $70d10 btst / $70d14 seq
        return mode;
      }
      const c = b[a + tbl];
      if ((c & 0xf0) !== 0xe0) return mode;

      let step = true;                           // false = $70cec, end the tick
      switch (c & 0x0f) {
        case 0x0:                                // $e0 init.pause, $70d8e
          // `bra $70cec` - ends the tick WITHOUT advancing. tbl stays on this
          // pair, and the advance happens when the pause expires ($70b92 beq
          // $70c64). Advancing here instead runs straight past the pair that
          // follows: in level 1 group 1 that is $e6 reload.coords, which holds
          // the real spawn position, so the aliens never left (2,0).
          b[a + PAUSE] = b[a + tbl + 1];
          step = false;
          break;
        case 0x1: {                              // $e1 loop.back, $70d98
          const back = b[a + LOOPOFF] << 1;
          if (--b[a + LOOPCNT] !== 0) { tbl -= back; step = false; }
          break;
        }
        case 0x2:                                // $e2 toggle.offset
          mode ^= M_ALT;
          break;
        case 0x3:                                // $e3 change.speed
          b[a + SPEED] = b[a + tbl + 1];
          break;
        case 0x4:                                // $e4 change.sprite, $70e20
          tbl += 2;
          b[a + SPRITE] = b[a + tbl];
          b[a + NANIM] = b[a + tbl + 1];
          b[a + ANIM] = 0;
          b[a + ADELAY] = b[a + ADELAY2];
          break;
        case 0x5:                                // $e5 seek.mode, $70db8
          // $70dc8 calls $70df8, which writes the SHIP's position into the
          // script pair itself:
          //   70e00  addi.w #$36,d3 / lsr.w #1,d3   ; (shipX + 54) / 2
          //   70e04  addi.w #$e,d4  / lsr.w #1,d4   ; (shipY + 14) / 2
          //   70e0c  move.b d3,$0(a0,d0.w)          ; overwrite X
          //   70e10  move.b d4,$1(a0,d0.w)          ; overwrite Y
          // So the next waypoint becomes wherever the player is. Setting the
          // flag without doing this leaves the alien walking its canned path,
          // which is why some that should home did not.
          mode |= M_SEEKING;
          b[a + SEEKCNT] = b[a + tbl + 1];
          tbl += 2;
          b[a + tbl] = ((this.shipX + 0x36) >> 1) & 0xff;
          b[a + tbl + 1] = ((this.shipY + 0x0e) >> 1) & 0xff;
          step = false;
          break;
        case 0x6:                                // $e6 reload.coords, $70e3c
          tbl += 2;
          this.w16(a + XPOS, b[a + tbl] << 1);
          this.w16(a + YPOS, b[a + tbl + 1] << 1);
          break;
        case 0x7: {                              // $e7 new.table, $70e5a
          tbl += 2;
          b[a + LOOPOFF] = (tbl >> 8) & 0xff;    // the return offset, split
          b[a + LOOPCNT] = tbl & 0xff;
          tbl = this.u16(a + tbl) - 2;
          break;
        }
        case 0x8:                                // $e8 restore.offset, $70e72
          // $e7 saves an offset pointing AT its own operand pair, and $e8 ends
          // `bra $70c7c`, which adds 2 - so it resumes just PAST the operand.
          // Subtracting 2 here first landed back ON the operand, and level 1's
          // group 5 then read `01 b8` as a waypoint of (2, 368) and flew off
          // the bottom of the screen.
          tbl = ((b[a + LOOPOFF] << 8) | b[a + LOOPCNT]);
          break;
        case 0xa:                                // $ea change.anim
          b[a + ANIM] = b[a + tbl + 1];
          break;
        case 0xb:                                // $eb restart.table
          tbl = 0x14 - 2;
          break;
        case 0xc: {                              // $ec start.xy, $70ee6
          // Copies THIS alien's position into another record, identified by
          // index in the pair's second byte. It is the spawner: without it a
          // record keeps whatever template position it was packed with, which
          // is why several waves appeared in the wrong place.
          //
          //   70ee6  move.b $1(a0,d0.w),d4   ; target record index
          //   70eea  subq.b #2,d4
          //   70ef4  adda.w $0(a0),a0        ; walk next.path d4+1 times
          //   70efc  move.w d1,$2(a0)        ; x
          //   70f00  move.w d2,$4(a0)        ; y
          //   70f08  move.b d4,$16(a0)       ; and the halved position into
          //   70f10  move.b d4,$17(a0)       ; mode / loop.offset
          let t = b[a + tbl + 1] - 2, o = 0;
          for (let k = 0; k <= t; k++) {
            const nx = this.u16(o + NEXT);
            if (!nx || o + REC > b.length) break;
            o += nx;
          }
          if (o + REC <= b.length) {
            const px = this.u16(a + XPOS), py = this.u16(a + YPOS);
            this.w16(o + XPOS, px);              // $70efc
            this.w16(o + YPOS, py);              // $70f00
            // $70f08 and $70f10 write to $16(a0) and $17(a0) - bytes 22 and 23,
            // NOT 16 and 17. $8(a0) is set to $16 two instructions later, so
            // those two bytes ARE the script's first waypoint: the projectile's
            // first target is its own spawn position, which is what stops it
            // jumping somewhere before its script has said anything.
            //
            // Written to bytes 16 and 17 instead they land on mode and
            // loop.offset. A halved x with bit 0 set turns on M_ALT, which puts
            // the record into delta mode, and it then accumulates a step every
            // tick forever - the creature's shots ran to y 2800 and off the
            // bottom of the world.
            b[o + REC] = (px >> 1) & 0xff;       // $70f08, $16(a0) = byte 22
            b[o + REC + 1] = (py >> 1) & 0xff;   // $70f10, $17(a0) = byte 23
            // The rest of $70ee6, and leaving it out is what made spawned
            // waves start mid-script in the wrong place:
            this.w16(o + TBL, 0x16);             // $70f14 - RESTART the script
            b[o + HITS] = 0x80;                  // $70f1a - indestructible
            b[o + ADELAY] = 2;                   // $70f20
            b[o + PAUSE] = 0;                    // $70f26
            b[o + ANIM] = 0;                     // $70f2a
          }
          break;
        }
        case 0xd:                                // $ed start.seekx, $70dd0
          mode |= M_SEEKX;
          b[a + SEEKCNT] = b[a + tbl + 1];
          tbl += 2;
          step = false;                          // bra $70cec
          break;
        case 0xe:                                // $ee start.seeky, $70de4
          mode |= M_SEEKY;
          b[a + SEEKCNT] = b[a + tbl + 1];
          tbl += 2;
          step = false;
          break;
        case 0x9: {                              // $e9 fire.projectile, $70e80
          // Not a new object - it ARMS one the group already carries. The
          // handler scans all twelve records of the working copy looking for
          // one whose mode has bit 5 (M_SEEKXY) set and whose x.pos is still
          // zero, then drops it at the firing alien's position:
          //
          //   70e86  moveq #$b,d5             ; twelve records
          //   70e8a  btst #$5,$10(a2)         ; mode bit 5 - a seeker
          //   70e94  tst.w $2(a2) / bne       ; x.pos 0 - not already out
          //   70e9c  move.w d1,$2(a2)         ; the firer's x
          //   70ea0  move.w d2,$4(a2)         ; and y
          //   70ea4  move.b $0(a0,d0.w),$15(a2)   ; operand -> seek.count
          //   70eaa  move.b $1(a0,d0.w),$13(a2)   ; operand -> anim.delay2
          //   70eb0  move.b #$2,$a(a2)        ; sprite.num 2
          //   70eb6  move.b #$2,$c(a2)        ; anim.delay
          //   70ebc  clr.b $b(a2)             ; anim frame 0
          //   70ec0  move.b #$3,$14(a2)       ; three frames
          //   70ec6  bra $70c7c               ; then advance past the pair
          //
          // Every free seeker is left alone once one is armed - the loop bails
          // out through $70c7c on the first match. If none is free the alien
          // fires nothing and the script still advances, which is why a wave
          // that has already emptied its magazine simply stops shooting.
          const px = this.u16(a + XPOS), py = this.u16(a + YPOS);
          let o = 0;
          for (let k = 0; k < 12 && o + REC <= b.length; k++) {
            if ((b[o + MODE] & M_SEEKXY) && !this.u16(o + XPOS)) {
              this.w16(o + XPOS, px);
              this.w16(o + YPOS, py);
              // $70e88 advances d0 by 2 BEFORE these reads, so the operands
              // are the pair AFTER the opcode's own - $e9 consumes four bytes,
              // not two. Reading the opcode pair's second byte instead is the
              // same off-by-one that made $e8 resume on its own operand.
              b[o + SEEKCNT] = b[a + tbl + 2];     // $70ea4, $15(a2) = byte 21
              // $70eaa writes $13(a2), which is byte 19 - the HIT COUNT, not
              // anim.delay2 at 13. The same hex-for-decimal slip as $70f08.
              b[o + HITS] = b[a + tbl + 3];        // $70eaa, $13(a2) = byte 19
              b[o + SPRITE] = 2;
              b[o + ADELAY] = 2;
              b[o + ANIM] = 0;
              b[o + NANIM] = 3;
              break;
            }
            const nx = this.u16(o + NEXT);
            if (!nx) break;
            o += nx;
          }
          tbl += 2;                                // $70e88 addq.w #2,d0
          break;
        }
        default: {                               // nothing left unimplemented
          const n = this.unimplemented.get(c & 0x0f) || 0;
          this.unimplemented.set(c & 0x0f, n + 1);
          break;
        }
      }

      this.w16(a + TBL, tbl);
      if (!step) return mode;
      tbl += 2;
      this.w16(a + TBL, tbl);
    }
  }
}
