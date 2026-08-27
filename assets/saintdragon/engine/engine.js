'use strict';
// Saint Dragon object engine, transcribed from the 68k disassembly.
//
// Objects are coroutines. Each behaviour is a generator that sets up fields
// and then yields through primitives that hand control back to the scheduler,
// which is exactly how the original works ($7ec6 terminates, $7d98 yields one
// frame). Field names follow OBJECTMODEL.md so the two can be read together.

const ANGLE_STEPS = 256;                 // 256 units = 360 degrees
const DEATH_CARD_FRAMES = 48;
const DEATH_LIVES_FRAMES = 50;

// Direction -> sprite handle, from the 16-entry table at $642c.
const DIR_FRAMES = [
  0x4804, 0x4a04, 0x4c04, 0x4e04, 0x5004, 0x5204, 0x5404, 0x5604,
  0x5804, 0x5a04, 0x5c04, 0x5e04, 0x4004, 0x4204, 0x4404, 0x4604,
];

function sin256(a) { return Math.sin((a & 255) * 2 * Math.PI / ANGLE_STEPS); }
function cos256(a) { return Math.cos((a & 255) * 2 * Math.PI / ANGLE_STEPS); }

class World {
  constructor(gfx) {
    this.stuckObjects = 0;   // objects motionless past STILL_LIMIT, reported not culled
    this.gfx = gfx;
    this.objects = [];
    this.generation = 1;      // $e6(a6): bump to kill every live object at once
    // Two spawn budgets, both pools of 10, consumed on spawn and returned on
    // death. $06774/$06852 refuse to spawn while $f0 >= 10; stream children
    // terminate immediately when $a0 is exhausted ($0a1ec: tst.w; ble $7ec6).
    // Without these the port over-spawns in dense sections.
    this.projectiles = 0;        // $f0(a6): live enemy projectiles, capped at 10
    this.enemyCount = 0;         // informational only; the game has no such count
    this.streamBudget = ENEMY_POOL;   // $a0(a6), set to $a at $1966
    this.groupBudget = 0;        // $a2(a6): a third pool, capped at 6 ($b860)
    this.score = 0;           // $166(a6)
    this.lives = 5;           // $9e(a6), set by $00c36
    this.gameOver = false;
    this.freezeCount = 0;     // $104(a6), a refcount shared by death and bosses
    this.deathSequence = null;
    this.deathPresentation = null;
    this.godMode = false;     // engine-test override; normal gameplay stays faithful
    this.input = 0;           // the joystick mask $96(a5) is built from
    this.shotDamageLo = 0x10;  // $176(a6), fixed at 16 by $05250
    this.shotDamageHi = 17;    // $17c(a6), $5e64[level 0][index 1] at stage start
    this.weaponIndex = 1;      // $178(a6), set by $05214
    this.weaponLevel = 0;      // $17e(a6)
    this.initShotGrid();
    this.collisions = 0;
    this.player = null;       // $13e(a6)
    this.frame = 0;
    this._lastSound = null;
    // The dragon's tail: a 64-entry ring of (x, y) that the head writes and the
    // body segments read at a fixed offset behind it ($5adc, indexed by $5ac8).
    // $92 on the player is a 16.16 index advanced by speed<<7 each frame, so at
    // the player's speed of $200 that is exactly one slot per frame.
    this.trail = new Array(64).fill(null).map(() => ({ x: 0, y: 0 }));
    this.trailIndex = 0;                    // the player's $92, fractional
    this.trailHead = 0;                     // its integer part
    // The game indexes a CHAIN as a single object: a handle's index counts
    // chain heads, not atlas entries. Res 55 has 18 atlas objects but only 10
    // game objects (7 singles + 3 chains), and the code only ever names 0-9.
    // Indexing by atlas position lands mid-chain and draws a fragment -- 30 of
    // the resources are affected.
    this.byHandle = new Map();
    const perRes = new Map();
    this.atlasByRes = new Map();
    for (const it of gfx.sprites.items) {
      if (!perRes.has(it.res)) perRes.set(it.res, []);
      perRes.get(it.res).push(it);
    }
    for (const [res, list] of perRes) {
      list.sort((a, b) => a.index - b.index);
      let gameIndex = 0, continuation = false;
      for (const it of list) {
        if (!continuation) this.byHandle.set((gameIndex++ << 9) | res, it);
        continuation = !!(it.flags & 1);
      }
      this.atlasByRes.set(res, list);       // atlas order, for walking chains
    }
  }

  get lastSound() { return this._lastSound; }
  set lastSound(id) { this.playSound(id); }

  // $69b6: gameplay routines request effects by their original resource id.
  // The renderer owns the audio backend; keeping this hook here leaves the
  // simulation deterministic in headless audits while making every decoded
  // lastSound write audible in the browser.
  playSound(id, rate, volume) {
    this._lastSound = id;
    if (this.onSound) this.onSound(id, rate, volume);
  }

  acquireFreeze() { this.freezeCount++; }
  releaseFreeze() { this.freezeCount = Math.max(0, this.freezeCount - 1); }
  get frozen() { return this.freezeCount > 0; }
  set frozen(value) { this.freezeCount = value ? Math.max(1, this.freezeCount) : 0; }

  // $80e4: the spawn primitive writes the PARENT (a5) into the child's $5c, so
  // Every spawned object carries an owner link at $5c. What that link MEANS is
  // narrower than it looks, and $7ec6 is where the difference lives: when an
  // object terminates it clears the owner pointer of its RETAINED child only --
  // the single one held at $60 by $80d0 -- and clears its own owner's $60 in
  // turn. It does not touch the children it spawned through $80fe or $80a8.
  //
  //   $7ece  move.l $60(a5),d0 / clr.l $5c(a0)     retained child loses its owner
  //   $7eda  move.l $5c(a5),d0 / clr.l $60(a0)     owner loses its retained child
  //
  // So "die with your owner" is a one-to-one pairing, not something a whole
  // formation inherits. $9c28 tests `tst.l $5c` -- a NULL pointer, not a dead
  // object -- and only a retained child ever sees that null.
  spawnChildOf(owner, behaviour, init) {
    const o = this.spawn(behaviour, init);
    o.owner = owner;                             // $5c(a5)
    return o;
  }

  // $80d0: spawn and retain at $60. Only this pairing propagates death.
  spawnRetained(owner, behaviour, init) {
    const o = this.spawnChildOf(owner, behaviour, init);
    owner.retained = o;                          // $60(a5)
    return o;
  }

  // $7ec6's link teardown, run when an object terminates.
  releaseLinks(o) {
    if (o.retained) { o.retained.owner = null; o.retained = null; }   // $7ed6
    if (o.owner && o.owner.retained === o) o.owner.retained = null;   // $7ee2
  }

