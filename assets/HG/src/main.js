// Hired Guns -- entry point.
// Loads the extracted assets, wires up input, and drives the four player views.

import {
	buildDrawList, PANE_ORIGINS, VIEW_X, VIEW_Y, VIEW_W, VIEW_H, SCREEN_W, SCREEN_H,
	MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT, LEVEL_CELLS, DIRECTIONS, cellIndex, hasSky,
	PANE_W, PANE_H,
	SKY_GRADIENT_ROWS, SKY_GRADIENT_BASE,
	horizonSpans, HORIZON_H, HORIZON_FAR_COLOUR, HORIZON_NEAR_COLOUR, HORIZON_FAR_BASE,
	planetSpans, PLANET_COLOUR, PLANET_GRADIENT_BASE, PLANET_H,
	LIGHT_OFFSET, FIELD_COLOUR_BASE, FIELD_COLOUR_ROWS, FIELD_COLOUR_PERIOD,
} from './view.js';
import { Renderer2D } from './renderer2d.js';
import { RendererWebGPU } from './renderer-webgpu.js';
import {
	createWaterState, initialiseWater, moveWater,
	createLightningState, stepLightning, lightningActive,
} from './worldfx.js';
import {
	move, MOVE, putHeadInMap, removeHeadFromMap, teleport, boost, BLOCK,
} from './movement.js';
import { createDoorState, moveDoors, triggerDoor } from './doors.js';
import { stuffFalls, createFallState, createFallClock } from './falling.js';
import { createLiftState, moveLifts, liftCarryingPlayer, LIFT } from './lifts.js';
import { createButtonState, checkPad, activatePanel, stepButtons } from './buttons.js';
import { createPushableState, pushRow, pullBlock, canPullBlock, blocksFall } from './pushables.js';
import { pickGadget, ACTION as GADGET, WINDOW } from './gadgets.js';
import {
	createMonsterState, initialiseMonsterHatches, hatchEggs, moveMonsters,
	activeMonsters, stampMonsters, monstersFall, clearNoMonster, damageMonsterAtCell,
	damageMonsterFitness, monsterAtCell, forceHatchEggAt, placePendingCorpse,
} from './monsters.js';
import { mapMonsterNumbers, patchStyleMonsters } from './monster-graphics.js';
import {
	createInventory, refreshInventory, scrollInventory, takeOrSwapSelected,
	storeHeldItem, clearNewItems, pickUpIntoInventory, pickUpToHand, stockInventory,
	dropHeldItem, dropSelectedItem, reloadHeldItem, heldReloadState,
	hasLooseItem, peekLooseItem, hasItem,
	itemMeta, itemName, itemFooterLines, carryingItem, removeCarriedItem, removeStoreItem,
	skeletonUnderfootAux,
	CATEGORY, damageInventory, damageInventoryByWater,
} from './inventory.js';
import {
	createCombatState, moveFireballs, addFireball, addDirectionalFireballs,
	addGrenade, fireWeaponAtTarget, traceWeaponTarget,
	triggerMine,
	EXPL_DECAY, EXPL_NO_DECAY, EXPL_VANISH,
} from './combat.js';
import {
	createSentryState, addSentry, moveSentries, sentriesFall,
	takeOverSentry, sentryAtCell,
	damageSentryAtCell, clearSentryAtCell, activeSentries,
} from './sentries.js';
import { COMPLETION, evaluateMissionCompletion } from './completion.js';
import {
	createTeamState, createPath, layPath, setLeader, setTeam, clearLeaderIf,
	followLeader,
} from './team.js';
import { createAudio } from './audio.js';
import {
	createMessageState, checkTextTriggers, stepMessages, activeMessageText,
	createChatterState, stepChatter, randomFromBank, fitnessBand,
	BANK_FITNESS, pushMessage, renderMessage,
} from './messages.js';
import {
	SHELL, createShell, paintShell, handleShellKey, handleShellClick,
	hoverWorld, clearWorldHover,
	startWorldDrag, moveWorldDrag, endWorldDrag, enterWorld, completeMission,
	SHELL_W, SHELL_H, faceScrolling,
	refreshActionList,
} from './shell.js';
import { loadFont } from './frontfont.js';
import { IndexCompositor } from './compositor.js';
import {
	isCustomKey, loadCustomMap, listCustomMaps,
	exportCustomMap, importCustomMap, bundleName, BUNDLE_EXT,
} from './editor/store.js';
import { createMapDoc, cellIndex as editorCellIndex, cellOfIndex } from './editor/mapdoc.js';
import { playIntro, resetIntro } from './intro.js';
import { showDeathScreen, showOutro, previewEndScreen } from './endscreens.js';
import { showBriefing } from './briefing.js';
import { fittedGameScale } from './layout.js';
import { initCrt, setCrtScale, setCrt, crtEnabled } from './crt.js';
import {
	createShakeState, startShake, stepShake, shakeActive,
	SHAKE_BLOCK_LANDS, SHAKE_EXPLOSION, SHAKE_GRENADE,
} from './shake.js';
import { rebuildDerived, illuminate, isLightFixture } from './editor/derived.js';
import {
	triggerAt, triggerCells, addTrigger, removeTrigger, setTriggerMessage,
	decomposeText, poolUsage, checkMessages, SPEAKERS, TRIGGER_LIMIT, POOL_BYTES,
} from './editor/messages.js';
import {
	rectCells, floodCells, forRegion, copyRegion, pasteRegion, describeClip,
	REGION_LIMIT,
} from './editor/bulk.js';
import {
	loadTiles, drawFloor, cellAt, MARKER_LEGEND, TILE as EDITOR_TILE,
	VIEW_W as EDITOR_VIEW_W, VIEW_H as EDITOR_VIEW_H, MAP_HEIGHT as EDITOR_MAP_HEIGHT,
} from './editor/view2d.js';
import {
	createHistory, beginGroup, editCell, undo as editUndo, redo as editRedo,
	canUndo, canRedo, clearCells, TOOLS, FLAGS, getFlag, setFlag, snapshotTable,
} from './editor/edit.js';
import { serializeMapDoc, validateMapDoc } from './editor/mapdoc.js';
import {
	loadPack, decodeEntry, assignPanel, assignHorizon, setCellPanel,
	PANEL_SLOTS, PANEL_SLOTS_ADDRESSABLE, HORIZON_FACINGS,
} from './editor/packs.js';
import {
	structuresAt, buttonAt, addDoor, addLift, addButton, removeStructureAt,
	danglingStructures, cellOfPosn, itemAt, placeItem, removeItem, addMonster,
	ACTION_LIST, ACTION_NAMES, actionTarget, decodeTarget, setButtonAction,
	describeButton, teleportTargetAt, setTeleportTarget, boostAmountAt, setBoostAmount,
	eggAt, placeEgg, removeEgg, padAt, addPad, padBlocker,
	setButtonSound, buttonSound, EGG_RANDOM, EGG_NEVER, EGG_DORMANT,
	CORPSE_KINDS, placeCorpse, corpseAt, wallPanelAt, removeWallPanel,
	AUX_DEAD_SET1, eggDirectionAt, setEggDirection, clearCell,
	addPushable, removePushable, pushableAt, PUSH_BLOCKS, LIMITS,
} from './editor/structures.js';
import {
	MAP_FIELDS, getMapField, setMapField, checkMapProps, mapTitle,
} from './editor/mapprops.js';
import { getField, hasField, FIELD_NAMES } from './editor/edit.js';
import { TILE_STRIDE, TILE_UNDER_STONE, TILE_OPAQUE } from './editor/tileindex.js';
import { saveCustomMap, customKey } from './editor/store.js';
import {
	snapshotGame, applyGameSnapshot, applyCampaign, writeSlot, readSlot,
} from './save.js';

// PAL vblank. xcr_counters (ColdStartup.s:809) bumps every world timer once
// per interrupt at this rate, which is what actually paces doors, water,
// lifts and falling.
const VBLANK_MS = 1000 / 50;
const MAX_CATCHUP_MS = 250;

const ASSETS = 'assets/';
const ASSET_RETRY_DELAYS_MS = [250, 1000];

const $ = (id) => document.getElementById(id);
// The bar holds the message to one line so it cannot push the page around, so
// the full text goes on the tooltip for the few that are long enough to clip.
const status = (msg) => {
	const el = $('status');
	el.textContent = msg;
	el.title = msg;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch a generated asset. The first request uses ordinary browser caching;
 * retries bypass it so a CDN's cached deployment-time 404 cannot permanently
 * disable an optional game subsystem for this page load.
 *
 * A 404 is normally permanent, but some static hosts briefly return one while
 * a multi-file deploy is propagating. Retrying only twice keeps genuine missing
 * files obvious without making startup meaningfully slower.
 */
async function fetchAsset(p) {
	const url = ASSETS + p;
	let lastError = null;
	for (let attempt = 0; attempt <= ASSET_RETRY_DELAYS_MS.length; attempt++) {
		try {
			const retry = attempt > 0;
			const requestUrl = retry
				? `${url}${url.includes('?') ? '&' : '?'}retry=${Date.now()}-${attempt}`
				: url;
			const r = await fetch(requestUrl, retry ? { cache: 'no-store' } : undefined);
			if (r.ok) return r;
			lastError = new Error(`${p}: HTTP ${r.status} ${r.statusText}`);
			// A true 404 is not normally transient, but deployment propagation can
			// make it transient. Other 4xx errors are configuration/auth failures.
			if (r.status >= 400 && r.status < 500 && r.status !== 404 && r.status !== 408 && r.status !== 429) break;
		} catch (error) {
			lastError = error;
		}
		if (attempt < ASSET_RETRY_DELAYS_MS.length) {
			console.warn(`[hiredguns] asset request failed; retrying ${p} (${attempt + 1}/${ASSET_RETRY_DELAYS_MS.length})`, lastError);
			await sleep(ASSET_RETRY_DELAYS_MS[attempt]);
		}
	}
	console.error(`[hiredguns] asset unavailable after retries: ${p}`, lastError);
	throw lastError || new Error(`${p}: request failed`);
}

async function loadJSON(p) {
	return (await fetchAsset(p)).json();
}
async function loadBytes(p) {
	return new Uint8Array(await (await fetchAsset(p)).arrayBuffer());
}

const game = {
	tables: null,
	style: null,
	atlas: null,
	windows: null,
	windowAtlas: null,
	itemDefs: null,
	itemImages: null,
	itemAtlas: null,
	characterPortraits: null,
	characterPortraitAtlas: null,
	miscUi: null,
	miscAtlas: null,
	fireEffects: null,
	fireEffectsAtlas: null,
	shake: createShakeState(),
	shakeScale: 1,
	dtsMapblocks: null,
	dtsMapblockAtlas: null,
	dtsStaticTick: 0,
	monsterDefs: null,
	monsterGraphics: null,
	monsterAtlas: null,
	exgfx: null,
	exgfxAtlas: null,
	skeleton: null,
	skeletonAtlas: null,
	combatState: null,
	sentryState: null,
	monsterState: null,
	monsterKey: '',
	audio: createAudio(),
	audioBack: '',
	shell: createShell(),
	campaign: null,
	// Development aids (map jump, R/F floor cheat). Off by default, remembered
	// across sessions so it does not need re-ticking every reload.
	debug: false,
	// Invulnerability + infinite carry + every item (see setCheat).
	cheat: false,
	// Inventory and mutable stats the party takes from one map to the next.
	// null = start from each character's own kit (see capturePartyCarry).
	partyCarry: null,
	drownCount: 0,
	baseStyle: null,
	baseAtlas: null,
	font: null,
	cursors: null,
	cursorEl: null,
	cursorSprite: -1,
	map: null,
	cells: null,
	players: [],
	nukesArmed: 0,
	exitWinner: null,
	mission: null,
	renderer: null,
	dirty: true,
	fieldPosn: 0,
	hasVisibleField: false,
};

// The CD32 screen palette, resolved from Sources/CopperLists/GameCD32.s.
//
// One `C_BANK 32` block emits colour00-31, i.e. screen indices 32-63, through
// the COL1/COL2 macro pair -- a contrast and haze lift of an authored 16-colour
// set, split across two LOCT passes:
//
//   v = nibble << 4;  v = v*30/contrast;  v = v + haze
//   COL1 emits v>>4 (clamped to 15), COL2 emits v&15  ->  gun = (hi<<4)|lo
//   contrast = 22/24/26 (r/g/b)      haze = 40/50/55
//
// Verified: that reproduces all 31 baked values in the compiled list exactly.
//
// Banks 0 and 1 are placeholders in the compiled list (`views_palette`), patched
// at screen-on from game_palette (Main.s:7389) -- the SAME source nibbles, plain
// rather than lifted. So the four banks are one palette in two brightnesses and
// two tints:
//
//   0-15   plain block palette (unlit)     32-47  COL1 lift of it   (lit)
//   16-31  plain water tint   (unlit)      48-63  COL1 lift of that (lit)
//
// Lighting is therefore the haze-and-contrast lift, not colour versus black: a
// shadowed wall keeps its hue and goes flat and dark. keep_light lives on OPEN
// cells, and a wall face is lit by the mask the open cell in FRONT of it emits.
//
// That also explains the earlier failed attempt to map the art onto 32+i -- it
// applied the lift to colours that were already lifted, hence "1.5-2x too
// bright". The lift is right; it just belongs to the lit bank alone.
//
// build-palette.js resolves all of this by replaying the copper list to the
// view's own raster line, seeded with game_palette. It matters that it is a
// replay: col_wait1 fires at line 50, INSIDE the view, and overrides eight of
// the patched entries -- notably colour 8, which game_palette leaves at a vivid
// $4f4 that the copper drops to $371 before the views are drawn.
//
// Indices 22, 38 and 54 are the three registers the copper rewrites per raster
// line for the sky gradient; a single entry cannot represent them, so the
// gradient rows below override them.
const HW_BANKS = 64;

/**
 * update_sky (ColdStartup.s:3636) picks the sky ramp with `locn_sky`, then adds
 * 5 ramps while the lightning counter is running -- Sky.s stores 10 skies each
 * for nosky and nosky_planet, the second five being the lit versions. The
 * horizon ramp (scotch_mist) is deliberately NOT offset: the copper adds d0 to
 * a6 before the lightning branch, so the silhouette keeps its normal colours
 * while the sky behind it flares.
 */
function skyRamp(sky, name, skyNum, lit) {
	const t = sky.tables[name];
	if (!t) return null;
	if (lit && t.lightning) return t.lightning[skyNum] || null;
	return (t.normal && t.normal[skyNum]) || null;
}

// First 90 entries of field_cols (ColdStartup.s); the source appends a duplicate
// tail so scroll_field can read consecutive bands without checking wrap.
const FIELD_COLOURS_12BIT = [
	0xf00, 0xf10, 0xf20, 0xf30, 0xf40, 0xf50, 0xf60, 0xf70, 0xf80, 0xf90,
	0xfa0, 0xfb0, 0xfc0, 0xfd0, 0xfe0, 0xff0, 0xef0, 0xdf0, 0xcf0, 0xbf0,
	0xaf0, 0x9f0, 0x8f0, 0x7f0, 0x6f0, 0x5f0, 0x4f0, 0x3f0, 0x2f0, 0x1f0,
	0x0f0, 0x0f1, 0x0f2, 0x0f3, 0x0f4, 0x0f5, 0x0f6, 0x0f7, 0x0f8, 0x0f9,
	0x0fa, 0x0fb, 0x0fc, 0x0fd, 0x0fe, 0x0ff, 0x0ef, 0x0df, 0x0cf, 0x0bf,
	0x0af, 0x09f, 0x08f, 0x07f, 0x06f, 0x05f, 0x04f, 0x03f, 0x02f, 0x01f,
	0x00f, 0x10f, 0x20f, 0x30f, 0x40f, 0x50f, 0x60f, 0x70f, 0x80f, 0x90f,
	0xa0f, 0xb0f, 0xc0f, 0xd0f, 0xe0f, 0xf0f, 0xf0e, 0xf0d, 0xf0c, 0xf0b,
	0xf0a, 0xf09, 0xf08, 0xf07, 0xf06, 0xf05, 0xf04, 0xf03, 0xf02, 0xf01,
];

const FIRE_EFFECT_PALETTES = {
	muzzleBases: [108, 112, 116, 120],
	hit: { base: 124, colours: [[255, 255, 255], [0, 0, 0], [255, 185, 171]] },
	fitness: { base: 208, colours: [[255, 255, 255], [255, 255, 255], [255, 225, 255]] },
};

function amiga12ToRgb(v) {
	return [((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17];
}

function brighten12(v) {
	let r = (v >> 8) & 15, g = (v >> 4) & 15, b = v & 15;
	if (r) r = Math.min(15, r + 3);
	if (g) g = Math.min(15, g + 3);
	if (b) b = Math.min(15, b + 3);
	return (r << 8) | (g << 4) | b;
}

function applyFieldPalette(pal, fieldPosn) {
	const pos = ((fieldPosn | 0) % FIELD_COLOUR_PERIOD + FIELD_COLOUR_PERIOD)
		% FIELD_COLOUR_PERIOD;
	for (let r = 0; r < FIELD_COLOUR_ROWS; r++) {
		pal[FIELD_COLOUR_BASE + r] =
			amiga12ToRgb(FIELD_COLOURS_12BIT[(pos + r) % FIELD_COLOUR_PERIOD]);
	}
}

function applyFireEffectPalette(pal, fireEffects = game.fireEffects) {
	const source = fireEffects?.palettes || FIRE_EFFECT_PALETTES;
	const muzzleBases = source.muzzleBases || FIRE_EFFECT_PALETTES.muzzleBases;
	for (let i = 0; i < muzzleBases.length; i++) {
		const base = muzzleBases[i] | 0;
		const colour = game.players?.[i]?.fireColour | 0;
		pal[base + 1] = [241, 255, 243];
		pal[base + 2] = amiga12ToRgb(brighten12(colour || 0x0b0));
		pal[base + 3] = amiga12ToRgb(colour || 0x0b0);
	}
	for (const rec of [source.hit, source.fitness]) {
		if (!rec) continue;
		const base = rec.base | 0;
		for (let i = 0; i < rec.colours.length; i++) {
			pal[base + i + 1] = rec.colours[i];
		}
	}
}

// ---------------------------------------------------------------------------
// Ambient light range -- AN ADDITION, not something the original had.
//
// The 64 hardware colours are four banks of 16, and which bank a pixel lands in
// is decided by two bitplanes: plane 4 adds 16 (water), plane 5 adds 32 (lit).
// So slot i appears as pal[i] unlit, pal[16+i] unlit under water, pal[32+i] lit
// and pal[48+i] lit under water. The four banks are four brightness levels of
// the same palette -- unlit is not black, it is a darker copy -- and there is no
// lighting calculation anywhere: the shadow IS those darker entries.
//
// Which means the shadow level is not a number to be turned down. Both banks
// are therefore re-derived from the LIT ones: `min` says how much of a colour
// survives into shadow, `max` scales the lit banks. A cave runs min 0 / max 60
// and reads as lit only by its fixtures.
//
// The two do very different amounts of work by area. Unlit is the normal
// appearance of nearly everything, while the lit banks are reached only where a
// light mask lands -- a wall or floor patch beside stone, gated on the cell's
// light bit -- so `max` repaints highlights and `min` repaints the level.
//
// Absent on every shipped map, and absent means untouched -- the copper's own
// banks are used exactly as before.
const AMBIENT_KEEP = new Set([6, 8, 9, 26, 27, 28, 29, 30, 31]);

function applyAmbient(pal, ambient) {
	if (!ambient) return;
	const min = ambient.min === undefined ? null : Math.max(0, Math.min(200, ambient.min | 0));
	const max = ambient.max === undefined ? null : Math.max(0, Math.min(200, ambient.max | 0));
	if (min === null && max === null) return;
	const scale = (c, pct) => [
		Math.max(0, Math.min(255, Math.round(c[0] * pct / 100))),
		Math.max(0, Math.min(255, Math.round(c[1] * pct / 100))),
		Math.max(0, Math.min(255, Math.round(c[2] * pct / 100))),
	];
	for (let i = 0; i < 16; i++) {
		const lit = pal[32 + i], litWater = pal[48 + i];
		// Colours 6, 8, 9 and 26-31 are written by the copper INSIDE the view
		// (C_WAIT 50/53) and are not shadow at all, so they are left alone.
		if (min !== null) {
			if (!AMBIENT_KEEP.has(i)) pal[i] = scale(lit, min);
			if (!AMBIENT_KEEP.has(16 + i)) pal[16 + i] = scale(litWater, min);
		}
		if (max !== null) {
			pal[32 + i] = scale(lit, max);
			pal[48 + i] = scale(litWater, max);
		}
	}
}

function buildScreenPalette(copper, sky, skyNum, lightning, fieldPosn, ambient) {
	const pal = new Array(256).fill(null).map(() => [0, 0, 0]);
	// All 64 hardware indices come from the compiled copper list, snapshotted at
	// the view's own raster line (build-palette.js). Banks 0 and 1 are mostly
	// black -- that IS the shadow -- but not entirely: colours 6, 8 and 9, and
	// 26-31, are filled in at C_WAIT 50/53, inside the view.
	for (let i = 0; i < HW_BANKS; i++) {
		if (copper && copper.colours[i]) pal[i] = copper.colours[i];
	}
	// Before the field and fire overlays, which write their own absolute colours.
	applyAmbient(pal, ambient);
	applyFieldPalette(pal, fieldPosn);
	applyFireEffectPalette(pal);

	// Copper gradient rows. nosky drives the sky band, scotch_mist the horizon
	// silhouette; both are 44-entry ramps selected by locn_sky.
	if (sky) {
		// Register mapping read straight out of the copper list's SET_SKY block:
		// nosky -> 38 (sky band), nosky_planet -> 54 (far), scotch_mist -> 22 (near).
		const bandRamp = skyRamp(sky, 'nosky', skyNum, lightning);
		const farRamp = skyRamp(sky, 'nosky_planet', skyNum, lightning);
		const nearRamp = skyRamp(sky, 'scotch_mist', skyNum, false);
		if (bandRamp) {
			for (let r = 0; r < SKY_GRADIENT_ROWS; r++) {
				pal[SKY_GRADIENT_BASE + r] = bandRamp[r] || pal[38];
			}
		}
		// Far horizon range: colour 22, animated from scotch_mist.
		if (nearRamp) {
			for (let r = 0; r < HORIZON_H; r++) {
				pal[HORIZON_FAR_BASE + r] = nearRamp[10 + r] || pal[HORIZON_FAR_COLOUR];
			}
		}
		// The planet region is the sky re-tinted through nosky_planet.
		if (farRamp) {
			for (let r = 0; r < PLANET_H; r++) {
				pal[PLANET_GRADIENT_BASE + r] = farRamp[r] || pal[PLANET_COLOUR];
			}
		}
		return { pal, hasGradient: !!bandRamp };
	}
	return { pal, hasGradient: false };
}

/** Rebuild the screen palette for the current sky and lightning state. */
// The message band runs its own copper palette for rasters 141-149
// (CopperLists/GameCD32.s:393) -- colours the game's 64 do not contain. The
// renderer's palette is a 256-entry lookup, so the band gets real entries
// rather than muddy approximations. Amiga nibbles expand as (n<<4)|n, the same
// rule the screen palette uses.
//
// Choosing this base needs the whole 256-entry map, because almost none of it is
// free:
//
//   0-63     the four hardware banks
//   64-107   sky gradient          128-169  planet gradient
//   108-123  muzzle flashes        176-207  horizon far range
//   124-126  hit flash             208-210  fitness flash
//   224-244  FIELD colour cycle (view.js FIELD_COLOUR_BASE)
//
// leaving 170-175, 212-223 and 245-255. This has now been wrong three times: at
// 64 it ate seven rows of sky, at 208 it turned the white damage flash blue, and
// at 224 it froze the first six rows of the energy field's cycle. verify-hudflash
// checks it against every one of those ranges, reading the field's out of view.js
// rather than a copy, so a fourth is a test failure rather than a screenshot.
const BAND_PAL_BASE = 248;
const BAND_COLOURS = [
	[0x11, 0x55, 0x66],   // 64  $156  band, rasters 141-142
	[0x11, 0x44, 0x55],   // 65  $145  raster 143
	[0x11, 0x33, 0x44],   // 66  $134  raster 144
	[0x11, 0x22, 0x44],   // 67  $124  rasters 145-149
	[0xaa, 0xaa, 0x33],   // 68  $aa3  text colour 1
	[0xff, 0xff, 0x00],   // 69  $ff0  text colour 2 -- speaker names
	[0xff, 0x44, 0x44],   // 70  $f44  text colour 3
];

function buildPalette() {
	const built = buildScreenPalette(game.copperPalette, game.sky,
		game.skyNum & 7, game.lightningLit, game.fieldPosn, game.ambient);
	game.hasGradient = built.hasGradient;
	const pal = built.pal;
	for (let i = 0; i < BAND_COLOURS.length; i++) pal[BAND_PAL_BASE + i] = BAND_COLOURS[i];
	return pal;
}

async function loadMap(key) {
	status(`loading ${key}...`);
	// A map can arrive three ways, and they differ only in where the four pieces
	// come from:
	//
	//   assets/maps/<key>.json + .cells + .panels + .horizon   the 47 built-ins
	//   the editor's IndexedDB store                           custom/<name>
	//   assets/maps/<key>.hgmap.json                           a BUNDLED map
	//
	// The third is what makes a hand-built level shippable: IndexedDB lives in
	// one browser and cannot travel with a website, so a level meant for a site
	// is exported as a single file, dropped into assets/maps/, and listed in
	// maps.json with a `bundle` path. From here on the three are identical.
	const entry = (game.mapIndex?.maps || []).find((m) => m.key === key);
	let custom = null;
	if (isCustomKey(key)) {
		custom = await loadCustomMap(key);
		if (!custom) throw new Error(`no saved map ${key}`);
	} else if (entry?.bundle) {
		custom = importCustomMap(await (await fetch(ASSETS + entry.bundle)).text());
	}
	const map = custom ? custom.json : await loadJSON(`maps/${key}.json`);
	const raw = custom ? custom.cells : await loadBytes(map.cells.file);
	const words = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
	const n = map.cells.cellsPerLayer;

	if (!game.lightning) game.lightning = createLightningState();
	game.map = map;
	game.horizon = custom ? custom.horizon
		: (map.horizon ? await loadBytes(map.horizon.file) : null);
	game.panels = custom ? custom.panels
		: (map.panels ? await loadBytes(map.panels.file) : null);
	game.horizonSpans = game.horizon
		? [0, 1, 2, 3].map((d) => horizonSpans(game.horizon, d))
		: null;
	if (!game.planet) {
		game.planet = await loadBytes('planet.bin').catch(() => null);
	}
	game.planetSpans = game.planet
		? [0, 1, 2, 3].map((d) => planetSpans(game.planet, d))
		: null;
	game.cells = words.subarray(0, n);
	game.seen = words.subarray(n, n * 2);
	game.items = words.subarray(n * 2, n * 3);
	game.nukesArmed = 0;
	game.exitWinner = null;
	game.mission = { complete: false, type: COMPLETION.NONE };
	game.missionGrace = 50;
	const timeLimit = map.timeLimit | 0;
	game.atTrip1 = Math.floor(timeLimit / 10);
	game.atTrip2 = timeLimit % 10;

	// Style art + palette for this map.
	const styleNum = map.locn.style;
	const monsterNumbers = mapMonsterNumbers(map, game.cells, game.seen, game.monsterDefs);
	const monsterKey = monsterNumbers.join(',');
	if (!game.baseStyle || game.baseStyle.style !== styleNum || game.skyNum !== map.locn.sky ||
			game.monsterKey !== monsterKey) {
		game.skyNum = map.locn.sky;
		// Absent on shipped maps, so the copper's own banks are used unchanged.
		game.ambient = map.ambient || null;
		if (!game.baseStyle || game.baseStyle.style !== styleNum) {
			game.baseStyle = await loadJSON(`style${styleNum}.json`);
			const atlasData = await loadBytes(game.baseStyle.atlas.file);
			game.baseAtlas = {
				width: game.baseStyle.atlas.width,
				height: game.baseStyle.atlas.height,
				data: atlasData,
			};
		}
		const patched = patchStyleMonsters(game.baseStyle, game.baseAtlas,
			game.monsterGraphics, game.monsterAtlas, monsterNumbers);
		game.style = patched.style;
		game.atlas = patched.atlas;
		game.monsterKey = monsterKey;
		game.renderer.setAtlas(game.atlas);
		// The four miscgfx mask sets are style-independent, so load them once.
		// `masks` holds the slot tables the draw list indexes; `overlays` holds
		// the matching coverage bitmaps the compositor samples.
		if (!game.overlays) {
			game.overlays = {};
			game.masks = {};
			for (const [field, file] of [['light', 'lights'], ['water', 'water'],
				['explosions', 'explosions'], ['foam', 'foam']]) {
				const meta = await loadJSON(`${file}.json`).catch(() => null);
				if (!meta) continue;
				game.masks[field] = meta;
				game.overlays[field] = {
					width: meta.atlas.width,
					data: await loadBytes(meta.atlas.file),
				};
			}
			if (game.exgfxAtlas) game.overlays.exgfx = game.exgfxAtlas;
			if (game.skeletonAtlas) game.overlays.skeleton = game.skeletonAtlas;
			if (game.characterPortraitAtlas) game.overlays.players = game.characterPortraitAtlas;
		}
		game.renderer.setOverlays(game.overlays);
		game.renderer.setPalette(buildPalette());
	}

	game.water = createWaterState(map.water);
	initialiseWater(game.water, game.cells, game.seen);
	game.lightning = createLightningState();
	game.lightningLit = false;
	game.doors = createDoorState(map.doors);
	game.lifts = createLiftState(map.lifts);
	game.buttons = createButtonState(map, LEVEL_CELLS);
	game.pushables = createPushableState(map.pushables);
	game.combatState = createCombatState();
	game.sentryState = createSentryState();
	// do_button_action reaches the lift and door tables by INDEX. A lift's cell
	// moves with it, so the tables are addressed by index, never by position.
	const lift = (n) => game.lifts.lifts[n];
	const setLift = (n, dir) => { const l = lift(n); if (l) l.direction = dir; };
	game.world = {
		liftUp: (n) => setLift(n, LIFT.UP),
		liftDown: (n) => setLift(n, LIFT.DOWN),
		liftStop: (n) => setLift(n, LIFT.STOPPED),
		liftToggle: (n) => {
			const l = lift(n);
			if (!l) return;
			if (l.direction === LIFT.UP || l.direction === LIFT.AUTO_UP) l.direction = LIFT.DOWN;
			else if (l.direction === LIFT.DOWN || l.direction === LIFT.AUTO_DOWN) l.direction = LIFT.UP;
			else l.direction = l.height >= l.max ? LIFT.DOWN : LIFT.UP;
		},
		doorTrig: (n, trig) => { const d = game.doors.doors[n]; if (d) d.trig = trig; },
		doorToggle: (n) => {
			const d = game.doors.doors[n];
			if (d) d.trig = d.direction === 1 ? 2 : 1;
		},
		// Editor-authored button sounds (see fireButtonSound). Shipped maps
		// never set a sample, so this is never reached on the campaign.
		playSample: (key) => sfxKey(key, { vary: false }),
	};

	const partyChars = game.partyCharacters || game.characters || [];
	const carry = game.partyCarry || null;
	game.players = map.starts.map((s, i) => {
		const character = partyChars[i] || game.characters?.[i] || null;
		// What this slot walked out of the last map with, if anything.
		const kept = carry?.[i] || null;
		const p = {
			index: i, x: s.x, y: s.y, floor: s.floor, direction: 0, active: true,
			headImages: BLOCK.PLAYER_FIRST + i * 4,
			stats: kept ? { ...kept.stats } : {
				weight: 0,
				physique: character?.physique ?? 100,
				agility: character?.agility ?? 100,
				fitness: character?.fitness ?? 65535,
				experience: character?.experience ?? 0,
				footstepPeriod: character?.footstepPeriod ?? 0,
				gruntPeriod: character?.gruntPeriod ?? 0,
			},
			character,
			inventory: kept ? structuredClone(kept.inventory) : createInventory(character),
			fall: createFallState(),
			windowType: WINDOW.VIEW,
			inTeam: true,
			autoMove: false,
			path: createPath(),
			hasAux: false,
			infoScroll: 0,
			usingGrenade: false,
			throwGrenadeMode: 3,
			activeCount: 0,
			lockCount: 0,
			lockKey: 0,
			usedCount: 0,
			usedKey: 0,
			noAmmoCount: 0,
			noRoomCount: 0,
			blockedCount: 0,
			blocked2Count: 0,
			invalidCount: 0,
			fireWhite: false,
			fireFlashDur: 0,
			fireFlash: 0,
			fitnessFlashDur: 0,
			clawCount: 0,
			bigClawCount: 0,
			clawX: 0,
			bigClawX: 0,
			monsterAttacking: 0,
			fireAnim: 0,
			fireDuration: 0,
			fireFrame: 0,
			fireColour: 0,
			fireX: 0,
			fireY: 0,
			fireDist: 4,
			fireSplat: false,
			fireAccuracy: 0,
			// Cheat: infinite carry capacity for players built after it was set.
			noWeightLimit: !!game.cheat,
			spellShield: 0,
			spellImmune: 0,
			spellWater: 0,
			spellWings: 0,
			spellWeights: 0,
			iconShieldDur: 0,
			iconImmuDur: 0,
			iconWaterDur: 0,
			iconWingsDur: 0,
			iconWeightsDur: 0,
			poisoned: false,
			poisonedStrength: 0,
			poisonedCount: 0,
			poisonedCountStore: 0,
			poisonedTotal: 0,
			underwaterCount: 0,
			drowningCount: 0,
		};
		refreshPlayerFlags(p);
		layPath(p);
		return p;
	});
	// With the cheat on, every map starts you holding everything again.
	if (game.cheat) applyCheatToParty(true);
	if (game.characterPortraitAtlas) {
		game.characterPortraitAtlas.selected = game.players.map((p) =>
			p.character?.character ?? p.index);
	}
	game.team = createTeamState(game.players.length);
	// Main.s:555 -- in-world text triggers, one shot each.
	game.messages = createMessageState(map);
	// push_mesg_rand -- the party's own chatter, off Messages.dat's banks.
	game.chatter = createChatterState(game.messageBanks);
	game.fallClock = createFallClock();
	game.fallHooks = {
		onDamage: (p, amount) => {
			const lost = damagePlayerFitness(p, amount);
			status(`player ${p.index + 1} hit the ground (${lost})`);
			updateHUD();
		},
		onSquash: (_p, cell, type, amount) => {
			if (type === 'monster' && damageMonsterAtCell(game.monsterState, game.cells, cell, amount << 6)) {
				status('monster crushed');
			}
		},
		onLand: (p) => playLandingSfx(p),
		// stuff_falls drops unsupported pushables on the same gate as players,
		// and runs blocks_fall FIRST so a crate is out of the way before anyone
		// lands where it was.
		blocksFall: () => blocksFall(game.cells, game.items, game.pushables, {
			seen: game.seen,
			onPad: (cell, pressed) =>
				checkPad(game.buttons, game.cells, cell, pressed, game.world),
			onBlockLand: (cell) => blockLanded(cell),
		}),
		monstersFall: () => monstersFall(game.monsterState, game.cells, game.items, {
			onSquashPlayer: (_m, cell, amount) => {
				const p = game.players.find((pl) => pl && cellIndex(pl.x, pl.y, pl.floor) === cell);
				if (p) damagePlayerFitness(p, amount);
			},
			onSquashSentry: (_m, cell, amount) => {
				damageSentryAtCell(game.sentryState, game.cells, cell, amount);
			},
		}),
		sentriesFall: () => sentriesFall(game.sentryState, game.cells, {
			onSquashPlayer: (_s, cell, amount) => {
				const p = game.players.find((pl) => pl && cellIndex(pl.x, pl.y, pl.floor) === cell);
				if (p) damagePlayerFitness(p, amount);
			},
			onSquashMonster: (_s, cell, amount) => {
				damageMonsterAtCell(game.monsterState, game.cells, cell, amount);
			},
			onSquashSentry: (_s, cell, amount) => {
				damageSentryAtCell(game.sentryState, game.cells, cell, amount);
			},
		}),
	};
	// put_head_in_map for the whole party, so each view can see the others.
	for (const p of game.players) putHeadInMap(game.cells, p);
	game.monsterState = createMonsterState(map, game.monsterDefs);
	stampMonsters(game.monsterState, game.cells);
	initialiseMonsterHatches(game.monsterState, game.cells, game.seen, game.items);
	game.active = 0;
	game.dirty = true;
	game.audioBack = '';
	if (game.audio?.unlocked) {
		game.audio.setMap(map.locn);
		refreshBackSfx(true);
	}
	status(`${map.locn.legend2.split('~')[0].trim() || key} - style ${styleNum}`);
	updateHUD();
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(src));
		img.src = ASSETS + src;
	});
}

