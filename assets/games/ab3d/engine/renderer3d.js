import {
  continuousVisibleRooms, sourceVisibleRooms,
} from './geometry.js?v=source-fidelity-7';
import {
  DynamicWorld, sourceDivsWord, weaponView,
} from './simulation.js?v=source-fidelity-58';
import { decodeRGB12, objectLightRow } from './textures.js?v=source-fidelity-21';
import {
  CROUCHED_STEP, radiansToSourceAngle, sourceAngleRadians, sourceAngleTrig,
  SourcePlayerMotion, STANDING_HEIGHT, STANDING_STEP,
} from './movement.js?v=source-fidelity-11';
import { SOURCE_RENDERER_CONSTANTS } from '../assets/renderer-constants.js?v=source-fidelity-1';

const WIDTH = 320;
// putinsmallscr is the retail default: its smallscrntab expands the 96 x 80
// chunky viewport twice on each axis, placing the 192 x 160 result between two
// 64-pixel attached-sprite borders. The planar cockpit is the full 320 x 96.
const VIEW_LEFT = 64;
const VIEW_WIDTH = 192;
const VIEW_HEIGHT = 160;
const SOURCE_VIEW_WIDTH = 96;
const SOURCE_VIEW_HEIGHT = 80;
const HEIGHT = 256;
// The sprite stop coordinate is raster 212. Relative to DIWSTRT 44 that is
// output line 168, where PanelCop begins; only the first 88 of 96 source panel
// rows are visible before the 256-line display ends.
const PANEL_TOP = 168;
const PANEL_VISIBLE_HEIGHT = HEIGHT - PANEL_TOP;
// RotateLevelPts, every wall projection, BitMapObj, and PolygonObj add source
// column 47. The 96-column buffer is intentionally asymmetric around it.
const VIEW_CENTER_X = VIEW_LEFT + 47 * 2;
const VIEW_CENTER_Y = VIEW_HEIGHT / 2;
// BitMapObj alone adds source row 39 for the sprite anchor; room bounds,
// walls, planes, and polygon objects use row 40.
const BITMAP_CENTER_Y = 39 * 2;
// RotateObjectPts and the copper expansion produce a 128-pixel horizontal
// focal length and a 256-pixel vertical one in the small display.
const FOCAL_X = 128;
const FOCAL_Y = 256;
const PLAYER_HEIGHT = STANDING_HEIGHT;
export const PLAYER_EXTLEN = 40;

// archive/amos/leveld.asc:92-118 is the original WCY table used to produce
// VALAND/VALSHIFT. Its upper-wall writer at line 1662 accidentally looks up
// WCY/WCSV through the corresponding lower-wall ZWG bank rather than UZWG
// (compare the symmetric lower writer at line 1340). All 43 retail descriptor
// mismatches are upper walls and match that exact typo. Preserve their raw
// words in the manifests, but use the source-declared selected-bank stride at
// render time; this also prevents the Level A RedAlert U=63,V>=64 over-read.
const SOURCE_WALL_BANK_HEIGHTS = Object.freeze([
  64, 64, 128, 64, 64, 64, 128, 16, 128, 64, 128, 64, 128, 64,
]);

export function sourceWallTextureStride(textureBank, encodedStride, upperLayer = false) {
  return upperLayer ? (SOURCE_WALL_BANK_HEIGHTS[textureBank] ?? encodedStride) : encodedStride;
}

// newtwo.s:PLR1_Control `.noteleport` restores only oldx/oldz's high word
// after Collision reports an object hit. On the big-endian 68000, MOVE.W to
// PLR1_xoff/PLR1_zoff leaves the proposed position's low fractional word in
// place. Preserve that exact mixed fixed-point value here.
export function sourceRejectedObjectPosition(oldPosition, proposedPosition) {
  const oldFixed = Math.trunc(oldPosition * 65536) | 0;
  const proposedFixed = Math.trunc(proposedPosition * 65536) | 0;
  return (((oldFixed & 0xffff0000) | (proposedFixed & 0xffff)) | 0) / 65536;
}

function sourcePositionFraction(position) {
  return ((Math.trunc(position * 65536) | 0) & 0xffff) / 65536;
}
const PLANE_TYPES = new Set([
  'floor', 'roof', 'water', 'chunky-floor', 'chunky-roof', 'bumpy-floor', 'bumpy-roof',
]);
const LITTLE_ENDIAN_RGBA = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 4;

function packedRgba(red, green, blue, alpha = 255) {
  return LITTLE_ENDIAN_RGBA
    ? ((alpha << 24) | (blue << 16) | (green << 8) | red) >>> 0
    : ((red << 24) | (green << 16) | (blue << 8) | alpha) >>> 0;
}
const ORDINARY_PLANE_TYPES = new Set(['floor', 'roof']);
const ROOF_PLANE_TYPES = new Set(['roof', 'chunky-roof', 'bumpy-roof']);
const INITIALIZED_GRAPHIC_TYPES = new Map([
  [8, 4], [12, 10], [13, 13], [14, 14], [16, 15], [18, 16], [19, 17],
]);
const PAUSE_LINES = Object.freeze([
  '            ', '            ', 'SFX  QUALITY', 'FOUR CH MONO',
  '            ', 'FLOOR DETAIL', '  GOURAUD   ', '            ',
  '            ', '            ',
]);
export const SOUND_QUALITY_NAMES = Object.freeze([
  'FOUR CH MONO', ' FOUR CH ST ', 'EIGHT C MONO', ' EIGHT C ST ',
]);
export const FLOOR_DETAIL_NAMES = Object.freeze([
  '  GOURAUD   ', '  TEXTURED  ', 'PLAIN SHADED', '    NONE    ',
]);

// Unpacked retail abd8ch $3ffe-$402d is the complete selector branch omitted
// from the surviving pauseopts text: increment TOPPOPT modulo four, use the
// interleaved STEROPT bytes 00,04,ff,04,00,08,ff,08, and write STEREO plus
// Prefsfile[1]. Its PAUSETXT/SOUNDOPTS bytes are at $4368-$4410. Backwards is
// the source pauseopts BOTPOPT floor-detail branch at retail $3f7c-$3ff8.
export function changePauseOptions(options, direction) {
  const next = {
    soundQuality: (options?.soundQuality ?? 0) & 3,
    floorDetail: (options?.floorDetail ?? 0) & 3,
  };
  if (direction === 'forward') next.soundQuality = (next.soundQuality + 1) & 3;
  if (direction === 'backward') next.floorDetail = (next.floorDetail + 1) & 3;
  return next;
}

export function pauseOptionLines(options = {}) {
  const lines = [...PAUSE_LINES];
  lines[3] = SOUND_QUALITY_NAMES[(options.soundQuality ?? 0) & 3];
  lines[6] = FLOOR_DETAIL_NAMES[(options.floorDetail ?? 0) & 3];
  return lines;
}

export function sourceFloorBrightness(lightType, distance) {
  return Math.max(0, Math.min(28, lightType + 5 + Math.floor(distance / 256)));
}

const BRIGHT_ANIMATIONS = Object.freeze([
  Object.freeze([
    -10, -10, -9, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7,
    8, 9, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7, -8, -9,
  ]),
  Object.freeze([
    ...Array(20).fill(10), -10, ...Array(30).fill(10), -10,
    ...Array(5).fill(10), -10,
  ]),
  Object.freeze([
    -10, -9, -6, -10, -6, -5, -5, -7, -5, -10, -9, -8, -7, -5, -5, -5, -5,
    -5, -5, -5, -5, -6, -7, -8, -9, -5, -10, -9, -10, -6, -5, -5, -5, -5, -5,
    -5, -5,
  ]),
]);

// The point-light words are decoded by the justtheone loop in newtwo.s. The
// low byte is the signed base. A nonzero high byte selects a BrightAnimTable
// entry with its upper nibble controlling the 1/16 interpolation strength.
export function sourcePointBrightness(word, tick = 0) {
  word &= 0xffff;
  const base = word << 24 >> 24;
  if (base < 0) return base;
  const descriptor = word >>> 8;
  if (!descriptor) return base;
  const animation = BRIGHT_ANIMATIONS[(descriptor & 15) - 1];
  if (!animation) return base;
  // anims:BrightAnimTable is zero-filled BSS. newtwo.s:donetalking consumes
  // that current table before objmoveanim:brightanim advances its three
  // pointers. Step zero is therefore literal zero, not animation entry zero.
  const step = Math.trunc(tick);
  const value = step <= 0 ? 0 : animation[(step - 1) % animation.length];
  return base + Math.floor((value - base) * ((descriptor >>> 4) + 1) / 16);
}

// NEWTWO.s:donetalking lines 1480-1524 rebuilds ZoneBrightTable before every
// display. Unlike the point-light path below it, a nonzero high byte selects
// the current BrightAnimTable word outright; the low byte is not blended.
export function sourceZoneBrightness(word, tick = 0) {
  word &= 0xffff;
  const signed = rendererSignedWord(word);
  if (signed < 0) return signed;
  const descriptor = word >>> 8;
  if (!descriptor) return signed;
  const animation = BRIGHT_ANIMATIONS[descriptor - 1];
  if (!animation) {
    throw new RangeError(`zone brightness animation ${descriptor} is outside released data`);
  }
  const step = Math.trunc(tick);
  return step <= 0 ? 0 : animation[(step - 1) % animation.length];
}

export function sourceGouraudRow(pointBrightness, distance) {
  const light = Math.max(0, Math.trunc(pointBrightness) + Math.floor(distance / 128));
  return Math.min(14, Math.floor(light / 2));
}

// RotateObjectPts stores twice the browser world-depth unit. ObjDraw's
// ASR.W #7 therefore contributes floor(browserDepth / 64).
export function sourceObjectBrightness(base, depth) {
  return Math.max(0, Math.trunc(base) + Math.floor(depth / 64));
}

export const SOURCE_DISPLAY = Object.freeze({
  width: WIDTH, height: HEIGHT,
  viewLeft: VIEW_LEFT, viewWidth: VIEW_WIDTH, viewHeight: VIEW_HEIGHT,
  panelWidth: 320, panelHeight: 96, panelTop: PANEL_TOP,
  panelVisibleHeight: PANEL_VISIBLE_HEIGHT,
  borderWidth: 64, focalX: FOCAL_X, focalY: FOCAL_Y,
});

// Explicit browser-only 16:9 layout requested for the enhanced sharp port.
// Scaling the 160-row Sharp view to 180 rows gives 9/8 pixels per existing
// browser pixel (source scale 2 -> 9/4) and retains the vertical field of view.
// The remaining horizontal columns extend the view instead of stretching it.
// The retail panel remains at native decoded size. By explicit request the
// Enhanced compositor suppresses the static lateral sprite art and retains
// only the gauges derived from the released health/ammo strips.
export const ENHANCED_DISPLAY = Object.freeze({
  width: 448, height: 276,
  viewLeft: 64, viewWidth: 320, viewHeight: 180,
  panelWidth: 320, panelHeight: 96, panelTop: 180,
  panelVisibleHeight: 96,
  borderWidth: 64,
  pixelScale: 9 / 4,
  // RotateLevelPts' column-47 origin is one source pixel left of the centre
  // of its 96-column view. Preserve that offset inside the wider viewport.
  viewCenterX: 64 + 320 / 2 - 9 / 4,
  viewCenterY: 90,
  bitmapCenterY: 39 * (9 / 4),
  focalX: 64 * (9 / 4),
  focalY: 128 * (9 / 4),
});

export const DISPLAY_MODES = Object.freeze({
  ORIGINAL: 'original', SHARP: 'sharp', ENHANCED: 'enhanced',
});

function standardDisplay() {
  return {
    ...SOURCE_DISPLAY,
    pixelScale: 2,
    viewCenterX: VIEW_CENTER_X,
    viewCenterY: VIEW_CENTER_Y,
    horizonY: VIEW_CENTER_Y,
    bitmapCenterY: BITMAP_CENTER_Y,
    panelLeft: 0,
  };
}

const STANDARD_DISPLAY = Object.freeze(standardDisplay());
const ENHANCED_LOOK_LIMIT = Math.atan((72 / 110) *
  (ENHANCED_DISPLAY.viewHeight / ENHANCED_DISPLAY.focalY));

function rendererProjection(renderer) {
  return typeof renderer?.projection === 'function'
    ? renderer.projection() : STANDARD_DISPLAY;
}

function cameraSnapshot(camera) {
  return { ...camera };
}

function cameraPoseChanged(first, second) {
  if (!first || !second) return false;
  return first.x !== second.x || first.z !== second.z ||
    first.y !== second.y || first.viewY !== second.viewY ||
    first.angleUnits !== second.angleUnits || first.zone !== second.zone ||
    first.inUpper !== second.inUpper ||
    first.bobbleAcross !== second.bobbleAcross ||
    first.bobbleFloorX !== second.bobbleFloorX ||
    first.bobbleFloorZ !== second.bobbleFloorZ;
}

function sourcePlayerLayerHeights(level, world, camera) {
  const zone = level.zones[camera.zone] || level.zones[0];
  // newtwo.s:PLR1_Control lines 3138-3141 selects ToUpperFloor when
  // PLR1_StoodInTop is set. plr1control.s lines 175-181 makes the matching
  // upper floor/roof selection for the standing-clearance test.
  if (camera.inUpper) {
    return { floor: zone.upperFloor, roof: zone.upperRoof };
  }
  return {
    floor: world?.zoneFloor(zone.id) ?? zone.floor,
    roof: world?.zoneRoof(zone.id) ?? zone.roof,
  };
}

export function interpolatePresentationCamera(previous, current, alpha) {
  if (!previous || !current) return current ? cameraSnapshot(current) : null;
  // A portal/layer change has no recovered fractional crossing time. Snap the
  // browser presentation at that exact source tick instead of inventing which
  // room owns an in-between camera.
  if (previous.zone !== current.zone || previous.inUpper !== current.inUpper) {
    return cameraSnapshot(current);
  }
  const amount = Math.max(0, Math.min(1, Number(alpha) || 0));
  const result = cameraSnapshot(current);
  for (const field of [
    'x', 'z', 'y', 'viewY', 'height', 'bobbleAcross',
    'bobbleFloorX', 'bobbleFloorZ',
  ]) {
    if (Number.isFinite(previous[field]) && Number.isFinite(current[field])) {
      result[field] = previous[field] + (current[field] - previous[field]) * amount;
    }
  }
  // Source angles wrap at 8192 and occupy even units. Interpolate the shortest
  // presentation arc, then return to the same released even-unit sine table.
  const fromAngle = Math.trunc(previous.angleUnits || 0) & 8190;
  const toAngle = Math.trunc(current.angleUnits || 0) & 8190;
  const delta = ((toAngle - fromAngle + 4096) & 8191) - 4096;
  result.angleUnits = (Math.round((fromAngle + delta * amount) / 2) * 2) & 8190;
  result.angle = sourceAngleRadians(result.angleUnits);
  return result;
}

export const UI_ALIGNMENT = Object.freeze({
  // newtwo.s starts the sprites at raster 52 while the display begins at 44.
  // Their 160-line data therefore extends eight lines over the cockpit.
  borderShiftY: 0,
  // newtwo.s:DRAWINGUN lines 2438-2464 addresses frompt directly with
  // GUNYOFFS*104*4. DRAWCHUNK lines 2474-2498 ends at chunky row 78; there is
  // no source-side post-expansion nudge to move that last row onto row 79.
  weaponShiftY: 0,
});

// PAUSEOPTS works on the 96x80 chunky view before putinsmallscr doubles it.
// Transparent pause-font pixels retain the live picture at half RGB12
// brightness; nonzero direct-RGB12 glyph pixels replace it.
export function drawPauseOverlay(pixels, fonts, options = {}, display = STANDARD_DISPLAY) {
  for (let y = 0; y < display.viewHeight; y++) {
    for (let x = display.viewLeft; x < display.viewLeft + display.viewWidth; x++) {
      const at = (y * display.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const nibble = Math.round(pixels[at + channel] / 17);
        pixels[at + channel] = ((nibble & 14) >>> 1) * 17;
      }
    }
  }
  if (!fonts) return;
  const lines = pauseOptionLines(options);
  const textLeft = display.viewLeft + Math.floor((display.viewWidth - 12 * 16) / 2);
  const textTop = Math.floor((display.viewHeight - 10 * 16) / 2);
  for (let row = 0; row < lines.length; row++) {
    for (let column = 0; column < 12; column++) {
      const code = lines[row].charCodeAt(column);
      for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
          const colour = fonts.sample('pausefont', code, px, py);
          if (!colour) continue;
          const startX = textLeft + (column * 8 + px) * 2;
          const startY = textTop + (row * 8 + py) * 2;
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const at = ((startY + dy) * display.width + startX + dx) * 4;
              pixels[at] = colour[0];
              pixels[at + 1] = colour[1];
              pixels[at + 2] = colour[2];
              pixels[at + 3] = 255;
            }
          }
        }
      }
    }
  }
}

export function sourcePlayerMoveResult(level, world, fromZone, from, requested,
    extlen = PLAYER_EXTLEN, playerHeight = PLAYER_HEIGHT, stepLimit = STANDING_STEP) {
  // newtwo.s clears exitfirst before MoveObject. Each blocking edge therefore
  // executes objectmove:.calcalong, replaces only newx/newz's high words, and
  // leaves the projected result for the following edge in source list order.
  const fractionX = sourcePositionFraction(requested.x);
  const fractionZ = sourcePositionFraction(requested.z);
  if (typeof world?.traceMoveObjectSlide !== 'function') {
    throw new Error('player movement requires the recovered MoveObject traversal');
  }
  // newtwo.s:PLR1_Control installs the player profile, extlen=40 and
  // awayfromwall=0, then calls the same objectmove:MoveObject used by game
  // objects. The packed -1..-2 proximity list is significant at corners and
  // cannot be reconstructed by scanning an arbitrary neighbouring room.
  const playerY = Number.isFinite(from.y) ? from.y :
    (from.inUpper
      ? level.zones[fromZone].upperFloor
      : world.zoneFloor(fromZone)) / 256 - playerHeight;
  const moved = world.traceMoveObjectSlide({
    zone: fromZone, inUpper: Boolean(from.inUpper),
    position: { x: from.x, z: from.z, y: playerY * 2 },
  }, {
    x: requested.x, z: requested.z, yFixed: Math.trunc(playerY * 256) | 0,
  }, {
    oldYFixed: Math.trunc(playerY * 256) | 0,
    extlen, awayFromWall: 0,
    profile: {
      thingHeight: Math.trunc(playerHeight * 256) | 0,
      stepUp: Math.trunc(stepLimit * 256) | 0,
      stepDown: 0x1000000,
    },
  });
  return {
    x: moved.x + fractionX, z: moved.z + fractionZ,
    zone: moved.zone, inUpper: moved.inUpper,
  };
}

export class SourceViewRenderer {
  constructor(textures, objectTextures, panel, vectorObjects = null, fonts = null) {
    this.textures = textures;
    this.objectTextures = objectTextures;
    this.panel = panel;
    if (panel?.manifest?.borders) {
      const layout = panel.manifest.borders;
      // export_panel.js recovers these raster values from the unique retail
      // sprite and putinsmallscr setup opcode sequences. Fail on stale assets
      // instead of silently introducing a cockpit seam through UI constants.
      if (layout.verticalStart - layout.displayStart !== 8 ||
          layout.verticalStop - layout.displayStart !== PANEL_TOP) {
        throw new Error('retail cockpit raster layout disagrees with the renderer');
      }
    }
    this.vectorObjects = vectorObjects;
    this.fonts = fonts;
    this.surface = document.createElement('canvas');
    this.surface.width = WIDTH;
    this.surface.height = HEIGHT;
    this.context = this.surface.getContext('2d');
    this.image = this.context.createImageData(WIDTH, HEIGHT);
    this.camera = { x: 0, z: 0, y: -PLAYER_HEIGHT, angle: 0, angleUnits: 0, zone: 0 };
    this.motion = new SourcePlayerMotion();
    this.lookBehind = false;
    // BIGsmall starts clear and screensetup.s calls putinsmallscr. The optional
    // sharp mode retains the earlier browser raster only because it was
    // explicitly requested as a presentation option.
    this.sourcePixels = true;
    this.displayMode = DISPLAY_MODES.ORIGINAL;
    this.portLookPitch = 0;
    this.sourceFramebuffers = createSourceFramebuffers();
    this.sourceFramebufferIndex = 0;
    // Retail Prefsfile is "k4nx" at runtime $2a9a: option zero, four-channel
    // mono. BOTPOPT is zero-initialized, selecting Gouraud floors.
    this.pauseOptions = { soundQuality: 0, floorDetail: 0 };
    this.browserCheats = { invulnerability: false, infiniteBullets: false };
    this.world = null;
    this.presentationPrevious = cameraSnapshot(this.camera);
    this.presentationCurrent = cameraSnapshot(this.camera);
    this.sourceVisibilityCache = null;
    // Browser-only continuous raster scratch. Reusing these numeric lanes
    // avoids one short-lived array (and, for Gouraud, object records) for every
    // polygon scanline while preserving the same sorted intersections.
    this.scanlineScratch = { x: [], brightness: [] };
  }