  spawn(behaviour, init) {                       // $80fe
    const o = new GameObject(this);
    Object.assign(o, init || {});
    o.co = behaviour(o, this);
    this.objects.push(o);
    o.__born = this.frame;
    if (this.trace) this.trace.push({ ev: 'born', o, frame: this.frame });
    return o;
  }

  // $5ac8: (player index + segment offset) * 8, wrapped into the ring.
  // The spawner steps $13c(a6) by -6 per segment, so offsets are NEGATIVE and
  // read behind the write head. A positive offset reads 64-n frames ago and
  // inverts the chain, putting the tail end nearest the head.
  trailAt(offset) { return this.trail[(this.trailHead + offset) & 63]; }

  // One frame: step every coroutine, then integrate positions.
  // $8480-$84b6: the wave scheduler. The cursor walks 6-byte records; each
  // fires when the scroll distance reaches its trigger ($850e compares
  // $d58(a6) against the record's +2 field), then the cursor advances. Records
  // are in ascending trigger order, and equal triggers spawn together.
  // $2152: the ground level comes from the stage descriptor's +$10 and lands in
  // $6a(a6). Per stage: 162, 158, 158, 166, 166. Objects that stand on the
  // ground read it directly rather than carrying a lane.
  setGround(y) { this.ground = y; }
  // $68(a6): the ceiling level, stage descriptor +$e -- counterpart to $6a.
  setCeiling(y) { this.ceiling = y; }

  loadWaves(waves, stage) {
    this.stage = String(stage);
    const sc = waves[stage];
    this.waveRecords = sc ? sc.entries : [];
    // Record 0 FIRES. $8424 is not a stage-start skip -- it is the tail of
    // $08406, the checkpoint routine, where `$c86 = the marker's own record + 6`
    // means "resume just past the marker". Stage start is $00e50, which clears
    // the four checkpoint globals and sets `$c86 = $a(a0)` from the stage
    // descriptor, with no offset at all.
    //
    // Starting at 1 dropped the trigger-0 record of every stage: the opening
    // hill and its res 7 walker in stage 1, and $04fb0 in stages 2 through 5 --
    // which is the entire reason $04fb0 was "the one silent handler in the game".
    this.waveCursor = 0;           // $00e66
    // $847a initialises $d58 from $10a(a6) -- the scroll does NOT start at zero.
    // $8abc holds each object until scroll reaches its trigger + $348 (840), so
    // starting at 840 makes a record with trigger T enter T units into the
    // level. Starting at 0 instead left the first ~19 seconds completely empty.
    this.scroll = ENTRY_LEAD;      // $d58(a6)
    // Overridable so the pacing can be compared against the original without
    // editing code -- see the `scroll` URL parameter. $d58 is read for triggers
    // ($084f8) and by the entry gate ($08aca), and saved into the checkpoint at
    // $084f2, but NOTHING found so far advances it: the per-frame increment is
    // not at a plain $d58(a6) displacement and has not been located. SCROLL_RATE
    // is therefore still an assumption, not a transcription.
    if (this.scrollRate === undefined) this.scrollRate = SCROLL_RATE;
    this.waveFired = [];
    // Stage-end state. $0848a dispatches records until `tst.w (a1)` finds the
    // zero terminator, at which point $084b8 waits for $f8 to clear, clears $fe
    // and terminates. $00c50's own loop yields while $f8 is set. So $f8 is
    // "the player is active" -- $052e0 sets it, $053a8 clears it as the player
    // stands down and hands $13e over to its successor at $53b8.
    this.waveScriptDone = false;   // the dispatcher reached the terminator
    this.playerActive = true;      // $f8(a6)
    this.stageComplete = false;
    this.sectionCounter = 0;       // $116(a6), bumped by $083e2
    this.endOfStage = false;       // $0829e raises $26/$27 and sets $18 = 1
    this.bossSpawned = false;
    this.bossAlive = false;
    this.stageEndedWithoutBoss = false;
    this.checkpoint = {
      waveCursor: 0,
      scroll: this.scroll,
      sectionCounter: 0,
      lastPlayerHeading: this.lastPlayerHeading,
    };
  }

  // $8406 copies the marker object's stage parameter block into the restart
  // globals and stores its own record pointer + 6. In the extracted model the
  // equivalent stable values are the post-marker record index and the scroll
  // coordinate at which the marker's entry gate completes.
  saveCheckpoint(waveCursor) {
    this.checkpoint = {
      waveCursor,
      scroll: this.scroll,
      sectionCounter: this.sectionCounter,
      lastPlayerHeading: this.lastPlayerHeading,
    };
  }

  restoreCheckpoint() {
    const checkpoint = this.checkpoint;
    if (!checkpoint) return false;
    this.generation++;
    for (const o of this.objects) o.done = true;
    this.objects = [];
    this.projectiles = 0;
    this.streamBudget = ENEMY_POOL;
    this.groupBudget = 0;
    this.waveCursor = checkpoint.waveCursor;
    this.scroll = checkpoint.scroll;
    this.sectionCounter = checkpoint.sectionCounter;
    this.lastPlayerHeading = checkpoint.lastPlayerHeading;
    this.waveScriptDone = false;
    this.playerActive = false;
    this.player = null;
    this.bossSpawned = false;
    this.bossAlive = false;
    this.endOfStage = false;
    return true;
  }

  // Boss objects register as soon as they spawn, including pending entry gates
  // and successor forms, so stage completion always has a live owner.
  registerBoss(o) {
    this.bossSpawned = true;
    this.bossAlive = true;
    o.__isBoss = true;
  }

  stepWaves() {
    if (!this.waveRecords) return;
    if (this.stageComplete) return;            // $84c2: the dispatcher is gone
    this.scroll += (this.scrollRate !== undefined ? this.scrollRate : SCROLL_RATE);
    while (this.waveCursor < this.waveRecords.length) {
      const r = this.waveRecords[this.waveCursor];
      if (this.scroll < r.trigger) break;      // $8520 bge
      this.waveFired.push({ frame: this.frame, ...r });
      this.spawnWave(r, this.waveCursor);
      this.waveCursor++;                       // $84b2
    }
    // $0848e tst.w (a1) / beq $84b8 -- the record list is zero-terminated, so
    // running off the end is the same condition.
    if (this.waveCursor >= this.waveRecords.length) this.waveScriptDone = true;

    // A STAGE ENDS WHEN ITS BOSS IS DEFEATED. $08a70 is a two-phase rendezvous
    // -- raise $1a8, wait for it to clear, raise $2544, wait again -- and both
    // $00ece (end the stage) and $0ddb8 (the stage 5 boss's death) call it, so
    // the two hand off to each other. Exhausting the wave script only stops the
    // spawning; it is not the end of the stage.
    if (!this.stageComplete && this.bossSpawned && !this.bossAlive) {
      if (String(this.stage) === '5' && !this.postBossDone) {
        if (!this.postBossStarted) {
          this.postBossStarted = true;
          this.spawn(stage5DragonExit, {});             // $0dbd8, res 67
        }
      } else {
        this.completeStage();
      }
    }
    // Preserve a fallback for malformed or unsupported wave lists that do not
    // spawn a registered boss. Mark it explicitly rather than presenting that
    // route as normal boss completion.
    else if (!this.stageComplete && this.waveScriptDone && !this.bossSpawned) {
      const liveWaveObjects = this.objects.some(
        (o) => !o.done && o !== this.player && o.sprite);
      if (!liveWaveObjects || this.endOfStage) {
        this.stageEndedWithoutBoss = true;
        this.completeStage();
      }
    }
  }