async function loadFrontendArt() {
	const meta = await loadJSON('frontend/frontend.json').catch(() => null);
	if (!meta) return {};
	const art = { meta };
	try { art.front = await loadImage(meta.front.file); } catch (_) { /* optional */ }
	try { art.faces = await loadImage(meta.faces.file); } catch (_) { /* optional */ }
	try { art.world = await loadImage(meta.world.file); } catch (_) { /* optional */ }
	try { art.panel = await loadImage(meta.panel.file); } catch (_) { /* optional */ }
	try { art.smallFaces = await loadImage(meta.smallFaces.file); } catch (_) { /* optional */ }
	// The front end's own faces. Without these the shell falls back to canvas
	// text, which is what made the menus look wrong.
	try { art.fontBig = await loadFont('frontfont'); } catch (_) { /* optional */ }
	try { art.fontSmall = await loadFont('frontsmall'); } catch (_) { /* optional */ }
	try { art.fontWorld = await loadFont('worldfont'); } catch (_) { /* optional */ }
	return art;
}

function englishCharacters() {
	return (game.characters || []).filter((c) => c.language === 'english' || c.language == null)
		.sort((a, b) => (a.character | 0) - (b.character | 0));
}

/**
 * Live party state that survives a map change.
 *
 * Every map load used to rebuild each player from the character definition, so
 * anything picked up -- and any fitness or experience earned -- was thrown away
 * on the way to the next location. The party keeps what it carries, so the
 * inventory and the mutable stats are snapshotted at the end of a map and
 * restored when the next one builds its players.
 *
 * Keyed by party slot, which is how map starts are assigned.
 */
function capturePartyCarry() {
	if (!game.players?.length) return;
	game.partyCarry = game.players.map((p) => (p ? {
		inventory: structuredClone(p.inventory),
		stats: { ...p.stats },
		dead: !!p.dead,
	} : null));
}

/** Drop the carry, so a fresh campaign starts on the characters' own kit. */
function clearPartyCarry() {
	game.partyCarry = null;
}

function setPartyCharacters(indices) {
	const english = englishCharacters();
	const picks = (indices && indices.length === 4) ? indices : [0, 1, 2, 3];
	game.partyCharacters = picks.map((i) => english[i] || english[0] || null);
}

// ---------------------------------------------------------------------------
// Level editor. Phase 2: the top-down map view, read-only. It opens on a copy
// of a shipped map so there is something to look at; painting comes next.

const EDITOR_SCALE = 2;
const editor = {
	doc: null, tiles: null, floor: 11, cursor: null, open: false,
	history: null, tool: TOOLS[0], facing: 0, painting: false, source: '',
	packs: {}, packName: 'panelpack', packIndex: 0,
};

// The panel and horizon library. Entries are shared across the shipped maps --
// 181 panel designs behind 1,297 filled slots, 115 horizons behind 148 -- so the
// editor picks from the library and copies the chosen entry into the map's own
// slots.
// The panel picker's colours are the game's own, not a guess.
//
// A panel is two bitplanes ORed into screen planes 0-1 (Drawviews.s:3345, and
// compositor.js applyPanel), so a pixel of value v lands at bank + v -- and the
// bank is the lit one, 32, when you are stood in front of a sign reading it.
// That makes value 0 the plate showing THROUGH rather than a hole, which
// matters here: the lettering on these panels is knocked out as value 0, so a
// picker that paints it black draws the text in a colour the game never uses.
//
// This was a hand-picked orange ramp, and two things were wrong with it. The
// hues were invented, which is the brown; and its luminance ran 0 < 1 < 2 < 3
// while the real palette runs 0 < 3 < 2 < 1 -- values 1 and 3 swapped. Since 1
// is the highlight and 3 the shadow on every bevel and glyph edge, that shaded
// the art inside out, which is what made small lettering mush together.
const PANEL_BANK = 32;

function packPalette(name) {
	if (name === 'horizonpack') {
		// A horizon is a one-plane silhouette painted in colour 0 over the sky,
		// so drawing it faithfully in a picker would be black on black. These
		// two are a legibility choice, and the only invented colours left here.
		return [[24, 26, 32], [150, 170, 190]];
	}
	const banks = game.copperPalette?.colours;
	// The fallback is the same four colours, in case the picker is built before
	// palette.json has landed.
	if (!banks) return [[40, 50, 55], [249, 246, 244], [242, 230, 202], [170, 150, 128]];
	return [0, 1, 2, 3].map((v) => banks[PANEL_BANK + v]);
}

async function ensurePack(name) {
	if (!editor.packs[name]) editor.packs[name] = await loadPack(name, ASSETS);
	return editor.packs[name];
}

async function buildPackGrid() {
	const grid = $('ed-pack-grid');
	if (!grid) return;
	const pack = await ensurePack(editor.packName);
	const pal = packPalette(editor.packName);
	grid.textContent = '';
	$('ed-pack-info').textContent = `${pack.meta.count} designs`;
	for (let i = 0; i < pack.meta.count; i++) {
		const img = decodeEntry(pack, i);
		const c = document.createElement('canvas');
		c.width = img.width; c.height = img.height;
		// Panels are 48x40 and unreadable at 1:1 on a modern display, which
		// defeats the point of a picker; horizons are already wide. So scale each
		// thumbnail by whatever whole factor brings it up to roughly 96px, and
		// let CSS pixelate it rather than smoothing the art.
		// Panels are legible at 1:1; horizons are wide and short, so they get
		// whatever whole factor brings them to a browsable size.
		const zoom = Math.max(1, Math.round(96 / img.width));
		c.style.width = `${img.width * zoom}px`;
		c.style.height = `${img.height * zoom}px`;
		c.title = `#${i} -- used in ${pack.meta.entries[i].uses} slot(s)`;
		const ctx = c.getContext('2d');
		const data = ctx.createImageData(img.width, img.height);
		for (let p = 0; p < img.pixels.length; p++) {
			const col = pal[img.pixels[p]] || [255, 0, 255];
			data.data[p * 4] = col[0];
			data.data[p * 4 + 1] = col[1];
			data.data[p * 4 + 2] = col[2];
			data.data[p * 4 + 3] = 255;
		}
		ctx.putImageData(data, 0, 0);
		c.dataset.index = String(i);
		c.addEventListener('click', () => {
			editor.packIndex = i;
			selectPackEntry(grid, c);
			$('ed-pack-info').textContent =
				`#${i} -- used in ${pack.meta.entries[i].uses} slot(s)`;
		});
		grid.appendChild(c);
	}
	if (grid.firstElementChild) selectPackEntry(grid, grid.firstElementChild);
	editor.packIndex = 0;
	buildMapSlots();
}

/**
 * Mark the chosen entry. It used to grow to 3x, which was compensating for the
 * panels decoding to noise -- now that they decode correctly a 48x40 sign is
 * legible at its own size, so the border is enough.
 */
function selectPackEntry(grid, chosen) {
	for (const el of grid.children) el.classList.toggle('on', el === chosen);
}

async function assignFromPack() {
	if (!editor.doc) return;
	const pack = await ensurePack(editor.packName);
	const slot = Number($('ed-pack-slot').value) | 0;
	editor.packSlot = slot;
	if (editor.packName === 'horizonpack') {
		const facing = Math.max(0, Math.min(3, slot));
		if (assignHorizon(editor.doc, facing, pack, editor.packIndex)) {
			status(`horizon #${editor.packIndex} -> facing ${facing}`);
			editor.dirty = true;
			invalidateEditorHorizon();
			buildMapSlots();
			drawEditor();
		} else status('horizon unchanged');
		return;
	}
	if (assignPanel(editor.doc, slot, pack, editor.packIndex)) {
		status(`panel #${editor.packIndex} -> slot ${slot}; place it with the Wall panel tool`);
		editor.dirty = true;
		buildMapSlots();
		drawEditor();
	} else status('panel slot unchanged');
}

/**
 * Write the current map out as one file.
 *
 * That file is both the backup and the shippable asset: drop it into
 * assets/maps/ and add a `bundle` line to maps.json and the game loads it like
 * any built-in level. IndexedDB cannot do that job -- it lives in one browser
 * and never leaves it.
 */
function exportEditorMap() {
	if (!editor.doc) return;
	const name = mapTitle(editor.doc) || editor.source || 'map';
	// The derived layers are regenerated on save; do it here too so an exported
	// file is not carrying lighting for geometry it no longer has.
	const rebuilt = rebuildDerived(editor.doc);
	const file = bundleName(name);
	// The manifest key must NOT carry the custom/ prefix: loadMap treats that as
	// "look in IndexedDB", so a shipped map keyed that way would fail to load on
	// a machine that never opened the editor. The file's own slug is the key.
	const key = file.slice(0, -BUNDLE_EXT.length);
	const record = {
		name,
		...serializeMapDoc(editor.doc, key),
	};
	const text = exportCustomMap(record);
	const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = file;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10000);
	const line = `{"key":"${key}","name":"${name}","bundle":"maps/${file}"}`;
	status(`exported ${file} (relit ${rebuilt.lighting}) -- put it in `
		+ `assets/maps/ and add ${line} to maps.json`);
	// The manifest line is the fiddly half, and a status bar is a poor place to
	// copy from.
	console.info(`[hiredguns] add to assets/maps/maps.json:
  ${line}`);
}

/** Read a .hgmap.json back in, into the editor's store. */
async function importEditorMap(file) {
	if (!file) return;
	try {
		const record = importCustomMap(await file.text());
		const key = customKey(record.name || file.name.replace(/\.hgmap\.json$/, ''));
		await saveCustomMap(key, record, record.name);
		await refreshCustomMaps();
		status(`imported "${record.name}" -- playable under Short action game`);
	} catch (err) {
		status(`import failed: ${err.message}`);
	}
}

/**
 * Take in a level file from anyone playing, not just someone editing.
 *
 * The editor's import button is behind the Level Editor, which is the wrong
 * place for a player who was handed a level: they have no reason to open an
 * editor. So the page takes a file from a toolbar button or a drag-and-drop
 * anywhere, saves it, and says where it went -- Short action game already lists
 * saved maps above the built-in ones, so that IS the load-level screen.
 */
async function loadLevelFile(file) {
	if (!file) return;
	try {
		const record = importCustomMap(await file.text());
		const name = record.name || file.name.replace(/\.hgmap\.json$/i, '');
		const key = customKey(name);
		await saveCustomMap(key, record, name);
		await refreshCustomMaps();
		// If the action list is already open, show it immediately.
		if (refreshActionList(game.shell, game.campaign)) {
			game.dirty = true;
			paintShellFrame();
		}
		status(`loaded "${name}" -- pick it under Short action game`);
	} catch (err) {
		status(`that is not a Hired Guns level file (${err.message})`);
	}
}

function bindLevelDrop() {
	const hint = $('drop-hint');
	let depth = 0;
	const show = (on) => hint?.classList.toggle('on', on);
	window.addEventListener('dragenter', (e) => {
		if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
		e.preventDefault();
		depth++;
		show(true);
	});
	window.addEventListener('dragover', (e) => {
		if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault();
	});
	window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; show(false); } });
	window.addEventListener('drop', (e) => {
		if (!e.dataTransfer?.files?.length) return;
		e.preventDefault();
		depth = 0;
		show(false);
		loadLevelFile(e.dataTransfer.files[0]);
	});
	$('load-level')?.addEventListener('click', () => $('load-level-file')?.click());
	$('load-level-file')?.addEventListener('change', (e) => {
		loadLevelFile(e.target.files?.[0]);
		e.target.value = '';
	});
}

/** Re-read the store so the action list picks up a new map. */
async function refreshCustomMaps() {
	try { game.shell.customMaps = await listCustomMaps(); } catch (_) { /* no store */ }
}

async function openEditor(sourceKey = '01-ArtificialIsland') {
	const panel = $('editor');
	if (!panel) return;
	try {
		if (!editor.tiles) editor.tiles = await loadTiles(ASSETS);
		// Load it through the game's own path first. That is what sets up the
		// style atlas, the mask sets, the panels and the screen palette -- all
		// of which the in-engine pane needs, and none of which is worth
		// duplicating here.
		await loadMap(sourceKey);
		const json = await loadJSON(`maps/${sourceKey}.json`);
		const cells = await loadBytes(json.cells.file);
		const panels = json.panels ? await loadBytes(json.panels.file) : null;
		const horizon = json.horizon ? await loadBytes(json.horizon.file) : null;
		editor.doc = createMapDoc(json, cells, panels, horizon);
		editor.history = createHistory();
		editor.floor = editor.doc.meta.starts?.[0]?.floor ?? 11;
		editor.cursor = editor.doc.meta.starts?.[0]
			? { x: editor.doc.meta.starts[0].x, y: editor.doc.meta.starts[0].y }
			: null;
		editor.source = sourceKey;
		editor.open = true;
		buildToolPalette();
		await buildPackGrid();
		buildPlacePickers();
		buildMapProps();
		buildLegend();
		showShell(false);
		$('stage')?.classList.add('hidden');   // the game canvas is not wanted here
		suspendBarModes();
		panel.classList.remove('hidden');
		$('editor-name').textContent = `editing a copy of ${sourceKey}`;
		drawEditor();
		status(`editor: ${sourceKey}`);
	} catch (e) {
		status(`editor: ${e.message}`);
	}
}

function closeEditor() {
	editor.open = false;
	restoreBarModes();
	$('editor')?.classList.add('hidden');
	$('stage')?.classList.remove('hidden');
	showShell(true);
	game.dirty = true;
	paintShellFrame();
}

function drawEditor() {
	const canvas = $('editor-canvas');
	if (!canvas || !editor.doc || !editor.tiles) return;
	canvas.width = EDITOR_VIEW_W * EDITOR_SCALE;
	canvas.height = EDITOR_VIEW_H * EDITOR_SCALE;
	drawFloor(canvas.getContext('2d'), editor.doc.layers.cells, editor.floor, editor.tiles, {
		scale: EDITOR_SCALE,
		ghost: $('ed-ghost')?.checked,
		grid: $('ed-grid')?.checked,
		markers: $('ed-markers')?.checked !== false,
		layer2: editor.doc.layers.seen,
		starts: editor.doc.meta.starts,
		exit: editor.doc.meta.exit,
		triggers: triggerCells(editor.doc),
		cursor: editor.cursor,
		selection: editor.select,
	});
	refreshRegionBar();
	$('ed-floor').textContent = `floor ${editor.floor}`;
	$('ed-undo').disabled = !canUndo(editor.history);
	$('ed-redo').disabled = !canRedo(editor.history);
	// The in-engine pane reads the light bit out of the items layer rather than
	// deriving it, so without this the preview keeps showing the lighting the
	// map had when it was opened. One pass is 23x23x18 cells, which is cheap
	// enough to run on every redraw.
	if ($('ed-autolight')?.checked) illuminate(editor.doc);
	drawEditorPreview();
	refreshInspector();
}

// ---------------------------------------------------------------------------
// Bulk editing.
//
// One selection drives all of it: drag a rectangle out in Select mode, then
// fill it with the current tool, copy it, or clear it. Flood fill needs no
// selection -- it works out its own region from the cell under the cursor.
//
// Filling reuses paintAt rather than reimplementing what each tool does, so a
// bulk edit is exactly the tool the author already picked, applied many times.

/**
 * Start an undo group, unless a bulk edit already opened one.
 *
 * Several tools group their own edits, which is right for a single click but
 * wrong inside a fill: a rectangle painted with the Light tool would otherwise
 * take one undo per cell. So during a bulk edit the tools stop opening groups
 * and everything lands in the one forRegion started.
 */
let bulkDepth = 0;
function editGroup() {
	if (!bulkDepth) beginGroup(editor.history);
}

/**
 * Remember both message tables before a trigger edit.
 *
 * messages.js owns the pool and reflows it, so a single edit can move every
 * offset in the map. Snapshotting the pair is the only way undo covers that;
 * snapshotTable takes one per group, so calling it freely costs nothing.
 */
function snapshotMessages() {
	snapshotTable(editor.history, editor.doc, 'textTriggers');
	snapshotTable(editor.history, editor.doc, 'textMessages');
}

/** Run a bulk edit with tool-level grouping suppressed. */
function asBulk(fn) {
	bulkDepth++;
	try { return fn(); } finally { bulkDepth--; }
}

/** The cells the current selection covers, or just the cursor's cell. */
function selectedCells() {
	if (!editor.doc) return [];
	if (editor.select) return rectCells(editor.select.a, editor.select.b, editor.floor);
	return editor.cursor ? [{ ...editor.cursor, floor: editor.floor }] : [];
}

function fillSelection() {
	const cells = selectedCells();
	if (!cells.length) return status('nothing selected');
	if (editor.tool?.kind === 'info') return status('the Info tool writes nothing');
	const n = asBulk(() => forRegion(editor.history, cells, (x, y) => {
		paintAt({ x, y });
		return true;
	}));
	editor.dirty = true;
	status(`${editor.tool.label} over ${n} cell${n === 1 ? '' : 's'}`);
	drawEditor();
}

function floodSelection() {
	if (!editor.doc || !editor.cursor) return status('put the cursor somewhere first');
	if (editor.tool?.kind === 'info') return status('the Info tool writes nothing');
	const cells = floodCells(editor.doc, editor.cursor.x, editor.cursor.y, editor.floor);
	if (cells.length >= REGION_LIMIT) status('the fill reached the whole floor');
	const n = asBulk(() => forRegion(editor.history, cells, (x, y) => {
		paintAt({ x, y });
		return true;
	}));
	editor.dirty = true;
	status(`${editor.tool.label} flooded ${n} cell${n === 1 ? '' : 's'}`);
	drawEditor();
}

function copySelection() {
	const s = editor.select;
	if (!s) return status('drag a rectangle in Select mode first');
	editor.clip = copyRegion(editor.doc, s.a, s.b, editor.floor);
	status(`copied ${describeClip(editor.clip)}`);
	refreshRegionBar();
}

function pasteClip() {
	if (!editor.clip) return status('nothing copied');
	// The paste lands with its top-left corner where the cursor is, which is
	// also where a selection's corner sits, so copy-then-paste in place is a
	// no-op rather than a surprise.
	const at = editor.select
		? { x: Math.min(editor.select.a.x, editor.select.b.x),
			y: Math.min(editor.select.a.y, editor.select.b.y) }
		: editor.cursor;
	if (!at) return status('put the cursor somewhere first');
	const r = pasteRegion(editor.doc, editor.history, at.x, at.y, editor.floor, editor.clip);
	editor.dirty = true;
	// r.cells is how many words actually differed, not how many were written --
	// pasting over identical ground legitimately changes nothing.
	const what = `pasted ${describeClip(editor.clip)}, ${r.cells} changed`;
	status(r.dropped.length ? `${what} -- ${r.dropped[0]}` : what);
	drawEditor();
}

function clearSelection() {
	const cells = selectedCells();
	if (!cells.length) return status('nothing selected');
	const n = asBulk(() => forRegion(editor.history, cells, (x, y, floor) => {
		snapshotMessages();
		let done = clearCell(editor.doc, editor.history, x, y, floor);
		if (removeTrigger(editor.doc, x, y, floor)) done++;
		return done;
	}));
	editor.dirty = true;
	status(`cleared ${n} cell${n === 1 ? '' : 's'}`);
	drawEditor();
}

/** Keep the region buttons in step with what is actually selected. */
function refreshRegionBar() {
	const label = $('ed-region-info');
	if (label) {
		const s = editor.select;
		label.textContent = s
			? `${Math.abs(s.a.x - s.b.x) + 1}x${Math.abs(s.a.y - s.b.y) + 1} selected`
			: (editor.selectMode ? 'drag to select' : '');
	}
	$('ed-select')?.classList.toggle('on', !!editor.selectMode);
	const paste = $('ed-paste');
	if (paste) {
		paste.disabled = !editor.clip;
		paste.title = editor.clip ? `paste ${describeClip(editor.clip)}` : 'nothing copied';
	}
	for (const id of ['ed-fill', 'ed-copy', 'ed-region-clear']) {
		const b = $(id);
		if (b) b.disabled = !editor.select;
	}
}

/**
 * Relight now, for when the automatic pass is off.
 *
 * The light bit is derived data, so this deliberately does NOT go through the
 * undo history: undoing a wall and relighting gives the right answer anyway,
 * and 10,580 cells of history per press would bury every real edit.
 */
function relightNow() {
	if (!editor.doc) return;
	const changed = illuminate(editor.doc);
	status(changed ? `relit ${changed} cells` : 'lighting was already up to date');
	drawEditor();
}

/**
 * The in-engine pane: the game's own renderer, standing on the cursor cell.
 * It draws from a cell array, so this is the same buildDrawList the game uses --
 * only the cells and the viewpoint differ.
 */
function drawEditorPreview() {
	const canvas = $('ed-preview');
	if (!canvas || !editor.doc || !editor.cursor || !game.style || !game.atlas) return;
	const ctx = canvas.getContext('2d');
	const comp = editorPreview.comp || (editorPreview.comp = new IndexCompositor());
	comp.clear();
	const list = buildDrawList({
		cells: editor.doc.layers.cells,
		items: editor.doc.layers.items,
		x: editor.cursor.x, y: editor.cursor.y, floor: editor.floor,
		direction: editor.facing,
		tables: game.tables, style: game.style,
		tallObjects: !!game.tallObjects,
		lights: game.masks?.light, water: game.masks?.water,
		explosions: game.masks?.explosions, foam: game.masks?.foam,
		panels: { count: 36 },
	});
	// Same order the game's own pane render uses (see the frame loop): the sky
	// and horizon are a BACKDROP drawn before the frustum, and only when this
	// facing's sky bit is set -- otherwise the interior is cleared instead.
	// Skipping it left the editor's pane on a black void, which is exactly what
	// an indoor cell looks like, so the difference never announced itself.
	const cursorCell = editorCellIndex(editor.cursor.x, editor.cursor.y, editor.floor);
	if (hasSky(editor.doc.layers.items, cursorCell, editor.facing)) {
		comp.fillBackground(0, 0, VIEW_X, VIEW_Y, game.hasGradient);
		// Planet first: the horizon silhouette has to occlude it.
		if (game.planetSpans) {
			comp.drawSpans(game.planetSpans[editor.facing & 3], PLANET_COLOUR,
				0, 0, VIEW_X, VIEW_Y, game.hasGradient ? PLANET_GRADIENT_BASE : 0);
		}
		const spans = editorHorizonSpans();
		if (spans) {
			const h = spans[editor.facing & 3];
			comp.drawSpans(h.far, HORIZON_FAR_COLOUR, 0, 0, VIEW_X, VIEW_Y,
				game.hasGradient ? HORIZON_FAR_BASE : 0);
			comp.drawSpans(h.near, HORIZON_NEAR_COLOUR, 0, 0, VIEW_X, VIEW_Y, 0);
		}
	} else {
		comp.clearView(0, 0, VIEW_X, VIEW_Y);
	}
	comp.drawView(list, game.atlas, 0, 0, VIEW_X, VIEW_Y, game.overlays, game.panels);

	// Palette-index buffer -> pixels. It sits under the map now rather than
	// beside it, so there is room for 3x.
	const pal = buildPalette();
	const S = 3;
	const img = ctx.createImageData(VIEW_W * S, VIEW_H * S);
	for (let y = 0; y < VIEW_H; y++) {
		for (let x = 0; x < VIEW_W; x++) {
			const c = pal[comp.indices[(VIEW_Y + y) * SCREEN_W + VIEW_X + x]] || [0, 0, 0];
			for (let sy = 0; sy < S; sy++) {
				for (let sx = 0; sx < S; sx++) {
					const o = (((y * S + sy) * VIEW_W * S) + x * S + sx) * 4;
					img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2];
					img.data[o + 3] = 255;
				}
			}
		}
	}
	canvas.width = VIEW_W * S;
	canvas.height = VIEW_H * S;
	ctx.putImageData(img, 0, 0);
}
const editorPreview = {};

/**
 * Horizon spans for the map being EDITED, not the one that was loaded.
 *
 * game.horizonSpans is built once at load, so assigning a horizon from the pack
 * would not show up until the map was reopened. Rebuilt here whenever the doc's
 * horizon bytes change, and cached because the span walk is not free.
 */
function editorHorizonSpans() {
	const bytes = editor.doc?.horizon;
	if (!bytes) return game.horizonSpans || null;
	if (editorPreview.horizonFor !== bytes || !editorPreview.horizonSpans) {
		editorPreview.horizonFor = bytes;
		editorPreview.horizonStamp = null;
		editorPreview.horizonSpans = [0, 1, 2, 3].map((d) => horizonSpans(bytes, d));
	}
	return editorPreview.horizonSpans;
}

/** Drop the cached spans after an assignment writes new horizon bytes. */
function invalidateEditorHorizon() {
	editorPreview.horizonSpans = null;
	editorPreview.horizonFor = null;
}

// What the cursor is standing on: the cell's own fields, then any structure
// record that names it. Read-only for now -- the buttons below add and remove.
function refreshInspector() {
	const host = $('ed-insp-body');
	if (!host) return;
	const c = editor.cursor;
	if (!editor.doc || !c) { host.textContent = 'click a cell'; return; }
	const word = editor.doc.layers.cells[cellIndex(c.x, c.y, editor.floor)] >>> 0;
	const rows = [];
	const kv = (k, v) => rows.push(`<span class="k">${k}</span> ${v}`);

	kv('cell', `x ${c.x}  y ${c.y}  floor ${editor.floor}`);
	for (const f of ['floor', 'block', 'water', 'panel', 'explosion', 'aux']) {
		if (hasField(word, f) && (word & FIELD_PRESENCE[f])) kv(f, getField(word, f));
	}
	const variant = getField(word, 'variant');
	if (variant) kv('variant', variant);

	for (const { table, rec } of structuresAt(editor.doc, c.x, c.y, editor.floor)) {
		const detail = table === 'doors'
			? `key ${rec.key}  delay ${rec.delay}${rec.buttonOnly ? '  button only' : ''}`
			: table === 'lifts'
				? `travel ${rec.minHeight}-${rec.maxHeight}  weight ${rec.weight}`
				: table === 'monsters'
					? `type ${rec.type}  health ${rec.health}`
					: '';
		kv(table.replace(/s$/, ''), `#${rec.index ?? '?'}  ${detail}`);
	}
	const btn = buttonAt(editor.doc, c.x, c.y, editor.floor);
	if (btn) kv('button', `#${btn.index}  in ${btn.actionIn} / out ${btn.actionOut}`);
	const it = itemAt(editor.doc, c.x, c.y, editor.floor);
	if (it) kv('item', `${it.num}  ammo ${it.ammo}  damage ${it.damage}`);

	const issues = danglingStructures(editor.doc);
	if (issues.length) rows.push(`<span class="warn">${issues.length} dangling: ${issues[0]}</span>`);

	host.innerHTML = rows.join('<br>');
	refreshWiring();
	refreshCellExtras();
	refreshMessagePanel();
	refreshTriggerList();
}

/**
 * Every message on the map, in one list.
 *
 * A trigger is invisible until you stand on its cell, and they are scattered
 * over twenty floors, so the per-cell panel alone means hunting. This lists all
 * of them with the words they say; clicking one jumps the cursor there, floor
 * included, which is the only practical way to find a line you half remember.
 *
 * A trigger whose message is missing is shown too, in the warning colour --
 * 17-OperationCentre ships four of those, and they are exactly the sort of
 * thing that should be visible rather than silently absent.
 */
function refreshTriggerList() {
	const host = $('ed-trigger-body');
	if (!host) return;
	host.textContent = '';
	if (!editor.doc) return;

	const list = editor.doc.meta.textTriggers || [];
	if (!list.length) {
		const none = document.createElement('div');
		none.className = 'none';
		none.textContent = 'no messages on this map';
		host.appendChild(none);
		return;
	}

	const pool = editor.doc.meta.textMessages || {};
	const here = editor.cursor
		? editorCellIndex(editor.cursor.x, editor.cursor.y, editor.floor) : -1;

	// Sorted by where they are rather than by table order, so the list reads as
	// a tour of the map instead of the order things happened to be added.
	const rows = list
		.map((t) => ({ t, cell: t.cell ?? (t.posn >>> 2) }))
		.sort((a, b) => a.cell - b.cell);

	for (const { t, cell } of rows) {
		const at = cellOfIndex(cell);
		const rec = pool[t.offset];
		const row = document.createElement('div');
		row.className = 'trow';
		if (cell === here) row.classList.add('on');
		if (!rec) row.classList.add('bad');

		const where = document.createElement('span');
		where.className = 'at';
		where.textContent = `${at.x},${at.y} f${at.floor}`;

		const who = document.createElement('span');
		who.className = 'who';
		who.textContent = rec?.speaker ?? '?';
		who.title = SPEAKERS.find((s) => s.code === rec?.speaker)?.label || 'unknown speaker';

		const say = document.createElement('span');
		say.className = 'say';
		say.textContent = rec ? (decomposeText(rec.text).body || '(empty)') : 'no message';
		say.title = say.textContent;

		row.append(where, who, say);
		row.addEventListener('click', () => {
			editor.floor = at.floor;
			editor.cursor = { x: at.x, y: at.y };
			drawEditor();
		});
		host.appendChild(row);
	}
}

// Presence bits, so the inspector only lists fields the cell actually has.
const FIELD_PRESENCE = {
	floor: 0x1, block: 0x2, water: 0x4, panel: 0x8, explosion: 0x10, aux: 0x20,
};

/**
 * The item and monster pickers.
 *
 * Both show the real art: a grid of small sprites to choose from, and a larger
 * copy of the selection beside it. A dropdown of numbers was unusable -- item
 * 47 means nothing until you can see it is a rifle.
 *
 * Item art is a single rect in the item atlas. Monster art is a BOB of several
 * slots that have to be composited at their own offsets, so both go through
 * drawIndexed below rather than a plain putImageData.
 */
function buildPlacePickers() {
	buildItemPicker();
	buildMonsterPicker();
}

function buildItemPicker() {
	const host = $('ed-item');
	if (!host || host.childElementCount) return;
	const defs = game.itemDefs?.items || game.itemDefs || [];
	for (const d of defs) {
		if (!d || !d.index) continue;
		const name = (d.header || []).filter(Boolean).join(' ').trim();
		if (!name) continue;
		const rect = game.itemImages?.items?.[d.image];
		const c = drawIndexed(rect ? [{ rect, x: 0, y: 0 }] : [], game.itemAtlas, 1);
		if (!c) continue;
		c.title = `${d.index} ${name}`;
		c.dataset.num = String(d.index);
		c.addEventListener('click', () => selectItem(d.index));
		host.appendChild(c);
	}
	selectItem(editor.itemNum ?? (Number(host.firstElementChild?.dataset.num) || 0));
}

function buildMonsterPicker() {
	const host = $('ed-monster');
	if (!host || host.childElementCount) return;
	const seen = new Set();
	for (const d of game.monsterDefs?.monsters || game.monsterDefs || []) {
		if (!d || seen.has(d.type)) continue;
		seen.add(d.type);
		const c = drawIndexed(monsterSlots(d), game.monsterAtlas, 1);
		if (!c) continue;
		c.title = `${d.type} ${d.name || ''}`.trim();
		c.dataset.num = String(d.type);
		c.addEventListener('click', () => selectMonster(d.type));
		host.appendChild(c);
	}
	selectMonster(editor.monsterType ?? (Number(host.firstElementChild?.dataset.num) || 0));
}

/**
 * One drawable sprite for a monster.
 *
 * `parts.front.slots` is not an animation -- it is one sprite per view-cell
 * position, 67 of them, each at the size that position renders at and placed at
 * its screen offset. Compositing them all gives a 259x372 contact sheet, which
 * is not a thumbnail. Slot 41 is the nearest cell straight ahead (the same one
 * the monster smoke test renders), so it is the largest and best-centred, and
 * it is drawn at the origin rather than at its view offset.
 */
const MONSTER_AHEAD_SLOT = 41;

function monsterSlots(def) {
	const gfx = game.monsterGraphics?.monsters
		?.find((m) => m.number === def.monsterNumber);
	const slots = gfx?.parts?.front?.slots || [];
	if (!slots.length) return [];
	// Slot numbers are positions in the view, so this must index the array as
	// stored -- filtering first would renumber them.
	const ahead = slots[MONSTER_AHEAD_SLOT];
	const sl = ahead && (ahead.control | 0) === 0 && ahead.w && ahead.h
		? ahead
		: slots.filter((x) => x && (x.control | 0) === 0 && x.w && x.h)
			.reduce((a, b) => (a && a.w * a.h >= b.w * b.h ? a : b), null);
	return sl ? [{ rect: sl, x: 0, y: 0 }] : [];
}

/**
 * Composite palette-indexed sprites onto a canvas at `zoom`. Index 0 is
 * transparent, as everywhere else in this data. Returns null if nothing drew,
 * so callers can skip entries with no art rather than show an empty box.
 */
function drawIndexed(parts, atlas, zoom = 1) {
	if (!atlas || !parts.length) return null;
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	for (const p of parts) {
		x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
		x1 = Math.max(x1, p.x + p.rect.w); y1 = Math.max(y1, p.y + p.rect.h);
	}
	const w = x1 - x0, h = y1 - y0;
	if (!(w > 0 && h > 0)) return null;

	const pal = buildPalette();
	const img = new ImageData(w, h);
	let drawn = 0;
	for (const p of parts) {
		for (let y = 0; y < p.rect.h; y++) {
			for (let x = 0; x < p.rect.w; x++) {
				const v = atlas.data[(p.rect.ay + y) * atlas.width + p.rect.ax + x];
				if (!v) continue;
				// Every atlas in this port stores colour index + 1 so that 0 can
				// mean transparent -- the same `v - 1` the compositor applies.
				const c = pal[v - 1] || [255, 0, 255];
				const o = (((p.y - y0 + y) * w) + (p.x - x0 + x)) * 4;
				img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2];
				img.data[o + 3] = 255;
				drawn++;
			}
		}
	}
	if (!drawn) return null;

	const c = document.createElement('canvas');
	c.width = w; c.height = h;
	c.getContext('2d').putImageData(img, 0, 0);
	c.style.width = `${w * zoom}px`;
	c.style.height = `${h * zoom}px`;
	return c;
}

/** Move a large copy of the chosen sprite into its preview box. */
function showBig(canvasId, nameId, parts, atlas, label, zoom) {
	const box = $(canvasId);
	const big = drawIndexed(parts, atlas, zoom);
	if (box && big) {
		box.width = big.width; box.height = big.height;
		box.getContext('2d').drawImage(big, 0, 0);
		box.style.width = big.style.width;
		box.style.height = big.style.height;
	}
	const n = $(nameId);
	if (n) n.textContent = label;
}

function selectItem(num) {
	editor.itemNum = num | 0;
	for (const el of $('ed-item')?.children || []) {
		el.classList.toggle('on', Number(el.dataset.num) === editor.itemNum);
	}
	const d = (game.itemDefs?.items || game.itemDefs || []).find((x) => x && x.index === editor.itemNum);
	const rect = d ? game.itemImages?.items?.[d.image] : null;
	const name = d ? (d.header || []).filter(Boolean).join(' ').trim() : '';
	showBig('ed-item-big', 'ed-item-name', rect ? [{ rect, x: 0, y: 0 }] : [],
		game.itemAtlas, `${editor.itemNum} ${name}`, 2);
	showItemStats(d);
}

