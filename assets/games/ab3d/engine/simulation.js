import { sourceRoomOrder } from './geometry.js?v=source-fidelity-5';
import { radiansToSourceAngle, sourceAngleTrig } from './movement.js?v=source-fidelity-8';

const TICKS_PER_SECOND = 50;
const CLUMP_PHASE_UNITS = 4096 >> 6;
const PLAYER_HEIGHT_FIXED = 48 * 256;
const OPERATE_DISTANCE = 60;
const PICKUP_DISTANCE = 100;
// objectmove:MoveObject initializes all four destination opening bounds to
// #-65536*256 before checking whether an edge has a joined room.
const SOURCE_SOLID_WALL_HEIGHTS = Object.freeze({
  lowerFloor: -65536 * 256, lowerRoof: -65536 * 256,
  upperFloor: -65536 * 256, upperRoof: -65536 * 256,
});
const AMMO_FRAMES = [3, 4, 5, 0, 29, 0, 0, 28];
const AMMO_PER_CLIP = [15, 20, 2, 40, 6, 0, 0, 15].map(value => value * 8);
const AMMO_IN_GUN = [0, 5, 1, 0, 1, 0, 0, 5];
const ANIMATED_GRAPHICS = new Map([
  [0, 0], [8, 4], [12, 10], [13, 13], [14, 14], [16, 15], [18, 16], [19, 17],
]);
const ENEMY_HANDLER_TYPES = new Set([0, 6, 8, 12, 13, 14, 16, 17, 18, 19, 20]);
const OBJECT_HANDLER_TYPES = new Set([1, 3, 4, 9, 10]);
const SOURCE_OBJECT_LAYOUTS = new Map([
  [0, { sourceWidth: 31, sourceHeight: 31 }],
  [8, { width: 96, height: 96 }],
  [12, { sourceWidth: 31, sourceHeight: 31 }],
  [13, { width: 90, height: 100, sourceWidth: 45, sourceHeight: 50 }],
  [14, { width: 128, height: 128, sourceWidth: 64, sourceHeight: 64 }],
  [16, { width: 128, height: 128, sourceWidth: 32, sourceHeight: 32 }],
  [17, { width: 16, height: 32, sourceWidth: 15, sourceHeight: 31 }],
  [18, { width: 69, height: 69, sourceWidth: 31, sourceHeight: 31 }],
  [19, { width: 69, height: 69 }],
]);
const SHOTGUN_ANIMATION = [0,
  ...Array(12).fill(2), ...Array(19).fill(1), ...Array(11).fill(2),
  ...Array(20).fill(0), 3,
];
// newtwo.s:PLR1_GunData is eight 32-byte records. aliencontrol.s:
// FireAtPlayer1 selects a record with SHOTTYPE*32 and copies words 16 and 18
// into every hostile shot; anims.s:ItsABullet reads word 10 from that same
// record as the shot's maximum lifetime. Keep these properties table-driven:
// enemy handlers do not supply independent ballistic values in the source.
const SOURCE_GUN_BALLISTICS = [
  { lifetime: -1, gravity: 0, flags: 0 },
  { lifetime: -1, gravity: 0, flags: 0 },
  { lifetime: -1, gravity: 0, flags: 0 },
  { lifetime: 50, gravity: 0, flags: 0 },
  { lifetime: 100, gravity: 60, flags: 3 },
  { lifetime: -1, gravity: 0, flags: 0 },
  { lifetime: -1, gravity: 0, flags: 0 },
  { lifetime: -1, gravity: 0, flags: 0 },
];
const PLAYER_TARGET_MASK = 0x3ffdc1;
const BLAST_TARGET_MASK = 0x3ffde1;
const PLAYER_COLLISION_MASK = 0x0fff;
const PLAYER_COLLISION_RADIUS = 40;
const PLAYER_COLLISION_HEIGHT = 40;
const WALLFLAG_PLAYER = 0x0100;
const WALLFLAG_ALIEN = 0x0200;
const WALLFLAG_BULLET = 0x0400;
const WALLFLAG_ROUTINE = 0x8000;
const NORMAL_ALIEN_PATROL_MASK = 0x3fde1;
const NORMAL_ALIEN_ATTACK_MASK = 0xffdc1;
const MARINE_PATROL_MASK = 0xffde1;
const HALF_WORM_PATROL_MASK = 0x7fde1;
const TREE_PATROL_MASK = 0xdfde1;
const EXPLOSIVE_FORCE = [0, 0, 64, 0, 40];
const DAMAGE_RULES = new Map([
  [0, { shift: 0 }],
  [6, { shift: 4 }],
  [8, { shift: 0 }],
  [10, { shift: 0 }],
  [12, { shift: 0 }],
  [13, { shift: 2, minimum: 1 }],
  [14, { shift: 4 }],
  [16, { shift: 2 }],
  [17, { shift: 0 }],
  [18, { shift: 0 }],
  [19, { shift: 0 }],
]);
const ENEMY_PAIN_SOUNDS = new Map([
  [0, 0], [6, 8], [8, 8], [12, 0], [13, 27],
  [14, 27], [16, 27], [17, 8], [18, 0], [19, 0],
]);
// ColBoxTable in objectmove. The first value is the horizontal half-extent;
// the second and third values describe the vertical span above the object's Y
// anchor and its total height. Keeping the source's non-centred form matters
// for the player/object test.
const COLLISION_BOXES = [
  [40, 60, 120], [40, 20, 40], [40, 20, 40], [40, 20, 40], [40, 20, 40],
  [40, 40, 80], [40, 50, 100], [40, 20, 40], [80, 60, 120], [40, 20, 40],
  [40, 30, 60], [40, 40, 80], [40, 40, 80], [80, 60, 120], [160, 100, 200],
  [80, 50, 100], [80, 60, 120], [40, 30, 60], [40, 40, 80], [40, 40, 80],
];
// extlen is independent of ColBoxTable. Several enemies deliberately keep a
// compact object hit box while requesting much wider clearance from walls.
const ENEMY_EXTLEN = new Map([
  [0, 80], [6, 160], [8, 160], [12, 80], [13, 80], [14, 160],
  [16, 80], [17, 160], [18, 80], [19, 80],
]);
const ENEMY_AWAY_FROM_WALL = new Map([
  [0, 1], [6, 2], [8, 2], [12, 1], [13, 1], [14, 2],
  [16, 1], [17, 2], [18, 1], [19, 1],
]);
// thingheight values installed by each released enemy handler immediately
// before Collision/MoveObject. These are source vertical spans, not sprite
// bitmap heights or ColBoxTable dimensions.
const ENEMY_BODY_HEIGHTS = new Map([
  [0, 80], [6, 160], [8, 96], [12, 128], [13, 200], [14, 256],
  [16, 200], [17, 96], [18, 128], [19, 128],
]);
// Each enemy entry routine installs these MoveObject globals before any
// movement or damage handling. ComputeBlast:DOFLAMES later overwrites only
// extlen/awayfromwall, so explosions inherit this vertical profile from the
// handler that invoked them (or from the preceding ObjectHandler record).
const ENEMY_MOVE_OBJECT_PROFILES = new Map([
  [0, { thingHeight: 80 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
  [6, { thingHeight: 160 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
  [8, { thingHeight: 96 * 128, stepUp: 0, stepDown: 0x1000000 }],
  [12, { thingHeight: 128 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
  [13, { thingHeight: 200 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
  [14, { thingHeight: 256 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
  [16, { thingHeight: 200 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
  [17, { thingHeight: 96 * 128, stepUp: 0, stepDown: 0x1000000 }],
  [18, { thingHeight: 128 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
  [19, { thingHeight: 128 * 128, stepUp: 20 * 256, stepDown: 20 * 256 }],
]);
const PROJECTILE_MOVE_OBJECT_PROFILE = Object.freeze({
  thingHeight: 10 * 128, stepUp: 0, stepDown: 0x1000000,
});
const visual = (size, graphicType, frame, yOffset = 0) =>
  ({ size, graphicType, frame, yOffset });
const PROJECTILE_VISUALS = new Map([
  [0, {
    flight: [
      { ...visual(20, 6, 8), height: 15 }, visual(17, 6, 9),
      { ...visual(15, 6, 10), height: 20 }, visual(17, 6, 11),
    ],
    impact: Array.from({ length: 11 }, (_, frame) =>
      visual(25, 1, frame + 6, frame ? -4 : 0)),
  }],
  [1, {
    flight: Array.from({ length: 8 }, (_, frame) => visual(25, 2, frame)),
    impact: Array.from({ length: 12 }, (_, frame) => visual(25 + frame * 4, 2, frame + 8, -4)),
  }],
  [2, {
    flight: Array.from({ length: 4 }, (_, frame) => visual(16, 6, frame)),
    impact: [0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]
      .map((frame, index) => visual(100 + index * 10, 8, frame, index === 1 ? 0 : -4)),
  }],
  [3, {
    flight: [0, 1, 2, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8]
      .map((frame, index) => visual([5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49,
        55, 63, 71, 79, 87, 95, 103][index], 8, frame)),
    impact: [7, 7, 7, 8, 8, 8].map((frame, index) => visual(140 + index * 4, 8, frame)),
  }],
  [4, {
    flight: Array.from({ length: 4 }, (_, frame) => visual(25, 1, frame + 21)),
    impact: [0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8]
      .map((frame, index) => visual(100 + index * 10, 8, frame, index === 1 ? 0 : -4)),
  }],
  [5, {
    flight: Array.from({ length: 4 }, (_, frame) => visual(25, 6, frame + 4)),
    impact: [20, 15, 10, 5].map((size, frame) => visual(size, 6, frame + 4)),
  }],
  [6, {
    flight: Array.from({ length: 4 }, (_, frame) => visual(10, 6, frame + 4)),
    impact: [8, 6, 4].map((size, frame) => visual(size, 6, frame + 4)),
  }],
  [7, {
    flight: [],
    impact: Array.from({ length: 11 }, (_, frame) =>
      visual(25, 1, frame + 6, frame ? -4 : 0)),
  }],
]);
const PROJECTILE_BITMAP_SIZES = new Map([
  [0, { flight: 16, impact: 8 }],
  [1, { flight: 16, impact: 16 }],
  [2, { flight: 16, impact: 32 }],
  [3, { flight: 32, impact: 32 }],
  [4, { flight: 8, impact: 32 }],
  [5, { flight: 16, impact: 16 }],
  [6, { flight: 16, impact: 16 }],
  [7, { flight: 8, impact: 8 }],
]);
const GIB_VISUALS = Array.from({ length: 4 }, (_, variant) => {
  const base = 16 + variant * 4;
  const flightSize = [25, 20, 20, 30][variant];
  const popSize = variant === 2 ? 17 : 20;
  // Explode3Pop has no extra 17-size tail entry because its eight held frames
  // are already size 17. Explode1/2/4 append 17, 13, 9 after eight holds.
  const impactSizes = variant === 2
    ? [...Array(8).fill(17), 13, 9]
    : [...Array(8).fill(popSize), 17, 13, 9];
  return {
    flight: Array.from({ length: 4 }, (_value, frame) =>
      visual(flightSize, 0, base + frame)),
    // Explode4Pop alone leaves its first frame at Y offset zero. Every following
    // entry, and every entry in Explode1/2/3Pop, adds one source Y unit.
    impact: impactSizes
      .map((size, frame) => visual(size, 0, base, variant === 3 && frame === 0 ? 0 : 1)),
  };
});
const WEAPONS = new Map([
  [0, { cost: 8, delay: 5, hold: false, instant: true, damage: 4, pellets: 1,
    yOffset: 20, animation: [0, 1, 2, 3] }],
  [1, { cost: 8, delay: 10, hold: false, instant: false, damage: 16, velocityShift: 5,
    lifetime: -1, gravity: 0, flags: 0, verticalVelocity: 0, pellets: 1,
    yOffset: 20, animation: [0, 1, 2, 3, 3, 3] }],
  [2, { cost: 8, delay: 30, hold: false, instant: false, damage: 12, velocityShift: 5,
    lifetime: -1, gravity: 0, flags: 0, verticalVelocity: 0, pellets: 1,
    yOffset: 0, animation: [0, 1, 2, 3, 3, 3] }],
  [3, { cost: 1, delay: 5, hold: true, instant: false, damage: 8, velocityShift: 4,
    lifetime: 50, gravity: 0, flags: 0, verticalVelocity: 0, pellets: 1,
    yOffset: 20, animation: [0, 1, 2, 3, 3, 3] }],
  [4, { cost: 8, delay: 50, hold: true, yOffset: 20,
    instant: false, damage: 8, velocityShift: 5, lifetime: 100, gravity: 60, flags: 3,
    verticalVelocity: -1000, pellets: 1,
    animation: [0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3] }],
  [7, { cost: 8, delay: 50, hold: true, instant: true, damage: 4, pellets: 7,
    yOffset: 20, animation: SHOTGUN_ANIMATION }],
]);

export function sourceGunBallistics(gun) {
  const record = SOURCE_GUN_BALLISTICS[gun | 0];
  return record ? { ...record } : null;
}

export class DynamicWorld {
  constructor(level) {
    this.level = level;
    this.commandsByOffset = new Map(level.render.flatMap(render => [...render.lower, ...render.upper])
      .map(command => [command.sourceOffset, command]));
    this.conditions = 0;
    this.accumulator = 0;
    this.operatePending = false;
    this.doors = level.dynamics.doors.map(record => ({ ...record }));
    this.lifts = level.dynamics.lifts.map(record => ({ ...record }));
    this.waterAnimations = level.dynamics.waterAnimations.map(record => ({
      ...record, zones: record.zones.map(binding => ({ ...binding })),
    }));
    this.switches = level.dynamics.switches.map(record => ({ ...record }));
    this.objects = level.objects.map(object => ({
      ...object,
      position: { ...object.position },
      render: { ...object.render },
      active: object.type >= 0 && object.zone >= 0,
      // defs.i overlays shotxvel/shotzvel on enemy fields 18..25. Enemy
      // launchers use MOVE.W on the high half only, so a reused pool record
      // retains both low words. Keep the packed initial longs available after
      // the browser-side shot object is released.
      pooledShotXVelocityFixed: object.shotXVelocityFixed | 0,
      pooledShotZVelocityFixed: object.shotZVelocityFixed | 0,
      // The remaining shot overlays are likewise persistent pool memory.
      // Instant-impact allocation does not write these fields.
      pooledShotYVelocity: object.shotYVelocity,
      pooledShotGravity: object.shotGravity,
      // defs.i:shotlife/shotflags are the named words at offsets 58/60.
      // Keep their signed machine-word form when the same pool slot is reused.
      pooledShotLife: signedWord(object.shotLife),
      pooledShotFlags: signedWord(object.shotFlags),
    }));
    const playerShots = level.objectPools.playerShots;
    this.playerShots = this.objects.slice(playerShots.start, playerShots.start + playerShots.count);
    const alienShots = level.objectPools.alienShots;
    this.alienShots = this.objects.slice(alienShots.start, alienShots.start + alienShots.count);
    const otherNasties = level.objectPools.otherNasties;
    this.otherNasties = this.objects.slice(
      otherNasties.start, otherNasties.start + otherNasties.count);
    this.projectiles = [...this.playerShots, ...this.alienShots];
    const playerObjectOffset = level.offsets.player1Object - level.offsets.objects;
    this.playerObjectId = playerObjectOffset / 64;
    this.playerState = {
      energy: 127,
      ammo: [160, 0, 0, 0, 0, 0, 0, 0],
      guns: [true, false, false, false, false, false, false, false],
      selectedGun: 0,
      weaponFrame: 0,
      shotCooldown: 0,
      fireHeld: false,
    };
    // Explicit browser-only cheats requested for the port. They default off,
    // are not serialized by the retail password codec, and must not be read by
    // any other gameplay path as if they were released AB3D state.
    this.browserCheats = { invulnerability: false, infiniteBullets: false };
    // The packed level's separately pointed player record begins inactive;
    // newtwo.s gives it runtime type 5. Its damagetaken byte mediates every
    // enemy hit, and USEPLR1 consumes it before objmoveanim runs the handlers.
    this.playerDamageTaken = 0;
    this.hitColour = 0;
    this.playerImpactX = 0;
    this.playerImpactZ = 0;
    this.zoneFlashLower = new Int16Array(level.zones.length);
    this.zoneFlashUpper = new Int16Array(level.zones.length);
    this.pointFlashLower = new Int16Array(level.points.length);
    this.pointFlashUpper = new Int16Array(level.points.length);
    this.brightnessFlashActive = false;
    this.randomSeed = 234;
    this.robotFrame = 0;
    // objectmove stores these as process-wide globals. Starting at their BSS
    // zero values also preserves the source's deliberate cross-handler state.
    this.moveObjectProfile = { thingHeight: 0, stepUp: 0, stepDown: 0 };
    // objectmove keeps these beside the vertical profile as process-wide
    // globals. FindCloseRoom deliberately reads the values left by the
    // preceding player/object handler and leaves exitfirst set on return.
    this.moveObjectExtlen = 0;
    this.moveObjectAwayFromWall = 0;
    this.moveObjectExitFirst = false;
    this.moveObjectRange = 0;
    // wallflags is another process-wide MoveObject input. Released callers
    // install player $100, alien $200, or bullet $400; FindCloseRoom and
    // ComputeBlast deliberately inherit the preceding value.
    this.moveObjectWallKind = null;
    // objectmove lines 8-9 allocate one process-wide 100-word RoomPath and a
    // pointer into it. MoveObject resets only the pointer at entry: its
    // zero-delta return at lines 23-27 leaves every prior buffer word intact.
    this.moveObjectRoomPath = new Int16Array(100);
    this.renderRoomOrder = [];
    // BrightAnimTable begins as zero-filled BSS. donetalking snapshots its
    // current values before objmoveanim calls brightanim once per outer pass
    // (newtwo.s lines 1478-1584; anims:objmoveanim/brightanim). These counters
    // keep the displayed table one pass behind the newly advanced pointers.
    this.brightnessAnimationStep = 0;
    this.brightnessRenderStep = 0;
    // NEWTWO.s main-loop lines 1188-1199 selects waterlist[0], then advances
    // wtan by 640 and wateroff by one before the first displayed frame. These
    // values are display-pass state, independent of TempFrames.
    this.waterRenderFrame = 0;
    this.waterTangent = 640;
    this.waterTextureOffset = 1;
    // SourceViewRenderer installs the recovered per-level unLHA scratch image.
    // It remains null in simulation-only callers because no water lookup occurs.
    this.waterWorkspace = null;
    this.hasRenderedWater = level.render.some(render =>
      [...render.lower, ...render.upper].some(command => command.type === 'water'));
    this.footstepPhase = 0;
    this.events = [];
    this.completed = false;
    this.animationTick = 0;
    this.animationPhase = 0;
    this.planeHeights = new Map();
    this.wallTops = new Map();
    this.wallBottoms = new Map();
    this.wallTextureOffsets = new Map();
    this.wallTextureYOffsets = new Map();
    this.wallTextureBanks = new Map();
    this.blockedEdges = new Set();
    this.waterHeights = new Map();
    // FloorLines word 14 is mutable runtime storage. MoveObject ORs the
    // caller's bit into the exact wall; DoorRoutine and then LiftRoutine read
    // and rewrite only the walls named by their packed mover records.
    this.moveObjectWallFlags = Uint16Array.from(
      level.edges, edge => edge.flags & 0xffff);
    this.rebuildGeometry();
    this.initializeObjects();
  }

  update(seconds, player, operate = false, fire = false) {
    this.operatePending ||= operate;
    this.accumulator += Math.max(0, seconds) * TICKS_PER_SECOND;
    const ticks = Math.min(15, Math.floor(this.accumulator));
    if (!ticks) return false;
    this.accumulator -= ticks;
    const doOperate = this.operatePending;
    this.operatePending = false;
    // newtwo.s:donetalking rebuilds ZoneBrightTable/CurrentPointBrights before
    // objmoveanim. TempFrames does not advance BrightAnimPtrs multiple times.
    this.brightnessRenderStep = this.brightnessAnimationStep;
    // One browser update corresponds to the source outer pass. TempFrames can
    // advance several logic units inside it, but the current brightness tables
    // are constructed only once before objmoveanim and the following display.
    let changed = this.resetBrightnessFlash();
    // The released outer loop advances these once per rendered pass, not once
    // per TempFrames logic tick (NEWTWO.s lines 1188-1199).
    this.waterRenderFrame = (this.waterRenderFrame + 1) & 7;
    this.waterTangent = (this.waterTangent + 640) & 8191;
    this.waterTextureOffset = (this.waterTextureOffset + 1) & 63;
    changed = this.hasRenderedWater || changed;
    // newtwo.s:Chan0inter advances alanptr for every hardware frame before the
    // main loop snapshots FramesToDraw as TempFrames. ObjectHandler sees the
    // final alframe once; it does not visit intermediate phases during catch-up.
    this.advanceSourceAnimation(ticks);
    // newtwo.s:USEPLR1 has already installed these MoveObject globals when
    // OrderZones and objmoveanim begin. Player1Shot may replace them below.
    this.moveObjectProfile = {
      thingHeight: Math.trunc(Number.isFinite(player?.collisionHeight)
        ? player.collisionHeight * 256 : (player?.height ?? 48) * 256) | 0,
      stepUp: (player?.crouched ? 10 : 40) * 256,
      stepDown: 0x1000000,
    };
    this.moveObjectExtlen = 40;
    this.moveObjectAwayFromWall = 0;
    this.moveObjectExitFirst = false;
    // newtwo.s calls OrderZones immediately before objmoveanim/ObjectHandler.
    this.renderRoomOrder = sourceRoomOrder(this.level, player.zone, player);
    // anims:objmoveanim calls Player1Shot before SwitchRoutine, DoorRoutine,
    // LiftRoutine, and ObjectHandler.
    changed = this.updateWeapon(player, fire, ticks) || changed;
    if (doOperate) changed = this.operateSwitches(player) || changed;
    // objmoveanim invokes these routines once, in this order. Each routine
    // consumes the same TempFrames word internally.
    changed = this.updateSwitchTimers(ticks) || changed;
    changed = this.updateDoors(player, doOperate, ticks) || changed;
    changed = this.updateLifts(player, doOperate, ticks) || changed;
    changed = this.updateWaterAnimations(ticks) || changed;
    // These are outer-loop operations in the released game. They run once
    // even when FramesToDraw/TempFrames reports several elapsed video frames.
    changed = this.fadePlayerHitColour() || changed;
    changed = this.consumePlayerDamage() || changed;
    changed = this.updateTeleport(player) || changed;
    // anims:ObjectHandler advances through the 64-byte records in address
    // order. Keeping one shared walk is observable: an early explosion can
    // damage a later barrel, and newly allocated shot-pool records are reached
    // only if their table address has not already passed.
    changed = this.updateObjectHandler(player, ticks) || changed;
    // anims:objmoveanim calls brightanim once after ObjectHandler. A lighting
    // change also requires a new display pass even when the player is still.
    this.brightnessAnimationStep++;
    changed = this.updateEnemyAwareness(player) || changed;
    changed = this.checkLevelCompletion(player) || changed;
    if (changed) this.rebuildGeometry();
    return true;
  }

  advanceSourceAnimation(frames) {
    const elapsed = Math.max(0, Math.trunc(frames));
    if (!elapsed) return this.animationPhase;
    const next = this.animationTick + elapsed;
    // newtwo.s:alan stores eight longs each of 0, 1, 2, and 3. alanptr points
    // at the next entry, so hardware ticks one through eight still expose zero.
    this.animationPhase = ((next - 1) & 31) >> 3;
    this.animationTick = next & 31;
    return this.animationPhase;
  }

  updateWaterVisibilityWorkspace(zones) {
    if (!this.waterWorkspace) return false;
    // NEWTWO.s lines 1810-1850 clears eight longs, then BSETs each room ID
    // from PLR1_Roompt's ToListOfGraph into the corresponding memory byte.
    const bytes = new Uint8Array(
      this.waterWorkspace.buffer, this.waterWorkspace.byteOffset, 32);
    bytes.fill(0);
    for (const zone of zones) {
      const room = Math.trunc(zone);
      if (room >= 0 && room < 256) bytes[room >> 3] |= 1 << (room & 7);
    }
    return true;
  }

  addPlayerDamage(damage) {
    if (this.browserCheats.invulnerability) {
      this.playerDamageTaken = 0;
      return 0;
    }
    // All released writers use ADD.B against the player object's byte, so
    // multiple attacks accumulate modulo 256 until the next USEPLR1 pass.
    this.playerDamageTaken = (this.playerDamageTaken + (damage & 255)) & 255;
    return this.playerDamageTaken;
  }

  consumePlayerDamage() {
    if (this.browserCheats.invulnerability) {
      this.playerDamageTaken = 0;
      return false;
    }
    const damage = this.playerDamageTaken & 255;
    if (!damage) return false;
    this.playerDamageTaken = 0;
    // USEPLR1 performs SUB.W without clamping; the signed-word result is also
    // what its death test observes.
    this.playerState.energy = signedWord(this.playerState.energy - damage);
    this.hitColour = 0xf00;
    this.events.push({
      type: 'player-damage', damage, energy: this.playerState.energy,
    });
    return true;
  }

  fadePlayerHitColour() {
    if (!this.hitColour) return false;
    // The top of newtwo.s:lop subtracts one red RGB12 step from both Copper
    // COLOR00 halves on every game pass until the word reaches zero.
    this.hitColour = (this.hitColour - 0x100) & 0xffff;
    return true;
  }

  setBrowserCheats(options = {}) {
    this.browserCheats = {
      invulnerability: Boolean(options.invulnerability),
      infiniteBullets: Boolean(options.infiniteBullets),
    };
    if (this.browserCheats.invulnerability) {
      this.playerDamageTaken = 0;
      this.hitColour = 0;
    }
    return { ...this.browserCheats };
  }

  resetBrightnessFlash() {
    if (!this.brightnessFlashActive) return false;
    // newtwo.s:donetalking rebuilds ZoneBrightTable and CurrentPointBrights
    // before objmoveanim on every game pass. A Flash therefore survives only
    // through the DrawDisplay which follows that object pass.
    this.zoneFlashLower.fill(0);
    this.zoneFlashUpper.fill(0);
    this.pointFlashLower.fill(0);
    this.pointFlashUpper.fill(0);
    this.brightnessFlashActive = false;
    return true;
  }

  flashZoneBrightness(zoneId, change) {
    const zone = this.level.zones[zoneId];
    if (!zone) return false;
    // anims:Flash compares the signed brightness word with -20 and replaces
    // values <= -20. ComputeBlast passes the negated explosion force.
    const delta = Math.max(-20, signedWord(change));
    const addZone = id => {
      if (id < 0 || id >= this.zoneFlashLower.length) return;
      this.zoneFlashLower[id] = signedWord(this.zoneFlashLower[id] + delta);
      this.zoneFlashUpper[id] = signedWord(this.zoneFlashUpper[id] + delta);
    };
    for (const pointId of zone.pointIds) {
      this.pointFlashLower[pointId] = signedWord(this.pointFlashLower[pointId] + delta);
      this.pointFlashUpper[pointId] = signedWord(this.pointFlashUpper[pointId] + delta);
    }
    // Flash first adds the source zone explicitly, then walks ToListOfGraph.
    // Packed graph lists begin with the source zone, so it receives delta twice.
    addZone(zoneId);
    for (const visible of zone.visibility) addZone(visible.zone);
    this.brightnessFlashActive = true;
    return true;
  }

  zoneBrightnessAdjustment(zoneId, upper = false) {
    return (upper ? this.zoneFlashUpper : this.zoneFlashLower)[zoneId] ?? 0;
  }

  pointBrightnessAdjustment(pointId, upper = false) {
    return (upper ? this.pointFlashUpper : this.pointFlashLower)[pointId] ?? 0;
  }

  checkLevelCompletion(player) {
    if (this.completed || this.playerState.energy <= 0 ||
        player.zone !== this.level.endZone) return false;
    this.completed = true;
    this.events.push({ type: 'level-complete', zone: player.zone });
    return true;
  }

  recordPlayerMovement(forwardStep, player) {
    if (!forwardStep) return false;
    // plr1control.s:PLR1_keyboard_control adds `d3 << 6` to the 12-bit
    // PLR1_clumptime word. Forward d3 is negative, so storing the counter in
    // units of 64 gives this subtraction and an exact 0..63 cycle.
    let phase = this.footstepPhase - signedWord(forwardStep);
    let sounded = false;
    while (phase < 0) {
      phase += CLUMP_PHASE_UNITS;
      sounded = true;
    }
    while (phase >= CLUMP_PHASE_UNITS) {
      phase -= CLUMP_PHASE_UNITS;
      sounded = true;
    }
    this.footstepPhase = phase;
    if (!sounded) return false;
    this.events.push({
      type: 'footstep', slot: this.playerFootstepSlot(player), volume: 80,
      relativeX: 0, relativeZ: 100,
    });
    return true;
  }

  playerFootstepSlot(player) {
    const zone = this.level.zones[player.zone];
    if (!zone) return 23;
    if (player.inUpper) return 23 + zone.upperFloorNoise;
    const playerY = (Number.isFinite(player.viewY) ? player.viewY :
      Number.isFinite(player.y) ? player.y : this.zoneFloor(player.zone) / 256 - 48) * 256;
    if (zone.water < this.zoneFloor(player.zone) && zone.water >= playerY) return 6;
    return 23 + zone.floorNoise;
  }

  selectGun(gun) {
    if (!WEAPONS.has(gun) || !this.playerState.guns[gun] || this.playerState.selectedGun === gun) {
      return false;
    }
    this.playerState.selectedGun = gun;
    this.events.push({ type: 'weapon-selected', gun });
    return true;
  }

  updateTeleport(player) {
    const fromZone = this.level.zones[player.zone];
    const teleport = fromZone?.teleport;
    if (!teleport || teleport.zone < 0) return false;
    const relativeY = (Number.isFinite(player.y)
      ? player.y : this.zoneFloor(player.zone) / 256 - 48) -
      this.zoneFloor(player.zone) / 256;
    const destination = {
      x: teleport.x,
      z: teleport.z,
      y: this.zoneFloor(teleport.zone) / 256 + relativeY,
      zone: teleport.zone,
      inUpper: Boolean(player.inUpper),
    };
    const blocker = this.teleportBlocker(destination, player);
    if (blocker) {
      this.events.push({
        type: 'teleport-blocked', fromZone: player.zone, toZone: teleport.zone,
        objectId: blocker.id,
      });
      return false;
    }
    const previousZone = player.zone;
    player.x = destination.x;
    player.z = destination.z;
    player.y = destination.y;
    player.zone = destination.zone;
    this.events.push({
      type: 'teleport', fromZone: previousZone, toZone: player.zone,
      x: player.x, z: player.z,
    });
    return true;
  }

  teleportBlocker(destination, player = destination) {
    return this.playerMovementBlocker(player, destination);
  }

  updateWeapon(player, fire, frames = 1) {
    const state = this.playerState;
    let changed = false;
    if (state.weaponFrame > 0) {
      state.weaponFrame = sourceGunFrameStep(state.weaponFrame, frames);
      changed = true;
    }
    const clicked = Boolean(fire) && !state.fireHeld;
    state.fireHeld = Boolean(fire);
    if (state.shotCooldown !== 0) {
      state.shotCooldown = sourceShotCooldownStep(state.shotCooldown, frames);
      return changed;
    }
    const weapon = WEAPONS.get(state.selectedGun);
    if (!weapon || !(weapon.hold ? fire : clicked)) return changed;
    const infiniteBullets = this.browserCheats.infiniteBullets;
    if (!infiniteBullets && state.ammo[state.selectedGun] < weapon.cost) {
      this.events.push({ type: 'empty-weapon', gun: state.selectedGun });
      return changed;
    }
    if (!infiniteBullets) state.ammo[state.selectedGun] -= weapon.cost;
    state.shotCooldown = weapon.delay;
    state.weaponFrame = weapon.animation.length - 1;
    const projectile = weapon.instant ? null : this.spawnProjectile(player, weapon);
    if (weapon.instant) this.resolveInstantShot(player, weapon);
    this.events.push({
      type: 'shot', gun: state.selectedGun, ammunition: state.ammo[state.selectedGun],
      ammunitionUsed: infiniteBullets ? 0 : weapon.cost,
      mode: weapon.instant ? 'instant' : 'projectile',
      projectileId: projectile?.id ?? null,
    });
    return true;
  }

  resolveInstantShot(player, weapon) {
    const target = this.instantTarget(player);
    if (!target) {
      const random = this.nextRandom();
      let ray = sourceInstantNoTargetMissRay(
        player.x, player.z, this.playerSourceY(player),
        playerSourceAngleUnits(player), random);
      if (Number.isFinite(player.browserAimSlope)) {
        ray = browserInstantAimRay(ray, player.browserAimSlope);
      }
      const point = this.traceInstantMoveObject({
        ...ray, zone: player.zone, inUpper: Boolean(player.inUpper),
      });
      const projectile = this.allocateInstantImpact(point, this.playerState.selectedGun);
      this.events.push({
        type: 'instant-miss', gun: this.playerState.selectedGun, targetId: null,
        projectileId: projectile?.id ?? null,
      });
      return;
    }

    const targetX = Number.isInteger(target.position.xFixed)
      ? sourceFixedHighWord(target.position.xFixed) : signedWord(Math.floor(target.position.x));
    const targetZ = Number.isInteger(target.position.zFixed)
      ? sourceFixedHighWord(target.position.zFixed) : signedWord(Math.floor(target.position.z));
    let missRay = sourceInstantTargetMissRay(
      player.x, player.z, this.playerSourceY(player), targetX, targetZ,
      this.level.objectScanTerminatorY);
    if (Number.isFinite(player.browserAimSlope)) {
      missRay = browserInstantAimRay(missRay, player.browserAimSlope);
    }
    for (let pellet = 0; pellet < weapon.pellets; pellet++) {
      const random = this.nextRandom() & 0x7fff;
      if (sourceInstantHit(
        random, player.x, player.z, target.position.x, target.position.z)) {
        const projectile = this.allocateInstantImpact({
          x: target.position.x, z: target.position.z, y: target.position.y,
          yFixed: signedWord(Math.floor(target.position.y)) << 7,
          // PLR1HITINSTANT copies both complete ObjectPoints longs from the
          // target; unlike the miss path, this also replaces the low words.
          xFixed: target.position.xFixed, zFixed: target.position.zFixed,
          zone: target.zone, inUpper: target.render.inUpper,
        }, this.playerState.selectedGun);
        if (projectile) {
          target.damageTaken = (target.damageTaken + weapon.damage) & 255;
          const source = sourceDirectionFromAngleUnits(playerSourceAngleUnits(player));
          target.impactX = signedWord(Math.floor(source.xFixed * 8 / 65536));
          target.impactZ = signedWord(Math.floor(source.zFixed * 8 / 65536));
        }
        this.events.push({
          type: 'instant-hit', gun: this.playerState.selectedGun, pellet,
          targetId: target.id, damage: projectile ? weapon.damage : 0,
          damageTaken: target.damageTaken, projectileId: projectile?.id ?? null,
        });
      } else {
        const point = this.traceInstantMoveObject({
          ...missRay, zone: player.zone, inUpper: Boolean(player.inUpper),
        });
        const projectile = this.allocateInstantImpact(point, this.playerState.selectedGun);
        this.events.push({
          type: 'instant-miss', gun: this.playerState.selectedGun, pellet,
          targetId: target.id, projectileId: projectile?.id ?? null,
        });
      }
    }
  }

  instantTarget(player) {
    return this.shotTarget(player)?.object ?? null;
  }

  shotTarget(player) {
    const { sinWord, cosWord } = sourceAngleTrig(playerSourceAngleUnits(player));
    const playerY = Math.trunc(this.playerSourceY(player) * 128) | 0;
    let best = null, bestDistance = 0x7fff, bestYDifference = 0;
    for (const object of this.objects) {
      const box = COLLISION_BOXES[object.type];
      if (!object.active || !box || !(object.state & 1) || object.zone < 0 ||
          !(PLAYER_TARGET_MASK & (1 << object.type)) || object.lives === 0) continue;
      const projection = sourceInstantProjection(
        player.x, player.z, object.position.x, object.position.z,
        sinWord, cosWord);
      const targetYDifference = ((signedWord(Math.floor(object.position.y)) << 7) - playerY) | 0;
      let yDifference = Number.isFinite(player.browserAimSlope)
        ? browserAimVerticalDifference(
          targetYDifference, projection.distance, player.browserAimSlope)
        : targetYDifference;
      if (yDifference < 0) yDifference = (-yDifference) | 0;
      const verticalProjection = sourceDivsWord(yDifference, 44);
      if (!projection.inLine || projection.lateral > box[0] ||
          verticalProjection > projection.distance ||
          bestDistance < projection.distance) continue;
      best = object;
      bestDistance = projection.distance;
      bestYDifference = targetYDifference;
    }
    return best ? {
      object: best, distance: bestDistance, yDifferenceFixed: bestYDifference,
    } : null;
  }

  nextRandom() {
    let value = (this.randomSeed + 29) & 0xffff;
    value ^= 0x5f37;
    value = (-value) & 0xffff;
    value = ((value << 5) | (value >>> 11)) & 0xffff;
    this.randomSeed = value;
    return value;
  }

  allocateInstantImpact(point, gun) {
    const object = this.playerShots.find(projectile => !projectile.active || projectile.zone < 0);
    if (!object || !point) return null;
    const retainedXVelocity = object.shot?.xVelocityFixed ??
      object.pooledShotXVelocityFixed ?? 0;
    const retainedZVelocity = object.shot?.zVelocityFixed ??
      object.pooledShotZVelocityFixed ?? 0;
    const retainedYVelocity = object.shot?.yVelocity ??
      object.pooledShotYVelocity ?? 0;
    const retainedLife = object.shot?.life ?? object.pooledShotLife ?? 0;
    const retainedFlags = object.shot?.flags ?? object.pooledShotFlags ?? 0;
    object.active = true;
    object.zone = point.zone;
    // playershoot.s PLR1HITINSTANT/PLR1MISSINSTANT/nothingtoshoot all
    // execute ST worry(a0) on the allocated PlayerShotData record.
    object.worry = 0xff;
    if (Number.isInteger(point.xFixed) && Number.isInteger(point.zFixed)) {
      // PLR1HITINSTANT uses MOVE.L for both target coordinates.
      object.position.xFixed = point.xFixed | 0;
      object.position.zFixed = point.zFixed | 0;
      object.position.x = sourceFixedHighWord(object.position.xFixed);
      object.position.z = sourceFixedHighWord(object.position.zFixed);
    } else {
      // nothingtoshoot/PLR1MISSINSTANT use MOVE.W newx/newz, preserving the
      // fractional halves already stored in this fixed pool record.
      this.writePooledShotPositionWords(object, point.x, point.z);
    }
    // All three instant allocation sites store a 25.7 long in accypos and
    // derive object word 4 with ASR.L #7. Keep the fraction and the downward
    // rounding for negative values.
    const yFixed = Number.isInteger(point.yFixed)
      ? point.yFixed | 0 : Math.trunc(point.y * 128) | 0;
    object.position.y = yFixed >> 7;
    // playershoot.s:nothingtoshoot, PLR1MISSINSTANT, and PLR1HITINSTANT do
    // not write ObjInTop in the reused 64-byte PlayerShotData record. Only
    // PLR1FIREBULLET does (line 715), so an instant effect retains this byte.
    object.shot = {
      gun, status: 1, animation: 0, life: retainedLife, damage: 0,
      // The instant-effect paths write shotgrav but not x/z/y velocity,
      // shotlife, or shotflags. Retain those exact pool overlays.
      xVelocityFixed: retainedXVelocity, zVelocityFixed: retainedZVelocity,
      yVelocity: retainedYVelocity,
      yFixed,
      gravity: 0, flags: retainedFlags, lifetime: -1,
    };
    return object;
  }

  playerSourceY(player) {
    const cameraY = Number.isFinite(player.viewY) ? player.viewY :
      Number.isFinite(player.y) ? player.y : this.zoneFloor(player.zone) / 256 - 48;
    return cameraY * 2;
  }

  traceInstantMoveObject(ray) {
    // playershoot.s:nothingtoshoot/.again and PLR1MISSINSTANT/.again advance
    // the same signed-word X/Z and signed-long 25.7 Y step until MoveObject's
    // exitfirst branch reports a wall. This is not a continuous browser ray.
    // playershoot.s and aliencontrol.s:SHOOTPLAYER1 install these same shared
    // globals immediately before their repeated MoveObject loop.
    this.moveObjectProfile = {
      thingHeight: 0, stepUp: 0, stepDown: 0x1000000,
    };
    this.moveObjectExtlen = 0;
    this.moveObjectAwayFromWall = -1;
    this.moveObjectExitFirst = true;
    // playershoot.s and aliencontrol.s install bit 10 ($400) for both instant
    // MoveObject ray loops before the first step.
    this.setMoveObjectWallKind('bullet');
    let oldX = signedWord(ray.x);
    let oldZ = signedWord(ray.z);
    let oldY = ray.startYFixed | 0;
    const xStep = signedWord(ray.dx);
    const zStep = signedWord(ray.dz);
    const yStep = ray.yStepFixed | 0;
    let zone = ray.zone;
    let inUpper = Boolean(ray.inUpper);

    for (;;) {
      const nextX = signedWord(oldX + xStep);
      const nextZ = signedWord(oldZ + zStep);
      const nextY = (oldY + yStep) | 0;
      let currentZone = zone;
      const roomPath = [];
      const wallContacts = [];
      const addWallContact = edge => {
        if (!wallContacts.includes(edge.id)) wallContacts.push(edge.id);
      };

      // playershoot.s repeats forever when both signed-word steps are zero:
      // MoveObject returns at objectmove line 27 without setting hitwall and
      // the caller branches straight back to .again. Report that source hang
      // instead of locking the browser's main thread.
      if (oldX === nextX && oldZ === nextZ) {
        throw new Error('released instant-shot MoveObject loop has a zero-length step');
      }

      // objectmove:MoveObject can cross more than one exit during one call.
      // Every transition restarts the destination room's source-ordered list.
      for (let roomPass = 0; roomPass <= this.level.zones.length; roomPass++) {
        const room = this.level.zones[currentZone];
        if (!room) throw new Error(`invalid MoveObject room ${currentZone}`);
        for (const edgeId of room.edgeIds) {
          const edge = this.level.edges[edgeId];
          const joined = edge.joinZone;
          const heights = joined >= 0 ? {
            lowerFloor: this.zoneFloor(joined),
            lowerRoof: this.zoneRoof(joined),
            upperFloor: this.level.zones[joined].upperFloor,
            upperRoof: this.level.zones[joined].upperRoof,
          } : SOURCE_SOLID_WALL_HEIGHTS;
          const crossingY = sourceInstantCrossingHeight(
            edge, oldX, oldZ, nextX, nextZ, oldY, nextY);
          if (sourceMoveObjectOpeningBlocks(crossingY, heights, 0, 0)) {
            const nextProbe = sourceMoveObjectWallProbe(
              edge, nextX, nextZ, 0, -1);
            if (nextProbe.side > 0 && nextProbe.quotient < 32) {
              addWallContact(edge);
            }
          }
          const hit = sourceInstantMoveObjectWallHit(
            edge, oldX, oldZ, nextX, nextZ, oldY, nextY, heights);
          if (!hit) continue;
          addWallContact(edge);
          this.writeMoveObjectRoomPath(roomPath);
          this.recordMoveObjectWallContacts(wallContacts);
          return {
            x: hit.x, z: hit.z,
            y: hit.yFixed >> 7, yFixed: hit.yFixed,
            zone: currentZone, inUpper, wallContacts,
          };
        }

        let crossed = null;
        for (const edgeId of room.edgeIds) {
          const edge = this.level.edges[edgeId];
          if (edge.joinZone < 0 ||
              sourceMoveObjectWallProbe(edge, nextX, nextZ, 0, -1).side >= 0 ||
              !sourceMovementCrossesEdge(edge, oldX, oldZ, nextX, nextZ)) continue;
          crossed = edge;
          break;
        }
        if (!crossed) break;
        const crossing = sourceInstantCrossingHeight(
          crossed, oldX, oldZ, nextX, nextZ, oldY, nextY);
        currentZone = crossed.joinZone;
        inUpper = crossing < this.zoneRoof(currentZone);
        roomPath.push(currentZone);
        if (roomPass === this.level.zones.length) {
          throw new Error('MoveObject room path exceeded released level zone count');
        }
      }

      // objectmove:stopandleave writes the terminator after every completed
      // nonzero MoveObject call, even when the shot remains in one room.
      this.writeMoveObjectRoomPath(roomPath);
      this.recordMoveObjectWallContacts(wallContacts);
      zone = currentZone;
      oldX = nextX;
      oldZ = nextZ;
      oldY = nextY;
    }
  }

  spawnProjectile(player, weapon) {
    const object = this.playerShots.find(projectile => !projectile.active || projectile.zone < 0);
    if (!object) return null;
    const direction = sourceDirectionFromAngleUnits(playerSourceAngleUnits(player));
    const target = this.shotTarget(player);
    const playerHeightFixed = Math.trunc(
      (Number.isFinite(player.height) ? player.height : 48) * 256) | 0;
    const sourceYVelocity = sourcePlayerBulletYVelocity(
      target?.yDifferenceFixed ?? 0, playerHeightFixed,
      target?.distance ?? 0x7fff, weapon.velocityShift,
      weapon.verticalVelocity || 0);
    const yVelocity = Number.isFinite(player.browserAimSlope) && !target
      ? browserProjectileYVelocity(
        sourceYVelocity, player.browserAimSlope, weapon.velocityShift)
      : sourceYVelocity;
    // Player1Shot adds 20*128 while caching tempyoff; PLR1FIREBULLET adds the
    // same amount again. Keep that source 25.7 long instead of rounding Y and
    // reconstructing a fractionless accypos.
    const yFixed = ((Math.trunc(this.playerSourceY(player) * 128) + 40 * 128) | 0);
    object.active = true;
    object.zone = player.zone;
    // playershoot.s PLR1FIREBULLET executes ST worry(a0) after assigning room.
    object.worry = 0xff;
    // playershoot.s stores the same d7 target bitmap used by its initial
    // line-up scan into EnemyFlags(a0) for ItsABullet's collision pass.
    object.enemyFlags = PLAYER_TARGET_MASK;
    this.writePooledShotPositionWords(object, player.x, player.z);
    object.position.y = yFixed >> 7;
    object.render.inUpper = player.inUpper ? 1 : 0;
    object.shot = {
      owner: 'player',
      gun: this.playerState.selectedGun,
      status: 0,
      animation: 0,
      life: 0,
      damage: weapon.damage,
      xVelocityFixed: direction.xFixed * (2 ** weapon.velocityShift),
      zVelocityFixed: direction.zFixed * (2 ** weapon.velocityShift),
      yVelocity,
      yFixed,
      gravity: weapon.gravity,
      flags: weapon.flags,
      lifetime: weapon.lifetime,
    };
    return object;
  }

  spawnEnemyProjectile(source, player, config) {
    const object = this.alienShots.find(projectile => !projectile.active || projectile.zone < 0);
    if (!object || !source?.active || source.zone < 0) return null;
    const ballistics = SOURCE_GUN_BALLISTICS[config.gun | 0];
    if (!ballistics) {
      throw new RangeError(`No released PLR1_GunData record for hostile gun ${config.gun}`);
    }
    // aliencontrol.s:FireAtPlayer1 writes zero to the shared Range word after
    // obtaining a free NastyShotData record and before its first HeadTowards.
    this.moveObjectRange = 0;
    const speed = signedWord(Math.max(1, config.speed | 0));
    let oldX = signedWord(Math.floor(source.position.x));
    let oldZ = signedWord(Math.floor(source.position.z));
    let targetX = signedWord(Math.floor(player.x));
    let targetZ = signedWord(Math.floor(player.z));
    const initialX = signedWord(targetX - oldX);
    const initialZ = signedWord(targetZ - oldZ);
    const initialDistance = sourceApproxDistance(initialX, initialZ, 2);
    // newtwo.s derives XDIFF1/ZDIFF1 by shifting the player's per-tick word
    // displacement left four. FireAtPlayer1 multiplies that value by the
    // CalcDist result, divides by SHOTSPEED, then shifts right four again.
    const playerXDifference = signedWord(Number.isFinite(player.sourceXDifference)
      ? player.sourceXDifference : Math.trunc(player.xVelocity || 0) << 4);
    const playerZDifference = signedWord(Number.isFinite(player.sourceZDifference)
      ? player.sourceZDifference : Math.trunc(player.zVelocity || 0) << 4);
    targetX = signedWord(targetX + (sourceDivsWord(
      Math.imul(playerXDifference, initialDistance), speed) >> 4));
    targetZ = signedWord(targetZ + (sourceDivsWord(
      Math.imul(playerZDifference, initialDistance), speed) >> 4));
    const futureX = targetX;
    const futureZ = targetZ;
    let movement = sourceHeadTowardsLinear(oldX, oldZ, targetX, targetZ, 0, speed);
    const muzzleOffset = config.muzzleOffset | 0;
    if (muzzleOffset) {
      const firstXStep = signedWord(movement.x - oldX);
      const firstZStep = signedWord(movement.z - oldZ);
      const acrossX = (Math.imul(firstXStep, signedWord(muzzleOffset)) >> 8);
      const acrossZ = (Math.imul(firstZStep, signedWord(muzzleOffset)) >> 8);
      oldX = signedWord(oldX + acrossZ);
      oldZ = signedWord(oldZ - acrossX);
      movement = sourceHeadTowardsLinear(oldX, oldZ, futureX, futureZ, 0, speed);
    }
    const x = movement.x;
    const z = movement.z;
    const xStep = signedWord(x - oldX);
    const zStep = signedWord(z - oldZ);
    const yOffsetFixed = config.yOffsetFixed | 0;
    const startYFixed = ((signedWord(Math.trunc(source.position.y)) << 7) + yOffsetFixed) | 0;
    const targetYFixed = (signedWord(Math.trunc(this.playerSourceY(player)) - 20) << 7) | 0;
    const divisor = Math.max(1, movement.distance >> (config.verticalShift | 0));

    object.active = true;
    object.zone = source.zone;
    // aliencontrol.s FireAtPlayer1 executes ST worry(a5) on NastyShotData.
    object.worry = 0xff;
    object.type = 2;
    object.typeName = 'projectile';
    // aliencontrol.s:FireAtPlayer1 installs this literal EnemyFlags mask.
    object.enemyFlags = 0x820;
    this.writePooledShotPositionWords(object, x, z);
    object.position.y = source.position.y;
    object.render.inUpper = config.inUpper ?? source.render.inUpper ? 1 : 0;
    const velocity = this.writePooledShotVelocityWords(object, xStep, zStep);
    object.shot = {
      owner: 'enemy', sourceId: source.id,
      gun: config.gun | 0, status: 0, animation: 0, life: 0,
      damage: config.damage | 0,
      xVelocityFixed: velocity.x, zVelocityFixed: velocity.z,
      yVelocity: sourceDivsWord(((targetYFixed - startYFixed) * 2) | 0, divisor),
      yFixed: startYFixed,
      gravity: ballistics.gravity,
      flags: ballistics.flags,
      lifetime: ballistics.lifetime,
    };
    this.events.push({
      type: 'enemy-projectile-fired', objectId: source.id, projectileId: object.id,
      gun: object.shot.gun, damage: object.shot.damage,
    });
    return object;
  }

  writePooledShotVelocityWords(object, xWord, zWord) {
    // FireAtPlayer1, ExplodeIntoBits, and ItsAGasPipe write MOVE.W at
    // defs.i:shotxvel/shotzvel (offsets 18 and 22), i.e. only the high word of
    // each 16.16 long. The low words survive allocation, impact, and reuse.
    const oldX = object.shot?.xVelocityFixed ?? object.pooledShotXVelocityFixed ?? 0;
    const oldZ = object.shot?.zVelocityFixed ?? object.pooledShotZVelocityFixed ?? 0;
    const x = ((signedWord(xWord) << 16) | (oldX & 0xffff)) | 0;
    const z = ((signedWord(zWord) << 16) | (oldZ & 0xffff)) | 0;
    object.pooledShotXVelocityFixed = x;
    object.pooledShotZVelocityFixed = z;
    return { x, z };
  }

  writePooledShotPositionWords(object, xWord, zWord) {
    // PLR1FIREBULLET, FireAtPlayer1, and ExplodeIntoBits all write MOVE.W to
    // the ObjectPoints X/Z longs. As with their velocity writes, allocation
    // replaces only the big-endian high word and leaves the pool record's
    // fractional low word untouched.
    object.position.xFixed = sourceWriteFixedHighWord(
      object.position.xFixed || 0, Math.floor(xWord));
    object.position.zFixed = sourceWriteFixedHighWord(
      object.position.zFixed || 0, Math.floor(zWord));
    object.position.x = sourceFixedHighWord(object.position.xFixed);
    object.position.z = sourceFixedHighWord(object.position.zFixed);
  }

  spawnGasPipeFlame(source) {
    const object = this.alienShots.find(projectile => !projectile.active || projectile.zone < 0);
    if (!object || !source?.active || source.zone < 0) return null;
    const { sinWord, cosWord } = sourceAngleTrig(source.facing);
    // anims:ItsAGasPipe sign-extends each sine word, ASL.L #4, swaps the
    // result, then writes its low word into the velocity long's high half.
    const xWord = (signedWord(sinWord) << 4) >> 16;
    const zWord = (signedWord(cosWord) << 4) >> 16;
    const velocity = this.writePooledShotVelocityWords(object, xWord, zWord);
    const y = signedWord(Math.trunc(source.position.y) - 80);

    object.active = true;
    object.type = 2;
    object.zone = source.zone;
    // anims:ItsAGasPipe writes #%100000100000 to EnemyFlags(a5).
    object.enemyFlags = 0x820;
    object.position.x = source.position.x;
    object.position.z = source.position.z;
    object.position.xFixed = source.position.xFixed | 0;
    object.position.zFixed = source.position.zFixed | 0;
    object.position.y = y;
    // ItsAGasPipe deliberately does not write ObjInTop; the pool byte keeps
    // its previous value, just like the two velocity low words above.
    object.worry = 0xff;
    object.shot = {
      owner: 'enemy', sourceId: source.id,
      gun: 3, status: 0, animation: 0, life: 0, damage: 7,
      xVelocityFixed: velocity.x, zVelocityFixed: velocity.z,
      yVelocity: 0, yFixed: y * 128,
      gravity: 0, flags: 0, enemyFlags: 0x820, lifetime: 50,
    };
    return object;
  }

  updateObjectHandler(player, frames = 1) {
    let changed = false;
    for (const object of this.objects) {
      // anims:ObjectHandler copies ObjRoom to GraphicRoom before testing worry
      // or ObjT_Type. That includes dormant scenery and free pool records.
      if (object.graphicZone !== object.zone) {
        object.graphicZone = object.zone;
        changed = true;
      }
      if (!object.active || object.zone < 0) continue;
      if (!object.worry) continue;

      const dispatchedType = object.type;
      if (dispatchedType === 2 && object.shot) {
        changed = this.updateProjectiles(player, frames, [object]) || changed;
        continue;
      }
      if (ENEMY_HANDLER_TYPES.has(dispatchedType)) {
        changed = this.updateEnemyBehavior(player, frames, [object]) || changed;
        // The browser-facing frame is derived from the fields written by that
        // one handler invocation; it is not another ObjectHandler visit.
        changed = this.updateObjects(player, [object]) || changed;
        changed = this.consumeObjectDamage(player, [object], true) || changed;
        continue;
      }
      if (!OBJECT_HANDLER_TYPES.has(dispatchedType)) continue;

      // ItsAMediKit, ItsABigGun, ItsAKey, ItsAnAmmoClip, and ItsABarrel all
      // clear worry at handler entry. The exploding-barrel branch returns
      // before its floor anchor and damage block.
      const wasExplodingBarrel = dispatchedType === 10 && Boolean(object.barrelExplosion);
      object.worry = 0;
      changed = true;
      changed = this.updateObjects(player, [object]) || changed;
      if (dispatchedType === 10 && !wasExplodingBarrel) {
        changed = this.consumeObjectDamage(player, [object], true) || changed;
      }
    }
    return changed;
  }

  updateProjectiles(player, frames = 1, projectiles = this.projectiles) {
    const elapsed = signedWord(frames);
    let changed = false;
    for (const object of projectiles) {
      if (!object.active || !object.shot) continue;
      changed = true;
      // anims:ItsABullet writes these two globals before the pop/flight split.
      this.moveObjectExtlen = 0;
      this.moveObjectAwayFromWall = -1;
      // ItsABullet copies word 12 to GraphicRoom before doing any lifetime,
      // animation, collision, or MoveObject work. Label `lab` performs the
      // second copy from objroom after MoveObject.
      object.graphicZone = object.zone;
      const shot = object.shot;
      const visuals = shot.gib ? GIB_VISUALS[shot.gibVariant] : PROJECTILE_VISUALS.get(shot.gun);
      if (shot.status) {
        if (!this.advanceProjectileVisual(object, visuals.impact, false)) this.freeProjectile(object);
        continue;
      }
      const lifetimeStep = sourceProjectileLifetimeStep(
        shot.life, shot.lifetime, elapsed);
      shot.life = lifetimeStep.life;
      this.advanceProjectileVisual(object, visuals.flight, true);
      const zone = this.level.zones[object.zone];
      const inUpper = Boolean(object.render.inUpper);
      const surface = sourceProjectileSurfaceStep(
        shot.yFixed, shot.yVelocity, shot.flags,
        inUpper ? zone.upperRoof : this.zoneRoof(object.zone),
        inUpper ? zone.upperFloor : this.zoneFloor(object.zone));
      if (surface) {
        shot.yFixed = surface.positionFixed;
        shot.yVelocity = surface.velocity;
        if (surface.dampen) this.dampenProjectile(object);
        if (surface.impact) {
          this.beginProjectileImpact(object, surface.surface, player);
        } else {
          this.events.push({
            type: 'projectile-bounce', projectileId: object.id,
            surface: surface.surface,
          });
        }
      }

      const oldXFixed = object.position.xFixed | 0;
      const oldZFixed = object.position.zFixed | 0;
      const nextXFixed = sourceProjectileAxisStep(
        oldXFixed, shot.xVelocityFixed, elapsed);
      const nextZFixed = sourceProjectileAxisStep(
        oldZFixed, shot.zVelocityFixed, elapsed);
      // ItsABullet passes the high words of oldx/newx/oldz/newz to MoveObject;
      // the fractional halves stay in the longs until ObjectPoints is updated.
      const oldX = sourceFixedHighWord(oldXFixed);
      const oldZ = sourceFixedHighWord(oldZFixed);
      const nextX = sourceFixedHighWord(nextXFixed);
      const nextZ = sourceFixedHighWord(nextZFixed);
      const oldYFixed = shot.yFixed | 0;
      const verticalStep = sourceProjectileVerticalStep(
        shot.yFixed, shot.yVelocity, shot.gravity, elapsed);
      shot.yVelocity = verticalStep.velocity;
      shot.yFixed = verticalStep.positionFixed;
      // anims:ItsABullet writes these globals immediately before its one
      // MoveObject call. Earlier roof/floor impacts intentionally inherit the
      // preceding handler's profile; wall/timeout/object impacts see this one.
      this.moveObjectProfile = { ...PROJECTILE_MOVE_OBJECT_PROFILE };
      // ItsABullet uses wallbounce for bit 0 and the inverse for exitfirst.
      this.moveObjectExitFirst = !(shot.flags & 1);
      this.setMoveObjectWallKind('bullet');
      let moveResult = {
        x: nextX, z: nextZ, yFixed: (shot.yFixed - 5 * 128) | 0,
        zone: object.zone, inUpper, hitWall: false,
        roomPath: null, staleRoomPath: true,
      };
      // anims:ItsABullet lines 2927-2939 deliberately skips MoveObject when
      // both high words are unchanged. Otherwise it calls the same recovered
      // source wall/portal traversal as every other object; the former
      // projectileZoneAt adjacent-room shortcut did not exist in the game.
      if (oldX !== nextX || oldZ !== nextZ) {
        const target = {
          x: nextX, z: nextZ, yFixed: (shot.yFixed - 5 * 128) | 0,
        };
        moveResult = shot.flags & 1
          ? this.traceMoveObjectSlide(object, target, {
            oldYFixed, extlen: 0, awayFromWall: -1,
            profile: this.moveObjectProfile, wallBounce: true,
          })
          : this.traceMoveObjectExitFirstPath(object, target, {
            oldYFixed, extlen: 0, awayFromWall: -1,
            profile: this.moveObjectProfile,
          });
      }
      object.render.inUpper = moveResult.inUpper ? 1 : 0;
      let wallImpact = false;
      if (moveResult.hitWall) {
        if (shot.flags & 1) {
          this.bounceProjectileFromWall(
            object, nextXFixed, nextZFixed, moveResult);
          object.position.y = Math.floor(shot.yFixed / 128);
          if (lifetimeStep.timeout) this.beginProjectileImpact(object, 'lifetime', player);
          continue;
        }
        // ItsABullet .notabouncything copies wallhitheight to accypos and the
        // object Y word, enters .hitsomething (which clears timeout), then
        // still falls through `lab` to store objroom/newx/newz and run the
        // target collision pass.
        shot.yFixed = moveResult.yFixed | 0;
        object.position.y = shot.yFixed >> 7;
        this.beginProjectileImpact(object, 'wall', player);
        wallImpact = true;
      }
      object.zone = moveResult.zone;
      // anims:ItsABullet label `lab` copies objroom to both word 12 and
      // GraphicRoom after MoveObject. Allocation still leaves GraphicRoom
      // untouched, but a portal crossing becomes drawable in its new room in
      // this same handler pass.
      object.graphicZone = moveResult.zone;
      object.position.x = moveResult.x;
      object.position.z = moveResult.z;
      object.position.xFixed = sourceWriteFixedHighWord(nextXFixed, moveResult.x);
      object.position.zFixed = sourceWriteFixedHighWord(nextZFixed, moveResult.z);
      // ShotRoutine stores accypos >> 7 into the object's Y word. ASR.L rounds
      // negative fixed-point positions downward; Math.round changed gib and
      // projectile height by one source unit on many frames.
      object.position.y = Math.floor(shot.yFixed / 128);
      if (lifetimeStep.timeout && !wallImpact) {
        this.beginProjectileImpact(object, 'lifetime', player);
      }
      if (shot.owner === 'enemy' && this.projectileHitsPlayer(
        object, player, oldX, oldZ, nextX, nextZ)) {
        const damageTaken = this.addPlayerDamage(shot.damage);
        this.events.push({
          type: 'enemy-projectile-hit', projectileId: object.id,
          objectId: shot.sourceId, damage: shot.damage, damageTaken,
        });
        this.beginProjectileImpact(object, 'player', player);
        continue;
      }
      const target = shot.owner === 'player'
        ? this.projectileTarget(object, oldX, oldZ, nextX, nextZ) : null;
      if (target) {
        target.damageTaken = (target.damageTaken + shot.damage) & 255;
        // ItsABullet reads shotxvel/shotzvel with MOVE.W. On the 68000's
        // big-endian object record those are the signed high words of the
        // 16.16 velocity longs; arithmetic shift preserves that result for
        // negative velocities with a non-zero fraction.
        target.impactX = sourceFixedHighWord(shot.xVelocityFixed);
        target.impactZ = sourceFixedHighWord(shot.zVelocityFixed);
        this.events.push({
          type: 'projectile-hit', projectileId: object.id, objectId: target.id,
          damage: shot.damage, damageTaken: target.damageTaken,
        });
        this.beginProjectileImpact(object, 'object', player);
      }
    }
    return changed;
  }

  projectileHitsPlayer(projectile, player, oldX, oldZ, nextX, nextZ) {
    const playerAnchorY = this.playerSourceY(player) +
      (Number.isFinite(player.height) ? player.height : 48);
    return sourceShotHitsTarget(
      oldX, oldZ, nextX, nextZ, projectile.position.y,
      player.x, player.z, playerAnchorY,
      PLAYER_COLLISION_RADIUS, PLAYER_COLLISION_HEIGHT);
  }

  advanceProjectileVisual(object, frames, loop) {
    let index = object.shot.animation;
    if (index >= frames.length) {
      if (!loop) return false;
      index = 0;
    }
    this.applyProjectileVisual(object, frames[index]);
    object.shot.animation = index + 1;
    return true;
  }

  applyProjectileVisual(object, frame) {
    const bitmap = PROJECTILE_BITMAP_SIZES.get(object.shot.gun);
    // anims:ItsABullet indexes BulletSizes with shotsize. Entries 50..53 are
    // all `$0808` (anims lines 2519-2521), so the explosion fragments use
    // eight-pixel source half-extents: 16x16 atlas frames. The `31` passed in
    // d3 to ExplodeIntoBits is its radius global and is never copied to bytes
    // 14/15 of the allocated shot record.
    const sourceSize = object.shot.gib ? 8 : object.shot.status ? bitmap.impact : bitmap.flight;
    object.render.width = frame.size;
    object.render.height = frame.height ?? frame.size;
    object.render.sourceWidth = sourceSize;
    object.render.sourceHeight = sourceSize;
    object.render.graphicType = frame.graphicType;
    object.render.frame = frame.frame;
    if (frame.yOffset) {
      // ItsABullet applies frame word 6 to both object Y and accypos (after
      // sign-extension and ASL.L #7), including impact-pop frames.
      object.position.y = signedWord(object.position.y + frame.yOffset);
      object.shot.yFixed = ((object.shot.yFixed | 0) +
        (signedWord(frame.yOffset) << 7)) | 0;
    }
  }

  beginProjectileImpact(object, reason, player = null) {
    // anims:ItsABullet has independent roof/floor, timeout, wall, and object
    // impact sites in one handler pass. It does not test shotstatus again
    // between them, so a later site can restart the pop and repeat its blast.
    object.shot.status = 1;
    object.shot.animation = 0;
    const force = EXPLOSIVE_FORCE[object.shot.gun] || 0;
    if (force) this.computeBlast(object, force, player);
    this.events.push({
      type: 'projectile-impact', projectileId: object.id,
      objectId: object.id, gun: object.shot.gun, reason,
    });
  }

  computeBlast(source, force, player = null) {
    // anims:ComputeBlast calls Flash before scanning its target mask.
    this.flashZoneBrightness(source.zone, signedWord(-force));
    const hitObjects = [];
    for (const object of this.objects) {
      if (!object.active || object.zone < 0 || object.type < 0 ||
          !(BLAST_TARGET_MASK & (1 << object.type)) ||
          !this.hasObjectLineOfSight(source, object)) continue;
      // anims:ComputeBlast keeps the point coordinates and deltas as signed
      // words.  Its three-step distance calculation has a released quirk: the
      // second MULS uses the retained Z delta rather than squaring the current
      // estimate.  Do not replace this with a symmetric square root.
      const dx = signedWord(Math.floor(object.position.x) - Math.floor(source.position.x));
      const dz = signedWord(Math.floor(object.position.z) - Math.floor(source.position.z));
      const distance = sourceBlastDistance(dx, dz);
      const distanceStep = Math.max(0, (distance >> 3) - 4);
      if (distanceStep > 31) continue;
      const falloff = 32 - distanceStep;
      const damage = Math.min(force, (Math.imul(signedWord(force), falloff) >> 5));
      object.damageTaken = (object.damageTaken + damage) & 255;
      object.impactX = sourceDivsWord(dx << 4, falloff);
      object.impactZ = sourceDivsWord(dz << 4, falloff);
      hitObjects.push({ objectId: object.id, damage, damageTaken: object.damageTaken });
    }
    let hitPlayer = null;
    if (player && (BLAST_TARGET_MASK & (1 << 5))) {
      const playerTarget = {
        x: player.x, z: player.z,
        y: this.playerSourceY(player) + (Number.isFinite(player.height) ? player.height : 48),
        zone: player.zone, inUpper: Boolean(player.inUpper),
      };
      const sourcePoint = {
        x: source.position.x, z: source.position.z, y: source.position.y,
        zone: source.zone, inUpper: Boolean(source.render.inUpper),
      };
      if (this.hasPointLineOfSight(sourcePoint, playerTarget)) {
        const dx = signedWord(Math.floor(player.x) - Math.floor(source.position.x));
        const dz = signedWord(Math.floor(player.z) - Math.floor(source.position.z));
        const distance = sourceBlastDistance(dx, dz);
        const distanceStep = Math.max(0, (distance >> 3) - 4);
        if (distanceStep <= 31) {
          const falloff = 32 - distanceStep;
          const damage = Math.min(force, (Math.imul(signedWord(force), falloff) >> 5));
          const damageTaken = this.addPlayerDamage(damage);
          this.playerImpactX = sourceDivsWord(dx << 4, falloff);
          this.playerImpactZ = sourceDivsWord(dz << 4, falloff);
          hitPlayer = {
            objectId: this.playerObjectId, damage, damageTaken,
            impactX: this.playerImpactX, impactZ: this.playerImpactZ,
          };
        }
      }
    }
    const debrisCount = this.spawnBlastDebris(source);
    this.events.push({
      type: 'blast', sourceId: source.id, force, hitObjects, hitPlayer, debrisCount,
    });
    return hitObjects;
  }

  spawnBlastDebris(source) {
    let count = 0;
    for (let radius = 2; radius <= 5; radius++) {
      for (let piece = 0; piece < 3; piece++) {
        const object = this.playerShots.find(projectile =>
          !projectile.active || projectile.zone < 0);
        if (!object) return count;
        const xOffset = sourceBlastDebrisHorizontalOffset(this.nextRandom(), radius);
        const zOffset = sourceBlastDebrisHorizontalOffset(this.nextRandom(), radius);
        const yOffsetFixed = sourceBlastDebrisVerticalOffsetFixed(
          this.nextRandom(), radius);
        const retainedXVelocity = object.shot?.xVelocityFixed ??
          object.pooledShotXVelocityFixed ?? 0;
        const retainedZVelocity = object.shot?.zVelocityFixed ??
          object.pooledShotZVelocityFixed ?? 0;
        const retainedYVelocity = object.shot?.yVelocity ??
          object.pooledShotYVelocity ?? 0;
        const retainedGravity = object.shot?.gravity ??
          object.pooledShotGravity ?? 0;
        const retainedLife = object.shot?.life ?? object.pooledShotLife ?? 0;
        const retainedFlags = object.shot?.flags ?? object.pooledShotFlags ?? 0;
        const point = this.traceBlastMoveObject(source, {
          x: signedWord(source.position.x + xOffset),
          z: signedWord(source.position.z + zOffset),
          yFixed: ((signedWord(Math.floor(source.position.y)) << 7) +
            yOffsetFixed) | 0,
        });
        const pointZone = this.level.zones[point.zone];
        // DOFLAMES chooses lower/upper planes from ObjInTop(a0), the blast
        // source, while taking those planes from objroom after MoveObject.
        const sourceInUpper = Boolean(source.render.inUpper);
        const yFixed = sourceBlastDebrisClampY(
          point.yFixed,
          sourceInUpper ? pointZone.upperFloor : this.zoneFloor(point.zone),
          sourceInUpper ? pointZone.upperRoof : this.zoneRoof(point.zone));
        object.active = true;
        object.zone = point.zone;
        object.type = 2;
        object.typeName = 'projectile';
        object.worry = 0xff;
        // ComputeBlast:DOFLAMES stores newx/newz with MOVE.W into the reused
        // ObjectPoints longs, leaving both fractional low words intact.
        this.writePooledShotPositionWords(object, point.x, point.z);
        // ComputeBlast keeps newy/accypos as 25.7 fixed and exposes it with
        // ASR.L #7, which floors negative fractions rather than rounding.
        object.position.y = yFixed >> 7;
        // DOFLAMES stores MoveObject's StoodInTop byte. It begins as the
        // source ObjInTop and changes only when the one movement crosses a
        // source portal.
        object.render.inUpper = point.inUpper ? 1 : 0;
        object.shot = {
          gun: 2, status: 0xff, animation: 5 - radius,
          life: retainedLife, damage: 0,
          // DOFLAMES does not write any velocity, gravity, life, or flag
          // overlay; status=1 makes ItsABullet take the pop path directly.
          xVelocityFixed: retainedXVelocity, zVelocityFixed: retainedZVelocity,
          yVelocity: retainedYVelocity,
          yFixed,
          gravity: retainedGravity, flags: retainedFlags,
          lifetime: -1, blastDebris: true,
        };
        count++;
      }
    }
    return count;
  }

  traceBlastMoveObject(source, target) {
    // anims:ComputeBlast:DOFLAMES performs exactly one MoveObject call with
    // exitfirst=0, wallbounce=0, extlen=80 and awayfromwall=1. MoveObject
    // projects blocked contacts along every primary wall in list order, checks
    // the second (-1..-2) proximity list, then restarts after each portal.
    this.moveObjectExtlen = 80;
    this.moveObjectAwayFromWall = 1;
    this.moveObjectExitFirst = false;
    return this.traceMoveObjectSlide(source, target, {
      extlen: this.moveObjectExtlen, awayFromWall: this.moveObjectAwayFromWall,
      profile: this.moveObjectProfile,
    });
  }

  traceMoveObjectSlide(source, target, options = {}) {
    const extlen = options.extlen ?? 0;
    const awayFromWall = options.awayFromWall ?? 0;
    const oldX = signedWord(Math.floor(source.position.x));
    const oldZ = signedWord(Math.floor(source.position.z));
    const oldY = Number.isInteger(options.oldYFixed)
      ? options.oldYFixed | 0 : signedWord(Math.floor(source.position.y)) << 7;
    // twoplayer.s:PLR1_Control (lines 1875-1885) copies the 16.16
    // p1_xoff/p1_zoff longs into newx/newz, while objectmove:MoveObject
    // consumes their first (signed high) words. For a negative fractional
    // coordinate that word is the
    // arithmetic floor, not JavaScript's truncation toward zero. The caller
    // later preserves the original low word; truncating here and restoring
    // that fraction injected +1 on every fractional tick at negative X/Z.
    let nextX = signedWord(Math.floor(target.x));
    let nextZ = signedWord(Math.floor(target.z));
    const nextY = target.yFixed | 0;
    let zone = source.zone;
    let inUpper = Boolean(source.render?.inUpper ?? source.inUpper);
    const roomPath = [];
    const wallContacts = [];
    const addWallContact = edge => {
      if (!wallContacts.includes(edge.id)) wallContacts.push(edge.id);
    };
    const profile = options.profile ?? this.moveObjectProfile;
    const wallBounce = Boolean(options.wallBounce);
    // objectmove:MoveObject clears hitwall on entry; both the primary-wall
    // .calcalong path and the -1..-2 OtherWalls path set it after accepting a
    // projection. Enemy handlers consume that flag even though the projected
    // newx/newz coordinates remain valid and are stored by the caller.
    let hitWall = false;
    let hitEdge = null;

    // objectmove lines 13 and 23-27 reset RoomPathPtr and hitwall, but return
    // before changing the shared RoomPath storage when both word deltas are
    // zero. No caller of the ordinary slide path reads the stale words here.
    if (oldX === nextX && oldZ === nextZ) {
      return {
        x: nextX, z: nextZ, yFixed: nextY, zone, inUpper,
        hitWall: false, hitEdge: null, roomPath: null, wallContacts,
        staleRoomPath: true,
      };
    }

    for (let roomPass = 0; roomPass <= this.level.zones.length; roomPass++) {
      const room = this.level.zones[zone];
      if (!room) throw new Error(`invalid ComputeBlast MoveObject room ${zone}`);
      for (const edgeId of room.edgeIds) {
        const edge = this.level.edges[edgeId];
        const joined = edge.joinZone;
        const heights = joined >= 0 ? {
          lowerFloor: this.zoneFloor(joined),
          lowerRoof: this.zoneRoof(joined),
          upperFloor: this.level.zones[joined].upperFloor,
          upperRoof: this.level.zones[joined].upperRoof,
        } : SOURCE_SOLID_WALL_HEIGHTS;
        const crossingY = sourceMoveObjectCrossingHeight(
          edge, oldX, oldZ, nextX, nextZ, oldY, nextY, extlen, awayFromWall);
        if (!sourceMoveObjectOpeningBlocks(
          crossingY, heights, profile.thingHeight, profile.stepUp)) continue;
        const nextProbe = sourceMoveObjectWallProbe(
          edge, nextX, nextZ, extlen, awayFromWall);
        // objectmove lines 183-194 OR wallflags while a blocked wall's
        // positive-side quotient is below 32, without changing hitwall.
        if (nextProbe.side > 0 && nextProbe.quotient < 32) addWallContact(edge);
        let slide;
        if (wallBounce) {
          // objectmove lines 255-291: wallbounce selects .calcbounce, stores
          // this wall's vector/length, and uses the same finite-wall contact
          // interpolation as exitfirst rather than .calcalong projection.
          slide = sourceMoveObjectFirstWallHit(
            edge, oldX, oldZ, nextX, nextZ, oldY, nextY, heights,
            profile.thingHeight, profile.stepUp, extlen, awayFromWall);
        } else {
          slide = sourceMoveObjectWallSlide(
            edge, oldX, oldZ, nextX, nextZ, extlen, awayFromWall);
        }
        if (!slide) continue;
        nextX = slide.x;
        nextZ = slide.z;
        hitWall = true;
        hitEdge = edge;
        // hitthewall at objectmove lines 442-450 ORs the same word after the
        // finite endpoint checks accept the projected/contact coordinate.
        addWallContact(edge);
      }

      if (extlen &&
          (oldX !== signedWord(Math.floor(target.x)) ||
           oldZ !== signedWord(Math.floor(target.z)))) {
        for (const edgeId of room.otherEdgeIds || []) {
          const edge = this.level.edges[edgeId];
          const joined = edge.joinZone;
          const heights = joined >= 0 ? {
            lowerFloor: this.zoneFloor(joined),
            lowerRoof: this.zoneRoof(joined),
            upperFloor: this.level.zones[joined].upperFloor,
            upperRoof: this.level.zones[joined].upperRoof,
          } : SOURCE_SOLID_WALL_HEIGHTS;
          if (!sourceMoveObjectOtherOpeningBlocks(
            nextY, heights, profile.thingHeight,
            profile.stepUp, profile.stepDown)) continue;
          const slide = sourceMoveObjectOtherWallSlide(
            edge, oldX, oldZ, nextX, nextZ, extlen, awayFromWall);
          if (!slide) continue;
          nextX = slide.x;
          nextZ = slide.z;
          hitWall = true;
          addWallContact(edge);
        }
      }

      let crossed = null;
      for (const edgeId of room.edgeIds) {
        const edge = this.level.edges[edgeId];
        if (edge.joinZone < 0 ||
            sourceMoveObjectWallProbe(edge, nextX, nextZ, 0, -1).side >= 0 ||
            !sourceMovementCrossesEdge(edge, oldX, oldZ, nextX, nextZ)) continue;
        crossed = edge;
        break;
      }
      if (!crossed) break;
      const crossingY = sourceMoveObjectCrossingHeight(
        crossed, oldX, oldZ, nextX, nextZ, oldY, nextY, 0, -1);
      zone = crossed.joinZone;
      inUpper = crossingY < this.zoneRoof(zone);
      roomPath.push(zone);
      if (roomPass === this.level.zones.length) {
        throw new Error('ComputeBlast MoveObject room path exceeded released level zone count');
      }
    }
    this.writeMoveObjectRoomPath(roomPath);
    this.recordMoveObjectWallContacts(wallContacts);
    return {
      x: nextX, z: nextZ, yFixed: nextY, zone, inUpper,
      hitWall, hitEdge, roomPath, wallContacts,
      staleRoomPath: false,
    };
  }

  writeMoveObjectRoomPath(roomPath) {
    // objectmove lines 978-980 append one destination word per crossed portal;
    // stopandleave lines 998-1002 append -1. The retail routine has no bounds
    // check and would overwrite RoomPathPtr after 100 non-negative words. No
    // recovered retail path reaches that corruption case, so keep it explicit.
    if (roomPath.length >= this.moveObjectRoomPath.length) {
      throw new Error('MoveObject RoomPath exceeds its released 100-word buffer');
    }
    for (let index = 0; index < roomPath.length; index++) {
      this.moveObjectRoomPath[index] = signedWord(roomPath[index]);
    }
    this.moveObjectRoomPath[roomPath.length] = -1;
  }

  readMoveObjectRoomPath() {
    // FindCloseRoom lines 2075-2081 and 2096-2102 scan the persistent buffer
    // until a negative word. Fresh BSS is all zero, so a zero-length probe
    // before any completed MoveObject would run beyond RoomPath into adjacent
    // RAM. Retail abd8ch $9610 embeds RoomPath=$9504 and RoomPathPtr=$95cc,
    // exactly 200 bytes later; the pointer's relocated low word is therefore
    // the first load-address-dependent value encountered after 100 zero words.
    // No load address is present in the recovered media, so that corrupt case
    // remains explicit rather than assuming an arbitrary relocation base.
    const roomPath = [];
    for (const room of this.moveObjectRoomPath) {
      if (room < 0) return roomPath;
      roomPath.push(room);
    }
    throw new Error(
      'unterminated released MoveObject RoomPath buffer; fresh startup scan ' +
      'depends on the relocated adjacent RoomPathPtr');
  }

  traceMoveObjectExitFirstPath(source, target, options = {}) {
    // objectmove:MoveObject with exitfirst set returns at the first accepted
    // primary or OtherWalls contact. Each traversed portal writes its
    // destination room word to RoomPath before restarting that room's list.
    const extlen = options.extlen ?? this.moveObjectExtlen;
    const awayFromWall = options.awayFromWall ?? this.moveObjectAwayFromWall;
    const profile = options.profile ?? this.moveObjectProfile;
    const oldX = signedWord(Math.floor(source.position.x));
    const oldZ = signedWord(Math.floor(source.position.z));
    const oldY = Number.isInteger(options.oldYFixed)
      ? options.oldYFixed | 0 : signedWord(Math.floor(source.position.y)) << 7;
    // See traceMoveObjectSlide: newx/newz are the signed high words of
    // 16.16 coordinates, including arithmetic-floor behavior below zero.
    const nextX = signedWord(Math.floor(target.x));
    const nextZ = signedWord(Math.floor(target.z));
    const nextY = target.yFixed | 0;
    let zone = source.zone;
    let inUpper = Boolean(source.render?.inUpper ?? source.inUpper);
    const roomPath = [];
    const wallContacts = [];
    const addWallContact = edge => {
      if (!wallContacts.includes(edge.id)) wallContacts.push(edge.id);
    };

    // MoveObject returns before changing RoomPath when both word deltas are
    // zero. FindCloseRoom immediately scans the persistent prior contents.
    if (oldX === nextX && oldZ === nextZ) {
      return {
        x: nextX, z: nextZ, yFixed: nextY, zone, inUpper, hitWall: false,
        roomPath: this.readMoveObjectRoomPath(), wallContacts,
        staleRoomPath: true,
      };
    }

    for (let roomPass = 0; roomPass <= this.level.zones.length; roomPass++) {
      const room = this.level.zones[zone];
      if (!room) throw new Error(`invalid FindCloseRoom MoveObject room ${zone}`);
      for (const edgeId of room.edgeIds) {
        const edge = this.level.edges[edgeId];
        const joined = edge.joinZone;
        const heights = joined >= 0 ? {
          lowerFloor: this.zoneFloor(joined),
          lowerRoof: this.zoneRoof(joined),
          upperFloor: this.level.zones[joined].upperFloor,
          upperRoof: this.level.zones[joined].upperRoof,
        } : SOURCE_SOLID_WALL_HEIGHTS;
        const crossingY = sourceMoveObjectCrossingHeight(
          edge, oldX, oldZ, nextX, nextZ, oldY, nextY, extlen, awayFromWall);
        if (!sourceMoveObjectOpeningBlocks(
          crossingY, heights, profile.thingHeight, profile.stepUp)) continue;
        const nextProbe = sourceMoveObjectWallProbe(
          edge, nextX, nextZ, extlen, awayFromWall);
        if (nextProbe.side > 0 && nextProbe.quotient < 32) addWallContact(edge);
        const hit = sourceMoveObjectFirstWallHit(
          edge, oldX, oldZ, nextX, nextZ, oldY, nextY, heights,
          profile.thingHeight, profile.stepUp, extlen, awayFromWall);
        if (hit) {
          addWallContact(edge);
          this.writeMoveObjectRoomPath(roomPath);
          this.recordMoveObjectWallContacts(wallContacts);
          return {
            ...hit, zone, inUpper, hitWall: true, roomPath,
            wallContacts, staleRoomPath: false,
          };
        }
      }

      if (extlen) {
        for (const edgeId of room.otherEdgeIds || []) {
          const edge = this.level.edges[edgeId];
          const joined = edge.joinZone;
          const heights = joined >= 0 ? {
            lowerFloor: this.zoneFloor(joined),
            lowerRoof: this.zoneRoof(joined),
            upperFloor: this.level.zones[joined].upperFloor,
            upperRoof: this.level.zones[joined].upperRoof,
          } : SOURCE_SOLID_WALL_HEIGHTS;
          if (!sourceMoveObjectOtherOpeningBlocks(
            nextY, heights, profile.thingHeight,
            profile.stepUp, profile.stepDown)) continue;
          const hit = sourceMoveObjectOtherWallSlide(
            edge, oldX, oldZ, nextX, nextZ, extlen, awayFromWall);
          if (hit) {
            addWallContact(edge);
            this.writeMoveObjectRoomPath(roomPath);
            this.recordMoveObjectWallContacts(wallContacts);
            return {
              ...hit, yFixed: nextY, zone, inUpper, hitWall: true, roomPath,
              wallContacts, staleRoomPath: false,
            };
          }
        }
      }

      let crossed = null;
      for (const edgeId of room.edgeIds) {
        const edge = this.level.edges[edgeId];
        if (edge.joinZone < 0 ||
            sourceMoveObjectWallProbe(edge, nextX, nextZ, 0, -1).side >= 0 ||
            !sourceMovementCrossesEdge(edge, oldX, oldZ, nextX, nextZ)) continue;
        crossed = edge;
        break;
      }
      if (!crossed) break;
      const crossingY = sourceMoveObjectCrossingHeight(
        crossed, oldX, oldZ, nextX, nextZ, oldY, nextY, 0, -1);
      zone = crossed.joinZone;
      inUpper = crossingY < this.zoneRoof(zone);
      roomPath.push(zone);
      if (roomPass === this.level.zones.length) {
        throw new Error('FindCloseRoom path exceeded released level zone count');
      }
    }
    this.writeMoveObjectRoomPath(roomPath);
    this.recordMoveObjectWallContacts(wallContacts);
    return { x: nextX, z: nextZ, yFixed: nextY, zone, inUpper,
      hitWall: false, roomPath, wallContacts, staleRoomPath: false };
  }

  findCloseRoom(object, player, distance) {
    // objectmove:FindCloseRoom (lines 2024-2126). HeadTowards uses the global
    // Range left by ViewpointToDraw/attack code; its resulting displacement is
    // rotated 90 degrees to form two lateral MoveObject probes.
    const oldX = signedWord(Math.floor(object.position.x));
    const oldZ = signedWord(Math.floor(object.position.z));
    const yFixed = signedWord(Math.floor(object.position.y)) << 7;
    const toward = sourceHeadTowardsLinear(
      oldX, oldZ, player.x, player.z,
      this.moveObjectRange, signedWord(distance));
    const acrossX = signedWord(oldZ - toward.z);
    const acrossZ = signedWord(toward.x - oldX);
    const profile = { thingHeight: 0, stepUp: 100000, stepDown: 100000 };
    this.moveObjectProfile = profile;
    this.moveObjectExitFirst = true;
    const first = this.traceMoveObjectExitFirstPath(object, {
      x: signedWord(oldX + acrossX), z: signedWord(oldZ + acrossZ), yFixed,
    }, { profile });
    const second = this.traceMoveObjectExitFirstPath(object, {
      x: signedWord(oldX - acrossX), z: signedWord(oldZ - acrossZ), yFixed,
    }, { profile });
    object.graphicZone = sourceFindCloseRoomSelection(
      object.zone, first.roomPath, second.roomPath, this.renderRoomOrder);
    return object.graphicZone;
  }

  consumeObjectDamage(player = null, objects = this.objects, handlerActive = false) {
    let changed = false;
    for (const object of objects) {
      const rule = DAMAGE_RULES.get(object.type);
      // Every recovered handler except the dormant eyeball reaches its damage
      // block only from the signed-positive TST.B numlives path. ItsAEyeBall
      // has no such entry test and is therefore intentionally exempt here.
      if (!object.active || object.zone < 0 ||
          (object.type !== 17 && signedByte(object.lives) <= 0) ||
          (!handlerActive && !object.worry) ||
          !rule || !object.damageTaken) continue;
      const accumulated = object.damageTaken & 0xff;
      let damageByte = sourceAsrByte(accumulated, rule.shift);
      if (!damageByte && rule.minimum) damageByte = rule.minimum;
      // Robot/tree armour branches around CLR.B damagetaken when the shifted
      // byte is zero, so the sub-threshold accumulator remains pending.
      if (!damageByte) continue;
      object.damageTaken = 0;
      const subtraction = sourceSubtractByte(object.lives, damageByte);
      object.lives = subtraction.greater ? subtraction.result : 0;
      const damage = signedByte(damageByte);
      changed = true;
      this.events.push({
        type: 'damage-consumed', objectId: object.id, objectType: object.type,
        accumulated, damage,
        lives: object.lives,
      });
      if (!subtraction.greater) {
        // All ordinary lethal paths are followed by a handler entry which
        // writes zero to numlives. Keep the browser death states canonical.
        this.killObject(object, accumulated, damageByte, player);
      } else {
        const slot = ENEMY_PAIN_SOUNDS.get(object.type);
        if (slot !== undefined) this.emitEnemySound(object, slot, 200, 'pain');
      }
    }
    return changed;
  }

  killObject(object, accumulatedDamage = 0, damage = accumulatedDamage, player = null) {
    object.dead = true;
    this.events.push({
      type: 'object-killed', objectId: object.id, objectType: object.type,
      accumulatedDamage, damage,
    });
    for (const sound of enemyDeathSounds(object.type, accumulatedDamage, damage)) {
      this.emitEnemySound(object, sound.slot, sound.volume, 'death');
    }
    const gibRequest = enemyGibRequest(object.type, accumulatedDamage, damage);
    if (gibRequest >= 0) this.spawnEnemyGibs(object, gibRequest);
    if (object.type === 17) {
      object.active = false;
      object.zone = -1;
      object.graphicZone = -1;
      this.events.push({ type: 'object-exploded', objectId: object.id, objectType: object.type });
      return;
    }
    if (object.type === 8) {
      // flyingscalyball.s compares the original damage byte with 40 using BGT.
      if (signedByte(accumulatedDamage) > 40) {
        object.active = false;
        object.zone = -1;
        object.graphicZone = -1;
        this.events.push({ type: 'object-vaporized', objectId: object.id, objectType: object.type });
        return;
      }
      object.thirdTimer = 30;
      object.fourthTimer = 0;
      object.render.frame = 18;
      object.forcedFrame = 18;
      object.fallingDeath = true;
      return;
    }
    if (object.type === 13) {
      object.thirdTimer = 25;
      object.render.frame = 18;
      object.forcedFrame = 18;
      return;
    }
    if (object.type === 16) {
      object.active = false;
      object.zone = -1;
      object.graphicZone = -1;
      this.events.push({ type: 'object-vaporized', objectId: object.id, objectType: object.type });
      return;
    }
    if (object.type === 14) {
      object.dead = false;
      object.type = 4;
      object.typeName = 'key';
      object.state = 8;
      object.worry = 0;
      object.render.graphicType = 5;
      object.render.frame = 3;
      object.render.width = 32;
      object.render.height = 32;
      object.render.sourceWidth = 16;
      object.render.sourceHeight = 16;
      object.forcedFrame = null;
      this.events.push({ type: 'boss-key-drop', objectId: object.id, keyMask: 8 });
      return;
    }
    if (object.type === 6) {
      this.computeBlast(object, object.robotAttacking ? 400 : 120, player);
      object.dead = false;
      object.type = 4;
      object.typeName = 'key';
      object.state = 8;
      object.worry = 0;
      object.render.graphicType = 5;
      object.render.frame = 3;
      object.render.width = 32;
      object.render.height = 32;
      object.render.sourceWidth = 16;
      object.render.sourceHeight = 16;
      object.forcedFrame = null;
      this.events.push({
        type: 'robot-key-drop', objectId: object.id, keyMask: 8,
        blastForce: object.robotAttacking ? 400 : 120,
      });
      return;
    }
    if (object.type === 0 || object.type === 12 || object.type === 18 || object.type === 19) {
      // normalalien.s and all three marine handlers save/restore d2 around
      // ExplodeIntoBits. The ASR.W #2 used for gib count therefore does not
      // alter the following signed-byte CMP #40.
      if (signedByte(accumulatedDamage) >= 40) {
        object.active = false;
        object.zone = -1;
        object.graphicZone = -1;
        this.events.push({ type: 'object-vaporized', objectId: object.id, objectType: object.type });
        return;
      }
      object.thirdTimer = 25;
      return;
    }
    if (object.type !== 10) return;
    // ItsABarrel installs frame zero in the lethal handler. The next
    // ObjectHandler pass immediately grows it and advances to frame one.
    object.barrelExplosion = { age: 0 };
    object.render.graphicType = 8;
    object.render.frame = 0;
    object.render.sourceWidth = 32;
    object.render.sourceHeight = 32;
    object.render.brightness = -30;
    this.computeBlast(object, 40, player);
  }

  spawnEnemyGibs(source, requestedCount, radius = 31) {
    let count = 0;
    // ExplodeIntoBits caps d2 at seven and loops through zero inclusively.
    let remaining = Math.min(7, Math.max(0, requestedCount | 0));
    while (remaining >= 0) {
      const object = this.alienShots.find(projectile => !projectile.active || projectile.zone < 0);
      if (!object) break;
      const sineOffset = this.nextRandom() & 8190;
      const shift = (this.nextRandom() & 3) + 1;
      // ExplodeIntoBits indexes the shipped `bigsine` words by an even byte
      // offset, reads cosine 2048 bytes later, shifts the signed longs, and
      // takes their high words. ASR.W also rounds negative inherited impact
      // halves downward.
      const { sinWord: sine, cosWord: cosine } = sourceAngleTrig(sineOffset);
      const xVelocity = (sine * (2 ** shift) >> 16) +
        (signedWord(source.impactX || 0) >> 1);
      const zVelocity = (cosine * (2 ** shift) >> 16) +
        (signedWord(source.impactZ || 0) >> 1);
      const yVelocity = -((this.nextRandom() & 1023) + 256);
      const variant = remaining & 3;
      object.active = true;
      object.zone = source.zone;
      object.damageTaken = 0;
      object.lives = 0;
      object.type = 2;
      object.typeName = 'projectile';
      // anims:ExplodeIntoBits explicitly clears EnemyFlags(a5).
      object.enemyFlags = 0;
      this.writePooledShotPositionWords(
        object, source.position.x, source.position.z);
      object.position.y = signedWord(signedWord(Math.floor(source.position.y)) + 6);
      object.render.inUpper = source.render.inUpper ? 1 : 0;
      const velocity = this.writePooledShotVelocityWords(object, xVelocity, zVelocity);
      object.shot = {
        owner: 'gib', sourceId: source.id, gun: 50 + variant,
        gib: true, gibVariant: variant,
        status: 0, animation: 0, life: -1, damage: 0,
        xVelocityFixed: velocity.x, zVelocityFixed: velocity.z,
        yVelocity, yFixed: object.position.y * 128,
        gravity: 40, flags: 0, lifetime: -1, radius,
      };
      count++;
      remaining--;
    }
    if (count) {
      // ExplodeIntoBits ends each successful allocation with ST worry(a0).
      // a0 is still the dying source record, not the new gib in a5.
      source.worry = 0xff;
      this.events.push({
        type: 'enemy-gibs', objectId: source.id, objectType: source.type, count, radius,
      });
    }
    return count;
  }

  updateEnemyBehavior(player, frames = 1, objects = this.objects) {
    let changed = false;
    for (const object of objects) {
      if (!object.active || object.zone < 0) continue;
      // anims:ObjectHandler copies word 12 to GraphicRoom before it tests
      // worry or dispatches on the object type. Because OtherNastyData follows
      // placed objects, a tree-spawned eyeball receives this write later in the
      // very same table walk even though TreeAttackPLR1 did not write it.
      if (object.graphicZone !== object.zone) {
        object.graphicZone = object.zone;
        changed = true;
      }
      if (!object.worry) continue;
      const moveProfile = ENEMY_MOVE_OBJECT_PROFILES.get(object.type);
      // Every released enemy except the robot installs these globals at entry.
      // robot.s calls FindCloseRoom first, then clears exitfirst and installs
      // its own 160/2/160*128 profile (lines 23-34).
      if (moveProfile && object.type !== 6) {
        this.moveObjectProfile = { ...moveProfile };
        this.moveObjectExtlen = ENEMY_EXTLEN.get(object.type) ?? 0;
        this.moveObjectAwayFromWall = ENEMY_AWAY_FROM_WALL.get(object.type) ?? 0;
      }
      // flyingscalyball.s:ItsAFlyingNasty alone clears exitfirst at entry.
      if (object.type === 8) this.moveObjectExitFirst = false;
      if (object.type === 0) changed = this.updateNormalAlien(object, player, frames) || changed;
      else if (object.type === 12) changed = this.updateMutantMarine(object, player, frames) || changed;
      else if (object.type === 18) changed = this.updateToughMarine(object, player, frames) || changed;
      else if (object.type === 19) changed = this.updateFlameMarine(object, player, frames) || changed;
      else if (object.type === 8) changed = this.updateFlyingScalyBall(object, player, frames) || changed;
      else if (object.type === 17) changed = this.updateEyeball(object, player, frames) || changed;
      else if (object.type === 13) changed = this.updateHalfWorm(object, player, frames) || changed;
      else if (object.type === 16) changed = this.updateTree(object, player, frames) || changed;
      else if (object.type === 14) changed = this.updateBigClaws(object, player, frames) || changed;
      else if (object.type === 6) changed = this.updateRobot(object, player, frames) || changed;
      else if (object.type === 20) changed = this.updateGasPipe(object, frames) || changed;
    }
    return changed;
  }

  updateGasPipe(object, frames = 1) {
    // anims:ItsAGasPipe. A visible-room wake runs one timer step, then clears
    // worry. After ObjTimer idle frames it emits five flames, spaced by the
    // strict FourthTimer < 0 test; sample 22 is requested only as SecTimer
    // becomes four (the first flame of the normal five-shot burst).
    object.worry = 0;
    const elapsed = signedWord(frames);
    if (object.thirdTimer > 0) {
      object.thirdTimer = signedWord(object.thirdTimer - elapsed);
      object.secondTimer = 5;
      object.fourthTimer = 10;
      return true;
    }
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer >= 0) return true;
    object.fourthTimer = 10;
    object.secondTimer = signedWord(object.secondTimer - 1);
    if (object.secondTimer <= 0) object.thirdTimer = signedWord(object.timer);
    if (object.secondTimer === 4) this.emitEnemySound(object, 22, 200, 'gas-pipe');
    this.spawnGasPipeFlame(object);
    return true;
  }

  updateHalfWorm(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.render.graphicType = 13;
    object.render.width = 90;
    object.render.height = 100;
    object.render.sourceWidth = 45;
    object.render.sourceHeight = 50;
    this.decayEnemyWorry(object);
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      object.render.frame = object.thirdTimer <= 5 ? 20 : object.thirdTimer <= 15 ? 19 : 18;
      object.forcedFrame = object.render.frame;
      this.anchorNormalAlien(object, 100);
      this.findCloseRoom(object, player, 80);
      return true;
    }
    // halfworm.s:ViewpointToDraw installs Range=-60 before either live branch.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    const attacking = canSeePlayer && object.thirdTimer <= 0;
    if (attacking) {
      this.attackWithHalfWorm(object, player, elapsed);
    } else {
      object.forcedFrame = null;
      if (canSeePlayer) {
        object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      }
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      this.patrolWithGroundCaster(object, player, HALF_WORM_PATROL_MASK, { frames: elapsed });
    }
    this.anchorNormalAlien(object, 100);
    this.findCloseRoom(object, player, 80);
    if (attacking) this.updateToughMarineAttackTimer(object, elapsed);
    else this.updateNormalAlienAmbientTimers(object, 100, elapsed);
    return true;
  }

  updateTree(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.render.graphicType = 15;
    object.render.width = 128;
    object.render.height = 128;
    object.render.sourceWidth = 32;
    object.render.sourceHeight = 32;
    this.decayEnemyWorry(object);
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      return true;
    }
    // tree.s:ViewpointToDraw installs Range=-60 before either live branch.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    const attacking = canSeePlayer && object.thirdTimer <= 0;
    if (attacking) {
      this.attackWithTree(object, player, elapsed);
    } else {
      object.forcedFrame = null;
      if (canSeePlayer) {
        object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      }
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      this.patrolWithGroundCaster(object, player, TREE_PATROL_MASK, { frames: elapsed });
    }
    this.anchorNormalAlien(object, 100);
    if (attacking) this.updateToughMarineAttackTimer(object, elapsed);
    else this.updateNormalAlienAmbientTimers(object, 100, elapsed);
    return true;
  }

  updateBigClaws(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.render.graphicType = 14;
    object.render.width = 128;
    object.render.height = 128;
    object.render.sourceWidth = 64;
    object.render.sourceHeight = 64;
    this.decayEnemyWorry(object);
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      object.render.frame = Math.min(9, object.render.frame + 1);
      object.forcedFrame = object.render.frame;
      this.anchorNormalAlien(object, 128);
      return true;
    }
    // bigclaws.s:ViewpointToDraw installs Range=-60 before either live branch.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    const attacking = canSeePlayer && object.thirdTimer <= 0;
    if (attacking) {
      this.attackWithBigClaws(object, player, elapsed);
    } else {
      object.forcedFrame = null;
      if (canSeePlayer) {
        object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      }
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      this.patrolWithGroundCaster(object, player, MARINE_PATROL_MASK, {
        fourthTimer: 70, bodyHeight: 256, anchorHeight: 128, directionTimer: 150,
        frames: elapsed,
      });
    }
    this.anchorNormalAlien(object, 128);
    if (attacking) this.updateToughMarineAttackTimer(object, elapsed);
    else this.updateNormalAlienAmbientTimers(object, 100, elapsed);
    return true;
  }

  updateRobot(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    // robot.s:ItsARobot calls FindCloseRoom before changing any MoveObject
    // global, so this consumes the preceding handler's exact shared state.
    this.findCloseRoom(object, player, 100);
    this.moveObjectExitFirst = false;
    this.moveObjectExtlen = 160;
    this.moveObjectAwayFromWall = 2;
    this.moveObjectProfile = { ...ENEMY_MOVE_OBJECT_PROFILES.get(6) };
    object.facing = (object.facing - 2048) & 8190;
    object.worry = (object.worry - 1) & 255;
    object.maximumSpeed = 10;
    const nextRobotFrame = signedWord(this.robotFrame + elapsed);
    // robot.s clears ROBFRAME when the one TempFrames addition reaches 43;
    // it does not preserve an overshoot with a modulo operation.
    this.robotFrame = nextRobotFrame >= 43 ? 0 : nextRobotFrame;
    object.render.frame = this.robotFrame >> 1;
    object.forcedFrame = object.render.frame;
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      object.active = false;
      object.zone = -1;
      object.graphicZone = -1;
      return true;
    }
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    let attack = canSeePlayer && object.thirdTimer <= 0;
    if (!attack) {
      if (canSeePlayer) {
        object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      }
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      object.fourthTimer = 30;
      object.timer = signedWord(object.timer - elapsed);
      if (object.timer <= 0 && canSeePlayer) {
        attack = true;
      } else {
        if (object.timer <= 0) {
          object.controlPoint = this.nextRandom() & 8190;
          object.timer = (this.nextRandom() & 63) + 100;
        }
        this.wanderWithRobot(object, player, elapsed);
      }
    }
    if (attack) this.attackWithRobot(object, player, elapsed);
    object.robotAttacking = attack;
    this.anchorNormalAlien(object, 120);
    object.facing = (object.facing + 2048) & 8190;
    return true;
  }

  wanderWithRobot(object, player, frames = 1) {
    const turn = robotSteering(object.facing, object.controlPoint, 120);
    object.facing = (object.facing + turn.amount) & 8190;
    const speed = turn.canAdvance
      ? signedWord(object.maximumSpeed * signedWord(frames)) : 0;
    const direction = sourceGoInDirection(0, 0, object.facing, speed);
    const dx = direction.xStep;
    const dz = direction.zStep;
    if (!this.tryMoveEnemy(object, dx, dz, 0, player, false, 160, 120)) {
      object.timer = -1;
    }
  }

  attackWithRobot(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    // robot.s:RobotAttackPLR1 stores 300 in the shared Range word.
    this.moveObjectRange = 300;
    const movement = sourceHeadTowards(
      object.position.x, object.position.z, player.x, player.z,
      300, signedWord(object.maximumSpeed * elapsed));
    const desiredHeading = movement.heading;
    if (movement.x !== signedWord(Math.trunc(object.position.x)) ||
        movement.z !== signedWord(Math.trunc(object.position.z))) {
      this.tryMoveEnemy(
        object, signedWord(movement.x - Math.trunc(object.position.x)),
        signedWord(movement.z - Math.trunc(object.position.z)),
        0, player, true, 160, 120);
    }

    const turn = robotSteeringToWords(
      object.facing, desiredHeading.sinWord, desiredHeading.cosWord, 240);
    object.facing = (object.facing + turn.amount) & 8190;
    object.maximumSpeed = turn.canAdvance ? 4 : 0;
    if (!turn.canShoot || object.fourthTimer >= 20) return;

    object.fourthTimer = 50;
    object.thirdTimer = signedWord(object.thirdTimer - 1);
    if (object.thirdTimer < -1) {
      object.thirdTimer = ((this.nextRandom() >>> 4) & 127) + 150;
    }
    // robot.s:RobotAttackPLR1 writes -100 to object word 2 immediately
    // before FireAtPlayer1.
    object.render.brightness = -100;
    this.spawnEnemyProjectile(object, player, {
      gun: 4, damage: 10, speed: 16, verticalShift: 3,
      muzzleOffset: 0, yOffsetFixed: 0,
      inUpper: object.render.inUpper,
    });
  }

  decayEnemyWorry(object) {
    const retained = object.worry & 0x80;
    object.worry = retained | Math.max(0, (object.worry & 0x7f) - 1);
  }

  patrolWithGroundCaster(object, player, collisionMask, options = {}) {
    const fourthTimer = options.fourthTimer ?? 30;
    const bodyHeight = options.bodyHeight ?? 200;
    const anchorHeight = options.anchorHeight ?? 100;
    const directionTimer = options.directionTimer ?? 50;
    const elapsed = signedWord(options.frames ?? 1);
    object.fourthTimer = fourthTimer;
    if (this.teleportEnemy(object, player, anchorHeight, bodyHeight)) return;
    const speed = signedWord(object.maximumSpeed * elapsed);
    const direction = sourceGoInDirection(0, 0, object.facing, speed);
    const dx = direction.xStep;
    const dz = direction.zStep;
    if (!this.tryMoveEnemy(
      object, dx, dz, collisionMask, player, false, bodyHeight, anchorHeight)) {
      object.timer = -1;
    }
    object.timer = signedWord(object.timer - elapsed);
    if (object.timer < 0) {
      object.facing = this.nextRandom() & 8190;
      object.timer = directionTimer;
    }
  }

  moveGroundCasterTowardPlayer(object, player, bodyHeight = 200, anchorHeight = 100,
      frames = 1) {
    const oldX = signedWord(Math.floor(object.position.x));
    const oldZ = signedWord(Math.floor(object.position.z));
    // The five ground-caster attack labels write 80 to the shared Range word
    // immediately before HeadTowardsAng.
    this.moveObjectRange = 80;
    const movement = sourceHeadTowards(
      object.position.x, object.position.z, player.x, player.z,
      80, signedWord(object.maximumSpeed * signedWord(frames)));
    if (movement.heading.distance) object.facing = movement.heading.angleUnits;
    const moveX = signedWord(movement.x - Math.trunc(object.position.x));
    const moveZ = signedWord(movement.z - Math.trunc(object.position.z));
    if (!moveX && !moveZ) return;
    this.tryMoveEnemy(
      object, moveX, moveZ,
      0, player, true, bodyHeight, anchorHeight);
    // The one-player attack labels in toughmarine.s, flamemarine.s,
    // halfworm.s, tree.s and bigclaws.s deliberately store oldx/oldz after
    // MoveObject. objroom and StoodInTop still retain MoveObject's result.
    this.restoreEnemyAttackCoordinates(object, oldX, oldZ);
  }

  restoreEnemyAttackCoordinates(object, oldX, oldZ) {
    object.position.xFixed = sourceWriteFixedHighWord(
      object.position.xFixed || 0, oldX);
    object.position.zFixed = sourceWriteFixedHighWord(
      object.position.zFixed || 0, oldZ);
    object.position.x = sourceFixedHighWord(object.position.xFixed);
    object.position.z = sourceFixedHighWord(object.position.zFixed);
  }

  groundCasterAttackFrame(object, player) {
    const facing = objectFacingFrame(object, player) * 4;
    return facing || 16;
  }

  attackWithHalfWorm(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer <= 0) object.thirdTimer = 50;
    this.moveGroundCasterTowardPlayer(object, player, 200, 100, elapsed);
    object.render.frame = this.groundCasterAttackFrame(object, player);
    object.forcedFrame = object.render.frame;
    if (object.fourthTimer >= 20) return;

    object.fourthTimer = 30;
    object.thirdTimer = signedWord(object.thirdTimer - 1);
    if (object.thirdTimer < -3) {
      object.thirdTimer = ((this.nextRandom() >>> 4) & 255) + 100;
    }
    object.render.frame = 17;
    object.forcedFrame = 17;
    // halfworm.s:NastyAttackPLR1 writes -100 to object word 2 before firing.
    object.render.brightness = -100;
    this.spawnEnemyProjectile(object, player, {
      gun: 5, damage: 10, speed: 16, verticalShift: 3,
      muzzleOffset: 700, yOffsetFixed: -10 * 128,
      inUpper: object.render.inUpper,
    });
  }

  attackWithTree(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer <= 0) object.thirdTimer = 50;
    this.moveGroundCasterTowardPlayer(object, player, 200, 100, elapsed);
    object.render.frame = this.groundCasterAttackFrame(object, player);
    object.forcedFrame = object.render.frame;
    if (object.fourthTimer >= 20) return;

    object.fourthTimer = 30;
    object.thirdTimer = (this.nextRandom() & 127) + 300;
    object.render.frame = 17;
    object.forcedFrame = 17;
    this.spawnTreeEyeball(object);
  }

  attackWithBigClaws(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer <= 0) object.thirdTimer = 50;
    this.moveGroundCasterTowardPlayer(object, player, 256, 128, elapsed);
    object.render.frame = this.groundCasterAttackFrame(object, player);
    object.forcedFrame = object.render.frame;
    if (object.fourthTimer >= 20) return;

    object.fourthTimer = 30;
    object.thirdTimer = signedWord(object.thirdTimer - 1);
    if (object.thirdTimer < -1) object.thirdTimer = (this.nextRandom() & 127) + 100;
    object.render.frame = 17;
    object.forcedFrame = 17;
    // bigclaws.s:NastyAttackPLR1 writes -100 to object word 2 before firing.
    object.render.brightness = -100;
    this.spawnEnemyProjectile(object, player, {
      gun: 2, damage: 10, speed: 64, verticalShift: 6,
      muzzleOffset: -700, yOffsetFixed: -10 * 128,
      inUpper: object.render.inUpper,
    });
  }

  spawnTreeEyeball(tree) {
    const eye = this.otherNasties.find(object => !object.active || object.zone < 0);
    if (!eye) return null;
    // tree.s:TreeAttackPLR1 .foundonefree writes only FourthTimer,
    // ThirdTimer, ObjTimer, maxspd, type, Y, lives, damage, Facing, both full
    // ObjectPoints longs, zone, and worry. In particular it preserves the
    // reused slot's state byte, GraphicRoom, display fields, layer, SecTimer,
    // and the remaining enemy overlay.
    eye.active = true;
    eye.dead = false;
    eye.type = 17;
    eye.typeName = 'eyeball';
    eye.zone = tree.zone;
    eye.position.xFixed = Number.isInteger(tree.position.xFixed)
      ? tree.position.xFixed | 0 : (Math.trunc(tree.position.x * 65536) | 0);
    eye.position.zFixed = Number.isInteger(tree.position.zFixed)
      ? tree.position.zFixed | 0 : (Math.trunc(tree.position.z * 65536) | 0);
    eye.position.x = sourceFixedHighWord(eye.position.xFixed);
    eye.position.z = sourceFixedHighWord(eye.position.zFixed);
    eye.position.y = signedWord(Math.trunc(tree.position.y));
    eye.lives = 10;
    eye.damageTaken = 0;
    eye.maximumSpeed = 5;
    eye.timer = 100;
    eye.thirdTimer = 100;
    eye.fourthTimer = 100;
    eye.worry = 255;
    this.events.push({ type: 'tree-spawned-eyeball', objectId: tree.id, eyeballId: eye.id });
    return eye;
  }

  updateToughMarine(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    const retained = object.worry & 0x80;
    object.worry = retained | Math.max(0, (object.worry & 0x7f) - 1);
    object.render.graphicType = 16;
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      object.render.frame = object.thirdTimer <= 5 ? 18 : object.thirdTimer <= 15 ? 17 : 16;
      this.anchorNormalAlien(object, 64);
      return true;
    }
    // toughmarine.s calls ViewpointToDraw before its live state split.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    if (canSeePlayer && object.thirdTimer <= 0) {
      // toughmarine.s:ToughMarineAttack writes ViewpointToDraw*4 without
      // adding alframe, so its attack stance does not use the walk cycle.
      object.forcedFrame = objectFacingFrame(object, player) * 4;
      this.attackWithToughMarine(object, player, elapsed);
      this.updateToughMarineAttackTimer(object, elapsed);
    } else {
      object.forcedFrame = null;
      if (canSeePlayer) object.thirdTimer = signedWord(object.thirdTimer - elapsed);
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      this.patrolWithToughMarine(object, player, elapsed);
      this.updateNormalAlienAmbientTimers(object, 100, elapsed);
    }
    this.anchorNormalAlien(object, 64);
    return true;
  }

  updateMutantMarine(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    const retained = object.worry & 0x80;
    object.worry = retained | Math.max(0, (object.worry & 0x7f) - 1);
    object.render.graphicType = 10;
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      object.render.frame = object.thirdTimer <= 5 ? 18 : object.thirdTimer <= 15 ? 17 : 16;
      this.anchorNormalAlien(object, 64);
      return true;
    }
    // mutantmarine.s calls ViewpointToDraw before its live state split.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    if (canSeePlayer && object.thirdTimer <= 0) {
      // mutantmarine.s:MutMarAttack uses the same unanimated facing-group write.
      object.forcedFrame = objectFacingFrame(object, player) * 4;
      this.attackWithMutantMarine(object, player, elapsed);
      this.updateToughMarineAttackTimer(object, elapsed);
    } else {
      object.forcedFrame = null;
      if (canSeePlayer) object.thirdTimer = signedWord(object.thirdTimer - elapsed);
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      this.patrolWithMarine(object, player, 25, elapsed);
      this.updateNormalAlienAmbientTimers(object, 100, elapsed);
    }
    this.anchorNormalAlien(object, 64);
    return true;
  }

  updateFlameMarine(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    const retained = object.worry & 0x80;
    object.worry = retained | Math.max(0, (object.worry & 0x7f) - 1);
    object.render.graphicType = 17;
    object.render.width = 69;
    object.render.height = 69;
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      object.render.frame = object.thirdTimer <= 5 ? 18 : object.thirdTimer <= 15 ? 17 : 16;
      this.anchorNormalAlien(object, 64);
      return true;
    }
    // flamemarine.s calls ViewpointToDraw before its live state split.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    if (canSeePlayer && object.thirdTimer <= 0) {
      this.attackWithFlameMarine(object, player, elapsed);
      this.updateToughMarineAttackTimer(object, elapsed);
    } else {
      if (canSeePlayer) object.thirdTimer = signedWord(object.thirdTimer - elapsed);
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      this.patrolWithMarine(object, player, 30, elapsed);
      this.updateNormalAlienAmbientTimers(object, 100, elapsed);
    }
    this.anchorNormalAlien(object, 64);
    return true;
  }

  patrolWithToughMarine(object, player, frames = 1) {
    this.patrolWithMarine(object, player, 25, frames);
  }

  patrolWithMarine(object, player, fourthTimer = 25, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = fourthTimer;
    if (this.teleportEnemy(object, player, 64, 128)) return;
    const speed = signedWord(object.maximumSpeed * elapsed);
    const direction = sourceGoInDirection(0, 0, object.facing, speed);
    const dx = direction.xStep;
    const dz = direction.zStep;
    if (!this.tryMoveEnemy(object, dx, dz, MARINE_PATROL_MASK, player, false, 128, 64)) {
      object.timer = -1;
    }
    object.timer = signedWord(object.timer - elapsed);
    if (object.timer < 0) {
      object.facing = this.nextRandom() & 8190;
      object.timer = 50;
    }
  }

  attackWithMutantMarine(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer <= 0) object.thirdTimer = 50;
    // mutantmarine.s:MutMarAttackPLR1 stores 80 in the shared Range word.
    this.moveObjectRange = 80;
    const movement = sourceHeadTowards(
      object.position.x, object.position.z, player.x, player.z,
      80, signedWord(object.maximumSpeed * elapsed));
    const moveX = signedWord(movement.x - Math.trunc(object.position.x));
    const moveZ = signedWord(movement.z - Math.trunc(object.position.z));
    if (moveX || moveZ) {
      this.tryMoveEnemy(
        object, moveX, moveZ,
        0, player, true, 128, 64);
    }
    if (movement.heading.distance) object.facing = movement.heading.angleUnits;
    if (object.fourthTimer > 20) return;

    object.thirdTimer = (this.nextRandom() & 255) + 50;
    // mutantmarine.s:MutMarAttackPLR1 writes -100 to object word 2 before
    // its direct-hit/scatter decision.
    object.render.brightness = -100;
    const shotRandom = this.nextRandom();
    if (sourceMarineInstantHit(
      shotRandom, object.position.x, object.position.z, player.x, player.z)) {
      const damage = 4;
      const damageTaken = this.addPlayerDamage(damage);
      this.events.push({
        type: 'enemy-hitscan-hit', objectId: object.id, damage,
        damageTaken,
      });
      return;
    }
    const projectile = this.allocateMarineMiss(object, player);
    this.events.push({
      type: 'enemy-hitscan-miss', objectId: object.id,
      projectileId: projectile?.id ?? null,
    });
  }

  attackWithFlameMarine(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer <= 0) object.thirdTimer = 50;
    this.moveGroundCasterTowardPlayer(object, player, 128, 64, elapsed);
    if (object.fourthTimer >= 20) return;

    object.thirdTimer = (this.nextRandom() & 255) + 200;
    // flamemarine.s:FlameMarAttackPLR1 writes -100 to object word 2 before
    // the five source hit rolls.
    object.render.brightness = -100;
    for (let pellet = 0; pellet < 5; pellet++) {
      const shotRandom = this.nextRandom();
      if (sourceMarineInstantHit(
        shotRandom, object.position.x, object.position.z, player.x, player.z)) {
        const damage = 2;
        const damageTaken = this.addPlayerDamage(damage);
        this.events.push({
          type: 'enemy-flame-hit', objectId: object.id, pellet, damage,
          damageTaken,
        });
        continue;
      }
      const projectile = this.allocateMarineMiss(object, player);
      this.events.push({
        type: 'enemy-flame-miss', objectId: object.id, pellet,
        projectileId: projectile?.id ?? null,
      });
    }
  }

  allocateMarineMiss(object, player) {
    const target = sourceMarineMissTarget(
      this.nextRandom(), object.position.x, object.position.z,
      player.x, player.z, this.playerSourceY(player) + 15);
    const targetX = target.x;
    const targetZ = target.z;
    // aliencontrol.s:SHOOTPLAYER1 sends its scattered target as one signed-word
    // MoveObject step, then repeats that same step until exitfirst hits a wall.
    const oldX = signedWord(Math.floor(object.position.x));
    const oldZ = signedWord(Math.floor(object.position.z));
    const startYFixed = signedWord(Math.floor(object.position.y)) << 7;
    const targetYFixed = signedWord(Math.floor(target.y)) << 7;
    const point = this.traceInstantMoveObject({
      x: oldX, z: oldZ,
      dx: signedWord(targetX - oldX), dz: signedWord(targetZ - oldZ),
      startYFixed, yStepFixed: (targetYFixed - startYFixed) | 0,
      zone: object.zone, inUpper: Boolean(object.render.inUpper),
    });
    return this.allocateInstantImpact(point, 0);
  }

  attackWithToughMarine(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer <= 0) object.thirdTimer = 50;
    // ToughMarineAttackPLR1 uses the same HeadTowardsAng/MoveObject path as
    // the mutant and flame marines; the former browser handler only rotated.
    this.moveGroundCasterTowardPlayer(object, player, 128, 64, elapsed);
    if (object.fourthTimer >= 20) return;
    object.thirdTimer = (this.nextRandom() & 31) + 50;
    // toughmarine.s:ToughMarineAttackPLR1 writes -10 to object word 2.
    object.render.brightness = -10;
    this.spawnEnemyProjectile(object, player, {
      gun: 6, damage: 7, speed: 32, verticalShift: 4,
      muzzleOffset: 0, yOffsetFixed: 0,
      inUpper: object.render.inUpper,
    });
  }

  updateToughMarineAttackTimer(object, frames = 1) {
    object.secondTimer = signedWord(object.secondTimer - signedWord(frames));
    if (object.secondTimer >= 0) return;
    this.emitEnemySound(object, 16, 100, 'call');
    object.secondTimer = ((this.nextRandom() >>> 6) & 255) + 300;
  }

  updateFlyingScalyBall(object, player, frames = 1) {
    object.render.graphicType = 4;
    object.render.width = 96;
    object.render.height = 96;
    return this.updateAirborneShooter(object, player, {
      shotFrame: 17, attackFrontFrame: 16, fallingCorpse: true, attackRange: 120,
    }, frames);
  }

  updateEyeball(object, player, frames = 1) {
    object.render.graphicType = 15;
    object.render.width = 16;
    object.render.height = 32;
    object.render.sourceWidth = 15;
    object.render.sourceHeight = 31;
    return this.updateAirborneShooter(object, player, {
      shotFrame: 18, patrolBaseFrame: 18, attackFrame: 18,
      fallingCorpse: false, attackRange: 80,
    }, frames);
  }

  updateAirborneShooter(object, player, behavior, frames = 1) {
    const elapsed = signedWord(frames);
    const retained = object.worry & 0x80;
    object.worry = retained | Math.max(0, (object.worry & 0x7f) - 1);
    // flyingscalyball.s enters its falling path on signed TST.B <= 0 and
    // clears numlives there. eyeball.s omits that entry test entirely.
    if (behavior.fallingCorpse && signedByte(object.lives) <= 0) {
      object.lives = 0;
      const changed = this.updateFlyingCorpse(object, elapsed);
      this.findCloseRoom(object, player, 80);
      return changed;
    }
    // Both live flying handlers call ViewpointToDraw before their state split.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    object.forcedFrame = behavior.patrolBaseFrame === undefined
      ? null : behavior.patrolBaseFrame + this.animationPhase;
    if (canSeePlayer && object.thirdTimer <= 0) {
      this.attackWithAirborneShooter(object, player, behavior, elapsed);
    } else {
      if (canSeePlayer) object.thirdTimer = signedWord(object.thirdTimer - elapsed);
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 31) + 10;
      this.patrolWithAirborneShooter(object, player, elapsed);
    }
    this.updateToughMarineAttackTimer(object, elapsed);
    if (behavior.fallingCorpse) this.findCloseRoom(object, player, 80);
    return true;
  }

  patrolWithAirborneShooter(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = 30;
    if (!this.teleportFlyingEnemy(object, player)) {
      object.facing = (object.facing + object.turnSpeed) & 8190;
      const speed = signedWord(object.maximumSpeed * elapsed);
      const direction = sourceGoInDirection(0, 0, object.facing, speed);
      const dx = direction.xStep;
      const dz = direction.zStep;
      this.tryMoveFlyingEnemy(object, dx, dz, player);
    }
    this.updateAirborneHeight(object);
    object.timer = signedWord(object.timer - elapsed);
    if (object.timer >= 0) return;
    object.turnSpeed = ((((this.nextRandom() >>> 4) & 255) - 128) * 2);
    object.timer = 50;
    let yVelocity = ((this.nextRandom() >>> 4) & 7) - 3;
    yVelocity -= (this.nextRandom() >>> 5) & 1;
    object.yVelocity = yVelocity;
  }

  attackWithAirborneShooter(object, player, behavior, frames = 1) {
    const elapsed = signedWord(frames);
    // flyingscalyball.s substitutes frame 16 only for facing group zero; its
    // other groups retain alframe. eyeball.s instead writes frame 18 literally
    // throughout its attack handler.
    if (behavior.attackFrame !== undefined) {
      object.forcedFrame = behavior.attackFrame;
    } else if (behavior.attackFrontFrame !== undefined) {
      const facing = objectFacingFrame(object, player);
      object.forcedFrame = facing === 0
        ? behavior.attackFrontFrame : facing * 4 + this.animationPhase;
    }
    object.fourthTimer = signedWord(object.fourthTimer - elapsed);
    if (object.fourthTimer <= 0) object.thirdTimer = 50;
    // FlyingBallAttack/EyeBallAttack run HeadTowardsAng and MoveObject before
    // their vertical integration and shot gate. Their ranges differ, but both
    // multiply maxspd by the one outer pass's TempFrames value.
    this.moveObjectRange = behavior.attackRange;
    const movement = sourceHeadTowards(
      object.position.x, object.position.z, player.x, player.z,
      behavior.attackRange, signedWord(object.maximumSpeed * elapsed));
    const moveX = signedWord(movement.x - Math.trunc(object.position.x));
    const moveZ = signedWord(movement.z - Math.trunc(object.position.z));
    if (moveX || moveZ) {
      // The attack labels call HeadTowardsAng and MoveObject directly. Unlike
      // the patrol path, there is no Collision call between them.
      // flyingscalyball.s:FlyingBallAttackPLR1 and
      // eyeball.s:EyeBallAttackPLR1 use (objectY<<7)-48*256 here; this differs
      // from the patrol labels' -48*128 MoveObject vertical coordinate.
      const oldX = signedWord(Math.floor(object.position.x));
      const oldZ = signedWord(Math.floor(object.position.z));
      this.tryMoveFlyingEnemy(object, moveX, moveZ, player, 0, true, 48 * 256);
      // flyingscalyball.s:FlyingBallAttackPLR1 and
      // eyeball.s:EyeBallAttackPLR1 likewise write oldx/oldz to ObjectPoints
      // after MoveObject while retaining its room/layer result.
      this.restoreEnemyAttackCoordinates(object, oldX, oldZ);
    }
    if (movement.heading.distance) object.facing = movement.heading.angleUnits;
    this.updateAirborneHeight(object);
    if (object.fourthTimer >= 20) return;
    object.thirdTimer = 50;
    object.render.frame = behavior.shotFrame;
    object.forcedFrame = behavior.shotFrame;
    // flyingscalyball.s:FlyingBallAttackPLR1 and
    // eyeball.s:EyeBallAttackPLR1 both write -10 to object word 2.
    object.render.brightness = -10;
    this.spawnEnemyProjectile(object, player, {
      gun: 0, damage: 5, speed: 16, verticalShift: 3,
      muzzleOffset: 0, yOffsetFixed: 0,
      inUpper: object.render.inUpper,
    });
  }

  updateAirborneHeight(object) {
    const zone = this.level.zones[object.zone];
    const inUpper = Boolean(object.render.inUpper);
    const floor = (inUpper ? zone.upperFloor : this.zoneFloor(object.zone)) / 128;
    const roof = (inUpper ? zone.upperRoof : this.zoneRoof(object.zone)) / 128;
    object.position.y += object.yVelocity;
    if (object.position.y + 96 >= floor) {
      object.position.y = floor - 96;
      object.yVelocity = -object.yVelocity;
    }
    if (object.position.y - 96 <= roof) {
      object.position.y = roof + 96;
      object.yVelocity = -object.yVelocity;
    }
  }

  updateFlyingCorpse(object, frames = 1) {
    const elapsed = signedWord(frames);
    object.forcedFrame = object.render.frame;
    const zone = this.level.zones[object.zone];
    const floor = (object.render.inUpper ? zone.upperFloor : this.zoneFloor(object.zone)) / 128;
    const targetY = floor - 64;
    if (targetY <= object.position.y) {
      object.position.y = targetY;
      if (object.render.frame !== 20) {
        // flyingscalyball.s:.putitin copies the object's point to newx/newz,
        // computes d2=(FourthTimer ASR 4)+1, and calls ExplodeIntoBits with
        // d0=0 and d3=31 before installing frame 20.
        const debrisPower = (signedWord(object.fourthTimer) >> 4) + 1;
        this.spawnEnemyGibs(object, debrisPower, 31);
        object.render.frame = 20;
        object.forcedFrame = 20;
        this.events.push({
          type: 'enemy-splat', objectId: object.id,
          debrisPower,
        });
      }
      return true;
    }
    const fall = signedWord(elapsed << 4);
    object.position.y = signedWord(object.position.y + fall);
    object.fourthTimer = signedWord(object.fourthTimer + fall);
    object.thirdTimer = signedWord(object.thirdTimer - elapsed);
    if (object.thirdTimer < 0) {
      object.thirdTimer = 20;
      if (object.render.frame < 19) object.render.frame++;
      object.forcedFrame = object.render.frame;
    }
    return true;
  }

  teleportFlyingEnemy(object, player) {
    const teleport = this.level.zones[object.zone]?.teleport;
    if (!teleport || teleport.zone < 0) return false;
    // objectmove:CheckTeleport always subtracts the two lower ToZoneFloor
    // longs, even for an object whose ObjInTop byte is set. Collision sees the
    // flying handler's (objectY-48) top plus that 25.7 floor delta.
    const floorDeltaFixed = (this.zoneFloor(teleport.zone) -
      this.zoneFloor(object.zone)) | 0;
    const collisionY = (((signedWord(Math.floor(object.position.y)) << 7) -
      48 * 128 + floorDeltaFixed) | 0) >> 7;
    if (this.objectMovementBlocker(
      object, teleport.x, teleport.z, collisionY,
      0x7ffff, Boolean(object.render.inUpper)) ||
      this.virtualPlayerBlocks(object, player, teleport.x, teleport.z, collisionY)) return false;
    const fromZone = object.zone;
    object.zone = teleport.zone;
    object.graphicZone = teleport.zone;
    object.position.xFixed = sourceWriteFixedHighWord(
      object.position.xFixed || 0, teleport.x);
    object.position.zFixed = sourceWriteFixedHighWord(
      object.position.zFixed || 0, teleport.z);
    object.position.x = sourceFixedHighWord(object.position.xFixed);
    object.position.z = sourceFixedHighWord(object.position.zFixed);
    object.position.y = signedWord(
      signedWord(Math.floor(object.position.y)) + (floorDeltaFixed >> 7));
    this.refreshMovingEnemyBrightness(object);
    this.events.push({
      type: 'enemy-teleport', objectId: object.id,
      fromZone, toZone: object.zone, x: object.position.x, z: object.position.z,
    });
    return true;
  }

  tryMoveFlyingEnemy(
      object, dx, dz, player, collisionMask = MARINE_PATROL_MASK,
      ignorePlayer = false, moveYOffsetFixed = 48 * 128) {
    if (!dx && !dz) return true;
    const oldX = signedWord(Math.floor(object.position.x));
    const oldZ = signedWord(Math.floor(object.position.z));
    const requestedX = signedWord(oldX + dx);
    const requestedZ = signedWord(oldZ + dz);
    const inUpper = Boolean(object.render.inUpper);
    // flyingscalyball.s/eyeball.s supply Collision and MoveObject with the
    // same 25.7 top coordinate, not the sprite's centre/anchor word.
    const oldYFixed = ((signedWord(Math.floor(object.position.y)) << 7) -
      moveYOffsetFixed) | 0;
    const collisionY = oldYFixed >> 7;
    if (this.objectMovementBlocker(
      object, requestedX, requestedZ, collisionY, collisionMask, inUpper) ||
      (!ignorePlayer && this.virtualPlayerBlocks(
        object, player, requestedX, requestedZ, collisionY))) return false;

    const extlen = ENEMY_EXTLEN.get(object.type) ?? 160;
    const awayFromWall = ENEMY_AWAY_FROM_WALL.get(object.type) ?? 2;
    this.setMoveObjectWallKind('alien');
    // flyingscalyball.s/eyeball.s form oldy/newy in 25.7 fixed from the object
    // word. Patrol subtracts 48*128; the one-player attack labels subtract
    // 48*256. Both then call the shared objectmove:MoveObject routine.
    const traceMove = this.moveObjectExitFirst
      ? this.traceMoveObjectExitFirstPath.bind(this)
      : this.traceMoveObjectSlide.bind(this);
    const moved = traceMove(object, {
      x: requestedX, z: requestedZ, yFixed: oldYFixed,
    }, {
      oldYFixed, extlen, awayFromWall,
      profile: ENEMY_MOVE_OBJECT_PROFILES.get(object.type),
    });
    object.zone = moved.zone;
    object.graphicZone = moved.zone;
    object.render.inUpper = moved.inUpper ? 1 : 0;
    // The handlers use MOVE.W newx/newz,(a1), preserving the ObjectPoints
    // fractional low words exactly as the released 68000 code does.
    object.position.xFixed = sourceWriteFixedHighWord(object.position.xFixed || 0, moved.x);
    object.position.zFixed = sourceWriteFixedHighWord(object.position.zFixed || 0, moved.z);
    object.position.x = sourceFixedHighWord(object.position.xFixed);
    object.position.z = sourceFixedHighWord(object.position.zFixed);
    this.refreshMovingEnemyBrightness(object);
    return !moved.hitWall;
  }

  updateNormalAlien(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    const retained = object.worry & 0x80;
    object.worry = retained | Math.max(0, (object.worry & 0x7f) - 1);
    if (signedByte(object.lives) <= 0) {
      object.lives = 0;
      object.thirdTimer = Math.max(0, signedWord(object.thirdTimer - elapsed));
      object.render.graphicType = 0;
      object.render.frame = object.thirdTimer <= 10 ? 33 : 32;
      this.anchorNormalAlien(object, 64);
      return true;
    }
    // normalalien.s calls ViewpointToDraw before its live state split.
    this.moveObjectRange = -60;
    this.refreshMovingEnemyBrightness(object);

    const canSeePlayer = Boolean(object.state & 1);
    const attacking = canSeePlayer && object.thirdTimer <= 0;
    if (attacking) {
      this.attackWithNormalAlien(object, player, elapsed);
    } else {
      if (canSeePlayer) object.thirdTimer = signedWord(object.thirdTimer - elapsed);
      else object.thirdTimer = ((this.nextRandom() >>> 4) & 63) + 20;
      this.patrolWithNormalAlien(object, player, elapsed);
    }
    this.anchorNormalAlien(object, 40);
    this.updateNormalAlienAmbientTimers(object, attacking ? 800 : 100, elapsed);
    return true;
  }

  patrolWithNormalAlien(object, player, frames = 1) {
    const elapsed = signedWord(frames);
    object.fourthTimer = 25;
    if (this.teleportEnemy(object, player)) return;
    const speed = signedWord(object.maximumSpeed * elapsed);
    const direction = sourceGoInDirection(0, 0, object.facing, speed);
    const dx = direction.xStep;
    const dz = direction.zStep;
    if (!this.tryMoveEnemy(object, dx, dz, NORMAL_ALIEN_PATROL_MASK, player)) {
      object.timer = -1;
    }
    object.timer = signedWord(object.timer - elapsed);
    if (object.timer < 0) {
      object.facing = this.nextRandom() & 8190;
      object.timer = 50;
    }
  }

  attackWithNormalAlien(object, player, frames = 1) {
    if (this.teleportEnemy(object, player)) return;
    const target = sourceRunAroundTarget(
      object.position.x, object.position.z, player.x, player.z,
      playerSourceAngleUnits(player));
    const targetX = target.x;
    const targetZ = target.z;
    const range = 160;
    // normalalien.s:NastyAttackPLR1 stores this literal before HeadTowardsAng.
    this.moveObjectRange = range;
    const movement = sourceHeadTowards(
      object.position.x, object.position.z, targetX, targetZ,
      range, signedWord(object.maximumSpeed * signedWord(frames)));
    let gotThere = movement.gotThere;
    const moveX = signedWord(movement.x - Math.trunc(object.position.x));
    const moveZ = signedWord(movement.z - Math.trunc(object.position.z));
    const touchesPlayer = this.enemyTouchesPlayer(object, player, moveX, moveZ);
    if (touchesPlayer) gotThere = true;
    const moved = !touchesPlayer && this.tryMoveEnemy(
      object, moveX, moveZ, NORMAL_ALIEN_ATTACK_MASK, player, true);
    if (moved && movement.heading.distance) {
      object.facing = movement.heading.angleUnits;
    }
    if (!gotThere) return;
    if (object.fourthTimer > 0) {
      object.fourthTimer = signedWord(object.fourthTimer - signedWord(frames));
      return;
    }
    object.fourthTimer = 20;
    const damage = 2;
    const damageTaken = this.addPlayerDamage(damage);
    this.events.push({
      type: 'enemy-melee', objectId: object.id, damage,
      damageTaken,
    });
  }

  updateNormalAlienAmbientTimers(object, volume = 100, frames = 1) {
    object.secondTimer = signedWord(object.secondTimer - signedWord(frames));
    if (object.secondTimer >= 0) return;
    const slot = ((this.nextRandom() >>> 6) & 1) + 17;
    this.emitEnemySound(object, slot, volume, 'call');
    object.secondTimer = ((this.nextRandom() >>> 6) & 255) + 300;
  }

  emitEnemySound(object, slot, volume, reason) {
    this.events.push({
      type: 'enemy-sound', reason, objectId: object.id,
      objectType: object.type, slot, volume,
    });
  }

  anchorNormalAlien(object, height) {
    const zone = this.level.zones[object.zone];
    const floor = (object.render.inUpper ? zone.upperFloor : this.zoneFloor(object.zone)) / 128;
    object.position.y = Math.trunc(floor) - height;
  }

  refreshMovingEnemyBrightness(object) {
    const zone = this.level.zones[object.zone];
    if (!zone) return;
    const inUpper = Boolean(object.render.inUpper);
    // Each moving enemy handler selects one word from ZoneBrightTable after
    // MoveObject: the high word for the lower layer and low word for upper.
    // ZoneBrightTable already contains the current pass's Flash adjustment.
    const base = inUpper ? zone.upperBrightness : zone.brightness;
    object.render.brightness = signedWord(
      base + this.zoneBrightnessAdjustment(object.zone, inUpper));
  }

  teleportEnemy(object, player, anchorHeight = 40, bodyHeight = 80) {
    const teleport = this.level.zones[object.zone]?.teleport;
    if (!teleport || teleport.zone < 0) return false;
    // objectmove:CheckTeleport adds the signed lower-floor difference to
    // newy only for Collision, restores it afterwards, then each ground caller
    // adds its ASR.L #7 word to the visible Y before the common floor anchor.
    const floorDeltaFixed = (this.zoneFloor(teleport.zone) -
      this.zoneFloor(object.zone)) | 0;
    const destination = {
      x: teleport.x,
      z: teleport.z,
      y: ((((signedWord(Math.floor(object.position.y)) << 7) -
        (bodyHeight - anchorHeight) * 128 + floorDeltaFixed) | 0) >> 7),
      zone: teleport.zone,
      inUpper: Boolean(object.render.inUpper),
    };
    if (this.objectMovementBlocker(
      object, destination.x, destination.z, destination.y,
      0x7ffff, destination.inUpper) ||
      this.virtualPlayerBlocks(object, player, destination.x, destination.z, destination.y)) {
      return false;
    }
    const fromZone = object.zone;
    object.zone = teleport.zone;
    object.graphicZone = teleport.zone;
    object.position.xFixed = sourceWriteFixedHighWord(
      object.position.xFixed || 0, teleport.x);
    object.position.zFixed = sourceWriteFixedHighWord(
      object.position.zFixed || 0, teleport.z);
    object.position.x = sourceFixedHighWord(object.position.xFixed);
    object.position.z = sourceFixedHighWord(object.position.zFixed);
    object.position.y = signedWord(
      signedWord(Math.floor(object.position.y)) + (floorDeltaFixed >> 7));
    this.refreshMovingEnemyBrightness(object);
    this.events.push({
      type: 'enemy-teleport', objectId: object.id,
      fromZone, toZone: object.zone, x: object.position.x, z: object.position.z,
    });
    return true;
  }

  tryMoveEnemy(object, dx, dz, collisionMask, player, ignorePlayer = false,
      bodyHeight = 80, anchorHeight = 40) {
    if (!dx && !dz) return true;
    const oldX = signedWord(Math.floor(object.position.x));
    const oldZ = signedWord(Math.floor(object.position.z));
    const requestedX = signedWord(oldX + dx);
    const requestedZ = signedWord(oldZ + dz);
    // Every ground handler passes Collision the same oldy/newy used by
    // MoveObject: (object word 4 - nasheight)<<7.
    const oldYFixed = ((signedWord(Math.floor(object.position.y)) << 7) -
      (bodyHeight - anchorHeight) * 128) | 0;
    const collisionY = oldYFixed >> 7;
    if (this.objectMovementBlocker(
      object, requestedX, requestedZ, collisionY,
      collisionMask, Boolean(object.render.inUpper)) ||
      (!ignorePlayer && this.virtualPlayerBlocks(
        object, player, requestedX, requestedZ, collisionY))) return false;

    const extlen = ENEMY_EXTLEN.get(object.type) ?? 0;
    const awayFromWall = ENEMY_AWAY_FROM_WALL.get(object.type) ?? 0;
    this.setMoveObjectWallKind('alien');

    // normalalien.s and the derived ground handlers all form oldy/newy as
    // (object y - nasheight)<<7. nasheight is the difference between each
    // handler's collision span and its final floor anchor.
    const traceMove = this.moveObjectExitFirst
      ? this.traceMoveObjectExitFirstPath.bind(this)
      : this.traceMoveObjectSlide.bind(this);
    const moved = traceMove(object, {
      x: requestedX, z: requestedZ, yFixed: oldYFixed,
    }, {
      oldYFixed, extlen, awayFromWall,
      profile: ENEMY_MOVE_OBJECT_PROFILES.get(object.type),
    });
    object.zone = moved.zone;
    object.graphicZone = moved.zone;
    object.render.inUpper = moved.inUpper ? 1 : 0;
    object.position.xFixed = sourceWriteFixedHighWord(object.position.xFixed || 0, moved.x);
    object.position.zFixed = sourceWriteFixedHighWord(object.position.zFixed || 0, moved.z);
    object.position.x = sourceFixedHighWord(object.position.xFixed);
    object.position.z = sourceFixedHighWord(object.position.zFixed);
    object.position.y = this.normalAlienFloor(
      moved.zone, object.render.inUpper) - anchorHeight;
    this.refreshMovingEnemyBrightness(object);
    return !moved.hitWall;
  }

  normalAlienFloor(zoneId, inUpper) {
    return (inUpper ? this.level.zones[zoneId].upperFloor : this.zoneFloor(zoneId)) / 128;
  }

  objectMovementBlocker(mover, x, z, y, mask, inUpper) {
    const thingHeight = ENEMY_BODY_HEIGHTS.get(mover.type) ??
      COLLISION_BOXES[mover.type]?.[2] ?? 0;
    for (const object of this.objects) {
      const box = COLLISION_BOXES[object.type];
      if (object === mover || !object.active || object.zone < 0 || object.lives === 0 ||
          object.type < 0 || !box || !(mask & (1 << object.type)) ||
          Boolean(object.render.inUpper) !== inUpper) continue;
      if (sourceCollisionBlocks(
        mover.type, mover.position.x, mover.position.z, x, z, y, thingHeight,
        object.type, object.position.x, object.position.z, object.position.y
      )) return object;
    }
    return null;
  }

  playerMovementBlocker(player, target) {
    const playerTop = (Number.isFinite(target.collisionY) ? target.collisionY :
      Number.isFinite(target.y) ? target.y :
      Number.isFinite(player.collisionY) ? player.collisionY : player.y) * 2;
    const playerHeight = Number.isFinite(target.collisionHeight) ? target.collisionHeight :
      Number.isFinite(target.height) ? target.height :
      Number.isFinite(player.collisionHeight) ? player.collisionHeight :
      Number.isFinite(player.height) ? player.height : PLAYER_HEIGHT_FIXED / 256;
    for (const object of this.objects) {
      const box = COLLISION_BOXES[object.type];
      if (!object.active || object.zone < 0 || object.type < 0 || object.lives === 0 ||
          !box || !(PLAYER_COLLISION_MASK & (1 << object.type)) ||
          Boolean(object.render.inUpper) !== Boolean(target.inUpper ?? player.inUpper)) continue;
      if (sourceCollisionBlocks(
        5, player.x, player.z, target.x, target.z,
        playerTop, playerHeight * 2,
        object.type, object.position.x, object.position.z, object.position.y
      )) return object;
    }
    return null;
  }

  virtualPlayerBlocks(mover, player, x, z, y) {
    if (Boolean(player.inUpper) !== Boolean(mover.render.inUpper)) return false;
    const thingHeight = ENEMY_BODY_HEIGHTS.get(mover.type) ??
      COLLISION_BOXES[mover.type]?.[2] ?? 0;
    // USEPLR1 writes the player object's word-4 anchor at p1_yoff plus half
    // p1_height before Collision sees its type-5 ColBoxTable entry.
    const playerAnchorY = this.playerSourceY(player) +
      (Number.isFinite(player.height) ? player.height : 48);
    return sourceCollisionBlocks(
      mover.type, mover.position.x, mover.position.z, x, z, y, thingHeight,
      5, player.x, player.z, playerAnchorY);
  }

  enemyTouchesPlayer(object, player, dx, dz) {
    // normalalien.s:NastyAttackPLR1 calls Collision with newy at
    // (objectY-40)<<7 for the type-0 80-unit collision span.
    return this.virtualPlayerBlocks(
      object, player, object.position.x + dx, object.position.z + dz,
      signedWord(Math.floor(object.position.y)) - 40);
  }

  freeProjectile(object) {
    if (object.shot) {
      object.pooledShotXVelocityFixed = object.shot.xVelocityFixed | 0;
      object.pooledShotZVelocityFixed = object.shot.zVelocityFixed | 0;
      object.pooledShotYVelocity = signedWord(object.shot.yVelocity);
      object.pooledShotGravity = signedWord(object.shot.gravity);
      object.pooledShotLife = signedWord(object.shot.life);
      object.pooledShotFlags = signedWord(object.shot.flags);
    }
    object.active = false;
    object.zone = -1;
    object.graphicZone = -1;
    object.shot = null;
  }

  setMoveObjectWallKind(kind) {
    if (kind !== null && kind !== 'player' && kind !== 'alien' && kind !== 'bullet') {
      throw new RangeError(`unsupported released wallflags kind ${kind}`);
    }
    this.moveObjectWallKind = kind;
  }

  recordMoveObjectWallContacts(edgeIds) {
    const kind = this.moveObjectWallKind;
    if (!kind || !edgeIds?.length) return false;
    const flag = kind === 'player' ? WALLFLAG_PLAYER :
      kind === 'alien' ? WALLFLAG_ALIEN : WALLFLAG_BULLET;
    let written = false;
    // MoveObject lines 191-192 and 446-447 OR the caller's wallflags word
    // directly into word 14 of every contacted wall record. Consumption is
    // deliberately deferred to the mover routines; pre-decoding contacts by
    // door/lift would lose their source ordering and reset values.
    for (const edgeId of edgeIds) {
      if (!Number.isInteger(edgeId) || edgeId < 0 ||
          edgeId >= this.moveObjectWallFlags.length) continue;
      this.moveObjectWallFlags[edgeId] |= flag;
      written = true;
    }
    return written;
  }

  bounceProjectileFromWall(object, nextXFixed, nextZFixed, moveResult) {
    const shot = object.shot;
    const edge = moveResult?.hitEdge;
    if (!moveResult?.hitWall || !edge) {
      throw new Error('wallbounce requires the released MoveObject contact edge');
    }
    // MoveObject changes only the high words of newx/newz at
    // .calcbounce/.calcwherehit; the fractional halves produced by this
    // pass's velocity integration survive the caller's MOVE.L store.
    object.position.xFixed = sourceWriteFixedHighWord(nextXFixed, moveResult.x);
    object.position.zFixed = sourceWriteFixedHighWord(nextZFixed, moveResult.z);
    object.position.x = moveResult.x;
    object.position.z = moveResult.z;
    const reflected = sourceBounceVelocity(
      shot.xVelocityFixed, shot.zVelocityFixed, edge);
    shot.xVelocityFixed = reflected.xVelocityFixed;
    shot.zVelocityFixed = reflected.zVelocityFixed;
    if (shot.flags & 2) this.dampenProjectile(object);
    this.events.push({ type: 'projectile-bounce', projectileId: object.id, surface: 'wall' });
  }

  dampenProjectile(object) {
    // ItsABullet applies ASR.L #1 to both signed 16.16 velocity longs.
    object.shot.xVelocityFixed = object.shot.xVelocityFixed >> 1;
    object.shot.zVelocityFixed = object.shot.zVelocityFixed >> 1;
  }

  projectileTarget(projectile, oldX, oldZ, nextX, nextZ) {
    for (const object of this.objects) {
      const box = COLLISION_BOXES[object.type];
      if (!object.active || object === projectile || !box || object.lives === 0 ||
          !((projectile.enemyFlags >>> 0) & (1 << object.type)) ||
          !sourceShotHitsTarget(
            oldX, oldZ, nextX, nextZ, projectile.position.y,
            object.position.x, object.position.z, object.position.y,
            box[0], box[1])) {
        continue;
      }
      return object;
    }
    return null;
  }

  operateSwitches(player) {
    let changed = false;
    for (let index = 0; index < this.switches.length; index++) {
      const item = this.switches[index];
      if (item.zone < 0) continue;
      const first = this.level.points[item.point];
      const second = this.level.points[item.point + 1];
      // anims:SwitchRoutine forms the midpoint with wrapping word ADD/ASR,
      // then compares two signed MULS results against 60*60.
      const x = signedWord(signedWord(first[0]) + signedWord(second[0])) >> 1;
      const z = signedWord(signedWord(first[1]) + signedWord(second[1])) >> 1;
      const dx = signedWord(x - Math.floor(player.x));
      const dz = signedWord(z - Math.floor(player.z));
      const distanceSquared = (Math.imul(dx, dx) + Math.imul(dz, dz)) | 0;
      if (distanceSquared >= OPERATE_DISTANCE * OPERATE_DISTANCE) continue;
      item.active = item.active ? 0 : 255;
      item.timer = 0;
      this.conditions = (this.conditions ^ (1 << (index + 4))) & 0xffff;
      this.events.push({ type: 'switch-operated', switch: index, active: Boolean(item.active), x, z });
      changed = true;
    }
    return changed;
  }

  updateSwitchTimers(frames = 1) {
    const elapsed = signedWord(frames);
    let changed = false;
    for (let index = 0; index < this.switches.length; index++) {
      const item = this.switches[index];
      if (!item.timed || !item.active) continue;
      // anims:SwitchRoutine multiplies TempFrames by four before subtracting
      // it from the timed switch's byte counter (lines 828-834).
      item.timer = (item.timer - (elapsed << 2)) & 255;
      if (item.timer === 0) {
        item.active = 0;
        this.conditions &= ~(1 << (index + 4));
      }
      changed = true;
    }
    return changed;
  }

  updateDoors(player, operate, frames = 1) {
    const elapsed = signedWord(frames);
    let changed = false;
    for (let index = 0; index < this.doors.length; index++) {
      const door = this.doors[index];
      if (door.velocity) {
        door.current = signedWord(
          door.current + Math.imul(signedWord(door.velocity), elapsed));
        if (door.current <= door.top) {
          door.current = door.top;
          door.velocity = 0;
        } else if (door.current >= door.bottom) {
          // DoorRoutine clears d2 at the bottom comparison but, unlike
          // LiftRoutine, does not copy the bottom word back into d3. A skipped
          // frame may therefore retain a small downward overshoot.
          door.velocity = 0;
        }
        changed = true;
      }
      const atBottom = door.current >= door.bottom;
      const atTop = door.current <= door.top;
      const conditionsMet = (this.conditions & door.conditions) === door.conditions;
      let activationMask = 0;
      let activationVelocity = door.velocity;
      let direction = null;
      // DoorRoutine forces a closing or partly-open door upward while either
      // player occupies its moving zone, independently of its condition bits.
      // It does so by testing the $8000 word installed on the previous pass.
      if (player.zone === door.zone && !atTop && door.velocity >= 0) {
        activationMask = WALLFLAG_ROUTINE;
        activationVelocity = -16;
        direction = 'reopen';
      } else if (!conditionsMet) {
        // anims:dothesimplething writes zero, not $8000, to every bound wall.
        for (const wall of door.walls) this.moveObjectWallFlags[wall.edge] = 0;
        continue;
      } else if (!door.velocity && atBottom) {
        activationMask = sourceDoorActivationMask(door.activateAtBottom, operate);
        activationVelocity = -16;
        direction = 'open';
      } else if (!door.velocity && atTop && door.activateAtTop === 0) {
        activationMask = WALLFLAG_ROUTINE;
        activationVelocity = 4;
        direction = 'close';
      }
      // anims:doorwalls reads the old word, rewrites $8000, then tests d1.
      // Every matching wall executes MakeSomeNoise, so retain one event per
      // matching packed binding rather than collapsing the wall records.
      for (const wall of door.walls) {
        const flags = this.moveObjectWallFlags[wall.edge];
        this.moveObjectWallFlags[wall.edge] = WALLFLAG_ROUTINE;
        if (!(flags & activationMask)) continue;
        door.velocity = activationVelocity;
        this.events.push({ type: 'mover-started', mover: 'door', index, direction });
        changed = true;
      }
    }
    return changed;
  }

  updateWaterAnimations(frames = 1) {
    const elapsed = signedWord(frames);
    let changed = false;
    for (const water of this.waterAnimations) {
      if (!water.zones.length) continue;
      const before = water.current;
      water.current = ((water.current | 0) +
        Math.imul(signedWord(water.velocity), elapsed)) | 0;
      if (water.current <= water.endpointA) {
        water.current = water.endpointA;
        water.velocity = 128;
      } else if (water.current >= water.endpointB) {
        water.current = water.endpointB;
        water.velocity = -128;
      }
      if (water.current !== before) changed = true;
    }
    return changed;
  }

  updateLifts(player, operate, frames = 1) {
    const elapsed = signedWord(frames);
    let changed = false;
    for (let index = 0; index < this.lifts.length; index++) {
      const lift = this.lifts[index];
      if (lift.velocity) {
        lift.current = signedWord(
          lift.current + Math.imul(signedWord(lift.velocity), elapsed));
        if (lift.current <= lift.top) {
          lift.current = lift.top;
          lift.velocity = 0;
        } else if (lift.current >= lift.bottom) {
          lift.current = lift.bottom;
          lift.velocity = 0;
        }
        changed = true;
      }
      const atBottom = lift.current >= lift.bottom;
      const atTop = lift.current <= lift.top;
      const stoodOn = player.zone === lift.zone;
      const conditionsMet = (this.conditions & lift.conditions) === lift.conditions;
      if (!conditionsMet) {
        for (const wall of lift.walls) this.moveObjectWallFlags[wall.edge] = 0;
        continue;
      }
      let activationMask = 0;
      let activationVelocity = lift.velocity;
      let direction = null;
      if (!lift.velocity && atBottom) {
        activationMask = sourceLiftActivationMask(
          lift.activateAtBottom, stoodOn, operate);
        activationVelocity = -4;
        direction = 'raise';
      } else if (!lift.velocity && atTop) {
        activationMask = sourceLiftActivationMask(
          lift.activateAtTop, stoodOn, operate);
        activationVelocity = 4;
        direction = 'lower';
      }
      for (const wall of lift.walls) {
        const flags = this.moveObjectWallFlags[wall.edge];
        this.moveObjectWallFlags[wall.edge] = WALLFLAG_ROUTINE;
        if (!(flags & activationMask)) continue;
        lift.velocity = activationVelocity;
        this.events.push({ type: 'mover-started', mover: 'lift', index, direction });
        changed = true;
      }
    }
    return changed;
  }

  initializeObjects() {
    for (const object of this.objects) {
      // The first ObjectHandler walk precedes DrawDisplay. Mirror its
      // unconditional GraphicRoom write so a reset can render immediately.
      object.graphicZone = object.zone;
      if (!object.active) continue;
      const graphicType = ANIMATED_GRAPHICS.get(object.type);
      if (graphicType !== undefined) object.render.graphicType = graphicType;
      applySourceObjectLayout(object);
      this.updateObjectFloorHeight(object);
      if (object.type === 9 && object.parameter < AMMO_FRAMES.length) {
        object.render.frame = AMMO_FRAMES[object.parameter];
      }
    }
  }

  updateObjects(player, objects = this.objects) {
    let changed = false;
    const phase = this.animationPhase;
    for (const object of objects) {
      if (!object.active) continue;
      if (object.barrelExplosion) {
        object.barrelExplosion.age++;
        if (object.barrelExplosion.age > 0) {
          object.render.width += 4;
          object.render.height += 4;
          object.render.frame++;
          changed = true;
          if (object.render.frame >= 8) {
            object.active = false;
            object.zone = -1;
            object.graphicZone = -1;
            continue;
          }
        }
      } else changed = this.updateObjectFloorHeight(object) || changed;
      if (object.lives > 0 && ANIMATED_GRAPHICS.has(object.type)) {
        const frame = object.forcedFrame ?? objectFacingFrame(object, player) * 4 + phase;
        if (object.render.frame !== frame) {
          object.render.frame = frame;
          changed = true;
        }
      }
      if (isPickup(object) && this.tryPickup(object, player)) changed = true;
    }
    return changed;
  }

  updateEnemyAwareness(player) {
    let changed = false;
    for (const object of this.objects) {
      if (!object.active || object.lives <= 0 || !COLLISION_BOXES[object.type] ||
          !(PLAYER_TARGET_MASK & (1 << object.type))) continue;
      const visible = this.hasLineOfSight(object, player);
      const state = (object.state & 0xfe) | (visible ? 1 : 0);
      if (state !== object.state) {
        object.state = state;
        changed = true;
      }
    }
    return changed;
  }

  // newtwo.s builds WorkSpace from each player's ListOfGraphRooms after drawing,
  // then ORs 127 into worry for every object whose room occurs in that list.
  // This wake-up is independent of CanItBeSeen; enemy handlers perform their
  // line-of-sight test on the following pass.
  markVisibleZones(zoneIds) {
    const visible = zoneIds instanceof Set ? zoneIds : new Set(zoneIds);
    let changed = false;
    for (const object of this.objects) {
      if (!object.active || object.zone < 0 || !visible.has(object.zone)) continue;
      const worry = object.worry | 127;
      if (object.worry === worry) continue;
      object.worry = worry;
      changed = true;
    }
    return changed;
  }

  hasLineOfSight(viewer, player) {
    return this.hasPointLineOfSight({
      x: viewer.position.x, z: viewer.position.z, y: viewer.position.y,
      zone: viewer.zone, inUpper: Boolean(viewer.render.inUpper),
    }, {
      x: player.x, z: player.z, y: this.playerSourceY(player),
      zone: player.zone, inUpper: Boolean(player.inUpper),
    });
  }

  hasObjectLineOfSight(viewer, target) {
    return this.hasPointLineOfSight({
      x: viewer.position.x, z: viewer.position.z, y: viewer.position.y,
      zone: viewer.zone, inUpper: Boolean(viewer.render.inUpper),
    }, {
      x: target.position.x, z: target.position.z, y: target.position.y,
      zone: target.zone, inUpper: Boolean(target.render.inUpper),
    });
  }

  hasPointLineOfSight(viewer, target) {
    if (viewer.zone === target.zone) return viewer.inUpper === target.inUpper;
    const visibility = this.level.zones[viewer.zone]?.visibility
      .find(entry => entry.zone === target.zone);
    if (!visibility || !sourceVisibilityClipAllows(
      visibility.clip, this.level.points,
      viewer.x, viewer.z, target.x, target.z)) return false;

    // objectmove:CanItBeSeen GoThroughZones.  The source scans each room's
    // ToExitList in stored order, selects the first edge which straddles the
    // viewer/target ray using word deltas and wrapping MULS/SUB.L products,
    // then interpolates the crossing height with signed DIVS.  A nearest
    // floating-point segment walk changes boundary and overflow cases.
    const viewerX = signedWord(Math.floor(viewer.x));
    const viewerZ = signedWord(Math.floor(viewer.z));
    const targetX = signedWord(Math.floor(target.x));
    const targetZ = signedWord(Math.floor(target.z));
    const rayX = signedWord(targetX - viewerX);
    const rayZ = signedWord(targetZ - viewerZ);
    const viewerY = signedWord(Math.floor(viewer.y));
    const targetY = signedWord(Math.floor(target.y));
    const heightDelta = signedWord(targetY - viewerY);
    let zone = viewer.zone;
    let inUpper = Boolean(viewer.inUpper);
    for (let pass = 0; pass < this.level.zones.length + 1; pass++) {
      let exit = null;
      for (const edgeId of this.level.zones[zone]?.edgeIds || []) {
        const edge = this.level.edges[edgeId];
        const startX = signedWord(edge.x - viewerX);
        const startZ = signedWord(edge.z - viewerZ);
        const startSide = (Math.imul(startZ, rayX) - Math.imul(startX, rayZ)) | 0;
        if (startSide <= 0) continue;
        const endX = signedWord(startX + edge.dx);
        const endZ = signedWord(startZ + edge.dz);
        const endSide = (Math.imul(endZ, rayX) - Math.imul(endX, rayZ)) | 0;
        if (endSide >= 0) continue;
        exit = edge;
        break;
      }
      if (!exit || exit.joinZone < 0) return false;

      const edgeX = signedWord(exit.x);
      const edgeZ = signedWord(exit.z);
      const edgeDx = signedWord(exit.dx);
      const edgeDz = signedWord(exit.dz);
      const divisor = signedWord(exit.length);
      if (!divisor) return false;
      const targetAlong = (Math.imul(signedWord(targetZ - edgeZ), edgeDx) -
        Math.imul(signedWord(targetX - edgeX), edgeDz)) | 0;
      const viewerAlong = (Math.imul(signedWord(viewerX - edgeX), edgeDz) -
        Math.imul(signedWord(viewerZ - edgeZ), edgeDx)) | 0;
      let targetDistance = sourceDivsWord(targetAlong, divisor);
      let viewerDistance = sourceDivsWord(viewerAlong, divisor);
      const totalDistance = signedWord(targetDistance + viewerDistance);
      if (totalDistance) {
        viewerDistance = sourceDivsWord(
          Math.imul(heightDelta, viewerDistance), totalDistance);
      }
      const crossingY = signedWord(viewerY + viewerDistance);
      const crossingFixed = (crossingY << 7) | 0;

      const current = this.level.zones[zone];
      const currentRoof = inUpper ? current.upperRoof : this.zoneRoof(zone);
      const currentFloor = inUpper ? current.upperFloor : this.zoneFloor(zone);
      if (crossingFixed < currentRoof || crossingFixed > currentFloor) return false;

      zone = exit.joinZone;
      const next = this.level.zones[zone];
      if (crossingFixed > this.zoneFloor(zone)) return false;
      if (crossingFixed > this.zoneRoof(zone)) {
        inUpper = false;
      } else {
        inUpper = true;
        if (crossingFixed > next.upperFloor || crossingFixed < next.upperRoof) return false;
      }
      if (zone === target.zone) return inUpper === Boolean(target.inUpper);
    }
    return false;
  }

  updateObjectFloorHeight(object) {
    if (![1, 3, 4, 9, 10].includes(object.type)) return false;
    const floor = this.zoneFloor(object.zone) >> 7;
    let y = object.position.y;
    if (object.type === 1 || object.type === 9) y = floor - 32;
    else if (object.type === 3) y = floor - object.render.height;
    else if (object.type === 4) y = floor - 16;
    else if (object.type === 10) y = floor - 60;
    if (object.position.y === y) return false;
    object.position.y = y;
    return true;
  }

  tryPickup(object, player) {
    // anims pickup handlers call objectmove:CheckHit with d2 = 100*100.
    // CheckHit subtracts coordinate high words, MULS both deltas, wraps their
    // long sum, and uses a strict SLT comparison.
    const dx = signedWord(Math.floor(object.position.x) - Math.floor(player.x));
    const dz = signedWord(Math.floor(object.position.z) - Math.floor(player.z));
    const distanceSquared = (Math.imul(dx, dx) + Math.imul(dz, dz)) | 0;
    if (player.zone !== object.zone || Boolean(player.inUpper) !== Boolean(object.render.inUpper) ||
        distanceSquared >= PICKUP_DISTANCE * PICKUP_DISTANCE) {
      return false;
    }
    let detail;
    if (object.type === 1) {
      if (this.playerState.energy >= 127) return false;
      const before = this.playerState.energy;
      this.playerState.energy = Math.min(127, before + object.parameter);
      detail = { energy: this.playerState.energy - before };
    } else if (object.type === 9) {
      const ammoType = object.parameter;
      if (ammoType >= this.playerState.ammo.length || this.playerState.ammo[ammoType] >= 80 * 8) {
        return false;
      }
      this.playerState.ammo[ammoType] += AMMO_PER_CLIP[ammoType];
      detail = { ammoType, ammunition: AMMO_PER_CLIP[ammoType] };
    } else if (object.type === 3) {
      const gun = object.state + 1;
      if (gun >= this.playerState.guns.length) return false;
      this.playerState.guns[gun] = true;
      this.playerState.ammo[gun] += AMMO_IN_GUN[object.state] || 0;
      detail = { gun };
    } else if (object.type === 4) {
      this.conditions = (this.conditions | object.state) & 0xffff;
      detail = { keyMask: object.state };
    } else {
      return false;
    }
    object.active = false;
    object.zone = -1;
    object.graphicZone = -1;
    this.events.push({ type: 'pickup', objectId: object.id, objectType: object.type, ...detail });
    return true;
  }

  rebuildGeometry() {
    this.planeHeights.clear();
    this.wallTops.clear();
    this.wallBottoms.clear();
    this.wallTextureOffsets.clear();
    this.wallTextureYOffsets.clear();
    this.wallTextureBanks.clear();
    this.blockedEdges.clear();
    this.waterHeights.clear();
    for (const door of this.doors) {
      this.planeHeights.set(door.planeRenderOffset, door.current / 4);
      const bottom = door.current * 64;
      for (const wall of door.walls) {
        this.wallBottoms.set(wall.renderOffset, bottom);
        // DoorRoutine rebuilds the packed texture pointer as textureBase plus
        // ((-current / 4) & 255) on every tick. The exported command splits that
        // address into its horizontal 16-pixel page and vertical byte offset.
        this.wallTextureOffsets.set(wall.renderOffset, wall.textureBase >>> 12);
        this.wallTextureYOffsets.set(wall.renderOffset, (-Math.trunc(door.current / 4)) & 255);
        if (this.zoneFloor(door.zone) - bottom < PLAYER_HEIGHT_FIXED) {
          this.blockedEdges.add(wall.edge);
        }
      }
    }
    for (const lift of this.lifts) {
      this.planeHeights.set(lift.planeRenderOffset, lift.current / 4);
      const top = lift.current * 64;
      for (const wall of lift.walls) {
        this.wallTops.set(wall.renderOffset, top);
        // LiftRoutine applies the same moving texture-pointer calculation as
        // DoorRoutine; only the wall endpoint moves in the opposite direction.
        this.wallTextureOffsets.set(wall.renderOffset, wall.textureBase >>> 12);
        this.wallTextureYOffsets.set(wall.renderOffset, (-Math.trunc(lift.current / 4)) & 255);
      }
    }
    for (const water of this.waterAnimations) {
      for (const binding of water.zones) {
        this.planeHeights.set(binding.renderOffset, water.current / 256);
        this.waterHeights.set(binding.zone, water.current);
      }
    }
    for (const item of this.switches) {
      if (item.zone < 0) continue;
      const command = this.commandsByOffset.get(item.wallRenderOffset);
      const textureOffset = (command.textureOffset & 0x3c) | (item.active ? 2 : 0);
      this.wallTextureOffsets.set(item.wallRenderOffset, textureOffset);
      this.wallTextureBanks.set(item.wallRenderOffset, 11);
    }
  }

  zoneFloor(zoneId) {
    const lift = this.lifts.find(item => item.zone === zoneId);
    return lift ? lift.current * 64 : this.level.zones[zoneId].floor;
  }

  zoneRoof(zoneId) {
    const door = this.doors.find(item => item.zone === zoneId);
    return door ? door.current * 64 : this.level.zones[zoneId].roof;
  }

  zoneWater(zoneId) {
    return this.waterHeights.get(zoneId) ?? this.level.zones[zoneId].water;
  }

  canCross(fromZone, toZone, requiredHeight = PLAYER_HEIGHT_FIXED) {
    if (fromZone === toZone) return true;
    return this.level.zones[fromZone].edgeIds
      .map(edgeId => this.level.edges[edgeId])
      .some(edge => {
        if (edge.joinZone !== toZone) return false;
        if (!this.blockedEdges.has(edge.id)) return true;
        const door = this.doors.find(item => item.walls.some(wall => wall.edge === edge.id));
        if (!door) return false;
        return this.zoneFloor(door.zone) - door.current * 64 >= requiredHeight;
      });
  }
}

