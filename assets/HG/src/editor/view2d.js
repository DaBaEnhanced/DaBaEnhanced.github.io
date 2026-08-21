// The editor's top-down map view.
//
// One floor at a time, 23x23 cells of 16x16 icons -- 368x368 at 1:1. The icons
// are MapEditor/Blocks.dat and the index is redraw_level's (see tileindex.js),
// so what this draws is what the original editor drew.

import { MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT } from './blocks2d.js';
import { floorTiles } from './tileindex.js';
import { getField, hasField, fieldName } from './edit.js';

export const TILE = 16;
export const VIEW_W = MAP_WIDTH * TILE;    // 368
export const VIEW_H = MAP_DEPTH * TILE;

/** Load the tile atlas and its palette. */
export async function loadTiles(assetsBase = 'assets/') {
	const meta = await (await fetch(`${assetsBase}editor-tiles.json`)).json();
	const bytes = new Uint8Array(await (await fetch(`${assetsBase}${meta.atlas.file}`)).arrayBuffer());
	// Pre-resolve every icon to RGBA once; they never change, so per-frame
	// palette lookups would be wasted work.
	const pal = meta.palette || [];
	const images = [];
	for (let i = 0; i < meta.count; i++) {
		const r = meta.tiles[i];
		const img = new ImageData(TILE, TILE);
		for (let y = 0; y < TILE; y++) {
			for (let x = 0; x < TILE; x++) {
				const v = bytes[(r.ay + y) * meta.atlas.width + r.ax + x];
				const o = (y * TILE + x) * 4;
				if (!v) { img.data[o + 3] = 0; continue; }
				const c = pal[v - 1] || [255, 0, 255];
				img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2];
				img.data[o + 3] = 255;
			}
		}
		images.push(img);
	}
	return { meta, images };
}

/**
 * Draw one floor.
 *
 * @param ctx    a 2D context sized at least VIEW_W x VIEW_H
 * @param cells  the map_part1 layer
 * @param floor  0-19
 * @param tiles  from loadTiles
 * @param opts   { cursor:{x,y}, selection:{a,b}, ghost, grid, markers, layer2,
 *                 starts, exit, scale }
 */
export function drawFloor(ctx, cells, floor, tiles, opts = {}) {
	const scale = opts.scale || 1;
	const layer2 = opts.layer2 || null;
	ctx.save();
	ctx.imageSmoothingEnabled = false;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	ctx.clearRect(0, 0, VIEW_W, VIEW_H);

	// A hint of the floor below, so vertical alignment is readable while
	// editing. Drawn first and dimmed by an overlay rather than by re-tinting
	// every icon.
	if (opts.ghost && floor > 0) {
		paintFloor(ctx, cells, layer2, floor - 1, tiles);
		ctx.fillStyle = 'rgba(16,16,22,0.72)';
		ctx.fillRect(0, 0, VIEW_W, VIEW_H);
	}

	paintFloor(ctx, cells, layer2, floor, tiles);

	if (opts.grid) {
		ctx.strokeStyle = 'rgba(255,255,255,0.06)';
		ctx.lineWidth = 1 / scale;
		ctx.beginPath();
		for (let i = 0; i <= MAP_WIDTH; i++) {
			ctx.moveTo(i * TILE + 0.5, 0); ctx.lineTo(i * TILE + 0.5, VIEW_H);
		}
		for (let i = 0; i <= MAP_DEPTH; i++) {
			ctx.moveTo(0, i * TILE + 0.5); ctx.lineTo(VIEW_W, i * TILE + 0.5);
		}
		ctx.stroke();
	}

	if (opts.markers !== false) drawMarkers(ctx, cells, floor);
	drawTriggers(ctx, floor, opts.triggers);
	drawSpawns(ctx, floor, opts.starts, opts.exit);

	// The bulk-edit selection, under the cursor so the cursor stays readable
	// while dragging a rectangle out.
	const s = opts.selection;
	if (s) {
		const x0 = Math.min(s.a.x, s.b.x), y0 = Math.min(s.a.y, s.b.y);
		const w = Math.abs(s.a.x - s.b.x) + 1, h = Math.abs(s.a.y - s.b.y) + 1;
		ctx.fillStyle = 'rgba(120,190,255,0.16)';
		ctx.fillRect(x0 * TILE, y0 * TILE, w * TILE, h * TILE);
		ctx.strokeStyle = '#78beff';
		ctx.lineWidth = 1 / scale;
		ctx.strokeRect(x0 * TILE + 0.5, y0 * TILE + 0.5, w * TILE - 1, h * TILE - 1);
	}

	const c = opts.cursor;
	if (c && c.x >= 0 && c.y >= 0) {
		ctx.strokeStyle = '#ffe7a0';
		ctx.lineWidth = 2 / scale;
		ctx.strokeRect(c.x * TILE + 1, c.y * TILE + 1, TILE - 2, TILE - 2);
	}
	ctx.restore();
}