function selectMonster(type) {
	editor.monsterType = type | 0;
	for (const el of $('ed-monster')?.children || []) {
		el.classList.toggle('on', Number(el.dataset.num) === editor.monsterType);
	}
	const d = (game.monsterDefs?.monsters || game.monsterDefs || [])
		.find((x) => x && x.type === editor.monsterType);
	showBig('ed-monster-big', 'ed-monster-name', d ? monsterSlots(d) : [],
		game.monsterAtlas, d ? `${d.type} ${d.name || ''}`.trim() : '', 2);
	showMonsterStats(d);
}

/**
 * Wiring: what the structure under the cursor is connected to.
 *
 * A button holds an action and a data word for each of press and release, and
 * the data word is an offset into whichever table the action names. So the
 * target picker changes shape with the action -- a lift list, a door list, or
 * "pick cell", which arms the next map click instead of showing a dropdown.
 *
 * A door is simpler: it has a key number and a button-only flag, and both are
 * plain fields on the record.
 */
function refreshWiring() {
	const host = $('ed-wiring');
	if (!host) return;
	host.textContent = '';
	const c = editor.cursor;
	if (!editor.doc || !c) return;

	const btn = buttonAt(editor.doc, c.x, c.y, editor.floor);
	if (btn) {
		const desc = describeButton(editor.doc, btn);
		host.appendChild(wireLabel(`button #${btn.index}`));
		host.appendChild(buttonSideRow(btn, 'in', desc.in));
		host.appendChild(buttonSideRow(btn, 'out', desc.out));
		host.appendChild(delayRow(btn));
		host.appendChild(soundRow(btn));
	}

	// A pad is floor type 1 whose button index lives in the cell BELOW, so it
	// is found by a different lookup than a wall button and can coexist with one.
	const pad = padAt(editor.doc, c.x, c.y, editor.floor);
	if (pad && pad.button && pad.button !== btn) {
		const desc = describeButton(editor.doc, pad.button);
		host.appendChild(wireLabel(`pressure pad -> button #${pad.index}`));
		host.appendChild(buttonSideRow(pad.button, 'in', desc.in));
		host.appendChild(buttonSideRow(pad.button, 'out', desc.out));
		host.appendChild(delayRow(pad.button));
		host.appendChild(soundRow(pad.button));
	} else if (pad && !pad.button) {
		host.appendChild(wireLabel(`pressure pad -- no button #${pad.index} exists`));
	}

	for (const { table, rec } of structuresAt(editor.doc, c.x, c.y, editor.floor)) {
		if (table === 'doors') host.appendChild(doorRow(rec));
		if (table === 'lifts') host.appendChild(liftRow(rec));
	}
}

function wireLabel(text) {
	const el = document.createElement('div');
	el.className = 'ed-label';
	el.textContent = text;
	return el;
}

function wireRow(name, ...nodes) {
	const el = document.createElement('div');
	el.className = 'wrow';
	const n = document.createElement('span');
	n.textContent = name;
	el.appendChild(n);
	for (const x of nodes) el.appendChild(x);
	return el;
}

function wireSelect(options, value, onChange) {
	const el = document.createElement('select');
	for (const o of options) {
		const opt = document.createElement('option');
		opt.value = String(o.value);
		opt.textContent = o.text;
		el.appendChild(opt);
	}
	el.value = String(value);
	el.addEventListener('change', () => onChange(Number(el.value)));
	return el;
}

/** One side of a button: press or release. */
function buttonSideRow(btn, which, description) {
	const suffix = which === 'out' ? 'Out' : 'In';
	const action = btn[`action${suffix}`] | 0;
	const kind = actionTarget(action);

	const acts = wireSelect(
		ACTION_LIST.map((a) => ({ value: a.action, text: a.name })),
		action,
		(next) => {
			// The stored data word points into the wrong table once the action
			// family changes, so it is cleared rather than reinterpreted.
			const keep = actionTarget(next) === kind
				? decodeTarget(editor.doc, btn[`data${suffix}`], action)
				: null;
			setButtonAction(editor.doc, btn, which, next, keep);
			editor.dirty = true;
			refreshWiring();
			status(`button #${btn.index} ${which}: ${ACTION_NAMES[next]}`);
		});
	acts.className = 'act';

	const nodes = [acts];
	if (kind === 'lift' || kind === 'door') {
		const list = (editor.doc.meta[`${kind}s`] || []).filter((r) => r);
		const current = decodeTarget(editor.doc, btn[`data${suffix}`], action);
		const value = current ? (kind === 'lift' ? current.lift : current.door) : -1;
		const opts = [{ value: -1, text: `(no ${kind})` }]
			.concat(list.map((r) => ({ value: r.index, text: `#${r.index}` })));
		nodes.push(wireSelect(opts, value, (index) => {
			const target = index < 0 ? null
				: (kind === 'lift' ? { lift: index } : { door: index });
			setButtonAction(editor.doc, btn, which, action, target);
			editor.dirty = true;
			refreshWiring();
		}));
	} else if (kind === 'cell') {
		const armed = editor.picking && editor.picking.which === which;
		const pick = document.createElement('button');
		pick.type = 'button';
		pick.textContent = armed ? 'click a cell' : 'pick cell';
		if (armed) pick.classList.add('picking');
		pick.addEventListener('click', () => {
			editor.picking = { button: btn, which, action };
			status('click the cell this button should operate');
			refreshWiring();
		});
		nodes.push(pick);
	}

	const out = wireRow(which === 'out' ? 'release' : 'press', ...nodes);
	const now = document.createElement('span');
	now.style.opacity = '.6';
	now.textContent = description;
	out.appendChild(now);
	return out;
}

/** Consume a click armed by "pick cell". */
function finishTargetPick(cell) {
	const p = editor.picking;
	editor.picking = null;
	if (!p) return;
	if (p.kind === 'teleport') {
		beginGroup(editor.history);
		setTeleportTarget(editor.doc, editor.history, p.x, p.y, p.floor,
			editorCellIndex(cell.x, cell.y, editor.floor));
		editor.dirty = true;
		status(`teleport -> ${cell.x},${cell.y},${editor.floor}`);
		drawEditor();
		return;
	}
	setButtonAction(editor.doc, p.button, p.which, p.action,
		{ cell: editorCellIndex(cell.x, cell.y, editor.floor) });
	editor.dirty = true;
	status(`button #${p.button.index} ${p.which} targets ${cell.x},${cell.y},${editor.floor}`);
	drawEditor();
}

function numberInput(value, max, width, title, onChange) {
	const n = document.createElement('input');
	n.type = 'number';
	n.min = '0';
	n.max = String(max);
	n.style.width = width;
	n.value = String(value | 0);
	n.title = title;
	n.addEventListener('change', () => {
		onChange(Math.max(0, Math.min(max, Number(n.value) | 0)));
	});
	return n;
}

function delayRow(btn) {
	return wireRow('delay', numberInput(btn.delay, 255, '54px',
		'tenths of a second; 0 uses the default', (v) => {
			btn.delay = v;
			editor.dirty = true;
		}));
}

function doorRow(rec) {
	const key = numberInput(rec.key, 255, '54px',
		'key item needed to open; 0 is unlocked', (v) => {
			rec.key = v;
			editor.dirty = true;
			refreshInspector();
		});
	const only = document.createElement('input');
	only.type = 'checkbox';
	only.checked = !!rec.buttonOnly;
	only.addEventListener('change', () => {
		rec.buttonOnly = only.checked ? -1 : 0;
		editor.dirty = true;
		refreshInspector();
	});
	const onlyLabel = document.createElement('label');
	onlyLabel.append(only, document.createTextNode(' button only'));
	return wireRow(`door #${rec.index}`, document.createTextNode('key'), key, onlyLabel);
}

function liftRow(rec) {
	const lo = numberInput(rec.minHeight, 19, '48px', 'lowest floor', (v) => {
		rec.minHeight = v;
		editor.dirty = true;
		refreshInspector();
	});
	const hi = numberInput(rec.maxHeight, 19, '48px', 'highest floor', (v) => {
		rec.maxHeight = v;
		editor.dirty = true;
		refreshInspector();
	});
	return wireRow(`lift #${rec.index}`,
		document.createTextNode('travel'), lo, document.createTextNode('to'), hi);
}

/**
 * The map header panel.
 *
 * Style, sky, ambience, music, monster sets, water and the clock are one
 * setting each for the whole level and live nowhere near a cell, so without this
 * a map can be redecorated but not rebuilt.
 *
 * Almost every one of them is an INDEX into a table, so they get a named
 * dropdown and, where there is something to look at, a preview beside it -- a
 * number box for "which of the five styles" is only a way to type 7 by mistake.
 */
function buildMapProps() {
	const host = $('ed-props');
	if (!host || host.childElementCount || !editor.doc) return;

	for (const f of MAP_FIELDS) {
		const value = getMapField(editor.doc, f.key);
		const preview = document.createElement('span');
		preview.className = 'prev';

		const apply = (v) => {
			if (setMapField(editor.doc, f.key, v)) {
				editor.dirty = true;
				status(`${f.label} = ${getMapField(editor.doc, f.key)}`);
				// Style and sky are two different pieces of state and want two
				// different responses. The style is art, and has to be fetched.
				// The sky is a NUMBER that buildPalette reads off game.skyNum --
				// changing locn.sky alone left the renderer on the old ramp, and
				// reloading the style would not have fixed it either.
				if (f.key === 'style') reloadEditorStyle();
				if (f.key === 'sky') {
					game.skyNum = getMapField(editor.doc, 'sky');
					drawEditor();
				}
				// buildPalette reads game.ambient, so the pane needs the new value.
				if (f.key === 'ambientMin' || f.key === 'ambientMax') {
					game.ambient = editor.doc.meta.ambient || null;
					drawEditor();
				}
			}
			// The value may have been clamped, and one field can invalidate
			// another -- a tide whose low is above its high -- so the control and
			// the warning are both re-read rather than assumed.
			drawPropPreview(f, getMapField(editor.doc, f.key), preview);
			refreshMapPropWarnings();
			return getMapField(editor.doc, f.key);
		};

		let control;
		if (f.control === 'select') {
			control = wireSelect(propOptions(f), value, apply);
		} else if (f.optional) {
			// Empty means absent, which is not the same as zero here.
			control = document.createElement('input');
			control.type = 'number';
			control.min = String(f.min);
			control.max = String(f.max);
			control.placeholder = 'off';
			control.style.width = '58px';
			control.title = f.hint;
			control.value = value === null ? '' : String(value);
			control.addEventListener('change', () => {
				const raw = control.value.trim();
				const next = apply(raw === '' ? null : Number(raw));
				control.value = next === null ? '' : String(next);
			});
		} else {
			control = numberInput(value, f.max, f.max > 255 ? '68px' : '54px', f.hint,
				(v) => { control.value = String(apply(v)); });
		}

		const row = wireRow(f.label, control, preview);
		// The tooltip goes on the NAME, which is the part you do not understand.
		row.firstElementChild.title = f.hint;
		row.firstElementChild.classList.add('has-hint');
		host.appendChild(row);
		drawPropPreview(f, value, preview);
	}

	const warn = document.createElement('div');
	warn.id = 'ed-props-warn';
	warn.className = 'note';
	host.appendChild(warn);
	refreshMapPropWarnings();
}

/** Redraw just the style row's swatch, after its atlas has loaded. */
function refreshStylePreview() {
	const field = MAP_FIELDS.find((f) => f.key === 'style');
	const row = [...document.querySelectorAll('#ed-props .wrow')]
		.find((r) => r.firstElementChild.textContent === field.label);
	const host = row?.querySelector('.prev');
	if (host) drawPropPreview(field, getMapField(editor.doc, 'style'), host);
}

/** Named choices for a header field, using game data where it exists. */
function propOptions(f) {
	const range = (n, label) => Array.from({ length: n }, (_, i) => ({ value: i, text: label(i) }));
	switch (f.key) {
		case 'style':
			// The five sets have no names in the data, only directories, so the
			// preview is what actually tells them apart.
			return range(f.max + 1, (i) => `${i} - Graphics/Style${i + 1}`);
		case 'sky':
			return range(f.max + 1, (i) => String(i));
		case 'atmos':
			return range(f.max + 1, (i) => `${i} - Atmos${String(i).padStart(2, '0')}`);
		case 'musicNum':
			return range(f.max + 1, (i) => (i === 0 ? '0 - silent' : `${i} - Static0${i}`));
		case 'mons1':
		case 'mons2':
			return [{ value: 0, text: '0 - none' }].concat(
				monsterSetNames().map((name, i) => ({ value: i + 1, text: `${i + 1} - ${name}` })));
		case 'players':
			return [{ value: 0, text: '0 - any' }].concat(
				Array.from({ length: f.max }, (_, i) => ({ value: i + 1, text: String(i + 1) })));
		default:
			return range(f.max - f.min + 1, (i) => String(i + f.min));
	}
}

/** Graphic set N draws exactly one creature, so it can be named after it. */
function monsterSetNames() {
	if (monsterSetNames.cache) return monsterSetNames.cache;
	const defs = game.monsterDefs?.monsters || game.monsterDefs || [];
	const names = [];
	for (let set = 1; set <= 20; set++) {
		const d = defs.find((x) => x && x.monsterNumber === set);
		names.push(d?.name || `set ${set}`);
	}
	monsterSetNames.cache = names;
	return names;
}

/**
 * What to show beside a field, when there is something worth showing.
 *
 * Wrapped, because a preview is decoration: the art it needs may not be loaded
 * yet when the panel is first built, and a thrown swatch must not take the rest
 * of the header down with it.
 */
function drawPropPreview(f, value, host) {
	try {
		drawPropPreviewInner(f, value, host);
	} catch (err) {
		host.textContent = '';
		console.warn(`preview for ${f.key} failed:`, err);
	}
}

function drawPropPreviewInner(f, value, host) {
	host.textContent = '';
	if (f.preview === 'sky') {
		host.appendChild(skySwatch(value));
	} else if (f.preview === 'style') {
		const c = styleSwatch();
		if (c) host.appendChild(c);
	} else if (f.preview === 'monster') {
		if (!value) return;
		const defs = game.monsterDefs?.monsters || game.monsterDefs || [];
		const d = defs.find((x) => x && x.monsterNumber === value);
		const c = d ? drawIndexed(monsterSlots(d), game.monsterAtlas, 1) : null;
		if (c) { c.style.height = '34px'; c.style.width = 'auto'; host.appendChild(c); }
	} else if (f.preview === 'sample' || f.preview === 'music') {
		const key = f.preview === 'sample'
			? `Atmos${String(value).padStart(2, '0')}`
			: (value >= 1 && value <= 5 ? `Static0${value}` : null);
		if (!key) return;
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = 'play';
		b.title = key;
		b.addEventListener('click', () => {
			if (f.preview === 'music') game.audio?.playMusic(key);
			else game.audio?.playKey(key, { vary: false });
		});
		host.appendChild(b);
	}
}

/**
 * One sky as a vertical strip. A ramp is 44 colours, one per view row, so the
 * strip IS the sky -- nothing is being approximated.
 */
function skySwatch(skyNum) {
	const c = document.createElement('canvas');
	c.width = 1; c.height = 44;
	c.className = 'swatch';
	const ramp = game.sky?.tables?.nosky?.normal?.[skyNum & 7];
	const ctx = c.getContext('2d');
	const img = ctx.createImageData(1, 44);
	for (let i = 0; i < 44; i++) {
		const rgb = (ramp && ramp[i]) || [0, 0, 0];
		img.data[i * 4] = rgb[0]; img.data[i * 4 + 1] = rgb[1];
		img.data[i * 4 + 2] = rgb[2]; img.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return c;
}

/**
 * The loaded style's ground and wall. Only the current style is drawn, because
 * only the current style's atlas is in memory -- selecting another loads it and
 * this redraws.
 */
function styleSwatch() {
	const gfx = game.style?.graphics;
	if (!gfx || !game.atlas) return null;
	const wrap = document.createElement('span');
	wrap.className = 'pair';
	for (const index of [0, 5]) {          // Grass.bin and Stone.bin
		// A style's slot table is sparse: unused view positions are null, so the
		// filter has to survive them.
		const slots = gfx[index]?.slots || [];
		const sl = slots.filter((s) => s && (s.control | 0) === 0 && s.w && s.h)
			.reduce((a, b) => (a && a.w * a.h >= b.w * b.h ? a : b), null);
		const c = sl ? drawIndexed([{ rect: sl, x: 0, y: 0 }], game.atlas, 1) : null;
		if (!c) continue;
		c.style.height = '30px';
		c.style.width = 'auto';
		c.title = gfx[index]?.source || '';
		wrap.appendChild(c);
	}
	return wrap.childElementCount ? wrap : null;
}

function refreshMapPropWarnings() {
	const el = $('ed-props-warn');
	if (!el || !editor.doc) return;
	const issues = checkMapProps(editor.doc);
	el.textContent = issues.length ? `${issues.length}: ${issues[0]}` : '';
}

/**
 * Reload the style art after the header's style changes, so the preview shows
 * the ground and walls the map will actually use rather than the ones it was
 * opened with.
 */
async function reloadEditorStyle() {
	const n = getMapField(editor.doc, 'style');
	try {
		const style = await loadJSON(`style${n}.json`);
		const atlas = await loadBytes(style.atlas.file);
		game.baseStyle = style;
		game.baseAtlas = { width: style.atlas.width, height: style.atlas.height, data: atlas };
		game.style = game.baseStyle;
		game.atlas = game.baseAtlas;
		drawEditor();
		// The swatch is drawn from the loaded atlas, so it can only be right
		// once the load finishes -- redrawing it here stops it lagging a
		// selection behind.
		refreshStylePreview();
		status(`style ${n} loaded`);
	} catch (err) {
		status(`style ${n} failed to load: ${err.message}`);
	}
}

/**
 * Per-cell editing that has no tool: the payloads two block types keep in the
 * items layer, the egg a cell can carry, and the three loose flag bits.
 */
function refreshCellExtras() {
	const host = $('ed-extras');
	if (!host) return;
	host.textContent = '';
	const c = editor.cursor;
	if (!editor.doc || !c) return;
	const { x, y } = c, floor = editor.floor;
	const word = editor.doc.layers.cells[editorCellIndex(x, y, floor)] >>> 0;

	// --- teleport destination -------------------------------------------------
	const dest = teleportTargetAt(editor.doc, x, y, floor);
	if (dest !== null) {
		const at = cellOfIndex(dest);
		const pick = document.createElement('button');
		pick.type = 'button';
		const armed = editor.picking && editor.picking.kind === 'teleport';
		pick.textContent = armed ? 'click a cell' : 'pick destination';
		if (armed) pick.classList.add('picking');
		pick.addEventListener('click', () => {
			editor.picking = { kind: 'teleport', x, y, floor };
			status('click the cell this teleport sends you to');
			refreshCellExtras();
		});
		const where = document.createElement('span');
		where.style.opacity = '.6';
		where.textContent = dest === 0 ? 'unset' : `${at.x},${at.y},${at.floor}`;
		host.appendChild(wireRow('teleport', pick, where));
	}

	// --- boost amount ---------------------------------------------------------
	const boost = boostAmountAt(editor.doc, x, y, floor);
	if (boost !== null) {
		host.appendChild(wireRow('boost', numberInput(boost, 65535, '68px',
			'fitness granted, once', (v) => {
				setBoostAmount(editor.doc, editor.history, x, y, floor, v);
				editor.dirty = true;
				refreshInspector();
			})));
	}

	// --- egg ------------------------------------------------------------------
	const egg = eggAt(editor.doc, x, y, floor);
	if (egg) {
		const type = wireSelect(monsterOptions(), egg.type, (v) => {
			placeEgg(editor.doc, editor.history, x, y, floor, { ...egg, type: v });
			editor.dirty = true;
			drawEditor();
		});
		host.appendChild(wireRow('egg type', type));

		// 4094 is "random" and 4093/4095 are "never"; a plain number is 20-second
		// units, so the dropdown keeps those three out of the numeric range.
		const mode = wireSelect([
			{ value: 0, text: 'after' }, { value: EGG_RANDOM, text: 'random' },
			{ value: EGG_NEVER, text: 'never' },
		], egg.hatch >= EGG_DORMANT ? egg.hatch : 0, (v) => {
			placeEgg(editor.doc, editor.history, x, y, floor,
				{ ...egg, hatch: v === 0 ? 1 : v });
			editor.dirty = true;
			refreshCellExtras();
		});
		const row = wireRow('hatch', mode);
		if (egg.hatch < EGG_DORMANT) {
			row.appendChild(numberInput(egg.hatch, 4092, '54px', 'units of 20 seconds', (v) => {
				placeEgg(editor.doc, editor.history, x, y, floor, { ...egg, hatch: v });
				editor.dirty = true;
			}));
			const unit = document.createElement('span');
			unit.style.opacity = '.6';
			unit.textContent = `x20s = ${egg.hatch * 20}s`;
			row.appendChild(unit);
		}
		host.appendChild(row);

		host.appendChild(wireRow('facing', wireSelect(
			[{ value: -1, text: 'random' }, { value: 0, text: 'north' },
				{ value: 1, text: 'east' }, { value: 2, text: 'south' },
				{ value: 3, text: 'west' }],
			eggDirectionAt(editor.doc, x, y, floor) ?? -1,
			(v) => {
				setEggDirection(editor.doc, x, y, floor, v < 0 ? null : v);
				editor.dirty = true;
			})));

		const shell = document.createElement('input');
		shell.type = 'checkbox';
		shell.checked = egg.leaveShell;
		shell.addEventListener('change', () => {
			placeEgg(editor.doc, editor.history, x, y, floor,
				{ ...egg, leaveShell: shell.checked });
			editor.dirty = true;
		});
		const shellLabel = document.createElement('label');
		shellLabel.append(shell, document.createTextNode(' leave shell'));
		host.appendChild(wireRow('', shellLabel));
	}

	// --- pushable -------------------------------------------------------------
	//
	// The record travels with the block: it holds the word stamped down wherever
	// the crate ends up, so changing the look here has to rewrite it. addPushable
	// derives it from the cell, which is why both controls go back through it.
	const push = pushableAt(editor.doc, x, y, floor);
	if (push || editor.tool?.kind === 'pushable') {
		const shape = push ? push.rec.cell >>> 0 : 0;
		const curBlock = push ? (shape >>> 11) & 0x3f : (editor.pushBlock ?? 1);
		const curVariant = push ? (shape >>> 23) & 0x1f : (editor.pushVariant | 0);
		const rewrite = (block, variant) => {
			editor.pushBlock = block;
			editor.pushVariant = variant;
			if (!push) return;
			beginGroup(editor.history);
			addPushable(editor.doc, editor.history, x, y, floor, { block, variant });
			editor.dirty = true;
			drawEditor();
		};
		host.appendChild(wireRow('pushable', wireSelect(
			PUSH_BLOCKS.map((b) => ({ value: b.block, text: b.label })), curBlock,
			(v) => rewrite(v, curVariant))));
		// Variant picks the crate graphic; it is 5 bits, same as everywhere else.
		host.appendChild(wireRow('shape', numberInput(curVariant, 31, '54px',
			'graphic variant, 0-31', (v) => rewrite(curBlock, v))));
		if (push) {
			const note = document.createElement('span');
			note.style.opacity = '.6';
			note.textContent = `#${push.rec.index} of ${LIMITS.pushables}`;
			host.appendChild(wireRow('', note));
		}
	}

	// --- corpse ---------------------------------------------------------------
	const corpse = corpseAt(editor.doc, x, y, floor);
	if (corpse || editor.tool?.kind === 'corpse') {
		host.appendChild(wireRow('body', wireSelect(
			CORPSE_KINDS.map((k) => ({ value: k.aux, text: k.label })),
			corpse ? corpse.aux : (editor.corpseAux ?? CORPSE_KINDS[0].aux),
			(aux) => {
				editor.corpseAux = aux;
				if (corpse) {
					beginGroup(editor.history);
					placeCorpse(editor.doc, editor.history, x, y, floor, aux);
					editor.dirty = true;
					drawEditor();
				}
			})));
	}

	// --- wall panel -----------------------------------------------------------
	const panelSlot = wallPanelAt(editor.doc, x, y, floor);
	if (panelSlot !== null) {
		const row = wireRow('panel', wireSelect(
			Array.from({ length: PANEL_SLOTS_ADDRESSABLE }, (_, i) => ({ value: i, text: `slot ${i}` })),
			panelSlot,
			(slot) => {
				beginGroup(editor.history);
				setCellPanel(editor.doc, editor.history, x, y, floor, slot);
				editor.dirty = true;
				drawEditor();
			}));
		const drop = document.createElement('button');
		drop.type = 'button';
		drop.textContent = 'remove';
		drop.addEventListener('click', () => {
			beginGroup(editor.history);
			removeWallPanel(editor.doc, editor.history, x, y, floor);
			editor.dirty = true;
			drawEditor();
		});
		row.appendChild(drop);
		host.appendChild(row);
	}

	// --- loose flag bits ------------------------------------------------------
	const flagRow = document.createElement('div');
	flagRow.className = 'wrow';
	const flagName = document.createElement('span');
	flagName.textContent = 'flags';
	flagRow.appendChild(flagName);
	for (const f of FLAGS) {
		const box = document.createElement('input');
		box.type = 'checkbox';
		box.checked = getFlag(word, f.key);
		box.addEventListener('change', () => {
			beginGroup(editor.history);
			setFlag(editor.doc, editor.history, x, y, floor, f.key, box.checked);
			editor.dirty = true;
			drawEditor();
		});
		const l = document.createElement('label');
		l.append(box, document.createTextNode(` ${f.label}`));
		flagRow.appendChild(l);
	}
	host.appendChild(flagRow);
}

function monsterOptions() {
	const defs = game.monsterDefs?.monsters || game.monsterDefs || [];
	const seen = new Set();
	const out = [];
	for (const d of defs) {
		if (!d || seen.has(d.type)) continue;
		seen.add(d.type);
		out.push({ value: d.type, text: `${d.type} ${d.name || ''}`.trim() });
	}
	return out;
}

/** The sample a button plays -- an addition, not something the format had. */
function soundRow(btn) {
	const current = buttonSound(btn);
	const opts = [{ value: '', text: '(silent)' }]
		.concat([...(game.audio?.meta?.keys() || [])].map((k) => ({ value: k, text: k })));
	const pick = wireSelectText(opts, current ? current.key : '', (key) => {
		setButtonSound(editor.doc, btn, key || null, {
			once: !!current?.once, onRelease: !!current?.onRelease,
		});
		editor.dirty = true;
		refreshWiring();
		if (key) game.audio?.playKey(key, { vary: false });
	});

	const row = wireRow('sound', pick);
	if (current) {
		for (const [key, label, title] of [
			['once', 'once', 'play only the first time this button ever fires'],
			['onRelease', 'on release', 'sound when stepping off instead of on'],
		]) {
			const box = document.createElement('input');
			box.type = 'checkbox';
			box.checked = !!current[key];
			box.title = title;
			box.addEventListener('change', () => {
				setButtonSound(editor.doc, btn, current.key, {
					once: key === 'once' ? box.checked : current.once,
					onRelease: key === 'onRelease' ? box.checked : current.onRelease,
				});
				editor.dirty = true;
				refreshWiring();
			});
			const l = document.createElement('label');
			l.append(box, document.createTextNode(` ${label}`));
			row.appendChild(l);
		}
	}
	return row;
}

/** Like wireSelect but keeps string values, which sample keys are. */
function wireSelectText(options, value, onChange) {
	const el = document.createElement('select');
	for (const o of options) {
		const opt = document.createElement('option');
		opt.value = String(o.value);
		opt.textContent = o.text;
		el.appendChild(opt);
	}
	el.value = String(value);
	el.addEventListener('change', () => onChange(el.value));
	return el;
}

/**
 * The stats behind a picked item or monster.
 *
 * Sprites tell you which thing you are placing; they do not tell you it weighs
 * 4.2kg, fires four ways, or that its corpse uses monster set 2's art. Both
 * tables are read-only -- they come from Items.s and Monsters.s and are shared
 * by every instance -- so this is a reference panel, not an editor.
 */
function statList(host, rows) {
	host.textContent = '';
	for (const [k, v] of rows) {
		if (v === null || v === undefined || v === '') continue;
		const row = document.createElement('div');
		row.className = 'srow';
		const key = document.createElement('span');
		key.textContent = k;
		const val = document.createElement('b');
		val.textContent = String(v);
		row.append(key, val);
		host.appendChild(row);
	}
}

/** Directions a gun can fire, as a compact string. */
function fireDirs(fire) {
	if (!fire) return null;
	const on = Object.entries(fire).filter(([, v]) => v > 0);
	return on.length ? on.map(([d, v]) => `${d} ${v}`).join(', ') : null;
}

function showItemStats(def) {
	const host = $('ed-item-stats');
	if (!host) return;
	if (!def) { host.textContent = ''; return; }
	const rows = [
		['category', def.categoryName],
		// Weight is in grams and carry capacity is checked against the sum, so
		// this is the number that decides what a character can hold.
		['weight', `${def.weight} (${(def.weight / 1000).toFixed(1)}kg)`],
		['condition', def.maxDamage],
		['container', def.containerName],
		['water damage', def.waterDamage || null],
	];
	if (def.gun) {
		rows.push(['accuracy', def.gun.accuracy]);
		rows.push(['fires', fireDirs(def.gun.fire)]);
		const clips = (def.gun.clips || []).filter((c) => c);
		rows.push(['ammo', clips.length ? clips.join(', ') : null]);
	}
	// Every item carries a `sentry` block -- it is the same spare bytes read a
	// different way -- so it only means anything for an actual sentry.
	if (def.categoryName === 'sentry' && def.sentry) {
		rows.push(['sentry delay', def.sentry.delay]);
		rows.push(['sentry range', def.sentry.range || null]);
		rows.push(['rounds', def.sentry.rounds || null]);
	}
	rows.push(['sample', def.sample ? `${def.sample} @ ${def.samplePeriod}` : null]);
	statList(host, rows);
}

function showMonsterStats(def) {
	const host = $('ed-monster-stats');
	if (!host) return;
	if (!def) { host.textContent = ''; return; }
	const flags = [
		def.twoHigh ? 'two cells tall' : null,
		def.staysInWater ? 'stays in water' : null,
		def.stunnable ? 'stunnable' : null,
	].filter(Boolean).join(', ');
	statList(host, [
		['type', def.type],
		['graphic set', def.monsterNumber],
		['physique', def.physique],
		// speed counts DOWN to the next move, so a bigger number is slower.
		['speed', `${def.speed} (lower is faster)`],
		['bravery', def.bravery],
		['weapon', def.weaponModifier || null],
		['fireball', def.fireballDensity
			? `density ${def.fireballDensity}, speed ${def.fireballSpeed}, range ${def.maxFireDistance}`
			: null],
		['poison', def.poisonStrength || null],
		['flags', flags || null],
		['sample', def.sample ? `${def.sample} @ ${def.samplePeriod}` : null],
	]);
}

/**
 * The map's own 36 panel slots and 4 horizon facings.
 *
 * The library shows what you COULD assign; this shows what the map actually
 * holds, which is the half you need to see to point a wall at the right slot.
 * Clicking a slot selects it as the assign target and, for panels, arms the
 * "panel" tool with that slot.
 */
async function buildMapSlots() {
	const host = $('ed-map-slots');
	if (!host || !editor.doc) return;
	host.textContent = '';
	const isPanels = editor.packName === 'panelpack';
	const pack = await ensurePack(editor.packName);
	const pal = packPalette(editor.packName);
	const buf = isPanels ? editor.doc.panels : editor.doc.horizon;
	if (!buf) return;

	const n = pack.meta.entryBytes;
	const count = isPanels ? PANEL_SLOTS : HORIZON_FACINGS;
	const facing = ['north', 'east', 'south', 'west'];

	for (let slot = 0; slot < count; slot++) {
		const at = slot * n;
		if (at + n > buf.length) break;
		const bytes = buf.subarray(at, at + n);
		const blank = bytes.every((v) => v === 0);

		const cell = document.createElement('div');
		cell.className = 'slot';
		if (blank) cell.classList.add('blank');
		if (slot === editor.packSlot) cell.classList.add('on');

		const img = decodeSlotBytes(pack, bytes);
		const c = document.createElement('canvas');
		c.width = img.width; c.height = img.height;
		const ctx = c.getContext('2d');
		const data = ctx.createImageData(img.width, img.height);
		for (let p = 0; p < img.pixels.length; p++) {
			const col = pal[img.pixels[p]] || [255, 0, 255];
			data.data[p * 4] = col[0]; data.data[p * 4 + 1] = col[1];
			data.data[p * 4 + 2] = col[2]; data.data[p * 4 + 3] = 255;
		}
		ctx.putImageData(data, 0, 0);
		const zoom = Math.max(1, Math.round(96 / img.width));
		c.style.width = `${img.width * zoom}px`;
		c.style.height = `${img.height * zoom}px`;

		const tag = document.createElement('span');
		tag.textContent = isPanels
			? `${slot}${slot >= PANEL_SLOTS_ADDRESSABLE ? '!' : ''}`
			: facing[slot];
		if (isPanels && slot >= PANEL_SLOTS_ADDRESSABLE) {
			// variant is 5 bits, so a cell cannot name slots 32-35 at all.
			cell.title = `slot ${slot} exists but no cell can point at it (variant is 5 bits)`;
		}
		cell.append(c, tag);
		cell.addEventListener('click', () => {
			editor.packSlot = slot;
			$('ed-pack-slot').value = String(slot);
			for (const el of host.children) el.classList.toggle('on', el === cell);
			status(isPanels ? `slot ${slot} selected -- the Panel tool will use it`
				: `${facing[slot]} horizon selected`);
		});
		host.appendChild(cell);
	}
}

/** decodeEntry works on a pack index; map slots are loose bytes. */
function decodeSlotBytes(pack, src) {
	const { width: w, height: h, planes } = pack.meta;
	if (pack.meta.format === 'chunky') {
		return { width: w, height: h, pixels: Uint8Array.from(src) };
	}
	const rowBytes = w / 8;
	const px = new Uint8Array(w * h);
	for (let p = 0; p < planes; p++) {
		const base = p * rowBytes * h;
		for (let y = 0; y < h; y++) {
			for (let b = 0; b < rowBytes; b++) {
				const byte = src[base + y * rowBytes + b];
				if (!byte) continue;
				for (let bit = 0; bit < 8; bit++) {
					if (byte & (0x80 >> bit)) px[y * w + b * 8 + bit] |= 1 << p;
				}
			}
		}
	}
	return { width: w, height: h, pixels: px };
}

/**
 * The message editor.
 *
 * A trigger is a cell plus a line of dialogue, and the two halves are useless
 * apart -- a trigger with no message never speaks, a message with no trigger
 * never fires. So this edits them as one thing: pick the cell with the Message
 * tool, then set the words, who says them, and how many of the party have to be
 * alive to hear it.
 */
function refreshMessagePanel() {
	const host = $('ed-messages');
	if (!host) return;
	// Anything that repaints the editor lands here, and rebuilding the panel
	// under a caret would throw away half-typed text -- the textarea commits on
	// blur, so it has to survive until then.
	if (host.contains(document.activeElement) && document.activeElement !== document.body) {
		return;
	}
	host.textContent = '';
	const c = editor.cursor;
	if (!editor.doc || !c) return;

	const found = triggerAt(editor.doc, c.x, c.y, editor.floor);
	const usage = poolUsage(editor.doc);
	const count = (editor.doc.meta.textTriggers || []).length;

	const summary = document.createElement('div');
	summary.className = 'msg-summary';
	summary.textContent = `${count}/${TRIGGER_LIMIT} triggers   `
		+ `${usage.used}/${POOL_BYTES} bytes`;
	if (usage.over || count > TRIGGER_LIMIT) summary.classList.add('warn');
	host.appendChild(summary);

	if (!found) {
		const hint = document.createElement('div');
		hint.className = 'note';
		hint.textContent = 'No message on this cell. The Message tool puts one here.';
		host.appendChild(hint);
		return;
	}

	const { body, code } = decomposeText(found.record?.text || '');

	// The words.
	const words = document.createElement('textarea');
	words.rows = 2;
	words.value = body;
	words.spellcheck = false;
	words.addEventListener('change', () => {
		snapshotMessages();
		setTriggerMessage(editor.doc, found, { body: words.value });
		editor.dirty = true;
		refreshMessagePanel();
	});
	host.appendChild(wireRow('says', words));

	// Who says it. The gate is compared against '4': at or below, only that
	// player triggers it; above, anyone does.
	host.appendChild(wireRow('speaker', wireSelectText(
		SPEAKERS.map((s) => ({ value: s.code, text: s.label })),
		found.record?.speaker || code,
		(v) => {
			snapshotMessages();
			setTriggerMessage(editor.doc, found, { speaker: v });
			editor.dirty = true;
			refreshMessagePanel();
		})));

	// participants + 1 has to fit inside the surviving party, so this is really
	// "how many others must still be alive".
	host.appendChild(wireRow('needs', wireSelect(
		[0, 1, 2, 3].map((n) => ({ value: n, text: `${n + 1} alive` })),
		found.record?.participants | 0,
		(v) => {
			snapshotMessages();
			setTriggerMessage(editor.doc, found, { participants: v });
			editor.dirty = true;
			refreshMessagePanel();
		})));

	const drop = document.createElement('button');
	drop.type = 'button';
	drop.textContent = 'remove';
	drop.addEventListener('click', () => {
		beginGroup(editor.history);
		snapshotMessages();
		removeTrigger(editor.doc, c.x, c.y, editor.floor);
		editor.dirty = true;
		drawEditor();
	});

	const preview = document.createElement('span');
	preview.className = 'msg-preview';
	// What the band will actually scroll, names resolved.
	preview.textContent = renderMessage(found.record?.text || '',
		partyNames(), () => 0) || '(silent)';
	host.appendChild(wireRow('', drop, preview));

	const issues = checkMessages(editor.doc);
	if (issues.length) {
		const warn = document.createElement('div');
		warn.className = 'note warn';
		warn.textContent = `${issues.length}: ${issues[0]}`;
		host.appendChild(warn);
	}
}

/** Character names in party order, for the preview's name substitution. */
function partyNames() {
	const chars = game.characters?.characters || game.characters || [];
	const party = game.shell?.party?.length ? game.shell.party : [0, 1, 2, 3];
	return party.map((i) => chars[i]?.name || `Player ${i + 1}`);
}

function bindInspector() {
	const at = () => editor.cursor;
	$('ed-add-item')?.addEventListener('click', () => {
		const c = at(); if (!c) return;
		const num = editor.itemNum | 0;
		beginGroup(editor.history);
		// Removing first keeps re-placing on an occupied cell from stacking.
		removeItem(editor.doc, editor.history, c.x, c.y, editor.floor);
		const okp = placeItem(editor.doc, editor.history, c.x, c.y, editor.floor, num, { ammo: 200 });
		status(okp ? `item ${num} placed` : 'could not place that item');
		drawEditor();
	});
	$('ed-add-door')?.addEventListener('click', () => {
		const c = at(); if (!c) return;
		beginGroup(editor.history);
		const r = addDoor(editor.doc, editor.history, c.x, c.y, editor.floor, {});
		status(r ? `door #${r.index} added` : 'door table is full');
		drawEditor();
	});
	$('ed-add-lift')?.addEventListener('click', () => {
		const c = at(); if (!c) return;
		beginGroup(editor.history);
		const r = addLift(editor.doc, editor.history, c.x, c.y, editor.floor, {});
		status(r ? `lift #${r.index} added` : 'lift table is full');
		drawEditor();
	});
	$('ed-add-button')?.addEventListener('click', () => {
		const c = at(); if (!c) return;
		beginGroup(editor.history);
		const r = addButton(editor.doc, editor.history, c.x, c.y, editor.floor, {});
		status(r ? `button #${r.index} added` : 'button table is full');
		drawEditor();
	});
	$('ed-remove')?.addEventListener('click', () => {
		const c = at(); if (!c) return;
		beginGroup(editor.history);
		let n = removeStructureAt(editor.doc, editor.history, c.x, c.y, editor.floor);
		if (removeItem(editor.doc, editor.history, c.x, c.y, editor.floor)) n++;
		status(n ? `removed ${n}` : 'nothing here to remove');
		drawEditor();
	});
}

/**
 * The legend.
 *
 * The map icons are not derived from a cell and its neighbours the way the
 * game's automap is -- redraw_level looks up one pre-drawn icon per content
 * combination (see tileindex.js). So the legend shows the actual icon beside
 * each name, which beats describing the art in words, and then says which
 * contents the index deliberately does not distinguish.
 */
function buildLegend() {
	const host = $('ed-legend');
	if (!host || host.childElementCount || !editor.tiles) return;

	const row = (node, label) => {
		const el = document.createElement('span');
		el.className = 'item';
		el.appendChild(node);
		el.appendChild(document.createTextNode(label));
		return el;
	};
	const section = (title, items) => {
		const h = document.createElement('h4');
		h.textContent = title;
		const cols = document.createElement('div');
		cols.className = 'cols';
		for (const i of items) cols.appendChild(i);
		host.appendChild(h);
		host.appendChild(cols);
	};
	const named = (field) => FIELD_NAMES[field]
		.map((label, value) => ({ label, value }))
		.filter((e) => e.label !== '--');

	section('Blocks', named('block').map((e) =>
		row(tileChip(e.value + 1), e.label)));
	section('Floors', named('floor').map((e) =>
		row(tileChip((e.value + 1) * TILE_STRIDE), e.label)));
	section('Overlaid on whatever is underneath', [
		row(tileChip(165), 'Panel or button'),
		row(tileChip(330), 'Flowing water'),
		row(tileChip(660), 'Item, monster or body'),
		row(tileChip(TILE_UNDER_STONE), 'Empty, stone overhead'),
		row(tileChip(TILE_OPAQUE), 'Opaque, no block'),
	]);
	section('Markers -- what the icon cannot distinguish', MARKER_LEGEND.map((e) => {
		const mk = document.createElement('span');
		mk.className = 'mk';
		mk.style.color = e.colour;
		mk.textContent = e.glyph;
		return row(mk, e.label);
	}));

	const note = document.createElement('p');
	note.className = 'note';
	note.innerHTML =
		'Each icon is one pre-drawn picture of a cell\'s exact contents, looked up as ' +
		'<code>33 &times; (floor + 5&middot;panel + 10&middot;water + 20&middot;aux) + block</code> ' +
		'-- 1,320 of them, so a cell already looks like itself and its icon changes only when ' +
		'that cell changes. A <strong>red hatched</strong> cell is a block value with no art, ' +
		'i.e. one of the unused slots between Hydraulic and Stairs N. Panel, water and aux shift ' +
		'the index by a fixed amount, so the icon says one is present but never which: a sign and ' +
		'a button draw alike, as do a crate, a monster and a corpse. Those get a letter instead. ' +
		'Shift-click inspects a cell without painting it.';
	host.appendChild(note);
}

/** One map icon as a 2x canvas, for the legend. */
function tileChip(index) {
	const c = document.createElement('canvas');
	c.className = 'chip';
	c.width = EDITOR_TILE; c.height = EDITOR_TILE;
	const img = editor.tiles.images[index];
	if (img) c.getContext('2d').putImageData(img, 0, 0);
	c.title = `icon ${index}`;
	return c;
}

function buildToolPalette() {
	const host = $('ed-tools');
	if (!host || host.childElementCount) return;
	for (const t of TOOLS) {
		const b = document.createElement('button');
		b.type = 'button';
		b.textContent = t.label;
		b.dataset.tool = t.id;
		b.addEventListener('click', () => {
			editor.tool = t;
			for (const el of host.children) el.classList.toggle('on', el.dataset.tool === t.id);
			status(`tool: ${t.label}`);
		});
		host.appendChild(b);
	}
	host.firstElementChild?.classList.add('on');
}

/**
 * Apply the current tool to a cell.
 *
 * `info` writes nothing, which is the point of it -- clicking still moves the
 * cursor and refreshes the inspector and preview, so the map can be read
 * without being changed. The start and exit tools move a header field rather
 * than touching the grid, so they are not part of the cell history.
 */
function paintAt(cell) {
	if (!cell || !editor.doc) return;
	const t = editor.tool;

	if (editor.picking || t.kind === 'info') return;

	if (t.kind === 'pad') {
		const why = padBlocker(editor.doc, cell.x, cell.y, editor.floor);
		if (why) { status(why); return; }
		const r = addPad(editor.doc, editor.history, cell.x, cell.y, editor.floor, {});
		status(r ? `pad -> button #${r.index}` : 'button table is full');
		drawEditor();
		return;
	}

	if (t.kind === 'egg') {
		// The browser beside this picks WHICH creature hatches. There is no
		// "place monster" any more: every shipped map leaves the 128-record
		// monster table empty and spawns from eggs, so a placed record was a
		// creature that existed from frame one and hatched from nothing.
		const e = placeEgg(editor.doc, editor.history, cell.x, cell.y, editor.floor,
			{ type: editor.monsterType | 0 });
		status(e ? `egg: monster type ${e.type}` : 'could not place an egg there');
		drawEditor();
		return;
	}

	if (t.kind === 'light') {
		// Two fields, one click: the fixture is the puddle floor plus a stone
		// block, and either alone is a different thing entirely.
		editGroup();
		const a = editCell(editor.doc, editor.history, 'cells', cell.x, cell.y, editor.floor, 'floor', 3);
		const b = editCell(editor.doc, editor.history, 'cells', cell.x, cell.y, editor.floor, 'block', 0);
		status(a || b ? 'light fixture placed' : 'a light fixture is already here');
		drawEditor();
		return;
	}

	if (t.kind === 'light-erase') {
		// Only a fixture is removed. Clearing a puddle or a stone block that
		// merely happens to be here would be a different edit than asked for.
		const word = editor.doc.layers.cells[editorCellIndex(cell.x, cell.y, editor.floor)] >>> 0;
		if (!isLightFixture(word)) { status('no light fixture here'); return; }
		editGroup();
		editCell(editor.doc, editor.history, 'cells', cell.x, cell.y, editor.floor, 'block', null);
		editCell(editor.doc, editor.history, 'cells', cell.x, cell.y, editor.floor, 'floor', 0);
		status('light fixture removed');
		drawEditor();
		return;
	}

	if (t.kind === 'pushable') {
		// The block and its table record go down together: a block with no
		// record is the one case the original halts on, and a record with no
		// block is a crate that was never there.
		editGroup();
		const r = addPushable(editor.doc, editor.history, cell.x, cell.y, editor.floor,
			{ block: editor.pushBlock ?? 1, variant: editor.pushVariant | 0 });
		editor.dirty = true;
		status(r ? `pushable #${r.index}`
			: `the pushable table holds ${LIMITS.pushables}, and it is full`);
		drawEditor();
		return;
	}

	if (t.kind === 'pushable-erase') {
		editGroup();
		const gone = removePushable(editor.doc, editor.history, cell.x, cell.y, editor.floor);
		editor.dirty = editor.dirty || gone;
		status(gone ? 'pushable removed' : 'no pushable here');
		drawEditor();
		return;
	}

	if (t.kind === 'corpse') {
		const aux = editor.corpseAux ?? AUX_DEAD_SET1;
		const done = placeCorpse(editor.doc, editor.history, cell.x, cell.y, editor.floor, aux);
		status(done ? (corpseAt(editor.doc, cell.x, cell.y, editor.floor)?.label || 'body placed')
			: 'that body is already here');
		drawEditor();
		return;
	}

	if (t.kind === 'clear-cell') {
		// Everything: the three cell words and every record that names the cell,
		// including its message trigger, which lives in the map header.
		editGroup();
		let n = clearCell(editor.doc, editor.history, cell.x, cell.y, editor.floor);
		snapshotMessages();
		if (removeTrigger(editor.doc, cell.x, cell.y, editor.floor)) n++;
		if (setEggDirection(editor.doc, cell.x, cell.y, editor.floor, null)) n++;
		editor.dirty = true;
		status(n ? `cleared ${n} thing${n === 1 ? '' : 's'} from the cell` : 'cell was already empty');
		drawEditor();
		return;
	}

	if (t.kind === 'trigger') {
		editGroup();
		snapshotMessages();
		const made = addTrigger(editor.doc, cell.x, cell.y, editor.floor);
		status(made ? 'message placed -- write it in the panel below'
			: `the trigger table holds ${TRIGGER_LIMIT}, and it is full`);
		editor.dirty = true;
		drawEditor();
		return;
	}

	if (t.kind === 'panel') {
		const slot = editor.packSlot | 0;
		if (slot >= PANEL_SLOTS_ADDRESSABLE) {
			status(`slot ${slot} cannot be pointed at -- variant is 5 bits, so 0-31 only`);
			return;
		}
		editGroup();
		const done = setCellPanel(editor.doc, editor.history, cell.x, cell.y, editor.floor, slot);
		status(done ? `wall panel -> slot ${slot}` : 'that panel is already here');
		drawEditor();
		return;
	}

	if (t.kind === 'start' || t.kind === 'exit') {
		const posn = { x: cell.x, y: cell.y, floor: editor.floor };
		if (t.kind === 'exit') {
			editor.doc.meta.exit = posn;
			status(`exit moved to ${cell.x},${cell.y},${editor.floor}`);
		} else {
			const starts = editor.doc.meta.starts || (editor.doc.meta.starts = []);
			while (starts.length < 4) starts.push({ x: 0, y: 0, floor: 0 });
			starts[t.player] = posn;
			status(`player ${t.player + 1} starts at ${cell.x},${cell.y},${editor.floor}`);
		}
		editor.dirty = true;
		drawEditor();
		return;
	}

	if (editCell(editor.doc, editor.history, 'cells', cell.x, cell.y, editor.floor,
		t.field, t.value)) {
		drawEditor();
	}
}

/** How much of each side of the preview turns, as a fraction of its width. */
const PREVIEW_TURN_EDGE = 0.3;

/** Point the in-engine preview a different way, from a button or the view. */
function setEditorFacing(dir) {
	editor.facing = dir & 3;
	for (const o of document.querySelectorAll('#ed-facing button')) {
		o.classList.toggle('on', (Number(o.dataset.dir) | 0) === editor.facing);
	}
	drawEditor();
}

function editorFloor(delta) {
	editor.floor = Math.max(0, Math.min(EDITOR_MAP_HEIGHT - 1, editor.floor + delta));
	drawEditor();
}

function bindEditor() {
	$('ed-up')?.addEventListener('click', () => editorFloor(1));
	$('ed-down')?.addEventListener('click', () => editorFloor(-1));
	$('ed-close')?.addEventListener('click', closeEditor);
	$('ed-relight')?.addEventListener('click', relightNow);
	$('ed-export')?.addEventListener('click', exportEditorMap);
	$('ed-import')?.addEventListener('click', () => $('ed-import-file')?.click());
	$('ed-import-file')?.addEventListener('change', (e) => {
		importEditorMap(e.target.files?.[0]);
		e.target.value = '';                        // so the same file re-imports
	});
	$('ed-autolight')?.addEventListener('change', drawEditor);
	$('ed-clear')?.addEventListener('click', () => {
		if (!editor.doc) return;
		// Destructive and easy to hit by accident, so it asks -- but it goes
		// through the history, so undo still brings the whole map back.
		if (!confirm('Clear every cell of this map? Undo will bring it back.')) return;
		const n = clearCells(editor.doc, editor.history);
		editor.dirty = true;
		status(`cleared ${n} cells`);
		drawEditor();
	});
	$('ed-ghost')?.addEventListener('change', drawEditor);
	$('ed-grid')?.addEventListener('change', drawEditor);
	$('ed-markers')?.addEventListener('change', drawEditor);
	$('ed-undo')?.addEventListener('click', () => {
		if (editUndo(editor.doc, editor.history)) drawEditor();
	});
	$('ed-redo')?.addEventListener('click', () => {
		if (editRedo(editor.doc, editor.history)) drawEditor();
	});
	$('ed-save')?.addEventListener('click', saveEditorMap);
	$('ed-pack-assign')?.addEventListener('click', assignFromPack);
	for (const b of document.querySelectorAll('#ed-pack-tabs button')) {
		b.addEventListener('click', async () => {
			editor.packName = b.dataset.pack;
			for (const o of document.querySelectorAll('#ed-pack-tabs button')) {
				o.classList.toggle('on', o === b);
			}
			// Horizons are per facing, panels per slot.
			$('ed-pack-slot').max = editor.packName === 'horizonpack' ? '3' : '31';
			await buildPackGrid();
		});
	}
	for (const b of document.querySelectorAll('#ed-facing button')) {
		b.addEventListener('click', () => setEditorFacing(Number(b.dataset.dir) | 0));
	}
	document.querySelector('#ed-facing button')?.classList.add('on');

	// Turning by clicking the edge of the view, the way the game itself carves
	// its pane into action zones. Only the two turn zones are worth having here
	// -- the preview does not walk -- so the middle is left inert rather than
	// given a meaning that does nothing.
	const preview = $('ed-preview');
	const previewZone = (e) => {
		const r = e.currentTarget.getBoundingClientRect();
		const at = (e.clientX - r.left) / r.width;
		return at < PREVIEW_TURN_EDGE ? -1 : at > 1 - PREVIEW_TURN_EDGE ? 1 : 0;
	};
	preview?.addEventListener('click', (e) => {
		const turn = previewZone(e);
		if (turn) setEditorFacing((editor.facing + turn + 4) & 3);
	});
	// Standard resize cursors rather than art: enough to show the zones exist.
	preview?.addEventListener('mousemove', (e) => {
		const turn = previewZone(e);
		e.currentTarget.style.cursor = turn < 0 ? 'w-resize' : turn > 0 ? 'e-resize' : 'default';
	});

	const canvas = $('editor-canvas');
	const cellOf = (e) => {
		const r = canvas.getBoundingClientRect();
		return cellAt(e.clientX - r.left, e.clientY - r.top, EDITOR_SCALE);
	};
	canvas?.addEventListener('mousedown', (e) => {
		const cell = cellOf(e);
		if (!cell) return;
		// A click armed by "pick cell" is pointing at a target, not choosing a
		// cell to edit, so the cursor stays put and the button panel with it.
		if (editor.picking) { finishTargetPick(cell); return; }
		editor.cursor = cell;
		if (e.shiftKey) { drawEditor(); return; }   // shift = look, do not paint
		// Select mode drags a rectangle out instead of painting. Ctrl reaches it
		// without leaving the tool, for one quick selection mid-edit.
		if (editor.selectMode || e.ctrlKey || e.metaKey) {
			editor.selecting = true;
			editor.select = { a: { x: cell.x, y: cell.y }, b: { x: cell.x, y: cell.y } };
			drawEditor();
			return;
		}
		editor.painting = true;
		beginGroup(editor.history);                 // a drag undoes as one step
		paintAt(cell);
		drawEditor();
	});
	canvas?.addEventListener('mousemove', (e) => {
		const cell = cellOf(e);
		$('ed-cell').textContent = cell ? `x ${cell.x}  y ${cell.y}  floor ${editor.floor}` : '';
		if (editor.selecting && cell) {
			editor.select.b = { x: cell.x, y: cell.y };
			drawEditor();
			return;
		}
		if (editor.painting && cell) paintAt(cell);
	});
	const stop = () => {
		editor.painting = false;
		if (editor.selecting) { editor.selecting = false; refreshRegionBar(); }
	};
	canvas?.addEventListener('mouseup', stop);
	canvas?.addEventListener('mouseleave', stop);
	$('ed-select')?.addEventListener('click', () => {
		editor.selectMode = !editor.selectMode;
		if (!editor.selectMode) editor.select = null;
		status(editor.selectMode ? 'select mode: drag a rectangle' : 'select mode off');
		drawEditor();
	});
	$('ed-fill')?.addEventListener('click', fillSelection);
	$('ed-flood')?.addEventListener('click', floodSelection);
	$('ed-copy')?.addEventListener('click', copySelection);
	$('ed-paste')?.addEventListener('click', pasteClip);
	$('ed-region-clear')?.addEventListener('click', clearSelection);

	window.addEventListener('keydown', (e) => {
		if (!editor.open || isTypingTarget(e)) return;   // ctrl-z undoes the text
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey ? editRedo(editor.doc, editor.history) : editUndo(editor.doc, editor.history)) {
				drawEditor();
			}
		}
		if (e.ctrlKey || e.metaKey) {
			const k = e.key.toLowerCase();
			if (k === 'c') { e.preventDefault(); copySelection(); }
			if (k === 'v') { e.preventDefault(); pasteClip(); }
		}
		if (e.key === 'Escape' && editor.select) {
			editor.select = null;
			drawEditor();
		}
	});
}