export function applySourceObjectLayout(object) {
  const layout = SOURCE_OBJECT_LAYOUTS.get(object.type);
  if (layout) Object.assign(object.render, layout);
  return object;
}

function isPickup(object) {
  return object.type === 1 || object.type === 3 || object.type === 4 || object.type === 9;
}

export function objectFacingFrame(object, player) {
  // aliencontrol.s:ViewpointToDraw first runs HeadTowards with speed 64 and
  // Range -60. Its quantized word displacement, not the raw player delta, is
  // then classified by strict signed-long cross/dot branches.
  const movement = sourceHeadTowardsLinear(
    object.position.x, object.position.z, player.x, player.z, -60, 64);
  const oldX = signedWord(Math.floor(object.position.x));
  const oldZ = signedWord(Math.floor(object.position.z));
  const dx = signedWord(movement.x - oldX);
  const dz = signedWord(movement.z - oldZ);
  const { sinWord, cosWord } = sourceAngleTrig(object.facing);
  let cross = (Math.imul(dx, signedWord(cosWord)) -
    Math.imul(dz, signedWord(sinWord))) | 0;
  let dot = (Math.imul(dz, signedWord(cosWord)) +
    Math.imul(dx, signedWord(sinWord))) | 0;
  if (dot > 0) {
    if (cross > 0) return cross > dot ? 1 : 0;
    cross = (-cross) | 0;
    return cross > dot ? 3 : 0;
  }
  if (cross > 0) {
    dot = (-dot) | 0;
    return cross > dot ? 1 : 2;
  }
  return dot > cross ? 3 : 2;
}

