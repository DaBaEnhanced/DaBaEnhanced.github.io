// Campaign shell: Front.s main menu, ChSelect.s party pick, WorldMap.s location
// pick, and the post-mission result screens. Persistence is localStorage.

import { COMPLETION } from './completion.js';
import { listSlots, SAVE_SLOTS } from './save.js';
import { drawText, drawCentred, measureText } from './frontfont.js';

// The front end does not run at the game's 320x212. Front.s and ChSelect.s set
// bplcon0 %1101000000000100 -- HIRES + LACE -- so their screens are 640x512,
// and every coordinate in those sources (ABSPOS, the selection tables) is in
// that space. Painting them into 320x212 squashed the art non-integrally and
// was the main reason the menus looked wrong.
export const SHELL_W = 640;
export const SHELL_H = 512;

export const SHELL = {
	FRONT: 'front',
	CHSELECT: 'chselect',
	WORLD: 'world',
	ACTION: 'action',
	TRAINING: 'training',
	RESULT: 'result',
	GAME: 'game',
	LOAD: 'load',
};

export const TRAINING_CHARS = [1, 2, 6, 7];

// ChSelect.s geometry. MIN_FACES_X = 87-16 and MAX_FACES_X = (2624/2)-329-32,
// both doubled on CD32 (ChSelect.s:17,98), so the scroll runs 142..1902 in
// twelve 160-wide steps. select_character derives the index as
// (chselect_x - (MIN_FACES_X*2 - 80)) / 160, i.e. from an origin of 62 -- the
// selected character is the one centred in the window, not the leftmost.
export const FACE_WIDTH = 160;
export const FACE_ORIGIN = 62;
export const FACE_SCROLL_MIN = 142;
export const FACE_SCROLL_MAX = 1902;
// Faces occupy strip x 240..2159. At scroll 142+160i, face i therefore always
// lands at screen x 98, so the selection frame never moves.
const FACE_STRIP_ORIGIN = 240;
const FACE_SCREEN_X = FACE_STRIP_ORIGIN - FACE_SCROLL_MIN;   // 98
const SAVE_KEY = 'hiredguns-campaign';

// The CD32 main menu, from Front.s:2115 main_menu_text.
//
// PHRASE n indexes Sources/engtext as entry n-1: the offset table's first slot
// is phrase 1, not phrase 0. Anchored by WorldMap.s move_msg, which prints
// PHRASE 86 then 87 as a header and a body -- off by one those read "Moving to
// indicated location...." then "*** AREA COMPROMISED ***", which is nonsense,
// and correctly they read "*** SYSTEM MESSAGE ***" then "Moving to indicated
// location....". show_map_info agrees: completed -> "AREA COMPROMISED".
//
// So the menu is PHRASE 27, 28, 29, then 3 and 4 below the separator:
//   27 "Training"                 28 "Full campaign game"
//   29 "Short action game"         3 "Continue a saved game"
//    4 "Exit to Workbench"
//
// PHRASE 4 is dropped here: there is no Workbench to exit to in a browser.
// 'editor' is an addition -- the original has no level editor on this menu.
// It joins the group of game modes, above the separator.
export const FRONT_ITEMS = [
	{ id: 'training', label: 'Training' },
	{ id: 'campaign', label: 'Full campaign game' },
	{ id: 'action', label: 'Short action game' },
	{ id: 'editor', label: 'Level Editor' },
	{ id: 'load', label: 'Continue a saved game' },
];

// Index of the first entry BELOW the separator rule.
export const FRONT_SEPARATOR_AT = 4;

export function classifyMapNum(n) {
	if (n >= 43 && n <= 47) return 'training';
	if (n >= 23 && n <= 27) return 'action1';
	if (n >= 28 && n <= 32) return 'action2';
	if (n >= 33 && n <= 37) return 'action3';
	if (n >= 38 && n <= 42) return 'action4';
	if (n >= 1 && n <= 22 && n !== 16 && n !== 22) return 'campaign';
	return 'unused';
}

export function createShell() {
	return {
		mode: SHELL.FRONT,
		cursor: 0,
		actionFlag: 0,
		trainingFlag: 0,
		party: [],
		focusChar: 0,
		faceX: FACE_SCROLL_MIN,
		faceFrom: FACE_SCROLL_MIN,
		faceAt: 0,
		completed: [],
		unlocked: [13],
		here: 13,
		lastKey: '',
		result: null,
		list: [],
		reachable: [],
		hoverKey: null,
		mapX: 0,
		mapY: 0,
		drag: null,
	};
}

export function loadSave() {
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		if (!Array.isArray(data.party) || data.party.length !== 4) return null;
		return data;
	} catch (_) {
		return null;
	}
}

export function writeSave(shell) {
	try {
		localStorage.setItem(SAVE_KEY, JSON.stringify({
			party: shell.party.slice(),
			completed: shell.completed.slice(),
			unlocked: shell.unlocked.slice(),
			here: shell.here,
			lastKey: shell.lastKey,
			actionFlag: shell.actionFlag | 0,
		}));
	} catch (_) { /* private mode */ }
}

export function locationsOf(campaign, kind) {
	return (campaign?.locations || []).filter((l) => {
		if (kind === 'campaign') return l.kind === 'campaign' || l.kind === 'campaignStart' || l.kind === 'campaignEnd';
		if (kind === 'action') return /^action/.test(l.kind);
		return l.kind === kind;
	});
}

export function locationByNum(campaign, num) {
	return (campaign?.locations || []).find((l) => l.mapNum === (num | 0)) || null;
}

export function applyFrontChoice(shell, campaign) {
	const item = FRONT_ITEMS[shell.cursor];
	if (!item) return { stay: true };
	if (item.id === 'editor') return { editor: true };
	if (item.id === 'load') {
		shell.mode = SHELL.LOAD;
		shell.cursor = 0;
		return { stay: true };
	}
	if (item.id === 'training') {
		shell.actionFlag = 1;
		shell.trainingFlag = 1;
		shell.party = TRAINING_CHARS.slice();
		// newRun tells the host a fresh party is starting, so whatever the last
		// party was carrying between maps does not follow them in.
		return { ...enterList(shell, campaign, 'training'), newRun: true };
	}
	if (item.id === 'action') {
		shell.actionFlag = 1;
		shell.trainingFlag = 0;
		shell.party = [];
		shell.focusChar = 0;
		shell.faceX = FACE_SCROLL_MIN;
		shell.mode = SHELL.CHSELECT;
		shell.cursor = 0;
		return { music: 'ChSelect', newRun: true };
	}
	shell.actionFlag = 0;
	shell.trainingFlag = 0;
	shell.party = [];
	shell.focusChar = 0;
	shell.faceX = FACE_SCROLL_MIN;
	shell.mode = SHELL.CHSELECT;
	shell.cursor = 0;
	return { music: 'ChSelect', newRun: true };
}