async function saveEditorMap() {
	if (!editor.doc) return;
	const suggested = editor.doc.meta.key?.startsWith('custom/')
		? editor.doc.meta.key.slice(7)
		: `${editor.source} copy`;
	const name = prompt('Save custom map as:', suggested);
	if (!name) return;
	const key = customKey(name);
	// HGedit1.c:411 runs both of these immediately before writing the file. The
	// game reads both -- the light bit straight out of the items layer -- so
	// saving without them stores lighting and an automap for the geometry the
	// map used to have.
	const rebuilt = rebuildDerived(editor.doc);
	// Validation warns; it never blocks the save.
	const warnings = validateMapDoc(editor.doc);
	try {
		await saveCustomMap(key, serializeMapDoc(editor.doc, key), name);
		editor.doc.meta.key = key;
		$('editor-name').textContent = `editing ${name}`;
		const derived = (rebuilt.lighting || rebuilt.blocks2d)
			? ` (relit ${rebuilt.lighting}, automap ${rebuilt.blocks2d})` : '';
		status(warnings.length
			? `saved "${name}"${derived} -- ${warnings.length} warning${warnings.length === 1 ? '' : 's'}: ${warnings[0]}`
			: `saved "${name}"${derived} -- playable under Short action game`);
	} catch (err) {
		status(`save failed: ${err.message}`);
	}
}

// An opt-in visual deviation, not a parity setting: see emitTallObjects. Kept
// beside debug and cheat because it is the same kind of thing -- a preference
// that outlives the page, off unless asked for.
const TALL_KEY = 'hiredguns-tall-objects';

function setTallObjects(on, persist = true) {
	game.tallObjects = !!on;
	const box = $('tall-objects');
	if (box) box.checked = game.tallObjects;
	if (persist) {
		try { localStorage.setItem(TALL_KEY, game.tallObjects ? '1' : '0'); } catch (_) { /* private mode */ }
	}
	game.dirty = true;
	if (editor.open) drawEditor();
}

const DEBUG_KEY = 'hiredguns-debug';
const CHEAT_KEY = 'hiredguns-cheat';

/**
 * Cheat mode, in the spirit of Sources/Cheat.s -- which gated invulnerability
 * and a key-less door opener behind typed passwords ("CHRISTINA", "APPLEGATE",
 * "AMIGA"). This is a checkbox rather than a password, and covers:
 *
 *   - total invulnerability (damagePlayerFitness returns before any damage,
 *     like cheat_mode3's `tst.b cheat_mode3 / bne .no_change` in decr_fitness)
 *   - infinite carry capacity (the tooheavy test never trips)
 *   - every item in the game, spread across the party
 *
 * The inventory holds 30 slots and there are ~107 real items, so no single
 * character can hold them all; four players at 30 slots is 120, so the items
 * are dealt round-robin across the party and the set is complete between them.
 */
function setCheat(on, persist = true) {
	game.cheat = !!on;
	document.body.classList.toggle('cheat', game.cheat);
	const box = $('cheat');
	if (box) box.checked = game.cheat;
	if (persist) {
		try { localStorage.setItem(CHEAT_KEY, game.cheat ? '1' : '0'); } catch (_) { /* private mode */ }
	}
	applyCheatToParty(game.cheat);
}

/** All item numbers that name a real item, in order. */
function allItemNumbers() {
	const defs = game.itemDefs?.items || game.itemDefs || [];
	return defs
		.filter((d) => d && d.index > 0 && (d.header || []).some((h) => h && h.trim()))
		.map((d) => d.index);
}

function applyCheatToParty(on) {
	if (!game.players?.length) return;
	for (const p of game.players) {
		if (p) p.noWeightLimit = on;
	}
	if (on) {
		const nums = allItemNumbers();
		const per = Math.ceil(nums.length / game.players.length);
		game.players.forEach((p, i) => {
			if (p?.inventory) stockInventory(p.inventory, nums.slice(i * per, (i + 1) * per));
		});
		status(`cheat on -- ${nums.length} items dealt across the party`);
	}
	for (const p of game.players) if (p) refreshInventory(p, game.itemDefs);
	updateHUD();
	game.dirty = true;
}

/**
 * Development aids: the map jump in the toolbar and the R/F floor cheat.
 * `body.debug` drives the CSS that reveals anything marked `.debug-only`.
 */
function setDebug(on, persist = true) {
	game.debug = !!on;
	document.body.classList.toggle('debug', game.debug);
	const box = $('debug');
	if (box) box.checked = game.debug;
	if (persist) {
		try { localStorage.setItem(DEBUG_KEY, game.debug ? '1' : '0'); } catch (_) { /* private mode */ }
	}
}

// ---------------------------------------------------------------------------
// The top bar belongs to the game, not the editor.
//
// Quick save, quick load and load level act on a running game; crt, debug and
// cheat change how one looks or plays. None of them mean anything while a level
// is being built, and the crt overlay literally covers the editor -- it is a
// fixed, full-screen layer. So the bar is hidden and its modes are switched off
// for as long as the editor is open, then put back exactly as they were.
//
// Switched off WITHOUT persisting: these are saved preferences, and a tab
// closed with the editor open must not come back with the user's choices
// rewritten to off.
//
// The status line is the exception. It lives in that bar and the editor writes
// to it constantly, so it moves into the editor's own bar rather than going
// dark, and moves back on the way out.
const BAR_MODES = [
	{ get: () => crtEnabled(), set: (v) => setCrt(v, false) },
	{ get: () => !!game.tallObjects, set: (v) => setTallObjects(v, false) },
	{ get: () => !!game.debug, set: (v) => setDebug(v, false) },
	{ get: () => !!game.cheat, set: (v) => setCheat(v, false) },
];
let barModesHeld = null;

function suspendBarModes() {
	if (barModesHeld) return;
	barModesHeld = BAR_MODES.map((m) => m.get());
	for (const m of BAR_MODES) m.set(false);
	document.body.classList.add('editing');
	$('editor-bar')?.appendChild($('status'));
}

function restoreBarModes() {
	document.body.classList.remove('editing');
	// Back where it was: after quick load, before the load-level button.
	const bar = $('bar'), before = $('load-level');
	if (bar && before) bar.insertBefore($('status'), before);
	if (!barModesHeld) return;
	BAR_MODES.forEach((m, i) => m.set(barModesHeld[i]));
	barModesHeld = null;
}

function showShell(on) {
	const el = $('shell');
	if (el) el.classList.toggle('hidden', !on);
	updateMobileActions();
}

function paintShellFrame() {
	const canvas = $('shell-canvas');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.imageSmoothingEnabled = false;
	// The shell has its own 640x512 lace resolution, independent of the game's
	// 320x212, so it scales against SHELL_W rather than SCREEN_W.
	const scale = canvas.width / SHELL_W;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	// The character-select screen draws each character's origin/name/class, so
	// hand the shell the same english-only, character-ordered list the party
	// picker indexes into.
	const art = game.frontendArt || {};
	if (!art.characters && game.characters) art.characters = englishCharacters();
	paintShell(ctx, game.shell, art);

	// Keep animating while the character strip is still easing toward the
	// focused portrait. One chain at a time, or every keypress would start its
	// own and the strip would accelerate with each press.
	if (game.shell?.mode === SHELL.CHSELECT && faceScrolling(game.shell) && !shellAnimating) {
		shellAnimating = true;
		requestAnimationFrame(() => {
			shellAnimating = false;
			paintShellFrame();
		});
	}
}

let shellAnimating = false;

function doSave(slot = 'quick') {
	try {
		writeSlot(slot, snapshotGame(game));
		status(`saved ${slot === 'quick' ? 'quick' : 'slot ' + slot}`);
		return true;
	} catch (e) {
		status(`save failed: ${e.message}`);
		return false;
	}
}

async function doLoad(slot = 'quick') {
	const data = readSlot(slot);
	if (!data) {
		status('no save');
		return false;
	}
	if (data.shell) applyCampaign(game.shell, data.shell);
	// Before loadMap, which is what reads the carry to build the players.
	// Restored for both save kinds: a campaign-kind save is taken between maps,
	// which is precisely when the carry is the only record of the party's kit.
	game.partyCarry = data.partyCarry || null;
	if (data.kind === 'game' && data.mapKey) {
		status(`loading ${data.mapKey}...`);
		setPartyCharacters(data.party?.length === 4 ? data.party : game.shell.party);
		game.actionFlag = data.actionFlag | 0;
		await loadMap(data.mapKey);
		applyGameSnapshot(game, data);
		game.shell.mode = SHELL.GAME;
		showShell(false);
		game.dirty = true;
		status(`loaded ${slot === 'quick' ? 'quick' : 'slot ' + slot}`);
		return true;
	}
	applyShellEvent(enterWorld(game.shell, game.campaign));
	status('loaded campaign');
	return true;
}

async function applyShellEvent(ev) {
	if (!ev) return;
	if (ev.music && game.audio?.unlocked) game.audio.playMusic(ev.music);
	// A fresh party never inherits the previous one's kit.
	if (ev.newRun) clearPartyCarry();
	// Refresh the custom-map list before any screen that shows it.
	if (ev.newRun || ev.music === 'Front') {
		listCustomMaps().then((maps) => {
			game.shell.customMaps = maps;
			if (game.shell.mode === SHELL.ACTION) {
				game.dirty = true;
				paintShellFrame();
			}
		}).catch(() => { /* no store yet */ });
	}
	if (ev.editor) {
		await openEditor();
		return;
	}
	if (ev.load) {
		await doLoad(ev.load);
		game.dirty = true;
		if (game.shell.mode !== SHELL.GAME) {
			showShell(true);
			paintShellFrame();
		}
		return;
	}
	if (ev.play) {
		status(`loading ${ev.play}...`);
		try {
			setPartyCharacters(game.shell.party.length === 4 ? game.shell.party : [0, 1, 2, 3]);
			game.actionFlag = game.shell.actionFlag | 0;
			const select = $('map');
			if (select) select.value = ev.play;
			await loadMap(ev.play);
			// After the map is loaded, so the briefing can read its own locn --
			// and so dismissing it drops straight into a level that is ready.
			await showBriefing(game.map?.locn, { audio: game.audio });
			game.shell.mode = SHELL.GAME;
			game.dirty = true;
			showShell(false);
			status(`playing ${ev.play}`);
		} catch (e) {
			status(`error: ${e.message}`);
			if (game.shell.mode === SHELL.GAME) game.shell.mode = SHELL.WORLD;
			showShell(true);
		}
	}
	game.dirty = true;
	if (game.shell.mode !== SHELL.GAME) {
		showShell(true);
		paintShellFrame();
	}
}

const WATER_HERE = 4;
// keep_water is the two-bit height field plus the water_here bit (Equates.i:590);
// flowing_bit_num lives in the seen layer, not this one (Equates.i:689).
const KEEP_WATER = (0b11 << 17) | WATER_HERE;
const FLOWING_BIT = 11;

function sfxMisc(index, opts) { game.audio?.playMisc(index, opts); }

// Main.s:4295 `.sound`. With the ExtraSfx bank loaded -- which the CD32 build
// always has -- a landing plays extra sample 28 (BigClang) at period 153; the
// MiscSFX 2 / period 600 BlockThud is only the fallback for when that bank is
// absent. 153 is BigClang's own authored period (CLK/23395 = 151.6), so it
// plays at natural pitch.
// .explosion (Main.s:3650, 3729): moresfx slot 7 at period 550, both kinds.
const GRENADE_EXPL_SAMPLE = 7, GRENADE_EXPL_PERIOD = 550;
const LAND_EX_BIGCLANG = 28, LAND_EX_PERIOD = 153;
const LAND_MISC_THUD = 2, LAND_MISC_PERIOD = 600;
// DEVIATION (opt-in): the original uses BigClang for every character. Mechs
// getting their own metallic clang is a requested addition, not source
// behaviour. MetalClang is extra sample 11; its authored period is 127.
const LAND_EX_METALCLANG = 11, LAND_METALCLANG_PERIOD = 127;
export const OPTIONS = { robotLandingClang: true };

/**
 * blocks_fall .sound (Main.s:4295): a crate coming to rest.
 *
 * The same BigClang the player landing uses, but at period 153 rather than the
 * player's own -- a harder, higher hit -- and it shakes the screen from the top
 * of the table, which is the strongest shake the game has.
 */
function blockLanded(cell) {
	if (game.audio?.hasKey('BigClang')) {
		sfxEx(LAND_EX_BIGCLANG, { period: LAND_EX_PERIOD, vary: false });
	} else {
		sfxMisc(LAND_MISC_THUD, { period: LAND_MISC_PERIOD, vary: false });
	}
	startShake(game.shake, SHAKE_BLOCK_LANDS);
	game.dirty = true;
}

function playLandingSfx(p) {
	if (!game.audio) return;
	if (OPTIONS.robotLandingClang && p?.character?.raceName === 'Mech') {
		sfxEx(LAND_EX_METALCLANG, { period: LAND_METALCLANG_PERIOD, vary: false });
		return;
	}
	if (game.audio.hasKey('BigClang')) {
		sfxEx(LAND_EX_BIGCLANG, { period: LAND_EX_PERIOD, vary: false });
		return;
	}
	sfxMisc(LAND_MISC_THUD, { period: LAND_MISC_PERIOD, vary: false });
}
function sfxEx(index, opts) { game.audio?.playEx(index, opts); }
function sfxMore(index, opts) { game.audio?.playMore(index, opts); }
function sfxKey(key, opts) { game.audio?.playKey(key, opts); }

async function unlockAudio() {
	if (!game.audio || game.audio.unlocked) return;
	if (await game.audio.unlock()) {
		if (game.shell?.mode === SHELL.GAME && game.map) {
			game.audio.setMap(game.map.locn);
			refreshBackSfx(true);
		} else if (game.shell?.mode === SHELL.FRONT) {
			game.audio.playMusic('Front');
		}
	}
}

function refreshBackSfx(force = false) {
	if (!game.audio?.unlocked || !game.cells) return;
	let water = false, level = 0;
	for (const p of game.players) {
		if (!p || p.dead || p.inExit) continue;
		const cell = playerCell(p);
		if (cell < 0 || !(game.cells[cell] & WATER_HERE)) continue;
		water = true;
		level = (game.cells[cell] >>> 17) & 3;
		break;
	}
	const next = water ? `water${level}` : `atmos${game.map?.locn?.atmos | 0}`;
	if (!force && next === game.audioBack) return;
	game.audioBack = next;
	if (water) game.audio.playWater(level);
	else game.audio.playAtmos(game.map?.locn?.atmos | 0);
}

function updateHUD() {
	const p = game.players[game.active];
	if (!p) return;
	const weight = p.stats?.weight ?? 0;
	const physique = p.stats?.physique ?? 0;
	const mission = game.mission?.complete ? `  ${missionLabel(game.mission.type)}` : '';
	$('info').textContent =
		`player ${game.active + 1}  x=${p.x} y=${p.y} floor=${p.floor} facing ${DIRECTIONS[p.direction]}` +
		`  ${WINDOW_NAME[p.windowType ?? WINDOW.VIEW] || 'window'}` +
		`  weight ${weight}/${physique * 140}${mission}   [${game.renderer.name}]`;
}

function missionLabel(type) {
	switch (type) {
		case COMPLETION.DEATH: return 'party dead';
		case COMPLETION.CAMPAIGN_COMPLETE: return 'campaign complete';
		case COMPLETION.ACTION_COMPLETE: return 'action complete';
		case COMPLETION.ACTION_FAILED: return 'action failed';
		case COMPLETION.TIME_UP: return 'time up';
		default: return 'mission';
	}
}