  // $00ece: end the stage, and if $96 (the stage number) is 5 raise the finish
  // flag $a8, which is what $08c48 tests to play the ending.
  completeStage() {
    if (this.stageComplete) return;
    this.stageComplete = true;
    this.playerActive = false;                 // $053a8 clr.w $f8(a6)
    if (String(this.stage) === '5') this.finished = true;   // $a8(a6)
    if (this.onStageComplete) this.onStageComplete(this);
  }

  // Only a handful of the 139 handlers are transcribed; the rest are recorded
  // as fired so the timing can be verified without pretending they exist.
  spawnWave(r, waveIndex) {
    const fn = this.waveHandlers && this.waveHandlers[r.handler];
    if (!fn) { this.waveUnimplemented = (this.waveUnimplemented || 0) + 1; return; }
    // $8500 stores the record's trigger in $2c(a5); the entry gate reads it.
    if (fn) this.spawn(fn, { trigger: r.trigger, waveIndex }); // y comes from $825e
  }

  // $8a98 acquires a whole resource; the index within it is chosen by the
  // handler body. Until those are read, fall back to the resource's first
  // object so the enemy at least draws its own artwork.
  // $93e4: a composite object -- several sub-sprites attached at fixed offsets
  // from one anchor, each with its own handle and depth. Stage 1's hills and
  // trees ($9366) are 8 parts: four at the base, four at dy -61/-62 for the
  // trees standing on top. Each part still draws through its own hotspot.
  compositeFor(handlerAddr) {
    const c = this.composites && this.composites[handlerAddr];
    return c ? c.parts : null;
  }

  // Object-format flag bit 0 chains to a continuation object. All parts of a
  // chain share one anchor -- each part carries its own hotspot, stepping 32 px
  // (one slice) apart -- so drawing the chain is just drawing each part at the
  // same x/y through its own hotspot. 165 of the 685 objects are chained;
  // drawing only the head of a chain shows one slice of a wider object.
  spriteChain(h) {
    const head = this.byHandle.get(h);
    if (!head) return [];
    const list = this.atlasByRes.get(head.res) || [];
    const start = list.indexOf(head);
    if (start < 0) return [head];
    // Walk forward through ATLAS order while the previous part sets the chain
    // bit. Handles address game objects (chain = one), so the head is already
    // correct and no backward walk is needed.
    const out = [head];
    for (let k = start; k < list.length && (list[k].flags & 1); k++) {
      const next = list[k + 1];
      if (!next) break;
      out.push(next);
      if (out.length > 8) break;
    }
    return out;
  }

  // How far an object's artwork extends LEFT of its anchor. A chain's anchor
  // sits mid-object (the 7-10 hill spans anchor-71 .. anchor+57), so an object
  // placed with its anchor at the screen edge is already ~71px on screen. DDF
  // fetches 368px while DIW shows 336, so the anchor is not the visible edge.
  leftExtent(o) {
    const pieces = o.parts
      ? o.parts.map(p => ({ it: this.byHandle.get(p.handle), dx: p.dx })).filter(x => x.it)
      : this.spriteChain(o.handle).map(it => ({ it, dx: 0 }));
    if (!pieces.length) return 0;
    return Math.max(0, ...pieces.map(({ it, dx }) => it.hx - dx));
  }

  // How far the artwork extends BELOW the anchor. All parts of a chain share
  // one baseline, so this is well defined per object.
  baseOffset(o) {
    const pieces = o.parts
      ? o.parts.map(p => ({ it: this.byHandle.get(p.handle), dy: p.dy })).filter(x => x.it)
      : this.spriteChain(o.handle).map(it => ({ it, dy: 0 }));
    if (!pieces.length) return null;
    return Math.max(...pieces.map(({ it, dy }) => dy - it.hy + it.h));
  }

  firstHandleOfResource(res) {
    if (!this._byRes) {
      this._byRes = new Map();
      for (const [h, it] of this.byHandle)
        if (!this._byRes.has(it.res) || it.index < this._byRes.get(it.res).index)
          this._byRes.set(it.res, { h, index: it.index });
    }
    const e = this._byRes.get(res);
    return e && e.h;
  }

  // $7f0e: collision is an axis-aligned box test against the player, using the
  // object's own half-extents $32/$34 and an 8px bias on x (the player's
  // hotspot). A hit calls the object's $44 handler.
  //
  //   $7f0e  d0 = x - player.x - 8 ; abs ; cmp $32 ; bgt miss
  //   $7f22  d0 = y - player.y     ; abs ; cmp $34 ; bgt miss
  //   $7f34  jsr ($44)
  //
  // $7cb8 installs the extents from the sprite's asset record ($20/$22), so
  // they are per-sprite data; the allocator's default is 8x8 ($8190). Those
  // per-sprite values are NOT yet extracted, so everything uses the default.
  // $3680 builds the asset record and reads the collision extents from template
  // bytes +8/+9. Across the 565 objects whose bytes read cleanly the extents are
  // almost exactly half the sprite dimensions (median 0.50 / 0.49) -- but 200
  // objects give impossible values (x extents of 243-255 on 11px sprites), so
  // the offsets are wrong for a quarter of the set and the raw bytes cannot be
  // used as-is. Half-dimensions match what the readable majority says and are a
  // far better fit than the allocator's flat 8x8.
  extentsFor(o) {
    const s = o.sprite;
    if (!s) return { x: COLLIDE_DEFAULT, y: COLLIDE_DEFAULT };
    // Real per-object values where they read sanely (508 of 530 chain heads).
    // The odd ones -- and every continuation, whose bytes the game never reads
    // because a handle only ever names a head -- fall back to half-dimensions,
    // which is what the readable set works out to (median 0.50 / 0.49).
    if (s.bx !== undefined && s.bx <= s.w * 2 && s.by <= s.h * 2)
      return { x: s.bx, y: s.by };
    return { x: Math.max(4, s.w >> 1), y: Math.max(4, s.h >> 1) };
  }