  reset(level) {
    this.world = new DynamicWorld(level);
    this.world.setBrowserCheats(this.browserCheats);
    this.world.waterWorkspace = this.textures?.waterWorkspaceForLevel?.(level.level) ?? null;
    this.camera.x = level.player1.x;
    this.camera.z = level.player1.z;
    this.camera.zone = level.player1.zone;
    // newtwo.s line 730 clears PLR1_StoodInTop when setting up a game.
    this.camera.inUpper = false;
    this.camera.angleUnits = level.player1.angle & 8190;
    this.camera.angle = sourceAngleRadians(this.camera.angleUnits);
    this.portLookPitch = 0;
    this.syncBrowserAim();
    this.motion.reset();
    this.sourceFramebuffers = createSourceFramebuffers();
    this.sourceFramebufferIndex = 0;
    this.sourceVisibilityCache = null;
    this.updateHeight(level);
    this.syncPresentationCamera();
  }

  updateHeight(level) {
    const heights = sourcePlayerLayerHeights(level, this.world, this.camera);
    this.camera.height = this.motion.height;
    this.camera.crouched = this.motion.crouched;
    this.camera.y = heights.floor / 256 - this.motion.height;
    this.motion.syncCameraBobble(this.camera);
  }

  toggleCrouch() { return this.motion.toggleCrouch(); }

  setSourcePixels(enabled) {
    this.setDisplayMode(enabled ? DISPLAY_MODES.ORIGINAL : DISPLAY_MODES.SHARP);
    return this.sourcePixels;
  }

  toggleSourcePixels() { return this.setSourcePixels(!this.sourcePixels); }

  setDisplayMode(mode) {
    if (!Object.values(DISPLAY_MODES).includes(mode)) {
      throw new RangeError(`unknown browser display mode ${mode}`);
    }
    this.displayMode = mode;
    this.sourcePixels = mode === DISPLAY_MODES.ORIGINAL;
    if (mode !== DISPLAY_MODES.ENHANCED) this.portLookPitch = 0;
    const display = this.display;
    if (this.surface.width !== display.width || this.surface.height !== display.height) {
      this.surface.width = display.width;
      this.surface.height = display.height;
      this.context = this.surface.getContext('2d');
      this.image = this.context.createImageData(display.width, display.height);
    }
    this.syncBrowserAim();
    this.syncPresentationCamera();
    return this.displayMode;
  }

  get display() {
    return this.displayMode === DISPLAY_MODES.ENHANCED
      ? ENHANCED_DISPLAY : STANDARD_DISPLAY;
  }

  lookVertical(amount) {
    if (this.displayMode !== DISPLAY_MODES.ENHANCED || !Number.isFinite(amount)) return false;
    const before = this.portLookPitch;
    this.portLookPitch = Math.max(
      -ENHANCED_LOOK_LIMIT, Math.min(ENHANCED_LOOK_LIMIT, before + amount));
    this.syncBrowserAim();
    return this.portLookPitch !== before;
  }

  resetVerticalLook() {
    const changed = this.portLookPitch !== 0;
    this.portLookPitch = 0;
    this.syncBrowserAim();
    return changed;
  }

  syncBrowserAim() {
    if (!this.camera) return;
    if (this.displayMode === DISPLAY_MODES.ENHANCED) {
      this.camera.browserAimSlope = Math.tan(this.portLookPitch);
    } else {
      delete this.camera.browserAimSlope;
    }
  }

  projection() {
    const display = this.display;
    return {
      ...display,
      horizonY: display.viewCenterY -
        (this.displayMode === DISPLAY_MODES.ENHANCED
          ? Math.tan(this.portLookPitch) * display.focalY : 0),
    };
  }

  changePauseOption(direction) {
    this.pauseOptions = changePauseOptions(this.pauseOptions, direction);
    return { ...this.pauseOptions };
  }

  syncPresentationCamera() {
    this.presentationPrevious = cameraSnapshot(this.camera);
    this.presentationCurrent = cameraSnapshot(this.camera);
  }

  presentationCamera() {
    if (this.displayMode === DISPLAY_MODES.ORIGINAL) return this.camera;
    return interpolatePresentationCamera(
      this.presentationPrevious, this.presentationCurrent,
      this.motion?.accumulator ?? 1);
  }

  needsPresentationFrame() {
    return this.displayMode !== DISPLAY_MODES.ORIGINAL &&
      cameraPoseChanged(this.presentationPrevious, this.presentationCurrent);
  }

  control(level, seconds, input) {
    // newtwo.s:PLR1_Control line 3105 writes $100 to the process-wide
    // wallflags word before Collision and MoveObject, including passes whose
    // requested X/Z delta is zero.
    this.world?.setMoveObjectWallKind('player');
    const changedLook = this.lookBehind !== Boolean(input.lookBehind);
    this.lookBehind = Boolean(input.lookBehind);
    const floorHeight = () => {
      return sourcePlayerLayerHeights(
        level, this.world, this.camera).floor / 256;
    };
    const waterHeight = () => {
      const zone = level.zones[this.camera.zone] || level.zones[0];
      return (this.world?.zoneWater(zone.id) ?? zone.water) / 256;
    };
    const clearance = () => {
      const { floor, roof } = sourcePlayerLayerHeights(
        level, this.world, this.camera);
      return (floor - roof) / 256;
    };
    const previousCamera = cameraSnapshot(this.camera);
    const changed = this.motion.advance(
      seconds, this.camera, { ...input, floorHeight, waterHeight }, clearance,
      (dx, dz, _forward, clumpStep) => {
        this.world?.recordPlayerMovement(clumpStep, this.camera);
        this.moveWorld(level, dx, dz);
      });
    if (this.motion.lastTicks > 0) {
      this.presentationPrevious = previousCamera;
      this.presentationCurrent = cameraSnapshot(this.camera);
    }
    return changed || changedLook;
  }

  update(level, seconds, operate = false, fire = false) {
    const previousCamera = cameraSnapshot(this.camera);
    const changed = this.world?.update(seconds, this.camera, operate, fire) || false;
    // Teleports are source-tick discontinuities, not motion to interpolate.
    if (cameraPoseChanged(previousCamera, this.camera)) this.syncPresentationCamera();
    return changed;
  }

  move(level, forward, sideways) {
    // Keep this direct test/debug entry point equivalent to PLR1_Control.
    this.world?.setMoveObjectWallKind('player');
    this.world?.recordPlayerMovement(forward, this.camera);
    const { sinWord, cosWord } = sourceAngleTrig(this.camera.angleUnits);
    const sin = sinWord / 32768, cos = cosWord / 32768;
    const dx = sin * forward + cos * sideways;
    const dz = cos * forward - sin * sideways;
    this.moveWorld(level, dx, dz);
    this.updateHeight(level);
    this.syncPresentationCamera();
  }

  moveWorld(level, dx, dz) {
    // PLR1_Control installs wallflags before Collision can reject the move.
    this.world?.setMoveObjectWallKind('player');
    const collisionPlayer = {
      ...this.camera,
      y: this.camera.collisionY ?? this.camera.y,
      height: this.camera.collisionHeight ?? this.motion.height,
    };
    const target = {
      ...collisionPlayer, x: this.camera.x + dx, z: this.camera.z + dz,
    };
    // PLR1_Control runs Collision before MoveObject. An object hit rejects the
    // whole requested movement. MoveObject itself supplies the along-wall
    // projection after that object test.
    if (this.world?.playerMovementBlocker(collisionPlayer, target)) {
      this.camera.x = sourceRejectedObjectPosition(this.camera.x, target.x);
      this.camera.z = sourceRejectedObjectPosition(this.camera.z, target.z);
      return false;
    }
    return this.tryMove(level, dx, dz, true);
  }

  tryMove(level, dx, dz, objectsChecked = false) {
    if (!dx && !dz) return true;
    const x = this.camera.x + dx, z = this.camera.z + dz;
    const collisionPlayer = {
      ...this.camera,
      y: this.camera.collisionY ?? this.camera.y,
      height: this.camera.collisionHeight ?? this.motion.height,
    };
    if (!objectsChecked && this.world?.playerMovementBlocker(
      collisionPlayer, { ...collisionPlayer, x, z })) {
      this.camera.x = sourceRejectedObjectPosition(this.camera.x, x);
      this.camera.z = sourceRejectedObjectPosition(this.camera.z, z);
      return false;
    }
    // newtwo.s:PLR1_Control line 3105 installs player-one's wallflags word
    // before MoveObject. The traversal itself records the exact wall writes.
    this.world?.setMoveObjectWallKind('player');
    const result = sourcePlayerMoveResult(
      level, this.world, this.camera.zone, collisionPlayer, { x, z },
      PLAYER_EXTLEN, collisionPlayer.height,
      this.motion.crouched ? CROUCHED_STEP : STANDING_STEP);
    if (!result) return false;
    this.camera.x = result.x; this.camera.z = result.z; this.camera.zone = result.zone;
    if (typeof result.inUpper === 'boolean') this.camera.inUpper = result.inUpper;
    return true;
  }

  turn(amount) {
    this.camera.angleUnits = (this.camera.angleUnits + radiansToSourceAngle(amount)) & 8190;
    this.camera.angle = sourceAngleRadians(this.camera.angleUnits);
    // Mouse/touch look is already browser presentation input. Do not add a
    // second 20 ms interpolation delay to that directly delivered rotation.
    this.syncPresentationCamera();
  }

  selectGun(gun) { return this.world?.selectGun(gun) || false; }

  setBrowserCheats(options = {}) {
    this.browserCheats = {
      invulnerability: Boolean(options.invulnerability),
      infiniteBullets: Boolean(options.infiniteBullets),
    };
    this.world?.setBrowserCheats(this.browserCheats);
    return { ...this.browserCheats };
  }

  render(level, targetContext, targetWidth, targetHeight, paused = false) {
    const sourceCamera = this.camera;
    this.camera = this.presentationCamera();
    this.authoritativeCamera = sourceCamera;
    try {
      return this.renderFrame(level, targetContext, targetWidth, targetHeight, paused);
    } finally {
      this.camera = sourceCamera;
      this.authoritativeCamera = null;
    }
  }

  renderFrame(level, targetContext, targetWidth, targetHeight, paused = false) {
    const display = this.display;
    const pixels = this.image.data;
    this.sourceWaterFill = 0;
    const hitColour = this.world?.hitColour ?? 0;
    clearImage(pixels, hitColour);
    if (this.sourcePixels) {
      // screensetup.s:INITCOPPERSCRN initializes COPSCRN1/COPSCRN2 once, and
      // newtwo.s lines 1156-1163 swaps drawpt/olddrawpt before rendering into
      // the selected 96x80 Copper buffer. Neither path clears it per frame.
      this.sourceFramebufferIndex ^= 1;
      restoreSourcePlayfield(
        pixels, this.sourceFramebuffers[this.sourceFramebufferIndex]);
    } else if (hitColour) {
      // With COLOR00 already RGB12 black the complete clear above produced
      // the exact direct-colour playfield state. Only a nonzero source damage
      // flash needs the second pass which restores chunky pixels to black.
      clearSourcePlayfield(pixels, display);
    }

    const movementAngle = this.camera.angle;
    const movementAngleUnits = this.camera.angleUnits;
    if (this.lookBehind) {
      this.camera.angleUnits = (this.camera.angleUnits + 4096) & 8190;
      this.camera.angle = sourceAngleRadians(this.camera.angleUnits);
    }
    if (level.zones[this.camera.zone]?.backdrop) this.drawBackdrop(pixels);

    const sourceCamera = this.authoritativeCamera || this.camera;
    const sourceVisibilityCamera = this.lookBehind ? {
      ...sourceCamera,
      angleUnits: (sourceCamera.angleUnits + 4096) & 8190,
      angle: sourceAngleRadians((sourceCamera.angleUnits + 4096) & 8190),
    } : sourceCamera;
    const cachedVisibility = this.sourceVisibilityCache;
    let sourceRooms;
    if (cachedVisibility?.level === level &&
        cachedVisibility.x === sourceVisibilityCamera.x &&
        cachedVisibility.z === sourceVisibilityCamera.z &&
        cachedVisibility.zone === sourceVisibilityCamera.zone &&
        cachedVisibility.angleUnits === sourceVisibilityCamera.angleUnits) {
      sourceRooms = cachedVisibility.rooms;
    } else {
      sourceRooms = sourceVisibleRooms(
        level, sourceVisibilityCamera.zone, sourceVisibilityCamera, SOURCE_DISPLAY.viewWidth);
      this.sourceVisibilityCache = {
        level,
        x: sourceVisibilityCamera.x,
        z: sourceVisibilityCamera.z,
        zone: sourceVisibilityCamera.zone,
        angleUnits: sourceVisibilityCamera.angleUnits,
        rooms: sourceRooms,
      };
    }
    const visibleRooms = (this.sourcePixels
      ? sourceRooms
      : continuousVisibleRooms(level, this.camera.zone, this.camera, display.viewWidth, {
        pixelScale: display.pixelScale,
        centerX: display.viewCenterX - display.viewLeft,
      }))
      .map(room => ({
        ...room, left: room.left + display.viewLeft, right: room.right + display.viewLeft,
      }));
    // Enemy wake-up and the post-display WorkSpace bitset are source gameplay
    // state. Always derive them from the authoritative 96-column source view,
    // never from interpolated/widened browser presentation frames.
    this.world?.markVisibleZones(sourceRooms.map(room => room.zone));
    for (const room of visibleRooms) {
      for (const layerName of sourceRoomLayerOrder(
        level, this.world, room.zone, this.camera)) {
        const layer = level.render[room.zone][layerName];
        if (!layer.length) continue;
        const upperLayer = layerName === 'upper';
        for (const command of layer) {
          if (PLANE_TYPES.has(command.type)) {
            this.drawPlane(level, command, room.zone, pixels, room.left, room.right,
              upperLayer);
          }
          if (command.type === 'wall' || command.type === 'transparent-wall') {
            this.drawWall(level, command, room.zone, pixels, room.left, room.right,
              upperLayer);
          }
          if (command.type === 'objects') {
            this.drawObjects(level, room.zone, pixels, room.left, room.right,
              upperLayer, command.region);
          }
        }
      }
    }
    // NEWTWO.s lines 1810-1850 rebuilds the first 32 WorkSpace bytes from the
    // just-drawn player's ToListOfGraph after DrawDisplay. Preserve that
    // separate scratch state; the full 11,264-byte brightentab means legal
    // texturedwater colour lookups do not enter WorkSpace.
    this.world?.updateWaterVisibilityWorkspace(
      sourceRooms.map(room => room.zone));

    if (!this.lookBehind) this.drawWeapon(pixels);
    applySourceWaterFill(pixels, this.sourceWaterFill, this.sourcePixels, display);
    this.camera.angle = movementAngle;
    this.camera.angleUnits = movementAngleUnits;
    if (paused) drawPauseOverlay(pixels, this.fonts, this.pauseOptions, display);
    if (this.sourcePixels) {
      captureSourcePlayfield(
        pixels, this.sourceFramebuffers[this.sourceFramebufferIndex]);
      expandSourcePixels(pixels, this.world?.hitColour ?? 0);
    }
    this.drawPanel(pixels);
    this.drawBorders(pixels);
    this.context.putImageData(this.image, 0, 0);
    targetContext.imageSmoothingEnabled = false;
    targetContext.clearRect(0, 0, targetWidth, targetHeight);
    const scale = Math.min(targetWidth / display.width, targetHeight / display.height);
    const width = display.width * scale, height = display.height * scale;
    targetContext.drawImage(this.surface, (targetWidth - width) / 2, (targetHeight - height) / 2, width, height);
  }