export function weaponView(state) {
  const weapon = WEAPONS.get(state.selectedGun) || WEAPONS.get(0);
  const frame = weapon.animation[Math.max(0,
    Math.min(weapon.animation.length - 1, state.weaponFrame))];
  return { graphicFrame: state.selectedGun * 4 + frame, yOffset: weapon.yOffset };
}

export function sourceShotCooldownStep(cooldown, frames = 1) {
  // playershoot.s:Player1Shot tests the cooldown at entry, subtracts the one
  // TempFrames word, and returns even when that subtraction reaches zero. A
  // skipped-frame pass therefore never fires midway through its elapsed span.
  const current = signedWord(cooldown);
  if (!current) return 0;
  const elapsed = signedWord(frames);
  return current >= elapsed ? signedWord(current - elapsed) : 0;
}

export function sourceGunFrameStep(frame, frames = 1) {
  // newtwo.s draws PLR1_GunFrame first. Its post-draw path then subtracts
  // TempFrames, clamps a non-positive word to zero, stores the low byte, and
  // subtracts one more only when that stored byte is signed-positive.
  let next = signedWord((frame & 0xff) - signedWord(frames));
  if (next <= 0) return 0;
  next &= 0xff;
  return signedByte(next) > 0 ? (next - 1) & 0xff : next;
}