function updateMissionCompletion() {
	if (!game.map || game.mission?.complete) return game.mission;
	if ((game.missionGrace | 0) > 0) return game.mission;
	const next = evaluateMissionCompletion(game.players, {
		actionFlag: game.actionFlag | 0,
		atTrip1: game.atTrip1 | 0,
		atTrip2: game.atTrip2 | 0,
		locnPlayers: game.map?.locn?.players | 0,
		numPlayers: game.players.filter((p) => p?.active !== false).length,
	});
	if (!next.complete) {
		game.mission = next;
		return next;
	}
	game.mission = next;
	status(missionLabel(next.type));
	game.dirty = true;
	updateHUD();
	if (game.shell && game.shell.mode === SHELL.GAME && game.map) {
		// The party takes what it is carrying to the next map. Capture before
		// the shell tears the map down, and only on a survivable outcome --
		// a wipe restarts from the characters' own kit.
		if (next.type !== COMPLETION.DEATH) capturePartyCarry();
		const ev = completeMission(game.shell, game.campaign, next);
		applyShellEvent(ev);
		showShell(true);
		// The stills go up after the shell has taken the map down, so dismissing
		// one lands on the menu rather than back in a dead level. The ending
		// comes from completeMission's own flag: CAMPAIGN_COMPLETE only means
		// this mission is over, and every campaign level raises it.
		if (ev.died) {
			showDeathScreen({ audio: game.audio }).then(() => unlockAudio());
		} else if (ev.campaignOver) {
			showOutro({ audio: game.audio, party: game.shell?.party || [] })
				.then(() => unlockAudio());
		}
	}
	return next;
}

function playerCell(p) {
	return cellIndex(p.x, p.y, p.floor);
}

/**
 * move_doors silences both door sounds while the viewing player rides a lift
 * (`tst.b on_a_lift` guards every PLAY_SAMPLE there), so the lift's own noise
 * is not fighting them.
 */
/**
 * move_lifts (Main.s:2205) starts the motor on the rising edge of on_a_lift and
 * kills the channel on the falling one, so the noise lasts exactly as long as
 * the ride.
 *
 * on_a_lift is set where a lift CARRIES a player (Main.s:1958, 2097 -- right
 * after the floor is stepped), not where one is stood on a lift. This used to
 * ask whether the viewing player was on a lift cell, so parking on a stopped
 * lift ran the motor forever.
 *
 * It is also a global in the original rather than a property of whoever is
 * being watched: any player being carried makes the noise, which is right when
 * all four panes are on screen at once.
 */
function updateLiftSfx() {
	if (!game.audio) return;
	const on = liftCarryingPlayer(game.lifts);
	if (on === game.onLiftPrev) return;
	game.onLiftPrev = on;
	if (on) game.audio.startLift();
	else game.audio.stopLift();
}

// Main.s:2342-2402. Sample 5 (period 428) when a door starts moving, in either
// direction, and sample 4 (period 568) when it arrives fully open or fully
// closed. The arrival clunk was missing entirely, which is why the sound
// seemed to stop before the animation did.
function doorHooks() {
	return {
		// Both are gated on the lift flag in the original too (Main.s:2349,
		// 2391, 2401): the door samples and the lift motor share channel 2, so
		// a door heard mid-ride would cut the motor off. Same flag as the motor,
		// so a STOPPED lift no longer silences every door in the level.
		onDoorMoving: () => { if (!liftCarryingPlayer(game.lifts)) sfxMisc(5); },
		onDoorArrived: () => { if (!liftCarryingPlayer(game.lifts)) sfxMisc(4); },
	};
}

function itemMetaByNum(num) {
	return game.itemDefs?.items?.[(num | 0) - 1] || null;
}

function addExperience(p, amount) {
	if (!p?.stats || amount <= 0) return;
	p.stats.experience = Math.min(60000, (p.stats.experience | 0) + (amount | 0));
}

function incrementFitness(p, amount) {
	if (!p?.stats || amount <= 0) return 0;
	const before = p.stats.fitness | 0;
	p.stats.fitness = Math.min(65535, before + (amount | 0));
	p.dead = false;
	return p.stats.fitness - before;
}

function incrementPhysique(p, amount) {
	if (!p?.stats || amount <= 0) return 0;
	const before = p.stats.physique | 0;
	p.stats.physique = Math.min(65535, before + (amount | 0));
	return p.stats.physique - before;
}

function damageMonsterWithOwner(m, hit, owner = -1) {
	if (!m?.active) return { monsterKilled: false };
	const physique = m.def?.physique || 0;
	const killed = damageMonsterFitness(game.monsterState, game.cells, m, hit);
	if (killed && owner >= 0) addExperience(game.players[owner], Math.floor(physique / 10));
	return { monsterKilled: killed, monsterPhysique: physique };
}

function playerAtCell(cell) {
	return game.players.find((p) => p && p.active !== false && !p.dead &&
		playerCell(p) === cell) || null;
}

function damageOccupantAtCell(cell, hit = {}) {
	if (cell < 0 || cell >= game.cells.length) return null;
	const word = game.cells[cell] >>> 0;
	if (!(word & BLOCK_HERE)) return null;
	const block = (word >>> BLOCK_SHIFT) & BLOCK_MASK;
	if (block >= BLOCK_PLAYER_FIRST && block <= BLOCK_PLAYER_LAST) {
		const p = playerAtCell(cell);
		if (!p) return null;
		let playerDamage = hit.playerDamage || 0;
		if (hit.source === 'fireball' && p.spellShield === 86) playerDamage >>>= 3;
		if (playerDamage) damagePlayerFitness(p, playerDamage);
		if (hit.playerInventoryDamage) damageInventory(p, game.itemDefs, hit.playerInventoryDamage);
		p.fireFlashDur = 5;
		p.fireFlash = 1;
		refreshPlayerFlags(p);
		return { playerHit: true, player: p };
	}
	if (block >= BLOCK_MONSTER_FIRST && block <= BLOCK_MONSTER_LAST) {
		const m = monsterAtCell(game.monsterState, cell);
		if (!m) return null;
		return damageMonsterWithOwner(m, hit.monsterDamage || 0, hit.owner ?? -1);
	}
	if (block >= 24 && block <= 27) {
		return {
			sentryKilled: damageSentryAtCell(game.sentryState, game.cells, cell,
				hit.sentryDamage || 0),
		};
	}
	return null;
}

function combatHooks() {
	return {
		itemMeta: itemMetaByNum,
		hatchEggAt: (idx) => forceHatchEggAt(game.monsterState, game.cells, game.seen, game.items, idx),
		hitCell: (cell, hit) => damageOccupantAtCell(cell, hit),
		activeMonsters: () => activeMonsters(game.monsterState),
		stunMonster: (m, count) => { if (m) m.stun = Math.max(m.stun || 0, count | 0); },
		onGrenadeExplode: (_cell, stun) => grenadeExploded(stun),
	};
}

/**
 * A grenade going off (Main.s:3628 .explosion).
 *
 * Both kinds play moresfx 7 -- the explosion -- at period 550, and both shake
 * the screen. A stun grenade gets power 20, which is a nudge, and a live one
 * power 17, which is harder; the number is an index into the shake table, so
 * smaller is stronger.
 */
function grenadeExploded(stun) {
	sfxMore(GRENADE_EXPL_SAMPLE, { period: GRENADE_EXPL_PERIOD, vary: false });
	startShake(game.shake, stun ? SHAKE_GRENADE : SHAKE_EXPLOSION);
	game.dirty = true;
}

function nextCombatRandom() {
	if (!game.combatState) return Math.floor(Math.random() * 0x10000);
	let d = ((game.combatState.random & 0xffff) * 47) & 0xffff;
	d = ((d << 8) | (d >>> 8)) & 0xffff;
	game.combatState.random = d;
	return d;
}

function fireJitter(accuracy) {
	const a = accuracy | 0;
	if (a <= 0) return 0;
	const mask = Math.max(0, a * 2 - 1);
	return a - (nextCombatRandom() & mask);
}

function startFireAnimation(p, meta, target = null) {
	const anim = meta?.anim | 0;
	if (!anim) return;
	const rawDuration = meta.animDuration | 0;
	const muzzleOnly = rawDuration === 255;
	p.fireAnim = anim;
	p.fireDuration = muzzleOnly ? 1 : Math.max(1, rawDuration);
	p.fireFrame = 0;
	p.fireAccuracy = meta.gun?.accuracy | 0;
	p.fireColour = meta.animColour | 0;
	p.fireX = fireJitter(p.fireAccuracy);
	p.fireY = fireJitter(p.fireAccuracy);
	p.fireDist = Math.max(0, Math.min(4, target?.dist ?? 4));
	p.fireSplat = !muzzleOnly && !!target && p.fireDist < 4;
	p.fireFlashDur = 5;
	p.fireFlash = meta.flashColour | 0;
	if (game.renderer) game.renderer.setPalette(buildPalette());
}

function stepFireAnimation(p, ticks) {
	let remaining = ticks | 0;
	while (remaining-- > 0 && (p.fireAnim | 0) > 0) {
		p.fireDuration = (p.fireDuration | 0) - 1;
		if (p.fireDuration < 0) {
			p.fireAnim = 0;
			p.fireSplat = false;
			p.fireColour = 0;
			break;
		}
		p.fireFrame = ((p.fireFrame | 0) + 1) % 5;
		p.fireX = fireJitter(p.fireAccuracy | 0);
		p.fireY = fireJitter(p.fireAccuracy | 0);
	}
}

function addCombatFireball(from, opts = {}) {
	return addFireball(game.combatState, game.cells, game.seen, game.items, from, {
		style: game.map?.locn?.style | 0,
		...opts,
	}, combatHooks());
}

function poisonPlayerFromMonster(monster, cell) {
	const p = playerAtCell(cell);
	if (!p || p.spellImmune) return;
	const raceGenderGate = p.character?.gender ?? 0;
	if (raceGenderGate > 1) return;
	const strength = Math.max(0, (monster.def?.poisonStrength | 0) * 655);
	if (strength <= (p.poisonedStrength | 0)) return;
	const count = Math.max(1, p.stats?.physique | 0);
	p.poisonedCount = count;
	p.poisonedCountStore = count;
	p.poisonedStrength = strength;
}

function stepPlayerEffects(p, ticks) {
	if (!p) return false;
	let changed = false;
	for (const [dur, spell] of [
		['iconShieldDur', 'spellShield'],
		['iconImmuDur', 'spellImmune'],
		['iconWaterDur', 'spellWater'],
		['iconWingsDur', 'spellWings'],
	]) {
		if ((p[dur] | 0) > 0) {
			p[dur] = Math.max(0, (p[dur] | 0) - ticks);
			if (!p[dur] && p[spell]) { p[spell] = 0; changed = true; }
		}
	}
	if ((p.iconWeightsDur | 0) > 0) {
		p.iconWeightsDur = Math.max(0, (p.iconWeightsDur | 0) - ticks);
		if (!p.iconWeightsDur && p.spellWeights) {
			p.stats.physique = Math.max(1, (p.stats.physique | 0) - (p.spellWeights | 0));
			p.spellWeights = 0;
			changed = true;
		}
	}
	if ((p.fireFlashDur | 0) > 0) {
		p.fireFlashDur = Math.max(0, (p.fireFlashDur | 0) - ticks);
		changed = true;
	}
	for (const prop of ['fitnessFlashDur', 'clawCount', 'bigClawCount', 'monsterAttacking']) {
		if ((p[prop] | 0) > 0) {
			p[prop] = Math.max(0, (p[prop] | 0) - ticks);
			changed = true;
		}
	}
	if ((p.clawCount | 0) <= 0) p.clawX = 0;
	if ((p.bigClawCount | 0) <= 0) p.bigClawX = 0;
	if ((p.fireAnim | 0) > 0) {
		stepFireAnimation(p, ticks);
		changed = true;
	}
	for (const prop of ['activeCount', ...HUD_COUNTERS]) {
		if ((p[prop] | 0) > 0) {
			const next = Math.max(0, (p[prop] | 0) - ticks);
			p[prop] = next;
			if (next === 0) changed = true;
		}
	}
	if ((p.poisonedStrength | 0) > 0) {
		p.poisonedCount -= ticks;
		while (p.poisonedCount < 0) {
			p.poisonedCount += Math.max(1, p.poisonedCountStore | 0);
			p.poisonedTotal = ((p.poisonedTotal | 0) + (p.poisonedStrength | 0)) & 0xffff;
			changed = true;
		}
		if (p.poisonedTotal) {
			const total = p.poisonedTotal;
			p.poisonedTotal = 0;
			decrPlayerFitness(p, total);
			changed = true;
		}
	}
	if (changed) refreshPlayerFlags(p);
	return changed;
}

/**
 * Is the pane we are listening through under water?
 *
 * The same test stepDrowning uses for a head being submerged: water present and
 * at least half deep. Only the active player counts -- the sound comes from the
 * view you are actually looking out of, and averaging four party members who
 * may be rooms apart would muffle nothing convincingly.
 */
function activePlayerSubmerged() {
	if (game.shell?.mode !== SHELL.GAME || !game.cells) return false;
	const p = game.players?.[game.active];
	if (!p || p.dead || p.active === false) return false;
	const cell = game.cells[playerCell(p)] >>> 0;
	return (cell & 4) !== 0 && ((cell >>> 17) & 0x3) >= 2;
}

function stepDrowning(ticks) {
	game.drownCount = (game.drownCount || 0) + ticks;
	if (game.drownCount < 50) return false;
	game.drownCount = 0;
	let changed = false;
	for (const p of game.players) {
		if (!p || p.dead || p.inExit || p.active === false) continue;
		const cell = game.cells[playerCell(p)] >>> 0;
		const waterLevel = (cell >>> 17) & 0x3;
		if ((cell & 4) && waterLevel >= 2) {
			if (damageInventoryByWater(p, game.itemDefs)) changed = true;
			const race = p.character?.race ?? 0;
			if (race === 1 || p.spellWater === 97) {
				p.underwaterCount = 0;
				continue;
			}
			p.underwaterCount = (p.underwaterCount | 0) + 1;
			const breath = Math.floor((((p.stats.physique | 0) *
				(p.stats.fitness | 0)) / (65536 / 100)) / 400);
			if (p.underwaterCount > breath) {
				p.drowningCount = 150;
				damagePlayerFitness(p, p.underwaterCount * 200);
				changed = true;
			}
		} else {
			p.underwaterCount = 0;
		}
	}
	return changed;
}

function refreshPlayerFlags(p) {
	refreshInventory(p, game.itemDefs);
	p.hasAux = !!(game.cells && game.items && hasLooseItem(game.cells, game.items, playerCell(p)));
}

function refreshAllPlayerFlags() {
	for (const p of game.players) refreshPlayerFlags(p);
}

function heldName(p) {
	return itemName(game.itemDefs, p.inventory?.using) || 'nothing';
}

function selectedName(p) {
	return itemName(game.itemDefs, p.inventory?.store[p.inventory.pos]) || 'nothing';
}

function currentItemCell(p) {
	return playerCell(p);
}

function floorItemCandidate(p) {
	if (!game.cells || !game.items) return null;
	return peekLooseItem(game.cells, game.items, currentItemCell(p), game.seen, game.players);
}

function displayedHandItem(p) {
	const held = p.inventory?.using;
	if (hasItem(held)) return { item: held, floor: false };
	const floor = floorItemCandidate(p);
	return floor ? { item: floor, floor: true } : null;
}

function damagePlayerFitness(p, hit) {
	if (!p?.stats || hit <= 0) return 0;
	// cheat_mode3 in decr_fitness bails before touching fitness at all, so no
	// grunt, no flash, no damage.
	if (game.cheat) return 0;
	if (p.spellShield === 87) hit = hit >>> 3;
	const physique = Math.max(1, p.stats.physique | 0);
	// damage_fitness scales by physique, multiplies by 100, then decr_fitness
	// subtracts half of that amount from the stored fitness.
	const amount = (Math.floor((hit >>> 0) / physique) * 100) >>> 1;
	const before = p.stats.fitness | 0;
	p.fireWhite = true;
	sfxEx(p.character?.gender === 1 ? 7 : 10, { period: p.character?.gruntPeriod || 128 });
	startFitnessFlash(p, amount << 1);
	if (amount <= 0) return 0;
	p.stats.fitness = Math.max(0, before - amount);
	if (p.stats.fitness === 0) {
		p.dead = true;
		p.windowType = WINDOW.DEAD;
		handlePlayerDead(p);
		updateMissionCompletion();
	}
	return before - p.stats.fitness;
}

function decrPlayerFitness(p, damage) {
	if (!p?.stats || damage <= 0) return 0;
	p.fireWhite = true;
	const before = p.stats.fitness | 0;
	const amount = (damage | 0) >>> 1;
	p.stats.fitness = Math.max(0, before - amount);
	startFitnessFlash(p, damage | 0);
	if (p.stats.fitness === 0) {
		p.dead = true;
		p.windowType = WINDOW.DEAD;
		handlePlayerDead(p);
		updateMissionCompletion();
	}
	return before - p.stats.fitness;
}

function startFitnessFlash(p, damage) {
	const inc = Math.max(1, (((damage >>> 1) >>> 8) + 1) & 0xff);
	p.fitnessFlashDur = Math.min(255, (p.fitnessFlashDur | 0) + inc);
}

function startMonsterHitEffect(p, damage, monster = null) {
	if (!p) return;
	const duration = Math.max(1, Math.floor((damage | 0) / Math.max(1, p.stats?.physique | 0)));
	if ((nextCombatRandom() & 1) === 0) {
		if ((p.clawCount | 0) <= 0) p.clawX = nextCombatRandom() & 0x7f;
		p.clawCount = Math.min(32767, (p.clawCount | 0) + duration);
	} else {
		if ((p.bigClawCount | 0) <= 0) p.bigClawX = nextCombatRandom() & 0x7f;
		p.bigClawCount = Math.min(32767, (p.bigClawCount | 0) + duration);
	}
	p.monsterAttacking = 25;
	p.monsterAttackNumber = monster?.def?.monsterNumber | 0;
}

const HUD_MESSAGE_TICKS = 150;
const HUD_LOCK_TICKS = 100;
const HUD_COUNTERS = [
	'lockCount', 'usedCount', 'noAmmoCount', 'noRoomCount',
	'blockedCount', 'blocked2Count', 'invalidCount', 'drowningCount',
];

function showHudCounter(p, prop, ticks = HUD_MESSAGE_TICKS) {
	if (!p) return;
	p[prop] = ticks;
	game.dirty = true;
}

function showHudReason(p, reason) {
	switch (reason) {
		case 'no_ammo':
			showHudCounter(p, 'noAmmoCount');
			break;
		case 'full':
		case 'no_room':
			showHudCounter(p, 'noRoomCount');
			break;
		case 'blocked2':
			showHudCounter(p, 'blocked2Count');
			break;
		case 'blocked':
			showHudCounter(p, 'blockedCount');
			break;
		case 'invalid':
			showHudCounter(p, 'invalidCount');
			break;
		default:
			break;
	}
}

function showLockedHud(p, key = 0) {
	if (!p) return;
	p.lockKey = key & 255;
	showHudCounter(p, 'lockCount', HUD_LOCK_TICKS);
}

function showUsedHud(p, key = 0) {
	if (!p) return;
	p.usedKey = key & 255;
	showHudCounter(p, 'usedCount', HUD_LOCK_TICKS);
}

function clearMovedHud(p) {
	if (!p) return;
	p.lockCount = 0;
	p.blocked2Count = 0;
	p.usedCount = 0;
}

function handlePlayerDead(p) {
	if (p.character?.gender === 1) sfxEx(6, { period: 180, vary: false });
	const at = playerCell(p);
	removeHeadFromMap(game.cells, p.x, p.y, p.floor);
	const skel = skeletonCell(at);
	if (skel < 0) return;
	game.cells[skel] = ((game.cells[skel] & ~KEEP_AUX_MAIN) |
		AUX_HERE_MAIN | (AUX_SKELETON << AUX_SHIFT_MAIN)) >>> 0;
	game.seen[skel] = ((game.seen[skel] & ~KEEP_AUX_DATA) |
		((p.index & 0xff) << AUX_DATA_SHIFT)) >>> 0;
	clearLeaderIf(game.team, p);
}

/**
 * One step, through the real `move` port. The player's figure is stamped into
 * the map, so it has to be lifted out before the target is tested and put back
 * afterwards -- otherwise you collide with yourself.
 */
function step(p, dir, auto = false) {
	const from = cellIndex(p.x, p.y, p.floor);
	removeHeadFromMap(game.cells, p.x, p.y, p.floor);
	const { result, target } = move(game.cells, p, dir, auto);
	if (result === MOVE.DOOR) {
		const r = triggerDoor(game.doors, target, {
			carrying: (num) => carryingItem(p.inventory, num),
		});
		if (r.unlocked && r.key) {
			showUsedHud(p, r.key);
			removeCarriedItem(p, game.itemDefs, r.key);
			addExperience(p, 15);
			sfxEx(17, { period: 136, vary: false });
			status(`used ${itemName(game.itemDefs, r.key) || `key ${r.key}`}`);
		} else {
			if (r.locked) showLockedHud(p, r.key | 0);
			status(r.locked ? `locked${r.key ? ` -- needs key ${r.key}` : ''}` : 'door opening');
		}
		// The door's own tick plays both door sounds now (see doorHooks), which
		// is where move_doors plays them -- triggering one here as well
		// double-fired the travel sound.
	} else if (result === MOVE.EXIT) {
		if (!p.inExit && game.exitWinner == null) {
			game.exitWinner = p.index;
			addExperience(p, 500);
		}
		p.inExit = true;
		p.windowType = WINDOW.EXIT;
		sfxMisc(3, { vary: false });
		status('exit reached');
		updateMissionCompletion();
		refreshPlayerFlags(p);
		updateHUD();
		return result;
	} else if (result === MOVE.TELEPORT) {
		const r = teleport(game.cells, game.items, p, target, game.fallHooks);
		if (r.blocked) showHudCounter(p, 'blockedCount');
		status(r.blocked ? 'teleport blocked'
			: `teleported to ${r.x},${r.y} floor ${r.floor}`);
		if (r.moved) {
			sfxMisc(3, { vary: false });
			checkPad(game.buttons, game.cells, cellIndex(p.x, p.y, p.floor), true, game.world);
			clearNoMonster(game.items, cellIndex(p.x, p.y, p.floor));
			testMineForPlayer(p);
			layPath(p);
			refreshPlayerFlags(p);
			updateHUD();
		} else if (!p.dead) {
			putHeadInMap(game.cells, p);
		}
		return result;                       // teleport re-stamps the player itself
	} else if (result === MOVE.BOOST) {
		// No shipped map contains a boost pad (block type 2), so this path is
		// effectively dead -- kept because `move` can still report it.
		const gained = boost(game.items, p, target);
		status(gained ? `boost +${gained} fitness` : 'boost (no effect)');
	}
	if (result === MOVE.MOVED) {
		if (!auto && !p.fireAnim) sfxMisc(8, { period: p.character?.footstepPeriod || 720 });
		clearMovedHud(p);
		// .moved runs check_pad_released on the cell left behind, then
		// check_pad_pushed on the one arrived at -- in that order.
		checkPad(game.buttons, game.cells, from, false, game.world);
		checkPad(game.buttons, game.cells, cellIndex(p.x, p.y, p.floor), true, game.world);
		clearNoMonster(game.items, cellIndex(p.x, p.y, p.floor));
		testMineForPlayer(p);
		layPath(p);
	}
	if (!auto && (result === MOVE.BUMP || result === MOVE.NONE || result === MOVE.BUMPED_PLAYER)) {
		sfxMisc(9);
		showHudCounter(p, 'blockedCount');
	}
	if (!p.dead) putHeadInMap(game.cells, p);
	refreshPlayerFlags(p);
	return result;
}

function testMineForPlayer(p) {
	const cell = playerCell(p);
	const damage = triggerMineForCell(cell);
	if (!damage) return false;
	damagePlayerFitness(p, damage);
	damageInventory(p, game.itemDefs, damage);
	p.fireFlashDur = 15;
	p.fireFlash = 9;
	return true;
}

function testMineForMonster(m) {
	const damage = triggerMineForCell(m.cell);
	if (!damage) return false;
	damageMonsterWithOwner(m, damage, -1);
	return true;
}

function triggerMineForCell(cell) {
	return game.combatState
		? triggerMine(game.combatState, game.cells, game.seen, game.items, cell, combatHooks())
		: 0;
}

// activate_it: the cell the player is facing.
const STEP_DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function facingCell(p) {
	const [dx, dy] = STEP_DELTA[p.direction & 3];
	const nx = p.x + dx, ny = p.y + dy;
	if (nx < 0 || ny < 0 || nx >= MAP_WIDTH || ny >= MAP_DEPTH) return -1;
	return cellIndex(nx, ny, p.floor);
}

/**
 * push_action. activate_it tries a pushable BEFORE looking for a panel
 * (Controls&Movement.s:6530), so a crate in front of you is shoved rather
 * than the wall behind it being pressed.
 */
function activate(p) {
	const ahead = facingCell(p);
	if (ahead >= 0 && (game.cells[ahead] & (1 << 8))) {
		const push = pushRow(game.cells, game.items, game.pushables, p, {
			seen: game.seen,
			onPad: (cell, pressed) =>
				checkPad(game.buttons, game.cells, cell, pressed, game.world),
		});
		status(push.moved ? `pushed ${push.count} block(s)` : 'will not budge');
		if (!push.moved) showHudCounter(p, 'blocked2Count');
		// pushRow lifts the player out and stamps them back itself, matching
		// .push / .all_moved -- re-stamping here would be redundant.
		if (push.moved) {
			sfxMisc(1);
			testMineForPlayer(p);
		} else {
			sfxMisc(2);
		}
		refreshPlayerFlags(p);
		game.dirty = true;
		updateHUD();
		return;
	}
	const r = activatePanel(game.buttons, game.cells, ahead, game.world);
	if (!r) {
		runUseItem(p);
		return;
	}
	sfxMisc(7, { vary: false });
	status(`button ${r.index} ${r.pressed ? 'pressed' : 'released'} (action ${r.action})`);
	refreshPlayerFlags(p);
	game.dirty = true;
}

function pull(p) {
	const r = pullBlock(game.cells, game.items, game.pushables, p, {
		seen: game.seen,
		onPad: (cell, pressed) =>
			checkPad(game.buttons, game.cells, cell, pressed, game.world),
	});
	if (r.reason === 'reload') {
		runReload(p);
		return;
	}
	if (r.moved) sfxMisc(1);
	else sfxMisc(2);
	status(r.moved ? 'pulled block' : 'blocked');
	if (!r.moved) showHudCounter(p, 'blocked2Count');
	refreshPlayerFlags(p);
	game.dirty = true;
	updateHUD();
}

const WINDOW_NAME = {
	[WINDOW.VIEW]: 'view',
	[WINDOW.STORE]: 'store',
	[WINDOW.VDU]: 'vdu',
	[WINDOW.STATS]: 'stats',
	[WINDOW.INFO]: 'info',
	[WINDOW.DEAD]: 'dead',
	[WINDOW.EXIT]: 'exit',
};

function setPaneWindow(p, type) {
	const current = p.windowType ?? WINDOW.VIEW;
	if ((current === WINDOW.STORE || current === WINDOW.INFO) &&
		type !== WINDOW.STORE && type !== WINDOW.INFO) {
		clearNewItems(p.inventory);
	}
	p.windowType = type;
	if (type === WINDOW.VDU) {
		p.scrollX = p.x;
		p.scrollY = p.y;
		sfxEx(5, { period: 360, vary: false });
	}
	status(`player ${p.index + 1} ${WINDOW_NAME[type] || 'window'}`);
	game.dirty = true;
	updateHUD();
}

function shiftPaneWindow(p, dir) {
	const current = p.windowType ?? WINDOW.VIEW;
	if (dir < 0) {
		if (current === WINDOW.STORE) setPaneWindow(p, WINDOW.VIEW);
		else if (current === WINDOW.VDU) setPaneWindow(p, WINDOW.STORE);
		else if (current === WINDOW.STATS) setPaneWindow(p, WINDOW.VDU);
		return;
	}
	if (current === WINDOW.VIEW) setPaneWindow(p, WINDOW.STORE);
	else if (current === WINDOW.STORE) setPaneWindow(p, WINDOW.VDU);
	else if (current === WINDOW.VDU) setPaneWindow(p, WINDOW.STATS);
}

function windowFrameIndex(type) {
	switch (type) {
		case WINDOW.STORE:
		case WINDOW.INFO:
			return 1;
		case WINDOW.VDU:
			return 2;
		case WINDOW.STATS:
			return 3;
		case WINDOW.DEAD:
		case WINDOW.EXIT:
			return 4;
		default:
			return 0;
	}
}

function drawItemIcon(r, item, cx, cy, outlined = false, clip = null) {
	const meta = itemMeta(game.itemDefs, item);
	const rect = meta ? game.itemImages?.items?.[meta.image] : null;
	if (outlined && rect) {
		const x = cx + rect.x - 1, y = cy + rect.y - 1;
		if (clip) r.strokeRectClipped(x, y, rect.w + 2, rect.h + 2, 1, clip);
		else r.strokeRect(x, y, rect.w + 2, rect.h + 2, 1);
	}
	if (rect && clip) r.drawIndexedSpriteClipped(rect, game.itemAtlas, cx, cy, clip);
	else if (rect) r.drawIndexedSprite(rect, game.itemAtlas, cx, cy);
}

function drawPaneText(r, text, x, y, colour = 1, maxWidth = 70) {
	r.drawText(game.font, text, x, y, colour, { maxWidth });
}

function drawPaneTextClipped(r, text, x, y, colour, maxWidth, clip) {
	r.drawText(game.font, text, x, y, colour, { maxWidth, clip });
}

function drawCenteredPaneText(r, text, x, y, width, colour = 1) {
	const measured = r.measureText(game.font, text);
	const dx = measured < width ? Math.floor(x + (width - measured) / 2) : x;
	r.drawText(game.font, text, dx, y, colour, { maxWidth: width });
}

function drawItemNameLines(r, item, x, y, colour, maxWidth) {
	const meta = itemMeta(game.itemDefs, item);
	if (!meta) return;
	if (meta.header[0]) drawPaneText(r, meta.header[0], x, y, colour, maxWidth);
	if (meta.header[1]) drawPaneText(r, meta.header[1], x, y + 7, colour, maxWidth);
}

function drawCenteredItemNameLines(r, item, x, y, width, colour) {
	const meta = itemMeta(game.itemDefs, item);
	if (!meta) return;
	if (meta.header[0]) drawCenteredPaneText(r, meta.header[0], x, y, width, colour);
	if (meta.header[1]) drawCenteredPaneText(r, meta.header[1], x, y + 7, width, colour);
}

function characterPortrait(p) {
	const character = p.character?.character ?? p.index;
	return game.characterPortraits?.characters?.find((c) => c.character === character) || null;
}

function drawCharacterFace(r, p, ox, oy, slot, clipWidth = 33) {
	const face = characterPortrait(p)?.faces?.[slot];
	if (!face) return;
	if (slot === 'tab') {
		r.drawIndexedSpriteClipped(face, game.characterPortraitAtlas, ox, oy,
			{ x0: ox, y0: oy, x1: ox + clipWidth, y1: oy + 11 });
		return;
	}
	r.drawIndexedSprite(face, game.characterPortraitAtlas, ox, oy);
}

function drawInfoMiniWindow(r, ox, oy, clip) {
	const frame = game.windows?.windows?.[5];
	if (frame && game.windowAtlas) {
		r.drawWindowFrameClipped(frame, game.windowAtlas, ox, oy + 18, clip);
	}
}

function drawHandSummary(r, item, ox, oy, outlined, floor = false) {
	drawItemIcon(r, item, ox + 116, oy + 54, !floor && outlined);
	drawCenteredItemNameLines(r, item, ox + 86, oy + 22, 66, 1);
	const foot = itemFooterLines(game.itemDefs, item);
	for (let i = 0; i < foot.length; i++) {
		drawCenteredPaneText(r, foot[i], ox + 86, oy + 76 + i * 7, 66, 1);
	}
}

function drawStorePane(r, p, ox, oy) {
	const inv = p.inventory;
	if (!inv) return;

	const rows = [13, 27, 41, 55, 69, 83, 97];
	const listClip = { x0: ox, y0: oy + 18, x1: ox + 81, y1: oy + 94 };
	for (let i = 0; i < rows.length; i++) {
		const slot = inv.pos + i - 3;
		if (slot < 0 || slot >= inv.store.length) continue;
		drawItemIcon(r, inv.store[slot], ox + 33, oy + rows[i],
			!!inv.store[slot]?.outlined, listClip);
	}

	const hand = displayedHandItem(p);
	if (hand) {
		const item = hand.item;
		drawHandSummary(r, item, ox, oy, !!item.outlined, hand.floor);
	}
	drawCharacterFace(r, p, ox, oy, 'tab');
}

const INFO_VISIBLE_LINES = 10;

function drawInfoPane(r, p, ox, oy) {
	const held = p.inventory?.using;
	const meta = itemMeta(game.itemDefs, held);
	const infoClip = { x0: ox + 1, y0: oy + 18, x1: ox + 81, y1: oy + 94 };
	const textX = ox + 6;
	const textClip = { ...infoClip, x1: infoClip.x1 - 9 };
	const textWidth = textClip.x1 - textX;
	if (meta) drawHandSummary(r, held, ox, oy, !!held.outlined);
	drawInfoMiniWindow(r, ox, oy, infoClip);
	if (meta) {
		const lines = meta.info || [];
		const maxScroll = Math.max(0, lines.length - INFO_VISIBLE_LINES);
		const start = Math.max(0, Math.min(p.infoScroll | 0, maxScroll));
		for (let i = 0; i < Math.min(INFO_VISIBLE_LINES, lines.length - start); i++) {
			drawPaneTextClipped(r, lines[start + i], textX, oy + 20 + i * 7,
				33, textWidth, textClip);
		}
	}
	drawCharacterFace(r, p, ox, oy, 'tab');
}

const DTS_ITEM = 79;
const DTS_FARSIGHT_ITEM = 80;
const DTS_SCROLL_X_MIN = 4;
const DTS_SCROLL_X_MAX = 18;
const DTS_SCROLL_Y_MIN = 2;
const DTS_SCROLL_Y_MAX = 20;
const DTS_CLIP_X = 13;
const DTS_CLIP_Y = 16;
const DTS_CLIP_W = 128;
const DTS_CLIP_H = 79;
const DTS_TILE = 16;
const SEEN_BIT_BASE = 6;
const KEEP_2D_BLOCK = 0x3f;
const QUESTION_MARK_BIT = 10;
const KEEP_LIGHT_BIT = 31;
const BLOCK_HERE = 1 << 1;
const AUX_HERE_MAIN = 1 << 5;
const PUSHABLE_BIT = 1 << 8;
const OPAQUE_BIT = 1 << 6;
const INVISIBLE_BIT = 1 << 7;
const BLOCK_SHIFT = 11;
const VARIANT_SHIFT = 23;
const AUX_SHIFT_MAIN = 28;
const BLOCK_MASK = 0x3f;
const VARIANT_MASK = 0x1f;
const AUX_MASK_MAIN = 0xf;
const KEEP_BLOCK = BLOCK_HERE | (BLOCK_MASK << BLOCK_SHIFT);
const KEEP_AUX_MAIN = AUX_HERE_MAIN | (AUX_MASK_MAIN << AUX_SHIFT_MAIN);
const KEEP_AUX_DATA = 0x000ff000;
const AUX_DATA_SHIFT = 12;
const TEMP_OCCUPANCY_MASK = BLOCK_HERE | OPAQUE_BIT |
	(BLOCK_MASK << BLOCK_SHIFT) | (VARIANT_MASK << VARIANT_SHIFT);
const PUSH_BLOCK_CODE = BLOCK_HERE | (1 << BLOCK_SHIFT);
const AUX_SKELETON = 7;
const BLOCK_MONSTER_FIRST = 8;
const BLOCK_MONSTER_LAST = 15;
const BLOCK_PLAYER_FIRST = 32;
const BLOCK_PLAYER_LAST = 47;
const DTS_TILE_PUSHABLE = 23;
const DTS_TILE_METAL_PUSHABLE = 15;
const DTS_TILE_QUESTION = 31;
const DTS_TILE_BLOCK_BELOW = 63;
const DTS_TILE_FIELD = 39;
const DTS_ROTATION_SPRITES = [
	'dts_rotation_n', 'dts_rotation_e', 'dts_rotation_s', 'dts_rotation_w',
];

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v));
}