  hitsPlayer(o) {
    const p = this.player;
    if (!p || !o.collides) return false;
    const e = this.extentsFor(o);
    if (Math.abs(o.x - p.x - COLLIDE_BIAS_X) > (o.boxX ?? e.x)) return false;
    if (Math.abs(o.y - p.y) > (o.boxY ?? e.y)) return false;
    return true;
  }

  // $7d1a: apply damage; on death award $2e to the score at $166(a6).
  damage(o, amount) {
    // $098f6: a boss segment installs its own $48 which does
    // `sub.w d0,$36(a0)` -- the damage lands on the OWNER, not on the part that
    // was hit. Without this a segment soaks shots that should be killing the
    // boss, and its own hit points are overwritten from the owner every frame
    // anyway ($9824), so the shots simply vanished.
    if (o.__damageTo && !o.__damageTo.done) {
      // $098f6 does `sub.w d0,$36(a0)` -- it writes the owner's hit points
      // DIRECTLY and never goes through the owner's own $48. That matters here:
      // the stage 1 boss disables its $48 at $094cc, so routing this back
      // through damage() would hit the invulnerability guard below and make the
      // boss unkillable. Segments are the only way to hurt it, by design.
      return this.applyDamage(o.__damageTo, amount);
    }
    // $051c2: the weapon capsule's $48 does NOT subtract hit points. It disables
    // further damage, plays $45, and hands control to the routine in $92 --
    // the capsule opens rather than dying.
    if (o.__onShot) { o.__onShot(o, amount, this); return false; }
    // Some objects install a $48 that does nothing at all. $06772 is a bare
    // `rts`, and $0925e puts it in the hill's $48 -- so the mounds cannot be
    // shot away, however long you fire at them. The flag was being set on the
    // tree segments too ($9b5c writes $ff to both $48 and $4c) and honoured
    // nowhere, so everything that should have been scenery was destructible.
    if (o.__invulnerable) return false;
    const killed = this.applyDamage(o, amount);
    if (o.__afterDamage) o.__afterDamage(o, amount, killed, this);
    return killed;
  }

  // $07f3c dispatches $4c, not the shot handler at $48. Most objects leave
  // $4c at the allocator's plain $7d1a; a few explicitly redirect it.
  damageBody(o, amount) {
    if (o.__bodyInvulnerable || o.__invulnerable) return false;
    if (o.__bodyDamageTo && !o.__bodyDamageTo.done)
      return this.applyDamage(o.__bodyDamageTo, amount);
    if (o.__onBodyHit) return o.__onBodyHit(o, amount, this);
    return this.applyDamage(o, amount);
  }

  // The hit points themselves, with no handler in front of them.
  applyDamage(o, amount) {
    if (o.__lethalStarted) return false;
    o.hp -= amount;                       // $36
    if (o.hp > 0) {
      o.hitFlash = 0x10;                  // $66 = 16 frames
      o.damageCooldown = 2;               // $3a = 2, blocks $48/$4c for two frames
      return false;
    }
    // Bosses whose original routines continue after hp reaches zero need to
    // remain scheduled until their teardown coroutine finishes.
    if (o.__onLethal && !o.__lethalStarted) {
      o.__lethalStarted = true;
      o.__onLethal(o, this);
      return true;
    }
    this.score += o.scoreAward || 0;      // $166(a6)
    if (o.__onDeath) o.__onDeath(o, this);
    else if (this.onDeath) this.onDeath(o);    // $08746, the paired explosion
    o.done = true;
    this.releaseLinks(o);                      // $7ec6 clears retained $5c/$60
    return true;
  }

  // $7d06: a hit clears the player's $36 outright UNLESS $3a is still running.
  // The cooldown is the invulnerability, and $170 covers arrival, so there are
  // no player hit points -- one touch is fatal.
  hitPlayer() {
    const p = this.player;
    if (!p || p.done) return;
    if (this.godMode) return;
    if (p.grace > 0 || p.hitCooldown > 0) return;   // $170 / $3a
    p.hp = 0;            // $7d0c clr.w $36(a4); the player's own loop notices
  }

  setGodMode(enabled) {
    this.godMode = !!enabled;
    return this.godMode;
  }

  increaseWeaponLevel() {
    this.pickupLevel = Math.min(4, (this.pickupLevel || 0) + 1);  // $172: green fan
    this.weaponLevel = Math.min(2, (this.weaponLevel || 0) + 1);  // $17e: secondary tier
    this.setWeapon(this.weaponIndex, this.weaponLevel);
    return { spread: this.pickupLevel, secondary: this.weaponLevel };
  }

  cycleWeaponType() {
    this.setWeapon(((this.weaponIndex || 0) + 1) & 3, this.weaponLevel || 0);
    return this.weaponIndex;
  }

  // $04c32-$0512e: each revealed res-3 capsule installs its own collection
  // handler. They share sound $47 and $7d40 removal, but not their effect.
  collectPickup(o, effect = { kind: 'spread' }) {
    const player = this.player;
    switch (effect.kind) {
      case 'speed':                                               // $04c32
        if (player) player.speed = Math.min(0x400, (player.speed || 0x200) + 0x80);
        break;
      case 'weapon': {                                            // $04cf2-$04dca
        const index = effect.index & 3;
        if (index === this.weaponIndex) this.weaponLevel = Math.min(2, this.weaponLevel + 1);
        this.setWeapon(index, this.weaponLevel);
        break;
      }
      case 'weaponLevel':                                         // $04e4c
        this.weaponLevel = Math.min(2, this.weaponLevel + 1);
        this.setWeapon(this.weaponIndex, this.weaponLevel);
        break;
      case 'life':                                                // $04eb6-$04f96
        this.lives += effect.amount;
        break;
      case 'fullPower':                                           // $04fcc
        if (player) {
          player.hitCooldown = Math.max(player.hitCooldown || 0, 0x3a98);
          player.hitFlash = Math.max(player.hitFlash || 0, 0x3a98); // $66(a4)
        }
        this.pickupLevel = 4;
        this.setWeapon(1, 2);
        break;
      case 'invulnerability':                                     // $0512e
        if (player) {
          player.hitCooldown = Math.max(player.hitCooldown || 0, 0x190);
          player.hitFlash = Math.max(player.hitFlash || 0, 0x190); // $66(a4)
        }
        break;
      default:                                                    // $04ca2 / $0508c
        this.pickupLevel = Math.min(4, (this.pickupLevel || 0) + 1);
        break;
    }
    this.playSound(0x47);
    o.done = true;                                                // $7d40
  }