function sourceDoorActivationMask(mode, operate) {
  // anims:DoorRoutine door0..door5 install these exact masks in d1. Mode 0
  // installs the player-one bit only while the Space tap byte is set.
  if (mode === 0) return operate ? WALLFLAG_PLAYER : 0;
  if (mode === 1) return WALLFLAG_PLAYER;
  if (mode === 2) return WALLFLAG_BULLET;
  if (mode === 3) return WALLFLAG_ALIEN;
  if (mode === 4) return WALLFLAG_ROUTINE;
  return 0;
}

function sourceLiftActivationMask(mode, stoodOn, operate) {
  // anims:LiftRoutine lift0/rlift0 require Space. A player standing on the
  // platform selects the routine's $8000 wall word; otherwise modes 0/1 test
  // MoveObject's player-one bit. Mode 2 selects $8000 unconditionally.
  if (mode === 0 && !operate) return 0;
  if (mode === 0 || mode === 1) {
    return stoodOn ? WALLFLAG_ROUTINE : WALLFLAG_PLAYER;
  }
  if (mode === 2) return WALLFLAG_ROUTINE;
  return 0;
}

// objectmove:MoveObject lines 142-194. Wall bytes 12/13 shift both the origin
// and direction; awayfromwall=1/2 scales those signed bytes for enemy handlers,
// while a negative value suppresses them. A positive side below 32 after
// signed division by (wall length + extlen) writes wallflags without rejecting
// movement; crossing the shifted side hits it.
export function sourceMoveObjectWallProbe(
    edge, x, z, extlen = 40, awayFromWall = 0) {
  const shiftX = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalX || 0) << awayFromWall);
  const shiftZ = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalZ || 0) << awayFromWall);
  const dx = signedWord(edge.dx - shiftX - shiftZ);
  const dz = signedWord(edge.dz + shiftX - shiftZ);
  const relativeX = signedWord(Math.floor(x) - edge.x - shiftX);
  const relativeZ = signedWord(Math.floor(z) - edge.z - shiftZ);
  const side = (Math.imul(relativeX, dz) - Math.imul(relativeZ, dx)) | 0;
  const divisor = signedWord(edge.length + extlen);
  return {
    side,
    quotient: sourceDivsWord(side, divisor),
  };
}