function dtsModuleMode(p) {
	if (carryingItem(p.inventory, DTS_FARSIGHT_ITEM)) return 'farsight';
	if (carryingItem(p.inventory, DTS_ITEM)) return 'normal';
	return 'offline';
}

function clampDtsScroll(p) {
	p.scrollX = clamp(p.scrollX ?? p.x, DTS_SCROLL_X_MIN, DTS_SCROLL_X_MAX);
	p.scrollY = clamp(p.scrollY ?? p.y, DTS_SCROLL_Y_MIN, DTS_SCROLL_Y_MAX);
}

function dtsMapClip(ox, oy) {
	return {
		x0: ox + DTS_CLIP_X,
		y0: oy + DTS_CLIP_Y,
		x1: ox + DTS_CLIP_X + DTS_CLIP_W,
		y1: oy + DTS_CLIP_Y + DTS_CLIP_H,
	};
}

function dtsStructuralCell(cell) {
	if (!(cell & BLOCK_HERE)) return cell >>> 0;
	const block = (cell >>> BLOCK_SHIFT) & BLOCK_MASK;
	if ((block >= BLOCK_MONSTER_FIRST && block <= BLOCK_MONSTER_LAST) ||
		(block >= BLOCK_PLAYER_FIRST && block <= BLOCK_PLAYER_LAST)) {
		return (cell & ~TEMP_OCCUPANCY_MASK) >>> 0;
	}
	return cell >>> 0;
}

function hiddenViewSlots(p) {
	const dir = DIRECTIONS[p.direction & 3];
	const offsets = game.tables?.facings?.[dir] || [];
	const base = playerCell(p);
	const view = offsets.map((off) => {
		const idx = base + off;
		return idx >= 0 && idx < game.cells.length
			? dtsStructuralCell(game.cells[idx])
			: 0;
	});
	const hidden = new Uint8Array(view.length);
	for (let slot = 0; slot < view.length; slot++) {
		for (const refs of game.tables?.occlusion?.[slot] || []) {
			let allOpaque = true;
			for (const ref of refs) {
				if (!((view[ref] || 0) & OPAQUE_BIT)) { allOpaque = false; break; }
			}
			if (allOpaque) { hidden[slot] = 1; break; }
		}
	}
	return { view, hidden };
}

function markSeenFromView(p) {
	if (!game.cells || !game.seen || !game.tables?.descan) return;
	const dir = DIRECTIONS[p.direction & 3];
	const descan = game.tables.descan[dir];
	if (!descan) return;
	const base = playerCell(p);
	const seenBit = SEEN_BIT_BASE + (p.index | 0);
	const seenMask = 1 << seenBit;
	const { view, hidden } = hiddenViewSlots(p);
	for (let slot = 0; slot < descan.length; slot++) {
		const off = descan[slot];
		if (off == null || hidden[slot] || ((view[slot] || 0) & INVISIBLE_BIT)) continue;
		const idx = base + off;
		if (idx < 0 || idx >= game.seen.length) continue;
		game.seen[idx] = (game.seen[idx] | seenMask) >>> 0;
	}
}

function dtsTileRect(tile) {
	const style = String(game.style?.style ?? 0);
	return game.dtsMapblocks?.styles?.[style]?.tiles?.[tile] || null;
}

function dtsTileForCell(idx, p, mode) {
	if (idx < 0 || idx >= game.cells.length) return { tile: 0, lit: false };
	const seenWord = game.seen[idx] >>> 0;
	const cell = dtsStructuralCell(game.cells[idx]);
	let lit = ((game.items[idx] >>> KEEP_LIGHT_BIT) & 1) !== 0;
	if (mode !== 'farsight' && !((seenWord >>> (SEEN_BIT_BASE + p.index)) & 1)) {
		return { tile: 0, lit: false };
	}

	let tile = (seenWord >>> QUESTION_MARK_BIT) & 1 ? DTS_TILE_QUESTION : seenWord & KEEP_2D_BLOCK;
	if (cell & PUSHABLE_BIT) {
		tile = ((cell & KEEP_BLOCK) === PUSH_BLOCK_CODE)
			? DTS_TILE_METAL_PUSHABLE
			: DTS_TILE_PUSHABLE;
	}
	if (!tile) {
		const below = idx - LEVEL_CELLS;
		const belowCell = below >= 0 ? dtsStructuralCell(game.cells[below]) : 0;
		if ((belowCell & KEEP_BLOCK) === PUSH_BLOCK_CODE) tile = DTS_TILE_BLOCK_BELOW;
		else lit = false;
	}
	if (tile === DTS_TILE_FIELD) lit = false;
	return { tile, lit };
}

function drawDtsTile(r, tile, lit, x, y, clip) {
	const rect = dtsTileRect(tile);
	if (!rect) return;
	r.drawIndexedSpriteClipped(rect, game.dtsMapblockAtlas, x, y, clip,
		lit ? LIGHT_OFFSET : 0);
}

function drawDtsStatic(r, clip) {
	const x0 = Math.max(0, clip.x0 | 0), y0 = Math.max(0, clip.y0 | 0);
	const x1 = Math.min(SCREEN_W, clip.x1 | 0), y1 = Math.min(SCREEN_H, clip.y1 | 0);
	for (let y = y0; y < y1; y++) {
		const row = y * SCREEN_W;
		for (let x = x0; x < x1; x++) {
			const dst = row + x;
			r.indices[dst] = (r.indices[dst] & ~1) | (Math.random() < 0.5 ? 1 : 0);
		}
	}
}

function drawDtsMap(r, p, ox, oy, mode, clip) {
	clampDtsScroll(p);
	for (let dy = -2; dy <= 2; dy++) {
		for (let dx = -4; dx <= 4; dx++) {
			const x = p.scrollX + dx;
			const y = p.scrollY + dy;
			const idx = x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_DEPTH
				? cellIndex(x, y, p.floor)
				: -1;
			const { tile, lit } = dtsTileForCell(idx, p, mode);
			drawDtsTile(r, tile, lit, ox + 69 + dx * DTS_TILE,
				oy + 48 + dy * DTS_TILE, clip);
		}
	}
}

function drawDtsSprite(r, key, ox, oy, clip, x = 0, y = 0) {
	const rect = game.miscUi?.sprites?.[key];
	if (rect) r.drawIndexedSpriteClipped(rect, game.miscAtlas, ox + x, oy + y, clip);
}

function drawDtsOverlays(r, p, ox, oy, clip) {
	drawDtsSprite(r, 'dts_vertline', ox, oy, clip,
		((p.x - p.scrollX) | 0) * DTS_TILE, 0);
	drawDtsSprite(r, 'dts_horizline', ox, oy, clip,
		0, ((p.y - p.scrollY) | 0) * DTS_TILE);
	drawDtsSprite(r, DTS_ROTATION_SPRITES[p.direction & 3], ox, oy, clip,
		((p.x - p.scrollX) | 0) * DTS_TILE - 7,
		((p.y - p.scrollY) | 0) * DTS_TILE - 7);
}

function drawDtsRange(r, p, ox, oy) {
	const exit = game.map?.exit;
	if (!exit) return;
	const dx = Math.abs((exit.x | 0) - (p.x | 0)) * 2;
	const dy = Math.abs((exit.y | 0) - (p.y | 0)) * 2;
	const dz = Math.abs((exit.floor | 0) - (p.floor | 0)) * 2;
	const range = Math.min(99, Math.floor(Math.sqrt(dx * dx + dy * dy + dz * dz)));
	drawPaneText(r, String(range).padStart(2, '0'), ox + 144, oy + 52, 1, 12);
}

function drawVduPane(r, p, ox, oy) {
	const mode = dtsModuleMode(p);
	const clip = dtsMapClip(ox, oy);
	markSeenFromView(p);
	if (mode === 'offline' || !game.dtsMapblocks || !game.dtsMapblockAtlas) {
		drawDtsStatic(r, clip);
	} else {
		drawDtsMap(r, p, ox, oy, mode, clip);
		drawDtsOverlays(r, p, ox, oy, clip);
		drawDtsRange(r, p, ox, oy);
	}
	drawCharacterFace(r, p, ox, oy, 'tab', 49);
}

function itoaWu(value) {
	return String(value >>> 0).padStart(5, ' ');
}

function statsBodySlot(p) {
	const part = ['front', 'left', 'right', 'back'][p.direction & 3];
	const figures = characterPortrait(p)?.figures?.[part]?.slots;
	return figures?.[41] || figures?.[61] || null;
}

function drawStatsBody(r, p, ox, oy) {
	const slot = statsBodySlot(p);
	if (!slot || !game.characterPortraitAtlas) return;
	const rect = { ...slot, x: 0, y: 0 };
	const atlas = game.characterPortraitAtlas;
	const clip = { x0: ox, y0: oy, x1: ox + PANE_W, y1: oy + PANE_H };
	r.drawMaskedSolid(rect, atlas, ox + 19, oy + 25, 21, clip);
	r.drawMaskedSolid(rect, atlas, ox + 18, oy + 24, 20, clip);
	r.drawMaskedSolid(rect, atlas, ox + 17, oy + 23, 19, clip);
	r.drawIndexedSpriteClipped(rect, atlas, ox + 16, oy + 22, clip);
}

function drawStatsPane(r, p, ox, oy) {
	const c = p.character || {};
	const s = p.stats || {};
	const face = characterPortrait(p)?.faces?.tab;
	if (face) {
		r.drawIndexedSpriteClipped(face, game.characterPortraitAtlas, ox, oy,
			{ x0: ox, y0: oy, x1: ox + 40, y1: oy + 11 }, LIGHT_OFFSET);
	}
	drawStatsBody(r, p, ox, oy);
	drawPaneText(r, c.gameName || c.name || `PLAYER ${p.index + 1}`, ox + 55, oy + 20, 2, 58);
	drawPaneText(r, c.className || c.classText || '', ox + 55, oy + 29, 13, 58);
	drawPaneText(r, c.genderName || '', ox + 113, oy + 20, 17, 42);
	drawPaneText(r, c.raceName || '', ox + 113, oy + 29, 17, 42);
	const fitnessColour = (p.poisonedStrength | 0) > 0 ? 9 : 1;
	const weightColour = p.tooHeavy ? 9 : 1;
	drawPaneText(r, itoaWu(Math.floor((s.fitness | 0) / 655)), ox + 111, oy + 41, fitnessColour, 44);
	drawPaneText(r, itoaWu(s.physique | 0), ox + 114, oy + 51, 1, 42);
	drawPaneText(r, itoaWu(s.agility | 0), ox + 114, oy + 61, 1, 42);
	drawPaneText(r, itoaWu(s.experience | 0), ox + 114, oy + 71, 1, 42);
	drawPaneText(r, itoaWu(Math.floor((s.weight | 0) / 1000)), ox + 104, oy + 81, weightColour, 52);
}

function drawDeadPane(r, ox, oy) {
	const rect = game.miscUi?.sprites?.rip;
	if (rect) drawPanePlaneOpSprite(r, rect, ox + 23, oy + 22,
		RIP_PLANE_KEEP, RIP_PLANE_SET);
	else drawCenteredPaneText(r, 'KIA', ox + 22, oy + 44, 112, 1);
}

function drawExitPane(r, p, ox, oy) {
	const rect = game.miscUi?.sprites?.exit;
	if (rect) drawPanePlaneOpSprite(r, rect, ox, oy + 22,
		RIP_PLANE_KEEP, RIP_PLANE_SET);
	else drawCenteredPaneText(r, 'EXIT', ox + 22, oy + 36, 112, 1);
	drawPaneText(r, `PLAYER ${p.index + 1}`, ox + 32, oy + 80, 33, 80);
	drawPaneText(r, 'MAY RETURN', ox + 32, oy + 87, 33, 80);
	if ((p.blockedCount | 0) > 0) drawMiscUiSprite(r, 'blocked', ox, oy);
}

function drawPanePlaneOpSprite(r, rect, x, y, fallbackKeep, fallbackSet) {
	r.drawPlaneOpSprite(rect, game.miscAtlas, x, y,
		rect.keep ?? fallbackKeep, rect.set ?? fallbackSet);
}

function skeletonCell(start) {
	let idx = start;
	while (idx >= 0) {
		const below = idx - LEVEL_CELLS;
		if (below < 0) return idx;
		const belowCell = game.cells[below] >>> 0;
		if (belowCell & BLOCK_HERE) {
			const block = (belowCell >>> BLOCK_SHIFT) & BLOCK_MASK;
			if (block >= 16 && block <= 19) {
				const side = [-MAP_WIDTH, -1, MAP_WIDTH, 1][block - 16];
				if (side && skeletonStairBlocked(below, side)) return -1;
				idx = below + (side || 0);
				continue;
			}
			if (block <= 4 || block === 5 || block === 6) return idx;
		}
		if (game.cells[idx] & 1) return idx;
		idx = below;
	}
	return -1;
}

function skeletonStairBlocked(base, side) {
	const one = base + side;
	const two = base - side;
	for (const idx of [one, two]) {
		if (idx < 0 || idx >= game.cells.length) return true;
		const cell = game.cells[idx] >>> 0;
		if (!(cell & BLOCK_HERE)) return false;
		const block = (cell >>> BLOCK_SHIFT) & BLOCK_MASK;
		if (block <= 4 || block === 5 || block === 6) return true;
	}
	return false;
}

const COMPASS_SPRITES = ['compass_n', 'compass_e', 'compass_s', 'compass_w'];
const FIRE_ANIM_NAMES = { 1: 'muzzle', 2: 'zap', 3: 'electric' };
const FITNESS_BAR_OFFSET = 214;
// The row of the flash sprite that lines up with the top of the health bar --
// i.e. where its two blank rows begin. Asserted in verify-hud.mjs.
const FLASH_BAR_ROW = 7;
const FITNESS_BAR_BASE_COLOUR = 8;
const FITNESS_BAR_DAMAGE_COLOUR = 9;
// The fallback for a planeOp sprite that declares no mask of its own. Zero
// rather than the sources' 32: see build-misc-ui.js -- keeping the lit bit made
// the claws two different colours depending on what was behind them.
// Where the two fire-effect sprites sit, from ColdStartup.s. Both are hardware
// sprites, so their coordinates are raw VSTART/HSTART and have to have the
// display origin taken off to become screen rows and columns:
//
//   muzzle_flash :1594   x = gadget_xoffset + 128+73-32 + fire_x
//                        y = gadget_yoffset + 41+51-1 + shake + 8
//   muzzle_hit   :1706   x = gadget_xoffset + 128+73 + fire_x
//                        y = gadget_yoffset + 41+57 + shake
//
// Horizontally that origin is the 128 the expressions are written against.
// Vertically it is NOT the 41 they are written against: the copper puts DIWSTRT
// at $27, which is 39 (shake_screen's patch table, Main.s:4658), so both Y
// offsets are two rows further down than the 41 suggests. Confirmed on screen --
// at 41 the flash sat a couple of pixels high.
//
// The shake is not added here: it moves the whole display in this port.
const MUZZLE_ORIGIN_X = 128;
const MUZZLE_ORIGIN_Y = 39;
const MUZZLE_X = 128 + 73 - 32 - MUZZLE_ORIGIN_X;   // 41
const MUZZLE_Y = 41 + 51 - 1 + 8 - MUZZLE_ORIGIN_Y; // 60
const MUZZLE_HIT_X = 128 + 73 - MUZZLE_ORIGIN_X;    // 73
const MUZZLE_HIT_Y = 41 + 57 - MUZZLE_ORIGIN_Y;     // 59

const CLAW_PLANE_KEEP = 0;
const CLAW_PLANE_SET = 9;
const RIP_PLANE_KEEP = 42;
const RIP_PLANE_SET = 21;
const DEAD_EXIT_CLEAR_COLOUR = 5;
const STATUS_ICON_ORDER = [
	['spellShield', 'icon_shield'],
	['spellWeights', 'icon_weights'],
	['spellWings', 'icon_wings'],
	['spellWater', 'icon_water'],
	['spellImmune', 'icon_immune'],
];

function teamIconPos(windowType) {
	if (windowType === WINDOW.VIEW) return [145, 11];
	if (windowType === WINDOW.VDU) return [143, 11];
	return [147, 11];
}

function drawTeamIcon(r, p, ox, oy, windowType) {
	if (!p || p.dead) return;
	const [x, y] = teamIconPos(windowType);
	drawMiscUiSprite(r, p.inTeam ? 'leader' : 'leader_off', ox + x, oy + y);
}

function drawViewOverlay(r, p, ox, oy) {
	const key = COMPASS_SPRITES[p.direction & 3];
	const rect = game.miscUi?.sprites?.[key];
	if (rect) r.drawIndexedSprite(rect, game.miscAtlas, ox + VIEW_X, oy + VIEW_Y);
	drawTeamIcon(r, p, ox, oy, WINDOW.VIEW);
	drawClawEffects(r, p, ox, oy);
	drawPaneHealthOverlay(r, p, ox, oy);
	drawFireEffects(r, p, ox, oy);
	drawStatusIcons(r, p, ox, oy);
	drawLockUsedMessages(r, p, ox, oy);
	drawHudMessages(r, p, ox, oy, WINDOW.VIEW);
	drawCharacterFace(r, p, ox, oy, 'view');
}

function drawPaneHealthOverlay(r, p, ox, oy) {
	drawFitnessBar(r, p, ox, oy);
	drawFitnessFlash(r, p, ox, oy);
}

function drawMiscUiSprite(r, key, x, y, clip = null) {
	const rect = game.miscUi?.sprites?.[key];
	if (!rect || !game.miscAtlas) return false;
	if (rect.mode === 'planeOp') {
		r.drawPlaneOpSprite(rect, game.miscAtlas, x, y,
			rect.keep ?? CLAW_PLANE_KEEP, rect.set ?? CLAW_PLANE_SET, clip);
	} else if (clip) {
		r.drawIndexedSpriteClipped(rect, game.miscAtlas, x, y, clip);
	} else {
		r.drawIndexedSprite(rect, game.miscAtlas, x, y);
	}
	return true;
}

function drawItemMaskShadow(r, itemNum, cx, cy) {
	const meta = itemMetaByNum(itemNum);
	const rect = meta ? game.itemImages?.items?.[meta.image] : null;
	if (!rect || !game.itemAtlas) return;
	const w = rect.w ?? rect.width, h = rect.h ?? rect.height;
	const dx0 = (cx + (rect.x || 0)) | 0;
	const dy0 = (cy + (rect.y || 0)) | 0;
	for (let yy = 0; yy < h; yy++) {
		const dy = dy0 + yy;
		if (dy < 0 || dy >= SCREEN_H) continue;
		let src = (rect.ay + yy) * game.itemAtlas.width + rect.ax;
		let dst = dy * SCREEN_W + dx0;
		for (let xx = 0; xx < w; xx++, src++, dst++) {
			const dx = dx0 + xx;
			if (dx < 0 || dx >= SCREEN_W) continue;
			if (game.itemAtlas.data[src]) r.indices[dst] = 5;
		}
	}
}

function drawHudItemIcon(r, itemNum, x, y) {
	if (!itemNum) return;
	drawItemMaskShadow(r, itemNum, x + 2, y + 2);
	drawItemIcon(r, { num: itemNum, damage: 0, ammo: 1, outlined: 0 }, x, y);
}

function drawStatusIcons(r, p, ox, oy) {
	let baseX = ox;
	for (const [prop, key] of STATUS_ICON_ORDER) {
		if (p?.[prop]) {
			drawMiscUiSprite(r, key, baseX, oy);
			baseX -= 17;
		}
	}
}

function drawLockUsedMessages(r, p, ox, oy) {
	if ((p.lockCount | 0) > 0) {
		if (p.lockKey) {
			drawMiscUiSprite(r, 'locked', ox - 46, oy + 23);
			drawHudItemIcon(r, p.lockKey, ox + 27, oy + 82);
		} else {
			drawMiscUiSprite(r, 'locked2', ox - 45, oy + 23);
		}
	}
	if ((p.usedCount | 0) > 0) {
		drawMiscUiSprite(r, 'locked', ox - 46, oy + 23);
		drawMiscUiSprite(r, 'used', ox - 46, oy + 23);
		drawHudItemIcon(r, p.usedKey, ox + 27, oy + 82);
	}
}

function livingPlayers() {
	return (game.players || []).filter((p) => p && !p.dead && p.active !== false).length;
}

/** Player display names, in slot order -- what the scroller substitutes. */
function playerNames() {
	return (game.players || []).map((p, i) => p?.character?.name || `Player ${i + 1}`);
}

/**
 * Speak a chatter line. It rides the same one-at-a-time slot as a text
 * trigger, so a remark cannot stomp a level message mid-read.
 */
function sayChatter(text, player = null) {
	if (!game.messages) return;
	const alive = (game.players || [])
		.map((p, i) => (p && !p.dead && p.active !== false ? i : -1))
		.filter((i) => i >= 0);
	if (!alive.length) return;
	const speaker = player ?? alive[(Math.random() * alive.length) | 0];
	// Queued, not forced: a remark waits its turn behind a level message.
	if (pushMessage(game.messages, text, speaker)) game.dirty = true;
}

/**
 * The message band -- CopperLists/GameCD32.s:393.
 *
 * The original reprograms rasters 141-149 into a 2-bitplane strip of its own,
 * 9 lines tall, spanning the full width between the two rows of panes. The
 * screen starts at raster 39 (diwstrt $2784), so those rasters are screen rows
 * 102-110. color00 grades down the strip -- $156 for the first two rows, then
 * $145, $134, and $124 for the rest -- which is the blue line.
 *
 * The band takes those rows over completely, exactly as the copper does, so it
 * is drawn after the panes.
 */
// Raster 141 with the screen starting at 39, i.e. just past the upper row of
// panes (their frames are 103 tall) and inside the BAND_GAP that PANE_ORIGINS
// opens up for it.
const BAND_Y = 103;
const BAND_H = 9;
// Row -> palette index, from the C_WAITs at rasters 141/143/144/145.
const BAND_ROW_COLOUR = [0, 0, 1, 2, 3, 3, 3, 3, 3];
const BAND_TEXT = BAND_PAL_BASE + 4;      // colour 1, the spoken line
const BAND_NAME = BAND_PAL_BASE + 5;      // colour 2, the speaker's name

/** Width of `text` in the in-game font, used to time the scroll. */
function measureBandText(text) {
	const font = game.font;
	if (!font) return String(text).length * 6;
	let w = 0;
	for (const ch of String(text)) {
		const code = ch.charCodeAt(0);
		const glyph = code >= font.startChar && code < font.startChar + font.count
			? code - font.startChar : '?'.charCodeAt(0) - font.startChar;
		w += font.widths[glyph] || font.cellWidth;
	}
	return w;
}

function drawMessageBand(r) {
	// The copper hands these rasters to the band for every frame of the game,
	// so the strip is always there -- it is part of the screen furniture, not
	// something that appears with a message.
	for (let row = 0; row < BAND_H; row++) {
		r.fillRow(BAND_Y + row, BAND_PAL_BASE + BAND_ROW_COLOUR[row]);
	}

	const st = game.messages;
	const active = st?.active;
	if (!active) return;
	const names = playerNames();
	const speaker = names[active.player] || '';
	const body = activeMessageText(st, names, () => active.player);
	if (!body) return;

	// The name takes colour 2 and the rest colour 1, which is what scroll_colr
	// switches between (ColdStartup.s:3396). `body` already opens with the
	// substituted name, so split it back off to colour the two halves.
	const rest = speaker && body.startsWith(speaker) ? body.slice(speaker.length) : body;
	const clip = { x0: 0, y0: BAND_Y, x1: SCREEN_W, y1: BAND_Y + BAND_H };
	const y = BAND_Y + 1;
	let x = st.scrollX | 0;
	if (speaker) {
		r.drawText(game.font, speaker, x, y, BAND_NAME, { maxWidth: SCREEN_W - x, clip });
		x += measureBandText(speaker);
	}
	r.drawText(game.font, rest, x, y, BAND_TEXT, { maxWidth: SCREEN_W - x, clip });
}

function drawHudMessages(r, p, ox, oy, windowType) {
	if (!p || windowType === WINDOW.DEAD || windowType === WINDOW.EXIT) return;
	const x = ox + 3;
	let y = oy + 26;
	let drewTop = false;
	if ((p.noAmmoCount | 0) > 0) drewTop = drawMiscUiSprite(r, 'noammo', x, y);
	else if ((p.noRoomCount | 0) > 0) drewTop = drawMiscUiSprite(r, 'noroom', x, y);
	else if (windowType !== WINDOW.INFO && p.tooHeavy) drewTop = drawMiscUiSprite(r, 'heavy', x, y);
	if (windowType === WINDOW.INFO && !drewTop) return;

	y += 17;
	if (windowType !== WINDOW.STORE) {
		if ((p.drowningCount | 0) > 0) drawMiscUiSprite(r, 'drowning', x, y);
		else if (p.poisoned || (p.poisonedStrength | 0) > 0) drawMiscUiSprite(r, 'poisoned', x, y);
		else if (p.warning) drawMiscUiSprite(r, 'warning', x, y);
	}

	y += 17;
	if (windowType !== WINDOW.STORE) {
		if ((p.activeCount | 0) > 0) drawMiscUiSprite(r, 'active', x, y);
		else if ((p.blockedCount | 0) > 0) drawMiscUiSprite(r, 'blocked', x, y);
		else if ((p.blocked2Count | 0) > 0) drawMiscUiSprite(r, 'blocked2', x, y);
		else if ((p.invalidCount | 0) > 0) drawMiscUiSprite(r, 'invalid', x, y);
	}
}

function drawFitnessBar(r, p, ox, oy) {
	if (!p?.stats || p.dead) return;
	const shifted = ((((p.stats.fitness | 0) << 5) | ((p.stats.fitness | 0) >>> 11)) & 0xffff);
	const usedBits = Math.max(1, (shifted & 0x1f) + 1);
	const damageBits = Math.max(0, 32 - usedBits);
	const x = ox + (FITNESS_BAR_OFFSET % 40) * 8;
	const y = oy + Math.floor(FITNESS_BAR_OFFSET / 40);
	r.fillRect(x, y, 32, 1, FITNESS_BAR_BASE_COLOUR);
	r.fillRect(x, y + 1, 32, 1, FITNESS_BAR_BASE_COLOUR);
	if (damageBits > 0) {
		r.fillRect(x + usedBits, y, damageBits, 1, FITNESS_BAR_DAMAGE_COLOUR);
		r.fillRect(x + usedBits, y + 1, damageBits, 1, FITNESS_BAR_DAMAGE_COLOUR);
	}
}

function drawFitnessFlash(r, p, ox, oy) {
	if (!game.fireEffects || !game.fireEffectsAtlas || (p.fitnessFlashDur | 0) <= 0 || p.dead) return;
	const frames = game.fireEffects.fitness?.frames || ['fitness_0', 'fitness_1'];
	const left = game.fireEffects.sprites?.[frames[0]];
	const right = game.fireEffects.sprites?.[frames[1]];
	if (!left || !right) return;
	// The burst straddles the bar rather than sitting on it: rows 0-6 and 9-16
	// carry ink and rows 7-8 are empty, which is the 2px health bar showing
	// through the middle. So the sprite's top belongs FLASH_BAR_ROW above the
	// bar, not at the pane origin -- drawing it at oy put the gap two pixels
	// below the bar and the whole burst read as sagging.
	//
	// The two frames are not an animation: fitness_0 occupies columns 0-15 and
	// fitness_1 columns 16-31 of the same 32-wide box, matching the original's
	// pair of 16-wide hardware sprites (ColdStartup.s:1783). Both are drawn, at
	// the same x.
	const flashX = ox + (FITNESS_BAR_OFFSET % 40) * 8;
	const flashY = oy + Math.floor(FITNESS_BAR_OFFSET / 40) - FLASH_BAR_ROW;
	const base = game.fireEffects.palettes?.fitness?.base ?? 208;
	r.drawIndexedSprite(left, game.fireEffectsAtlas, flashX, flashY, base);
	r.drawIndexedSprite(right, game.fireEffectsAtlas, flashX, flashY, base);
}

function drawClawEffects(r, p, ox, oy) {
	if (!game.miscUi || !game.miscAtlas) return;
	if ((p.clawCount | 0) > 0) {
		const rect = game.miscUi.sprites?.claws;
		if (rect) {
			const clip = { x0: ox + VIEW_X, y0: oy + VIEW_Y,
				x1: ox + VIEW_X + VIEW_W, y1: oy + VIEW_Y + VIEW_H };
			r.drawPlaneOpSprite(rect, game.miscAtlas,
				ox + VIEW_X - 20 + (p.clawX | 0), oy + VIEW_Y,
				rect.keep ?? CLAW_PLANE_KEEP, rect.set ?? CLAW_PLANE_SET, clip);
		}
	}
	if ((p.bigClawCount | 0) > 0) {
		const rect = game.miscUi.sprites?.bigclaws;
		if (rect) {
			const clip = { x0: ox + VIEW_X, y0: oy + VIEW_Y,
				x1: ox + VIEW_X + VIEW_W, y1: oy + VIEW_Y + VIEW_H };
			r.drawPlaneOpSprite(rect, game.miscAtlas,
				ox + VIEW_X - 32 + (p.bigClawX | 0), oy + VIEW_Y + 2,
				rect.keep ?? CLAW_PLANE_KEEP, rect.set ?? CLAW_PLANE_SET, clip);
		}
	}
}

function drawFireEffects(r, p, ox, oy) {
	if (!game.fireEffects || !game.fireEffectsAtlas || !p.fireAnim) return;
	const animName = FIRE_ANIM_NAMES[p.fireAnim | 0];
	const frame = Math.max(0, Math.min(4, p.fireFrame | 0));
	const sprite = animName ? game.fireEffects.sprites?.[`${animName}_${frame}`] : null;
	const muzzleBase = game.fireEffects.palettes?.muzzleBases?.[p.index] ?? 108;
	// gadget_xoffset/gadget_yoffset, Main.s:4926. The +3 and -2 are the source's.
	//
	// The source also adds 8 for players 3 and 4 (Main.s:4995, 5037), and that
	// one is NOT reproduced: the original's panes sit at y=0 and y=105 on a
	// 212-row screen with no gap between the rows, while this port inserts
	// BAND_GAP=8 for the message band and puts them at 0 and 113 on 220 rows.
	// PANE_ORIGINS therefore already carries those 8 rows for the bottom pair,
	// and adding the source's 8 on top put the flash a whole band lower than
	// the view it belongs to.
	const gadgetX = ox + 3;
	const gadgetY = oy - 2;
	if (sprite) {
		// fire_x only. muzzle_flash (ColdStartup.s:1594) adds fire_x to the
		// sprite's X and never touches its Y -- the accuracy wobble on the flash
		// is horizontal, and the vertical one was pushing the bottom of the
		// sprite off the pane where it showed as a straight cut edge.
		//
		// fire_y is still computed, and still used: muzzle_hit (:1636) reads
		// both for the splat at the far end, which is what fireHitSprite ports.
		r.drawIndexedSprite(sprite, game.fireEffectsAtlas,
			gadgetX + MUZZLE_X + (p.fireX | 0), gadgetY + MUZZLE_Y, muzzleBase);
	}
	const hit = p.fireSplat ? fireHitSprite(p) : null;
	if (hit) {
		r.drawIndexedSprite(hit.sprite, game.fireEffectsAtlas,
			gadgetX + MUZZLE_HIT_X + hit.x, gadgetY + MUZZLE_HIT_Y + hit.y,
			game.fireEffects.palettes?.hit?.base ?? 124);
	}
}

function fireHitSprite(p) {
	let x = p.fireX | 0;
	let y = p.fireY | 0;
	let pos = 8;
	if (x <= -8) {
		if (y <= -8) { pos = 7; x -= 16; y -= 16; }
		else if (y >= 8) { pos = 5; x -= 16; }
		else { pos = 6; x -= 16; y -= 8; }
	} else if (x >= 8) {
		if (y <= -8) { pos = 1; y -= 16; }
		else if (y >= 8) { pos = 3; }
		else { pos = 2; y -= 8; }
	} else if (y <= -8) { pos = 0; x -= 8; y -= 16; }
	else if (y >= 8) { pos = 4; x -= 8; }
	else { pos = 8; x -= 8; y -= 8; }
	const dist = Math.max(0, Math.min(3, p.fireDist | 0));
	const key = game.fireEffects.hit?.keys?.[dist]?.[pos] || `hit_${dist}_${pos}`;
	const sprite = game.fireEffects.sprites?.[key];
	return sprite ? { sprite, x, y } : null;
}

function paneActionUnavailable(p, actionName) {
	showHudCounter(p, 'invalidCount');
	status(`${WINDOW_NAME[p.windowType] || 'pane'} ${actionName} not implemented`);
	game.dirty = true;
	updateHUD();
}

function finishInventoryAction(p) {
	refreshPlayerFlags(p);
	game.dirty = true;
	updateHUD();
}

// ADDITION: the original has no pickup sample -- picking an item up is silent.
// pickup.wav is a hand-added clip (48kHz, not a Paula sample), so it plays at
// its own rate with no period.
const PICKUP_KEY = 'pickup';

function playPickupSfx() {
	if (game.audio?.hasKey(PICKUP_KEY)) {
		game.audio.playKey(PICKUP_KEY, { volume: 63, vary: false });
	}
}

function inventoryResultStatus(prefix, result, p) {
	if (result.armedNuke) {
		status(result.allArmed ? 'all core rings armed' : 'core ring armed');
		return;
	}
	if (result.changed) {
		status(`${prefix} ${itemName(game.itemDefs, result.item) || heldName(p)}`);
		return;
	}
	const reason = result.reason || 'blocked';
	showHudReason(p, reason);
	const msg = {
		empty: 'nothing there',
		full: 'no room',
		heavy: 'too heavy',
		no_room: 'no room',
		skeleton: 'nothing there',
	}[reason] || reason;
	status(msg);
}

function runPickupToHand(p) {
	const r = pickUpToHand(p, game.cells, game.items, game.itemDefs,
		currentItemCell(p), game.seen, game.players);
	if (r.changed) {
		playPickupSfx();
		// The body of anything that died on this cell could not be drawn while
		// the item held the aux slot; now it can.
		if (placePendingCorpse(game.monsterState, game.cells, currentItemCell(p))) game.dirty = true;
	}
	inventoryResultStatus('picked up', r, p);
	finishInventoryAction(p);
}

function runPickupIntoInventory(p) {
	const r = pickUpIntoInventory(p, game.cells, game.items, game.itemDefs,
		currentItemCell(p), game.seen, game.players);
	if (r.changed) {
		playPickupSfx();
		if (placePendingCorpse(game.monsterState, game.cells, currentItemCell(p))) game.dirty = true;
	}
	inventoryResultStatus('stored', r, p);
	finishInventoryAction(p);
}

function runStorePickup(p) {
	if (hasItem(p.inventory?.using)) {
		const r = storeHeldItem(p.inventory);
		if (r.changed) status('item stored');
		else {
			showHudReason(p, r.reason);
			status(r.reason === 'full' ? 'no room' : 'hands empty');
		}
		finishInventoryAction(p);
		return;
	}
	runPickupIntoInventory(p);
}

function runDropHeld(p) {
	const special = dropNukeOnGenerator(p, p.inventory?.using, () => {
		p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
	});
	if (special) {
		inventoryResultStatus('dropped', special, p);
		finishInventoryAction(p);
		return;
	}
	const r = dropHeldItem(p, game.cells, game.items, game.itemDefs,
		currentItemCell(p), game.seen, game.players);
	inventoryResultStatus('dropped', r, p);
	finishInventoryAction(p);
}

function runDropSelected(p) {
	const inv = p.inventory;
	const special = dropNukeOnGenerator(p, inv?.store?.[inv.pos], () => {
		removeStoreItem(inv, inv.pos);
	});
	if (special) {
		inventoryResultStatus('dropped', special, p);
		finishInventoryAction(p);
		return;
	}
	const r = dropSelectedItem(p, game.cells, game.items, game.itemDefs,
		currentItemCell(p), game.seen, game.players);
	inventoryResultStatus('dropped', r, p);
	finishInventoryAction(p);
}