  // $00f0a: the player-local $5350 death has completed. Spend the life, freeze
  // the stage, show the lives/death presentation, restore $8406, downgrade one
  // step through $508c/$509a, then thaw and hand control to the new player.
  playerDied() {
    if (this.deathSequence) return;
    this.lives = Math.max(0, this.lives - 1);        // the $9e spend before $f0a
    if (!this.lives) {
      this.gameOver = true;
      this.deathPresentation = null;
      return;
    }
    this.acquireFreeze();                            // $f26 addq.w #1,$104
    this.deathSequence = { phase: 'card', frames: DEATH_CARD_FRAMES };
    this.deathPresentation = { phase: 'card', lives: this.lives };
  }

  stepDeathSequence() {
    const death = this.deathSequence;
    if (!death) return false;
    if (--death.frames > 0) return true;
    if (death.phase === 'card') {
      death.phase = 'lives';
      death.frames = DEATH_LIVES_FRAMES;
      this.deathPresentation.phase = 'lives';
      return true;
    }
    this.restoreCheckpoint();                       // $8406 restart globals
    this.pickupLevel = Math.max(0, (this.pickupLevel || 0) - 1);   // $508c
    this.weaponLevel = Math.max(0, (this.weaponLevel || 0) - 1);   // $509a
    this.setWeapon(this.weaponIndex, this.weaponLevel);
    this.deathSequence = null;
    this.deathPresentation = null;
    this.releaseFreeze();                            // $f84 subq.w #1,$104
    if (this.onRespawn) this.onRespawn(this);
    return true;
  }


  // ---------------------------------------------------------------------
  // SHOT COLLISION: the bit grid, not a box test.
  //
  // $c7a points at two 256-byte grids, +0 and +$100. Each is 64 columns by 32
  // rows, one bit per 8x8 pixel cell over 512x256. $08692 flips which pair is
  // live every frame ($c58 alternates $1cde and $1ede) and clears both, so one
  // is written while the other is read.
  //
  // $06230 maps a position into it:
  //   row  = ((y + $1c) >> 3) * 8      byte = ((x + $58) >> 3) >> 3
  //   bit  = ~((x + $58) >> 3) & 7     out of range past $200 / $100
  //
  // A shot sets its bit ($06192 `bset d0,$100(a0)`). An enemy ($07f8a) walks
  // its own cell footprint, ANDs the width mask from $8014 against each row,
  // EORs the matching bits away -- consuming them -- and accumulates damage:
  // $176 for a hit in the low grid, $17c for one in the high grid. It then
  // calls its own $48 handler with the total, which is $7d1a, `sub.w d0,$36`.
  //
  // Two consequences fall out of the structure rather than needing a rule:
  // hits are cell-aligned to 8px, and a bit consumed by one enemy cannot be
  // consumed by another, so one shot can only ever hit one thing.
  initShotGrid() {
    this.gridLo = [new Uint8Array(256), new Uint8Array(256)];   // +0
    this.gridHi = [new Uint8Array(256), new Uint8Array(256)];   // +$100
    this.shotGridOwners = [new Map(), new Map()];
    this.gridPage = 0;                                          // $c58
  }

  // $08692: flip, then clear the pair that is about to be written.
  flipShotGrid() {
    this.gridPage ^= 1;
    this.gridLo[this.gridPage].fill(0);
    this.gridHi[this.gridPage].fill(0);
    this.shotGridOwners[this.gridPage].clear();
  }

  // $06230. Returns null when the position falls outside the grid.
  gridCell(x, y) {
    const gx = (x + 0x58) | 0, gy = (y + 0x1c) | 0;
    if (gx < 0 || gx >= 0x200 || gy < 0 || gy >= 0x100) return null;
    const cx = gx >> 3, cy = gy >> 3;
    return { byte: cy * 8 + (cx >> 3), bit: 7 - (cx & 7) };
  }

  // $06192: a shot stamps its cell into the high grid.
  markShot(x, y) {
    const c = this.gridCell(x, y);
    if (!c) return;
    this.gridHi[this.gridPage][c.byte] |= 1 << c.bit;
  }

  // $07f8a: sweep an enemy's footprint, consume what is under it, and return
  // the accumulated damage.
  sweepShotGrid(o, consumedHi) {
    const extents = this.extentsFor(o);
    const ex = o.boxX ?? extents.x, ey = o.boxY ?? extents.y;
    let x = (o.x + 0x58) | 0, y = (o.y + 0x1c) | 0;
    if (x + ex >= 0x200 || y + ey >= 0x100) return 0;    // $7fa2 / $7faa
    x -= ex; y -= ey;                                     // $7fb4 / $7fb8
    if (x < 0 || y < 0) return 0;
    const cx = x >> 3, cy = y >> 3;                       // $7fbc / $7fbe
    const wCells = (ex * 2) >> 3;                         // $7fd2, the $8014 index
    const hCells = (ey * 2) >> 3;                         // $7fd4
    if (wCells <= 0) return 0;                            // $8014[0] is no bits
    const lo = this.gridLo[this.gridPage ^ 1];            // read the other page
    const hi = this.gridHi[this.gridPage ^ 1];
    let damage = 0;
    for (let r = 0; r <= hCells; r++) {                   // $8004 dbra d3
      const row = cy + r;
      if (row < 0 || row >= 32) continue;
      for (let c = 0; c < wCells; c++) {
        const col = cx + c;
        if (col < 0 || col >= 64) continue;
        const byte = row * 8 + (col >> 3), mask = 1 << (7 - (col & 7));
        if (lo[byte] & mask) {                            // $7fe6
          damage += this.shotDamageLo;                    // $7fea, $176
          lo[byte] ^= mask;                               // $7fee
        }
        if (hi[byte] & mask) {                            // $7ff4
          damage += this.shotDamageHi;                    // $7ff8, $17c
          hi[byte] ^= mask;                               // $7ffc
          if (consumedHi) consumedHi.add(`${byte}:${mask}`);
        }
      }
    }
    return damage;
  }

  // $05e4e: $17c = the table at $5e64 indexed by weapon index and level.
  // $05214 starts a stage at index 1, level 0, so 17; $05250 fixes $176 at 16.
  setWeapon(index, level) {
    const T = [[16, 17, 6, 36], [24, 50, 10, 52], [32, 68, 14, 68]];
    this.weaponIndex = index; this.weaponLevel = level;
    this.shotDamageHi = T[Math.min(level, 2)][Math.min(index, 3)];   // $17c
  }