function paintFloor(ctx, cells, layer2, floor, tiles) {
	const icons = floorTiles(cells, layer2, floor, MAP_WIDTH, MAP_DEPTH);
	// putImageData ignores the transform, so icons go through a scratch canvas.
	const scratch = paintFloor.scratch || (paintFloor.scratch = makeScratch());
	const sctx = scratch.getContext('2d');
	sctx.clearRect(0, 0, VIEW_W, VIEW_H);
	for (let y = 0; y < MAP_DEPTH; y++) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			const img = tiles.images[icons[y * MAP_WIDTH + x]];
			if (img) sctx.putImageData(img, x * TILE, y * TILE);
		}
	}
	ctx.drawImage(scratch, 0, 0);
}

function makeScratch() {
	return typeof OffscreenCanvas !== 'undefined'
		? new OffscreenCanvas(VIEW_W, VIEW_H)
		: Object.assign(document.createElement('canvas'), { width: VIEW_W, height: VIEW_H });
}

/** Which cell is under a click, or null. */
export function cellAt(px, py, scale = 1) {
	const x = Math.floor(px / (TILE * scale));
	const y = Math.floor(py / (TILE * scale));
	if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_DEPTH) return null;
	return { x, y };
}

export { MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT };

// ---------------------------------------------------------------------------
// Editor markers.
//
// Every floor and block combination has its own icon, so nothing there needs
// marking. Panel, water and aux do not: each contributes a flat offset to the
// index (+165, +330, +660), so the icon says one is PRESENT and never which. A
// text panel and a wall button draw identically; so do a crate, a monster and a
// corpse. Those are the cases worth a letter, and only those -- marking what
// the icon already draws would just bury the map in glyphs.

// Panel 0 is the ordinary wall panel, and it is on nearly every wall in the
// game: 256,766 of the campaign's 259,303 panel cells carry it with variant 0,
// the default slot. Marking those buried the map under an S per wall and said
// nothing the tile did not already say. Only the 2,537 that name a specific
// slot are worth finding, so the marker is gated on that.
const namedPanel = (word) => getField(word, 'variant') !== 0;

const MARKERS = {
	panel: {
		0: ['S', '#ffd050', namedPanel],   // Text
		1: ['B', '#ff9060'],               // Button in
		2: ['B', '#ff9060'],               // Button out
	},
	aux: {
		0: ['M', '#ff6060'],   // Monster
		1: ['e', '#ffb0b0'],   // Egg Open
		2: ['i', '#ffe7a0'], 3: ['i', '#ffe7a0'], 4: ['i', '#ffe7a0'],
		5: ['i', '#ffe7a0'], 6: ['i', '#ffe7a0'],
		8: ['s', '#a0c0e0'], 9: ['s', '#a0c0e0'],
		10: ['s', '#a0c0e0'], 11: ['s', '#a0c0e0'],
		12: ['f', '#a0b0c0'], 13: ['f', '#a0b0c0'],
		14: ['x', '#e0796e'], 15: ['x', '#e0796e'],
	},
};

// Checked in this order; the first hit wins, so one cell draws one marker.
const MARKER_ORDER = ['panel', 'aux'];

/** The marker for one cell word, or null. */
export function markerFor(word) {
	for (const field of MARKER_ORDER) {
		if (!hasField(word, field)) continue;
		const value = getField(word, field);
		const m = MARKERS[field][value];
		if (!m) continue;
		if (m[2] && !m[2](word)) continue;
		return { glyph: m[0], colour: m[1], label: fieldName(field, value) };
	}
	return null;
}

