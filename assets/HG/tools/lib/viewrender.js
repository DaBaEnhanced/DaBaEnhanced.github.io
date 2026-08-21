'use strict';
// Software implementation of the Hired Guns view renderer.
//
// This is a direct port of scan_view + blit_view (Sources/Drawviews.s):
//
//   1. sample 67 map cells through the facing table for the player's direction
//   2. hide any slot whose occlusion cases are fully blocked by opaque cells
//   3. paint the surviving slots far-to-near, each into its fixed screen rect
//
// It doubles as the Canvas2D reference path: the WebGPU renderer must agree
// with this output pixel for pixel.

const VIEW_W = 142;
const VIEW_H = 84;
const NUM_SLOTS = 67;
const OPAQUE_BIT = 1 << 6;
const INVISIBLE_BIT = 1 << 7;

const SHIFT = { floor: 9, block: 11, water: 17, panel: 19, explosion: 21, variant: 23, aux: 28 };
const MASK = { floor: 0x3, block: 0x3f, water: 0x3, panel: 0x3, explosion: 0x3, variant: 0x1f, aux: 0xf };

// Cell fields index the style's 49-entry graphic table at fixed offsets. These
// come straight from the table order in Graphics/StyleN/Ass/StyleN.s lining up
// with the cell-format documentation in Sources/Equates.i.
const GFX_BLOCK_BASE = 5;   // block type 0 (stone) -> graphic 5
const GFX_PANEL_BASE = 29;  // panel type 0 (text)  -> graphic 29
const GFX_AUX_BASE = 32;    // aux type 0 (egg)     -> graphic 32
const GFX_LIGHT = 4;

// skyline_window's two background bands (see the note in renderView).
const SKY_BAND_SPLIT_VIEW_Y = 42;
const SKY_UPPER_INDEX = 38;
// skyline_window's .bob2 (Drawviews.s:2624) clears every plane, so the lower
// band is colour 0. It is not 32 -- that is the lit bank's first entry.
const SKY_LOWER_INDEX = 0;

const DIRECTIONS = ['north', 'east', 'south', 'west'];

/**
 * @param cells   Uint32Array of the map's cell layer
 * @param base    cell index of the player
 * @param facing  table of 67 signed cell offsets for the player's direction
 */
function sampleView(cells, base, facing) {
	const view = new Uint32Array(NUM_SLOTS);
	for (let i = 0; i < NUM_SLOTS; i++) {
		const idx = base + facing[i];
		view[i] = idx >= 0 && idx < cells.length ? cells[idx] : 0;
	}
	return view;
}

/**
 * Mark slots hidden behind opaque cells. A slot is hidden when any one of its
 * occlusion cases has every listed slot opaque (scan_view's .remove_hidden).
 */
function removeHidden(view, occlusion) {
	const hidden = new Uint8Array(NUM_SLOTS);
	for (let slot = 0; slot < NUM_SLOTS; slot++) {
		for (const refs of occlusion[slot]) {
			let all = true;
			for (const r of refs) {
				if (!(view[r] & OPAQUE_BIT)) { all = false; break; }
			}
			if (all) { hidden[slot] = 1; break; }
		}
	}
	return hidden;
}

// Cell field bits.
const FLOOR_HERE = 1, BLOCK_HERE = 2, WATER_HERE = 4;
const PANEL_HERE = 8, EXPLOSION_HERE = 16, AUX_HERE = 32;

const BLOCK_EXGFX_FIRST = 22;   // 22-31 ExGfx, 32-47 player figures -- both miscgfx
const BLOCK_PLAYER_FIRST = 32;
const BLOCK_PLAYER_LAST = 47;
const AUX_SKELETON = 7;
const SLOT_UNDER_FOOT = 66;
const PLAYER_PARTS = ['front', 'left', 'right', 'back'];

/**
 * Port of blit_view's .blocks_above / .blocks_below (Sources/Drawviews.s:2890,
 * 3084), every component of one cell in the order the original blits them.
 *
 *   above (bob 0-20):  rear light, aux, block, panel, water, explosion,
 *                      side light, FLOOR LAST
 *   below (bob 21-66): rear light, FLOOR FIRST, floor light, aux, water(<3),
 *                      block, panel, explosion, aux again, water(=3), side light
 *
 * For the level above you see the underside of its floor, so it paints over
 * everything; at or below your level the floor is what everything stands on.
 * Directional graphics are re-indexed by the viewer's facing (rotate_block /
 * rotate_aux). Player figures and the AUX-7 skeleton BOB are emitted from
 * miscgfx when the caller supplies those atlases.
 *
 * Layers are {g, lit} for style art, {player}, or {light}/{water,lit}/{expl}
 * for the miscgfx masks, which shift palette banks instead of drawing pixels.
 */