function dropNukeOnGenerator(p, item, removeItem) {
	if (!hasItem(item)) return null;
	const cell = currentItemCell(p);
	const meta = itemMeta(game.itemDefs, item);
	if (meta?.category !== CATEGORY.NUKE || game.map?.locn?.style !== 4) return null;
	const word = game.cells[cell] >>> 0;
	if (!(word & AUX_HERE_MAIN) || ((word >>> AUX_SHIFT_MAIN) & AUX_MASK_MAIN) !== 0) return null;
	const unit = (game.seen[cell] & KEEP_AUX_DATA) >>> AUX_DATA_SHIFT;
	if (unit !== (meta.nuke?.number | 0)) return null;
	game.cells[cell] = ((word & ~KEEP_AUX_MAIN) | AUX_HERE_MAIN |
		(1 << AUX_SHIFT_MAIN)) >>> 0;
	game.seen[cell] = (game.seen[cell] & ~KEEP_AUX_DATA) >>> 0;
	removeItem();
	game.nukesArmed = (game.nukesArmed | 0) + 1;
	return {
		changed: true,
		item,
		armedNuke: true,
		allArmed: game.nukesArmed >= 4,
	};
}

function runReload(p) {
	const r = reloadHeldItem(p, game.itemDefs);
	if (r.changed) {
		sfxEx(25, { period: 271, vary: false });
		status(`reloaded ${heldName(p)}`);
	}
	else if (r.reason === 'no_ammo') {
		showHudReason(p, r.reason);
		status('no ammo');
	}
	else if (r.reason === 'full') status('already loaded');
	else status('nothing to reload');
	finishInventoryAction(p);
}

function consumeHeldAmmo(p, amount = 1, clearWhenEmpty = false) {
	const item = p.inventory?.using;
	if (!hasItem(item)) return false;
	if ((item.ammo | 0) < amount) return false;
	item.ammo = Math.max(0, (item.ammo | 0) - amount);
	if (clearWhenEmpty && item.ammo === 0) p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
	refreshPlayerFlags(p);
	return true;
}

function throwStartCell(p) {
	const ahead = facingCell(p);
	if (ahead < 0) return playerCell(p);
	return (game.cells[ahead] & OPAQUE_BIT) ? playerCell(p) : ahead;
}

const GRENADE_YVEL = [-5, -20, -16, -9];

function throwGrenade(p, mode = p.throwGrenadeMode ?? 3) {
	const held = p.inventory?.using;
	const meta = itemMeta(game.itemDefs, held);
	if (!hasItem(held) || meta?.category !== CATEGORY.GRENADE) {
		showHudCounter(p, 'invalidCount');
		status('no grenade readied');
		finishInventoryAction(p);
		return false;
	}
	mode = clamp(mode | 0, 0, GRENADE_YVEL.length - 1);
	p.throwGrenadeMode = mode;
	if ((held.ammo | 0) <= 0) {
		p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
		showHudCounter(p, 'noAmmoCount');
		status('no grenades');
		finishInventoryAction(p);
		return false;
	}
	const ok = addGrenade(game.combatState, game.cells, p, meta, throwStartCell(p), {
		direction: p.direction & 3,
		yvel: GRENADE_YVEL[mode],
		height: 25,
		xvel: mode,
	});
	if (ok) {
		consumeHeldAmmo(p, 1, true);
		status(`threw ${itemName(game.itemDefs, meta.index + 1)}`);
	} else {
		showHudCounter(p, 'blockedCount');
		status('throw blocked');
	}
	game.dirty = true;
	updateHUD();
	return ok;
}

function fireRelativeArcs(p, arcs, opts = {}) {
	if (!arcs) return false;
	const dir = p.direction & 3;
	const abs = {
		north: 0, south: 0, east: 0, west: 0,
		down: arcs.down | 0,
		up: arcs.up | 0,
	};
	const key = ['north', 'east', 'south', 'west'];
	abs[key[dir]] = arcs.front | 0;
	abs[key[(dir + 2) & 3]] = arcs.rear | 0;
	abs[key[(dir + 1) & 3]] = arcs.right | 0;
	abs[key[(dir + 3) & 3]] = arcs.left | 0;
	return addDirectionalFireballs(game.combatState, game.cells, game.seen, game.items,
		playerCell(p), abs, {
			speed: opts.speed ?? 1,
			decay: opts.decay ?? EXPL_DECAY,
			flameback: -1,
			owner: p.index,
			style: game.map?.locn?.style | 0,
		}, combatHooks());
}

/**
 * do_fx (ItemUsage.s:620): the noise an item makes when it is used.
 *
 * Shared, because the source shares it -- .use_gun, .use_launcher, .use_flamer,
 * .use_grlauncher and .use_mine all end in `bra do_fx`, so they all play the
 * item's own sample. It was inlined in useWeapon only, which is why the grenade
 * launcher and the mine fired silently.
 *
 * Extra samples win when the item names one; otherwise it is the item's slot in
 * the moresfx bank.
 */
function fireItemSfx(meta) {
	if (meta.exSample) sfxEx(meta.exSample, { period: meta.exSamplePeriod || 180 });
	else if (meta.sample) sfxMore(meta.sample, { period: meta.samplePeriod || 0 });
}

function useWeapon(p, meta, withFireballs = false, directHit = true) {
	const held = p.inventory?.using;
	if (!held?.ammo) {
		showHudCounter(p, 'noAmmoCount');
		sfxEx(18, { period: 180, vary: false });
		status('no ammo');
		finishInventoryAction(p);
		return false;
	}
	const rawDuration = meta.animDuration | 0;
	const shots = Math.min(Math.max(1, rawDuration === 255 ? 1 : rawDuration), held.ammo | 0);
	held.ammo -= shots;
	if (withFireballs) fireRelativeArcs(p, meta.gun?.fire, { speed: 1, decay: EXPL_DECAY });
	const target = directHit
		? fireWeaponAtTarget(game.cells, game.seen, game.items, playerCell(p),
			p, meta, game.map?.locn?.style | 0, combatHooks())
		: traceWeaponTarget(game.cells, game.seen, game.items, playerCell(p),
			p.direction & 3, game.map?.locn?.style | 0, 128, combatHooks());
	startFireAnimation(p, meta, target);
	fireItemSfx(meta);
	status(`fired ${itemName(game.itemDefs, held)}`);
	finishInventoryAction(p);
	game.dirty = true;
	return true;
}

function useGrenadeLauncher(p, meta) {
	const held = p.inventory?.using;
	if (!held?.ammo) {
		showHudCounter(p, 'noAmmoCount');
		// .no_gr_ammo (ItemUsage.s:370) writes fx_sample 3 directly rather than
		// going through do_fx, so this one is the moresfx click whether or not
		// the extra bank is loaded. Slot 3 is pinned to period 360.
		sfxMore(3);
		status('no ammo');
		finishInventoryAction(p);
		return false;
	}
	const grenadeMeta = itemMetaByNum(meta.gun?.clips?.[0] || meta.raw?.[7]);
	const ok = addGrenade(game.combatState, game.cells, p, grenadeMeta, throwStartCell(p), {
		direction: p.direction & 3,
		yvel: -1000,
		height: 25,
		xvel: -1,
	});
	if (!ok) {
		showHudCounter(p, 'blockedCount');
		status('launch blocked');
		finishInventoryAction(p);
		return false;
	}
	held.ammo--;
	startFireAnimation(p, meta, { dist: 4, hit: false });
	fireItemSfx(meta);                       // .use_grlauncher ends on bra do_fx
	status(`launched ${itemName(game.itemDefs, grenadeMeta?.index + 1) || 'grenade'}`);
	finishInventoryAction(p);
	game.dirty = true;
	return true;
}

function sentryDeployCell(p) {
	const ahead = facingCell(p);
	if (ahead < 0) return { ok: false, reason: 'blocked' };
	const cell = game.cells[ahead] >>> 0;
	if (cell & (BLOCK_HERE | OPAQUE_BIT)) return { ok: false, reason: 'no_room' };
	const below = ahead - LEVEL_CELLS;
	if (below < 0) return { ok: false, reason: 'invalid' };
	const support = game.cells[below] >>> 0;
	if (support & 1) return { ok: true, cell: ahead };
	if (!(support & BLOCK_HERE)) return { ok: false, reason: 'invalid' };
	const block = (support >>> BLOCK_SHIFT) & BLOCK_MASK;
	if (block === BLOCK.TREE || block >= BLOCK.DOOR_FRONT) return { ok: false, reason: 'invalid' };
	if (block >= BLOCK_MONSTER_FIRST && block <= BLOCK_MONSTER_LAST) return { ok: false, reason: 'invalid' };
	return { ok: true, cell: ahead };
}

function useSentry(p, meta) {
	// Pointed at a sentry that is already there, the kit reprograms it instead
	// of trying to deploy into an occupied cell. Same item, same button: which
	// one you get depends on what you are facing.
	const ahead = facingCell(p);
	if (ahead >= 0 && sentryAtCell(game.sentryState, ahead)) {
		return takeOverSentryAhead(p, ahead);
	}

	const held = p.inventory?.using;
	if (!held?.ammo) {
		p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
		showHudCounter(p, 'noAmmoCount');
		status('no sentry kit');
		finishInventoryAction(p);
		return false;
	}
	const dest = sentryDeployCell(p);
	if (!dest.ok) {
		showHudReason(p, dest.reason);
		status(dest.reason === 'invalid' ? 'invalid position' : 'no room');
		finishInventoryAction(p);
		return false;
	}
	if (!addSentry(game.sentryState, game.cells, dest.cell, p.direction & 3, meta, p.index + 1)) {
		showHudCounter(p, 'noRoomCount');
		status('no room');
		finishInventoryAction(p);
		return false;
	}
	consumeHeldAmmo(p, 1, true);
	status('sentry deployed');
	game.dirty = true;
	updateHUD();
	return true;
}

/**
 * Reprogram the sentry in front of you: it becomes yours and stops shooting the
 * party. Costs a charge, the same as deploying one.
 */
function takeOverSentryAhead(p, ahead) {
	const held = p.inventory?.using;
	if (!held?.ammo) {
		showHudCounter(p, 'noAmmoCount');
		status('no sentry kit');
		finishInventoryAction(p);
		return false;
	}
	const done = takeOverSentry(game.sentryState, game.cells, ahead, p.index + 1);
	if (!done) {
		showHudCounter(p, 'noRoomCount');
		finishInventoryAction(p);
		return false;
	}
	consumeHeldAmmo(p, 1, true);
	status(done.wasHostile
		? 'sentry reprogrammed -- it will hold its fire'
		: 'sentry already held its fire; it is yours now');
	game.dirty = true;
	updateHUD();
	return true;
}

function clearPoison(p) {
	p.poisonedStrength = 0;
	p.poisoned = false;
	p.poisonedTotal = 0;
}

function useFood(p, meta) {
	const race = p.character?.race ?? 0;
	if (race === 1 || race === 4) {
		showHudCounter(p, 'invalidCount');
		status('cannot use');
		finishInventoryAction(p);
		return false;
	}
	if (p.inventory.using.num === 64) clearPoison(p);
	if (incrementFitness(p, meta.food?.fitnessBoost | 0)) p.fitnessFlashDur = 0;
	incrementPhysique(p, meta.food?.physiqueBoost | 0);
	p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
	status('used food');
	finishInventoryAction(p);
	return true;
}

function useRepair(p, meta) {
	const race = p.character?.race ?? 0;
	if (race !== 1 && race !== 4) {
		showHudCounter(p, 'invalidCount');
		status('cannot use');
		finishInventoryAction(p);
		return false;
	}
	if (incrementFitness(p, meta.repair?.fitnessBoost | 0)) p.fitnessFlashDur = 0;
	incrementPhysique(p, meta.repair?.physiqueBoost | 0);
	p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
	status('repaired');
	finishInventoryAction(p);
	return true;
}

function useImmune(p, meta) {
	const race = p.character?.race ?? 0;
	if (race === 1 || race === 4) {
		showHudCounter(p, 'invalidCount');
		status('cannot use');
		finishInventoryAction(p);
		return false;
	}
	clearPoison(p);
	p.spellImmune = -1;
	p.iconImmuDur = meta.immune?.duration | 0;
	p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
	status('immune');
	finishInventoryAction(p);
	return true;
}

function useMine(p, meta) {
	const armed = meta.mine?.armedItem | 0;
	if (!armed) {
		showHudCounter(p, 'invalidCount');
		status('cannot arm');
		finishInventoryAction(p);
		return false;
	}
	p.inventory.using.num = armed;
	fireItemSfx(meta);                       // .use_mine ends on bra do_fx too
	status('mine armed');
	finishInventoryAction(p);
	return true;
}

function setBlock(cell, block) {
	game.cells[cell] = ((game.cells[cell] & ~KEEP_BLOCK) |
		BLOCK_HERE | (block << BLOCK_SHIFT)) >>> 0;
}

function clearBlockAt(cell) {
	game.cells[cell] = (game.cells[cell] & ~KEEP_BLOCK & ~BLOCK_HERE & ~OPAQUE_BIT) >>> 0;
}

function setFloor(cell, floorType) {
	const keepFloor = 1 | (0x3 << 9);
	game.cells[cell] = ((game.cells[cell] & ~keepFloor) | 1 | ((floorType & 3) << 9)) >>> 0;
}

function usePsiAmmo(p) {
	const held = p.inventory?.using;
	if (!held?.ammo) {
		p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
		showHudCounter(p, 'noAmmoCount');
		status('psi amp empty');
		finishInventoryAction(p);
		return false;
	}
	if (held.ammo === 1) p.inventory.using = { num: 0, damage: 0, ammo: 0, outlined: 0 };
	else held.ammo--;
	addExperience(p, 5);
	refreshPlayerFlags(p);
	return true;
}

function blastCell(p, cell, damage) {
	return damageOccupantAtCell(cell, {
		playerDamage: damage,
		monsterDamage: damage,
		sentryDamage: damage,
		owner: p.index,
		source: 'psi',
	});
}

function blastCube(p, damage) {
	const at = playerCell(p);
	for (let dz = -3; dz <= 3; dz++) {
		for (let dy = -3; dy <= 3; dy++) {
			for (let dx = -3; dx <= 3; dx++) {
				if (!dx && !dy && !dz) continue;
				const cell = at + dx + dy * MAP_WIDTH + dz * LEVEL_CELLS;
				blastCell(p, cell, damage);
			}
		}
	}
}

function revealFloor(p) {
	const base = p.floor * LEVEL_CELLS;
	const mask = 1 << (SEEN_BIT_BASE + p.index);
	for (let i = 0; i < LEVEL_CELLS; i++) game.seen[base + i] = (game.seen[base + i] | mask) >>> 0;
}

function randomTeleport(p) {
	removeHeadFromMap(game.cells, p.x, p.y, p.floor);
	for (let i = 0; i < 100; i++) {
		const x = Math.floor(Math.random() * MAP_WIDTH);
		const y = Math.floor(Math.random() * MAP_DEPTH);
		const floor = Math.floor(Math.random() * MAP_HEIGHT);
		const cell = cellIndex(x, y, floor);
		const word = game.cells[cell] >>> 0;
		const below = cell - LEVEL_CELLS;
		const support = below >= 0 ? game.cells[below] >>> 0 : 0;
		if ((word & (BLOCK_HERE | OPAQUE_BIT | 16)) || (!(word & 1) &&
				!(support & (BLOCK_HERE | OPAQUE_BIT)))) continue;
		p.x = x; p.y = y; p.floor = floor;
		putHeadInMap(game.cells, p);
		return true;
	}
	putHeadInMap(game.cells, p);
	return false;
}

// erase_item_type & erase_item_damage & erase_item_ammo: the low three bytes of
// the items layer. Bit 31 up there is the light bit, so the mask has to stop
// short of it.
const ITEM_DATA_MASK = 0x00ffffff;
const CONT_CONSUMABLE = 3;                   // Equates.i:813
const QUENCH_ITEM = 56;                      // the bottle -- items.json index 55

/**
 * .cleave_wave (ItemUsage.s:1673). Empties the water column standing above a
 * cell: clear the water field and the flowing bit, step up a level, repeat
 * until a level has neither.
 *
 * "Up" is +LEVEL_CELLS, matching the original's add -- the same step canDropAt
 * subtracts to look at the cell below.
 */
function cleaveWave(cell) {
	for (let at = cell; at >= 0 && at < game.cells.length; at += LEVEL_CELLS) {
		const wet = (game.cells[at] & WATER_HERE) !== 0;
		const flowing = ((game.seen[at] >>> FLOWING_BIT) & 1) !== 0;
		if (!wet && !flowing) return;
		game.cells[at] = (game.cells[at] & ~KEEP_WATER) >>> 0;
		game.seen[at] = (game.seen[at] & ~(1 << FLOWING_BIT)) >>> 0;
	}
}

/**
 * .part_waves (ItemUsage.s:1618). A channel through the water, running from the
 * caster's own cell in the direction they face, cleaving each cell's column as
 * it goes and stopping at the first dry one.
 *
 * The caster's own cell is the exception: dry there does not end the walk, so
 * standing on the shore facing a lake still parts it. Nothing cleaved at all
 * means the amp reports invalid and keeps its charge.
 *
 * The original walks off the edge of the map -- a2 just keeps stepping and the
 * loop only ever ends on dry water. The bounds check is an addition; the outer
 * ring of a map is solid, which is why it never showed.
 */
function partWaves(p) {
	const [dx, dy] = STEP_DELTA[p.direction & 3];
	let x = p.x, y = p.y, own = true, cleaved = false;
	for (;;) {
		const cell = cellIndex(x, y, p.floor);
		if (game.cells[cell] & KEEP_WATER) {
			cleaveWave(cell);
			cleaved = true;
		} else if (!own) break;
		own = false;
		x += dx; y += dy;
		if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_DEPTH) break;
	}
	return cleaved;
}

/**
 * .quench (ItemUsage.s:1693). Underwater, this fills a container: the caster's
 * own cell gains a consumable holding a bottle of clean water.
 *
 * It wants water, no aux already in the way, and something to stand the bottle
 * on -- either a floor here, or an opaque cell one level down.
 */
function quench(p) {
	const cell = playerCell(p);
	const word = game.cells[cell] >>> 0;
	if (!(word & WATER_HERE) || (word & AUX_HERE_MAIN)) return false;
	if (!(word & 1)) {
		const below = cell - LEVEL_CELLS;
		if (below < 0 || !(game.cells[below] & OPAQUE_BIT)) return false;
	}
	game.cells[cell] = ((word & ~KEEP_AUX_MAIN) | AUX_HERE_MAIN |
		(CONT_CONSUMABLE << AUX_SHIFT_MAIN)) >>> 0;
	game.items[cell] = ((game.items[cell] & ~ITEM_DATA_MASK) | QUENCH_ITEM) >>> 0;
	return true;
}

function usePsi(p) {
	const num = p.inventory?.using?.num | 0;
	const beforeAmmo = p.inventory?.using?.ammo | 0;
	const ahead = facingCell(p);
	const consumeAfterValid = (ok) => {
		if (!ok) {
			showHudCounter(p, 'invalidCount');
			status('invalid');
			finishInventoryAction(p);
			return false;
		}
		if (!usePsiAmmo(p)) return false;
		game.dirty = true;
		updateHUD();
		return true;
	};
	switch (num) {
		case 82:
			return consumeAfterValid(addCombatFireball(playerCell(p), {
				direction: p.direction & 3, speed: 0, decay: EXPL_DECAY,
				density: 1, flameback: p.direction & 3, owner: p.index,
			}));
		case 83:
			return consumeAfterValid(addCombatFireball(playerCell(p), {
				direction: p.direction & 3, speed: 0, decay: EXPL_DECAY,
				density: 3, flameback: p.direction & 3, owner: p.index,
			}));
		case 84:
			return consumeAfterValid([0, 1, 2, 3].reduce((ok, d) =>
				addCombatFireball(playerCell(p), {
					direction: d, speed: 0, decay: EXPL_DECAY, density: 1, flameback: d, owner: p.index,
				}) || ok, false));
		case 85:
			return consumeAfterValid([0, 1, 2, 3].reduce((ok, d) =>
				addCombatFireball(playerCell(p), {
					direction: d, speed: 0, decay: EXPL_NO_DECAY, density: 3, flameback: d, owner: p.index,
				}) || ok, false));
		case 86:
		case 87:
			p.spellShield = num; p.iconShieldDur = 3000; break;
		case 88:
		case 89: {
			if (p.spellWeights) {
				p.stats.physique = Math.max(1, (p.stats.physique | 0) - (p.spellWeights | 0));
			}
			const gain = num === 88 ? Math.floor((p.stats.physique | 0) / 2) : (p.stats.physique | 0);
			p.spellWeights = gain;
			p.iconWeightsDur = 3000;
			incrementPhysique(p, gain);
			break;
		}
		case 90:
			if (ahead < 0 || (game.cells[ahead] & BLOCK_HERE)) return consumeAfterValid(false);
			setBlock(ahead, BLOCK.FIELD3);
			break;
		case 91:
			if (ahead < 0 || (((game.cells[ahead] >>> BLOCK_SHIFT) & BLOCK_MASK) !== BLOCK.FIELD3)) {
				return consumeAfterValid(false);
			}
			clearBlockAt(ahead);
			break;
		case 92:
			if (ahead < 0 || (game.cells[ahead] & 1)) return consumeAfterValid(false);
			setFloor(ahead, 2);
			break;
		// .float is a bare ";not used" label that falls straight into .feather
		// (ItemUsage.s:1494), so FLOAT and FEATHER are the same spell. Its item
		// entry is blank too -- it is only reachable through MIRACLE.
		case 93:
		case 94:
			p.spellWings = 24; p.iconWingsDur = 12000; break;
		case 95:
			blastCube(p, 20000); break;
		case 96:
			blastCube(p, 40000); break;
		case 97:
		case 100:
			p.spellWater = num; p.iconWaterDur = 12000; break;
		case 98:
			return consumeAfterValid(partWaves(p));
		case 99:
			return consumeAfterValid(quench(p));
		case 101:
		case 102:
		case 103: {
			const damage = num === 101 ? 10000 : num === 102 ? 30000 : 60000;
			const target = traceWeaponTarget(game.cells, game.seen, game.items, playerCell(p),
				p.direction & 3, game.map?.locn?.style | 0, 128, combatHooks());
			blastCell(p, target.cell, damage);
			break;
		}
		case 104:
			revealFloor(p);
			break;
		case 105:
			if (!randomTeleport(p)) {
				showHudCounter(p, 'blockedCount');
				status('blocked');
				finishInventoryAction(p);
				return false;
			}
			break;
		// .shift is the other ";not used" label (ItemUsage.s:1942); it falls into
		// .cure_poison. Blank item entry, MIRACLE-only, same as FLOAT.
		case 106:
		case 107:
			clearPoison(p);
			break;
		case 108:
			p.stats.fitness = 65535;
			clearPoison(p);
			break;
		case 109: {
			const slot = p.inventory.store[p.inventory.pos];
			if (!hasItem(slot)) return consumeAfterValid(false);
			slot.num = 54 + Math.floor(Math.random() * 11);
			slot.damage = 0; slot.ammo = 0; slot.outlined = 0;
			break;
		}
		case 110: {
			const rolled = 82 + Math.floor(Math.random() * 28);
			const original = p.inventory.using.num;
			p.inventory.using.num = rolled;
			const used = usePsi(p);
			if (hasItem(p.inventory?.using) && p.inventory.using.num === rolled) {
				p.inventory.using.num = original;
			}
			return used;
		}
		default:
			showHudCounter(p, beforeAmmo ? 'invalidCount' : 'noAmmoCount');
			status(beforeAmmo ? 'psi not implemented' : 'psi amp empty');
			finishInventoryAction(p);
			return false;
	}
	return consumeAfterValid(true);
}

function runUseItem(p) {
	const held = p.inventory?.using;
	const meta = itemMeta(game.itemDefs, held);
	if (!hasItem(held) || !meta) {
		status('hands empty');
		finishInventoryAction(p);
		return false;
	}
	switch (meta.category) {
		case CATEGORY.GUN:
			return useWeapon(p, meta, false, true);
		case CATEGORY.LAUNCHER:
			return useWeapon(p, meta, true, true);
		case CATEGORY.FLAMER:
			return useWeapon(p, meta, true, false);
		case CATEGORY.GRLAUNCHER:
			return useGrenadeLauncher(p, meta);
		case CATEGORY.GRENADE:
			return throwGrenade(p);
		case CATEGORY.SENTRY:
			return useSentry(p, meta);
		case CATEGORY.MINE:
			return useMine(p, meta);
		case CATEGORY.FOOD:
			return useFood(p, meta);
		case CATEGORY.REPAIR:
			return useRepair(p, meta);
		case CATEGORY.IMMU:
			return useImmune(p, meta);
		case CATEGORY.PSIAMP:
			return usePsi(p);
		case CATEGORY.DTS:
		case CATEGORY.SENTRYCNTRL:
			status('activated');
			finishInventoryAction(p);
			return true;
		default:
			showHudCounter(p, 'invalidCount');
			status('nothing happens');
			finishInventoryAction(p);
			return false;
	}
}

function toggleInfoWindow(p) {
	if ((p.windowType ?? WINDOW.VIEW) === WINDOW.INFO) {
		p.windowType = WINDOW.STORE;
	} else if ((p.windowType ?? WINDOW.VIEW) === WINDOW.STORE && hasItem(p.inventory?.using)) {
		p.windowType = WINDOW.INFO;
		p.infoScroll = 0;
	} else {
		status('nothing to inspect');
	}
	game.dirty = true;
	updateHUD();
}

function scrollInfoText(p, dir) {
	const lines = itemMeta(game.itemDefs, p.inventory?.using)?.info || [];
	const maxScroll = Math.max(0, lines.length - INFO_VISIBLE_LINES);
	const old = Math.max(0, Math.min(p.infoScroll | 0, maxScroll));
	const next = Math.max(0, Math.min(old + dir, maxScroll));
	p.infoScroll = next;
	status(next === old ? 'end of info' : `info line ${next + 1}`);
	game.dirty = true;
	updateHUD();
}

function scrollDtsWindow(p, dx, dy) {
	clampDtsScroll(p);
	const oldX = p.scrollX, oldY = p.scrollY;
	p.scrollX = clamp(p.scrollX + dx, DTS_SCROLL_X_MIN, DTS_SCROLL_X_MAX);
	p.scrollY = clamp(p.scrollY + dy, DTS_SCROLL_Y_MIN, DTS_SCROLL_Y_MAX);
	status(p.scrollX === oldX && p.scrollY === oldY
		? 'DTS edge'
		: `DTS ${p.scrollX},${p.scrollY}`);
	game.dirty = true;
	updateHUD();
}

function lockDtsToPlayer(p) {
	p.scrollX = p.x;
	p.scrollY = p.y;
	clampDtsScroll(p);
	status(`DTS locked to player ${p.index + 1}`);
	game.dirty = true;
	updateHUD();
}

function runStoreAction(p, action) {
	if ((p.windowType ?? WINDOW.VIEW) === WINDOW.INFO) {
		if (action === GADGET.SUMMON_INFO || action === GADGET.LEAVE_INFO) toggleInfoWindow(p);
		else if (action === GADGET.FORWARD) scrollInfoText(p, -1);
		else if (action === GADGET.BACKWARD) scrollInfoText(p, 1);
		else if (action === GADGET.VIEW || action === GADGET.VDU || action === GADGET.STATS) runPaneAction(p, action);
		else paneActionUnavailable(p, 'info');
		return;
	}

	switch (action) {
		case GADGET.FORWARD:
			if (scrollInventory(p.inventory, -1)) status(`selected ${selectedName(p)}`);
			finishInventoryAction(p);
			break;
		case GADGET.BACKWARD:
			if (scrollInventory(p.inventory, 1)) status(`selected ${selectedName(p)}`);
			finishInventoryAction(p);
			break;
		case GADGET.TURN_RIGHT: {
			const r = takeOrSwapSelected(p.inventory);
			if (r.changed) status(`using ${heldName(p)}`);
			else status('nothing there');
			finishInventoryAction(p);
			break;
		}
		case GADGET.TURN_LEFT: {
			const r = storeHeldItem(p.inventory);
			if (r.changed) status('item stored');
			else {
				showHudReason(p, r.reason);
				status(r.reason === 'full' ? 'no room' : 'hands empty');
			}
			finishInventoryAction(p);
			break;
		}
		case GADGET.PICK_UP:
			runStorePickup(p);
			break;
		case GADGET.PICK_UP_INTO_INVEN:
		case GADGET.ACTIVATE:
			runPickupIntoInventory(p);
			break;
		case GADGET.DROP_ITEM:
			runDropHeld(p);
			break;
		case GADGET.DROP_FROM_INVEN:
		case GADGET.PULL:
			runDropSelected(p);
			break;
		case GADGET.RELOAD_ITEM:
			runReload(p);
			break;
		case GADGET.USE_ITEM:
			runUseItem(p);
			break;
		case GADGET.SUMMON_INFO:
			toggleInfoWindow(p);
			break;
		default:
			paneActionUnavailable(p, 'control');
			break;
	}
}

function runPaneAction(p, action) {
	if (game.mission?.complete) {
		status(missionLabel(game.mission.type));
		game.dirty = true;
		updateHUD();
		return;
	}
	const windowType = p.windowType ?? WINDOW.VIEW;
	const inView = windowType === WINDOW.VIEW;
	const auto = !!p.autoMove;
	if (inView && !auto && (action === GADGET.FORWARD || action === GADGET.BACKWARD ||
		action === GADGET.TURN_LEFT || action === GADGET.TURN_RIGHT ||
		action === GADGET.SIDESTEP_LEFT || action === GADGET.SIDESTEP_RIGHT ||
		action === GADGET.ACTIVATE || action === GADGET.PULL)) {
		setLeader(game.team, p);
	}
	if (windowType === WINDOW.STORE || windowType === WINDOW.INFO) {
		switch (action) {
			case GADGET.VIEW:
			case GADGET.VDU:
			case GADGET.STATS:
			case GADGET.LEFT_WINDOW:
			case GADGET.RIGHT_WINDOW:
			case GADGET.SET_TEAM:
			case GADGET.NONE:
				break;
			default:
				runStoreAction(p, action);
				return;
		}
	}
	if (windowType === WINDOW.VDU) {
		switch (action) {
			case GADGET.FORWARD:
				scrollDtsWindow(p, 0, -1);
				return;
			case GADGET.BACKWARD:
				scrollDtsWindow(p, 0, 1);
				return;
			case GADGET.TURN_LEFT:
				scrollDtsWindow(p, -1, 0);
				return;
			case GADGET.TURN_RIGHT:
				scrollDtsWindow(p, 1, 0);
				return;
			case GADGET.LOCK_TO_PLAYER:
				lockDtsToPlayer(p);
				return;
			default:
				break;
		}
	}
	switch (action) {
		case GADGET.FORWARD:
			if (inView) step(p, p.direction, auto);
			else paneActionUnavailable(p, 'up');
			break;
		case GADGET.BACKWARD:
			if (inView) step(p, (p.direction + 2) & 3, auto);
			else paneActionUnavailable(p, 'down');
			break;
		case GADGET.TURN_LEFT:
			if (inView) { p.direction = (p.direction + 3) & 3; putHeadInMap(game.cells, p); }
			else paneActionUnavailable(p, 'left');
			break;
		case GADGET.TURN_RIGHT:
			if (inView) { p.direction = (p.direction + 1) & 3; putHeadInMap(game.cells, p); }
			else paneActionUnavailable(p, 'right');
			break;
		case GADGET.SIDESTEP_LEFT:
			if (inView) step(p, (p.direction + 3) & 3, auto);
			else paneActionUnavailable(p, 'left');
			break;
		case GADGET.SIDESTEP_RIGHT:
			if (inView) step(p, (p.direction + 1) & 3, auto);
			else paneActionUnavailable(p, 'right');
			break;
		case GADGET.ACTIVATE:
			if (inView) activate(p);
			else paneActionUnavailable(p, 'activate');
			break;
		case GADGET.PULL:
			if (inView) pull(p);
			else paneActionUnavailable(p, 'pull');
			break;
		case GADGET.PICK_UP:
			runPickupToHand(p);
			break;
		case GADGET.PICK_UP_INTO_INVEN:
			runPickupIntoInventory(p);
			break;
		case GADGET.DROP_ITEM:
			runDropHeld(p);
			break;
		case GADGET.DROP_FROM_INVEN:
			runDropSelected(p);
			break;
		case GADGET.RELOAD_ITEM:
			runReload(p);
			break;
		case GADGET.THROW_G:
			if (inView) throwGrenade(p);
			else paneActionUnavailable(p, 'throw');
			break;
		case GADGET.THROW_G4:
			if (inView) throwGrenade(p, 3);
			else paneActionUnavailable(p, 'throw');
			break;
		case GADGET.THROW_G3:
			if (inView) throwGrenade(p, 2);
			else paneActionUnavailable(p, 'throw');
			break;
		case GADGET.THROW_G2:
			if (inView) throwGrenade(p, 1);
			else paneActionUnavailable(p, 'throw');
			break;
		case GADGET.THROW_G1:
			if (inView) throwGrenade(p, 0);
			else paneActionUnavailable(p, 'throw');
			break;
		case GADGET.LEFT_WINDOW:
			shiftPaneWindow(p, -1);
			break;
		case GADGET.RIGHT_WINDOW:
			shiftPaneWindow(p, 1);
			break;
		case GADGET.VIEW:
			setPaneWindow(p, WINDOW.VIEW);
			break;
		case GADGET.STORE:
			setPaneWindow(p, WINDOW.STORE);
			break;
		case GADGET.VDU:
			setPaneWindow(p, WINDOW.VDU);
			break;
		case GADGET.STATS:
			setPaneWindow(p, WINDOW.STATS);
			break;
		case GADGET.SET_TEAM:
			setTeam(game.team, p);
			status(`player ${p.index + 1} ${p.inTeam ? 'in team' : 'solo'}`);
			game.dirty = true;
			updateHUD();
			break;
		case GADGET.SUMMON_INFO:
		case GADGET.LEAVE_INFO:
			toggleInfoWindow(p);
			break;
		case GADGET.NONE:
			break;
		default:
			paneActionUnavailable(p, 'control');
			break;
	}
}

function setupMouseCursor(canvas) {
	if (!game.cursors) return;
	const img = document.createElement('img');
	img.id = 'hg-cursor';
	img.alt = '';
	document.body.appendChild(img);
	game.cursorEl = img;
	game.cursorSprite = -1;
	canvas.style.cursor = 'none';

	for (const file of game.cursors.sets?.[0]?.files || []) {
		const preload = new Image();
		preload.src = ASSETS + file;
	}
}

function hideMouseCursor() {
	if (game.cursorEl) game.cursorEl.style.display = 'none';
	const canvas = $('screen');
	if (canvas) canvas.style.cursor = game.cursors ? 'none' : '';
}

function updateMouseCursor(e) {
	// Touch pointers get persistent on-canvas action buttons instead. Showing a
	// mouse cursor at the last tapped point is both misleading and obstructive.
	if (e.pointerType && e.pointerType !== 'mouse') return;
	const img = game.cursorEl;
	const files = game.cursors?.sets?.[0]?.files;
	if (!img || !files) return;
	const canvas = $('screen');
	const rect = canvas.getBoundingClientRect();
	const inside = e.clientX >= rect.left && e.clientX < rect.right &&
		e.clientY >= rect.top && e.clientY < rect.bottom;
	if (!inside) { hideMouseCursor(); return; }

	const sx = Math.floor((e.clientX - rect.left) * SCREEN_W / rect.width);
	const sy = Math.floor((e.clientY - rect.top) * SCREEN_H / rect.height);
	const hit = pickGadget(sx, sy, PANE_ORIGINS, PANE_W, PANE_H, false, game.players);
	const sprite = Math.max(0, Math.min(files.length - 1, hit?.gadget?.sprite ?? 0));
	if (sprite !== game.cursorSprite) {
		img.src = ASSETS + files[sprite];
		game.cursorSprite = sprite;
	}

	const scale = rect.width / SCREEN_W;
	const hot = game.cursors.hotspot || { x: 8, y: 8 };
	img.style.width = `${game.cursors.width * scale}px`;
	img.style.height = `${game.cursors.height * scale}px`;
	img.style.left = `${e.clientX - hot.x * scale}px`;
	img.style.top = `${e.clientY - hot.y * scale}px`;
	img.style.display = 'block';
}