  // One pass of the grid: flip to a fresh page, let every live shot stamp its
  // cell, then let every enemy consume what lies under it.
  stepShotGrid() {
    this.flipShotGrid();                                   // $08692
    const writeOwners = this.shotGridOwners[this.gridPage];
    const readOwners = this.shotGridOwners[this.gridPage ^ 1];
    const stopShot = (shot) => {
      shot.done = true;
      for (let page = 0; page < this.shotGridOwners.length; page++) {
        for (const [key, owners] of this.shotGridOwners[page]) {
          if (!owners.includes(shot)) continue;
          const remaining = owners.filter((owner) => owner !== shot && !owner.done);
          if (remaining.length) this.shotGridOwners[page].set(key, remaining);
          else {
            this.shotGridOwners[page].delete(key);
            const [byte, mask] = key.split(':').map(Number);
            this.gridHi[page][byte] &= ~mask;
          }
        }
      }
    };
    for (const o of this.objects) {
      if (o.done || !o.__playerShot) continue;
      const cell = this.gridCell(o.x, o.y);
      if (!cell) continue;
      this.markShot(o.x, o.y);                             // $06192
      const key = `${cell.byte}:${1 << cell.bit}`;
      if (!writeOwners.has(key)) writeOwners.set(key, []);
      writeOwners.get(key).push(o);
    }
    for (const o of this.objects) {
      if (o.done || o.__playerShot) continue;
      // $7f8a is called only by objects with a live shot handler. Player-touch
      // collision alone does not let pickups or indestructible projectiles
      // erase shot-grid bits.
      if (!o.shotCollides && (!o.collides || o.__invulnerable || o.__pickup)) continue;
      if (o.damageCooldown > 0) {
        o.damageCooldown--;
        o.__damageBlockedFrame = this.frame;
        continue;
      }
      const consumedHi = new Set();
      const d = this.sweepShotGrid(o, consumedHi);         // $07f8a
      if (d > 0) {
        this.damage(o, d);                                 // $800c -> $7d1a
        for (const key of consumedHi) {
          for (const shot of [...(readOwners.get(key) || [])])
            if (shot.__stopsOnHit !== false) stopShot(shot);
          readOwners.delete(key);
        }
      }
    }
  }

  // $07f3c: the four body segments and tail end append five hardware-sprite
  // points at $20de. Each point can damage an enemy through $4c when it lies
  // inside that enemy's collision box expanded by four pixels.
  hitsDragonBody(o) {
    const extents = this.extentsFor(o);
    const ex = (o.boxX ?? extents.x) + 4;
    const ey = (o.boxY ?? extents.y) + 4;
    const left = o.x - ex, right = o.x + ex;
    const top = o.y - ey, bottom = o.y + ey;
    const points = this.objects
      .filter((part) => !part.done && part.trailOffset !== undefined)
      .sort((a, b) => b.x - a.x)
      .slice(0, 5);
    return points.some((part) => left <= part.x && part.x <= right &&
                                 top <= part.y && part.y < bottom);
  }

  stepCollisions() {
    if (!this.player) return;
    for (const o of this.objects) {
      if (o.done || !o.collides) continue;
      if (this.hitsPlayer(o)) {
        this.collisions++;
        if (o.onHitPlayer) o.onHitPlayer(o, this);           // the $44 handler
        if (!o.__pickup) this.hitPlayer();                    // $7d06
      }
      if (o.done || o.__damageBlockedFrame === this.frame) continue;
      if (this.hitsDragonBody(o)) {
        this.collisions++;
        this.damageBody(o, 0x10);                            // $7f82 -> $4c
      }
    }
  }

  step() {
    this.frame++;
    const deathFrame = this.stepDeathSequence();
    if (!deathFrame && !this.frozen) this.stepWaves();
    // $5a76: advance $92 by speed<<7 and write the slots crossed this frame.
    // When two slots are crossed at once the intermediate one gets the midpoint
    // of the old and new positions, so the trail stays dense at speed.
    const p = this.player;
    if (p) {
      // $05a50: `tst.w $a0(a5) ; beq $5ab6` skips the position integration AND
      // the trail advance when $a0 is zero -- and $0598a shows $a0 is the
      // joystick mask itself, written from the same d0 as $96. So with nothing
      // pressed the write head does not move and the tail stays exactly where
      // it was laid down.
      //
      // The port advanced it every frame, so a stationary player kept stamping
      // the same position into successive slots and the whole tail crept
      // forward and bunched up underneath the head.
      if (!((p.moveInput || 0) & 0x0f)) { p.trailX = p.x; p.trailY = p.y; }
      else {
      const oldX = p.trailX === undefined ? p.x : p.trailX;
      const oldY = p.trailY === undefined ? p.y : p.trailY;
      const before = this.trailHead;
      this.trailIndex += (p.speed || 0x200) / 512;      // slots this frame
      const now = Math.floor(this.trailIndex);
      const crossed = now - before;
      if (crossed === 1) {
        this.trail[now & 63] = { x: p.x, y: p.y };
      } else if (crossed >= 2) {
        this.trail[now & 63] = { x: p.x, y: p.y };
        this.trail[(now - 1) & 63] = { x: (p.x + oldX) / 2, y: (p.y + oldY) / 2 };
      }
      if (crossed > 0) { this.trailHead = now; p.trailX = p.x; p.trailY = p.y; }
      }
    }
    for (const o of this.objects) {
      if (o.done) continue;
      if (o.hitFlash > 0) o.hitFlash--;          // $66: temporary hit palette flash
      // $09418 / $09312: hold the off-screen handler disabled for N frames, then
      // put it back. The object is visible the whole time.
      if (o.__cullAfter !== undefined) {
        if (--o.__cullAfter <= 0) { o.__noCull = false; o.__cullAfter = undefined; }
      }
      o.advanceFrames();
      const r = o.co.next();
      if (r.done) { o.__why = o.__why || 'behaviourEnded'; o.done = true; this.releaseLinks(o); }
    }
    for (const o of this.objects) {
      if (o.done) continue;
      // $7d98 integrates acceleration into velocity BEFORE velocity into
      // position: $1e/$22 -> $16/$1a -> $e/$12. Objects that accelerate (the
      // $0c6a4 damped spring, for one) move wrongly without this.
      // Velocity variation, recorded HERE because this loop sees every object on
      // every frame it exists. Any audit that scans world.objects from outside
      // misses whatever is born and culled between two scans, which is most of
      // what a short-lived enemy does.
      if (o.__lastVx === undefined) { o.__lastVx = o.vx; o.__lastVy = o.vy; o.__vChanges = 0; }
      else if (Math.abs(o.vx - o.__lastVx) > 0.01 || Math.abs(o.vy - o.__lastVy) > 0.01) {
        o.__vChanges++; o.__lastVx = o.vx; o.__lastVy = o.vy;
      }
      if (o.ax) o.vx += o.ax;
      if (o.ay) o.vy += o.ay;
      if (o.damping) o.vx -= o.vx / o.damping;   // $c6ba: vx -= vx/64
      o.x += o.vx; o.y += o.vy;
      // Cull on the ARTWORK, not the anchor. Wide objects enter with their
      // anchor pushed right by their left extent (so the leftmost pixel starts
      // at the edge), which can put the anchor well past the old fixed bound --
      // a 128px mound entered at x=487 and was destroyed on the spot.
      const ext = o.sprite ? this.leftExtent(o) : 0;
      // $07ddc: `tst.b $50(a5) ; bmi` skips the bounds check entirely when the
      // off-screen handler has been disabled with $ff.
      if (o.__noCull) { /* $50 = $ff */ }
      else if (o.x + ext < CULL_LEFT || o.x - ext > CULL_RIGHT ||
          o.y < CULL_TOP || o.y > CULL_BOTTOM) {
        o.__why = (o.x + ext < CULL_LEFT) ? 'cullLeft'
                : (o.x - ext > CULL_RIGHT) ? 'cullRight'
                : (o.y < CULL_TOP) ? 'cullTop' : 'cullBottom';
        o.done = true; this.releaseLinks(o);
      }
      // This used to DELETE any object that had not moved for 600 frames. It was
      // a safety net for gaps in the motion data, from a time when a large
      // fraction of objects had no velocity at all -- but it cannot tell a
      // stuck object from one that is deliberately standing still, and plenty
      // are: $deb4 and $df40 both stop the stage 5 boss dead between
      // manoeuvres, so the boss and all twelve of its segments were being
      // deleted mid-fight, as was the stage 1 boss.
      //
      // The gap it guarded against is closed (every wave record resolves to a
      // handler and no object falls back to an invented speed), so it now only
      // COUNTS, and the harness can report a regression instead of the engine
      // silently removing gameplay objects.
      if (o.vx === 0 && o.vy === 0 && !o.parts && o.trailOffset === undefined) {
        o.stillFor = (o.stillFor || 0) + 1;
        if (o.stillFor === STILL_LIMIT) this.stuckObjects++;
      } else o.stillFor = 0;
    }
    if (this.bossSpawned) {
      this.bossAlive = this.objects.some((o) => o.__isBoss && !o.done);
    }
    this.stepShotGrid();
    this.stepCollisions();
    // A generator's finally only runs when the generator finishes. Culling sets
    // done directly, so without this the cleanup in waveChild never executes
    // and the spawn budgets leak to zero -- streams then stop spawning at all.
    for (const o of this.objects)
      if (o.done && o.co && !o.__closed) { o.__closed = true; try { o.co.return(); } catch (e) {} }
    // Objects are removed here, so ANY audit that samples this.objects once a
    // frame measures survival rather than existence -- an object born and
    // culled between two samples is invisible to it. That cost a whole session
    // of contradictory per-handler numbers. The trace records the two events
    // themselves, which is the only way to count things that did not last.
    if (this.trace) {
      for (const o of this.objects)
        if (o.done)
          this.trace.push({ ev: 'gone', o, frame: this.frame, why: o.__why || null,
                            lived: this.frame - (o.__born || 0) });
    }
    this.objects = this.objects.filter(o => !o.done);
  }
}