// objectmove:MoveObject .calcalong/othercheck (lines 293-440). A wall's
// shifted half-plane is only solid over the shifted segment: othercheck picks
// the dominant axis and rejects a contact beyond either endpoint. This detail
// is essential at BSP exits, where a short solid edge can share the same line
// as a traversable portal.
export function sourceMoveObjectWallSlide(
    edge, oldX, oldZ, nextX, nextZ, extlen = 40, awayFromWall = 0) {
  const nextProbe = sourceMoveObjectWallProbe(
    edge, nextX, nextZ, extlen, awayFromWall);
  if (nextProbe.side > 0) return null;

  const shiftX = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalX || 0) << awayFromWall);
  const shiftZ = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalZ || 0) << awayFromWall);
  const dx = signedWord(edge.dx - shiftX - shiftZ);
  const dz = signedWord(edge.dz + shiftX - shiftZ);
  const divisor = signedWord(edge.length + extlen);

  // .calcalong moves the penetrated point back along the shifted wall normal
  // before othercheck compares it with the segment endpoints. MOVE.W changes
  // only the integer/high word of newx/newz; the caller preserves the low word.
  const wallX = signedWord(Math.floor(nextX) - sourceDivsWord(
    Math.imul(nextProbe.quotient, dz), divisor));
  const wallZ = signedWord(Math.floor(nextZ) + sourceDivsWord(
    Math.imul(nextProbe.quotient, dx), divisor));
  const relativeX = signedWord(wallX - edge.x - shiftX);
  const relativeZ = signedWord(wallZ - edge.z - shiftZ);

  // objectmove:othercheck lines 384-393 obtains both magnitudes with NEG.W.
  // The $8000 case therefore remains negative and can make the other axis win;
  // JavaScript Math.abs incorrectly produces the out-of-word value +32768.
  const xMagnitude = dx < 0 ? signedWord(-dx) : dx;
  const zMagnitude = dz < 0 ? signedWord(-dz) : dz;
  if (xMagnitude >= zMagnitude) {
    if (relativeX <= 0) {
      if (dx > 4 || relativeX < signedWord(dx - 4)) return null;
    } else if (dx < -4 || relativeX > signedWord(dx + 4)) return null;
  } else if (relativeZ <= 0) {
    if (dz > 4 || relativeZ < signedWord(dz - 4)) return null;
  } else if (dz < -4 || relativeZ > signedWord(dz + 4)) {
    return null;
  }
  return { x: wallX, z: wallZ };
}