/** Draw the markers for one floor. */
export function drawMarkers(ctx, cells, floor) {
	ctx.save();
	ctx.font = 'bold 9px ui-monospace, monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const base = floor * MAP_WIDTH * MAP_DEPTH;
	for (let y = 0; y < MAP_DEPTH; y++) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			const m = markerFor(cells[base + y * MAP_WIDTH + x] >>> 0);
			if (!m) continue;
			const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
			ctx.fillStyle = 'rgba(0,0,0,0.62)';
			ctx.fillRect(cx - 5, cy - 5, 10, 10);
			ctx.fillStyle = m.colour;
			ctx.fillText(m.glyph, cx, cy + 0.5);
		}
	}
	ctx.restore();
}

/** Every distinct marker with its meaning, for the legend. */
export const MARKER_LEGEND = MARKER_ORDER.flatMap((field) =>
	Object.entries(MARKERS[field])
		.map(([v, m]) => ({
			glyph: m[0], colour: m[1], field,
			// The gated ones say so, or the legend promises a marker the map does
			// not draw.
			label: fieldName(field, +v) + (m[2] ? ' (named slot only)' : ''),
		}))
).filter((e, i, all) => all.findIndex((o) => o.label === e.label) === i);

// ---------------------------------------------------------------------------
// Player starts and the exit.
//
// These live in the map header (pl1x..pl4z and exitx/y/z), not in a cell, so
// nothing in the grid can show them. They are drawn as rings rather than filled
// chips so whatever is underneath stays readable.

const START_COLOURS = ['#7fd0ff', '#7fe89f', '#ffd050', '#ff9be0'];
const EXIT_COLOUR = '#ff6060';

export function drawSpawns(ctx, floor, starts, exit) {
	if (!starts && !exit) return;
	ctx.save();
	ctx.font = 'bold 10px ui-monospace, monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.lineWidth = 2;
	const ring = (p, label, colour) => {
		if (!p || p.floor !== floor) return;
		const cx = p.x * TILE + TILE / 2, cy = p.y * TILE + TILE / 2;
		ctx.beginPath();
		ctx.arc(cx, cy, TILE / 2 - 1.5, 0, Math.PI * 2);
		ctx.strokeStyle = '#000';
		ctx.lineWidth = 3.5;
		ctx.stroke();
		ctx.strokeStyle = colour;
		ctx.lineWidth = 1.75;
		ctx.stroke();
		ctx.fillStyle = '#000';
		ctx.fillText(label, cx + 0.75, cy + 1.25);
		ctx.fillStyle = colour;
		ctx.fillText(label, cx, cy + 0.5);
	};
	(starts || []).forEach((p, i) => ring(p, String(i + 1), START_COLOURS[i] || '#fff'));
	ring(exit, 'E', EXIT_COLOUR);
	ctx.restore();
}

export const SPAWN_LEGEND = [
	...START_COLOURS.map((c, i) => ({ glyph: String(i + 1), colour: c, label: `Player ${i + 1} start` })),
	{ glyph: 'E', colour: EXIT_COLOUR, label: 'Exit' },
];

// ---------------------------------------------------------------------------
// Text triggers.
//
// Like the player starts, these live in the map header rather than in a cell,
// so nothing in the grid can show them -- and a trigger you cannot see is a
// trigger you cannot find again.

const TRIGGER_COLOUR = '#9fe0ff';

export function drawTriggers(ctx, floor, cells) {
	if (!cells || !cells.length) return;
	const per = MAP_WIDTH * MAP_DEPTH;
	ctx.save();
	ctx.font = 'bold 9px ui-monospace, monospace';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const cell of cells) {
		if (Math.floor(cell / per) !== floor) continue;
		const rem = cell % per;
		const cx = (rem % MAP_WIDTH) * TILE + TILE / 2;
		const cy = Math.floor(rem / MAP_WIDTH) * TILE + TILE / 2;
		// A speech tag in the corner, so it does not bury the cell's own marker.
		ctx.fillStyle = 'rgba(0,0,0,0.66)';
		ctx.fillRect(cx + 1, cy - 7, 7, 7);
		ctx.fillStyle = TRIGGER_COLOUR;
		ctx.fillText('"', cx + 4.5, cy - 2.5);
	}
	ctx.restore();
}