class GameObject {
  constructor(world) {
    this.world = world;
    this.x = 0; this.y = 0;              // $0e / $12, 16.16 fixed in the original
    this.vx = 0; this.vy = 0;            // $16 / $1a
    this.speed = 0;                      // $26
    this.angle = 0;                      // the byte at $29
    this.depth = 0;                      // $2a -> $a(a0) of the draw record:
                                         // the sort key, higher = further back
    this.scoreAward = 0;                 // $2e
    this.hp = 1;                         // $36
    this.state = 0;                      // $3a
    this.hitFlash = 0;                   // $66
    this.damageCooldown = 0;             // $3a damage-handler gate
    this.generation = world.generation;  // $7a
    this.handle = 0;                     // $30
    this.done = false;
  }

  // $74ee: liveness is a generation stamp, not a flag.
  alive() { return !this.done && this.generation === this.world.generation; }

  // $75b2: velocity is derived from angle and speed, never stored directly.
  // The sin/cos table at $7a38 is sin(a) * 256, and the original multiplies it
  // by $26, so `speed` holds the raw $26 value and 256 converts to pixels:
  // $200 -> 2 pixels per frame.
  setVelocity() {
    this.vx = cos256(this.angle) * this.speed / 256;
    this.vy = sin256(this.angle) * this.speed / 256;
  }

  // $75ae: turn by a delta, then recompute velocity.
  turnBy(d) { this.angle = (this.angle + d) & 255; this.setVelocity(); }

  // $7570: turn at most `max` toward the player, then recompute velocity.
  turnTowardPlayer(max) {
    const p = this.world.player;
    if (!p) { this.setVelocity(); return; }
    const want = Math.round(
      Math.atan2(p.y - this.y, (p.x + 8) - this.x) * ANGLE_STEPS / (2 * Math.PI)) & 255;
    let d = (want - this.angle) & 255;
    if (d > 128) d -= 256;                       // shortest way round
    if (d > max) d = max; else if (d < -max) d = -max;
    this.turnBy(d);
  }

  // $6416 -> $7cb8: pick the facing frame, then resolve the handle for its size.
  faceFromAngle() {
    const dir = ((this.angle + 8) >> 4) & 15;
    this.setHandle(DIR_FRAMES[dir]);
  }

  // $7c38 / $7c76: frame scripts are a small VM, not a frame list. A word with
  // bit 15 clear is a sprite handle -- it is applied and the tick ends. A word
  // with bit 15 set is a control opcode in bits 14..12, payload in the low bits,
  // and the player keeps reading until it hits a frame or the script stops.
  //
  //   0  hold = payload & $fff   ($72/$74)      4  set loop point to here ($6a)
  //   1  rewind to script start  ($6a)          5  call $7d40, then stop
  //   2  set flag $76                           6  clear flag $76
  //   3  stop ($78 = 0)
  playFrames(frames, hold = 4) {
    this.script = frames;                // $6a(a5), also the loop point
    this.scriptStart = 0;
    this.scriptPos = 0;                  // $6e(a5) cursor
    this.scriptHold = hold;              // $74(a5)
    this.scriptDelay = 1;                // $72(a5), fires immediately
    this.scriptOn = true;                // $78(a5)
    this.scriptFlag = 0;                 // $76(a5)
  }