/**
 * Mouse control. The gadget tables carve each pane into action rectangles
 * (gadgets.js), so a click is: find the pane, find the gadget, run its action.
 * Clicking a pane also makes that player the active one, which is how the
 * original lets you drive any of the four without the number keys.
 */
function shellPointer(e) {
	const canvas = $('shell-canvas') || $('screen');
	const rect = canvas.getBoundingClientRect();
	// The shell canvas is presented at the game's box but is 640x512 inside,
	// so pointer coordinates map through SHELL_W/SHELL_H, not SCREEN_W/H.
	return {
		sx: Math.floor((e.clientX - rect.left) * SHELL_W / rect.width),
		sy: Math.floor((e.clientY - rect.top) * SHELL_H / rect.height),
	};
}

function isTouchPointer(e) {
	return e?.pointerType === 'touch';
}

function onShellMove(e) {
	if (game.shell?.mode !== SHELL.WORLD) return;
	const { sx, sy } = shellPointer(e);
	if (game.shell.drag) {
		if (moveWorldDrag(game.shell, sx, sy, game.frontendArt)) {
			game.dirty = true;
			paintShellFrame();
		}
		return;
	}
	// Not dragging: say what a click here would pick. The panel described only
	// the keyboard cursor before, so with a mouse there was no way to tell one
	// marker from another until you had already committed to it.
	if (hoverWorld(game.shell, sx, sy, game.frontendArt)) {
		game.dirty = true;
		paintShellFrame();
	}
}

function onShellLeave() {
	if (game.shell?.mode !== SHELL.WORLD) return;
	if (clearWorldHover(game.shell)) {
		game.dirty = true;
		paintShellFrame();
	}
}

function onShellUp(e) {
	if (game.shell?.mode !== SHELL.WORLD) return;
	const dragged = endWorldDrag(game.shell);
	if (dragged) {
		game.dirty = true;
		paintShellFrame();
		return;
	}
	const { sx, sy } = shellPointer(e);
	applyShellEvent(handleShellClick(game.shell, game.campaign, sx, sy,
		game.frontendArt, isTouchPointer(e)));
}

function onMouse(e) {
	unlockAudio();
	if (game.shell?.mode && game.shell.mode !== SHELL.GAME) {
		e.preventDefault();
		const { sx, sy } = shellPointer(e);
		if (game.shell.mode === SHELL.WORLD) startWorldDrag(game.shell, sx, sy);
		else applyShellEvent(handleShellClick(game.shell, game.campaign, sx, sy,
			game.frontendArt, isTouchPointer(e)));
		return;
	}
	const canvas = $('screen');
	const rect = canvas.getBoundingClientRect();
	// Undo the integer upscale to get 320x212 screen pixels.
	const sx = Math.floor((e.clientX - rect.left) * SCREEN_W / rect.width);
	const sy = Math.floor((e.clientY - rect.top) * SCREEN_H / rect.height);
	const hit = pickGadget(sx, sy, PANE_ORIGINS, PANE_W, PANE_H, e.button === 2, game.players);
	if (!hit) return;
	e.preventDefault();

	game.active = hit.pane;
	const p = game.players[hit.pane];
	if (!p || !p.active) return;
	runPaneAction(p, hit.action);
	game.dirty = true;
	updateHUD();
	updateMouseCursor(e);
}

// ---------------------------------------------------------------------------
// Touch-only contextual actions.
//
// The original makes pickup the right-button alternate of sidestep-left, and
// pull/reload the alternate of the central action zone. A blanket "tap means
// right click" would therefore remove essential movement and firing. These
// buttons temporarily occupy the pickup corner only when there is a useful
// alternate action to perform. Fine-pointer desktop layouts never enable them.

const MOBILE_QUERY = typeof matchMedia === 'function'
	? matchMedia('(hover: none), (pointer: coarse)') : null;

function mobileControlsEnabled() {
	return !!MOBILE_QUERY?.matches;
}

function setMobileActionContents(button, action) {
	if (button.dataset.action === action) return;
	button.dataset.action = action;
	button.replaceChildren();
	if (action === 'pickup') {
		const img = document.createElement('img');
		img.src = `${ASSETS}cursors/mouse0-6.png`;
		img.alt = '';
		button.appendChild(img);
		button.title = 'Pick up into inventory';
		button.setAttribute('aria-label', 'Pick up into inventory');
	} else if (action === 'reload') {
		button.textContent = '↻';
		button.title = 'Reload';
		button.setAttribute('aria-label', 'Reload');
	} else if (action === 'pull') {
		button.textContent = '⇩';
		button.title = 'Pull';
		button.setAttribute('aria-label', 'Pull');
	}
}

function updateMobileActions() {
	const host = $('mobile-actions');
	if (!host) return;
	const visible = mobileControlsEnabled() && game.shell?.mode === SHELL.GAME && !!game.map;
	host.classList.toggle('hidden', !visible);
	const stage = $('stage');
	const scale = stage ? stage.getBoundingClientRect().width / SCREEN_W : 1;
	for (const button of host.querySelectorAll('.mobile-action')) {
		const pane = Number(button.dataset.pane);
		const p = game.players?.[pane];
		let action = '';
		if (visible && p?.active && !p.dead && (p.windowType ?? WINDOW.VIEW) === WINDOW.VIEW) {
			if (p.hasAux) action = 'pickup';
			else if (canPullBlock(game.cells, p)) action = 'pull';
			else if (heldReloadState(p, game.itemDefs).ready) action = 'reload';
		}
		button.classList.toggle('on', !!action);
		button.disabled = !action;
		if (!action) {
			button.dataset.action = '';
			continue;
		}
		setMobileActionContents(button, action);
		const [ox, oy] = PANE_ORIGINS[pane];
		button.style.left = `${(ox + 4) * scale}px`;
		button.style.top = `${(oy + 64) * scale}px`;
		button.style.width = `${32 * scale}px`;
		button.style.height = `${32 * scale}px`;
	}
}

function bindMobileActions() {
	const host = $('mobile-actions');
	if (!host) return;
	for (const button of host.querySelectorAll('.mobile-action')) {
		button.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (!mobileControlsEnabled()) return;
			const pane = Number(button.dataset.pane);
			const p = game.players?.[pane];
			if (!p?.active) return;
			game.active = pane;
			if (button.dataset.action === 'pickup' && p.hasAux) runPickupIntoInventory(p);
			else if (button.dataset.action === 'pull' && canPullBlock(game.cells, p)) pull(p);
			else if (button.dataset.action === 'reload' && heldReloadState(p, game.itemDefs).ready) {
				runReload(p);
			}
			game.dirty = true;
			updateHUD();
			updateMobileActions();
		});
	}
	MOBILE_QUERY?.addEventListener?.('change', updateMobileActions);
}

/**
 * Is the keystroke going into a field the user is typing in?
 *
 * The game's key handler calls preventDefault on everything while the shell is
 * up, and the shell is "up" the whole time the editor is open -- so every
 * character typed into a message, a map property or a door's key number was
 * being swallowed and fed to the menu instead. Anything editable gets its keys
 * left alone.
 */
function isTypingTarget(e) {
	const el = e.target;
	if (!el || !el.tagName) return false;
	const tag = el.tagName.toUpperCase();
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
		|| el.isContentEditable === true;
}

function onKey(e) {
	if (isTypingTarget(e)) return;
	unlockAudio();
	if (e.key === 'F5') {
		e.preventDefault();
		doSave('quick');
		return;
	}
	if (e.key === 'F9') {
		e.preventDefault();
		doLoad('quick');
		return;
	}
	if (game.shell?.mode && game.shell.mode !== SHELL.GAME) {
		e.preventDefault();
		applyShellEvent(handleShellKey(game.shell, game.campaign, e.key));
		return;
	}
	const p = game.players[game.active];
	if (!p) return;
	// R/F fly the player between floors, which is a development aid, not a game
	// control -- it only works with debug mode on.
	const canDebugFloorMove = game.debug &&
		!game.mission?.complete && !p.dead && !p.inExit &&
		(p.windowType ?? WINDOW.VIEW) === WINDOW.VIEW;
	let handled = true;
	switch (e.key) {
		case 'ArrowUp': case 'w': runPaneAction(p, GADGET.FORWARD); break;
		case 'ArrowDown': case 's': runPaneAction(p, GADGET.BACKWARD); break;
		case 'ArrowLeft': runPaneAction(p, GADGET.TURN_LEFT); break;
		case 'ArrowRight': runPaneAction(p, GADGET.TURN_RIGHT); break;
		case 'q': runPaneAction(p, GADGET.SIDESTEP_LEFT); break;
		case 'e': runPaneAction(p, GADGET.SIDESTEP_RIGHT); break;
		case 'x': runPaneAction(p, GADGET.PULL); break;
		case 'r':
			if (canDebugFloorMove && p.floor + 1 < MAP_HEIGHT) {
				removeHeadFromMap(game.cells, p.x, p.y, p.floor);
				p.floor++;
				putHeadInMap(game.cells, p);
				clearNoMonster(game.items, cellIndex(p.x, p.y, p.floor));
				refreshPlayerFlags(p);
			}
			break;
		case 'f':
			if (canDebugFloorMove && p.floor > 0) {
				removeHeadFromMap(game.cells, p.x, p.y, p.floor);
				p.floor--;
				putHeadInMap(game.cells, p);
				clearNoMonster(game.items, cellIndex(p.x, p.y, p.floor));
				refreshPlayerFlags(p);
			}
			break;
		case ' ': runPaneAction(p, GADGET.ACTIVATE); break;
		case '1': case '2': case '3': case '4':
			game.active = Number(e.key) - 1; break;
		default: handled = false;
	}
	if (handled) { e.preventDefault(); game.dirty = true; updateHUD(); }
}

function frame() {
	// The timed parts of the world run off xcr_counters, which the vblank
	// interrupt bumps at 50Hz -- NOT off the game loop, which spun as fast as it
	// could. Driving them from requestAnimationFrame instead tied door, water and
	// fall speed to the display: a fall resolved in a couple of frames, and a
	// 144Hz monitor ran everything close to three times too fast.
	const now = performance.now();
	// Clamp so a backgrounded tab does not resolve a minute of world state at once.
	game.vblankAcc = Math.min((game.vblankAcc || 0) + (now - (game.lastTime || now)),
		MAX_CATCHUP_MS);
	game.lastTime = now;
	let ticks = 0;
	while (game.vblankAcc >= VBLANK_MS) { game.vblankAcc -= VBLANK_MS; ticks++; }
	let paletteChanged = false;

	// shake_screen runs off the same 50Hz interrupt as everything else, one
	// table entry per tick, so it decays at the rate the original does however
	// fast the display refreshes.
	if (ticks && shakeActive(game.shake)) {
		for (let i = 0; i < ticks; i++) stepShake(game.shake);
		applyShake();
	} else if (!shakeActive(game.shake) && game.shake.offset) {
		game.shake.offset = 0;
		applyShake();
	}

	// ADDITION: muffle the mix while the pane you are looking through is under
	// water. Read every frame rather than on the drowning tick, which only comes
	// round once a second -- swimming up should sound like surfacing, not like a
	// delayed switch. Uses the same submerged test stepDrowning does.
	if (game.audio) game.audio.setUnderwater(activePlayerSubmerged());

	if (game.missionGrace) game.missionGrace = Math.max(0, (game.missionGrace | 0) - (ticks || 0));
	if (game.shell?.mode === SHELL.GAME && game.map && ticks && !game.mission?.complete) {
		game.fieldPosn = ((game.fieldPosn || 0) + ticks) % FIELD_COLOUR_PERIOD;
		paletteChanged = true;
		if (game.hasVisibleField) game.dirty = true;
		for (const p of game.players) {
			if (stepPlayerEffects(p, ticks)) {
				game.dirty = true;
				if (p.fireAnim || p.fireColour) paletteChanged = true;
			}
		}
		// Each of these sets redraw_flag when it changes anything.
		if (hatchEggs(game.monsterState, game.cells, game.seen, game.items, ticks)) {
			sfxKey('EggHatch');
			game.dirty = true;
		}
		if (moveWater(game.water, game.cells, game.seen, ticks)) game.dirty = true;
		if (stepDrowning(ticks)) {
			game.dirty = true;
			updateHUD();
		}
		if (moveFireballs(game.combatState, game.cells, game.seen, game.items, ticks, {
			style: game.map?.locn?.style | 0,
		}, combatHooks())) game.dirty = true;
		// Deferred button actions land before the systems they drive step, so a
		// lift or door reacts on the same tick its delay expires.
		if (stepButtons(game.buttons, game.cells, game.world, ticks)) game.dirty = true;
		if (moveDoors(game.doors, game.cells, ticks, doorHooks())) game.dirty = true;
		const riders = game.players.concat(activeMonsters(game.monsterState), activeSentries(game.sentryState));
		if (moveLifts(game.lifts, game.cells, riders, ticks, {
			seen: game.seen,
			items: game.items,
			pushables: game.pushables,
			onPad: (cell, pressed) =>
				checkPad(game.buttons, game.cells, cell, pressed, game.world),
		})) {
			game.dirty = true;
			updateHUD();
		}
		// After the lifts have stepped, so mounting and dismounting are both
		// seen on the tick they happen.
		updateLiftSfx();
		// Triggers are checked against where everyone actually ended up.
		if (checkTextTriggers(game.messages, game.players, {
			onMessage: () => { status(activeMessageText(game.messages, playerNames())); },
		})) game.dirty = true;
		if (stepMessages(game.messages, ticks, measureBandText, SCREEN_W)) game.dirty = true;
		// The party talking among themselves, once every 50 seconds.
		const idle = stepChatter(game.chatter, livingPlayers(), ticks);
		if (idle) sayChatter(idle);
		// `move` only steps you off a ledge; this is what actually drops you.
		if (stuffFalls(game.fallClock, game.cells, game.players, game.fallHooks, ticks)) {
			game.dirty = true;
			updateHUD();
		}
		if (moveSentries(game.sentryState, game.cells, game.combatState, game.seen,
			game.items, ticks, {
				style: game.map?.locn?.style | 0,
				combatHooks: combatHooks(),
				onActivated: (s) => {
					const owner = game.players[(s.owner | 0) - 1];
					if (owner) owner.activeCount = 150;
				},
			})) game.dirty = true;
		if (moveMonsters(game.monsterState, game.cells, game.items, game.players, ticks, {
			style: game.map?.locn?.style | 0,
			openDoor: (cell) => triggerDoor(game.doors, cell),
			addFireball: (from, opts) => addCombatFireball(from, opts),
			onAttackPlayer: (monster, cell, amount) => {
				const p = game.players.find((pl) => pl && cellIndex(pl.x, pl.y, pl.floor) === cell);
				if (!p) return;
				startMonsterHitEffect(p, amount, monster);
				if (damagePlayerFitness(p, amount)) {
					status(`${monster.def?.name || 'monster'} hit player ${p.index + 1}`);
					updateHUD();
				}
			},
			onPoisonPlayer: (monster, cell) => poisonPlayerFromMonster(monster, cell),
			onAttackSentry: (_monster, cell, amount) =>
				damageSentryAtCell(game.sentryState, game.cells, cell, amount),
		})) game.dirty = true;
		for (const m of activeMonsters(game.monsterState)) {
			if (testMineForMonster(m)) game.dirty = true;
		}
		if (game.team) {
			const follows = followLeader(game.team, game.players, ticks);
			for (const { player, action } of follows) runPaneAction(player, action);
			for (const pl of game.players) if (pl) pl.autoMove = false;
			if (follows.length) {
				game.dirty = true;
				updateHUD();
			}
		}
		updateMissionCompletion();
	}
	if (game.shell?.mode === SHELL.GAME && game.lightning) {
		stepLightning(game.lightning);
		const lit = lightningActive(game.lightning);
		if (lit !== game.lightningLit) {
			// update_sky forces every view to redraw when the flash turns on or
			// off, because the sky rows are palette entries, not pixels.
			game.lightningLit = lit;
			if (lit) sfxEx(16, { period: 450 });
			paletteChanged = true;
			game.dirty = true;
		}
		refreshBackSfx();
		if (paletteChanged) game.renderer.setPalette(buildPalette());
	}
	if (game.map) refreshAllPlayerFlags();
	updateMobileActions();
	if (game.map && game.players.some((p) => p?.active &&
		(p.windowType ?? WINDOW.VIEW) === WINDOW.VDU &&
		dtsModuleMode(p) === 'offline')) {
		game.dtsStaticTick = (game.dtsStaticTick + 1) & 255;
		game.dirty = true;
	}
	if (game.shell?.mode && game.shell.mode !== SHELL.GAME) {
		if (game.dirty) {
			game.dirty = false;
			showShell(true);
			paintShellFrame();
		}
	} else if (game.dirty && game.map) {
		game.dirty = false;
		try {
		let hasVisibleField = false;
		const r = game.renderer;
		r.clear();
		for (let i = 0; i < 4; i++) {
			const p = game.players[i];
			if (!p || !p.active) continue;
			const [ox, oy] = PANE_ORIGINS[i];
			const windowType = p.windowType ?? WINDOW.VIEW;
			if (game.windows && game.windowAtlas) {
				const clearColour = windowType === WINDOW.DEAD || windowType === WINDOW.EXIT
					? DEAD_EXIT_CLEAR_COLOUR
					: 0;
				r.drawWindowFrame(game.windows.windows[windowFrameIndex(windowType)],
					game.windowAtlas, ox, oy, { clearColour });
			}
			if (windowType === WINDOW.STORE) {
				drawStorePane(r, p, ox, oy);
				drawHudMessages(r, p, ox, oy, windowType);
				drawPaneHealthOverlay(r, p, ox, oy);
				drawTeamIcon(r, p, ox, oy, windowType);
				continue;
			}
			if (windowType === WINDOW.INFO) {
				drawInfoPane(r, p, ox, oy);
				drawHudMessages(r, p, ox, oy, windowType);
				drawPaneHealthOverlay(r, p, ox, oy);
				drawTeamIcon(r, p, ox, oy, windowType);
				continue;
			}
			if (windowType === WINDOW.VDU) {
				drawVduPane(r, p, ox, oy);
				drawHudMessages(r, p, ox, oy, windowType);
				drawPaneHealthOverlay(r, p, ox, oy);
				drawTeamIcon(r, p, ox, oy, windowType);
				continue;
			}
			if (windowType === WINDOW.STATS) {
				drawStatsPane(r, p, ox, oy);
				drawHudMessages(r, p, ox, oy, windowType);
				drawTeamIcon(r, p, ox, oy, windowType);
				drawPaneHealthOverlay(r, p, ox, oy);
				continue;
			}
			if (windowType === WINDOW.DEAD) {
				drawDeadPane(r, ox, oy);
				continue;
			}
			if (windowType === WINDOW.EXIT) {
				drawExitPane(r, p, ox, oy);
				continue;
			}
			if (windowType !== WINDOW.VIEW) continue;
			markSeenFromView(p);
			const list = buildDrawList({
				cells: game.cells, items: game.items,
				x: p.x, y: p.y, floor: p.floor, direction: p.direction,
				tables: game.tables, style: game.style,
		tallObjects: !!game.tallObjects,
				lights: game.masks.light, water: game.masks.water,
				explosions: game.masks.explosions, foam: game.masks.foam,
				panels: game.map.panels, exgfx: game.exgfx,
				monsterAttacking: p.monsterAttacking | 0,
				skeletonUnderfootAux: skeletonUnderfootAux(
					game.seen, game.players, game.itemDefs, playerCell(p)),
				party: game.players,
			});
			if (!hasVisibleField && list.some((s) => s.field)) hasVisibleField = true;
			// draw_horizon: the sky gradient and the horizon silhouettes are only
			// drawn when the sky bit for this facing is set. Otherwise the source
			// calls black_out_window, clearing the clipped 3D interior after the
			// window backdrop has been drawn.
			if (hasSky(game.items, cellIndex(p.x, p.y, p.floor), p.direction)) {
				r.fillBackground(ox, oy, VIEW_X, VIEW_Y, game.hasGradient);
				// Planet first: the horizon silhouette must occlude it.
				if (game.planetSpans) {
					r.drawSpans(game.planetSpans[p.direction & 3], PLANET_COLOUR,
						ox, oy, VIEW_X, VIEW_Y, game.hasGradient ? PLANET_GRADIENT_BASE : 0);
				}
				if (game.horizonSpans) {
					const h = game.horizonSpans[p.direction & 3];
					// Far range first (tinted), then the black near range over it.
					r.drawSpans(h.far, HORIZON_FAR_COLOUR, ox, oy, VIEW_X, VIEW_Y,
						game.hasGradient ? HORIZON_FAR_BASE : 0);
					r.drawSpans(h.near, HORIZON_NEAR_COLOUR, ox, oy, VIEW_X, VIEW_Y, 0);
				}
			} else {
				r.clearView(ox, oy, VIEW_X, VIEW_Y);
			}
			r.drawView(list, game.atlas, ox, oy, VIEW_X, VIEW_Y, game.overlays, game.panels);
			drawViewOverlay(r, p, ox, oy);
		}
		game.hasVisibleField = hasVisibleField;
		// Over the panes, the way the copper takes those rasters over.
		drawMessageBand(r);
		r.present();
		for (const pl of game.players) if (pl) pl.fireWhite = false;
		} catch (e) {
			status(`render: ${e.message}`);
			console.error(e);
		}
	}
	requestAnimationFrame(frame);
}

/**
 * Push the shake offset onto the screen element.
 *
 * The original moves the display window itself, so the picture slides and the
 * border follows it -- a transform on the canvas is the same thing, and costs
 * nothing on either renderer since neither has to redraw.
 */
function applyShake() {
	const canvas = $('screen');
	if (!canvas) return;
	const y = (game.shake.offset | 0) * (game.shakeScale || 1);
	canvas.style.transform = y ? `translateY(${y}px)` : '';
}

function fullscreenElement() {
	return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function syncFullscreen() {
	const active = !!fullscreenElement();
	document.body.classList.toggle('fullscreen', active);
	const button = $('fullscreen');
	if (button) {
		button.textContent = active ? 'exit full screen' : 'full screen';
		button.setAttribute('aria-pressed', active ? 'true' : 'false');
	}
	requestAnimationFrame(() => {
		fitCanvas($('screen'));
		game.dirty = true;
	});
}

async function toggleFullscreen() {
	try {
		if (fullscreenElement()) {
			const exit = document.exitFullscreen || document.webkitExitFullscreen;
			if (!exit) throw new Error('not supported by this browser');
			await exit.call(document);
		} else {
			const root = document.documentElement;
			const request = root.requestFullscreen || root.webkitRequestFullscreen;
			if (!request) throw new Error('not supported by this browser');
			await request.call(root);
		}
	} catch (e) {
		status(`full screen unavailable: ${e.message || e}`);
	}
}

function bindFullscreen() {
	const button = $('fullscreen');
	if (!button) return;
	button.addEventListener('click', () => {
		toggleFullscreen();
		button.blur();
	});
	document.addEventListener('fullscreenchange', syncFullscreen);
	document.addEventListener('webkitfullscreenchange', syncFullscreen);
	syncFullscreen();
}

/** Height occupied by visible, in-flow page chrome other than the game. */
function canvasHeightReserve(stage) {
	const bodyStyle = getComputedStyle(document.body);
	let reserve = parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom);
	let flowCount = 0;
	for (const el of document.body.children) {
		if (el === stage || el.tagName === 'SCRIPT') continue;
		const style = getComputedStyle(el);
		if (style.display === 'none' || style.position === 'fixed' || style.position === 'absolute') continue;
		reserve += el.getBoundingClientRect().height;
		flowCount++;
	}
	// Each other flow item contributes one flex gap: between the items and once
	// more between the last item and the stage.
	reserve += flowCount * (parseFloat(bodyStyle.rowGap || bodyStyle.gap) || 0);
	return reserve;
}

function fitCanvas(canvas) {
	const stage = $('stage');
	const bodyStyle = getComputedStyle(document.body);
	const viewportW = window.visualViewport?.width || window.innerWidth;
	const viewportH = window.visualViewport?.height || window.innerHeight;
	let availableWidth = viewportW - parseFloat(bodyStyle.paddingLeft) -
		parseFloat(bodyStyle.paddingRight);
	let availableHeight = viewportH - parseFloat(bodyStyle.paddingTop) -
		parseFloat(bodyStyle.paddingBottom);
	const inFullscreen = !!fullscreenElement();
	if (inFullscreen) {
		const bar = $('bar');
		const barRect = bar?.getBoundingClientRect();
		const gap = parseFloat(bodyStyle.rowGap || bodyStyle.gap) || 0;
		if (matchMedia('(orientation: landscape)').matches) {
			availableWidth -= (barRect?.width || 0) + gap;
		} else {
			availableHeight -= (barRect?.height || 0) + gap;
		}
	} else {
		availableHeight = viewportH - canvasHeightReserve(stage);
	}
	availableWidth = Math.max(1, availableWidth);
	availableHeight = Math.max(1, availableHeight);
	const displayScale = fittedGameScale(availableWidth, availableHeight,
		SCREEN_W, SCREEN_H, { fractional: inFullscreen });
	// The renderer still gets a whole multiple of the native framebuffer. In
	// fullscreen CSS presents it at the exact fractional fit, with nearest-pixel
	// scaling and the aspect ratio unchanged.
	const backingScale = Math.max(1, Math.floor(displayScale));
	const displayWidth = SCREEN_W * displayScale;
	const displayHeight = SCREEN_H * displayScale;
	canvas.width = SCREEN_W * backingScale;
	canvas.height = SCREEN_H * backingScale;
	canvas.style.width = `${displayWidth}px`;
	canvas.style.height = `${displayHeight}px`;
	// The CRT scanlines follow the same integer upscale, so a dark line lands
	// between game pixel rows rather than cutting through them.
	setCrtScale(Math.round(displayScale));
	// And the shake moves by whole screen pixels for the same reason.
	game.shakeScale = displayScale;
	applyShake();
	const shell = $('shell-canvas');
	if (shell) {
		// Backed at the shell's own 640x512 so the hires art is not squashed,
		// and presented at that aspect rather than stretched into the game's
		// 320x212 box -- letterboxed inside the stage instead.
		const shellScale = Math.max(1, Math.floor(displayWidth / SHELL_W));
		shell.width = SHELL_W * shellScale;
		shell.height = SHELL_H * shellScale;
		const fit = Math.min(displayWidth / SHELL_W, displayHeight / SHELL_H);
		shell.style.width = `${SHELL_W * fit}px`;
		shell.style.height = `${SHELL_H * fit}px`;
	}
	if (stage) {
		stage.style.width = `${displayWidth}px`;
		stage.style.height = `${displayHeight}px`;
	}
	updateMobileActions();
	return displayScale;
}

// Hold shift while the page loads to see the intro again.
let startedWithShift = false;
window.addEventListener('keydown', (e) => { if (e.key === 'Shift') startedWithShift = true; },
	{ once: true, capture: true });

async function main() {
	const canvas = $('screen');

	// Prefer WebGPU; fall back to the Canvas2D reference path.
	const forced = new URLSearchParams(location.search).get('renderer');
	let renderer = null;
	if (forced !== '2d' && await RendererWebGPU.isSupported()) {
		try {
			renderer = new RendererWebGPU(canvas);
			await renderer.init();
		} catch (e) {
			console.warn('WebGPU unavailable, falling back to Canvas2D:', e);
			renderer = null;
		}
	}
	if (!renderer) {
		// A canvas can only have one context type, so start over with a fresh one.
		const fresh = canvas.cloneNode();
		canvas.replaceWith(fresh);
		fresh.id = 'screen';
		renderer = new Renderer2D(fresh);
	}
	game.renderer = renderer;
	bindFullscreen();
	bindMobileActions();
	fitCanvas($('screen'));
	window.addEventListener('resize', () => { fitCanvas($('screen')); game.dirty = true; });

	status('loading tables...');
	game.tables = await loadJSON('viewtables.json');
	game.copperPalette = await loadJSON('palette.json').catch(() => null);
	game.renderer.setPalette(buildPalette());
	game.itemDefs = await loadJSON('items.json');
	game.itemImages = await loadJSON('item-images.json').catch(() => null);
	if (game.itemImages) {
		const atlasData = await loadBytes(game.itemImages.atlas.file);
		game.itemAtlas = {
			width: game.itemImages.atlas.width,
			height: game.itemImages.atlas.height,
			data: atlasData,
		};
	}
	game.monsterDefs = await loadJSON('monsters.json').catch(() => null);
	game.monsterGraphics = await loadJSON('monster-graphics.json').catch(() => null);
	if (game.monsterGraphics) {
		const atlasData = await loadBytes(game.monsterGraphics.atlas.file);
		game.monsterAtlas = {
			width: game.monsterGraphics.atlas.width,
			height: game.monsterGraphics.atlas.height,
			data: atlasData,
		};
	}
	game.exgfx = await loadJSON('exgfx.json').catch(() => null);
	if (game.exgfx) {
		const atlasData = await loadBytes(game.exgfx.atlas.file);
		game.exgfxAtlas = {
			width: game.exgfx.atlas.width,
			height: game.exgfx.atlas.height,
			data: atlasData,
		};
	}
	game.skeleton = await loadJSON('skeleton.json').catch(() => null);
	if (game.skeleton) {
		const atlasData = await loadBytes(game.skeleton.atlas.file);
		game.skeletonAtlas = {
			width: game.skeleton.atlas.width,
			height: game.skeleton.atlas.height,
			data: atlasData,
			slots: game.skeleton.slots || [],
		};
	}
	game.miscUi = await loadJSON('misc-ui.json').catch(() => null);
	if (game.miscUi) {
		const atlasData = await loadBytes(game.miscUi.atlas.file);
		game.miscAtlas = {
			width: game.miscUi.atlas.width,
			height: game.miscUi.atlas.height,
			data: atlasData,
		};
	}
	game.fireEffects = await loadJSON('fire-effects.json').catch(() => null);
	if (game.fireEffects) {
		const atlasData = await loadBytes(game.fireEffects.atlas.file);
		game.fireEffectsAtlas = {
			width: game.fireEffects.atlas.width,
			height: game.fireEffects.atlas.height,
			data: atlasData,
		};
	}
	game.dtsMapblocks = await loadJSON('dts-mapblocks.json').catch(() => null);
	if (game.dtsMapblocks) {
		const atlasData = await loadBytes(game.dtsMapblocks.atlas.file);
		game.dtsMapblockAtlas = {
			width: game.dtsMapblocks.atlas.width,
			height: game.dtsMapblocks.atlas.height,
			data: atlasData,
		};
	}
	game.font = await loadJSON('gamefont.json').catch(() => null);
	// Messages.dat's banks -- the party's random chatter (push_mesg_rand).
	game.messageBanks = await loadJSON('messages.json').catch(() => null);
	if (game.font) {
		game.font.atlasData = {
			width: game.font.atlas.width,
			height: game.font.atlas.height,
			data: await loadBytes(game.font.atlas.file),
		};
	}
	game.characters = await loadJSON('characters.json')
		.then((c) => c.characters).catch(() => null);
	game.characterPortraits = await loadJSON('character-portraits.json').catch(() => null);
	if (game.characterPortraits) {
		const atlasData = await loadBytes(game.characterPortraits.atlas.file);
		game.characterPortraitAtlas = {
			width: game.characterPortraits.atlas.width,
			height: game.characterPortraits.atlas.height,
			data: atlasData,
			characters: game.characterPortraits.characters || [],
		};
	}
	game.sky = await loadJSON('sky.json').catch(() => null);
	game.windows = await loadJSON('windows.json').catch(() => null);
	if (game.windows) {
		const atlasData = await loadBytes(game.windows.atlas.file);
		game.windowAtlas = {
			width: game.windows.atlas.width,
			height: game.windows.atlas.height,
			data: atlasData,
		};
	}
	game.cursors = await loadJSON('cursors.json').catch(() => null);
	const sfxMan = await loadJSON('audio/sfx.json').catch(() => null);
	const musicMan = await loadJSON('music/music.json').catch(() => null);
	await game.audio.load(sfxMan, musicMan, loadBytes, (p) => ASSETS + p);
	game.campaign = await loadJSON('maps/campaign.json').catch(() => null);
	game.frontendArt = await loadFrontendArt();
	const index = await loadJSON('maps/maps.json');
	game.mapIndex = index;

	const select = $('map');
	for (const m of index.maps) {
		const opt = document.createElement('option');
		opt.value = m.key;
		opt.textContent = `${m.key}  -  ${m.name}`;
		select.appendChild(opt);
	}
	select.addEventListener('change', () => {
		// Hand focus back to the page, or the dropdown keeps the arrow keys and
		// walking stops working after you pick a map.
		select.blur();
		game.shell.mode = SHELL.GAME;
		if (!game.shell.party.length) game.shell.party = [0, 1, 2, 3];
		setPartyCharacters(game.shell.party);
		showShell(false);
		loadMap(select.value).catch((e) => status(`error: ${e.message}`));
	});
	$('qsave')?.addEventListener('click', () => { doSave('quick'); $('qsave').blur(); });
	$('qload')?.addEventListener('click', () => { doLoad('quick'); $('qload').blur(); });

	bindEditor();
	bindInspector();
	setDebug(localStorage.getItem(DEBUG_KEY) === '1');
	setTallObjects(localStorage.getItem(TALL_KEY) === '1');
	initCrt();
	bindLevelDrop();
	$('tall-objects')?.addEventListener('change', (e) => setTallObjects(e.target.checked));
	$('debug')?.addEventListener('change', (e) => {
		setDebug(!!e.target.checked);
		$('debug').blur();
	});
	setCheat(localStorage.getItem(CHEAT_KEY) === '1');
	$('cheat')?.addEventListener('change', (e) => {
		setCheat(!!e.target.checked);
		$('cheat').blur();
	});

	// Browsers restore a <select>'s previous value across reloads, so honour
	// whatever it is showing rather than assuming the first entry.
	const wanted = new URLSearchParams(location.search).get('map');
	if (wanted && index.maps.some((m) => m.key === wanted)) {
		select.value = wanted;
		game.shell.mode = SHELL.GAME;
		game.shell.party = [0, 1, 2, 3];
		setPartyCharacters(game.shell.party);
		await loadMap(select.value);
	} else {
		if (![...select.options].some((o) => o.value === select.value)) select.value = index.maps[0].key;
		game.shell.mode = SHELL.FRONT;
		game.dirty = true;
		showShell(true);
		paintShellFrame();
		status('HIRED GUNS');
		// After the shell is painted, so the menu is already behind the video
		// when it ends -- and awaited, so the front music does not start under
		// the intro's own soundtrack.
		const why = await playIntro(`${ASSETS}videos/intro.mp4`,
			{ force: startedWithShift });
		if (why !== 'already seen') status(`HIRED GUNS  (intro: ${why})`);
		unlockAudio();
	}
	window.addEventListener('keydown', onKey);
	const screen = $('screen');
	setupMouseCursor(screen);
	screen.addEventListener('pointerdown', onMouse);
	screen.addEventListener('pointermove', updateMouseCursor);
	screen.addEventListener('pointerleave', hideMouseCursor);
	const shellCanvas = $('shell-canvas');
	if (shellCanvas) {
		shellCanvas.addEventListener('pointerdown', onMouse);
		shellCanvas.addEventListener('pointermove', onShellMove);
		shellCanvas.addEventListener('pointerleave', onShellLeave);
		window.addEventListener('pointerup', onShellUp);
		shellCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
	}
	// The fire gadget's right-click alternate is `pull`, so the browser menu
	// has to stay out of the way over the canvas.
	screen.addEventListener('contextmenu', (e) => e.preventDefault());
	requestAnimationFrame(frame);

	// Exposed so the render output can be diffed against the Node reference
	// renderer (tools/render-view.js) from the console or a test harness.
	window.game = game;
	window.buildDrawList = buildDrawList;
	// loadMap too, so a bundled map can be loaded straight from a harness
	// without driving the whole menu to get to it.
	window.loadMap = loadMap;
}

main().catch((e) => {
	status(`error: ${e.message}`);
	console.error(e);
});