export function togglePartyChar(shell, index) {
	const i = index | 0;
	if (i < 0 || i > 11) return;
	const at = shell.party.indexOf(i);
	if (at >= 0) {
		shell.party.splice(at, 1);
		return;
	}
	if (shell.party.length >= 4) return;
	shell.party.push(i);
}

export function confirmParty(shell, campaign) {
	if (shell.party.length !== 4) return { stay: true };
	if (shell.actionFlag) return enterList(shell, campaign, 'action');
	return enterWorld(shell, campaign);
}

function enterList(shell, campaign, kind) {
	// Custom maps ride the action path, listed above the 20 built-in levels --
	// they are standalone maps played by a party of four, which is exactly what
	// a short action game is. `shell.customMaps` is filled in by the host.
	const custom = kind === 'action'
		? (shell.customMaps || []).map((m) => ({
			key: m.key, name: m.name || m.key, custom: true,
		}))
		: [];
	shell.list = custom.concat(locationsOf(campaign, kind));
	shell.mode = kind === 'training' ? SHELL.TRAINING : SHELL.ACTION;
	shell.cursor = 0;
	return { music: 'Front' };
}

/**
 * Rebuild the action list in place after a level file is loaded.
 *
 * enterList is private and also resets the cursor and the mode; this only
 * refreshes what is listed, so a map dropped onto the page while the list is
 * open appears without throwing the player back to the top of it.
 *
 * @returns true when the list changed
 */
export function refreshActionList(shell, campaign) {
	if (shell.mode !== SHELL.ACTION) return false;
	const before = shell.list.length;
	const wasOn = shell.list[shell.cursor]?.key;
	shell.list = (shell.customMaps || [])
		.map((m) => ({ key: m.key, name: m.name || m.key, custom: true }))
		.concat(locationsOf(campaign, 'action'));
	// Keep the highlight on whatever it was on, if that entry survived.
	const at = shell.list.findIndex((l) => l.key === wasOn);
	shell.cursor = at >= 0 ? at : 0;
	return shell.list.length !== before;
}

function isCampaignStart(l) {
	return !l || l.kind === 'campaignStart' || (l.typeFlag | 0) === 2;
}

export function reachableFrom(campaign, here) {
	const at = locationByNum(campaign, here);
	const nums = new Set(at?.destinations || []);
	return locationsOf(campaign, 'campaign').filter((l) =>
		nums.has(l.mapNum) && !isCampaignStart(l));
}

export function enterWorld(shell, campaign) {
	shell.list = locationsOf(campaign, 'campaign');
	if (!shell.here) {
		const start = shell.list.find((l) => l.kind === 'campaignStart');
		shell.here = start?.mapNum || 13;
	}
	if (!shell.unlocked.includes(shell.here)) shell.unlocked.push(shell.here);
	refreshReachable(shell, campaign);
	shell.mode = SHELL.WORLD;
	centerWorldOn(shell, currentLocation(shell) || locationByNum(campaign, shell.here));
	return { music: 'World' };
}

function worldSize(art = {}) {
	const mw = art.world?.width || 960;
	const mh = (art.world?.height || 384) * 2;
	return { mw, mh };
}

export function clampWorld(shell, art = {}) {
	const { mw, mh } = worldSize(art);
	const maxX = Math.max(0, mw - WORLD_VIEW_W);
	const maxY = Math.max(0, mh - WORLD_VIEW_H);
	shell.mapX = Math.max(0, Math.min(maxX, shell.mapX | 0));
	shell.mapY = Math.max(0, Math.min(maxY, shell.mapY | 0));
}

export function panWorld(shell, dx, dy, art) {
	shell.mapX = (shell.mapX | 0) + (dx | 0);
	shell.mapY = (shell.mapY | 0) + (dy | 0);
	clampWorld(shell, art);
}

export function centerWorldOn(shell, loc, art = {}) {
	if (!loc) return;
	const pin = locnToMap(loc);
	shell.mapX = pin.x - (WORLD_VIEW_W >> 1);
	shell.mapY = pin.y - (WORLD_VIEW_H >> 1);
	clampWorld(shell, art);
}

function refreshReachable(shell, campaign) {
	shell.reachable = reachableFrom(campaign, shell.here);
	const last = shell.reachable.findIndex((l) => l.key === shell.lastKey || l.mapNum === shell.here);
	shell.cursor = last >= 0 ? last : 0;
}

/**
 * The entry the cursor is on.
 *
 * `reachable` is the world map's filtered set of destinations and is meaningful
 * only there. It starts as an empty array, which is truthy -- so
 * `shell.reachable || shell.list` indexed the empty array on every other screen
 * and returned null, which meant no action or training level could ever be
 * launched. Pick the list by mode instead.
 */
export function currentLocation(shell) {
	const list = shell.mode === SHELL.WORLD ? shell.reachable : shell.list;
	return (list || [])[shell.cursor] || null;
}

export function beginLocation(shell, campaign) {
	const loc = currentLocation(shell);
	if (!loc) return { stay: true };
	if (shell.mode === SHELL.WORLD) {
		if (isCampaignStart(loc)) return { stay: true };
		const reach = reachableFrom(campaign, shell.here);
		if (!reach.some((l) => l.mapNum === loc.mapNum)) return { stay: true };
		if (shell.completed.includes(loc.key)) {
			shell.here = loc.mapNum;
			shell.lastKey = loc.key;
			refreshReachable(shell, campaign);
			writeSave(shell);
			return { stay: true };
		}
		shell.lastKey = loc.key;
		writeSave(shell);
		return { play: loc.key };
	}
	shell.lastKey = loc.key;
	writeSave(shell);
	return { play: loc.key };
}