// objectmove:MoveObject checkotherwalls (lines 456-703). These are not portal
// boundaries: they are the edge IDs stored after the room list's -1 marker,
// checked only when extlen is nonzero. The routine uses an explicit movement
// segment test, subtracts three from the wall quotient, and requires the old
// point to be on the non-penetrating side before accepting the projection.
export function sourceMoveObjectOtherWallSlide(
    edge, oldX, oldZ, nextX, nextZ, extlen = 40, awayFromWall = 0) {
  const nextProbe = sourceMoveObjectWallProbe(
    edge, nextX, nextZ, extlen, awayFromWall);
  if (nextProbe.side >= 0) return null;

  const shiftX = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalX || 0) << awayFromWall);
  const shiftZ = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalZ || 0) << awayFromWall);
  const dx = signedWord(edge.dx - shiftX - shiftZ);
  const dz = signedWord(edge.dz + shiftX - shiftZ);
  const xStep = signedWord(nextX - oldX);
  const zStep = signedWord(nextZ - oldZ);
  const oldRelativeX = signedWord(oldX - edge.x - shiftX);
  const oldRelativeZ = signedWord(oldZ - edge.z - shiftZ);
  const numerator = (Math.imul(zStep, oldRelativeX) -
    Math.imul(xStep, oldRelativeZ)) | 0;
  const denominator = (Math.imul(zStep, dx) - Math.imul(xStep, dz)) | 0;
  if (!denominator) return null;
  if (denominator < 0) {
    if (numerator > 0 || denominator > numerator) return null;
  } else if (numerator < 0 || denominator < numerator) {
    return null;
  }

  const divisor = signedWord(edge.length + extlen);
  const quotient = signedWord(nextProbe.quotient - 3);
  const wallX = signedWord(nextX - sourceDivsWord(
    Math.imul(quotient, dz), divisor));
  const wallZ = signedWord(nextZ + sourceDivsWord(
    Math.imul(quotient, dx), divisor));
  if (sourceMoveObjectWallProbe(
    edge, oldX, oldZ, extlen, awayFromWall).side < 0) return null;
  return { x: wallX, z: wallZ };
}