  drawPlane(level, command, zoneId, pixels, clipLeft, clipRight, upperLayer = false) {
    const display = rendererProjection(this);
    // Floor command heights are stored in quarter-world units (the assembly
    // shifts them left six before comparing them with 8.8 zone heights).
    const planeY = this.world?.planeHeights.get(command.sourceOffset) ?? command.height / 4;
    const zone = level.zones[zoneId];
    const lowerRoof = typeof this.world?.zoneRoof === 'function'
      ? this.world.zoneRoof(zoneId) : zone.roof;
    const lowerFloor = typeof this.world?.zoneFloor === 'function'
      ? this.world.zoneFloor(zoneId) : zone.floor;
    const roomTop = upperLayer
      ? zone.upperRoof : lowerRoof;
    const roomBottom = upperLayer
      ? zone.upperFloor : lowerFloor;
    if (command.type === 'water') {
      const fill = sourceWaterFillState(
        zoneId, this.camera.zone, planeY, roomTop, roomBottom, sourceViewY(this.camera));
      if (fill) this.sourceWaterFill = fill;
    }
    if (!sourcePlaneWithinRoom(planeY, roomTop, roomBottom)) return;
    const planeProjection = sourcePlaneProjection(command.type, planeY, this.camera);
    if (!planeProjection) return;
    // NEWTWO.s:FloorLine reconstructs world texture coordinates with the
    // current SineTable pair. Keep that pair local to the plane command; the
    // renderer must not depend on a wall or movement routine having populated
    // browser temporaries named sin/cos.
    const { sin, cos, sinWord, cosWord } = sourceCameraTrig(this.camera);
    const gouraud = ORDINARY_PLANE_TYPES.has(command.type) &&
      this.pauseOptions.floorDetail === 0 && level.pointBrightness;
    const cameraPolygon = command.pointIds.map(pointId => {
      const point = level.points[pointId];
      const transformed = sourceWallCameraPoint(point, this.camera);
      if (gouraud) {
        const raw = level.pointBrightness[pointId]?.[upperLayer ? 'upper' : 'lower'] ?? 0;
        transformed.brightness = sourcePointBrightness(
          raw, this.world?.brightnessRenderStep ?? 0) +
          (this.world?.pointBrightnessAdjustment?.(pointId, upperLayer) ?? 0);
      }
      return transformed;
    });
    if (this.sourcePixels) {
      // newtwo.s:itsafloordraw clips every source edge in sideloop and decides
      // coverage from the resulting leftsidetab/rightsidetab. Do not let the
      // browser-only continuous projection below reject an exact source-mode
      // polygon before that recovered edge path has run.
      const sourceClipLeft = Math.max(0, Math.ceil((clipLeft - VIEW_LEFT) / 2));
      const sourceClipRight = Math.min(96, Math.ceil((clipRight - VIEW_LEFT) / 2));
      const spans = sourcePlaneRasterSpans(
        cameraPolygon, planeProjection, sourceClipLeft, sourceClipRight);
      const zoneBrightness = sourceZoneBrightness(
        upperLayer ? zone.upperBrightness : zone.brightness,
        this.world?.brightnessRenderStep ?? 0) +
        (this.world?.zoneBrightnessAdjustment?.(zoneId, upperLayer) ?? 0) +
        command.brightness;
      // NEWTWO.s:itsafloordraw reaches `below` after NEG.W only for a roof.
      // Preserve that word operation: NEG.W $8000 is still $8000, whereas
      // Math.abs would invent a positive 32768 outside the source word range.
      const planeDistanceWord = planeProjection.roof
        ? rendererSignedWord(-planeProjection.verticalWord)
        : planeProjection.verticalWord;
      const numerator = Math.imul(planeDistanceWord, 64) | 0;
      for (const span of spans) {
        if (span.y < 0 || span.y >= 80 || span.divisor <= 0) continue;
        const sourceDistance = sourceDivsWord(numerator, span.divisor);
        if (sourceDistance <= 0) continue;
        const leftRow = gouraud
          ? sourceGouraudRow(span.leftBrightness, sourceDistance) : 0;
        const rightRow = gouraud
          ? sourceGouraudRow(span.rightBrightness, sourceDistance) : 0;
        const samples = sourceFloorLineSamples(
          sourceDistance, sinWord, cosWord, command.scale,
          rendererSignedWord(Math.floor(this.camera.x) + (this.camera.bobbleFloorX || 0)),
          rendererSignedWord(Math.floor(this.camera.z) + (this.camera.bobbleFloorZ || 0)),
          span.left, span.right - span.left,
          command.type === 'water' ? (this.world?.waterTextureOffset ?? 1) : 0);
        const gouraudPaletteIndices = gouraud
          ? sourceGouraudFloorPaletteIndices(
            leftRow, rightRow, span.sourceWidth, span.brightnessSkip,
            samples.map(sample => this.textures.floorTexel(
              command.texture, sample.u, sample.v)), span.clippedPath)
          : null;
        const waterRaster = command.type === 'water'
          ? sourceWaterRasterState(
            sourceDistance, this.world?.waterTangent ?? 640,
            span.distanceToBottom, planeProjection.roof)
          : null;
        for (let offset = 0; offset < samples.length; offset++) {
          const sourceX = span.left + offset;
          const brightness = sourceFloorBrightness(zoneBrightness, sourceDistance);
          let colour;
          if (command.type === 'water') {
            const underlyingLowByte = sourcePixelRGB12LowByte(
              pixels, sourceX, span.y + waterRaster.rowDisplacement);
            colour = this.textures.sampleWater(
              this.world?.waterRenderFrame ?? 0,
              samples[offset].packedWord, underlyingLowByte, sourceDistance);
          } else if (ORDINARY_PLANE_TYPES.has(command.type) && this.pauseOptions.floorDetail === 3) {
            colour = [0, 0, 0];
          } else if (ORDINARY_PLANE_TYPES.has(command.type) && this.pauseOptions.floorDetail === 2) {
            colour = this.textures.samplePlainFloor(command.texture, brightness);
          } else {
            colour = gouraud
              ? this.textures.sampleFloorPaletteIndex(gouraudPaletteIndices[offset])
              : this.textures.sampleFloor(
                command.texture, samples[offset].u, samples[offset].v, brightness);
          }
          const at = ((span.y * 2) * WIDTH + VIEW_LEFT + sourceX * 2) * 4;
          pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
          pixels[at + 3] = 255;
        }
      }
      return;
    }
    // The recovered minz is tied to source rows 0/79 and remains untouched in
    // Original and Sharp. Enhanced Sharp has a taller browser viewport and an
    // explicitly requested movable horizon, so its continuous polygon must
    // clip at that viewport's current outer pixel centre. Reusing source minz
    // makes the near floor/roof edge move with the horizon and exposes a black
    // band. This is projection geometry only; texture and lighting paths stay
    // the recovered AB3D ones.
    const continuousMinimumDepth = this.displayMode === DISPLAY_MODES.ENHANCED
      ? enhancedPlaneMinimumDepth(planeProjection, display)
      : planeProjection.minimumDepth;
    const clipped = clipPlaneToSourceDepth(cameraPolygon, continuousMinimumDepth);
    if (clipped.length < 3) return;
    const polygon = clipped.map(point => ({
      x: display.viewCenterX + point.x / point.z * display.pixelScale,
      y: display.horizonY + planeProjection.verticalWord *
        (64 * display.pixelScale) / point.z,
      brightness: point.brightness,
    }));
    // newtwo.s builds integer leftsidetab/rightsidetab rows and
    // wallroutine3.chipmem draws integer strips. These JavaScript projections
    // are continuous, so coverage must consistently test the pixel centre;
    // mixing integer bounds with centre-tested spans leaves backdrop cracks.
    const firstY = Math.max(0, Math.ceil(Math.min(...polygon.map(point => point.y)) - .5));
    const lastY = Math.min(display.viewHeight - 1,
      Math.floor(Math.max(...polygon.map(point => point.y)) - .5));
    if (lastY < firstY) return;
    const scale = 2 ** command.scale;
    const zoneBrightness = sourceZoneBrightness(
      upperLayer ? zone.upperBrightness : zone.brightness,
      this.world?.brightnessRenderStep ?? 0) +
      (this.world?.zoneBrightnessAdjustment?.(zoneId, upperLayer) ?? 0) +
      command.brightness;
    // texturedwater's roof branch walks away from the horizon in the opposite
    // screen direction. Ordinary planes are order-independent, but water reads
    // an existing displaced framebuffer row, so retain that source direction.
    const firstDrawY = command.type === 'water' && planeProjection.roof ? lastY : firstY;
    const finalDrawY = command.type === 'water' && planeProjection.roof ? firstY : lastY;
    const drawYStep = firstDrawY <= finalDrawY ? 1 : -1;
    for (let y = firstDrawY; ; y += drawYStep) {
      const sampleY = y + .5;
      const denominator = sampleY - display.horizonY;
      if (Math.abs(denominator) < .0001) {
        if (y === finalDrawY) break;
        continue;
      }
      const distance = (planeY - sourceViewY(this.camera)) * display.focalY / denominator;
      const sourceDistance = distance * 2;
      if (sourceDistance <= continuousMinimumDepth || !Number.isFinite(distance)) {
        if (y === finalDrawY) break;
        continue;
      }
      // Some renderer conformance harnesses invoke drawPlane on a minimal
      // source-shaped receiver; initialize its reusable browser scratch once.
      const scanlineScratch = this.scanlineScratch ||= { x: [], brightness: [] };
      const intersectionCount = scanlineIntersectionsInto(
        polygon, sampleY, scanlineScratch, gouraud);
      const intersections = scanlineScratch.x;
      const intersectionBrightness = scanlineScratch.brightness;
      const waterRaster = command.type === 'water'
        ? continuousWaterRasterState(
          sourceDistance, this.world?.waterTangent ?? 640, y,
          display, planeProjection.roof)
        : null;
      for (let span = 0; span + 1 < intersectionCount; span += 2) {
        const spanLeft = intersections[span];
        const spanRight = intersections[span + 1];
        const firstX = Math.max(0, clipLeft, Math.ceil(spanLeft - .5));
        const lastX = Math.min(display.width - 1, clipRight - 1,
          Math.floor(spanRight - .5));
        const leftRow = gouraud
          ? sourceGouraudRow(intersectionBrightness[span], sourceDistance) : 0;
        const rightRow = gouraud
          ? sourceGouraudRow(intersectionBrightness[span + 1], sourceDistance) : 0;
        const brightness = sourceFloorBrightness(zoneBrightness, sourceDistance);
        for (let x = firstX; x <= lastX; x++) {
          const pixel = y * display.width + x;
          const side = (x + .5 - display.viewCenterX) / display.focalX * distance;
          const worldX = this.camera.x + (this.camera.bobbleFloorX || 0) +
            side * cos + distance * sin;
          const worldZ = this.camera.z + (this.camera.bobbleFloorZ || 0) -
            side * sin + distance * cos;
          let colour;
          if (command.type === 'water') {
            // Sharp and Enhanced Sharp are explicitly labelled browser
            // presentation modes. Extend NEWTWO.s:texturedwater's recovered
            // packed water coordinate, displaced framebuffer read and distance
            // brighten lookup to their denser pixels; Original remains on the
            // literal 96x80 ADDX FloorLine path above.
            const packedCoordinate = continuousWaterPackedCoordinate(
              worldX * scale, worldZ * scale,
              this.world?.waterTextureOffset ?? 1);
            const underlyingLowByte = continuousPixelRGB12LowByte(
              pixels, x, y + waterRaster.pixelDisplacement, display);
            colour = this.textures.sampleWater(
              this.world?.waterRenderFrame ?? 0,
              packedCoordinate, underlyingLowByte, sourceDistance);
          } else if (ORDINARY_PLANE_TYPES.has(command.type) && this.pauseOptions.floorDetail === 3) {
            // SimpleFloorLine branches to BLACKFLOOR when CLRNOFLOOR is set.
            colour = [0, 0, 0];
          } else if (ORDINARY_PLANE_TYPES.has(command.type) && this.pauseOptions.floorDetail === 2) {
            colour = this.textures.samplePlainFloor(command.texture, brightness);
          } else {
            const sampleBrightness = gouraud
              ? Math.floor(leftRow + (rightRow - leftRow) *
                Math.max(0, Math.min(1,
                  (x + .5 - spanLeft) / Math.max(Number.EPSILON, spanRight - spanLeft)))) * 2
              : brightness;
            colour = this.textures.sampleFloor(
              command.texture, worldX * scale, worldZ * scale, sampleBrightness);
          }
          const at = pixel * 4;
          pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
        }
      }
      if (y === finalDrawY) break;
    }
  }

  drawBackdrop(pixels) {
    if (!this.textures?.sampleBackdrop) return;
    // newtwo.s:1156-1163 makes frompt = drawpt + 10, the colour-value word in
    // the first Copper scanline record. wallroutine3.chipmem:1302-1343 and
    // anims:3264-3265 both add 104*4 before the first write, so backfile row 0
    // lands in the following record: visual source row 1. The packaged retail
    // AGA capture confirms the hardware-visible phase independently: at
    // panorama heading 401 all six $efe markers align only as source y-1.
    // Consequently the 38-row backfile occupies visual source rows 1..38.
    // putinsmallscr expands each source pixel twice in both axes.
    const sourceMode = Boolean(this.sourcePixels);
    const display = rendererProjection(this);
    const width = sourceMode ? 96 : display.viewWidth;
    const height = sourceMode ? 38 : Math.ceil(38 * display.pixelScale);
    const lookShift = sourceMode ? 0 : display.horizonY - display.viewCenterY;
    const targetTop = sourceMode ? 2 : Math.round(display.pixelScale + lookShift);

    // Enhanced is an explicitly labelled browser presentation. Looking up can
    // expose rows above the released 96x38 backdrop window; clamp those rows
    // to recovered backdrop row zero so the sky reaches the viewport top
    // without synthesising colours or artwork. Original and Sharp preserve
    // putinbackdrop's exact uncovered-row behaviour.
    if (this.displayMode === DISPLAY_MODES.ENHANCED && targetTop > 0) {
      for (let targetY = 0; targetY < Math.min(targetTop, display.viewHeight); targetY++) {
        for (let x = 0; x < width; x++) {
          const sourceX = Math.floor(
            (x - (display.viewCenterX - display.viewLeft)) / display.pixelScale + 47);
          const colour = this.textures.sampleBackdrop(
            this.camera.angle, sourceX, 0, this.camera.angleUnits);
          const targetX = display.viewLeft + x;
          const at = (targetY * display.width + targetX) * 4;
          pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
          pixels[at + 3] = 255;
        }
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // putinbackdrop writes one 96x38 chunky sample per iteration. The
        // faithful path targets the even staging pixel which putinsmallscr
        // later expands; sharp mode samples that same panorama at 2x output.
        // The retail 96-column window samples panorama columns 0..95 around
        // RotateLevelPts' column-47 camera axis. A wider browser viewport must
        // extend that recovered panorama window on both sides; beginning again
        // at column zero would put all added FOV on the right.
        const sourceX = sourceMode ? x : Math.floor(
          (x - (display.viewCenterX - display.viewLeft)) / display.pixelScale + 47);
        const sourceY = sourceMode ? y : Math.min(37, Math.floor(y / display.pixelScale));
        const colour = this.textures.sampleBackdrop(
          this.camera.angle, sourceX, sourceY, this.camera.angleUnits);
        const targetX = display.viewLeft + (sourceMode ? x * 2 : x);
        const targetY = sourceMode ? (y + 1) * 2 : targetTop + y;
        if (targetY < 0 || targetY >= display.viewHeight) continue;
        const at = (targetY * display.width + targetX) * 4;
        pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
        pixels[at + 3] = 255;
      }
    }
  }