export function completeMission(shell, campaign, result) {
	shell.result = result;
	const loc = locationByNum(campaign, (shell.lastKey.match(/^(\d+)/) || [])[1]) ||
		(campaign?.locations || []).find((l) => l.key === shell.lastKey);
	if (result?.type === COMPLETION.CAMPAIGN_COMPLETE && loc) {
		if (!shell.completed.includes(loc.key)) shell.completed.push(loc.key);
		shell.here = loc.mapNum;
		for (const dest of loc.destinations || []) {
			if (!shell.unlocked.includes(dest)) shell.unlocked.push(dest);
		}
		writeSave(shell);
	}
	shell.mode = SHELL.RESULT;
	shell.cursor = 0;
	if (result?.type === COMPLETION.DEATH) return { music: 'Death', died: true };
	// CAMPAIGN_COMPLETE means THIS MISSION finished, and fires on every campaign
	// level. The game only ends at the location marked campaignEnd -- 21-Spaceport
	// -- so the ending is flagged here rather than inferred from the completion
	// type, which would roll the credits after the first level.
	if (loc?.kind === 'campaignEnd' && result?.type === COMPLETION.CAMPAIGN_COMPLETE) {
		return { music: 'Outro', campaignOver: true };
	}
	return { music: 'Front' };
}

export function leaveResult(shell, campaign) {
	if (shell.trainingFlag) return enterList(shell, campaign, 'training');
	if (shell.actionFlag) return enterList(shell, campaign, 'action');
	if (shell.result?.type === COMPLETION.DEATH) {
		shell.mode = SHELL.FRONT;
		shell.cursor = 0;
		return { music: 'Front' };
	}
	return enterWorld(shell, campaign);
}

export function moveCursor(shell, delta, max) {
	// The pointer no longer owns the highlight once the keyboard moves it.
	shell.hoverKey = null;
	if (max <= 0) return;
	shell.cursor = (shell.cursor + delta + max) % max;
}

export function resultTitle(type) {
	switch (type) {
		case COMPLETION.DEATH: return 'PARTY DEAD';
		case COMPLETION.CAMPAIGN_COMPLETE: return 'MISSION COMPLETE';
		case COMPLETION.ACTION_COMPLETE: return 'ACTION COMPLETE';
		case COMPLETION.ACTION_FAILED: return 'ACTION FAILED';
		case COMPLETION.TIME_UP: return 'TIME UP';
		default: return 'MISSION';
	}
}

// The world screen is a split display, not one full-width panel. From
// Data/World.dat/WorldCD32.s:
//
//   diwstrt $2992 / diwstop $fda2   v 41..255, h 146..418
//   C_WAIT 195  -> bplcon0 = no bitplanes      map ends at raster 195
//   C_WAIT 203  -> bplcon0 %1100000000000000   panel is 4 bitplanes,
//                  diwstrt $2981 / diwstop $ffc1   and full width
//
// So the map window is rasters 41..195 (154 lines) and h 146..418 (272 lores =
// 544 hires), and the panel is rasters 203..255 (52 lines) at 640 hires wide.
// The screen is HAM8 hires with no lace, so one raster line is two rows of this
// 640x512 canvas.
const WORLD_VIEW_W = 544;
const WORLD_VIEW_X = (SHELL_W - WORLD_VIEW_W) >> 1;

// Panel.ilbm carries 41 rows, and they are two identical slots sharing their
// middle row: a cap, a narrow bar, a seventeen-row band, a narrow bar, a cap.
//
//   row  0      cap            row 20      cap (shared)
//   row  1      bar            row 21      bar
//   rows 2-18   BAND           rows 22-38  BAND
//   row 19      bar            row 39      bar
//                              row 40      cap
//
// The two bands are where text belongs, and the text was landing below both of
// them -- the second line ran past its band entirely and the hint line off the
// art. Deriving the baselines from the bands rather than guessing at them is
// what keeps the blue and the words together.
const WORLD_PANEL_ART_H = 41;
const PANEL_BAND = [{ top: 2, bottom: 18 }, { top: 22, bottom: 38 }];
const WORLD_FONT_ROWS = 8;         // worldfont's cell height, before doubling

/** The art row a line of text starts on to sit centred in band `i`. */
function panelBandRow(i) {
	const band = PANEL_BAND[i] || PANEL_BAND[0];
	return Math.round((band.top + band.bottom + 1 - WORLD_FONT_ROWS) / 2);
}

// The hint line has no band of its own -- there are only two -- so it goes just
// below the art, and the panel block reserves room for it.
const WORLD_HINT_ROW = WORLD_PANEL_ART_H + 4;
const WORLD_PANEL_H = (WORLD_HINT_ROW + WORLD_FONT_ROWS + 2) * 2;

// The original letterboxes the map into rasters 41..195 and drops the panel at
// raster 203, which on this canvas left a hundred rows of black under the panel
// doing nothing. The panel is parked at the bottom instead and the map takes
// everything above it -- same 2x zoom, simply more of the world on screen.
const WORLD_PANEL_Y = SHELL_H - WORLD_PANEL_H;
const WORLD_VIEW_GAP = 12;
const WORLD_VIEW_H = WORLD_PANEL_Y - WORLD_VIEW_GAP;

export function faceFromScroll(x) {
	return Math.max(0, Math.min(11, Math.floor(((x | 0) - FACE_ORIGIN) / FACE_WIDTH)));
}

/** Scroll position the original parks on for portrait `i`. */
export function faceScrollFor(i) {
	return FACE_SCROLL_MIN + Math.max(0, Math.min(11, i | 0)) * FACE_WIDTH;
}

// One portrait's worth of travel. The ease is driven by elapsed time, not by
// counting frames: a frame-stepped version only advanced when something asked
// for a repaint, so with requestAnimationFrame throttled (background tab, or a
// pane that is not compositing) the strip stopped halfway and stayed there.
// Time-based means any single repaint after this long lands settled.
const FACE_SCROLL_MS = 220;

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Focus portrait `i`. focusChar and faceX (the logical scroll) move at once, so
 * the info panel and all hit-testing stay exact; only the drawn offset eases,
 * the way the original's vblank handler walks chselect_x rather than jumping.
 * Pass `snap` to land immediately (startup, restoring a save, tests).
 */
export function focusFace(shell, i, snap = false) {
	const target = Math.max(0, Math.min(11, i | 0));
	shell.faceFrom = snap ? faceScrollFor(target) : faceScrollNow(shell);
	shell.faceAt = snap ? 0 : nowMs();
	shell.focusChar = target;
	shell.faceX = faceScrollFor(target);
	return shell.focusChar;
}

/** The scroll offset to draw at right now, eased toward the focused portrait. */
export function faceScrollNow(shell, t = nowMs()) {
	const to = faceScrollFor(shell.focusChar);
	const from = shell.faceFrom ?? to;
	const k = Math.min(1, (t - (shell.faceAt ?? 0)) / FACE_SCROLL_MS);
	if (k >= 1) return to;
	const ease = 1 - (1 - k) ** 3;
	return Math.round(from + (to - from) * ease);
}