function cellLayers(cell, isAbove, direction, slot, tables, ctx) {
	const out = [];
	const c = ctx || {};
	const floorType = (cell >>> SHIFT.floor) & MASK.floor;
	const rawBlock = (cell >>> SHIFT.block) & MASK.block;
	const rawAux = (cell >>> SHIFT.aux) & MASK.aux;
	const waterLevel = (cell >>> SHIFT.water) & MASK.water;
	const blockType = tables.blockRotations[direction & 3][rawBlock];
	const auxType = tables.auxRotations[direction & 3][rawAux];
	const lit = !!c.lit;
	// `useVariant` marks the one layer that feeds blit_block's d6: only the BLOCK
	// path does. The aux path forces d6 = 0, so a door's guide rails are the same
	// split bob yet never slide.
	const gfx = (g, isLit, useVariant) =>
		out.push({ g, lit: !!isLit, useVariant: !!useVariant });

	const floorLayer = () => {
		if (!(cell & FLOOR_HERE)) return;
		// The light bulb is blitted with redraw_temp bit 15 hard-set, so it is lit
		// regardless; a ceiling above uses plain .draw_bob, a floor below uses
		// .draw_bob_illuminate.
		const lightBulb = floorType === 3 && (cell & BLOCK_HERE) && rawBlock === 0;
		if (lightBulb) gfx(GFX_LIGHT, true);
		else gfx(floorType, isAbove ? false : lit);
	};
	const floorLightLayer = () => {
		if (!lit || !c.belowStone) return;
		if ((cell & FLOOR_HERE) && (floorType === 0 || floorType === 2)) return;
		out.push({ light: LIGHT_FLOOR });
	};
	const auxLayer = () => {
		if (!(cell & AUX_HERE)) return;
		if (rawAux === AUX_SKELETON) {
			if (!isAbove && slot === SLOT_UNDER_FOOT) return;
			out.push({ skeleton: true, lit });
			return;
		}
		if (!isAbove && rawAux >= 2 && rawAux <= 6 && slot === SLOT_UNDER_FOOT) return;
		gfx(GFX_AUX_BASE + auxType, lit);
	};
	// Containers and the skeleton underfoot are deferred to this second pass so
	// they land in front of the block and panel (.no_aux_below2), unilluminated.
	// .skel_below2 draws the first carried item's container, not the bones.
	const auxLayer2 = () => {
		if (!(cell & AUX_HERE) || slot !== SLOT_UNDER_FOOT) return;
		if (rawAux < 2 || rawAux > 7) return;
		if (rawAux === AUX_SKELETON) {
			const aux = c.skeletonUnderfootAux | 0;
			if (aux >= 2 && aux <= 6) gfx(GFX_AUX_BASE + aux, false);
			return;
		}
		gfx(GFX_AUX_BASE + auxType, false);
	};
	const blockLayer = () => {
		if (!(cell & BLOCK_HERE)) return;
		if (blockType >= BLOCK_PLAYER_FIRST) {
			if (blockType <= BLOCK_PLAYER_LAST) {
				const variant = (cell >>> SHIFT.variant) & MASK.variant;
				const owner = c.party?.[variant & 3];
				const solid = owner?.spellShield ? 6 : owner?.fireWhite ? 1 : 0;
				out.push({
					player: blockType - BLOCK_PLAYER_FIRST,
					lit,
					variant,
					...(solid ? { solid } : {}),
				});
			}
			return;
		}
		if (blockType >= BLOCK_EXGFX_FIRST) return;
		gfx(GFX_BLOCK_BASE + blockType, lit, true);
	};
	const panelLayer = () => {
		if (!(cell & PANEL_HERE)) return;
		gfx(GFX_PANEL_BASE + ((cell >>> SHIFT.panel) & MASK.panel), false);
	};
	// Above draws every level in one pass; below splits it, partial levels under
	// the block and a full one over it.
	const waterLayer = (wantFull) => {
		if (!(cell & WATER_HERE)) return;
		if (!isAbove && (waterLevel === 3) !== wantFull) return;
		out.push({ water: waterLevel, lit });
	};
	const explosionLayer = () => {
		if (!(cell & EXPLOSION_HERE)) return;
		out.push({ expl: (cell >>> SHIFT.explosion) & MASK.explosion });
	};
	const rearLightLayer = () => { if (lit && c.rearStone) out.push({ light: LIGHT_REAR }); };
	const sideLightLayer = () => {
		if (c.sideLit && isStoneOrPush(cell)) out.push({ light: LIGHT_SIDE });
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
 * Render one player view into an indexed 142x84 buffer.
 * @returns {{pixels: Uint8Array, drawn: number, skipped: number, missing: Map}}
 */
function hasSky(items, cell, direction) {
	return items ? ((items[cell] >>> (24 + (direction & 3))) & 1) !== 0 : false;
}

// Door opening (see src/view.js). blit_block's .mirror path draws a split bob
// twice, upright `gap` higher and flipped `gap` lower, with the cell's variant
// choosing the gap and the separation shrinking with distance. Entry 9 of the
// farthest table really does reuse dh6 in the original; the typo is kept.
const DH = [2, 6, 9, 12, 14, 16, 18, 20, 21, 22, 23];
const scaleDH = (n) => DH.map((v, i) => Math.floor(((i === 9 ? DH[5] : v) * n) / 23));
const DOOR_GAP = [DH, scaleDH(13), scaleDH(10), scaleDH(6)];
const DOOR_DEPTH = (slot) => (slot <= 16 ? 3 : slot <= 33 ? 2 : slot <= 48 ? 1 : 0);
const DOOR_CLIP_TRIM = [0, 22, 30, 38];
const DOOR_CLIP_HEIGHT = 52;

const HORIZON_COLOUR = 54, HORIZON_VIEW_Y = 10, HORIZON_W = 144, HORIZON_H = 32;
// Synthetic indices for the copper's per-line sky gradient (see src/view.js).
const SKY_GRADIENT_ROWS = 44, SKY_GRADIENT_BASE = 64;
// Only one silhouette is visible: .horizon_bob2 clears every plane, so the strip
// for the CURRENT direction is drawn in colour 0 (pure black). The other blit
// writes colour 22, which matches the sky and is therefore invisible.
// CD32: two visible layers. Far strip -> colour 22 (scotch_mist gradient),
// near strip -> colour 0 (flat black), per .horizon_bob / .horizon_bob2.
const HORIZON_FAR_COLOUR = 22, HORIZON_NEAR_COLOUR = 0, HORIZON_FAR_BASE = 176;

// CD32 lighting. activate_planes enables all six planes for an ordinary block,
// but the bob has only 4 colour planes, so an unlit block lands at palette 0-15.
// A light mask sets plane 5 (redraw_temp %1000000000100000), moving a covered
// pixel to 32+i -- the brighter copper bank. So lighting is an INDEX OFFSET
// applied after the block is drawn, never a blit.
const LIGHT_OFFSET = 32;
const LIGHT_BIT = 31;            // keep_light_bit_num, in the items layer
// Light set index -> which neighbour must be a stone(0) or push(1) block.
const LIGHT_SIDE = 0, LIGHT_REAR = 1, LIGHT_FLOOR = 2;

function isStoneOrPush(cell) {
	if (!(cell & 2)) return false;
	const t = (cell >>> 11) & 0x3f;
	return t === 0 || t === 1;
}

const WATER_OFFSET = 16, EXPLOSION_COLOUR = 9, FOAM_COLOUR = 1;
const HW_INDEX_COUNT = 64;   // at or above this are synthetic gradient entries
const FIELD_COLOUR_BASE = 224, FIELD_COLOUR_ROWS = 21;
const DECAL_LIGHT = 0, DECAL_WATER = 1, DECAL_EXPLOSION = 2, DECAL_FOAM = 3;

/**
 * Apply one miscgfx mask rect. These bobs carry no image planes, only per-plane
 * set/clear ops, so a covered pixel is rewritten in place:
 *   light  plane 5 set -> +32   water  plane 4 set -> +16 (+ plane 5 when lit)
 *   explosion  low planes -> colour 9, plane 5 left alone
 * Light and water are gated to block-art indices so they cannot disturb the sky
 * bands, horizon or gradient rows, which never sit under them in the original.
 */
function applyMaskRect(pixels, maskAtlas, s, kind) {
	for (let y = 0; y < s.h; y++) {
		const dy = s.y + y;
		if (dy < 0 || dy >= VIEW_H) continue;
		const srcRow = (s.ay + y) * maskAtlas.width + s.ax;
		const dstRow = dy * VIEW_W;
		for (let x = 0; x < s.w; x++) {
			const dx = s.x + x;
			if (dx < 0 || dx >= VIEW_W) continue;
			if (!maskAtlas.data[srcRow + x]) continue;
			const v = pixels[dstRow + dx];
			if (kind === DECAL_EXPLOSION) {
				pixels[dstRow + dx] = (v & LIGHT_OFFSET) | EXPLOSION_COLOUR;
				continue;
			}
			if (kind === DECAL_FOAM) {
				// Planes 4 and 5 are nodraw, so both banks survive underneath.
				pixels[dstRow + dx] = (v & (LIGHT_OFFSET | WATER_OFFSET)) | FOAM_COLOUR;
				continue;
			}
			// Colour 0 is a real colour -- the dominant unlit index and the
			// whole lower sky band -- so it must be included. Only a synthetic
			// gradient row has no bitplanes for a decal to set.
			if (v >= HW_INDEX_COUNT) continue;
			if (kind === DECAL_LIGHT) {
				pixels[dstRow + dx] = v | LIGHT_OFFSET;
			} else {
				pixels[dstRow + dx] = s.lit
					? ((v & 15) | LIGHT_OFFSET | WATER_OFFSET)
					: (v | WATER_OFFSET);
			}
		}
	}
}

/**
 * Reduce a bob's six bob_plane ops to a keep/set pair. These bobs carry a single
 * plane of data that is also their mask, so "copy" writes a 1 wherever the bob
 * covers -- the same as "set". Plane 5 is not the bob's own: block_draw rewrites
 * it per blit, clear normally and set when the cell is lit.
 *   0 nodraw -> keep   1 copy -> 1   2 clear -> 0   3 set -> 1
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

/** Apply a plane-op graphic (Puddle, Field): covered pixel -> (v & keep) | set. */
function applyPlaneOpRect(pixels, atlas, s, keep, set, field = false) {
	for (let y = 0; y < s.h; y++) {
		const dy = s.y + y;
		if (dy < 0 || dy >= VIEW_H) continue;
		const fieldBand = field
			? Math.max(0, Math.min(FIELD_COLOUR_ROWS - 1, Math.floor(dy / 4)))
			: 0;
		const srcRow = (s.ay + y) * atlas.width + s.ax;
		const dstRow = dy * VIEW_W;
		for (let x = 0; x < s.w; x++) {
			const dx = s.x + x;
			if (dx < 0 || dx >= VIEW_W) continue;
			if (!atlas.data[srcRow + x]) continue;
			if (field) {
				pixels[dstRow + dx] = FIELD_COLOUR_BASE + fieldBand;
				continue;
			}
			const v = pixels[dstRow + dx];
			if (v >= HW_INDEX_COUNT) continue;
			pixels[dstRow + dx] = (v & keep) | set;
		}
	}
}

/** Offset one decal rect into the lit bank. */
const applyLightRect = (pixels, lightAtlas, s) =>
	applyMaskRect(pixels, lightAtlas, s, DECAL_LIGHT);
// Planet: 96x42 one-bitplane mask at view (20,0), south only. Sets plane 4, so
// sky 38 -> 54; rendered here through per-row indices fed by nosky_planet.
const PLANET_W = 96, PLANET_H = 42, PLANET_X = 20, PLANET_Y = 0;
const PLANET_FACING = 2, PLANET_GRADIENT_BASE = 128, PLANET_COLOUR = 54;

function drawPlanet(pixels, mask, direction, gradient) {
	if (!mask || (direction & 3) !== PLANET_FACING) return;
	const rowBytes = PLANET_W / 8;
	for (let y = 0; y < PLANET_H; y++) {
		const vy = PLANET_Y + y;
		if (vy < 0 || vy >= VIEW_H) continue;
		for (let x = 0; x < PLANET_W; x++) {
			const dx = PLANET_X + x;
			if (dx < 0 || dx >= VIEW_W) continue;
			if ((mask[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1) {
				pixels[vy * VIEW_W + dx] = gradient ? PLANET_GRADIENT_BASE + y : PLANET_COLOUR;
			}
		}
	}
}

/** Union of the two horizon strips draw_horizon blits for this facing. */
function drawHorizon(pixels, strips, direction, gradient) {
	const rowBytes = HORIZON_W / 8;
	const set = (s, x, y) => (strips[s * 576 + y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
	const layers = [
		[((direction & 3) + 2) & 3, HORIZON_FAR_COLOUR, HORIZON_FAR_BASE],
		[direction & 3, HORIZON_NEAR_COLOUR, -1],
	];
	for (const [strip, colour, base] of layers) {
		for (let y = 0; y < HORIZON_H; y++) {
			const vy = HORIZON_VIEW_Y + y;
			if (vy < 0 || vy >= VIEW_H) continue;
			for (let x = 0; x < HORIZON_W && x < VIEW_W; x++) {
				if (set(strip, x, y)) {
					pixels[vy * VIEW_W + x] = (gradient && base >= 0) ? base + y : colour;
				}
			}
		}
	}
}

function renderView({ cells, base, direction, tables, style, atlas, items, horizon, gradient,
	planet, lights, lightAtlas, water, waterAtlas, explosions, explosionAtlas,
	foam, foamAtlas, panels, players, playerAtlas, skeleton, skeletonAtlas,
	skeletonUnderfootAux = 0, party = null }) {
	const facing = tables.facings[DIRECTIONS[direction]];
	const view = sampleView(cells, base, facing);
	const hidden = removeHidden(view, tables.occlusion);

	const pixels = new Uint8Array(VIEW_W * VIEW_H);
	const missing = new Map();
	let drawn = 0, skipped = 0;

	// skyline_window fills the pane background with two solid bands before the
	// view is drawn, split at pane y 56 -- view y 42, since the 3D window starts
	// at pane y 14. Without it, rows 42..49 are left unpainted in enclosed views.
	if (hasSky(items, base, direction)) {
		const split = SKY_BAND_SPLIT_VIEW_Y;
		pixels.fill(SKY_UPPER_INDEX, 0, split * VIEW_W);
		pixels.fill(SKY_LOWER_INDEX, split * VIEW_W);
		if (gradient) {
			// Upper band only -- must not leak below the split at row 42.
			for (let r = 0; r < SKY_GRADIENT_ROWS && r < SKY_BAND_SPLIT_VIEW_Y; r++) {
				pixels.fill(SKY_GRADIENT_BASE + r, r * VIEW_W, (r + 1) * VIEW_W);
			}
		}
		// Planet under the horizon silhouette.
		drawPlanet(pixels, planet, direction, gradient);
		if (horizon) drawHorizon(pixels, horizon, direction, gradient);
	}

	for (let slot = 0; slot < NUM_SLOTS; slot++) {
		if (hidden[slot]) { skipped++; continue; }
		const cell = view[slot];
		if (cell & INVISIBLE_BIT) { skipped++; continue; }

		const map = tables.slotMap[slot];
		const bobIndex = map.bob;
		const nb = (off) => (off >= 0 && off < NUM_SLOTS ? view[off] : 0);
		// keep_light lives on OPEN cells, so a wall face is lit not by its own bit
		// but by the rear/side/floor mask the open cell in front of it emits --
		// hence the neighbour-is-stone gating. block_side comes from viewb (the
		// ITEMS layer), not view.
		const lightBit = (s) => {
			if (!items || s < 0 || s >= NUM_SLOTS) return false;
			const i = base + facing[s];
			return i >= 0 && i < items.length && ((items[i] >>> LIGHT_BIT) & 1) !== 0;
		};
		const ctx = {
			lit: lightBit(slot),
			rearStone: isStoneOrPush(nb(map.rear)),
			belowStone: isStoneOrPush(nb(map.below)),
			sideLit: lightBit(map.side),
			skeletonUnderfootAux,
			party,
		};

		for (const L of cellLayers(cell, bobIndex <= 20, direction, slot, tables, ctx)) {
			// Decals: index offsets over what this slot has already painted. They
			// belong inside the slot's own sequence so a nearer wall drawn
			// afterwards covers them.
			if (L.light !== undefined) {
				if (!lights || !lightAtlas) continue;
				const set = lights.sets[L.light];
				const sl = set && set.slots[bobIndex];
				if (!sl || sl.ax === undefined) continue;
				applyLightRect(pixels, lightAtlas, sl);
				if (sl.mirror && sl.mirror.ax !== undefined) applyLightRect(pixels, lightAtlas, sl.mirror);
				continue;
			}
			if (L.water !== undefined) {
				if (!water || !waterAtlas) continue;
				const set = water.sets[L.water];
				const sl = set && set.slots[bobIndex];
				if (!sl || sl.ax === undefined) continue;
				applyMaskRect(pixels, waterAtlas, { ...sl, lit: L.lit }, DECAL_WATER);
				if (sl.mirror && sl.mirror.ax !== undefined) {
					applyMaskRect(pixels, waterAtlas, { ...sl.mirror, lit: L.lit }, DECAL_WATER);
				}
				continue;
			}
			if (L.expl !== undefined) {
				if (!explosions || !explosionAtlas) continue;
				const set = explosions.sets[L.expl];
				const sl = set && set.slots[bobIndex];
				if (!sl || sl.ax === undefined) continue;
				if (explosions.kind === 'indexedSprite') blit(pixels, explosionAtlas, sl, 0);
				else applyMaskRect(pixels, explosionAtlas, sl, DECAL_EXPLOSION);
				if (sl.mirror && sl.mirror.ax !== undefined) {
					if (explosions.kind === 'indexedSprite') blit(pixels, explosionAtlas, sl.mirror, 0);
					else applyMaskRect(pixels, explosionAtlas, sl.mirror, DECAL_EXPLOSION);
				}
				continue;
			}
			if (L.player !== undefined) {
				const block = L.player | 0;
				const playerIndex = block >> 2;
				const part = PLAYER_PARTS[block & 3];
				const character = players?.selected?.[playerIndex] ?? playerIndex;
				const record = players?.characters?.find((c) => c.character === character) ||
					players?.characters?.[playerIndex];
				const s = record?.figures?.[part]?.slots?.[bobIndex];
				if (s && playerAtlas) {
					const bank = L.lit ? LIGHT_OFFSET : 0;
					if (L.solid) blitSolid(pixels, playerAtlas, s, (L.solid + bank) & 255);
					else blit(pixels, playerAtlas, s, bank);
					drawn++;
				}
				continue;
			}
			if (L.skeleton) {
				const s = skeleton?.slots?.[bobIndex];
				if (s && skeletonAtlas) {
					blit(pixels, skeletonAtlas, s, L.lit ? LIGHT_OFFSET : 0);
					drawn++;
				}
				continue;
			}

			const gfx = style.graphics[L.g];
			if (!gfx || !gfx.present) {
				missing.set(L.g, (missing.get(L.g) || 0) + 1);
				continue;
			}
			const s = gfx.slots[bobIndex];
			if (!s) continue; // this graphic has nothing for this slot

			// Plane-op graphics copy no colour plane; they rewrite bitplanes over
			// what is already there. Puddle copies its mask into plane 4, so the
			// floor beneath shows through in the water bank.
			if (gfx.planeOnly) {
				const { keep, set } = planeOp(gfx.planeOps, L.lit);
				const field = gfx.name?.startsWith('field') || gfx.symbol === 'field';
				applyPlaneOpRect(pixels, atlas, s, keep, set, field);
				if (s.mirror) applyPlaneOpRect(pixels, atlas, s.mirror, keep, set, field);
				continue;
			}
			const layerBank = L.lit ? LIGHT_OFFSET : 0;

			// A split bob (a door) slides its two halves apart by the cell's
			// variant, clipped to the closed door's own vertical extent.
			if (s.split !== undefined && s.mirror) {
				const depth = DOOR_DEPTH(slot);
				const variant = (cell >>> SHIFT.variant) & MASK.variant;
				// blit_block skips the gap lookup when d6 is zero, so a closed door
				// (variant 0) joins flush -- table entry 0 is never read.
				const gap = L.useVariant && variant > 0
					? DOOR_GAP[depth][Math.min(variant, DH.length - 1)] : 0;
				// The window narrowing is inside blit_block's `tst.b d6` guard, so it
				// only applies once the halves separate. Clipping at rest threw away
				// the lower guide rail, which sits `control` pixels below the frame.
				const clip = gap > 0
					? { clipY0: s.y, clipY1: s.y + DOOR_CLIP_HEIGHT - DOOR_CLIP_TRIM[depth] }
					: {};
				blit(pixels, atlas, { ...s, y: s.y - gap, ...clip }, layerBank);
				blit(pixels, atlas, { ...s.mirror, y: s.mirror.y + gap, ...clip }, layerBank);
				drawn += 2;
				continue;
			}
			blit(pixels, atlas, s, layerBank);
			drawn++;
			// control=2 bobs store only their upper half; the lower half is the
			// same image mirrored directly beneath (see build-graphics.js).
			if (s.mirror) { blit(pixels, atlas, s.mirror, layerBank); drawn++; }

			// Text-panel content rides on the panel plate: slot 57 only, panel
			// type 0 only (Drawviews.s:3318).
			if (panels && slot === 57 && L.g === GFX_PANEL_BASE) {
				const variant = (cell >>> SHIFT.variant) & MASK.variant;
				if (variant < 36) {
					const PW = 48, PH = 40, PX = 46, PY = 22;
					const pbase = variant * PW * PH;
					for (let y = 0; y < PH; y++) {
						for (let x = 0; x < PW; x++) {
							const v = panels[pbase + y * PW + x];
							if (v) pixels[(PY + y) * VIEW_W + (PX + x)] |= v;
						}
					}
				}
			}
		}
	}

	// .draw_foam runs once after the whole frustum: if the player's OWN cell
	// holds water, a 144x12 band is laid across the view at the surface line.
	// The water level picks the block structure, and level 3 has none -- fully
	// submerged, so there is no surface to see.
	if (foam && foamAtlas && (cells[base] & WATER_HERE)) {
		const level = (cells[base] >>> SHIFT.water) & MASK.water;
		const sl = foam.sets[0] && foam.sets[0].slots[level];
		if (sl && sl.ax !== undefined) applyMaskRect(pixels, foamAtlas, sl, DECAL_FOAM);
	}
	return { pixels, drawn, skipped, missing, view, hidden };
}

/** Copy one atlas rect into the view, treating index 0 as transparent. */
function blit(dst, atlas, s, bank) {
	// A split door half carries its own vertical clip (see src/view.js).
	const lo = Math.max(0, s.clipY0 !== undefined ? s.clipY0 : 0);
	const hi = Math.min(VIEW_H, s.clipY1 !== undefined ? s.clipY1 : VIEW_H);
	for (let y = 0; y < s.h; y++) {
		const dy = s.y + y;
		if (dy < lo || dy >= hi) continue;
		const srcRow = (s.ay + y) * atlas.width + s.ax;
		const dstRow = dy * VIEW_W;
		for (let x = 0; x < s.w; x++) {
			const dx = s.x + x;
			if (dx < 0 || dx >= VIEW_W) continue;
			const v = atlas.data[srcRow + x];
			if (v) dst[dstRow + dx] = (v - 1) + (bank || 0);  // atlas stores index+1
		}
	}
}

function blitSolid(dst, atlas, s, colour) {
	const lo = Math.max(0, s.clipY0 !== undefined ? s.clipY0 : 0);
	const hi = Math.min(VIEW_H, s.clipY1 !== undefined ? s.clipY1 : VIEW_H);
	for (let y = 0; y < s.h; y++) {
		const dy = s.y + y;
		if (dy < lo || dy >= hi) continue;
		const srcRow = (s.ay + y) * atlas.width + s.ax;
		const dstRow = dy * VIEW_W;
		for (let x = 0; x < s.w; x++) {
			const dx = s.x + x;
			if (dx < 0 || dx >= VIEW_W) continue;
			if (atlas.data[srcRow + x]) dst[dstRow + dx] = colour;
		}
	}
}

module.exports = {
	renderView, sampleView, removeHidden, cellLayers, blit,
	VIEW_W, VIEW_H, NUM_SLOTS, DIRECTIONS,
	GFX_BLOCK_BASE, GFX_PANEL_BASE, GFX_AUX_BASE, GFX_LIGHT,
	SKY_BAND_SPLIT_VIEW_Y, SKY_UPPER_INDEX, SKY_LOWER_INDEX, hasSky,
};
