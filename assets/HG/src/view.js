// Shared view logic: turns a player position into an ordered list of atlas
// rects to paint. Both renderers consume the same list, so the WebGPU and
// Canvas2D paths cannot drift.
//
// This mirrors scan_view + blit_view from Sources/Drawviews.s.

export const VIEW_W = 142;
export const VIEW_H = 84;
export const VIEW_X = 2;   // offset of the 3D window inside a player pane
export const VIEW_Y = 14;
export const PANE_W = 160;
export const PANE_H = 105;
export const SCREEN_W = 320;
// 212 is the Amiga's display height, but its two pane rows are not adjacent:
// the copper hands rasters 141-149 to the message band and only restarts the
// lower views at raster 166 -- eight rows further down than the upper row's
// stride implies. This port never allowed for that gap, so the band sat on top
// of the panes. The canvas grows by those eight rows and the bottom row moves
// down by them; every offset inside a pane is unchanged.
export const BAND_GAP = 8;
export const SCREEN_H = 212 + BAND_GAP;
export const NUM_SLOTS = 67;

export const MAP_WIDTH = 23;
export const MAP_DEPTH = 23;
export const MAP_HEIGHT = 20;
export const LEVEL_CELLS = MAP_WIDTH * MAP_DEPTH;

const OPAQUE_BIT = 1 << 6;
const INVISIBLE_BIT = 1 << 7;

const SHIFT = { floor: 9, block: 11, water: 17, panel: 19, explosion: 21, variant: 23, aux: 28 };
const MASK = { floor: 0x3, block: 0x3f, water: 0x3, panel: 0x3, explosion: 0x3, variant: 0x1f, aux: 0xf };

const GFX_BLOCK_BASE = 5;
const GFX_PANEL_BASE = 29;
const GFX_AUX_BASE = 32;
const GFX_LIGHT = 4;

export const DIRECTIONS = ['north', 'east', 'south', 'west'];

// skyline_window (Drawviews.s) fills the pane background with two solid
// 160x56 bands before anything else is drawn. It does this by setting and
// clearing whole bitplanes rather than blitting an image; decoding its
// per-plane ops gives colour 38 for the upper band and 32 for the lower.
//
// The band boundary lands at pane y 56, i.e. view y 42 -- exactly where the
// same-level block art stops and the floor plane has not yet started. Without
// this fill, rows 42..49 of every enclosed view are left unpainted.
// Whether sky is visible from a cell is stored per direction in the items
// layer, bits 24-27 (keep_sky / sky_shift in Equates.i). draw_horizon bails out
// entirely when the bit for the facing direction is clear, so enclosed views
// keep the cleared background rather than getting a sky fill.
export const SKY_SHIFT = 24;
export function hasSky(items, cell, direction) {
	return ((items[cell] >>> (SKY_SHIFT + (direction & 3))) & 1) !== 0;
}

export const SKY_BAND_HEIGHT = 56;
// skyline_window's two bobs carry no image data, only plane ops, so their
// colour is read straight off those (Drawviews.s:2612):
//   .bob1  clear,set,set,clear,clear,set  -> planes 1,2,5 -> colour 38
//   .bob2  all clear                      -> colour 0
// The lower band is therefore colour 0, NOT 32. That matters now that 32 is the
// lit bank's first entry (a blue-grey haze) rather than a stand-in for black.
export const SKY_UPPER_INDEX = 38;
export const SKY_LOWER_INDEX = 0;

// The 64 real hardware indices. Anything at or above this is a synthetic
// per-row gradient entry standing in for a copper rewrite, and has no
// bitplanes for a decal to set.
export const HW_INDEX_COUNT = 64;

// draw_horizon blits two of the four 144x32 single-bitplane strips at
// pane+(2,24), i.e. view (0,10): first strip (dir+2)&3 with plane mask %110000,
// then strip dir with mask %110110. The strips are their own mask, so only set
// bits write, and each blit ORs its planes into whatever is underneath. Over
// the upper sky band (colour 38) both resolve to colour 54, so the visible
// result is the union of the two silhouettes in one colour.
export const HORIZON_W = 144;
export const HORIZON_H = 32;
export const HORIZON_VIEW_Y = 10;
// draw_horizon issues two blits, but only ONE silhouette is visible. Both bob
// structures (.horizon_bob / .horizon_bob2, Drawviews.s:979) set mask plane 0,
// so the strip is its own mask and only set bits write. Their per-plane ops
// decide the colour:
//   .horizon_bob  = clear,set,set,clear,set,clear -> colour 22, strip (dir+2)&3
//   .horizon_bob2 = all clear                     -> colour 0 (BLACK), strip dir
// Colour 22 matches the sky, so the first pass is invisible; the silhouette the
// player sees is the flat black one drawn from the strip for the CURRENT
// direction. Drawing both as visible layers was wrong - it showed the same two
// silhouettes for opposite facings with their colours swapped.
// CD32 build. draw_horizon issues TWO blits and both are visible:
//   .horizon_bob  (Drawviews.s:979) plane ops clear,set,set,clear,set,clear
//                 -> colour 22, drawn from the FAR strip (dir+2)&3
//   .horizon_bob2 plane ops all clear
//                 -> colour 0 (black), drawn from the NEAR strip dir
// Colour 22 is animated by the copper from scotch_mist (proved from the C_SKY
// macro in Macros.i: bank 0 color22 -> index 22), so the far range is a tinted
// gradient and the near range is a flat black cut-out in front of it.
export const HORIZON_COLOUR = 0;
export const HORIZON_FAR_COLOUR = 22;
export const HORIZON_NEAR_COLOUR = 0;
export const HORIZON_FAR_BASE = 176;   // per-row gradient rows for colour 22