/** True while the strip is still in flight, so the caller keeps repainting. */
export function faceScrolling(shell, t = nowMs()) {
	return faceScrollNow(shell, t) !== faceScrollFor(shell.focusChar);
}

// Front.s:2115 main_menu_text (CD32 branch). These are the ABSPOS coordinates
// of each menu line in the 640x512 lace space -- x is 75 throughout, and the
// gap between items 2 and 3 is wider because the original rules a separator
// there (main_menu_exit draws a row of '$', which is a solid block glyph).
// The original's four lines sit at y 150/194/238 and 316/360 -- a 44px step
// within each group and a wider gap across the separator. 'Level Editor' is a
// fourth game-mode line, so it takes the next 44px step at 282, and the single
// trailing entry keeps the same gap below the rule.
export const FRONT_MENU_POS = [
	{ x: 75, y: 150 },
	{ x: 75, y: 194 },
	{ x: 75, y: 238 },
	{ x: 75, y: 282 },
	{ x: 75, y: 360 },
];

// The title block sits at ABSPOS 45,34 (Front.s:2106).
const TITLE_POS = { x: 45, y: 34 };

// A menu line's clickable box. The font cell is much taller than the face, so
// the hit box is tied to the visible line height rather than the cell.
const MENU_LINE_H = 44;
// Top of a scrolling list screen (action / training / load).
const LIST_TOP = 150;

const INK = {
	on: [255, 231, 160],
	off: [200, 184, 152],
	dim: [128, 120, 104],
};

export function paintShell(ctx, shell, art = {}) {
	if (!ctx) return;
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, SHELL_W, SHELL_H);
	if (shell.mode === SHELL.FRONT) paintFront(ctx, shell, art);
	else if (shell.mode === SHELL.CHSELECT) paintChSelect(ctx, shell, art);
	else if (shell.mode === SHELL.WORLD) paintWorld(ctx, shell, art);
	else if (shell.mode === SHELL.ACTION || shell.mode === SHELL.TRAINING) paintList(ctx, shell, art);
	else if (shell.mode === SHELL.LOAD) paintLoad(ctx, shell, listSlots(), art);
	else if (shell.mode === SHELL.RESULT) paintResult(ctx, shell, art);
}

/**
 * Pick the face for the current screen. `'world'` selects WorldFont (16x8),
 * which is what show_map_info blits with -- FrontS is 48x44 and its lines run
 * off both edges of the map panel.
 */
function pickFont(art, big) {
	if (big === 'world') return art.fontWorld || art.fontSmall;
	return big ? art.fontBig : art.fontSmall;
}

/**
 * Draw a line of front-end text. `art.fontSmall` / `art.fontBig` are the
 * extracted FrontS / FrontB faces; without them (unit tests paint through a
 * stub canvas) this degrades to plain canvas text rather than throwing.
 */
function label(ctx, art, text, x, y, ink = INK.off, big = false) {
	const font = pickFont(art, big);
	if (!font) {
		ctx.font = big ? '32px serif' : '20px monospace';
		ctx.fillStyle = `rgb(${ink[0]},${ink[1]},${ink[2]})`;
		ctx.fillText(text, x, y + (big ? 32 : 20));
		return;
	}
	drawText(ctx, font, text, x, y, ink);
}

function labelWidth(art, text, big = false) {
	const font = pickFont(art, big);
	return font ? measureText(font, text) : text.length * (big ? 18 : 11);
}

function centred(ctx, art, text, cx, y, ink = INK.off, big = false) {
	const font = pickFont(art, big);
	if (!font) return label(ctx, art, text, cx - text.length * 5, y, ink, big);
	return drawCentred(ctx, font, text, cx, y, ink);
}

function paintFront(ctx, shell, art) {
	// FillCD32.ilbm is the full 640x512 backdrop, drawn 1:1.
	if (art.front) ctx.drawImage(art.front, 0, 0, SHELL_W, SHELL_H);

	centred(ctx, art, 'HIRED GUNS', SHELL_W / 2, TITLE_POS.y, INK.on, true);

	FRONT_ITEMS.forEach((item, i) => {
		const p = FRONT_MENU_POS[i];
		label(ctx, art, item.label, p.x, p.y, i === shell.cursor ? INK.on : INK.off);
	});

	// Front.s rules off above the trailing group with a run of '$', which the
	// font draws as a solid block (main_menu_exit, ABSPOS 65,264).
	const rule = FRONT_MENU_POS[FRONT_SEPARATOR_AT].y - 30;
	ctx.fillStyle = 'rgba(200,184,152,0.35)';
	ctx.fillRect(FRONT_MENU_POS[0].x, rule, SHELL_W - FRONT_MENU_POS[0].x * 2, 2);
}

// ChSelect.s scrolls a strip of 12 portraits; FACE_WIDTH apart, first at
// FACE_ORIGIN. The strip is 2624x256 and is shown at its native height.
// ChSelect.s screen layout, from Data/ChSelect.dat/ChSelectCD32.s:
//
//   bplcon0 %1101000000000100   5 bitplanes, hires, lace
//   diwstrt $2181 / diwstop $ffc1     v 33..255, h 129..449 (640 hires)
//   C_WAIT 149 -> bplcon0 %1100000000000100, diwstop $fbc1
//                 4 bitplanes, still interlaced
//
// So the faces strip occupies rasters 33..149 and a 16-colour info region runs
// 150..251. Lace means one raster line is one image row, so in this 640x512
// canvas the strip is rows 0..232 and the info region starts at row 234.
const CH_STRIP_H = 232;
const CH_INFO_Y = 234;

// redraw_small_faces (ChSelect.s:752) blits 64x80 faces at these offsets,
// relative to the info region.
const CH_SMALL_W = 64;
const CH_SMALL_H = 80;
const CH_SLOTS = [[458, 16], [538, 16], [458, 112], [538, 112]];

// BLIT_TEXT targets in redraw_info (ChSelect.s:699) -- origin, name, gender,
// class, all at x 42, relative to the info region.
const CH_TEXT_X = 42;
const CH_TEXT_Y = [15, 55, 110, 150];