  // $7c7a: one call advances at most one frame; control words are consumed
  // along the way.
  advanceFrames() {
    if (!this.script || !this.scriptOn) return;
    if (--this.scriptDelay > 0) return;
    let guard = 64;                      // control words cannot loop forever
    while (this.scriptOn && guard-- > 0) {
      if (this.scriptPos >= this.script.length) { this.scriptOn = false; return; }
      const w = this.script[this.scriptPos++];
      if ((w & 0x8000) === 0) {          // $7c7c bpl -> a frame
        this.setHandle(w);               // $7cb8
        this.scriptDelay = this.scriptHold;
        return;
      }
      switch ((w >> 12) & 7) {           // $7c86: opcode = bits 14..12
        case 0: this.scriptHold = this.scriptDelay = (w & 0xfff) || 1; break;
        case 1: this.scriptPos = this.scriptStart; break;
        case 2: this.scriptFlag = 0xffff; break;
        case 3: this.scriptOn = false; break;
        case 4: this.scriptStart = this.scriptPos; break;
        case 5: this.scriptOn = false; break;
        case 6: this.scriptFlag = 0; break;
      }
    }
  }

  setHandle(h) {
    this.handle = h;
    const s = this.world.byHandle.get(h);
    // Record HAVING a sprite as an event. Sampling for it once a frame has the
    // same weakness as sampling world.objects: an object that draws only
    // briefly can slip between two samples and read as invisible.
    if (s) {
      this.sprite = s;
      this.w = s.w;
      this.h = s.h;
      this.boxX = s.bx;
      this.boxY = s.by;
      this.__drew = true;
    }
  }

  // $7e68: the renderer rounds by adding $8000 (0.5) before taking the integer
  // half, so positions round to nearest rather than truncating.
  get drawX() { return Math.floor(this.x + 0.5); }
  get drawY() { return Math.floor(this.y + 0.5); }

  // $7d1a: apply damage; award the score on death.
  damage(n) {
    this.hp -= n;
    if (this.hp > 0) { this.hitFlash = 0x10; this.state = 2; return false; }
    this.world.score += this.scoreAward;
    this.done = true;
    return true;
  }

  die() { this.done = true; }                    // $7d46
}

// Input, from $4626. JOY1DAT bits $0303 are folded to an index and looked up
// in a 16-byte table at $4656, giving a code whose low two bits are the X
// direction and next two the Y -- a 3x3 grid, so movement is strictly digital
// 8-way. Fire is CIA-A PRA (active low) and sets bit 7. The result lands in
// $82(a6); $5a18 returns it, or $84(a6) when $46(a6) selects the second source.
// Bit assignment comes from the edge clamp at $59cc: at the top it clears bit 0
// and sets bit 1 (forcing down), at the bottom the reverse, and at the right it
// clears bit 3 and sets bit 2 (forcing left).
const INPUT = { UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8, FIRE: 0x80 };

// $57ee: 16 signed headings indexed by the joystick mask ($96(a5) & 15).
// -1 means "no heading" -- the player stops dead rather than coasting.
// This table is also what fixes the INPUT bit assignment above.
const INPUT_HEADING = [
  -1, -64,  64,  -1, -128, -96,  96, -128,
   0, -32,  32,   0,   -1, -64,  64,  -64,
];
const HEADING_NONE = -1;

// $d58(a6) advances with the backdrop, 1 unit per frame.
// $d58 is never incremented -- $847a refreshes it from $10a(a6) and $84f2
// stores it into an object's $a6. The level scroll IS an object's position,
// advanced by the normal physics step, so it moves at that object's velocity.
// Terrain-locked objects run at 1 px/frame; the renderer derives the distant
// backdrop's half-speed parallax from that rate. Wave records are also paced
// from this stage-scroll coordinate.
// One scroll unit per frame. Confirmed against the original by timing: at 2 the
// last wave record of stage 1 fires 58 seconds in, at 1 it fires at 115, and the
// stage runs about two minutes. Everything paced off the scroll depends on this
// -- trigger spacing, the $348 entry lead, and how long an object stays on
// screen, which is why enemies were being flown past before they finished their
// entrance.
const SCROLL_RATE = 1;

// $7f0e / $8190: collision box defaults and the player-hotspot bias
const COLLIDE_DEFAULT = 8, COLLIDE_BIAS_X = 8;

// Cull bounds, generous enough for objects still entering from the right.
const CULL_LEFT = -64, CULL_RIGHT = 640, CULL_TOP = -64, CULL_BOTTOM = 320;
const STILL_LIMIT = 600;   // frames motionless before an object is REPORTED (not dropped)

// $8730: ground scenery locks to the terrain object's rate rather than carrying
// a speed of its own. The res-7 $a010/$a04c timing discriminates the two visible
// layer rates: at -2 the standalone gunner is culled before its first $6774,
// while -1 puts that shot near x=$34 as in the original.
const GROUND_SCROLL = 1;

// $06774 gates on $f0 < 10; $1966 seeds $a0 with 10.
const ENEMY_POOL = 10;

// $8ac6: objects enter this far past their trigger; also the level's start scroll
const ENTRY_LEAD = 0x348;

// $59cc-$59fa: the player is held inside this box by rewriting the direction
// bits rather than by clamping the position.
const PLAY_AREA = { top: 0x3e, bottom: 0x7a, right: 0xe8 };

function inputVector(code) {
  return {
    x: (code & INPUT.RIGHT) ? 1 : (code & INPUT.LEFT) ? -1 : 0,
    y: (code & INPUT.DOWN) ? 1 : (code & INPUT.UP) ? -1 : 0,
    fire: !!(code & INPUT.FIRE),
  };
}

// $59cc: force the direction away from an edge the player has reached.
function clampDirection(code, x, y) {
  if (y <= PLAY_AREA.top)    code = (code & ~INPUT.UP) | INPUT.DOWN;
  if (y >= PLAY_AREA.bottom) code = (code & ~INPUT.DOWN) | INPUT.UP;
  if (x >= PLAY_AREA.right)  code = (code & ~INPUT.RIGHT) | INPUT.LEFT;
  return code;
}

// $560a: on init the whole ring is filled with the player's current position,
// so the body starts collapsed on the head rather than trailing stale data.
function resetTrail(world, x, y) {
  for (let i = 0; i < world.trail.length; i++) world.trail[i] = { x, y };
  world.trailHead = 0;
}

// $7d5c: wait n+1 frames, aborting early if the object dies.
function* wait(o, n) {
  for (let i = 0; i <= n; i++) {
    if (!o.alive()) return;
    yield;
  }
}

// $7d70: wait n+1 frames unconditionally.
function* waitHard(n) { for (let i = 0; i <= n; i++) yield; }

if (typeof module !== 'undefined')
  module.exports = { World, GameObject, wait, waitHard, DIR_FRAMES,
    INPUT_HEADING, HEADING_NONE, SCROLL_RATE, COLLIDE_DEFAULT, COLLIDE_BIAS_X,
    GROUND_SCROLL, ENTRY_LEAD, ENEMY_POOL,
                     sin256, cos256, INPUT, PLAY_AREA, inputVector,
                     clampDirection, resetTrail };