// The planet. draw_horizon blits a 96x42 one-bitplane mask at pane+(22,14) =
// view (20,0), and ONLY when facing south, with redraw_temp %10010000 -- which
// sets plane 4, so sky colour 38 becomes 54. It re-tints the sky through the
// nosky_planet ramp rather than painting its own colours, which is why it reads
// as a faint wash "seen through the atmosphere" rather than a hard sprite.
export const PLANET_W = 96;
export const PLANET_H = 42;
export const PLANET_VIEW_X = 20;
export const PLANET_VIEW_Y = 0;
export const PLANET_FACING = 2;      // south only
export const PLANET_COLOUR = 54;
export const PLANET_GRADIENT_BASE = 128;

/** Per-row runs of the planet mask, or [] when not facing south. */
export function planetSpans(mask, direction) {
	if (!mask || (direction & 3) !== PLANET_FACING) return [];
	const rowBytes = PLANET_W / 8;
	const runs = [];
	for (let y = 0; y < PLANET_H; y++) {
		const vy = PLANET_VIEW_Y + y;
		if (vy < 0 || vy >= VIEW_H) continue;
		let start = -1;
		for (let x = 0; x <= PLANET_W; x++) {
			const on = x < PLANET_W && ((mask[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1);
			if (on && start < 0) start = x;
			else if (!on && start >= 0) {
				runs.push({ x: PLANET_VIEW_X + start, y: vy, w: x - start, row: y });
				start = -1;
			}
		}
	}
	return runs;
}

// The copper rewrites the three sky registers (22, 38, 54) once per raster
// line from the 44-entry tables in Sky.s, which is what produces the vertical
// gradient. A flat palette cannot express that, so each gradient row is given
// its own synthetic palette index above the hardware's 64.
export const SKY_GRADIENT_ROWS = 44;
export const SKY_GRADIENT_BASE = 64;      // rows 0..43 of the sky band
export const HORIZON_GRADIENT_BASE = 128; // rows 0..31 of the horizon strip
export const skyRowIndex = (row) => SKY_GRADIENT_BASE + row;
export const horizonRowIndex = (row) => HORIZON_GRADIENT_BASE + row;

// scroll_field (ColdStartup.s) rewrites colour register 6 across twenty-one
// four-line copper bands. Field pixels get remapped to these synthetic entries
// so the palette can move while the view index buffer stays Amiga-like.
export const FIELD_COLOUR_BASE = 224;
export const FIELD_COLOUR_ROWS = 21;
export const FIELD_COLOUR_PERIOD = 90;

/**
 * Decode the horizon for one facing into horizontal runs, one set per row, so
 * every row can be drawn in its own gradient colour.
 * @param strips Uint8Array of 4 x 576 bytes
 * @returns array of {x, y, w, row} runs in view coordinates
 */
function stripRuns(strips, strip) {
	const rowBytes = HORIZON_W / 8;
	const set = (x, y) =>
		(strips[strip * 576 + y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
	const runs = [];
	const width = Math.min(HORIZON_W, VIEW_W);
	for (let y = 0; y < HORIZON_H; y++) {
		const vy = HORIZON_VIEW_Y + y;
		if (vy < 0 || vy >= VIEW_H) continue;
		let start = -1;
		for (let x = 0; x <= width; x++) {
			const on = x < width && set(x, y);
			if (on && start < 0) start = x;
			else if (!on && start >= 0) {
				runs.push({ x: start, y: vy, w: x - start, row: y });
				start = -1;
			}
		}
	}
	return runs;
}

/**
 * The visible horizon for one facing: the strip for the current direction, as
 * per-row horizontal runs, painted flat black.
 */
export function horizonSpans(strips, direction) {
	return {
		far: stripRuns(strips, ((direction & 3) + 2) & 3),
		near: stripRuns(strips, direction & 3),
	};
}

/**
 * Pane origins for the four players, matching pl{1..4}_view_{x,y}offset.
 *
 * The bottom row sits BAND_GAP lower than a simple PANE_H stride would put it.
 * The copper gives rasters 141-149 to the message band and only restarts the
 * lower views at raster 166 -- eight rows further down than the upper row's
 * stride implies -- so the band has somewhere to live instead of covering the
 * panes.
 */
export const PANE_ORIGINS = [
	[0, 0], [PANE_W, 0], [0, PANE_H + BAND_GAP], [PANE_W, PANE_H + BAND_GAP],
];

// CD32 bank bits. block_draw (Drawviews.s:3880) rewrites bob_plane[5] on every
// blit: normally CLEAR, SET when redraw_temp bit 15 is on (.draw_bob_illuminate,
// i.e. the cell's keep_light bit), and NODRAW for water so the lit state under
// it survives. Water's own bob has plane 4 = SET (Water1-4.bin ops 0,0,0,0,3,0),
// so the two high planes are independent banks:
//
//   plane 5 (+32) = lit      plane 4 (+16) = water
//
// which is why the copper carries four 16-colour banks: 0-15 unlit, 16-31 unlit
// under water, 32-47 lit, 48-63 lit under water. Both are INDEX OFFSETS applied
// after the art, never blits.
export const LIGHT_OFFSET = 32;
export const WATER_OFFSET = 16;
// Explosion1-4.bin plane ops are 3,2,2,3,2,0 -- set/clear on planes 0-4 and
// nodraw on 5 -- so a covered pixel becomes colour 9 in whichever lit bank it
// was already in. Foam.bin is 3,2,2,2,0,0: colour 1, both banks preserved.
export const EXPLOSION_COLOUR = 9;
export const FOAM_COLOUR = 1;
export const LIGHT_MIN_INDEX = 1;
export const LIGHT_MAX_INDEX = 15;
const LIGHT_BIT = 31;                       // keep_light_bit_num, items layer
const LIGHT_SIDE = 0, LIGHT_REAR = 1, LIGHT_FLOOR = 2;

// Door opening. blit_block's .mirror path (Drawviews.s:3765) draws a split bob
// twice -- upright `gap` pixels higher, flipped `gap` pixels lower -- with the
// cell's variant (0-10, driven by move_doors) choosing the gap. So a door is one
// image whose halves slide apart, and both are clipped to the closed door's own
// extent so they never spill past the frame.
//
// The separation shrinks with distance: dh is the near table and the three
// further ones scale it by 13/23, 10/23 and 6/23. Entry 9 of the farthest table
// really does reuse dh6 in the original -- a typo in the source that is kept
// here because it is what the game draws.
const DH = [2, 6, 9, 12, 14, 16, 18, 20, 21, 22, 23];
const scaleDH = (n) => DH.map((v, i) => Math.floor(((i === 9 ? DH[5] : v) * n) / 23));
const DOOR_GAP = [DH, scaleDH(13), scaleDH(10), scaleDH(6)];
// Depth class by slot, and how much shorter the clip window is at that depth.
const DOOR_DEPTH = (slot) => (slot <= 16 ? 3 : slot <= 33 ? 2 : slot <= 48 ? 1 : 0);
const DOOR_CLIP_TRIM = [0, 22, 30, 38];

// DELIBERATE DIVERGENCE, kept because it reads better than the original.
//
// A grenade carries its height in the cell's variant, but its bobs all have
// control 0, so blit_block never reaches the .mirror path and the original
// draws it at the same spot in the cell whatever its height. Height shows only
// when it crosses a level boundary.
//
// Lifting the sprite by that height instead gives a thrown grenade a visible
// arc. What it must NOT do is lift by a flat pixel count: a launched grenade
// flies at a constant height 25 with no ballistics (yvel -1000 is a sentinel),
// so a flat offset pinned it 25 rows up the pane for its whole flight and it
// read as climbing rather than receding.
//
// So it is scaled by depth, using the same 23/13/10/6 the source scales the
// door's variant by across the four bands. The lift then shrinks as the grenade
// travels away, which is what makes the flat shot read as going away from you.
const HEIGHT_SCALE = [23, 13, 10, 6];
const grenadeLift = (height, depth) =>
	Math.floor((((height | 0) & 31) * HEIGHT_SCALE[depth]) / 23);
const DOOR_CLIP_HEIGHT = 52;

/**
 * Reduce a bob's six bob_plane ops to a keep/set pair.
 *
 * These bobs carry a single plane of data which is also their mask, so a "copy"
 * on any plane writes a 1 wherever the bob covers -- the same as "set". Plane 5
 * is not the bob's own: block_draw rewrites it on every blit, clear normally and
 * set when the cell is lit.
 *
 *   op 0 nodraw -> keep the bit that is already there
 *   op 1 copy   -> 1     op 2 clear -> 0     op 3 set -> 1
 *
 * so a covered pixel becomes (v & keep) | set.
 */
function planeOp(ops, lit) {
	let keep = 0, set = 0;
	for (let p = 0; p < 6; p++) {
		const op = p === 5 ? (lit ? 3 : 2) : ops[p];
		if (op === 0) keep |= 1 << p;
		else if (op === 1 || op === 3) set |= 1 << p;
	}
	return { keep, set };
}

const isStoneOrPush = (cell) => {
	if (!(cell & 2)) return false;
	const t = (cell >>> SHIFT.block) & MASK.block;
	return t === 0 || t === 1;
};

export const cellIndex = (x, y, floor) => floor * LEVEL_CELLS + y * MAP_WIDTH + x;

// Cell field bits.
const FLOOR_HERE = 1, BLOCK_HERE = 2, WATER_HERE = 4;
const PANEL_HERE = 8, EXPLOSION_HERE = 16, AUX_HERE = 32;

// Block types 22-31 are ExGfx (grenades, sentry guns) and 32-47 are player
// figures; both live outside the style table.
const BLOCK_EXGFX_FIRST = 22;
// Monsters occupy block types 8-15 (slot 1 at 8, slot 2 at 12, plus facing).
const BLOCK_MONSTER_FIRST = 8;
const BLOCK_MONSTER_LAST = 15;
// Drawviews.s:3595. A monster carrying m_flashed blits with redraw_temp
// %0000010000111111 and redraw_solid 1 -- bit 10 sends draw_bob down its
// .solid path, filling the whole silhouette with colour 1. That is the white
// flash when a monster takes a hit. m_outlined uses colour 6 instead.
const MONSTER_SOLID_WHITE = 1;
const MONSTER_SOLID_OUTLINE = 6;
const BLOCK_PLAYER_FIRST = 32;
const BLOCK_PLAYER_LAST = 47;
const AUX_SKELETON = 7;
const SLOT_UNDER_FOOT = 66; // the cell the player is standing in
const PLAYER_SOLID_SHIELD = 6;
const PLAYER_SOLID_WHITE = 1;

// activate_planes: keep_variant_player is only the owner index. Shield and
// fire_white are read from the live player struct, not the glow variant bits.
export function playerSolidColour(party, variant) {
	const p = party?.[variant & 3];
	if (!p) return 0;
	if (p.spellShield) return PLAYER_SOLID_SHIELD;
	if (p.fireWhite) return PLAYER_SOLID_WHITE;
	return 0;
}

// Text-panel CONTENT. Drawviews.s:3318 draws it only at view slot 57 --
// directly ahead, one step away -- and only for panel type 0, OR-ing the
// 2-bit image into screen planes 0-1 at view (46,22), 48x40. The frame
// plate (graphic 29) is drawn separately for every slot, which is why a
// panel reads as blank when faced head-on until this runs.
export const PANEL_SLOT = 57;
export const PANEL_VIEW_X = 46, PANEL_VIEW_Y = 22;
export const PANEL_W = 48, PANEL_H = 40;

/**
 * Port of blit_view's .blocks_above / .blocks_below (Sources/Drawviews.s:2890,
 * 3084). Every component of one cell, in the exact order the original blits
 * them -- including the light, water and explosion overlays, which are index
 * offsets rather than art and so are emitted as decals.
 *
 *   above (bob 0-20):  rear light, aux, block, panel, water, explosion,
 *                      side light, FLOOR LAST
 *   below (bob 21-66): rear light, FLOOR FIRST, floor light, aux, water(<3),
 *                      block, panel, explosion, aux again, water(=3), side light
 *
 * For the level above you are looking at the underside of its floor, so that
 * floor is painted over everything; at or below your own level the floor is the
 * surface everything else stands on, so it goes down first.
 *
 * Ordering is not cosmetic: a decal only shifts pixels that are already on the
 * screen, so a light emitted after the near wall that occludes it would bleed
 * through. The two water passes exist because a full-height (level 3) surface
 * belongs on top of the block, while a partial one sits under it.
 *
 * Emitted layers are one of
 *   {g}                 style graphic index, `lit` set when illuminated
 *   {light: which}      light mask 0 side / 1 rear wall / 2 floor
 *   {water: level}      water mask, `lit` from .draw_bob_illuminate
 *   {expl: variant}     explosion mask
 *   {attack}            source `monster_attacking` close-front replacement BOB
 *   {player}            player figure from miscgfx+player_addresses
 *   {solid}             activate_planes rewrite: 6 shield / 1 fire_white
 *   {skeleton}          corpse BOB from miscgfx+skeleton_bob (AUX type 7)
 * Exgfx/player/skeleton live outside the style table.
 */
function cellLayers(cell, out, isAbove, direction, slot, tables, ctx) {
	out.length = 0;
	const floorType = (cell >>> SHIFT.floor) & MASK.floor;
	const rawBlock = (cell >>> SHIFT.block) & MASK.block;
	const rawAux = (cell >>> SHIFT.aux) & MASK.aux;
	const waterLevel = (cell >>> SHIFT.water) & MASK.water;

	// Directional graphics (monsters, stairs, doors, players) are re-indexed by
	// the viewer's facing before lookup.
	const blockType = tables.blockRotations[direction & 3][rawBlock];
	const auxType = tables.auxRotations[direction & 3][rawAux];
	const lit = ctx.lit;

	// .draw_bob vs .draw_bob_illuminate decides whether plane 5 is cleared or
	// set, so `lit` is per LAYER, not per cell.
	// `useVariant` marks the one layer that feeds blit_block's d6. Only the
	// BLOCK path does (`move.l d1,d6`); the aux path forces `moveq #0,d6`, which
	// is why a door's guide rails are the same split bob yet never slide.
	const gfx = (g, isLit, useVariant) =>
		out.push({ g, lit: !!isLit, useVariant: !!useVariant });

	const floorLayer = () => {
		if (!(cell & FLOOR_HERE)) return;
		// Floor type 3 is a puddle, or a light bulb when a stone block sits on it.
		// The bulb is blitted with redraw_temp bit 15 hard-set, so it is lit even
		// in an unlit cell; an ordinary ceiling above is drawn with plain
		// .draw_bob and is never lit, while a floor below is illuminated.
		const lightBulb = floorType === 3 && (cell & BLOCK_HERE) && rawBlock === 0;
		if (lightBulb) gfx(GFX_LIGHT, true);
		else gfx(floorType, isAbove ? false : lit);
	};
	// The floor light is suppressed over floor types 0 and 2 but still drawn
	// where there is no floor at all (Drawviews.s:3125 falls into the check).
	const floorLightLayer = () => {
		if (!ctx.lit || !ctx.belowStone) return;
		if ((cell & FLOOR_HERE) && (floorType === 0 || floorType === 2)) return;
		out.push({ light: LIGHT_FLOOR });
	};
	const auxLayer = () => {
		if (!(cell & AUX_HERE)) return;
		// .skel_above / .skel_below: AUX 7 is miscgfx+skeleton_bob, not rotate_aux.
		// Underfoot is deferred -- Skeleton.bin bob 44 is a control-3 placeholder.
		if (rawAux === AUX_SKELETON) {
			if (!isAbove && slot === SLOT_UNDER_FOOT) return;
			out.push({ skeleton: true, lit });
			return;
		}
		// Containers underfoot are deferred to the second aux pass so they sit
		// in front of the block and panel, not behind them.
		if (!isAbove && rawAux >= 2 && rawAux <= 6 && slot === SLOT_UNDER_FOOT) return;
		gfx(GFX_AUX_BASE + auxType, lit);
	};
	// .no_aux_below2: only the cell underfoot, only containers and the skeleton,
	// and drawn with plain .draw_bob so it is never illuminated. .skel_below2
	// does not blit the bones; it draws the first carried item's container aux.
	const auxLayer2 = () => {
		if (!(cell & AUX_HERE) || slot !== SLOT_UNDER_FOOT) return;
		if (rawAux < 2 || rawAux > 7) return;
		if (rawAux === AUX_SKELETON) {
			const aux = ctx.skeletonUnderfootAux | 0;
			if (aux >= 2 && aux <= 6) gfx(GFX_AUX_BASE + aux, false);
			return;
		}
		gfx(GFX_AUX_BASE + auxType, false);
	};
	const blockLayer = () => {
		if (!(cell & BLOCK_HERE)) return;
		if (ctx.monsterAttacking && slot === PANEL_SLOT && (blockType === 8 || blockType === 12)) {
			out.push({ attack: blockType === 8 ? 13 : 17, lit, useVariant: true });
			return;
		}
		if (blockType >= BLOCK_PLAYER_FIRST) {
			if (blockType <= BLOCK_PLAYER_LAST) {
				const variant = (cell >>> SHIFT.variant) & MASK.variant;
				const solid = playerSolidColour(ctx.party, variant);
				out.push({
					player: blockType - BLOCK_PLAYER_FIRST,
					lit,
					variant,
					...(solid ? { solid } : {}),
				});
			}
			return;
		}
		if (blockType >= BLOCK_EXGFX_FIRST) {
			out.push({ ex: blockType, lit, useVariant: true });
			return;
		}
		if (blockType >= BLOCK_MONSTER_FIRST && blockType <= BLOCK_MONSTER_LAST) {
			// decr_monster_fitness sets monster_white; putMonsterInMap encodes it
			// as variant bit 0 (m_flashed) and clears the flag straight after, so
			// the flash lasts exactly one redraw, as in the original.
			const variant = (cell >>> SHIFT.variant) & MASK.variant;
			const solid = (variant & 1) ? MONSTER_SOLID_WHITE
				: (variant & 2) ? MONSTER_SOLID_OUTLINE : 0;
			out.push({
				g: GFX_BLOCK_BASE + blockType, lit, useVariant: true,
				...(solid ? { solid } : {}),
			});
			return;
		}
		gfx(GFX_BLOCK_BASE + blockType, lit, true);
	};
	const panelLayer = () => {
		if (!(cell & PANEL_HERE)) return;
		gfx(GFX_PANEL_BASE + ((cell >>> SHIFT.panel) & MASK.panel), false);
	};
	// Above draws every water level in one pass; below splits it, partial levels
	// under the block and a full level over it.
	const waterLayer = (wantFull) => {
		if (!(cell & WATER_HERE)) return;
		if (!isAbove && (waterLevel === 3) !== wantFull) return;
		out.push({ water: waterLevel, lit });
	};
	const explosionLayer = () => {
		if (!(cell & EXPLOSION_HERE)) return;
		out.push({ expl: (cell >>> SHIFT.explosion) & MASK.explosion });
	};
	const rearLightLayer = () => {
		if (ctx.lit && ctx.rearStone) out.push({ light: LIGHT_REAR });
	};
	// Gated on the SIDE cell's light bit and on this cell being the wall it
	// falls on, so the mask lands on a face that is actually there.
	const sideLightLayer = () => {
		if (ctx.sideLit && isStoneOrPush(cell)) out.push({ light: LIGHT_SIDE });
	};

	if (isAbove) {
		rearLightLayer(); auxLayer(); blockLayer(); panelLayer();
		waterLayer(true); explosionLayer(); sideLightLayer(); floorLayer();
	} else {
		rearLightLayer(); floorLayer(); floorLightLayer(); auxLayer();
		waterLayer(false); blockLayer(); panelLayer(); explosionLayer();
		auxLayer2(); waterLayer(true); sideLightLayer();
	}
	return out;
}

/**
 * Build the draw list for one player view.
 * @returns array of {ax, ay, w, h, x, y} in view-local coordinates, far to near
 */
export function buildDrawList({ cells, items, x, y, floor, direction, tables, style,
	lights, water, explosions, foam, panels, exgfx, monsterAttacking = 0,
	skeletonUnderfootAux = 0, party = null, tallObjects = false }) {
	const facing = tables.facings[DIRECTIONS[direction & 3]];
	const base = cellIndex(x, y, floor);

	// 1. sample the 67 frustum cells
	const view = new Uint32Array(NUM_SLOTS);
	for (let i = 0; i < NUM_SLOTS; i++) {
		const idx = base + facing[i];
		view[i] = idx >= 0 && idx < cells.length ? cells[idx] : 0;
	}

	// 2. hide slots fully occluded by opaque cells
	const hidden = new Uint8Array(NUM_SLOTS);
	for (let slot = 0; slot < NUM_SLOTS; slot++) {
		const cases = tables.occlusion[slot];
		for (let c = 0; c < cases.length; c++) {
			const refs = cases[c];
			let all = true;
			for (let k = 0; k < refs.length; k++) {
				if (!(view[refs[k]] & OPAQUE_BIT)) { all = false; break; }
			}
			if (all) { hidden[slot] = 1; break; }
		}
	}

	// 3. collect the visible slots' graphics, far to near
	//
	// .draw_bob defaults plane 5 to CLEAR, and .draw_bob_illuminate sets it
	// (bset.b #7 on a big-endian word = bit 15) when the cell's keep_light bit is
	// set. Plane 5 is worth +32, so an UNLIT cell lands in palette 0-15 -- which
	// the copper holds near-black at the view raster lines -- and a lit one lands
	// in 32-47, the full block ramp. Lighting is the normal state; its absence is
	// the shadow.
	const list = [];
	const layers = [];
	const lightBit = (slotNo) => {
		if (!items || slotNo < 0 || slotNo >= NUM_SLOTS) return false;
		const i = base + facing[slotNo];
		if (i < 0 || i >= items.length) return false;
		return ((items[i] >>> LIGHT_BIT) & 1) !== 0;
	};
	const nb = (o) => (o >= 0 && o < NUM_SLOTS ? view[o] : 0);

	// Two floors down, so emitted before the frustum proper -- everything the
	// normal walk draws afterwards covers it.
	if (tallObjects) {
		emitTallObjects({
			cells, base, facing, tables, style, view, hidden,
			push: (rect) => list.push(rect),
		});
	}

	for (let slot = 0; slot < NUM_SLOTS; slot++) {
		if (hidden[slot]) continue;
		const cell = view[slot];
		if (cell & INVISIBLE_BIT) continue;
		const map0 = tables.slotMap[slot];
		const bob = map0.bob;
		// keep_light lives on OPEN cells -- essentially every walkable square
		// carries it and almost no solid block does. So a wall face is lit not by
		// its own bit but by the rear/side/floor light mask that the open cell in
		// front of it emits, which is why those masks are gated on a neighbour
		// being stone or pushable.
		const ctx = {
			lit: lightBit(slot),
			monsterAttacking,
			rearStone: isStoneOrPush(nb(map0.rear)),
			belowStone: isStoneOrPush(nb(map0.below)),
			sideLit: lightBit(map0.side),
			skeletonUnderfootAux,
			party,
		};
		// blit_view branches on the bob index: 0-20 is the level above, the rest
		// is the player's own level and below.
		cellLayers(cell, layers, bob <= 20, direction, slot, tables, ctx);

		for (let i = 0; i < layers.length; i++) {
			const L = layers[i];

			if (L.attack !== undefined) {
				const attack = style.graphics[L.attack]?.attack;
				const s = attack?.slot;
				if (!s) continue;
				list.push(L.lit ? { ...s, lit: true } : s);
				continue;
			}

			// Decals: index offsets over whatever this slot has already painted.
			// They must be emitted HERE, inside the slot's own sequence -- the
			// original does the same, so a nearer wall drawn afterwards covers
			// them. Applying them in a later pass let far-slot lights bleed
			// through near walls.
			if (L.light !== undefined) {
				if (!lights) continue;
				const set = lights.sets[L.light];
				const sl = set && set.slots[bob];
				if (!sl || sl.ax === undefined) continue;
				list.push({ ...sl, light: true });
				if (sl.mirror && sl.mirror.ax !== undefined) {
					list.push({ ...sl.mirror, light: true });
				}
				continue;
			}
			if (L.water !== undefined) {
				if (!water) continue;
				const set = water.sets[L.water];
				const sl = set && set.slots[bob];
				if (!sl || sl.ax === undefined) continue;
				list.push({ ...sl, waterDecal: true, lit: L.lit, slot });
				if (sl.mirror && sl.mirror.ax !== undefined) {
					list.push({ ...sl.mirror, waterDecal: true, lit: L.lit, slot });
				}
				continue;
			}
			if (L.expl !== undefined) {
				if (!explosions) continue;
				const set = explosions.sets[L.expl];
				const sl = set && set.slots[bob];
				if (!sl || sl.ax === undefined) continue;
				const explTag = explosions.kind === 'indexedSprite'
					? { explSprite: true }
					: { explDecal: true };
				list.push({ ...sl, ...explTag });
				if (sl.mirror && sl.mirror.ax !== undefined) {
					list.push({ ...sl.mirror, ...explTag });
				}
				continue;
			}
			if (L.ex !== undefined) {
				const block = exgfx?.blocks?.find((b) => b.block === L.ex);
				const s = block?.slots?.[bob];
				if (!s) continue;
				const variant = L.useVariant ? ((cell >>> SHIFT.variant) & MASK.variant) : 0;
				// Grenades only. 24-27 are sentry guns, which sit on the floor
				// and whose variant is a facing, not a height.
				const dy = (L.ex === 22 || L.ex === 23)
					? -grenadeLift(variant, DOOR_DEPTH(slot)) : 0;
				list.push({
					...s, exgfx: true, block: L.ex, lit: L.lit, variant,
					...(dy ? { dy } : {}),
				});
				continue;
			}
			if (L.player !== undefined) {
				list.push({
					player: L.player,
					lit: L.lit,
					variant: L.variant,
					slot: bob,
					...(L.solid ? { solid: L.solid } : {}),
				});
				continue;
			}
			if (L.skeleton) {
				list.push({ skeleton: true, lit: L.lit, slot: bob });
				continue;
			}

			const gfx = style.graphics[L.g];
			if (!gfx || !gfx.present) continue;
			const s = gfx.slots[bob];
			if (!s) continue;

			// Plane-op graphics copy no colour plane; they rewrite bitplanes over
			// whatever is already there (see build-graphics.js). Puddle copies its
			// mask into plane 4, so the floor beneath shows through in the water
			// bank -- azure and see-through, not a solid blob.
			if (gfx.planeOnly) {
				const op = planeOp(gfx.planeOps, L.lit);
				const field = gfx.name?.startsWith('field') || gfx.symbol === 'field';
				const tags = field ? { planeOp: true, field: true, ...op } : { planeOp: true, ...op };
				list.push({ ...s, ...tags });
				if (s.mirror) list.push({ ...s.mirror, ...tags });
				continue;
			}
			// A split bob (a door) slides its two halves apart by the cell's
			// variant, clipped to the closed door's own vertical extent.
			if (s.split !== undefined && s.mirror) {
				const depth = DOOR_DEPTH(slot);
				const variant = (cell >>> SHIFT.variant) & MASK.variant;
				// blit_block bails out of the gap lookup entirely when d6 is zero, so a
				// closed door (variant 0) joins flush -- table entry 0 is never read.
				const gap = L.useVariant && variant > 0
					? DOOR_GAP[depth][Math.min(variant, DH.length - 1)] : 0;
				// The window narrowing lives INSIDE blit_block's `tst.b d6` guard, so
				// it only happens once the halves have actually started to separate.
				// Applying it at rest clipped away everything sitting outside the
				// frame -- which is exactly where the door's lower guide rail is (its
				// mirror y is `control` pixels down), and the lower door half too at
				// the far depths.
				const clip = gap > 0 ? {
					clipY0: s.y,
					clipY1: s.y + DOOR_CLIP_HEIGHT - DOOR_CLIP_TRIM[depth],
				} : {};
				const half = (r, dy) => list.push({ ...r, y: r.y + dy, ...clip,
					...(L.lit ? { lit: true } : {}) });
				half(s, -gap);
				half(s.mirror, gap);
				continue;
			}
			// `solid` (a flashed or outlined monster) has to ride along with the
			// atlas rect, or draw_bob's .solid path never runs.
			const tint = L.lit || L.solid
				? { ...(L.lit ? { lit: true } : {}), ...(L.solid ? { solid: L.solid } : {}) }
				: null;
			list.push(tint ? { ...s, ...tint } : s);
			// control=2 bobs store only their upper half; the lower half is the
			// same image mirrored directly beneath (see build-graphics.js).
			if (s.mirror) list.push(tint ? { ...s.mirror, ...tint } : s.mirror);

			// Text-panel content rides on the panel graphic: slot 57 only, panel
			// type 0 only, drawn straight after the plate (Drawviews.s:3318).
			if (panels && slot === PANEL_SLOT && L.g === GFX_PANEL_BASE) {
				const variant = (cell >>> SHIFT.variant) & MASK.variant;
				if (variant < panels.count) {
					list.push({ panel: variant, x: PANEL_VIEW_X, y: PANEL_VIEW_Y,
						w: PANEL_W, h: PANEL_H });
				}
			}
		}
	}

	// .draw_foam runs once after the whole frustum (Drawviews.s:2871): if the
	// player's OWN cell holds water, a 144x12 band is laid across the view at the
	// surface line. The water level picks the block structure, and level 3 has
	// none -- fully submerged, so there is no surface to look at.
	if (foam && (cells[base] & WATER_HERE)) {
		const level = (cells[base] >>> SHIFT.water) & MASK.water;
		const sl = foam.sets[0] && foam.sets[0].slots[level];
		if (sl && sl.ax !== undefined) list.push({ ...sl, foamDecal: true });
	}
	return list;
}

// ---------------------------------------------------------------------------
// DEVIATION FROM THE ORIGINAL, off by default: keep tall objects visible from
// two levels up.
//
// The frustum is exactly three floors -- 21 slots one above, 25 at your level,
// 21 one below -- so a tree pops out of existence the moment its cell falls to
// offset -2. That is not a bug in the port; there are no slots and no BOB art
// for a cell that far down, which is why this can only ever be an approximation
// and why it is opt-in.
//
// The approximation uses real art and real geometry. Every dz=-1 slot has a
// dz=0 twin at the same (dx, dy), and the y difference between the same bob in
// those two slots IS one floor step at that distance -- 21px five cells out,
// 59px one cell out. So an object one floor further down is drawn with the
// dz=-1 bob shifted down by that same step. Only its top shows, which is
// exactly the "partly visible" being asked for.

/** Pair each dz=-1 slot with its dz=0 twin, once per table set. */
function tallPairs(tables, facing) {
	if (tables._tallPairs && tables._tallPairsFor === facing) return tables._tallPairs;
	const cols = new Map();
	const meta = facing.map((off) => {
		const dz = Math.round(off / LEVEL_CELLS);
		const rem = off - dz * LEVEL_CELLS;
		const dy = Math.round(rem / MAP_WIDTH);
		return { dz, key: `${rem - dy * MAP_WIDTH},${dy}` };
	});
	meta.forEach((m, slot) => { if (m.dz === 0) cols.set(m.key, slot); });
	const pairs = [];
	meta.forEach((m, slot) => {
		if (m.dz !== -1) return;
		const twin = cols.get(m.key);
		if (twin !== undefined) pairs.push({ slot, twin });
	});
	tables._tallPairs = pairs;
	tables._tallPairsFor = facing;
	return pairs;
}

/**
 * Is this graphic taller than the cell it stands in?
 *
 * Measured against stone at the same bob rather than hardcoded, so a style whose
 * columns or statues overflow gets the same treatment as its trees without
 * anyone listing them here.
 */
function isTallGraphic(style, g, bob) {
	const gfx = style.graphics[g];
	const stone = style.graphics[GFX_BLOCK_BASE];
	const a = gfx?.slots?.[bob];
	const b = stone?.slots?.[bob];
	return !!(a && b && a.h > b.h);
}

/** Can you see past this cell to the one below it? */
function seeThrough(word) {
	return (word & FLOOR_HERE) === 0 && (word & BLOCK_HERE) === 0;
}

/**
 * Emit the tall part of anything sitting two floors down.
 *
 * @param push  receives each rect, in the caller's own draw order
 */
export function emitTallObjects({ cells, base, facing, tables, style, view, hidden, push }) {
	for (const { slot, twin } of tallPairs(tables, facing)) {
		if (hidden[slot]) continue;
		// Something at dz=-1 already fills this column, so nothing below shows.
		if (!seeThrough(view[slot] >>> 0)) continue;

		const idx = base + facing[slot] - LEVEL_CELLS;
		if (idx < 0 || idx >= cells.length) continue;
		const deep = cells[idx] >>> 0;
		if (!(deep & BLOCK_HERE) || (deep & INVISIBLE_BIT)) continue;

		const g = GFX_BLOCK_BASE + ((deep >>> SHIFT.block) & MASK.block);
		const bob = tables.slotMap[slot].bob;
		if (!isTallGraphic(style, g, bob)) continue;

		const here = style.graphics[g].slots[bob];
		const above = style.graphics[g].slots[tables.slotMap[twin].bob];
		if (!here || !above || here.ax === undefined) continue;

		// One more floor step, measured from the art itself.
		const step = here.y - above.y;
		if (!(step > 0)) continue;
		push({ ...here, y: here.y + step, tall: true });
		if (here.mirror && here.mirror.ax !== undefined) {
			push({ ...here.mirror, y: here.mirror.y + step, tall: true });
		}
	}
}