function paintChSelect(ctx, shell, art) {
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, SHELL_W, SHELL_H);

	const img = art.faces;
	if (img) {
		const sx = Math.max(0, Math.min(img.width - SHELL_W, faceScrollNow(shell)));
		ctx.drawImage(img, sx, 0, SHELL_W, Math.min(CH_STRIP_H, img.height),
			0, 0, SHELL_W, CH_STRIP_H);
	}
	// The selected face is always the one parked at FACE_SCREEN_X, so the
	// frame is fixed rather than tracking the scroll.
	ctx.strokeStyle = 'rgb(255,231,160)';
	ctx.lineWidth = 3;
	ctx.strokeRect(FACE_SCREEN_X, 0, FACE_WIDTH, CH_STRIP_H);

	// Info region background.
	ctx.fillStyle = '#141018';
	ctx.fillRect(0, CH_INFO_Y, SHELL_W, SHELL_H - CH_INFO_Y);

	// redraw_info draws origin / name / gender / class. The port's `description`
	// field is the gender line -- it reads "Male Human, 42 years", where the
	// bare `genderName` is "n/a" for the droids and cyborgs.
	const c = (art.characters || [])[shell.focusChar] || null;
	const info = [
		c?.origin || '', c?.name || `Character ${shell.focusChar + 1}`,
		c?.description || '', c?.classText || c?.className || '',
	];
	for (let i = 0; i < CH_TEXT_Y.length; i++) {
		if (!info[i]) continue;
		label(ctx, art, info[i], CH_TEXT_X, CH_INFO_Y + CH_TEXT_Y[i],
			i === 1 ? INK.on : INK.off);
	}

	// The four party slots, drawn with the small-face sheet.
	//
	// SmallFacesCD32.gfx is 24960 bytes = 13 cells of (64/8)*80*3, and
	// SmallFaces.script cuts 13 frames row-major from the 6-column sheet --
	// one more than there are characters. Cell 0 is the empty-slot graphic and
	// chselect_chN is 1-based, so character c lives at cell c + 1. Confirmed by
	// correlating each strip face against the small sheet: big i matches small
	// i+1 for all twelve, at 0.45-0.84 against a much weaker runner-up.
	const sheet = art.smallFaces;
	const cols = art.meta?.smallFaces?.columns || 6;
	for (let i = 0; i < 4; i++) {
		const [sx, sy] = CH_SLOTS[i];
		const x = sx, y = CH_INFO_Y + sy;
		const id = shell.party[i];
		const cell = id === undefined ? 0 : id + 1;
		if (sheet) {
			ctx.drawImage(sheet,
				(cell % cols) * CH_SMALL_W, Math.floor(cell / cols) * CH_SMALL_H,
				CH_SMALL_W, CH_SMALL_H, x, y, CH_SMALL_W, CH_SMALL_H);
		} else {
			ctx.fillStyle = id === undefined ? '#22222e' : '#4a3c1a';
			ctx.fillRect(x, y, CH_SMALL_W, CH_SMALL_H);
		}
		ctx.strokeStyle = id === undefined ? '#3a3a4a' : '#8a7030';
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, CH_SMALL_W, CH_SMALL_H);
	}

	const hint = shell.party.length === 4
		? 'Return to continue' : `Choose ${4 - shell.party.length} more`;
	label(ctx, art, hint, CH_TEXT_X, CH_INFO_Y + 190, INK.dim);
}

/**
 * Marker position in display pixels, following WorldMap.s:700 draw_locns:
 *
 *     move.w locn_x(a0),d1 / move.w locn_y(a0),d2
 *     subq.w #2,d1         / subq.w #2,d2
 *     cmpi.w #198,d1 -> addi.w #1,d1        ; per-location nudges,
 *     cmpi.w #189,d1 -> subi.w #1,d2        ; note this one moves Y
 *     cmpi.w #418,d1 -> addi.w #2,d1
 *     lsl.w  #1,d1                          ; CD32 hires doubles x
 *
 * The 2 comes off *before* the comparisons and before the doubling, so x is
 * (locn_x - 2) * 2 rather than locn_x * 2 - 2, and the nudges are tested
 * against the already-decremented value. Y is doubled here as well because the
 * 384-row HAM8 map is drawn with rows doubled.
 *
 * draw_ham fills rightward and downward from this point, so it is the marker's
 * top-left corner, not its centre.
 */
function locnToMap(l) {
	let x = (l.x | 0) - 2;
	let y = (l.y | 0) - 2;
	if (x === 198) x += 1;
	if (x === 189) y -= 1;
	if (x === 418) x += 2;
	return { x: x << 1, y: y << 1 };
}

function worldCamera(shell, art) {
	const { mw, mh } = worldSize(art);
	clampWorld(shell, art);
	return { cx: shell.mapX | 0, cy: shell.mapY | 0, mw, mh };
}