  drawWall(level, command, zoneId, pixels, clipLeft = 0, clipRight = null,
      upperLayer = false) {
    const display = rendererProjection(this);
    clipRight ??= display.width;
    const left = level.points[command.leftPoint], right = level.points[command.rightPoint];
    const pointBrightness = pointId => {
      const raw = level.pointBrightness?.[pointId]?.[upperLayer ? 'upper' : 'lower'] ?? 0;
      return sourcePointBrightness(raw, this.world?.brightnessRenderStep ?? 0) +
        (this.world?.pointBrightnessAdjustment?.(pointId, upperLayer) ?? 0) +
        command.brightnessOffset;
    };
    const a = sourceWallCameraPoint(
      left, this.camera, command.leftEnd, pointBrightness(command.leftPoint));
    const b = sourceWallCameraPoint(
      right, this.camera, command.rightEnd, pointBrightness(command.rightPoint));
    const spans = sourceWallSpans(a, b);
    if (!spans.length) return;
    if (this.displayMode === DISPLAY_MODES.ENHANCED) {
      if (!continuousWallFacingVisible(spans, display, clipLeft, clipRight)) return;
    } else if (!sourceWallFacingVisible(a, b)) return;

    const topFixed = this.world?.wallTops.get(command.sourceOffset) ?? command.top;
    const bottomFixed = this.world?.wallBottoms.get(command.sourceOffset) ?? command.bottom;
    const top = topFixed / 256;
    const bottom = bottomFixed / 256;
    if (top >= bottom) return;
    const textureOffset = this.world?.wallTextureOffsets.get(command.sourceOffset) ?? command.textureOffset;
    const textureY = this.world?.wallTextureYOffsets.get(command.sourceOffset) ?? command.yOffset;
    const textureBank = this.world?.wallTextureBanks.get(command.sourceOffset) ?? command.textureBank;
    const textureStride = sourceWallTextureStride(
      command.textureBank, command.textureHeight, upperLayer);
    const baseU = textureOffset * 16;
    for (const [spanIndex, [spanLeft, spanRight]] of spans.entries()) {
      if (this.sourcePixels) {
        const sourceClipLeft = Math.max(0, Math.ceil((clipLeft - VIEW_LEFT) / 2));
        const sourceClipRight = Math.min(96, Math.ceil((clipRight - VIEW_LEFT) / 2));
        const viewFixed = Math.trunc(sourceViewY(this.camera) * 256) | 0;
        const columns = sourceWallColumns(
          spanLeft, spanRight, topFixed, bottomFixed, viewFixed,
          sourceClipLeft, sourceClipRight, spanIndex > 0);
        for (const column of columns) {
          let first = Math.max(0, column.top);
          let last = Math.min(79, column.bottom);
          // ScreenWallstripdraw rejects zero-height strips before its DBRA
          // loop, then draws both endpoints of every remaining source strip.
          if (last - first <= 0) continue;
          const u = baseU + modulo(column.u, command.textureWidth);
          // wallroutine3.chipmem:screendivide reads the interpolated
          // point+wall word from WorkSpace and adds depth>>7; it does not add
          // ZoneBright. Its two instructions which would branch on `seethru`
          // are commented out. Retail abd8ch confirms that state: runtime
          // $6d82 sets byte $1d274 before JSR $1d0b2, but $1d274 is never read;
          // screendivide at $1a592 enters its opaque WorkSpace path directly.
          // wallroutine3.chipmem:screendivide uses EXT.W D5 after swapping
          // the 16.16 light accumulator. EXT.W sign-extends the register's
          // low byte, not its complete low word. This discards U bit 0 that
          // packed ADD.L/ASR.L midpoint passes can shift into light bit 15;
          // interpreting the full word produced false row-31 black stripes.
          const brightness = sourceWallBrightness(column.brightness, column.depth);
          const x = VIEW_LEFT + column.x * 2;
          const textureYs = sourceWallVerticalTexels(
            column.depth, column.top, column.bottom, textureY,
            textureStride, Math.floor(sourceViewY(this.camera)), first, last);
          for (let row = 0; row < textureYs.length; row++) {
            const sourceY = first + row;
            const y = sourceY * 2;
            const colour = this.textures.sample(
              textureBank, u, textureYs[row], brightness, textureStride);
            const at = (y * WIDTH + x) * 4;
            pixels[at] = colour[0]; pixels[at + 1] = colour[1];
            pixels[at + 2] = colour[2]; pixels[at + 3] = 255;
          }
        }
        continue;
      }
      // RotateLevelPts/walldraw keep horizontal side in 25.7 and depth in the
      // doubled signed-word scale. putinsmallscr doubles the projected column.
      const sx1 = display.viewCenterX + spanLeft.x / spanLeft.z * display.pixelScale;
      const sx2 = display.viewCenterX + spanRight.x / spanRight.z * display.pixelScale;
      // Doleftend returns when rightx-leftx is negative; it does not exchange
      // endpoints to make a back-facing wall visible.
      if (sx2 < sx1) continue;
      const start = Math.max(0, clipLeft, Math.ceil(sx1 - .5));
      const end = Math.min(display.width - 1, clipRight - 1, Math.floor(sx2 - .5));
      if (start > end) continue;
      const verticalFocal = display.focalY * 2;
      const leftTop = display.horizonY +
        (top - sourceViewY(this.camera)) * verticalFocal / spanLeft.z;
      const rightTop = display.horizonY +
        (top - sourceViewY(this.camera)) * verticalFocal / spanRight.z;
      const leftBottom = display.horizonY +
        (bottom - sourceViewY(this.camera)) * verticalFocal / spanLeft.z;
      const rightBottom = display.horizonY +
        (bottom - sourceViewY(this.camera)) * verticalFocal / spanRight.z;
      for (let x = start; x <= end; x++) {
        const t = sx2 === sx1 ? 0 : (x + .5 - sx1) / (sx2 - sx1);
        // Doleftend/screendivide linearly advance bitmap position, distance,
        // projected top/bottom, and point light across each subdivided span.
        const sourceDepth = spanLeft.z + (spanRight.z - spanLeft.z) * t;
        const localU = spanLeft.u + (spanRight.u - spanLeft.u) * t;
        const u = baseU + modulo(localU, command.textureWidth);
        let yTop = leftTop + (rightTop - leftTop) * t;
        let yBottom = leftBottom + (rightBottom - leftBottom) * t;
        if (yTop > yBottom) [yTop, yBottom] = [yBottom, yTop];
        const first = Math.max(0, Math.ceil(yTop - .5));
        const last = Math.min(display.viewHeight - 1, Math.floor(yBottom - .5));
        if (first > last) continue;
        const brightness = sourceContinuousWallBrightness(
          spanLeft.brightness, spanRight.brightness, t, sourceDepth);
        for (let y = first; y <= last; y++) {
          const pixel = y * display.width + x;
          // dothisroom walks commands in stream order and every wall routine
          // writes directly to the same chunky buffer. There is no source
          // per-pixel depth test: the recovered room/stream/command order is the
          // painter order, including a farther command written later.
          const distance = sourceDepth / 2;
          const worldY = sourceViewY(this.camera) +
            (y + .5 - display.horizonY) * distance / display.focalY;
          // newtwo.s:3400-3405 derives wallyoff as (camera Y + 256 - 32)
          // & 255. wallroutine3.chipmem:1697-1700 adds that to totalyoff,
          // while ScreenWallstripdraw's DDA supplies displacement from the
          // camera, not displacement from this command's wall top. Therefore
          // the continuous browser projection is world-aligned at Y+224.
          // Subtracting `top` here shifted Level A's -208 walls by 16 texels
          // and exposed the black rows of their retail texture banks as bars.
          const v = modulo(textureY + worldY + 224, textureStride);
          const colour = this.textures.sample(
            textureBank, u, v, brightness, textureStride);
          const at = pixel * 4;
          pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2]; pixels[at + 3] = 255;
        }
      }
    }
  }

  drawObjects(level, zoneId, pixels, clipLeft, clipRight, upperLayer = false, region = 2) {
    const display = rendererProjection(this);
    if (!this.objectTextures && !this.vectorObjects) return;
    const candidates = [];
    for (const [tableIndex, object] of (this.world?.objects || level.objects).entries()) {
      if (!objectIsRenderableInZone(object, zoneId)) continue;
      if (Boolean(object.render.inUpper) !== upperLayer) continue;
      const point = sourceObjectCameraPoint(object, this.camera);
      // ObjDraw inserts all positive rotated Z words into depthtable. Equal-Z
      // records are inserted before the older entry, hence the reverse table
      // index tie-break used here.
      if (point.sourceDepth <= 0) continue;
      candidates.push({ object, point, tableIndex });
    }
    candidates.sort((a, b) => b.point.sourceDepth - a.point.sourceDepth ||
      b.tableIndex - a.tableIndex);

    for (const { object, point } of candidates) {
      const graphicType = objectGraphicType(object);
      if (object.render.width === 255 || object.render.height === 255) {
        this.drawVectorObject(
          level, object, graphicType, pixels, clipLeft, clipRight, point.sourceDepth);
        continue;
      }
      // objdraw3.chipram:BitMapObj rejects midpoint Z <= 50. PolygonObj uses
      // only the positive-depth test above.
      if (!sourceBitmapObjectVisible(point.sourceDepth)) continue;
      if (!this.objectTextures) continue;
      const verticalClip = sourceBitmapObjectClip(
        level, this.world, zoneId, this.camera, point.z, upperLayer, region,
        point.sourceDepth, display);
      const brightness = sourceObjectBrightness(object.render.brightness, point.z);
      const { width: sourceWidth, height: sourceHeight } = sourceBitmapExtent(object.render);
      if (this.sourcePixels) {
        const bounds = sourceBitmapBounds(object, point, this.camera);
        const sourceClipLeft = Math.max(0, Math.ceil((clipLeft - VIEW_LEFT) / 2));
        const sourceClipRight = Math.min(96, Math.ceil((clipRight - VIEW_LEFT) / 2));
        const firstX = Math.max(sourceClipLeft, bounds.left);
        const lastX = Math.min(sourceClipRight - 1, bounds.right);
        const firstY = Math.max(verticalClip.sourceFirstY, bounds.top);
        const lastY = Math.min(verticalClip.sourceLastYExclusive - 1, bounds.bottomExclusive - 1);
        if (firstX > lastX || firstY > lastY) continue;
        const textureXs = sourceBitmapHorizontalTexels(
          point.sourceDepth, sourceWidth, object.render.width,
          firstX - bounds.left, lastX - firstX + 1);
        const textureYs = sourceBitmapVerticalTexels(
          point.sourceDepth, sourceHeight, object.render.height,
          firstY - bounds.top, lastY - firstY + 1);
        for (let yOffset = 0; yOffset < textureYs.length; yOffset++) {
          const sourceY = firstY + yOffset;
          const textureY = textureYs[yOffset];
          for (let xOffset = 0; xOffset < textureXs.length; xOffset++) {
            const sourceX = firstX + xOffset;
            const textureX = textureXs[xOffset];
            const colour = this.objectTextures.sample(
              graphicType, object.render.frame, textureX, textureY, brightness);
            if (!colour) continue;
            const at = ((sourceY * 2) * WIDTH + VIEW_LEFT + sourceX * 2) * 4;
            pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
            pixels[at + 3] = 255;
          }
        }
        continue;
      }
      const { left, right, top, bottom } =
        projectObjectBounds(object, point, this.camera, display);
      const firstX = Math.max(0, clipLeft, Math.ceil(left - .5));
      const lastX = Math.min(display.width - 1, clipRight - 1, Math.floor(right - .5));
      const firstY = Math.max(verticalClip.firstY, Math.ceil(top - .5));
      const lastY = Math.min(verticalClip.lastY, Math.floor(bottom - .5));
      if (firstX > lastX || firstY > lastY) continue;
      for (let y = firstY; y <= lastY; y++) {
        const textureY = Math.min(sourceHeight - 1,
          Math.floor((y + .5 - top) / (bottom - top) * sourceHeight));
        for (let x = firstX; x <= lastX; x++) {
          const pixel = y * display.width + x;
          const textureX = Math.min(sourceWidth - 1,
            Math.floor((x + .5 - left) / (right - left) * sourceWidth));
          const colour = this.objectTextures.sample(
            graphicType, object.render.frame, textureX, textureY, brightness);
          if (!colour) continue;
          const at = pixel * 4;
          pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
          pixels[at + 3] = 255;
        }
      }
    }
  }

  drawVectorObject(level, object, descriptor, pixels, clipLeft, clipRight,
      midpointSourceDepth = sourceObjectCameraPoint(object, this.camera).sourceDepth) {
    const display = rendererProjection(this);
    const model = this.vectorObjects?.get(descriptor);
    if (!model) return;
    const frame = model.frames[modulo(object.render.frame || 0, model.frameCount)];
    const transformed = sourceVectorCameraPoints(frame, object, this.camera);
    // PolygonObj:convtoscr branches to polybehind as soon as any model point's
    // combined Z is non-positive. It does not near-clip individual faces.
    if (!sourceVectorObjectVisible(transformed)) return;
    for (const part of sourceVectorPartOrder(model.parts, transformed, this.camera)) {
      for (const polygon of part.polygons) {
        const projected = polygon.vertices.map(vertex => sourceVectorRasterPoint(
          transformed[vertex.point], vertex, this.sourcePixels, display));
        const signedArea = sourceVectorFaceArea(projected[0], projected[1], projected[2]);
        // doapoly's `ble polybehind` rejects the rear winding.
        if (signedArea <= 0) continue;
        // ObjDraw3.chipram:PolygonObj lines 861-870 stores objbright from the
        // rotated object midpoint before rotobj transforms any model vertex.
        // doapoly lines 1208-1211 adds that word, not boxrot[0].z.
        const paletteRow = sourceVectorFlatPaletteRow(
          object.render.brightness, midpointSourceDepth,
          signedArea, polygon.brightnessDivisor);
        const closingPoint = transformed[polygon.closingVertex.point];
        const projectedClosing = sourceVectorRasterPoint(
          closingPoint, polygon.closingVertex, this.sourcePixels, display);
        this.drawVectorPolygon(
          projected, polygon, paletteRow, pixels, clipLeft, clipRight, projectedClosing);
      }
    }
  }

  drawVectorPolygon(vertices, polygon, paletteRow, pixels, clipLeft, clipRight,
      closingVertex = vertices[0]) {
    if (this.sourcePixels) {
      this.drawSourceVectorPolygon(
        vertices, polygon, paletteRow, pixels, clipLeft, clipRight, closingVertex);
      return;
    }
    const display = rendererProjection(this);
    const firstX = Math.max(0, clipLeft,
      Math.ceil(Math.min(...vertices.map(vertex => vertex.screenX)) - .5));
    const lastX = Math.min(display.width - 1, clipRight - 1,
      Math.floor(Math.max(...vertices.map(vertex => vertex.screenX)) - .5));
    if (firstX > lastX) return;
    for (let x = firstX; x <= lastX; x++) {
      const sampleX = x + .5;
      const edges = [];
      for (let index = 0; index < vertices.length; index++) {
        const a = vertices[index];
        const b = index + 1 < vertices.length ? vertices[index + 1] : closingVertex;
        if (!((a.screenX <= sampleX && sampleX < b.screenX) ||
          (b.screenX <= sampleX && sampleX < a.screenX))) continue;
        const along = (sampleX - a.screenX) / (b.screenX - a.screenX);
        edges.push({
          y: a.screenY + (b.screenY - a.screenY) * along,
          u: a.u + (b.u - a.u) * along,
          v: a.v + (b.v - a.v) * along,
          gouraudRow: a.gouraudRow + (b.gouraudRow - a.gouraudRow) * along,
        });
      }
      if (edges.length < 2) continue;
      edges.sort((a, b) => a.y - b.y);
      const top = edges[0], bottom = edges[edges.length - 1];
      const firstY = Math.max(0, Math.ceil(top.y - .5));
      const lastY = Math.min(display.viewHeight - 1, Math.floor(bottom.y - .5));
      const height = bottom.y - top.y;
      if (firstY > lastY || height <= 0) continue;
      for (let y = firstY; y <= lastY; y++) {
        const along = (y + .5 - top.y) / height;
        const pixel = y * display.width + x;
        // putinlines/putingourlines write the two edge values for each
        // projected X column. doapoly interpolates U/V (and optionally light)
        // between those records down the column, without reciprocal Z.
        const u = top.u + (bottom.u - top.u) * along;
        const v = top.v + (bottom.v - top.v) * along;
        // gotlurvelyshading indexes TexturePal with the brightness interpolated
        // by putingourlines; it does not apply the flat polygon light row.
        const samplePaletteRow = polygon.gouraud
          ? top.gouraudRow + (bottom.gouraudRow - top.gouraudRow) * along
          : paletteRow;
        const colour = this.vectorObjects.sample(
          polygon.textureOffset, u, v, samplePaletteRow, polygon.holes);
        if (!colour) continue;
        const at = pixel * 4;
        pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
        pixels[at + 3] = 255;
      }
    }
  }

  drawSourceVectorPolygon(vertices, polygon, paletteRow, pixels, clipLeft, clipRight,
      closingVertex = vertices[0]) {
    const sourceClipLeft = Math.max(0, Math.ceil((clipLeft - VIEW_LEFT) / 2));
    const sourceClipRight = Math.min(96, Math.ceil((clipRight - VIEW_LEFT) / 2));
    const edgeColumns = sourceVectorEdgeColumns(
      vertices, closingVertex, polygon.gouraud, sourceClipLeft, sourceClipRight);
    if (!edgeColumns) return;
    for (let x = edgeColumns.left; x <= edgeColumns.right; x++) {
      const column = edgeColumns.columns[x];
      if (!column?.top || !column?.bottom) continue;
      const top = column.top, bottom = column.bottom;
      // doapoly tests Holes before Gouraud: a descriptor with both bits set
      // uses gotholesin's transparent flat-light path.
      if (!polygon.gouraud || polygon.holes) {
        const samples = sourceVectorFlatColumnSamples(
          top, bottom, 0, 79, polygon.holes);
        for (const sample of samples) {
          const colour = this.vectorObjects.sample(
            polygon.textureOffset, sample.u, sample.v, paletteRow, polygon.holes);
          if (!colour) continue;
          const at = ((sample.y * 2) * WIDTH + VIEW_LEFT + x * 2) * 4;
          pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
          pixels[at + 3] = 255;
        }
        continue;
      }
      const samples = sourceVectorGouraudColumnSamples(top, bottom, 0, 79);
      for (const sample of samples) {
        const colour = this.vectorObjects.sample(
          polygon.textureOffset, sample.u, sample.v, sample.gouraudRow, false);
        if (!colour) continue;
        const at = ((sample.y * 2) * WIDTH + VIEW_LEFT + x * 2) * 4;
        pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
        pixels[at + 3] = 255;
      }
    }
  }

  drawPanel(pixels) {
    const display = this.display;
    if (!this.panel || this.panel.width > display.width ||
        this.panel.height > display.height) return;
    const panelPixels = this.panel.render(this.world?.conditions ?? 0);
    const left = Math.floor((display.width - this.panel.width) / 2);
    const top = display.panelTop;
    const visibleRows = Math.min(this.panel.height, display.height - top);
    for (let y = 0; y < visibleRows; y++) {
      const source = y * this.panel.width * 4;
      const target = ((top + y) * display.width + left) * 4;
      pixels.set(panelPixels.subarray(source, source + this.panel.width * 4), target);
    }
  }

  drawWeapon(pixels) {
    if (!this.objectTextures || !this.world) return;
    const display = this.display;
    const view = weaponView(this.world.playerState);
    // The enhanced browser layout keeps the decoded gun at the original 2x
    // UI scale and centres it in the wider playfield. Only its baseline moves
    // down with the taller view; the retail modes retain their exact origin.
    const horizontalScale = 2, verticalScale = 2;
    const sourceWidth = 96;
    const weaponLeft = display.viewLeft + Math.floor(
      (display.viewWidth - sourceWidth * horizontalScale) / 2);
    const weaponShiftY = UI_ALIGNMENT.weaponShiftY + display.viewHeight - VIEW_HEIGHT;
    // Unpacked retail abd8ch at the generated gunDraw.drawChunkOffset contains
    // DRAWCHUNK's MOVE.W #78,D3. DBRA makes that inclusive; subtracting the
    // selected GUNYOFFS word yields this exact count. The build recovers the
    // immediate because the released newtwotest.s snapshot instead says 79.
    const lastRow = this.objectTextures.manifest?.gunDraw?.lastRow;
    if (!Number.isInteger(lastRow)) {
      throw new Error('retail DRAWCHUNK row evidence is missing from the object manifest');
    }
    const sourceHeight = lastRow + 1 - view.yOffset;
    for (let sourceY = 0; sourceY < sourceHeight; sourceY++) {
      const top = (view.yOffset + sourceY) * verticalScale + weaponShiftY;
      for (let sourceX = 0; sourceX < sourceWidth; sourceX++) {
        const colour = this.objectTextures.sample(
          9, view.graphicFrame, sourceX, sourceY, 0);
        if (!colour) continue;
        const left = weaponLeft + sourceX * horizontalScale;
        for (let dy = 0; dy < verticalScale && top + dy < display.viewHeight; dy++) {
          for (let dx = 0; dx < horizontalScale; dx++) {
            const at = ((top + dy) * display.width + left + dx) * 4;
            pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
            pixels[at + 3] = 255;
          }
        }
      }
    }
  }

  drawBorders(pixels) {
    if (!this.panel || !this.world) return;
    const display = this.display;
    const state = this.world.playerState;
    const ammunition = (state.ammo[state.selectedGun] || 0) >> 3;
    // Enhanced removes the static lateral attached-sprite artwork by explicit
    // user request, but keeps the dynamic strips composed from the released
    // health/ammo data. Original and Sharp continue to draw the complete
    // decoded retail sprites.
    const borders = this.displayMode === DISPLAY_MODES.ENHANCED
      ? this.panel.renderGauges(state.energy, ammunition)
      : this.panel.renderBorders(state.energy, ammunition);
    const top = borders.y + UI_ALIGNMENT.borderShiftY;
    const positions = [0, display.width - borders.width];
    for (const [side, left] of [['left', positions[0]], ['right', positions[1]]]) {
      const sourcePixels = borders[side];
      for (let y = 0; y < borders.height && top + y < display.height; y++) {
        if (top + y < 0) continue;
        for (let x = 0; x < borders.width; x++) {
          const source = (y * borders.width + x) * 4;
          if (!sourcePixels[source + 3]) continue;
          const target = ((top + y) * display.width + left + x) * 4;
          pixels[target] = sourcePixels[source];
          pixels[target + 1] = sourcePixels[source + 1];
          pixels[target + 2] = sourcePixels[source + 2];
          pixels[target + 3] = 255;
        }
      }
    }
  }
}

export function projectObjectBounds(object, point, camera, display = STANDARD_DISPLAY) {
  const horizonShift = Number.isFinite(display.horizonY)
    ? display.horizonY - display.viewCenterY : 0;
  const halfWidth = object.render.width * display.focalX / point.z;
  const halfHeight = object.render.height * .5 * display.focalY / point.z;
  const middleX = display.viewCenterX + point.x / point.z * display.focalX;
  const middleY = display.bitmapCenterY + horizonShift +
    (object.position.y / 2 - sourceViewY(camera)) / point.z * display.focalY;
  const left = middleX - halfWidth, right = middleX + halfWidth;
  const top = middleY - halfHeight, bottom = middleY + halfHeight;
  return { left, right, top, bottom };
}

// Bytes 14/15 in the object record are the source image's half-extents. The
// assembly maps both sides of that range through consttab; decoded PTR atlases
// therefore contain twice these values in each complete frame.
export function sourceBitmapExtent(render) {
  if (!Number.isInteger(render.sourceWidth) || render.sourceWidth <= 0 ||
      !Number.isInteger(render.sourceHeight) || render.sourceHeight <= 0) {
    throw new Error('BitMapObj requires recovered source image half-extents');
  }
  return {
    width: render.sourceWidth * 2,
    height: render.sourceHeight * 2,
  };
}

// ObjDraw3.chipram:BitMapObj lines 617-640 indexes Includes/constantfile with
// DIVU((midpoint depth * decoded source extent), object record extent). Each
// table record is eight bytes; BitMapObj consumes its first big-endian long.
export function sourceBitmapConstantIndex(sourceDepth, sourceExtent, renderExtent) {
  const numerator = Math.imul(sourceDepth & 0xffff, sourceExtent & 0xffff) >>> 0;
  const divisor = renderExtent & 0xff;
  if (!divisor) throw new RangeError('BitMapObj constant-table divisor is zero');
  const quotient = Math.floor(numerator / divisor);
  // ObjDraw3.chipram:BitMapObj performs DIVU d6,d7 followed by
  // SWAP/CLR.W/SWAP, retaining only d7's low word. A 68000 quotient overflow
  // leaves d7 unchanged, so that low word comes from the original MULU
  // dividend rather than a wrapped JavaScript quotient.
  const index = quotient > 0xffff ? numerator & 0xffff : quotient & 0xffff;
  if (index < 0 || index >= SOURCE_RENDERER_CONSTANTS.length / 2) {
    throw new RangeError(`BitMapObj constant-table index ${index} is outside released data`);
  }
  return index;
}

export function sourceRendererConstantEntry(index) {
  if (!Number.isInteger(index) || index < 0 || index >= SOURCE_RENDERER_CONSTANTS.length / 2) {
    throw new RangeError(`renderer constant-table index ${index} is outside released data`);
  }
  return {
    step: SOURCE_RENDERER_CONSTANTS[index * 2],
    correction: SOURCE_RENDERER_CONSTANTS[index * 2 + 1],
  };
}

function sourceBitmapStep(sourceDepth, sourceExtent, renderExtent) {
  return sourceRendererConstantEntry(sourceBitmapConstantIndex(
    sourceDepth, sourceExtent, renderExtent)).step;
}

// BitMapObj:okonleft/drawrightside lines 670-718 advances the decoded strip
// pointer by the integer high word of the table step. Left clipping first
// advances only the pointer and deliberately restarts the fractional DDA at 0.
export function sourceBitmapHorizontalTexels(
    sourceDepth, sourceExtent, renderExtent, skipped, count) {
  const step = sourceBitmapStep(sourceDepth, sourceExtent, renderExtent);
  const base = Math.floor(step * Math.max(0, skipped) / 0x10000);
  let accumulator = 0;
  const result = [];
  for (let offset = 0; offset < Math.max(0, count); offset++) {
    result.push(base + (accumulator >>> 16));
    accumulator = (accumulator + step) >>> 0;
  }
  return result;
}

// BitMapObj:objfitsonbot and each drawavertstrip (lines 641-791) seed the
// swapped-long carry accumulator with $80000000. ADD.L followed by ADDX.W then
// advances the row word; this produces the source's rounded vertical cadence.
// As on the horizontal path, top clipping applies only the integer product and
// restarts the fractional component.
export function sourceBitmapVerticalTexels(
    sourceDepth, sourceExtent, renderExtent, skipped, count) {
  const step = sourceBitmapStep(sourceDepth, sourceExtent, renderExtent);
  const base = Math.floor(step * Math.max(0, skipped) / 0x10000);
  const swapped = (((step & 0xffff) << 16) | (step >>> 16)) >>> 0;
  let accumulator = (0x80000000 + base) >>> 0;
  let row = base & 0xffff;
  const result = [];
  for (let offset = 0; offset < Math.max(0, count); offset++) {
    result.push(row);
    const sum = accumulator + swapped;
    const carry = sum > 0xffffffff ? 1 : 0;
    accumulator = sum >>> 0;
    row = (row + (swapped & 0xffff) + carry) & 0xffff;
  }
  return result;
}