export function sourceMoveObjectFirstWallHit(
    edge, oldX, oldZ, nextX, nextZ, oldYFixed, nextYFixed, heights,
    thingHeightFixed = 0, stepUpFixed = 0, extlen = 0, awayFromWall = -1) {
  // objectmove:MoveObject chkhttt/.calcwherehit/.calcedhit (lines 196-346).
  // Unlike .calcalong, exitfirst interpolates back along the movement vector
  // and tests that contact against the shifted finite wall endpoints.
  const nextProbe = sourceMoveObjectWallProbe(
    edge, nextX, nextZ, extlen, awayFromWall);
  if (nextProbe.side > 0) return null;
  const yFixed = sourceMoveObjectCrossingHeight(
    edge, oldX, oldZ, nextX, nextZ, oldYFixed, nextYFixed,
    extlen, awayFromWall);
  if (!sourceMoveObjectOpeningBlocks(
    yFixed, heights, thingHeightFixed, stepUpFixed)) return null;

  const oldProbe = sourceMoveObjectWallProbe(
    edge, oldX, oldZ, extlen, awayFromWall);
  let total = signedWord(oldProbe.quotient - nextProbe.quotient);
  if (total <= 0) total = 1;
  const x = signedWord(nextX + sourceDivsWord(
    Math.imul(signedWord(nextX - oldX), nextProbe.quotient), total));
  const z = signedWord(nextZ + sourceDivsWord(
    Math.imul(signedWord(nextZ - oldZ), nextProbe.quotient), total));

  const shiftX = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalX || 0) << awayFromWall);
  const shiftZ = awayFromWall < 0 ? 0 :
    signedWord(signedWord(edge.normalZ || 0) << awayFromWall);
  const shifted = {
    x: signedWord(edge.x + shiftX),
    z: signedWord(edge.z + shiftZ),
    dx: signedWord(edge.dx - shiftX - shiftZ),
    dz: signedWord(edge.dz + shiftX - shiftZ),
  };
  if (!sourceMovementCrossesEdge(
    shifted, oldX, oldZ, nextX, nextZ)) return null;
  return { x, z, yFixed };
}

export function sourceFindCloseRoomSelection(
    currentZone, firstRoomPath, secondRoomPath, renderRoomOrder) {
  // objectmove:FindCloseRoom builds possclose as the current room followed by
  // both RoomPath lists. It then walks OrderZones' endoflist in draw order
  // (far to near), retaining the last listed room found in that union.
  const possible = new Set([
    signedWord(currentZone),
    ...(firstRoomPath || []).map(signedWord),
    ...(secondRoomPath || []).map(signedWord),
  ]);
  let selected = signedWord(currentZone);
  for (const room of renderRoomOrder || []) {
    const zone = signedWord(room);
    if (possible.has(zone)) selected = zone;
  }
  return selected;
}

function sourceMovementCrossesEdge(edge, oldX, oldZ, nextX, nextZ) {
  // objectmove:MoveObject .calcedhit and checkifcrossed test the two finite
  // endpoints with signed-word coordinate differences and wrapped MULS/SUB.L.
  const xStep = signedWord(nextX - oldX);
  const zStep = signedWord(nextZ - oldZ);
  const startCross = (Math.imul(signedWord(edge.x - oldX), zStep) -
    Math.imul(signedWord(edge.z - oldZ), xStep)) | 0;
  if (startCross > 0) return false;
  const endCross = (Math.imul(signedWord(edge.x + edge.dx - oldX), zStep) -
    Math.imul(signedWord(edge.z + edge.dz - oldZ), xStep)) | 0;
  return endCross >= 0;
}

export function sourceMoveObjectCrossingHeight(
    edge, oldX, oldZ, nextX, nextZ, oldYFixed, nextYFixed,
    extlen = 0, awayFromWall = -1) {
  // objectmove:MoveObject chkhttt and checkifcrossed divide both signed-long
  // wall sides by length+extlen. The distance ratio is measured backwards
  // from newy, hence the addition of nextQuotient (normally negative).
  const oldQuotient = sourceMoveObjectWallProbe(
    edge, oldX, oldZ, extlen, awayFromWall).quotient;
  const nextQuotient = sourceMoveObjectWallProbe(
    edge, nextX, nextZ, extlen, awayFromWall).quotient;
  let total = signedWord(oldQuotient - nextQuotient);
  if (total <= 0) total = 1;
  const yDifference = (nextYFixed - oldYFixed) | 0;
  return (nextYFixed + Math.imul(
    sourceDivsWord(yDifference, total), nextQuotient)) | 0;
}

export function sourceInstantCrossingHeight(
    edge, oldX, oldZ, nextX, nextZ, oldYFixed, nextYFixed) {
  return sourceMoveObjectCrossingHeight(
    edge, oldX, oldZ, nextX, nextZ, oldYFixed, nextYFixed, 0, -1);
}

export function sourceMoveObjectOpeningBlocks(
    crossingYFixed, heights, thingHeightFixed, stepUpFixed) {
  // objectmove:MoveObject .yeshit. An opening is usable when either its lower
  // or upper interval contains both the object's base and its height after the
  // source StepUpVal allowance. All comparisons are signed 32-bit branches.
  const top = ((crossingYFixed | 0) + (thingHeightFixed | 0) -
    (stepUpFixed | 0)) | 0;
  if (top >= (heights.lowerFloor | 0)) return true;
  if ((crossingYFixed | 0) > (heights.lowerRoof | 0)) return false;
  if ((crossingYFixed | 0) < (heights.upperRoof | 0)) return true;
  if (top < (heights.upperFloor | 0)) return false;
  return true;
}

export function sourceMoveObjectOtherOpeningBlocks(
    newYFixed, heights, thingHeightFixed, stepUpFixed, stepDownFixed) {
  // objectmove:MoveObject checkotherwalls retains the older full opening test
  // that the primary-wall loop has branched around. It tests newy (rather
  // than the interpolated crossing height), strict room clearance, and the
  // asymmetric StepUpVal/StepDownVal limits before probing the wall geometry.
  const fits = (floor, roof) => {
    const clearance = ((floor | 0) - (roof | 0)) | 0;
    if (clearance <= (thingHeightFixed | 0)) return false;
    let delta = ((newYFixed | 0) + (thingHeightFixed | 0) - (floor | 0)) | 0;
    if (delta > 0) {
      if (delta >= (stepUpFixed | 0)) return false;
    } else {
      delta = (-delta) | 0;
      if (delta >= (stepDownFixed | 0)) return false;
    }
    return (((newYFixed | 0) - (roof | 0)) | 0) >= 0;
  };
  return !fits(heights.lowerFloor, heights.lowerRoof) &&
    !fits(heights.upperFloor, heights.upperRoof);
}

export function sourceInstantMoveObjectWallHit(
    edge, oldX, oldZ, nextX, nextZ, oldYFixed, nextYFixed, heights) {
  // playershoot.s selects exitfirst with extlen=0 and awayfromwall=-1.
  // objectmove:MoveObject lines 164-260 therefore use the unshifted edge,
  // test the lower and upper destination openings, then take .calcwherehit.
  const nextProbe = sourceMoveObjectWallProbe(edge, nextX, nextZ, 0, -1);
  if (nextProbe.side > 0) return null;
  const yFixed = sourceInstantCrossingHeight(
    edge, oldX, oldZ, nextX, nextZ, oldYFixed, nextYFixed);
  const lowerOpen = yFixed < (heights.lowerFloor | 0) &&
    yFixed > (heights.lowerRoof | 0);
  const upperOpen = yFixed >= (heights.upperRoof | 0) &&
    yFixed < (heights.upperFloor | 0);
  if (lowerOpen || upperOpen ||
      !sourceMovementCrossesEdge(edge, oldX, oldZ, nextX, nextZ)) return null;

  const oldQuotient = sourceMoveObjectWallProbe(
    edge, oldX, oldZ, 0, -1).quotient;
  let total = signedWord(oldQuotient - nextProbe.quotient);
  if (total <= 0) total = 1;
  const xStep = signedWord(nextX - oldX);
  const zStep = signedWord(nextZ - oldZ);
  return {
    x: signedWord(nextX + sourceDivsWord(
      Math.imul(xStep, nextProbe.quotient), total)),
    z: signedWord(nextZ + sourceDivsWord(
      Math.imul(zStep, nextProbe.quotient), total)),
    yFixed,
  };
}

function enemyDeathSounds(type, accumulatedDamage, damage) {
  if (type === 6) return [{ slot: 15, volume: 400 }];
  if (type === 10) return [{ slot: 15, volume: 300 }];
  if (type === 8) {
    return [signedByte(accumulatedDamage) > 40
      ? { slot: 14, volume: 400 } : { slot: 8, volume: 200 }];
  }
  if (type === 13) {
    const sounds = [{ slot: 14, volume: 300 }];
    if (signedByte(damage) < 80) sounds.push({ slot: 27, volume: 200 });
    return sounds;
  }
  if (type === 14 || type === 16 || type === 17) return [{ slot: 14, volume: 400 }];
  if (type === 0 || type === 12 || type === 18 || type === 19) {
    // These handlers fall through to .noexplode after a sub-40 explosion, so
    // an ordinary gibbing death requests both sample 14 and screamsound (0).
    const sourceDamage = signedByte(accumulatedDamage);
    const sounds = sourceDamage > 1 ? [{ slot: 14, volume: 400 }] : [];
    if (sourceDamage < 40) sounds.push({ slot: 0, volume: 200 });
    return sounds;
  }
  return [];
}

function enemyGibRequest(type, accumulatedDamage, damage) {
  if (type === 0 || type === 12 || type === 18 || type === 19) {
    return signedByte(accumulatedDamage) > 1
      ? Math.max(1, accumulatedDamage >> 2) : -1;
  }
  if (type === 13) return signedByte(damage) > 1
    ? Math.max(1, (damage & 0xff) >> 2) : -1;
  // flyingscalyball.s installs the literal d2=9 only in its >40 branch;
  // ExplodeIntoBits then applies its shared cap of seven (eight records).
  if (type === 8) return signedByte(accumulatedDamage) > 40 ? 9 : -1;
  if (type === 14 || type === 16) return 7;
  if (type === 17) return 9;
  return -1;
}

function signedWord(value) {
  const word = value & 0xffff;
  return word >= 0x8000 ? word - 0x10000 : word;
}

function signedByte(value) {
  const byte = value & 0xff;
  return byte >= 0x80 ? byte - 0x100 : byte;
}

export function sourceAsrByte(value, count) {
  // ASR.B sign-extends bit 7 only within the low byte; MOVE.B callers retain
  // the resulting raw byte for their later SUB.B/CMP.B instructions.
  return (signedByte(value) >> (count & 7)) & 0xff;
}

export function sourceSubtractByte(destination, operand) {
  // 68000 BGT after SUB.B means !Z && N==V. A wrapped result can therefore
  // branch as positive when signed overflow is set; comparing the byte's
  // JavaScript numeric value with zero is not equivalent.
  const left = destination & 0xff;
  const right = operand & 0xff;
  const result = (left - right) & 0xff;
  const negative = Boolean(result & 0x80);
  const overflow = Boolean((left ^ right) & (left ^ result) & 0x80);
  return { result, greater: result !== 0 && negative === overflow };
}

export function sourceDivsWord(dividend, divisor) {
  const sourceDividend = dividend | 0;
  const sourceDivisor = signedWord(divisor);
  // MC68000 DIVS with a zero source takes exception vector 5 before writing
  // the destination register. Returning the old low word here used to hide a
  // source crash and could manufacture wall/plane coordinates which the
  // released game never produced.
  if (!sourceDivisor) throw new RangeError('68000 DIVS division by zero');
  const quotient = Math.trunc(sourceDividend / sourceDivisor);
  // DIVS overflow leaves the destination register unchanged. Callers in the
  // recovered routines subsequently consume its low word.
  return quotient < -32768 || quotient > 32767
    ? signedWord(sourceDividend) : signedWord(quotient);
}

export function sourceFixedHighWord(value) {
  // defs.i places shotxvel/shotzvel at the first (high) word of each long.
  // MOVE.W therefore reads an arithmetic 16.16 high word, not truncation of a
  // JavaScript quotient toward zero.
  return signedWord((value | 0) >> 16);
}

export function sourceWriteFixedHighWord(existing, word) {
  return ((signedWord(word) << 16) | ((existing | 0) & 0xffff)) | 0;
}

// Browser-only Enhanced Sharp adapter explicitly requested for this port.
// AB3D's released playershoot.s supplies the unchanged horizontal shot step
// and 25.7 Y accumulator used below. The added slope is ordinary ray geometry:
// sourceInstantProjection's distance is twice world depth, while vertical
// differences use 128 units per doubled-world Y, hence distance * 64.
export function browserAimVerticalDifference(targetDifferenceFixed, sourceDistance, slope) {
  const aimDifference = Math.trunc(Number(slope) * signedWord(sourceDistance) * 64) | 0;
  return ((targetDifferenceFixed | 0) - aimDifference) | 0;
}

// Preserve the complete recovered miss ray (including its retail random or
// stale-terminator Y step) and add only the explicitly requested browser pitch.
// X/Z steps are world units; the ray's Y step is doubled-world 25.7, giving
// hypot(X,Z) * slope * 2 * 128.
export function browserInstantAimRay(sourceRay, slope) {
  const pitchStep = Math.trunc(
    Math.hypot(signedWord(sourceRay.dx), signedWord(sourceRay.dz)) *
    Number(slope) * 256) | 0;
  return { ...sourceRay, yStepFixed: ((sourceRay.yStepFixed | 0) + pitchStep) | 0 };
}

// A player bullet advances approximately 2^(BulletSpd-1) world units per
// source tick. Its Y velocity is doubled-world 25.7, so a browser pitch adds
// slope * 2^(BulletSpd+7). The source velocity and gun-specific bias have
// already been evaluated by sourcePlayerBulletYVelocity and remain intact.
export function browserProjectileYVelocity(sourceVelocity, slope, bulletShift) {
  const pitchVelocity = Math.trunc(Number(slope) * (2 ** (signedWord(bulletShift) + 7)));
  return signedWord(signedWord(sourceVelocity) + pitchVelocity);
}

export function sourcePlayerBulletYVelocity(
    targetYDifferenceFixed, playerHeightFixed, targetDistance,
    bulletShift, gunYOffset) {
  // playershoot.s:Player1Shot subtracts PLR1_height, adds 18*256, divides by
  // the signed target-distance word shifted by BulletSpd, then firefive runs
  // its literal two comparisons before adding gun-data word 20. The second
  // comparison makes this a one-sided clamp: values >= -20 become -20.
  const numerator = ((targetYDifferenceFixed | 0) -
    (playerHeightFixed | 0) + 18 * 256) | 0;
  let divisor = signedWord(targetDistance) >> (signedWord(bulletShift) & 31);
  if (divisor <= 0) divisor = 1;
  let velocity = sourceDivsWord(numerator, divisor);
  if (velocity >= 20) velocity = 20;
  if (velocity >= -20) velocity = -20;
  return signedWord(velocity + signedWord(gunYOffset));
}