function paintWorld(ctx, shell, art) {
	const cam = worldCamera(shell, art);
	// Map4.ham8 is 960x384. The screen is HAM8 hires with no lace, so source
	// rows are doubled into this canvas -- hence the /2 on the source rect.
	if (art.world) {
		ctx.drawImage(art.world,
			cam.cx, cam.cy / 2, WORLD_VIEW_W, WORLD_VIEW_H / 2,
			WORLD_VIEW_X, 0, WORLD_VIEW_W, WORLD_VIEW_H);
	}
	// Everything outside the map window is border, as on the real display.
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, WORLD_VIEW_X, WORLD_VIEW_H);
	ctx.fillRect(WORLD_VIEW_X + WORLD_VIEW_W, 0, WORLD_VIEW_X, WORLD_VIEW_H);
	ctx.fillRect(0, WORLD_VIEW_H, SHELL_W, SHELL_H - WORLD_VIEW_H);

	if (art.panel) {
		ctx.drawImage(art.panel, 0, 0, SHELL_W, WORLD_PANEL_ART_H,
			0, WORLD_PANEL_Y, SHELL_W, WORLD_PANEL_ART_H * 2);
	}
	const here = shell.list.find((l) => l.mapNum === shell.here);
	const reach = new Set((shell.reachable || []).map((l) => l.mapNum));
	const selected = displayedLocation(shell);
	// Pins live in map space; the map window is inset by WORLD_VIEW_X, and
	// nothing may spill into the border or the panel below.
	ctx.save();
	ctx.beginPath();
	ctx.rect(WORLD_VIEW_X, 0, WORLD_VIEW_W, WORLD_VIEW_H);
	ctx.clip();
	const ox = WORLD_VIEW_X - cam.cx;
	if (here) {
		ctx.strokeStyle = 'rgba(255,220,120,0.6)';
		ctx.lineWidth = 2;
		const from = locnToMap(here);
		for (const dest of here.destinations || []) {
			const to = shell.list.find((l) => l.mapNum === dest);
			if (!to) continue;
			const p = locnToMap(to);
			ctx.beginPath();
			ctx.moveTo(from.x + ox, from.y - cam.cy);
			ctx.lineTo(p.x + ox, p.y - cam.cy);
			ctx.stroke();
		}
	}
	for (const l of shell.list) {
		// draw_locns skips type_flag 1 (action) and 2 (possible campaign
		// start); everything else gets a marker.
		if ((l.typeFlag | 0) === 1 || isCampaignStart(l)) continue;
		const pin = locnToMap(l);
		const x = pin.x + ox;
		const y = pin.y - cam.cy;
		if (x < WORLD_VIEW_X - MARKER_W || y < -MARKER_H ||
			x >= WORLD_VIEW_X + WORLD_VIEW_W || y >= WORLD_VIEW_H) continue;
		const done = shell.completed.includes(l.key);
		ctx.fillStyle = done ? MARKER_GRN : MARKER_RED;
		ctx.fillRect(x, y, MARKER_W, MARKER_H);
	}
	// The original marks the current choice with a hardware sprite cursor
	// (worldmap_sprites, patched into map_sprites in the copper list) rather
	// than by recolouring the marker, so the ring is drawn on top.
	if (selected) {
		const pin = locnToMap(selected);
		const x = pin.x + ox, y = pin.y - cam.cy;
		// Dimmed when the place cannot be entered from here, so the ring keeps
		// meaning "this is what a click does".
		const canGo = (shell.reachable || []).some((l) => l.key === selected.key);
		ctx.strokeStyle = canGo ? '#ffe7a0' : 'rgba(255,231,160,0.35)';
		ctx.lineWidth = 2;
		ctx.strokeRect(x - 5, y - 5, MARKER_W + 10, MARKER_H + 10);
	}
	ctx.restore();

	// show_map_info prints the location's legend, then one of two fixed
	// phrases at ABSPOS 10,35 (WorldMap.s:431).
	const cur = selected;
	if (!cur) {
		// Pointer is over empty map. Saying nothing is the honest answer;
		// leaving the last place named reads as if it were still selected.
		worldText(ctx, art, 'arrows scroll   esc menu',
			WORLD_PANEL_Y, WORLD_HINT_ROW, INK.dim);
	} else {
		const state = shell.completed.includes(cur.key) ? AREA_DONE : AREA_OPEN;
		// The whole world screen is row-doubled into this canvas, panel art
		// included, so its text has to be doubled too or it sits at half the
		// height of everything around it. Y positions below are in the
		// screen's own (undoubled) pixels: show_map_info puts the status line
		// at ABSPOS 10,35 relative to the panel, and the legend above it.
		worldText(ctx, art, cur.name || cur.key, WORLD_PANEL_Y, panelBandRow(0), INK.on);
		worldText(ctx, art, state, WORLD_PANEL_Y, panelBandRow(1),
			state === AREA_DONE ? INK.dim : INK.off);
		// Any marker can be read; only a reachable one can be entered, so say
		// which this is rather than letting a dead click be the explanation.
		const canGo = (shell.reachable || []).some((l) => l.key === cur.key);
		const hint = !canGo
			? 'No route from here'
			: (shell.completed.includes(cur.key) && cur.mapNum !== shell.here
				? 'Return to travel' : 'Return to explore');
		worldText(ctx, art, `${hint}   arrows scroll   esc menu`,
			WORLD_PANEL_Y, WORLD_HINT_ROW, INK.dim);
	}
}

/**
 * Centre a line of WorldFont text in the panel, at `y` in the world screen's
 * own pixels, scaling 2x vertically to match the row-doubled display.
 */
function worldText(ctx, art, text, panelY, y, ink) {
	const font = art.fontWorld;
	if (!font) return centred(ctx, art, text, SHELL_W / 2, panelY + y * 2, ink, 'world');
	const w = measureText(font, text);
	ctx.save();
	ctx.translate(Math.round((SHELL_W - w) / 2), panelY + y * 2);
	ctx.scale(1, 2);
	drawText(ctx, font, text, 0, 0, ink);
	ctx.restore();
}

// draw_ham on CD32 calls .draw_it ten times, x incrementing, and each call
// writes a five-row column across all eight bitplanes -- so a marker is a
// 10x5 block in map pixels, which is 10 rows tall once Y is doubled here.
// The colours are HAM modify codes, CHANGE_RED %10111111 and CHANGE_GRN
// %11111111: control bits 10 = set red, 11 = set green, data 111111 = max.
// Only these two states exist; there is no separate "reachable" colour.
const MARKER_W = 10;
const MARKER_H = 10;
const MARKER_RED = '#ff0000';
const MARKER_GRN = '#00ff00';

// PHRASE 88 / 89 via show_map_info, resolved through Sources/engtext.
const AREA_DONE = '*** AREA COMPROMISED ***';
const AREA_OPEN = '*** AREA HAS NOT BEEN COMPROMISED ***';

// How many list rows fit between LIST_TOP and the bottom of the screen. The
// action list is 20 entries (four sets of five) and only 8 fit, so the list
// scrolls rather than drawing every entry and running off the screen.
export const LIST_ROWS = Math.floor((SHELL_H - LIST_TOP - MENU_LINE_H / 2) / MENU_LINE_H);

/** First row to draw, chosen to keep the cursor on screen. */
export function listScrollTop(shell) {
	const n = shell.list?.length | 0;
	if (n <= LIST_ROWS) return 0;
	const cur = Math.max(0, Math.min(n - 1, shell.cursor | 0));
	// Keep one row of context either side where there is room to.
	const top = Math.min(Math.max(0, cur - Math.floor(LIST_ROWS / 2)), n - LIST_ROWS);
	return Math.max(0, top);
}

function paintList(ctx, shell, art) {
	ctx.fillStyle = '#141018';
	ctx.fillRect(0, 0, SHELL_W, SHELL_H);
	centred(ctx, art, shell.mode === SHELL.TRAINING ? 'TRAINING' : 'ACTION',
		SHELL_W / 2, TITLE_POS.y, INK.on, true);
	const n = shell.list.length;
	const top = listScrollTop(shell);
	for (let row = 0; row < LIST_ROWS && top + row < n; row++) {
		const i = top + row;
		label(ctx, art, shell.list[i].name || shell.list[i].key,
			FRONT_MENU_POS[0].x, LIST_TOP + row * MENU_LINE_H,
			i === shell.cursor ? INK.on : INK.off);
	}
	// Say so when there is more list off either end.
	if (top > 0) centred(ctx, art, 'more above', SHELL_W / 2, LIST_TOP - 26, INK.dim, 'world');
	if (top + LIST_ROWS < n) {
		centred(ctx, art, `more below  (${shell.cursor + 1} of ${n})`,
			SHELL_W / 2, LIST_TOP + LIST_ROWS * MENU_LINE_H + 4, INK.dim, 'world');
	}
}