// RotateObjectPts uses the same multiply-high words as RotateLevelPts. The
// stored object depth is doubled relative to browser world distance, while its
// side long has seven fractional bits.
export function sourceObjectCameraPoint(object, camera) {
  const rotated = sourceWallCameraPoint(
    [object.position.x, object.position.z], camera);
  return {
    x: rotated.x / 128,
    z: rotated.z / 2,
    sourceXLong: rotated.x,
    sourceDepth: rotated.z,
  };
}

// ObjDraw3.chipram:BitMapObj lines 560-596 projects the midpoint with origins
// 47/39, then projects object bytes 6/7 as half-width and half-height. Horizontal
// drawing uses DBRA on twice the half-width (so the right endpoint is included),
// while vertical drawing decrements twice the half-height before DBRA.
export function sourceBitmapBounds(object, point, camera) {
  if (!Number.isInteger(point.sourceXLong) || !Number.isInteger(point.sourceDepth)) {
    throw new Error('BitMapObj requires the recovered ObjRotated fixed-point record');
  }
  const depth = rendererSignedWord(point.sourceDepth);
  const sideLong = point.sourceXLong | 0;
  const viewYLong = Math.trunc(sourceViewY(camera) * 256) | 0;
  const objectYLong = (rendererSignedWord(object.position.y) << 7) | 0;
  const middleX = rendererSignedWord(sourceDivsWord(sideLong, depth) + 47);
  const middleY = rendererSignedWord(sourceDivsWord(
    (objectYLong - viewYLong) | 0, depth) + 39);
  const halfWidth = sourceDivsWord(
    (rendererSignedWord(object.render.width) << 7) | 0, depth);
  const halfHeight = sourceDivsWord(
    (rendererSignedWord(object.render.height) << 7) | 0, depth);
  const left = rendererSignedWord(middleX - halfWidth);
  const top = rendererSignedWord(middleY - halfHeight);
  const width = rendererSignedWord(halfWidth + halfWidth);
  const height = rendererSignedWord(halfHeight + halfHeight);
  return {
    middleX, middleY, halfWidth, halfHeight, left, top, width, height,
    right: rendererSignedWord(left + width),
    bottomExclusive: rendererSignedWord(top + height),
  };
}

// ObjDraw3.chipram:BitMapObj rejects its stored midpoint depth at <=50.
export function sourceBitmapObjectVisible(sourceDepth) {
  return rendererSignedWord(sourceDepth) > 50;
}

// DrawDisplay compares yoff with ToZoneRoof and renders the two streams in
// the corresponding order. This is significant because each stream writes
// directly to the same chunky buffer.
export function sourceRoomLayerOrder(level, world, zoneId, camera) {
  const zone = level.zones[zoneId];
  const split = (world?.zoneRoof(zoneId) ?? zone.roof) / 256;
  return sourceViewY(camera) < split
    ? ['lower', 'upper']
    : ['upper', 'lower'];
}

// ObjDraw command words 0/1 select the camera-dependent halves around water;
// values above one select the complete room. BitmapObj projects these bounds
// and intersects them with topclip/botclip before drawing the sprite.
export function sourceBitmapObjectClip(
    level, world, zoneId, camera, depth, upperLayer = false, region = 2,
    sourceDepth = Math.trunc(depth * 2), display = STANDARD_DISPLAY) {
  const zone = level.zones[zoneId];
  let topFixed;
  let bottomFixed;
  if (upperLayer) {
    topFixed = zone.upperRoof;
    bottomFixed = zone.upperFloor;
  } else {
    const roof = world?.zoneRoof(zoneId) ?? zone.roof;
    const floor = world?.zoneFloor(zoneId) ?? zone.floor;
    const water = world?.zoneWater(zoneId) ?? zone.water;
    if (region > 1) {
      topFixed = roof;
      bottomFixed = floor;
    } else if (water < sourceViewY(camera) * 256) {
      [topFixed, bottomFixed] = region < 1 ? [roof, water] : [water, floor];
    } else {
      [topFixed, bottomFixed] = region < 1 ? [water, floor] : [roof, water];
    }
  }
  const horizonY = Number.isFinite(display.horizonY)
    ? display.horizonY : display.viewCenterY;
  let projectedTop = horizonY +
    (topFixed / 256 - sourceViewY(camera)) / depth * display.focalY;
  let projectedBottom = horizonY +
    (bottomFixed / 256 - sourceViewY(camera)) / depth * display.focalY;
  if (projectedTop > projectedBottom) [projectedTop, projectedBottom] =
    [projectedBottom, projectedTop];
  const viewYLong = Math.trunc(sourceViewY(camera) * 256) | 0;
  let sourceTop = rendererSignedWord(sourceDivsWord(
    ((topFixed | 0) - viewYLong) | 0, sourceDepth) + 40);
  let sourceBottom = rendererSignedWord(sourceDivsWord(
    ((bottomFixed | 0) - viewYLong) | 0, sourceDepth) + 40);
  if (sourceTop > sourceBottom) [sourceTop, sourceBottom] = [sourceBottom, sourceTop];
  return {
    firstY: Math.max(0, Math.ceil(projectedTop - .5)),
    lastY: Math.min(display.viewHeight - 1, Math.floor(projectedBottom - .5)),
    sourceFirstY: Math.max(0, sourceTop),
    // NEWTWO.s initializes botclip to 79. BitMapObj clamps objclipb to that
    // word, subtracts the top, then SUBQ #1 before DBRA; row 79 is therefore
    // the exclusive clipped endpoint, not an additional drawable row.
    sourceLastYExclusive: Math.min(79, sourceBottom),
  };
}

function rendererSignedWord(value) {
  const word = Math.trunc(value) & 0xffff;
  return word & 0x8000 ? word - 0x10000 : word;
}

function rendererSignedByte(value) {
  return Math.trunc(value) << 24 >> 24;
}

// wallroutine3.chipmem:screendivide swaps the 16.16 light accumulator,
// applies EXT.W (byte -> word), then adds doubled depth ASR #7 and clamps.
export function sourceWallBrightness(interpolatedBrightness, sourceDepth) {
  return Math.max(0, Math.min(64,
    rendererSignedByte(interpolatedBrightness) +
    (rendererSignedWord(sourceDepth) >> 7)));
}

// The labelled 1x1 browser mode inserts pixels between source wall columns.
// wallroutine3.chipmem:CalcAndDraw lines 1025-1032 EXT.W-sign-extends each
// endpoint's low byte; screendivide lines 416-419 does the same after its 16.16
// DDA. sourceWallSubdivision's packed U/light midpoint can put U carries in all
// higher bits of that word. Extract the same actual light bytes before browser
// interpolation; interpolating the packed words turns harmless multiples of
// $100 into false maximum-light (black palette-row) bars.
export function sourceContinuousWallBrightness(leftBrightness, rightBrightness, amount, depth) {
  const left = rendererSignedByte(rendererSignedWord(leftBrightness + leftBrightness));
  const right = rendererSignedByte(rendererSignedWord(rightBrightness + rightBrightness));
  const point = left + (right - left) * amount;
  return Math.max(0, Math.min(64,
    Math.trunc(point) + (rendererSignedWord(Math.trunc(depth)) >> 7)));
}

function sourceWordMean(first, second) {
  return rendererSignedWord(rendererSignedWord(first) + rendererSignedWord(second)) >> 1;
}

function sourceLongMean(first, second) {
  return ((first | 0) + (second | 0) | 0) >> 1;
}

function packedWallTail(point) {
  return ((rendererSignedWord(point.u) & 0xffff) << 16 |
    (rendererSignedWord(point.brightness) & 0xffff)) | 0;
}

function wallPointFromPacked(x, z, packed) {
  return {
    x: x | 0,
    z: rendererSignedWord(z),
    u: rendererSignedWord(packed >> 16),
    brightness: rendererSignedWord(packed),
  };
}

// Abreed3d_2Player.s:RotateLevelPts stores a 25.7 side long and a doubled
// signed-word depth in each Rotated record. walldraw consumes those records
// directly, rather than the floating transform used by bitmap objects.
export function sourceWallCameraPoint(point, camera, u = 0, brightness = 0) {
  const angleUnits = Number.isInteger(camera.angleUnits)
    ? camera.angleUnits : radiansToSourceAngle(camera.angle || 0);
  const { sinWord, cosWord } = sourceAngleTrig(angleUnits);
  const dx = rendererSignedWord(
    rendererSignedWord(point[0]) - rendererSignedWord(Math.floor(camera.x)));
  const dz = rendererSignedWord(
    rendererSignedWord(point[1]) - rendererSignedWord(Math.floor(camera.z)));
  let side = (Math.imul(dx, rendererSignedWord(cosWord)) -
    Math.imul(dz, rendererSignedWord(sinWord))) | 0;
  side = (side + side) | 0;
  const sideWord = rendererSignedWord(side >> 16);
  const x = ((sideWord << 7) + Math.trunc((camera.bobbleAcross || 0) * 128)) | 0;
  let depth = (Math.imul(dx, rendererSignedWord(sinWord)) +
    Math.imul(dz, rendererSignedWord(cosWord))) | 0;
  depth = (depth << 2) | 0;
  return {
    x,
    z: rendererSignedWord(depth >> 16),
    u: rendererSignedWord(u),
    brightness: rendererSignedWord(brightness),
  };
}

export function sourceWallColumn(point) {
  if (point.z <= 0) return point.x > 0 ? 96 : 0;
  // Abreed3d_2Player.s:RotateLevelPts performs DIVS directly in the 25.7
  // side long and subsequently adds 47 to its low word. On quotient overflow
  // the 68000 leaves that long unchanged; wrapping a JavaScript quotient gives
  // a different column.
  return rendererSignedWord(47 + sourceDivsWord(point.x | 0, point.z));
}

export function sourceWallZeroDepthSide(behind, front) {
  const deltaX = ((behind.x | 0) - (front.x | 0)) | 0;
  const deltaZ = rendererSignedWord(behind.z - front.z);
  const quotient = sourceDivsWord(deltaX, deltaZ);
  return ((-Math.imul(rendererSignedWord(front.z), quotient) | 0) +
    (front.x | 0)) | 0;
}

// wallroutine3.chipmem:itsawalldraw lines 1715-1767 performs a separate
// facing test before walldraw. Both-front endpoints use their integer
// OnScreen columns. With one endpoint behind, the source uses signed
// DIVS/MULS to compare its zero-depth crossing with the front endpoint.
export function sourceWallFacingVisible(left, right) {
  const leftFront = left.z > 0, rightFront = right.z > 0;
  if (!leftFront && !rightFront) return false;
  if (leftFront && rightFront) {
    const leftColumn = sourceWallColumn(left);
    const rightColumn = sourceWallColumn(right);
    return leftColumn <= 95 && leftColumn < rightColumn && rightColumn >= 0;
  }
  if (!leftFront) {
    return sourceWallZeroDepthSide(left, right) < sourceWallColumn(right) - 47;
  }
  return sourceWallZeroDepthSide(right, left) > sourceWallColumn(left) - 47;
}

// Enhanced-only companion to sourceWallFacingVisible. The source predicate
// folds the retail 0..95 viewport rejection into its winding check. Reusing it
// for the explicitly wider browser viewport discards correctly wound walls
// which exist only in the added columns (Level A descriptors 2328/2358 are a
// concrete retail-data example). Test the same recovered subdivided endpoints
// against the active continuous projection instead. Original and Sharp keep
// the exact integer source predicate above.
export function continuousWallFacingVisible(
    spans, display = ENHANCED_DISPLAY, clipLeft = null, clipRight = null) {
  if (!spans.length) return false;
  clipLeft ??= display.viewLeft;
  clipRight ??= display.viewLeft + display.viewWidth;
  const left = spans[0][0];
  const right = spans[spans.length - 1][1];
  const leftX = display.viewCenterX + left.x / left.z * display.pixelScale;
  const rightX = display.viewCenterX + right.x / right.z * display.pixelScale;
  return Number.isFinite(leftX) && Number.isFinite(rightX) &&
    leftX < rightX && leftX < clipRight && rightX >= clipLeft;
}

function sourceFixedWord(word) {
  return ((rendererSignedWord(word) & 0xffff) << 16) | 0;
}

function sourceFixedStep(first, second, shift) {
  const difference = rendererSignedWord(
    rendererSignedWord(second) - rendererSignedWord(first));
  return sourceFixedWord(difference) >> shift;
}

function sourceProjectedWallRow(numerator, depth, origin) {
  // wallroutine3.chipmem:CalcAndDraw uses DIVS for every projected top and
  // bottom word. Preserve its unchanged destination on quotient overflow.
  return rendererSignedWord(origin + sourceDivsWord(numerator | 0, depth));
}

function sourceAddWord(register, addend) {
  return ((register & 0xffff0000) |
    (((register & 0xffff) + (addend & 0xffff)) & 0xffff)) | 0;
}

// wallroutine3.chipmem:ScreenWallstripdraw/gotoend lines 1079-1346 indexes
// Includes/constantfile with the doubled source depth. The first long supplies
// the integer/fractional vertical DDA and the second is its start correction.
// These ADD.L/ADDX.W carry paths are also used for coplanar wall details, so a
// floating world-Y reconstruction produces conspicuous striped disagreement.
export function sourceWallVerticalTexels(
    sourceDepth, projectedTop, projectedBottom, textureYOffset, textureHeight,
    cameraY, first = Math.max(0, projectedTop), last = Math.min(79, projectedBottom)) {
  const depth = rendererSignedWord(sourceDepth);
  if (depth <= 0 || depth >= SOURCE_RENDERER_CONSTANTS.length / 2) return [];
  const top = Math.max(0, rendererSignedWord(first));
  const bottom = Math.min(79, rendererSignedWord(last));
  if (bottom - top <= 0) return [];
  const mask = rendererSignedWord(textureHeight - 1);
  const firstLong = SOURCE_RENDERER_CONSTANTS[depth * 2] | 0;
  const correction = SOURCE_RENDERER_CONSTANTS[depth * 2 + 1] | 0;
  const integerStep = firstLong & 0xffff;
  const swappedStep = rendererSwapLong(firstLong);
  const fractionalWord = rendererSignedWord(swappedStep);
  const totalYOffset = rendererSignedWord(
    textureYOffset + ((rendererSignedWord(cameraY) + 224) & 255)) & mask;

  let coordinate = (Math.imul(integerStep, top) + correction) | 0;
  coordinate = rendererSwapLong(coordinate);
  coordinate = sourceAddWord(coordinate, Math.imul(fractionalWord, top));
  coordinate = sourceAddWord(coordinate, totalYOffset);
  const result = [];

  // `usesimple` is selected only when the swapped first long has a zero low
  // word and the integer component is at most $b000. It caches the texel until
  // ADD.L carries, then advances the masked row by one.
  if (!fractionalWord && integerStep <= 0xb000) {
    let row = (coordinate & 0xffff) & mask;
    for (let y = top; y <= bottom; y++) {
      result.push(row);
      const sum = (coordinate >>> 0) + (swappedStep >>> 0);
      coordinate = sum | 0;
      if (sum > 0xffffffff) {
        coordinate = sourceAddWord(coordinate, 1);
        row = (coordinate & 0xffff) & mask;
      }
    }
    return result;
  }

  const fractionalLong = swappedStep & 0xffff0000;
  for (let y = top; y <= bottom; y++) {
    coordinate = ((coordinate & 0xffff0000) |
      ((coordinate & 0xffff) & mask)) | 0;
    result.push(coordinate & 0xffff);
    const sum = (coordinate >>> 0) + (fractionalLong >>> 0);
    coordinate = sum | 0;
    coordinate = sourceAddWord(coordinate, fractionalWord +
      (sum > 0xffffffff ? 1 : 0));
  }
  return result;
}

// Doleftend reads the recovered 512-entry iterfile. For source viewport widths
// 0/1 it emits one sample; widths 2..511 select the next power of two. In
// particular, entries 257..511 contain counter 511 and shift 9, so the source
// DBRA emits 512 samples, not 256. screendivide advances six wrapping 16.16
// values and omits the right endpoint.
export function sourceWallColumns(left, right, topFixed, bottomFixed, viewFixed,
    clipLeft = 0, clipRight = 96, continuingSpan = false) {
  const leftColumn = sourceWallColumn(left);
  const rightColumn = sourceWallColumn(right);
  const width = rendererSignedWord(rightColumn - leftColumn);
  if (width < 0 || width > 511) return [];
  const shift = width <= 1 ? 0 : Math.ceil(Math.log2(width));
  const sampleCount = 1 << shift;
  const topNumerator = ((topFixed | 0) - (viewFixed | 0)) | 0;
  const bottomNumerator = ((bottomFixed | 0) - (viewFixed | 0)) | 0;
  const leftTop = sourceProjectedWallRow(topNumerator, left.z, 40);
  const rightTop = sourceProjectedWallRow(topNumerator, right.z, 40);
  // curvecalc initializes strbot at origin 40 for the first positive record.
  // Each computed right endpoint uses origin 41 and becomes the following
  // span's retained strbot; only the first span therefore starts at 40.
  const leftBottom = sourceProjectedWallRow(
    bottomNumerator, left.z, continuingSpan ? 41 : 40);
  const rightBottom = sourceProjectedWallRow(bottomNumerator, right.z, 41);
  const leftBrightness = rendererSignedWord(left.brightness + left.brightness);
  const rightBrightness = rendererSignedWord(right.brightness + right.brightness);
  const values = {
    x: sourceFixedWord(leftColumn),
    u: sourceFixedWord(left.u),
    depth: sourceFixedWord(left.z),
    top: sourceFixedWord(leftTop),
    bottom: sourceFixedWord(leftBottom),
    brightness: sourceFixedWord(leftBrightness),
  };
  const steps = {
    x: sourceFixedStep(leftColumn, rightColumn, shift),
    u: sourceFixedStep(left.u, right.u, shift),
    depth: sourceFixedStep(left.z, right.z, shift),
    top: sourceFixedStep(leftTop, rightTop, shift),
    bottom: sourceFixedStep(leftBottom, rightBottom, shift),
    brightness: sourceFixedStep(leftBrightness, rightBrightness, shift),
  };
  const columns = [];
  // wallroutine3.chipmem:Doleftend/screendivide initializes
  // leftclipandlast to leftclip-1. `cmp.w d6,d0 / bgt` admits only a source X
  // strictly greater than the last admitted column; all duplicate subdivision
  // samples still advance the DDAs but never reach WorkSpace or the strip
  // drawer. This is essential when iterfile selects more samples than the
  // projected wall width.
  let lastScreenX = rendererSignedWord(clipLeft - 1);
  for (let sample = 0; sample < sampleCount; sample++) {
    const x = rendererSignedWord(values.x >> 16);
    if (x > lastScreenX) {
      lastScreenX = x;
      // screendivide exits the complete calculation as soon as its first
      // strictly increasing column reaches rightclip.
      if (x >= clipRight) break;
      columns.push({
        x,
        u: rendererSignedWord(values.u >> 16),
        depth: rendererSignedWord(values.depth >> 16),
        top: rendererSignedWord(values.top >> 16),
        bottom: rendererSignedWord(values.bottom >> 16),
        brightness: rendererSignedWord(values.brightness >> 16),
      });
    }
    for (const field of Object.keys(values)) values[field] = (values[field] + steps[field]) | 0;
  }
  return columns;
}