export function sourceProjectileAxisStep(positionFixed, velocityFixed, frames = 1) {
  // anims:ItsABullet multiplies the signed velocity high word and unsigned low
  // word separately by TempFrames, then recombines them. Modulo 32 bits that
  // is the exact signed 16.16 long product used here.
  return ((positionFixed | 0) + Math.imul(velocityFixed | 0, signedWord(frames))) | 0;
}

export function sourceProjectileVerticalStep(
    positionFixed, velocity, gravity, frames = 1) {
  // ItsABullet forms displacement from (shotyvel * TempFrames) plus
  // (shotgrav * TempFrames), then updates and caps the velocity separately.
  // The stored velocity is a word; accypos and the intermediate sums are longs.
  const sourceFrames = signedWord(frames);
  const gravityChange = Math.imul(signedWord(gravity), sourceFrames) | 0;
  const displacement = (Math.imul(signedWord(velocity), sourceFrames) +
    gravityChange) | 0;
  let nextVelocity = (signedWord(velocity) + gravityChange) | 0;
  if (nextVelocity >= 10 * 256) nextVelocity = 10 * 256;
  return {
    positionFixed: ((positionFixed | 0) + displacement) | 0,
    velocity: signedWord(nextVelocity),
  };
}

export function sourceProjectileLifetimeStep(life, lifetime, frames = 1) {
  // ItsABullet treats a negative shotlife or gun-table maximum as infinite.
  // Expiry uses a strict signed-word maximum < life test; only a live finite
  // counter is advanced by TempFrames.
  const sourceLife = signedWord(life);
  const maximum = signedWord(lifetime);
  if (sourceLife < 0 || maximum < 0) return { life: sourceLife, timeout: false };
  if (maximum < sourceLife) return { life: sourceLife, timeout: true };
  return { life: signedWord(sourceLife + signedWord(frames)), timeout: false };
}

export function sourceProjectileSurfaceStep(
    positionFixed, velocity, flags, roofFixed, floorFixed) {
  // ItsABullet checks the current accypos before integrating this pass. Roof
  // contact is tested first at roof+10*128; floor contact follows at
  // floor-10*128. A rising bouncy shot already below the floor is allowed to
  // leave without a second reflection.
  const y = positionFixed | 0;
  const sourceVelocity = signedWord(velocity);
  const sourceFlags = signedWord(flags);
  if ((((roofFixed | 0) - y) | 0) >= 10 * 128) {
    if (!(sourceFlags & 1)) {
      return { surface: 'roof', impact: true, dampen: false,
        positionFixed: y, velocity: sourceVelocity };
    }
    return {
      surface: 'roof', impact: false, dampen: Boolean(sourceFlags & 2),
      positionFixed: ((roofFixed | 0) + 10 * 128) | 0,
      velocity: signedWord(-sourceVelocity),
    };
  }
  if ((((floorFixed | 0) - y) | 0) > 10 * 128) return null;
  if ((sourceFlags & 1) && sourceVelocity < 0) return null;
  if (!(sourceFlags & 1)) {
    return { surface: 'floor', impact: true, dampen: false,
      positionFixed: y, velocity: sourceVelocity };
  }
  return {
    surface: 'floor', impact: false, dampen: Boolean(sourceFlags & 2),
    positionFixed: ((floorFixed | 0) - 10 * 128) | 0,
    velocity: signedWord(-(sourceVelocity >> 1)),
  };
}

function signedHighProduct(first, second) {
  return signedWord(Math.floor((signedWord(first) * signedWord(second)) / 65536));
}

// objectmove:Collision. Horizontal overlap is deliberately not a circle: the
// larger absolute axis is tested against the two ColBoxTable radii. On the X
// branch only, an existing overlap is ignored when the proposed point is
// farther away. All coordinate comparisons retain signed word arithmetic.
export function sourceCollisionBlocks(
    moverType, oldX, oldZ, newX, newZ, newY, thingHeight,
    targetType, targetX, targetZ, targetY) {
  const moverBox = COLLISION_BOXES[moverType];
  const targetBox = COLLISION_BOXES[targetType];
  if (!moverBox || !targetBox) return false;

  const moverTop = signedWord(Math.floor(newY));
  const moverBottom = signedWord(moverTop + Math.trunc(thingHeight));
  const targetTop = signedWord(Math.floor(targetY) - targetBox[1]);
  const targetBottom = signedWord(targetTop + targetBox[2]);
  if (moverBottom < targetTop || moverTop > targetBottom) return false;

  let xDistance = signedWord(Math.floor(targetX) - Math.floor(newX));
  let zDistance = signedWord(Math.floor(targetZ) - Math.floor(newZ));
  if (xDistance < 0) xDistance = signedWord(-xDistance);
  if (zDistance < 0) zDistance = signedWord(-zDistance);
  if (zDistance > xDistance) {
    return signedWord(zDistance - moverBox[0]) <= targetBox[0];
  }
  if (signedWord(xDistance - moverBox[0]) > targetBox[0]) return false;

  const newDeltaX = signedWord(Math.floor(targetX) - Math.floor(newX));
  const newDeltaZ = signedWord(Math.floor(targetZ) - Math.floor(newZ));
  const oldDeltaX = signedWord(Math.floor(targetX) - Math.floor(oldX));
  const oldDeltaZ = signedWord(Math.floor(targetZ) - Math.floor(oldZ));
  const newDistance = (Math.imul(newDeltaX, newDeltaX) +
    Math.imul(newDeltaZ, newDeltaZ)) | 0;
  const oldDistance = (Math.imul(oldDeltaX, oldDeltaX) +
    Math.imul(oldDeltaZ, oldDeltaZ)) | 0;
  return newDistance <= oldDistance;
}

// anims ShotRoutine `.notasplut` target loop. The shot segment is widened by
// each target's ColBoxTable radius and by 40 units at both ends. The released
// code uses its three-pass integer distance and signed DIVS result instead of
// a floating point-to-segment distance.
export function sourceShotHitsTarget(
    oldX, oldZ, newX, newZ, shotY,
    targetX, targetZ, targetY, radius, verticalExtent) {
  const sourceOldX = signedWord(Math.floor(oldX));
  const sourceOldZ = signedWord(Math.floor(oldZ));
  const sourceNewX = signedWord(Math.floor(newX));
  const sourceNewZ = signedWord(Math.floor(newZ));
  const xDifference = signedWord(sourceNewX - sourceOldX);
  const zDifference = signedWord(sourceNewZ - sourceOldZ);
  const range = sourceApproxDistance(xDifference, zDifference, 3) || 1;
  const expandedRange = signedWord(range + 40);
  const squaredRange = Math.imul(expandedRange, expandedRange) | 0;

  let yDistance = signedWord(Math.floor(shotY) - Math.floor(targetY));
  if (yDistance < 0) yDistance = signedWord(-yDistance);
  if (yDistance > signedWord(verticalExtent)) return false;

  const oldDeltaX = signedWord(Math.floor(targetX) - sourceOldX);
  const oldDeltaZ = signedWord(Math.floor(targetZ) - sourceOldZ);
  const newDeltaX = signedWord(Math.floor(targetX) - sourceNewX);
  const newDeltaZ = signedWord(Math.floor(targetZ) - sourceNewZ);
  let perpendicular = (Math.imul(oldDeltaX, zDifference) -
    Math.imul(oldDeltaZ, xDifference)) | 0;
  if (perpendicular < 0) perpendicular = (-perpendicular) | 0;
  if (sourceDivsWord(perpendicular, range) > signedWord(radius)) return false;

  const oldDistance = (Math.imul(oldDeltaX, oldDeltaX) +
    Math.imul(oldDeltaZ, oldDeltaZ)) | 0;
  if (oldDistance > squaredRange) return false;
  const newDistance = (Math.imul(newDeltaX, newDeltaX) +
    Math.imul(newDeltaZ, newDeltaZ)) | 0;
  return newDistance <= squaredRange;
}

// newtwo.s:CalcPLR1InLine. These are the exact word results stored in
// PLR1_ObsInLine and PLR1_ObjDists before playershoot.s selects the closest
// visible target. The lateral value is half the swapped doubled cross product;
// the forward distance is the swapped four-times dot product.
export function sourceInstantProjection(
    playerX, playerZ, objectX, objectZ, sinWord, cosWord) {
  const xDifference = signedWord(Math.floor(objectX) - Math.floor(playerX));
  const zDifference = signedWord(Math.floor(objectZ) - Math.floor(playerZ));
  let across = (Math.imul(xDifference, signedWord(cosWord)) -
    Math.imul(zDifference, signedWord(sinWord))) | 0;
  across = (across + across) | 0;
  if (across <= 0) across = (-across) | 0;
  const lateral = signedWord(across >>> 16) >> 1;
  let forward = (Math.imul(xDifference, signedWord(sinWord)) +
    Math.imul(zDifference, signedWord(cosWord))) | 0;
  forward = (forward << 2) | 0;
  const distance = signedWord(forward >>> 16);
  return { lateral, distance, inLine: distance > 0 };
}

// playershoot.s:FIREBULLETS. GetRand's low 15 bits are doubled as a signed
// long and compared strictly with the arithmetic-shifted squared word deltas.
export function sourceInstantHit(randomWord, playerX, playerZ, targetX, targetZ) {
  const xDifference = signedWord(Math.floor(targetX) - Math.floor(playerX));
  const zDifference = signedWord(Math.floor(targetZ) - Math.floor(playerZ));
  const squared = (Math.imul(xDifference, xDifference) +
    Math.imul(zDifference, zDifference)) | 0;
  const random = ((signedWord(randomWord) & 0x7fff) << 1) | 0;
  return random > (squared >> 6);
}

// mutantmarine.s/flamemarine.s direct-hit roll. Both handlers use the same
// signed-word X/Z deltas, wrapped long square sum, ASR.L #6 range scale, and
// strictly-greater comparison after extending GetRand's low 15 bits and
// shifting them left twice. A miss then enters aliencontrol.s:SHOOTPLAYER1.
export function sourceMarineInstantHit(
    randomWord, shooterX, shooterZ, playerX, playerZ) {
  const xDifference = signedWord(Math.floor(playerX) - Math.floor(shooterX));
  const zDifference = signedWord(Math.floor(playerZ) - Math.floor(shooterZ));
  const squared = (Math.imul(xDifference, xDifference) +
    Math.imul(zDifference, zDifference)) | 0;
  const random = ((signedWord(randomWord) & 0x7fff) << 2) | 0;
  return random > (squared >> 6);
}

// aliencontrol.s:SHOOTPLAYER1 miss endpoint before MoveObject traces it into a
// wall. GetRand is shifted as a signed word, each perpendicular adjustment is
// the swapped high word of a signed multiply, and every destination write is
// a wrapping word operation. playerY is `(p1_yoff + 15*128) ASR.L #7`.
export function sourceMarineMissTarget(
    randomWord, shooterX, shooterZ, playerX, playerZ, playerY) {
  const scatter = signedWord(randomWord) >> 4;
  const sourcePlayerX = signedWord(Math.floor(playerX));
  const sourcePlayerZ = signedWord(Math.floor(playerZ));
  const xDifference = signedWord(sourcePlayerX - Math.floor(shooterX));
  const zDifference = signedWord(sourcePlayerZ - Math.floor(shooterZ));
  const y = signedWord(Math.floor(playerY));
  return {
    x: signedWord(sourcePlayerX - signedHighProduct(zDifference, scatter)),
    z: signedWord(sourcePlayerZ + signedHighProduct(xDifference, scatter)),
    y: signedWord(y + signedHighProduct(y, scatter)),
  };
}

// anims:ItsABullet `.notabouncything` reflection. The source reads and writes
// only the high words of shotxvel/shotzvel, leaving each 16.16 low word intact.
// wallxsize/wallzsize are the unshifted MoveObject edge vector for bullets.
export function sourceBounceVelocity(xVelocityFixed, zVelocityFixed, edge) {
  const sourceX = xVelocityFixed | 0;
  const sourceZ = zVelocityFixed | 0;
  const xVelocity = signedWord(sourceX >> 16);
  const zVelocity = signedWord(sourceZ >> 16);
  const wallX = signedWord(edge.dx);
  const wallZ = signedWord(edge.dz);
  const wallLength = signedWord(edge.length);
  if (!wallLength) {
    return { xVelocityFixed: sourceX, zVelocityFixed: sourceZ };
  }
  const cross = (Math.imul(zVelocity, wallX) - Math.imul(xVelocity, wallZ)) | 0;
  const quotient = sourceDivsWord(cross, wallLength);
  const xChange = sourceDivsWord(
    Math.imul(signedWord(wallZ + wallZ), quotient), wallLength);
  const zChange = sourceDivsWord(
    Math.imul(signedWord(wallX + wallX), quotient), wallLength);
  const newX = signedWord(xVelocity + xChange);
  const newZ = signedWord(zVelocity - zChange);
  return {
    xVelocityFixed: ((newX << 16) | (sourceX & 0xffff)) | 0,
    zVelocityFixed: ((newZ << 16) | (sourceZ & 0xffff)) | 0,
  };
}

// anims:ComputeBlast .findhigh through .stillnot03.  Unlike CalcDist and
// HeadTowardsAng, the released second Newton numerator is estimate*zdiff.
export function sourceBlastDistance(xDifference, zDifference) {
  const x = signedWord(Math.trunc(xDifference));
  const z = signedWord(Math.trunc(zDifference));
  const squared = (Math.imul(x, x) + Math.imul(z, z)) | 0;
  if (!squared) return 0;
  const highBit = 31 - Math.clz32(squared >>> 0);
  let distance = signedWord(1 << (highBit >> 1));
  for (let pass = 0; pass < 3; pass++) {
    const product = pass === 1
      ? Math.imul(distance, z)
      : Math.imul(distance, distance);
    const difference = (product - squared) | 0;
    distance = signedWord(distance - sourceDivsWord(difference >> 1, distance));
    if (distance <= 0) distance = 1;
  }
  return distance;
}

export function sourceBlastDebrisHorizontalOffset(random, radius) {
  // anims:ComputeBlast DOFLAMES executes EXT.W after GetRand, sign-extending
  // only D0's low byte, then MULS d5 and ASR.W #1. A zero result is replaced
  // with two. Using the full random word produces a radically wider spray.
  const byte = random & 0xff;
  const signed = byte & 0x80 ? byte - 0x100 : byte;
  const offset = signedWord(Math.imul(signed, signedWord(radius))) >> 1;
  return offset || 2;
}

export function sourceBlastDebrisVerticalOffsetFixed(random, radius) {
  // The Y path intentionally omits EXT.W: MULS consumes the full signed random
  // word and ASR.L #3 leaves a 25.7 fixed-point delta in newy.
  return Math.imul(signedWord(random), signedWord(radius)) >> 3;
}

export function sourceBlastDebrisClampY(yFixed, floorFixed, roofFixed) {
  // anims:ComputeBlast .okinbot/.abovefloor/.belowroof. Keep the CMP/BGT and
  // CMP/BLT order literally; it is not the conventional min/max clamp that
  // the browser previously substituted.
  let result = yFixed | 0;
  const floor = floorFixed | 0;
  const roof = roofFixed | 0;
  if (floor > result) result = floor;
  if (!(roof < result)) result = roof;
  return result | 0;
}

export function sourceDirectionFromAngleUnits(angleUnits) {
  const { sinWord: xFixed, cosWord: zFixed } = sourceAngleTrig(angleUnits);
  // Released movement consumes the SineTable words directly. Do not attach a
  // browser-normalized floating direction: no source routine computes one.
  return { xFixed, zFixed };
}

export function sourceGoInDirection(oldX, oldZ, angleUnits, speed) {
  // objectmove:GoInDirection (lines 1812-1827) performs signed word MULS,
  // doubles each 32-bit product with ADD.L, swaps it, then adds only the low
  // word to oldx/oldz. Keep that register-width sequence explicit instead of
  // relying on unrestricted floating multiplication and division.
  const { sinWord, cosWord } = sourceAngleTrig(angleUnits);
  const sourceSpeed = signedWord(speed);
  const doubledX = (Math.imul(signedWord(sinWord), sourceSpeed) * 2) | 0;
  const doubledZ = (Math.imul(signedWord(cosWord), sourceSpeed) * 2) | 0;
  const xStep = signedWord(doubledX >>> 16);
  const zStep = signedWord(doubledZ >>> 16);
  return {
    x: signedWord(signedWord(oldX) + xStep),
    z: signedWord(signedWord(oldZ) + zStep),
    xStep,
    zStep,
  };
}

export function sourceInstantNoTargetMissRay(
    playerX, playerZ, playerSourceY, angleUnits, random) {
  // playershoot.s:nothingtoshoot uses the signed SineTable words shifted by
  // ASR.W #7 as one MoveObject step. Its vertical step is a signed 12-bit
  // random delta in the engine's 25.7 Y representation.
  const { sinWord, cosWord } = sourceAngleTrig(angleUnits);
  const startYFixed = (Math.trunc(playerSourceY * 128) + 20 * 128) | 0;
  return {
    x: signedWord(Math.floor(playerX)),
    z: signedWord(Math.floor(playerZ)),
    dx: signedWord(sinWord) >> 7,
    dz: signedWord(cosWord) >> 7,
    startYFixed,
    yStepFixed: signedWord((random & 0x0fff) - 0x0800),
  };
}

export function sourceInstantTargetMissRay(
    playerX, playerZ, playerSourceY, targetX, targetZ, objectScanTerminatorY) {
  // PLR1MISSINSTANT forms a half-distance signed-word X/Z step. Its Y target
  // is not a5 (the selected enemy): a0 still addresses the negative object
  // scan terminator, and the routine reads word 4 from that layout.
  if (!Number.isInteger(objectScanTerminatorY)) {
    throw new Error('retail level is missing its object-scan terminator Y word');
  }
  const x = signedWord(Math.floor(playerX));
  const z = signedWord(Math.floor(playerZ));
  const startYFixed = (Math.trunc(playerSourceY * 128) + 20 * 128) | 0;
  const endYFixed = (signedWord(objectScanTerminatorY) << 7) | 0;
  return {
    x,
    z,
    dx: signedWord(signedWord(targetX - x) >> 1),
    dz: signedWord(signedWord(targetZ - z) >> 1),
    startYFixed,
    yStepFixed: (endYFixed - startYFixed) | 0,
  };
}

function playerSourceAngleUnits(player) {
  return Number.isFinite(player.angleUnits)
    ? player.angleUnits & 8190
    : radiansToSourceAngle(Number.isFinite(player.angle) ? player.angle : 0);
}

export function sourceFacing(dx, dz) {
  // HeadTowardsAng stores coordinate deltas as signed words, obtains their
  // length with three integer Newton passes, then performs four SineTable
  // comparisons. Its result is deliberately coarser than atan2.
  const xDifference = signedWord(Math.floor(dx));
  const zDifference = signedWord(Math.floor(dz));
  const squared = (Math.imul(xDifference, xDifference) +
    Math.imul(zDifference, zDifference)) | 0;
  if (!squared) return 0;

  return sourceHeadingFromWords(xDifference, zDifference, squared).angleUnits;
}

export function sourceHeadTowards(oldX, oldZ, targetX, targetZ, range, speed) {
  // objectmove:HeadTowardsAng keeps all four coordinates, Range, and speed as
  // signed words. The same three-pass distance drives both GotThere and the
  // signed DIVS step; using Math.hypot here changes enemy stopping distances.
  const sourceOldX = signedWord(Math.floor(oldX));
  const sourceOldZ = signedWord(Math.floor(oldZ));
  const sourceTargetX = signedWord(Math.floor(targetX));
  const sourceTargetZ = signedWord(Math.floor(targetZ));
  const xDifference = signedWord(sourceTargetX - sourceOldX);
  const zDifference = signedWord(sourceTargetZ - sourceOldZ);
  const squared = (Math.imul(xDifference, xDifference) +
    Math.imul(zDifference, zDifference)) | 0;
  if (!squared) {
    return {
      x: sourceOldX, z: sourceOldZ, gotThere: true,
      heading: { angleUnits: 0, sinWord: 0, cosWord: 0, distance: 0 },
    };
  }

  const heading = sourceHeadingFromWords(xDifference, zDifference, squared);
  const sourceRange = signedWord(Math.trunc(range));
  if (heading.distance <= sourceRange) {
    return { x: sourceOldX, z: sourceOldZ, gotThere: true, heading };
  }

  const speedAndRange = signedWord(Math.trunc(speed) + sourceRange);
  const gotThere = speedAndRange >= heading.distance;
  const travel = gotThere
    ? signedWord(heading.distance - sourceRange)
    : signedWord(Math.trunc(speed));
  const xStep = sourceDivsWord(Math.imul(xDifference, travel), heading.distance);
  const zStep = sourceDivsWord(Math.imul(zDifference, travel), heading.distance);
  return {
    x: signedWord(sourceOldX + xStep),
    z: signedWord(sourceOldZ + zStep),
    gotThere,
    heading,
  };
}

export function sourceRunAroundTarget(objectX, objectZ, playerX, playerZ, playerAngleUnits) {
  // aliencontrol.s:RunAround. Every coordinate operation is word-sized and
  // its side decision is the wrapped signed-long result of two MULS values.
  const sourceObjectX = signedWord(Math.floor(objectX));
  const sourceObjectZ = signedWord(Math.floor(objectZ));
  const sourcePlayerX = signedWord(Math.floor(playerX));
  const sourcePlayerZ = signedWord(Math.floor(playerZ));
  let halfX = signedWord(sourceObjectX - sourcePlayerX) >> 1;
  let halfZ = signedWord(sourceObjectZ - sourcePlayerZ) >> 1;
  const { sinWord, cosWord } = sourceAngleTrig(playerAngleUnits);
  const side = (Math.imul(signedWord(sourceObjectX - sourcePlayerX), cosWord) -
    Math.imul(signedWord(sourceObjectZ - sourcePlayerZ), sinWord)) | 0;
  if (side >= 0) {
    halfX = signedWord(-halfX);
    halfZ = signedWord(-halfZ);
  }
  return {
    x: signedWord(sourcePlayerX - halfZ),
    z: signedWord(sourcePlayerZ + halfX),
  };
}

function sourceHeadingFromWords(xDifference, zDifference, squared) {
  const distance = sourceApproxDistanceFromSquared(squared, 3);

  const divisor = signedWord(distance + 1);
  const sinRet = sourceDivsWord(Math.imul(xDifference, 32768), divisor);
  const cosRet = sourceDivsWord(Math.imul(zDifference, 32768), divisor);
  let candidate = 0;
  let increment = 2048;
  for (let pass = 0; pass < 4; pass++) {
    const { sinWord, cosWord } = sourceAngleTrig(candidate * 2);
    const cross = (Math.imul(sinRet, cosWord) - Math.imul(cosRet, sinWord)) | 0;
    if (cross >= 0) candidate = signedWord(candidate + increment * 2);
    candidate = (candidate - increment) & 4095;
    increment >>= 1;
  }
  return {
    angleUnits: (candidate * 2) & 8190,
    sinWord: sinRet,
    cosWord: cosRet,
    distance,
  };
}

function sourceApproxDistance(xDifference, zDifference, passes) {
  const x = signedWord(Math.trunc(xDifference));
  const z = signedWord(Math.trunc(zDifference));
  const squared = (Math.imul(x, x) + Math.imul(z, z)) | 0;
  return squared ? sourceApproxDistanceFromSquared(squared, passes) : 0;
}

function sourceApproxDistanceFromSquared(squared, passes) {
  const highBit = 31 - Math.clz32(squared >>> 0);
  let distance = signedWord(1 << (highBit >> 1));
  for (let pass = 0; pass < passes; pass++) {
    const difference = (Math.imul(distance, distance) - squared) | 0;
    distance = signedWord(distance - sourceDivsWord(difference >> 1, distance));
    if (distance <= 0) distance = 1;
  }
  return distance;
}

function sourceHeadTowardsLinear(oldX, oldZ, targetX, targetZ, range, speed) {
  // objectmove:HeadTowards/CalcDist use two Newton passes (HeadTowardsAng
  // deliberately uses three). FireAtPlayer1 consumes the resulting distaway.
  const sourceOldX = signedWord(Math.floor(oldX));
  const sourceOldZ = signedWord(Math.floor(oldZ));
  const sourceTargetX = signedWord(Math.floor(targetX));
  const sourceTargetZ = signedWord(Math.floor(targetZ));
  const xDifference = signedWord(sourceTargetX - sourceOldX);
  const zDifference = signedWord(sourceTargetZ - sourceOldZ);
  const distance = sourceApproxDistance(xDifference, zDifference, 2);
  if (!distance) return { x: sourceOldX, z: sourceOldZ, distance: 0, gotThere: true };

  const sourceRange = signedWord(Math.trunc(range));
  if (distance <= sourceRange) {
    const xRetreat = sourceDivsWord(Math.imul(xDifference, sourceRange), distance);
    const zRetreat = sourceDivsWord(Math.imul(zDifference, sourceRange), distance);
    return {
      x: signedWord(sourceTargetX - xRetreat),
      z: signedWord(sourceTargetZ - zRetreat),
      distance,
      gotThere: true,
    };
  }
  const speedAndRange = signedWord(Math.trunc(speed) + sourceRange);
  const gotThere = speedAndRange >= distance;
  const travel = gotThere ? signedWord(distance - sourceRange) : signedWord(Math.trunc(speed));
  return {
    x: signedWord(sourceOldX + sourceDivsWord(
      Math.imul(xDifference, travel), distance)),
    z: signedWord(sourceOldZ + sourceDivsWord(
      Math.imul(zDifference, travel), distance)),
    distance,
    gotThere,
  };
}

export function robotSteering(facing, target, step) {
  const targetTrig = sourceAngleTrig(target);
  return robotSteeringToWords(facing, targetTrig.sinWord, targetTrig.cosWord, step);
}

function robotSteeringToWords(facing, targetSin, targetCos, step) {
  const facingTrig = sourceAngleTrig(facing);
  const cross = (Math.imul(facingTrig.sinWord, targetCos) -
    Math.imul(facingTrig.cosWord, targetSin)) | 0;
  const threshold = sourceAngleTrig(120).sinWord * 32768;
  let amount = 0;
  if (!(threshold > Math.abs(cross))) amount = cross < 0 ? step : -step;
  const dot = (Math.imul(facingTrig.cosWord, targetCos) +
    Math.imul(facingTrig.sinWord, targetSin)) | 0;
  const canAdvance = dot > 0x20000000;
  if (!canAdvance) amount = amount ? amount * 2 : step * 2;
  return { amount, canAdvance, canShoot: canAdvance };
}

export function sourceVisibilityClipAllows(clip, points, viewerX, viewerZ, targetX, targetZ) {
  if (!clip) return true;
  // objectmove:CanItBeSeen checklcliploop/checkrcliploop.  Every coordinate
  // subtraction is a signed word and each MULS/SUB.L result wraps to 32 bits.
  const sourceViewerX = signedWord(Math.floor(viewerX));
  const sourceViewerZ = signedWord(Math.floor(viewerZ));
  const dx = signedWord(Math.floor(targetX) - sourceViewerX);
  const dz = signedWord(Math.floor(targetZ) - sourceViewerZ);
  const side = point => {
    if (!point) return 0;
    const pointX = signedWord(point[0] - sourceViewerX);
    const pointZ = signedWord(point[1] - sourceViewerZ);
    return (Math.imul(pointZ, dx) - Math.imul(pointX, dz)) | 0;
  };
  for (const pointId of clip.leftPoints || []) {
    if (side(points[pointId]) <= 0) return false;
  }
  for (const pointId of clip.rightPoints || []) {
    if (side(points[pointId]) >= 0) return false;
  }
  return true;
}