function paintLoad(ctx, shell, saves = [], art = {}) {
	ctx.fillStyle = '#141018';
	ctx.fillRect(0, 0, SHELL_W, SHELL_H);
	centred(ctx, art, 'LOAD GAME', SHELL_W / 2, TITLE_POS.y, INK.on, true);
	const rows = saves.length ? saves : [{ label: 'No saves', empty: true }];
	for (let i = 0; i < rows.length; i++) {
		const on = i === shell.cursor;
		label(ctx, art, rows[i].label, FRONT_MENU_POS[0].x, LIST_TOP + i * MENU_LINE_H,
			on ? INK.on : INK.off);
	}
	label(ctx, art, 'Return loads   Esc goes back', FRONT_MENU_POS[0].x, SHELL_H - 80, INK.dim);
}

function paintResult(ctx, shell, art = {}) {
	ctx.fillStyle = '#141018';
	ctx.fillRect(0, 0, SHELL_W, SHELL_H);
	centred(ctx, art, resultTitle(shell.result?.type), SHELL_W / 2, 180, INK.on, true);
	centred(ctx, art, 'Press return', SHELL_W / 2, 300, INK.off);
}

export function handleShellKey(shell, campaign, key) {
	if (shell.mode === SHELL.FRONT) {
		if (key === 'ArrowUp') moveCursor(shell, -1, FRONT_ITEMS.length);
		else if (key === 'ArrowDown') moveCursor(shell, 1, FRONT_ITEMS.length);
		else if (key === 'Enter' || key === ' ') return applyFrontChoice(shell, campaign);
		return { stay: true };
	}
	if (shell.mode === SHELL.CHSELECT) {
		// Move a whole portrait at a time and scroll to follow. Stepping the
		// strip by 8px and deriving the focus from the scroll offset meant the
		// cursor drifted between faces and needed many presses per character.
		if (key === 'ArrowLeft' || key === 'ArrowUp') focusFace(shell, shell.focusChar - 1);
		else if (key === 'ArrowRight' || key === 'ArrowDown') focusFace(shell, shell.focusChar + 1);
		else if (key === 'Enter' || key === ' ') {
			if (shell.party.length === 4) return confirmParty(shell, campaign);
			togglePartyChar(shell, shell.focusChar);
		} else if (key === 'Backspace' || key === 'Delete') {
			if (shell.party.length) shell.party.pop();
		} else if (key === 'Escape') {
			shell.mode = SHELL.FRONT;
			shell.cursor = 0;
			return { music: 'Front' };
		}
		return { stay: true };
	}
	if (shell.mode === SHELL.LOAD) {
		if (key === 'ArrowUp') moveCursor(shell, -1, SAVE_SLOTS.length);
		else if (key === 'ArrowDown') moveCursor(shell, 1, SAVE_SLOTS.length);
		else if (key === 'Enter' || key === ' ') return { load: SAVE_SLOTS[shell.cursor] };
		else if (key === 'Escape') {
			shell.mode = SHELL.FRONT;
			// Back to the entry that got here, found by id -- a hardcoded index
			// silently pointed at the wrong line as soon as the menu grew.
			shell.cursor = Math.max(0, FRONT_ITEMS.findIndex((i) => i.id === 'load'));
			return { music: 'Front' };
		}
		return { stay: true };
	}
	if (shell.mode === SHELL.WORLD) {
		const step = key === 'PageUp' || key === 'PageDown' ? 48 : 8;
		if (key === 'ArrowLeft' || key === 'a') panWorld(shell, -step, 0);
		else if (key === 'ArrowRight' || key === 'd') panWorld(shell, step, 0);
		else if (key === 'ArrowUp' || key === 'w') panWorld(shell, 0, -step);
		else if (key === 'ArrowDown' || key === 's') panWorld(shell, 0, step);
		else if (key === '[' || key === 'Tab') {
			moveCursor(shell, -1, shell.reachable.length);
			centerWorldOn(shell, currentLocation(shell));
		} else if (key === ']') {
			moveCursor(shell, 1, shell.reachable.length);
			centerWorldOn(shell, currentLocation(shell));
		} else if (key === 'Enter' || key === ' ') return beginLocation(shell, campaign);
		else if (key === 'Escape') {
			shell.mode = SHELL.FRONT;
			shell.cursor = 0;
			return { music: 'Front' };
		}
		return { stay: true };
	}
	if (shell.mode === SHELL.ACTION || shell.mode === SHELL.TRAINING) {
		const n = shell.list.length;
		if (key === 'ArrowUp' || key === 'ArrowLeft') moveCursor(shell, -1, n);
		else if (key === 'ArrowDown' || key === 'ArrowRight') moveCursor(shell, 1, n);
		// 20 action levels do not fit on one screen, so give it paging too.
		else if (key === 'PageUp') shell.cursor = Math.max(0, shell.cursor - LIST_ROWS);
		else if (key === 'PageDown') shell.cursor = Math.min(n - 1, shell.cursor + LIST_ROWS);
		else if (key === 'Home') shell.cursor = 0;
		else if (key === 'End') shell.cursor = Math.max(0, n - 1);
		else if (key === 'Enter' || key === ' ') return beginLocation(shell, campaign);
		else if (key === 'Escape') {
			shell.mode = SHELL.FRONT;
			shell.cursor = 0;
			return { music: 'Front' };
		}
		return { stay: true };
	}
	if (shell.mode === SHELL.RESULT) {
		if (key === 'Enter' || key === ' ' || key === 'Escape') return leaveResult(shell, campaign);
		return { stay: true };
	}
	return { stay: true };
}