// wallroutine3.chipmem:walldraw lines 799-955 starts with the two endpoints
// and their midpoint. Its depth-difference/nearest-depth table chooses how
// many times to insert arithmetic midpoints. The texture and point-light words
// are intentionally averaged as one packed long after the first iteration.
export function sourceWallSubdivision(left, right) {
  // wallroutine3.chipmem:itsawalldraw lines 1802-1810 adds 300 to each
  // point-light word before walldraw builds its endpoint/midpoint records.
  // Later subdivision iterations average U and that biased light as one long,
  // so removing the bias before the packed ADD.L can introduce a carry from a
  // negative light word into U. CalcAndDraw lines 1026-1033 subtract 300 only
  // after subdivision, immediately before Doleftend consumes a span.
  left = wallPointFromPacked(left.x, left.z, packedWallTail({
    ...left, brightness: rendererSignedWord(left.brightness + 300),
  }));
  right = wallPointFromPacked(right.x, right.z, packedWallTail({
    ...right, brightness: rendererSignedWord(right.brightness + 300),
  }));
  let multiplier = 16;
  let iterationWord = 2;
  let depthDifference = rendererSignedWord(right.z - left.z);
  if (depthDifference < 0) depthDifference = rendererSignedWord(-depthDifference);
  if (depthDifference >= 1024) {
    multiplier <<= 1;
    iterationWord++;
  }
  if (depthDifference >= 512) {
    multiplier <<= 1;
    iterationWord++;
  } else {
    if (depthDifference <= 256) {
      multiplier >>= 1;
      iterationWord--;
    }
    if (depthDifference <= 128) {
      multiplier >>= 1;
      iterationWord--;
    }
  }
  const nearestDepth = Math.min(left.z, right.z);
  if (nearestDepth <= 64) {
    multiplier <<= 1;
    iterationWord++;
  }
  if (nearestDepth >= 128) {
    multiplier >>= 1;
    iterationWord--;
    if (iterationWord >= 0 && nearestDepth >= 256) {
      multiplier >>= 1;
      iterationWord--;
    }
  }

  const initialMiddle = {
    x: sourceLongMean(left.x, right.x),
    z: sourceWordMean(left.z, right.z),
    u: sourceWordMean(left.u, right.u),
    brightness: sourceWordMean(left.brightness, right.brightness),
  };
  let points = [left, initialMiddle, right];
  const iterations = Math.max(0, iterationWord + 1);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const subdivided = [points[0]];
    for (let index = 0; index + 1 < points.length; index++) {
      const first = points[index], second = points[index + 1];
      const packed = sourceLongMean(packedWallTail(first), packedWallTail(second));
      subdivided.push(wallPointFromPacked(
        sourceLongMean(first.x, second.x), sourceWordMean(first.z, second.z), packed));
      subdivided.push(second);
    }
    points = subdivided;
  }
  return {
    points: points.map(point => ({
      ...point,
      brightness: rendererSignedWord(point.brightness - 300),
    })),
    iterations,
    iterationWord,
    multCount: rendererSignedWord(multiplier - 1),
  };
}

// curvecalc scans at most multcount+1 records for its first positive depth,
// then draws adjacent records only until the next nonpositive depth.
export function sourceWallSpans(left, right) {
  if (left.z <= 0 && right.z <= 0) return [];
  const { points, multCount } = sourceWallSubdivision(left, right);
  const lastFirstIndex = Math.min(points.length - 2, multCount);
  let first = 0;
  while (first <= lastFirstIndex && points[first].z <= 0) first++;
  if (first > lastFirstIndex) return [];
  const spans = [];
  for (let index = first; index + 1 < points.length; index++) {
    if (points[index + 1].z <= 0) break;
    spans.push([points[index], points[index + 1]]);
  }
  return spans;
}

// PolygonObj:PutinParts reads a byte offset into the ten-byte boxrot records,
// squares X, Y, and Z as signed words, and adds the products with 32-bit wrap.
// Its insertion loop is descending and inserts a later equal key first.
export function sourceVectorPartOrder(parts, transformed, camera) {
  const ordered = parts.map((part, tableIndex) => {
    const point = transformed[Math.trunc(part.sortPointOffset / 10)];
    if (!point) throw new Error(`invalid PolygonObj sort point ${part.sortPointOffset}`);
    if (!Number.isInteger(point.sourceXLong) ||
        !Number.isInteger(point.sourceYLong) ||
        !Number.isInteger(point.sourceDepth)) {
      throw new Error('PolygonObj PutinParts requires recovered boxrot fields');
    }
    // ObjDraw3.chipram:convtoscr has replaced boxrot with camera-relative
    // 25.7 X/Y longs and the doubled Z word before PutinParts reads it.
    const x = rendererSignedWord((point.sourceXLong | 0) >> 7);
    const y = rendererSignedWord((point.sourceYLong | 0) >> 7);
    const z = rendererSignedWord(point.sourceDepth);
    const key = (Math.imul(x, x) + Math.imul(y, y) + Math.imul(z, z)) | 0;
    return { part, tableIndex, key };
  });
  // Partloop stops at the first negative long, exactly like its initialized
  // $80010000 sentinel. Retail descriptors stay well below the 32-slot table.
  return ordered
    .filter(entry => entry.key >= 0)
    .sort((a, b) => b.key - a.key || b.tableIndex - a.tableIndex)
    .map(entry => entry.part);
}

export function sourceVectorObjectVisible(transformed) {
  return transformed.every(point => {
    if (!Number.isInteger(point.sourceDepth)) {
      throw new Error('PolygonObj visibility requires recovered boxrot depth');
    }
    return rendererSignedWord(point.sourceDepth) > 0;
  });
}

// ObjDraw3.chipram:PolygonObj rotobj/convtoscr (lines 922-1026) keeps local
// X/Y in 25.7 longs, local and midpoint depth in doubled signed words, and
// performs signed DIVS before adding source origins 47/40. This is deliberately
// separate from the browser's continuous projection used by the sharp display
// option: source visibility, sorting, winding, and light all consume these
// exact records.
export function sourceVectorCameraPoints(frame, object, camera) {
  const cameraAngle = sourceCameraTrig(camera).angleUnits;
  const relativeAngle = ((object.facing || 0) - 2048 - cameraAngle) & 8190;
  const { sinWord, cosWord } = sourceAngleTrig(relativeAngle);
  const sin = rendererSignedWord(sinWord);
  const cos = rendererSignedWord(cosWord);
  const midpoint = sourceWallCameraPoint(
    [object.position.x, object.position.z], camera);
  const objectYLong = (rendererSignedWord(object.position.y) << 7) | 0;
  const viewYLong = Math.trunc(sourceViewY(camera) * 256) | 0;

  const transformed = frame.map(point => {
    const pointX = rendererSignedWord(point.x);
    const pointY = rendererSignedWord(point.y);
    const pointZ = rendererSignedWord(point.z);
    const doubledX = rendererSignedWord(pointX + pointX);
    const doubledY = rendererSignedWord(pointY + pointY);
    const doubledZ = rendererSignedWord(pointZ + pointZ);
    const localXLong = ((Math.imul(doubledX, sin) -
      Math.imul(doubledZ, cos)) | 0) >> 8;
    const localYLong = (doubledY << 7) | 0;
    let localDepthLong = (Math.imul(pointZ, sin) + Math.imul(pointX, cos)) | 0;
    localDepthLong = (localDepthLong << 2) | 0;
    const sourceXLong = (localXLong + midpoint.x) | 0;
    const sourceYLong = (localYLong + objectYLong - viewYLong) | 0;
    const sourceDepth = rendererSignedWord(
      rendererSignedWord(localDepthLong >> 16) + midpoint.z);
    return {
      sourceXLong, sourceYLong, sourceDepth,
      x: sourceXLong / 128,
      y: sourceViewY(camera) + sourceYLong / 256,
      z: sourceDepth / 2,
      gouraudRow: sourceVectorPointBrightness(point, sin, cos),
    };
  });

  // ab3d/objdraw3.chipram:convtoscr lines 995-1008 executes BLE
  // polybehind on the combined depth before either DIVS. A vertex exactly on
  // the camera plane therefore rejects the whole object; it is not a 68000
  // divide-by-zero. Keep the transform records so sourceVectorObjectVisible()
  // can make that same object-level decision, but never project an object the
  // original routine has already discarded.
  if (!sourceVectorObjectVisible(transformed)) return transformed;
  for (const point of transformed) {
    point.sourceScreenX = rendererSignedWord(
      sourceDivsWord(point.sourceXLong, point.sourceDepth) + 47);
    point.sourceScreenY = rendererSignedWord(
      sourceDivsWord(point.sourceYLong, point.sourceDepth) + 40);
  }
  return transformed;
}

function sourceVectorRasterPoint(
    point, vertex, sourcePixels, display = STANDARD_DISPLAY) {
  const horizonY = Number.isFinite(display.horizonY)
    ? display.horizonY : display.viewCenterY;
  return {
    ...point,
    u: vertex.u,
    v: vertex.v,
    screenX: sourcePixels
      ? VIEW_LEFT + point.sourceScreenX * 2
      : display.viewCenterX +
        point.sourceXLong / point.sourceDepth * display.pixelScale,
    screenY: sourcePixels
      ? point.sourceScreenY * 2
      : horizonY + point.sourceYLong / point.sourceDepth * display.pixelScale,
  };
}

// doapoly lines 1133-1152 uses word subtractions, signed word multiplies and
// one wrapping long subtraction. Its result is both the back-face decision and
// polybright; deriving it from browser floating coordinates changes both.
export function sourceVectorFaceArea(first, second, third) {
  const x0 = rendererSignedWord(first.sourceScreenX);
  const x1 = rendererSignedWord(second.sourceScreenX);
  const x2 = rendererSignedWord(third.sourceScreenX);
  const y0 = rendererSignedWord(first.sourceScreenY);
  const y1 = rendererSignedWord(second.sourceScreenY);
  const y2 = rendererSignedWord(third.sourceScreenY);
  const firstX = rendererSignedWord(x0 - x1);
  const secondX = rendererSignedWord(x2 - x1);
  const firstY = rendererSignedWord(y0 - y1);
  const secondY = rendererSignedWord(y2 - y1);
  return (Math.imul(secondX, firstY) - Math.imul(firstX, secondY)) | 0;
}

// doapoly lines 1198-1218 applies ASL.L #3, DIVS, NEG.W, +14 and the midpoint
// depth contribution before objscalecols selects the palette row.
export function sourceVectorFlatPaletteRow(baseBrightness, sourceDepth, area, divisor) {
  const quotient = sourceDivsWord((area << 3) | 0, divisor);
  const objectBrightness = rendererSignedWord(
    rendererSignedWord(baseBrightness) + (rendererSignedWord(sourceDepth) >> 7));
  let light = rendererSignedWord(rendererSignedWord(-quotient) + 14);
  light = rendererSignedWord(light + objectBrightness);
  if (light < 0) light = 0;
  return objectLightRow(light);
}

function sourceVectorEdgeStep(difference, width) {
  // putinlines forms a signed 24.8 dividend, performs DIVS, sign-extends the
  // quotient, then restores eight low fractional bits.
  const dividend = (rendererSignedWord(difference) << 8) | 0;
  return (sourceDivsWord(dividend, width) << 8) | 0;
}

// ObjDraw3.chipram:putinlines/putingourlines (lines 1668-2251) walks every
// non-vertical edge from its integer left endpoint through its integer right
// endpoint. Increasing-X edges populate PolyTopTab; decreasing-X edges populate
// PolyBotTab. The edge DDA uses quantized 16.16 steps and preserves the final
// descriptor tuple used to close the polygon.
export function sourceVectorEdgeColumns(vertices, closingVertex = vertices[0],
    gouraud = false, leftClip = 0, rightClip = 96) {
  const columns = Array.from({ length: 96 }, () => ({}));
  let left = 960;
  let right = -10;
  let drew = false;
  for (let index = 0; index < vertices.length; index++) {
    const first = vertices[index];
    const second = index + 1 < vertices.length ? vertices[index + 1] : closingVertex;
    const firstX = rendererSignedWord(first.sourceScreenX);
    const secondX = rendererSignedWord(second.sourceScreenX);
    if (firstX === secondX) continue;
    const topEdge = secondX > firstX;
    const edgeLeft = topEdge ? first : second;
    const edgeRight = topEdge ? second : first;
    const startX = rendererSignedWord(edgeLeft.sourceScreenX);
    const endX = rendererSignedWord(edgeRight.sourceScreenX);
    if (startX >= rightClip || endX <= leftClip) continue;

    const clippedEndDelta = rendererSignedWord(rightClip - endX);
    let rightAdjustment = 0;
    if (clippedEndDelta <= 0) {
      rightAdjustment = clippedEndDelta;
      right = rendererSignedWord(rightClip - 1);
    } else if (endX > right) {
      right = endX;
    }
    const offLeft = startX < leftClip ? rendererSignedWord(leftClip - startX) : 0;
    const startColumn = startX < leftClip ? leftClip : startX;
    if (startColumn < left) left = startColumn;
    drew = true;

    const width = rendererSignedWord(endX - startX);
    let count = rendererSignedWord(width + rightAdjustment);
    count = rendererSignedWord(count - offLeft);
    if (count < 0) continue;
    let yFixed = (rendererSignedWord(edgeLeft.sourceScreenY) << 16) | 0;
    let uFixed = ((edgeLeft.u & 0xff) << 16) | 0;
    let vFixed = ((edgeLeft.v & 0xff) << 16) | 0;
    let brightnessFixed = (rendererSignedWord(edgeLeft.gouraudRow || 0) << 16) | 0;
    const yStep = sourceVectorEdgeStep(
      rendererSignedWord(edgeRight.sourceScreenY - edgeLeft.sourceScreenY), width);
    const uStep = sourceVectorEdgeStep(
      rendererSignedWord((edgeRight.u & 0xff) - (edgeLeft.u & 0xff)), width);
    const vStep = sourceVectorEdgeStep(
      rendererSignedWord((edgeRight.v & 0xff) - (edgeLeft.v & 0xff)), width);
    const brightnessStep = gouraud ? sourceVectorEdgeStep(rendererSignedWord(
      (edgeRight.gouraudRow || 0) - (edgeLeft.gouraudRow || 0)), width) : 0;
    for (let skipped = 0; skipped < offLeft; skipped++) {
      yFixed = (yFixed + yStep) | 0;
      uFixed = (uFixed + uStep) | 0;
      vFixed = (vFixed + vStep) | 0;
      brightnessFixed = (brightnessFixed + brightnessStep) | 0;
    }
    const side = topEdge ? 'top' : 'bottom';
    for (let offset = 0; offset <= count; offset++) {
      const column = startColumn + offset;
      if (column >= 0 && column < columns.length) {
        columns[column][side] = {
          y: rendererSignedWord(yFixed >> 16),
          u: rendererSignedWord(uFixed >> 16),
          v: rendererSignedWord(vFixed >> 16),
          gouraudRow: rendererSignedWord(brightnessFixed >> 16),
        };
      }
      yFixed = (yFixed + yStep) | 0;
      uFixed = (uFixed + uStep) | 0;
      vFixed = (vFixed + vStep) | 0;
      brightnessFixed = (brightnessFixed + brightnessStep) | 0;
    }
  }
  left = Math.max(leftClip, left);
  right = Math.min(rightClip, right);
  return !drew || right <= left ? null : { left, right, columns };
}

function rendererSwapLong(value) {
  return (((value >>> 16) & 0xffff) | ((value & 0xffff) << 16)) | 0;
}

function sourceVectorPackedIncrement(uStepLong, vStepLong) {
  const swappedU = rendererSwapLong(uStepLong);
  const swappedV = rendererSwapLong(vStepLong);
  const packedLow = ((((swappedV & 0xffff) << 8) & 0xff00) |
    (swappedU & 0xff)) & 0xffff;
  const ordinary = ((swappedV & 0xffff0000) | packedLow) | 0;
  const extraV = ((ordinary & 0xffff0000) |
    ((ordinary + 0x100) & 0xffff)) | 0;
  return {
    uFraction: rendererSignedWord(uStepLong), ordinary, extraV,
  };
}

function sourceVectorClipAdvance(differenceShifted, amount, height) {
  const product = Math.imul(rendererSignedWord(differenceShifted),
    rendererSignedWord(amount));
  return (sourceDivsWord(product, height) << 8) | 0;
}

function rendererDivsRegister(dividend, divisor) {
  const original = dividend | 0;
  const signedDivisor = rendererSignedWord(divisor);
  // MC68000 DIVS takes exception vector 5 on a zero divisor. This helper is
  // used where the source subsequently consumes both quotient and remainder;
  // preserving the dividend was only correct for quotient overflow.
  if (!signedDivisor) throw new RangeError('68000 DIVS division by zero');
  const quotient = Math.trunc(original / signedDivisor);
  if (quotient < -32768 || quotient > 32767) return original;
  const remainder = original - quotient * signedDivisor;
  return (((remainder & 0xffff) << 16) | (quotient & 0xffff)) | 0;
}

// doapoly/dopoly and gotholesin (lines 1220-1340 and 1535-1643) use one
// word carry accumulator for U and the high word of the packed coordinate for
// V. ADD.W followed by ADDX.L chooses between the ordinary and extra-V packed
// increments. Holed faces deliberately seed both accumulators with $7fff and,
// unlike the opaque path, do not advance texture coordinates after top clip.
export function sourceVectorFlatColumnSamples(
    top, bottom, clipTop = 0, clipBottom = 79, holes = false) {
  const originalTop = rendererSignedWord(top.y);
  const originalBottom = rendererSignedWord(bottom.y);
  if (originalTop >= clipBottom || originalBottom <= clipTop) return [];
  const firstY = Math.max(clipTop, originalTop);
  const lastYExclusive = Math.min(clipBottom, originalBottom);
  const count = rendererSignedWord(lastYExclusive - firstY);
  if (count <= 0) return [];
  const offTop = rendererSignedWord(firstY - originalTop);
  const fullHeight = holes
    ? rendererSignedWord(originalBottom - firstY)
    : rendererSignedWord(originalBottom - originalTop);
  if (fullHeight <= 0) return [];

  const differenceU = rendererSignedWord(
    rendererSignedWord(bottom.u - top.u) << 8);
  const differenceV = rendererSignedWord(
    rendererSignedWord(bottom.v - top.v) << 8);
  let packed = holes ? 0x7fffffff : 0;
  packed = ((packed & 0xffff0000) |
    (((top.v & 63) << 8) | (top.u & 63))) | 0;
  let uAccumulator = holes ? 0x7fff : 0;
  if (offTop && !holes) {
    const uAdvance = sourceVectorClipAdvance(differenceU, offTop, fullHeight);
    const vAdvance = sourceVectorClipAdvance(differenceV, offTop, fullHeight);
    uAccumulator = rendererSignedWord(uAdvance);
    const swappedU = rendererSwapLong(uAdvance);
    const swappedV = rendererSwapLong(vAdvance);
    const packedAdvance = ((swappedV & 0xffff0000) |
      ((((swappedV & 63) << 8) & 0xff00) | (swappedU & 63))) | 0;
    packed = (packed + packedAdvance) | 0;
  }

  const uStepLong = (sourceDivsWord(differenceU, fullHeight) << 8) | 0;
  const vStepLong = (sourceDivsWord(differenceV, fullHeight) << 8) | 0;
  const increment = sourceVectorPackedIncrement(uStepLong, vStepLong);
  let useExtraV = true;
  const samples = [];
  for (let offset = 0; offset < count; offset++) {
    const coordinate = packed & 0x3f3f;
    samples.push({
      y: firstY + offset,
      u: coordinate & 63,
      v: (coordinate >>> 8) & 63,
    });
    const wordSum = (uAccumulator & 0xffff) +
      (increment.uFraction & 0xffff);
    const xCarry = wordSum > 0xffff ? 1 : 0;
    uAccumulator = rendererSignedWord(wordSum);
    const addend = useExtraV ? increment.extraV : increment.ordinary;
    const longSum = (packed >>> 0) + (addend >>> 0) + xCarry;
    packed = longSum | 0;
    useExtraV = longSum > 0xffffffff;
  }
  return samples;
}