export function handleShellClick(shell, campaign, sx, sy, art = {}) {
	if (shell.mode === SHELL.FRONT) {
		for (let i = 0; i < FRONT_MENU_POS.length; i++) {
			const p = FRONT_MENU_POS[i];
			const w = labelWidth(art, FRONT_ITEMS[i]?.label || '');
			if (sx >= p.x - 12 && sx < p.x + w + 12 && sy >= p.y && sy < p.y + MENU_LINE_H) {
				shell.cursor = i;
				return applyFrontChoice(shell, campaign);
			}
		}
	}
	if (shell.mode === SHELL.CHSELECT) {
		if (sy < CH_STRIP_H) {
			// Clicking a face focuses it; clicking the already-focused one
			// toggles it into the party, which matches the two-step feel of
			// scroll-then-select without needing the scroll.
			const i = faceFromScroll((shell.faceX | 0) + sx);
			if (i === shell.focusChar) togglePartyChar(shell, i);
			else focusFace(shell, i);
			return { stay: true };
		}
		// Clicking a filled party slot removes that character.
		for (let n = 0; n < 4; n++) {
			const [bx, by] = CH_SLOTS[n];
			const y = CH_INFO_Y + by;
			if (sx >= bx && sx < bx + CH_SMALL_W && sy >= y && sy < y + CH_SMALL_H) {
				if (shell.party[n] !== undefined) shell.party.splice(n, 1);
				return { stay: true };
			}
		}
		if (shell.party.length === 4) return confirmParty(shell, campaign);
	}
	if (shell.mode === SHELL.LOAD) {
		const i = Math.floor((sy - LIST_TOP) / MENU_LINE_H);
		if (i >= 0 && i < SAVE_SLOTS.length) {
			shell.cursor = i;
			return { load: SAVE_SLOTS[i] };
		}
	}
	if (shell.mode === SHELL.ACTION || shell.mode === SHELL.TRAINING) {
		// The row clicked is an offset into the visible window, not the list.
		const row = Math.floor((sy - LIST_TOP) / MENU_LINE_H);
		const i = listScrollTop(shell) + row;
		if (row >= 0 && row < LIST_ROWS && i < shell.list.length) {
			shell.cursor = i;
			return beginLocation(shell, campaign);
		}
	}
	if (shell.mode === SHELL.WORLD) {
		const hit = pickWorldLocation(shell, sx, sy, art);
		if (hit >= 0) {
			shell.cursor = hit;
			shell.hoverKey = null;
			return beginLocation(shell, campaign);
		}
	}
	if (shell.mode === SHELL.RESULT) return leaveResult(shell, campaign);
	return { stay: true };
}

/**
 * The reachable destination under the pointer, or -1.
 *
 * Shared by clicking and hovering so the two cannot disagree about what is
 * under the cursor -- the whole point of the hover is to say what a click will
 * do.
 */
export function pickWorldLocation(shell, sx, sy, art = {}) {
	if (shell.mode !== SHELL.WORLD || sy >= WORLD_VIEW_H) return -1;
	if (!shell.reachable || !shell.reachable.length) return -1;
	const cam = worldCamera(shell, art);
	let best = -1, bestD = 1e9;
	for (let i = 0; i < shell.reachable.length; i++) {
		// locnToMap gives the marker's top-left (draw_ham fills right and down
		// from it), so aim at the marker's centre.
		const pin = locnToMap(shell.reachable[i]);
		const dx = (pin.x - cam.cx + WORLD_VIEW_X + MARKER_W / 2) - sx;
		const dy = (pin.y - cam.cy + MARKER_H / 2) - sy;
		const d = dx * dx + dy * dy;
		if (d < bestD) { bestD = d; best = i; }
	}
	// 40px pick radius, squared -- doubled with the rest of the screen.
	return bestD < 1600 ? best : -1;
}

/** Every location the map draws a marker for -- reachable or not. */
export function markedLocations(shell) {
	// Same filter as the marker loop: draw_locns skips type_flag 1 (action) and
	// possible campaign starts.
	return (shell.list || []).filter((l) => (l.typeFlag | 0) !== 1 && !isCampaignStart(l));
}

/**
 * The marker under the pointer, reachable or not, or null.
 *
 * Hovering reads ANY marker while clicking only accepts reachable ones: being
 * told what a place is costs nothing, and refusing to name it is just a mystery.
 */
export function pickWorldMarker(shell, sx, sy, art = {}) {
	if (shell.mode !== SHELL.WORLD || sy >= WORLD_VIEW_H) return null;
	const cam = worldCamera(shell, art);
	let best = null, bestD = 1e9;
	for (const l of markedLocations(shell)) {
		const pin = locnToMap(l);
		const dx = (pin.x - cam.cx + WORLD_VIEW_X + MARKER_W / 2) - sx;
		const dy = (pin.y - cam.cy + MARKER_H / 2) - sy;
		const d = dx * dx + dy * dy;
		if (d < bestD) { bestD = d; best = l; }
	}
	return bestD < 1600 ? best : null;
}

/**
 * Point at a marker without committing to it.
 *
 * `hoverKey` is three-state, because "the pointer is over empty map" and "the
 * pointer is not on the map at all" want different panels: the first should say
 * nothing, the second should go back to describing the keyboard selection.
 *
 *   null         the pointer is not engaged with the map
 *   ''           it is over the map, but not over a marker
 *   a key        it is over that marker
 *
 * @returns true when the panel needs repainting
 */
export function hoverWorld(shell, sx, sy, art = {}) {
	const hit = pickWorldMarker(shell, sx, sy, art);
	const next = hit ? hit.key : '';
	if (shell.hoverKey === next) return false;
	shell.hoverKey = next;
	return true;
}

export function clearWorldHover(shell) {
	if (shell.hoverKey === null || shell.hoverKey === undefined) return false;
	shell.hoverKey = null;
	return true;
}

/** Is the hovered location somewhere the party can actually travel to? */
export function hoverIsReachable(shell) {
	if (!shell.hoverKey) return false;
	return (shell.reachable || []).some((l) => l.key === shell.hoverKey);
}

/**
 * What the world panel should describe.
 *
 * Over a marker: that marker. Over empty map: nothing, rather than leaving the
 * last answer up as if it still applied. Not on the map: the keyboard cursor.
 * Launching still goes through currentLocation, so hovering an unreachable
 * place cannot start it.
 */
export function displayedLocation(shell) {
	if (shell.mode !== SHELL.WORLD) return currentLocation(shell);
	if (shell.hoverKey === null || shell.hoverKey === undefined) return currentLocation(shell);
	if (shell.hoverKey === '') return null;
	return markedLocations(shell).find((l) => l.key === shell.hoverKey) || null;
}

export function startWorldDrag(shell, sx, sy) {
	if (shell.mode !== SHELL.WORLD || sy >= WORLD_VIEW_H) return;
	shell.drag = { sx, sy, mapX: shell.mapX | 0, mapY: shell.mapY | 0, moved: false };
}

export function moveWorldDrag(shell, sx, sy, art) {
	const d = shell.drag;
	if (!d) return false;
	const dx = d.sx - sx, dy = d.sy - sy;
	if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
	shell.mapX = d.mapX + dx;
	shell.mapY = d.mapY + dy;
	clampWorld(shell, art);
	return true;
}

export function endWorldDrag(shell) {
	const moved = !!shell.drag?.moved;
	shell.drag = null;
	return moved;
}