// gotlurvelyshading/drawpolg (lines 1360-1525) packs the brightness integer
// beside the texture byte and retains the DIVS remainder in a second long.
// Its ADD.L carry increments the palette row, while the next ADD.L/ADDX.L pair
// advances U/V. The DBRA immediately before drawpolg predecrements the low
// count word; the two conditional DBRAs then decrement it once per emitted
// pixel, so coverage is top-inclusive and bottom-exclusive even though this
// path lacks dopoly's explicit SUBQ #1. This is not equivalent to linear
// JavaScript interpolation.
export function sourceVectorGouraudColumnSamples(
    top, bottom, clipTop = 0, clipBottom = 79) {
  const originalTop = rendererSignedWord(top.y);
  const originalBottom = rendererSignedWord(bottom.y);
  if (originalTop >= clipBottom || originalBottom <= clipTop) return [];
  const firstY = Math.max(clipTop, originalTop);
  const lastYExclusive = Math.min(clipBottom, originalBottom);
  const count = rendererSignedWord(lastYExclusive - firstY);
  if (count <= 0) return [];
  const offTop = rendererSignedWord(firstY - originalTop);
  const fullHeight = rendererSignedWord(originalBottom - originalTop);
  if (fullHeight <= 0) return [];

  const differenceU = rendererSignedWord(
    rendererSignedWord(bottom.u - top.u) << 8);
  const differenceV = rendererSignedWord(
    rendererSignedWord(bottom.v - top.v) << 8);
  let packed = (((top.v & 63) << 8) | (top.u & 63)) | 0;
  let clippedUFraction = 0;
  if (offTop) {
    const uAdvance = sourceVectorClipAdvance(differenceU, offTop, fullHeight);
    const vAdvance = sourceVectorClipAdvance(differenceV, offTop, fullHeight);
    clippedUFraction = rendererSignedWord(uAdvance);
    const swappedU = rendererSwapLong(uAdvance);
    const swappedV = rendererSwapLong(vAdvance);
    packed = (packed + ((swappedV & 0xffff0000) |
      ((((swappedV & 63) << 8) & 0xff00) | (swappedU & 63)))) | 0;
  }

  const uStepLong = (sourceDivsWord(differenceU, fullHeight) << 8) | 0;
  const vStepLong = (sourceDivsWord(differenceV, fullHeight) << 8) | 0;
  const textureIncrement = sourceVectorPackedIncrement(uStepLong, vStepLong);
  const brightnessDifference = rendererSignedWord(
    (bottom.gouraudRow || 0) - (top.gouraudRow || 0));
  const brightnessDividend = (brightnessDifference << 8) | 0;
  let brightnessStep = rendererDivsRegister(brightnessDividend, fullHeight);
  brightnessStep = (brightnessStep << 8) | 0;
  brightnessStep = rendererSwapLong(brightnessStep);
  brightnessStep = ((brightnessStep & 0xffff0000) |
    (((brightnessStep & 0xffff) << 8) & 0xffff)) | 0;
  const combinedIncrement = (((uStepLong & 0xffff) << 16) |
    (brightnessStep & 0xffff)) | 0;
  let brightnessCarry = ((brightnessStep & 0xffff0000) | (count & 0xffff)) | 0;
  let loopCounter = brightnessCarry;
  loopCounter = ((loopCounter & 0xffff0000) |
    ((loopCounter - 1) & 0xffff)) | 0;
  let sampleAccumulator = ((clippedUFraction & 0xffff) << 16) |
    (((top.gouraudRow || 0) << 8) & 0xffff);
  sampleAccumulator |= 0;
  let useExtraV = true;
  const samples = [];
  for (let offset = 0; offset < count; offset++) {
    const coordinate = packed & 0x3f3f;
    samples.push({
      y: firstY + offset,
      u: coordinate & 63,
      v: (coordinate >>> 8) & 63,
      gouraudRow: (sampleAccumulator >>> 8) & 0xff,
    });
    const brightnessSum = (brightnessCarry >>> 0) + (loopCounter >>> 0);
    brightnessCarry = brightnessSum | 0;
    if (brightnessSum > 0xffffffff) {
      sampleAccumulator = ((sampleAccumulator & 0xffff0000) |
        ((sampleAccumulator + 0x100) & 0xffff)) | 0;
    }
    const sampleSum = (sampleAccumulator >>> 0) + (combinedIncrement >>> 0);
    sampleAccumulator = sampleSum | 0;
    const addend = useExtraV ? textureIncrement.extraV : textureIncrement.ordinary;
    const packedSum = (packed >>> 0) + (addend >>> 0) +
      (sampleSum > 0xffffffff ? 1 : 0);
    packed = packedSum | 0;
    useExtraV = packedSum > 0xffffffff;
    loopCounter = ((loopCounter & 0xffff0000) |
      ((loopCounter - 1) & 0xffff)) | 0;
  }
  return samples;
}

// PolygonObj:rotobj stores a point-light word from the camera-relative model
// Z component: two ADD.L operations, SWAP, +20, ASR.W #2, then convtoscr
// clamps that word to rows 0..13. Gouraud polygons interpolate these rows.
export function sourceVectorPointBrightness(point, sinWord, cosWord) {
  const x = rendererSignedWord(point.x);
  const z = rendererSignedWord(point.z);
  let rotated = (Math.imul(z, rendererSignedWord(sinWord)) +
    Math.imul(x, rendererSignedWord(cosWord))) | 0;
  rotated = (rotated << 1) | 0;
  rotated = (rotated << 1) | 0;
  const zWord = rendererSignedWord(rotated >> 16);
  return Math.max(0, Math.min(13, rendererSignedWord(zWord + 20) >> 2));
}

export function projectVectorPoint(point, object, camera, modelSin, modelCos,
    cameraSin, cameraCos) {
  // PolygonObj doubles model X/Z before rotation, but model Y is already in
  // the same vertical units used by the 8.8 object-height field.
  const localX = point.x * 2, localZ = point.z * 2;
  const worldX = object.position.x + localX * modelCos - localZ * modelSin;
  const worldZ = object.position.z + localX * modelSin + localZ * modelCos;
  const horizontal = transform(worldX, worldZ, camera, cameraSin, cameraCos, 0);
  return { ...horizontal, y: object.position.y / 2 + point.y };
}

// PolygonObj applies ObjAng-2048-angpos after the midpoint has entered camera
// space. Expressed as a world rotation followed by transform(), this is PI-F.
export function sourceModelAngle(facing) {
  return Math.PI - facing / 8192 * Math.PI * 2;
}

function objectGraphicType(object) {
  return object.render.graphicType ?? INITIALIZED_GRAPHIC_TYPES.get(object.type);
}

function sourceCameraTrig(camera) {
  const angleUnits = Number.isInteger(camera.angleUnits)
    ? camera.angleUnits : radiansToSourceAngle(camera.angle || 0);
  const { sinWord, cosWord } = sourceAngleTrig(angleUnits);
  return {
    angleUnits, sinWord, cosWord,
    sin: sinWord / 32768, cos: cosWord / 32768,
  };
}

function transform(x, z, camera, sin, cos, u) {
  const dx = x - camera.x, dz = z - camera.z;
  return {
    x: dx * cos - dz * sin + (camera.bobbleAcross || 0),
    z: dx * sin + dz * cos,
    u,
  };
}

function sourceViewY(camera) {
  return Number.isFinite(camera.viewY) ? camera.viewY : camera.y;
}

// NEWTWO.s:itsafloordraw lines 4937-4944 converts the command's signed plane
// word to the room's 16.16 height scale with EXT.L/ASL.L #6, then rejects it
// below TOPOFROOM or above BOTOFROOM. DrawDisplay installs the live lower
// roof/floor pair, or the upper room's static pair, immediately before walking
// that command stream. Closed/inverted door slices intentionally reject both
// boundary planes.
export function sourcePlaneWithinRoom(planeY, roomTop, roomBottom) {
  const planeWord = rendererSignedWord(Math.trunc(planeY * 4));
  const planeFixed = (planeWord << 6) | 0;
  return planeFixed >= (roomTop | 0) && planeFixed <= (roomBottom | 0);
}

// NEWTWO.s:itsafloordraw/checkforwater lines 4937-4991 marks the current
// room for the post-display water pass when its water plane lies above the
// room top or above the camera. Equality stores $ff (the half-screen case),
// while the other submerged cases store $0f (the full-screen case).
export function sourceWaterFillState(
    commandZone, cameraZone, planeY, roomTop, roomBottom, viewY) {
  if (commandZone !== cameraZone) return 0;
  const planeFixed = (rendererSignedWord(Math.trunc(planeY * 4)) << 6) | 0;
  if (planeFixed < (roomTop | 0)) return 0x0f;
  if (planeFixed > (roomBottom | 0)) return 0;
  const viewFixed = Math.trunc(viewY * 256) | 0;
  if (planeFixed < viewFixed) return 0x0f;
  if (planeFixed === viewFixed) return 0xff;
  return 0;
}

// DrawDisplay's `fw/sw/tw` pass (NEWTWO.s lines 3689-3750) runs after the
// held gun. It ANDs every affected direct-RGB12 word with $00ff: $0f clears
// red over all four 20-row bands, while signed $ff clears the lower two.
export function applySourceWaterFill(
    pixels, fillState, sourcePixels = true, display = STANDARD_DISPLAY) {
  const signedState = rendererSignedWord(fillState << 8) >> 8;
  if (!signedState) return;
  const firstSourceRow = signedState > 0 ? 0 : 40;
  if (sourcePixels) {
    for (let y = firstSourceRow; y < 80; y++) {
      for (let x = 0; x < 96; x++) {
        pixels[((y * 2) * WIDTH + VIEW_LEFT + x * 2) * 4] = 0;
      }
    }
    return;
  }
  const firstRow = Math.floor(firstSourceRow / 80 * display.viewHeight);
  for (let y = firstRow; y < display.viewHeight; y++) {
    for (let x = display.viewLeft; x < display.viewLeft + display.viewWidth; x++) {
      pixels[(y * display.width + x) * 4] = 0;
    }
  }
}

// NEWTWO.s:itsafloordraw lines 4951-5029 clips a plane at the depth where
// that plane reaches the current top/bottom viewport row. The limit therefore
// depends on plane height; there is no constant geometric near plane.
export function sourcePlaneProjection(type, planeY, camera, topClip = 0, bottomClip = 79) {
  if (type === 'chunky-floor' || type === 'chunky-roof') topClip -= 12;
  const planeWord = rendererSignedWord(Math.trunc(planeY * 4));
  const viewWord = rendererSignedWord(Math.floor(sourceViewY(camera)) * 4);
  const verticalWord = rendererSignedWord(planeWord - viewWord);
  if (!verticalWord) return null;
  // itswater enters itsafloordraw with d0=3, enabling both BTST #0 (floor)
  // and BTST #1 (roof). Its side is therefore selected solely by the signed
  // plane/view delta; the dedicated floor and roof commands enable one bit.
  const roof = type === 'water' ? verticalWord < 0 : ROOF_PLANE_TYPES.has(type);
  if ((verticalWord < 0) !== roof) return null;
  const visibleRows = roof ? 40 - topClip : bottomClip - 40;
  if (visibleRows <= 0) return null;
  // NEWTWO.s:itsafloordraw:aboveplayer uses NEG.W before the shared `below`
  // path. In particular, $8000 remains negative and the following MULS uses
  // that signed word. DIVS overflow leaves the destination register unchanged;
  // sourceDivsWord therefore must handle the quotient rather than wrapping a
  // JavaScript division after the fact.
  const distanceWord = roof ? rendererSignedWord(-verticalWord) : verticalWord;
  return {
    verticalWord,
    // alienbreed3d2_CPORT/ab3d/newtwo.s:itsafloordraw stores the signed
    // plane/view delta in d6, then `muls #64,d6` before `divs d7,d6` and
    // copying the quotient to minz. Omitting that MULS admitted near-camera
    // plane edges which the retail raster clips at the viewport boundary.
    minimumDepth: sourceDivsWord(Math.imul(distanceWord, 64), visibleRows),
    roof,
    topClip,
    bottomClip,
  };
}

export function enhancedPlaneMinimumDepth(projection, display = ENHANCED_DISPLAY) {
  const edgeDistance = projection.roof
    ? display.horizonY - .5
    : display.viewHeight - .5 - display.horizonY;
  if (!(edgeDistance > 0)) return Number.POSITIVE_INFINITY;
  const distanceWord = Math.abs(rendererSignedWord(projection.verticalWord));
  return distanceWord * 64 * display.pixelScale / edgeDistance;
}

function sourcePlaneProjectedEndpoint(point, projection, boundary = false) {
  const distanceWord = projection.roof
    ? rendererSignedWord(-projection.verticalWord)
    : projection.verticalWord;
  return {
    x: rendererSignedWord(sourceDivsWord(point.x, point.z) + 47),
    y: boundary
      ? (projection.roof ? 40 - projection.topClip : projection.bottomClip - 40)
      : sourceDivsWord(Math.imul(distanceWord, 64), point.z),
    brightness: rendererSignedWord(point.brightness || 0),
  };
}

function sourcePlaneClippedEdge(first, second, projection) {
  const minimumDepth = rendererSignedWord(projection.minimumDepth);
  const firstInside = rendererSignedWord(first.z) > minimumDepth;
  const secondInside = rendererSignedWord(second.z) > minimumDepth;
  if (!firstInside && !secondInside) return null;
  if (firstInside && secondInside) {
    return [sourcePlaneProjectedEndpoint(first, projection),
      sourcePlaneProjectedEndpoint(second, projection)];
  }
  const front = firstInside ? first : second;
  const behind = firstInside ? second : first;
  // itsafloordraw:sideloop lines 5050-5115 first reduces the 25.7 side
  // difference to a signed word, then performs MULS/DIVS and restores seven
  // fractional bits at minz. The clipped endpoint's Y is bottomline rather
  // than a second division of the truncated minz.
  const deltaX = rendererSignedWord(((behind.x - front.x) | 0) >> 7);
  const deltaZ = rendererSignedWord(behind.z - front.z);
  const toMinimum = rendererSignedWord(minimumDepth - front.z);
  const quotient = sourceDivsWord(Math.imul(deltaX, toMinimum), deltaZ);
  const clipped = {
    x: (front.x + (rendererSignedWord(quotient) << 7)) | 0,
    z: minimumDepth,
    brightness: rendererSignedWord(rendererSignedWord(front.brightness || 0) +
      sourceDivsWord(Math.imul(rendererSignedWord(
        (behind.brightness || 0) - (front.brightness || 0)), toMinimum), deltaZ)),
  };
  const projectedFront = sourcePlaneProjectedEndpoint(front, projection);
  const projectedBoundary = sourcePlaneProjectedEndpoint(clipped, projection, true);
  return firstInside
    ? [projectedFront, projectedBoundary]
    : [projectedBoundary, projectedFront];
}

function sourcePlaneBrightnessStep(first, second, height) {
  let difference = rendererSignedWord(second - first) | 0;
  difference = ((difference & 0xffff0000) | ((difference << 8) & 0xffff)) | 0;
  difference = ((difference & 0xffff0000) | ((difference << 3) & 0xffff)) | 0;
  return (sourceDivsWord(difference, height) << 5) | 0;
}

export function sourcePlaneRasterEdge(table, brightnessTable, side, first, second) {
  let x0 = rendererSignedWord(first.x), y0 = rendererSignedWord(first.y);
  let x1 = rendererSignedWord(second.x), y1 = rendererSignedWord(second.y);
  let brightness0 = rendererSignedWord(first.brightness || 0);
  let brightness1 = rendererSignedWord(second.brightness || 0);
  if (y0 === y1) return null;
  if (y1 < y0) {
    [x0, x1] = [x1, x0];
    [y0, y1] = [y1, y0];
    [brightness0, brightness1] = [brightness1, brightness0];
  }
  const dy = rendererSignedWord(y1 - y0);
  let dx = rendererSignedWord(x1 - x0);
  const increasing = dx >= 0;
  // NEWTWO.s:itsafloordraw/goursides `.linegoingleft` uses NEG.W before
  // EXT.L/DIVS.  NEG.W $8000 remains $8000 (negative) on the 68000; using
  // JavaScript Math.abs would turn that one source value into +32768 and
  // select a different edge DDA.
  if (!increasing) dx = rendererSignedWord(-dx);
  const division = rendererDivsRegister(dx, dy);
  const quotient = rendererSignedWord(division);
  const remainder = rendererSignedWord(division >> 16);
  const largeStep = rendererSignedWord(quotient + 1);
  let error = dy;
  let x = x0;
  let brightness = (brightness0 << 16) | 0;
  const brightnessStep = sourcePlaneBrightnessStep(brightness0, brightness1, dy);

  if (side === 'left') x = rendererSignedWord(x - 1);
  for (let y = y0; y < y1; y++) {
    const update = () => {
      error = rendererSignedWord(error - remainder);
      const large = error < 0;
      if (large) error = rendererSignedWord(error + dy);
      const amount = large ? largeStep : quotient;
      x = rendererSignedWord(x + (increasing ? amount : -amount));
    };
    // The four loops in itsafloordraw use different store/update order. These
    // are its exact left/right top-edge ownership rules, not a generic scanline
    // intersection convention.
    const updateBeforeStore = (side === 'right' && increasing) ||
      (side === 'left' && !increasing);
    if (updateBeforeStore) update();
    table.set(y, x);
    brightnessTable.set(y, rendererSignedWord(brightness >> 16));
    brightness = (brightness + brightnessStep) | 0;
    if (!updateBeforeStore) update();
  }
  return { top: y0, bottom: y1 };
}

// NEWTWO.s:itsafloordraw sideloop through dofloor (lines 5030-6002) builds
// signed-word leftsidetab/rightsidetab entries by projected distance from the
// horizon. pastsides places a6 at frompt+41*104*4 for floors and one record
// earlier for roofs. The packaged retail AGA capture establishes that a
// Copper record's offset from frompt is also its visual source row: backfile
// row zero, written after ADD #104*4, appears on visual row one. Floors thus
// start at visual row 41 and roofs at row 40.
// rightsidetab is made exclusive with ADDQ #1 before the room clip is applied.
export function sourcePlaneRasterSpans(
    cameraPolygon, projection, leftClip = 0, rightClip = 96) {
  const leftTable = new Map();
  const rightTable = new Map();
  const leftBrightnessTable = new Map();
  const rightBrightnessTable = new Map();
  // itsafloordraw:cornerprocessloop lines 5043-5071 selects the clipped
  // scanline routine if any original corner is behind the camera or lies on
  // or beyond either room-clip boundary. This flag is polygon-wide; it is not
  // inferred from whether one particular output row was shortened.
  const clippedPath = cameraPolygon.some(point => {
    if (rendererSignedWord(point.z) <= 0) return true;
    const x = rendererSignedWord(sourceDivsWord(point.x, point.z) + 47);
    return x <= leftClip || x >= rightClip;
  });
  let top = 80, bottom = -1;
  for (let index = 0; index < cameraPolygon.length; index++) {
    const edge = sourcePlaneClippedEdge(
      cameraPolygon[index], cameraPolygon[(index + 1) % cameraPolygon.length], projection);
    if (!edge || edge[0].y === edge[1].y) continue;
    const side = edge[1].y > edge[0].y ? 'right' : 'left';
    const range = sourcePlaneRasterEdge(
      side === 'right' ? rightTable : leftTable,
      side === 'right' ? rightBrightnessTable : leftBrightnessTable,
      side, edge[0], edge[1]);
    if (!range) continue;
    top = Math.min(top, range.top);
    bottom = Math.max(bottom, range.bottom);
  }
  if (bottom <= top) return [];
  // pastscale initializes disttobot from the pre-vertical-clip top, then the
  // dofloor loops decrement it once for every retained scan row.
  const sourceTopBeforeVerticalClip = top;

  if (projection.roof) {
    const nearLimit = 40 - projection.topClip;
    const farLimit = 40 - projection.bottomClip;
    if (top >= nearLimit || bottom < farLimit) return [];
    if (top < farLimit) top = farLimit;
    if (bottom >= nearLimit) bottom = nearLimit;
  } else {
    const farLimit = projection.topClip - 40;
    const nearLimit = projection.bottomClip - 40;
    if (top >= nearLimit || bottom <= farLimit) return [];
    if (top < farLimit) top = farLimit;
    if (bottom >= nearLimit) bottom = nearLimit;
  }
  if (bottom <= top) return [];

  let divisor = top || 1;
  const spans = [];
  for (let distance = top; distance < bottom; distance++, divisor++) {
    const storedLeft = leftTable.get(distance);
    const storedRight = rightTable.get(distance);
    if (storedLeft === undefined || storedRight === undefined) continue;
    const left = Math.max(leftClip, storedLeft);
    const right = Math.min(rightClip, rendererSignedWord(storedRight + 1));
    if (right <= left) continue;
    spans.push({
      distance, divisor, left, right,
      y: projection.roof ? 40 - distance : 41 + distance,
      distanceToBottom: rendererSignedWord(
        39 - sourceTopBeforeVerticalClip - (distance - top)),
      leftBrightness: leftBrightnessTable.get(distance) ?? 0,
      rightBrightness: rightBrightnessTable.get(distance) ?? 0,
      sourceWidth: rendererSignedWord(storedRight - storedLeft + 1),
      brightnessSkip: left > storedLeft
        ? rendererSignedWord(left - 1 - storedLeft) : 0,
      clippedPath,
    });
  }
  return spans;
}

export function sourceScaleFloorLong(value, scale) {
  // NEWTWO.s:FloorLine scaleprog lines 6481-6491 uses register-count ASR.L /
  // ASL.L. A 68020 masks that count to six bits; counts 32..63 saturate the
  // long instead of wrapping through JavaScript's five-bit shift count.
  const signedScale = rendererSignedWord(scale);
  const amount = Math.abs(signedScale) & 63;
  if (!amount) return value | 0;
  if (amount >= 32) return signedScale > 0 ? 0 : ((value | 0) < 0 ? -1 : 0);
  return signedScale > 0 ? (value << amount) | 0 : value >> amount;
}

// NEWTWO.s:FloorLine/pastfloorbright (lines 6360-6767) constructs packed
// 6-bit U/V coordinates from signed MULS results. X fraction is kept in a
// separate word; its ADD.W carry feeds ADDX.L, whose long carry selects either
// the ordinary packed increment or the same increment plus one V unit.
export function sourceFloorLineSamples(
    sourceDistance, sinWord, cosWord, scale, xOffset, zOffset, left, count,
    packedWordOffset = 0) {
  let xAcross = Math.imul(rendererSignedWord(sourceDistance), rendererSignedWord(cosWord)) | 0;
  let zAcross = (-Math.imul(
    rendererSignedWord(sourceDistance), rendererSignedWord(sinWord))) | 0;
  xAcross = sourceScaleFloorLong(xAcross, scale);
  zAcross = sourceScaleFloorLong(zAcross, scale);

  let scaledXOffset = sourceScaleFloorLong(
    rendererSignedWord(xOffset) << 16, scale);
  let scaledZOffset = sourceScaleFloorLong(
    rendererSignedWord(zOffset) << 16, scale);
  const threeQuarterX = (((xAcross + (xAcross >> 1)) | 0) >> 1) | 0;
  const threeQuarterZ = (((zAcross + (zAcross >> 1)) | 0) >> 1) | 0;
  let startX = (-(zAcross + threeQuarterX) + scaledXOffset) | 0;
  let startZ = (xAcross - threeQuarterZ + scaledZOffset) | 0;

  const clippedLeft = rendererSignedWord(left);
  if (clippedLeft) {
    startX = (startX + (Math.imul(clippedLeft, xAcross) >> 6)) | 0;
    startZ = (startZ + (Math.imul(clippedLeft, zAcross) >> 6)) | 0;
  }

  let xFraction = startX & 0xffff;
  let coordinates = (((startZ & 0xffff) << 16) |
    ((((startZ >> 8) & 0x3f00) | ((startX >> 16) & 63)) & 0xffff)) >>> 0;
  // NEWTWO.s:texturedwater line 6871 applies wateroff with ADD.W before the
  // FloorLine packed DDA. It must be part of the accumulator because its word
  // carry affects later ADDX.L steps; offsetting only the sampled U would not
  // reproduce the released cadence.
  coordinates = ((coordinates & 0xffff0000) |
    ((coordinates + rendererSignedWord(packedWordOffset)) & 0xffff)) >>> 0;
  const xPixelStep = xAcross >> 6;
  const zPixelStep = zAcross >> 6;
  const xFractionStep = xPixelStep & 0xffff;
  const packedIntegerStep = (((zPixelStep >> 8) & 0x3f00) +
    ((xPixelStep >> 16) & 0xffff)) & 0xffff;
  const ordinaryStep = (((zPixelStep & 0xffff) << 16) | packedIntegerStep) >>> 0;
  const correctedStep = ((ordinaryStep & 0xffff0000) |
    ((ordinaryStep + 0x100) & 0xffff)) >>> 0;
  let useCorrected = false;
  const samples = [];
  for (let offset = 0; offset < Math.max(0, count); offset++) {
    const packed = coordinates & 0x3f3f;
    samples.push({ u: packed & 63, v: (packed >>> 8) & 63,
      packedWord: coordinates & 0xffff });
    const fractionSum = xFraction + xFractionStep;
    const xCarry = fractionSum > 0xffff ? 1 : 0;
    xFraction = fractionSum & 0xffff;
    const step = useCorrected ? correctedStep : ordinaryStep;
    const coordinateSum = coordinates + step + xCarry;
    coordinates = coordinateSum >>> 0;
    // DBcc branches when its named condition is false: DBCC keeps the ordinary
    // path after no carry, while DBCS selects backbefore's +V correction after
    // a carry.
    useCorrected = coordinateSum > 0xffffffff;
  }
  return samples;
}

export function sourceFloorLineTexels(
    sourceDistance, sinWord, cosWord, scale, xOffset, zOffset, left, count) {
  return sourceFloorLineSamples(
    sourceDistance, sinWord, cosWord, scale, xOffset, zOffset, left, count)
    .map(({ u, v }) => ({ u, v }));
}

// NEWTWO.s:texturedwater lines 6886-6918 computes a sine-based vertical read
// displacement, clips it against disttobot, converts it to the 104-long chunky
// row stride, and negates roof reads through `above`. Return its row equivalent
// because the browser framebuffer does not expose the Amiga byte stride.
export function sourceWaterRasterState(
    sourceDistance, tangent, distanceToBottom, roof = false) {
  let phase = rendererSignedWord(sourceDistance);
  phase = rendererSignedWord(phase << 7);
  phase = rendererSignedWord(phase + rendererSignedWord(tangent)) & 8191;
  const sine = sourceAngleTrig(phase).sinWord;
  const divisor = rendererSignedWord(rendererSignedWord(sourceDistance) + 300);
  let displacement = sourceDivsWord(sine, divisor);
  displacement = rendererSignedWord(displacement) >> 6;
  displacement = rendererSignedWord(displacement + 2);
  if (displacement >= rendererSignedWord(distanceToBottom)) {
    displacement = rendererSignedWord(distanceToBottom - 1);
  }
  return {
    phase,
    rowDisplacement: roof ? -displacement : displacement,
  };
}

export function sourcePixelRGB12LowByte(pixels, sourceX, sourceY) {
  // texturedwater reads byte 1 of the RGB12 word already present at the
  // refracted screen position. Source-pixel mode stores that word expanded to
  // a 2x2 RGBA block, whose green/blue nibbles reconstruct the same low byte.
  if (sourceX < 0 || sourceX >= 96 || sourceY < 0 || sourceY >= 80) {
    throw new Error(`source water read outside recovered view: ${sourceX},${sourceY}`);
  }
  const at = ((sourceY * 2) * WIDTH + VIEW_LEFT + sourceX * 2) * 4;
  return ((Math.round(pixels[at + 1] / 17) & 15) << 4) |
    (Math.round(pixels[at + 2] / 17) & 15);
}

export function continuousPixelRGB12LowByte(pixels, x, y, display = STANDARD_DISPLAY) {
  // Browser-only Sharp modes retain texturedwater's same-column framebuffer
  // read while scaling its source-row displacement to the selected viewport.
  const sampleX = Math.max(display.viewLeft,
    Math.min(display.viewLeft + display.viewWidth - 1, Math.trunc(x)));
  const sampleY = Math.max(0, Math.min(display.viewHeight - 1, Math.trunc(y)));
  const at = (sampleY * display.width + sampleX) * 4;
  return ((Math.round(pixels[at + 1] / 17) & 15) << 4) |
    (Math.round(pixels[at + 2] / 17) & 15);
}

export function continuousWaterPackedCoordinate(u, v, waterOffset = 0) {
  // NEWTWO.s:texturedwater line 6871 adds wateroff to FloorLine's packed
  // 6-bit U/V word. Sharp's existing continuous floor projection supplies the
  // higher-resolution U/V position; retain that exact packed-word operation.
  const packed = ((Math.floor(v) & 63) << 8) | (Math.floor(u) & 63);
  return (packed + rendererSignedWord(waterOffset)) & 0xffff;
}

export function continuousWaterRasterState(
    sourceDistance, tangent, outputY, display = STANDARD_DISPLAY, roof = false) {
  // sourcePlaneRasterSpans gives texturedwater disttobot as 80-y for floors
  // and y-1 for roofs. Map the denser browser row back to that 80-row source
  // domain, run the recovered integer sine/DIVS path, then scale only the
  // resulting framebuffer displacement into presentation pixels.
  const sourceY = Math.max(0, Math.min(79,
    Math.floor(outputY / display.pixelScale)));
  const distanceToBoundary = roof
    ? Math.max(1, sourceY - 1)
    : Math.max(1, 80 - sourceY);
  const source = sourceWaterRasterState(
    sourceDistance, tangent, distanceToBoundary, roof);
  return {
    ...source,
    pixelDisplacement: Math.round(source.rowDisplacement * display.pixelScale),
  };
}

// NEWTWO.s:dogourfloor/gouraudfloor (lines 6064-6250, 6767-6820) derives a
// signed horizontal brightness quotient from the complete unclipped span.
// Each texture byte replaces d0.b before ADD.L advances that accumulator; a
// long carry adds one palette row with ADD.W #256. This returns the literal
// d0.w indexes used to address floorscalecols.
export function sourceGouraudFloorPaletteIndices(
    leftRow, rightRow, sourceWidth, brightnessSkip, texels, clippedPath = false) {
  const width = rendererSignedWord(sourceWidth);
  if (width <= 0) return [];
  const rowDifference = rendererSignedWord(rightRow - leftRow);
  let dividend = (rowDifference << 16) | 0;
  let quotient;
  if (clippedPath && dividend <= 0) {
    dividend = (-dividend) | 0;
    quotient = rendererSignedWord(rendererDivsRegister(dividend >> 5, width));
    quotient = rendererSignedWord(-quotient);
  } else {
    quotient = rendererSignedWord(rendererDivsRegister(dividend >> 5, width));
  }

  let accumulator = (rendererSignedWord(leftRow) << 8) | 0;
  if (clippedPath) {
    // d6 is leftclip - 1 - the original left side. MULS uses only the low
    // words; the following ADD/ASR/CLR operations likewise alter d6.w only.
    let adjustment = Math.imul(
      rendererSignedWord(quotient), rendererSignedWord(brightnessSkip)) & 0xffff;
    adjustment = (adjustment + 256 * 8) & 0xffff;
    adjustment = (rendererSignedWord(adjustment) >> 3) & 0xff00;
    accumulator = ((accumulator & 0xffff0000) |
      ((accumulator + adjustment) & 0xffff)) | 0;
  }

  let speed = (rendererSignedWord(quotient) << 5) | 0;
  speed = ((speed << 16) | (speed >>> 16)) | 0;
  speed = ((speed & 0xffff0000) | ((speed << 8) & 0xffff)) | 0;
  const indexes = [];
  for (const texel of texels) {
    accumulator = ((accumulator & 0xffffff00) | (texel & 0xff)) | 0;
    const sum = (accumulator >>> 0) + (speed >>> 0);
    accumulator = sum | 0;
    if (sum > 0xffffffff) {
      accumulator = ((accumulator & 0xffff0000) |
        ((accumulator + 256) & 0xffff)) | 0;
    }
    indexes.push(accumulator & 0xffff);
  }
  return indexes;
}

function clipPlaneAtSourceDepth(behind, front, minimumDepth) {
  // newtwo.s:itsafloordraw sideloop lines 5084-5094/5109-5118 first reduces
  // the 25.7 delta to a signed word, then uses MULS/DIVS and restores the
  // seven fractional bits at minz. Although this helper serves the labelled
  // sharp-port raster, keep the recovered 68000 overflow rule here too.
  const deltaX = rendererSignedWord((((behind.x | 0) - (front.x | 0)) | 0) >> 7);
  const deltaZ = rendererSignedWord(behind.z - front.z);
  const toMinimum = rendererSignedWord(minimumDepth - front.z);
  const quotient = sourceDivsWord(Math.imul(deltaX, toMinimum), deltaZ);
  const amount = (minimumDepth - behind.z) / (front.z - behind.z);
  const result = {
    x: (front.x + (quotient << 7)) | 0,
    z: minimumDepth,
  };
  if (Number.isFinite(behind.brightness) && Number.isFinite(front.brightness)) {
    result.brightness = behind.brightness +
      (front.brightness - behind.brightness) * amount;
  }
  return result;
}

function clipPlaneToSourceDepth(polygon, minimumDepth) {
  const result = [];
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = current.z > minimumDepth;
    const previousInside = previous.z > minimumDepth;
    if (currentInside !== previousInside) {
      result.push(currentInside
        ? clipPlaneAtSourceDepth(previous, current, minimumDepth)
        : clipPlaneAtSourceDepth(current, previous, minimumDepth));
    }
    if (currentInside) result.push(current);
  }
  return result;
}

function triangleArea(a, b, c) {
  return (b.screenX - a.screenX) * (c.screenY - a.screenY) -
    (b.screenY - a.screenY) * (c.screenX - a.screenX);
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function scanlineIntersectionsInto(polygon, y, scratch, withBrightness) {
  const intersections = scratch.x;
  const brightness = scratch.brightness;
  let count = 0;
  for (let index = 0; index < polygon.length; index++) {
    const first = polygon[index];
    const second = polygon[(index + 1) % polygon.length];
    if ((first.y > y) === (second.y > y)) continue;
    const amount = (y - first.y) / (second.y - first.y);
    const x = first.x + (second.x - first.x) * amount;
    const light = withBrightness
      ? first.brightness + (second.brightness - first.brightness) * amount : 0;
    // Stable insertion ordering matches Array.sort's numeric comparator,
    // including retaining edge order for equal X intersections.
    let destination = count;
    while (destination > 0 && intersections[destination - 1] > x) {
      intersections[destination] = intersections[destination - 1];
      if (withBrightness) brightness[destination] = brightness[destination - 1];
      destination--;
    }
    intersections[destination] = x;
    if (withBrightness) brightness[destination] = light;
    count++;
  }
  return count;
}

// ObjDraw stops only on the negative point-number terminator. It filters each
// preceding record solely by GraphicRoom and ObjInTop; ObjT_Type/activity and
// the physical ObjRoom do not participate in display-room selection.
export function objectIsRenderableInZone(object, zoneId) {
  return object.graphicZone === zoneId;
}

// screensetup.s:INITCOPPERSCRN fills both 104x80 Copper lists with longword
// $01fe0000. The $0000 data word is the initial black chunky pixel; subsequent
// display passes alternate the two lists and retain pixels not overwritten by
// that pass. Store only those 96x80 data words here, not the Copper registers.
export function createSourceFramebuffers() {
  return Array.from({ length: 2 }, () => {
    const buffer = new Uint8ClampedArray(SOURCE_VIEW_WIDTH * SOURCE_VIEW_HEIGHT * 4);
    for (let at = 3; at < buffer.length; at += 4) buffer[at] = 255;
    return buffer;
  });
}

export function restoreSourcePlayfield(pixels, buffer) {
  if (buffer.length !== SOURCE_VIEW_WIDTH * SOURCE_VIEW_HEIGHT * 4) {
    throw new RangeError('invalid 96x80 source framebuffer');
  }
  for (let y = 0; y < SOURCE_VIEW_HEIGHT; y++) {
    for (let x = 0; x < SOURCE_VIEW_WIDTH; x++) {
      const source = (y * SOURCE_VIEW_WIDTH + x) * 4;
      const target = ((y * 2) * WIDTH + VIEW_LEFT + x * 2) * 4;
      pixels[target] = buffer[source];
      pixels[target + 1] = buffer[source + 1];
      pixels[target + 2] = buffer[source + 2];
      pixels[target + 3] = 255;
    }
  }
  return pixels;
}

export function captureSourcePlayfield(pixels, buffer) {
  if (buffer.length !== SOURCE_VIEW_WIDTH * SOURCE_VIEW_HEIGHT * 4) {
    throw new RangeError('invalid 96x80 source framebuffer');
  }
  for (let y = 0; y < SOURCE_VIEW_HEIGHT; y++) {
    for (let x = 0; x < SOURCE_VIEW_WIDTH; x++) {
      const source = ((y * 2) * WIDTH + VIEW_LEFT + x * 2) * 4;
      const target = (y * SOURCE_VIEW_WIDTH + x) * 4;
      buffer[target] = pixels[source];
      buffer[target + 1] = pixels[source + 1];
      buffer[target + 2] = pixels[source + 2];
      buffer[target + 3] = 255;
    }
  }
  return buffer;
}

// putinsmallscr builds 80 blocks of 104 Copper instructions, but its cycle-
// raced small display exposes only source rows 0..78 before the panel handoff.
// Rasterizers still write row 79 into the retained Copper buffer; keep that
// internal word intact and suppress it only while expanding the visible image.
// The packaged retail capture `Alien Breed 3D AGA/___SShot.png` independently
// confirms all 96 source pixels on row 79 are COLOR00 while row 78 is visible.
// The cockpit and attached-sprite borders are composed afterwards.
export function expandSourcePixels(pixels, backgroundColourWord = 0) {
  const visibleHeight = (SOURCE_VIEW_HEIGHT - 1) * 2;
  for (let y = 0; y < visibleHeight; y += 2) {
    for (let x = VIEW_LEFT; x < VIEW_LEFT + VIEW_WIDTH; x += 2) {
      const source = (y * WIDTH + x) * 4;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const target = ((y + dy) * WIDTH + x + dx) * 4;
          pixels[target] = pixels[source];
          pixels[target + 1] = pixels[source + 1];
          pixels[target + 2] = pixels[source + 2];
          pixels[target + 3] = pixels[source + 3];
        }
      }
    }
  }
  const background = decodeRGB12(backgroundColourWord);
  for (let y = visibleHeight; y < VIEW_HEIGHT; y++) {
    for (let x = VIEW_LEFT; x < VIEW_LEFT + VIEW_WIDTH; x++) {
      const target = (y * WIDTH + x) * 4;
      pixels[target] = background[0]; pixels[target + 1] = background[1];
      pixels[target + 2] = background[2]; pixels[target + 3] = 255;
    }
  }
  return pixels;
}

export function clearImage(pixels, colourWord = 0) {
  const colour = decodeRGB12(colourWord);
  // ImageData is a tightly packed RGBA byte buffer. Filling an aligned word
  // view writes precisely the same bytes as the scalar loop and avoids four
  // JavaScript stores for every pixel in the larger browser-only framebuffers.
  if ((pixels.byteOffset & 3) === 0 && (pixels.byteLength & 3) === 0) {
    new Uint32Array(pixels.buffer, pixels.byteOffset, pixels.byteLength / 4)
      .fill(packedRgba(colour[0], colour[1], colour[2]));
    return;
  }
  for (let at = 0; at < pixels.length; at += 4) {
    pixels[at] = colour[0]; pixels[at + 1] = colour[1]; pixels[at + 2] = colour[2];
    pixels[at + 3] = 255;
  }
}

// newtwo.s:bigfield lines 8931-8935 installs hitcol/hitcol2 as Copper
// COLOR00 writes. They colour the display background where planar cockpit or
// attached sprites are transparent; they never write the direct RGB12 words
// at `frompt` consumed by the 96x80 chunky renderer. Keep the browser's
// deterministic playfield initialization black so a damage flash cannot turn
// a raster-coverage defect into a red/white polygon seam.
export function clearSourcePlayfield(pixels, display = STANDARD_DISPLAY) {
  for (let y = 0; y < display.viewHeight; y++) {
    const first = (y * display.width + display.viewLeft) * 4;
    const last = first + display.viewWidth * 4;
    for (let at = first; at < last; at += 4) {
      pixels[at] = 0; pixels[at + 1] = 0; pixels[at + 2] = 0;
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}
