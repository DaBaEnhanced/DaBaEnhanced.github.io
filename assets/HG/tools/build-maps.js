'use strict';
// Emit web-loadable maps: a small JSON of header/entity data plus a raw binary
// of the three cell layers (little-endian u32, ready for a typed-array view).

const fs = require('fs');
const path = require('path');
const M = require('./lib/hgmap');
const { decodeILBM } = require('./lib/iff');

// Each map directory ships Horizons.ilbm: the authored horizon art, four 144x32
// strips stacked at y = 0, 32, 64, 96 (north, east, south, west), each labelled
// in the image. It is 2 planes; value 1 is the silhouette, value 2 is only the
// editor's labels and frames.
//
// The map header also carries an embedded copy at horizonsOffset, but that
// differs from the ILBM by ~37% and the user verified the ILBM against footage
// of the real machine, so the ILBM wins.
const HORIZON_W = 144, HORIZON_H = 32, HORIZON_STRIPS = 4;
const HORIZON_ROW_BYTES = HORIZON_W / 8;

function horizonFromILBM(file) {
	const img = decodeILBM(fs.readFileSync(file));
	const out = Buffer.alloc(HORIZON_STRIPS * HORIZON_H * HORIZON_ROW_BYTES);
	for (let s = 0; s < HORIZON_STRIPS; s++) {
		for (let y = 0; y < HORIZON_H; y++) {
			for (let x = 0; x < HORIZON_W; x++) {
				const sy = s * HORIZON_H + y;
				if (sy >= img.height || x >= img.width) continue;
				if (img.pixels[sy * img.width + x] !== 1) continue;
				const o = (s * HORIZON_H + y) * HORIZON_ROW_BYTES + (x >> 3);
				out[o] |= 0x80 >> (x & 7);
			}
		}
	}
	return out;
}

// Text panels. The map header holds 36 panels of 480 bytes at
// header.textPanelsOffset: 48x40 at TWO bitplanes (text_size = ((48/8)*40)*2),
// stored as 40 rows of plane 0 followed by 40 rows of plane 1.
//
// Drawviews.s:3318 draws the content ONLY at view slot 57 (directly ahead, one
// step away) and only for panel type 0, OR-ing it into screen planes 0-1 at
// view (46, 22). That is why a panel shows its frame from the side but nothing
// face-on until this content is drawn.
const PANEL_W = 48, PANEL_H = 40;
const PANEL_ROW_BYTES = PANEL_W / 8;          // 6
const PANEL_BYTES = PANEL_ROW_BYTES * PANEL_H * 2;  // 480
const PANEL_COUNT = 36;

/** Decode the 36 panels into one byte per pixel holding the 2-bit value. */
function panelsFrom(raw, offset) {
	const out = Buffer.alloc(PANEL_COUNT * PANEL_W * PANEL_H);
	for (let p = 0; p < PANEL_COUNT; p++) {
		const src = offset + p * PANEL_BYTES;
		const dst = p * PANEL_W * PANEL_H;
		for (let plane = 0; plane < 2; plane++) {
			for (let y = 0; y < PANEL_H; y++) {
				const row = src + (plane * PANEL_H + y) * PANEL_ROW_BYTES;
				for (let x = 0; x < PANEL_W; x++) {
					const bit = (raw[row + (x >> 3)] >> (7 - (x & 7))) & 1;
					if (bit) out[dst + y * PANEL_W + x] |= (1 << plane);
				}
			}
		}
	}
	return out;
}

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets', 'maps');

function collect() {
	const out = [];
	const walk = (d) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.toLowerCase().endsWith('.map')) out.push(p);
		}
	};
	walk(path.join(REPO, 'Maps', 'Game'));
	return out.sort();
}

fs.mkdirSync(OUT, { recursive: true });
const index = { maps: [] };
let ok = 0, failed = 0;

for (const file of collect()) {
	const dirName = path.basename(path.dirname(file));           // Map01_ArtificialIsland
	const key = dirName.replace(/^Map/, '').replace(/_/g, '-');   // 01-ArtificialIsland
	try {
		const m = M.parseMap(fs.readFileSync(file));

		// Three layers back to back, little-endian for direct typed-array use.
		const cells = Buffer.alloc(M.PART_CELLS * 4 * 3);
		for (let i = 0; i < M.PART_CELLS; i++) {
			cells.writeUInt32LE(m.cells[i], i * 4);
			cells.writeUInt32LE(m.seen[i], (M.PART_CELLS + i) * 4);
			cells.writeUInt32LE(m.items[i], (M.PART_CELLS * 2 + i) * 4);
		}
		fs.writeFileSync(path.join(OUT, `${key}.cells`), cells);

		// The four horizon strips (one per facing) live in the map header:
		// 144x32, one bitplane, 576 bytes each. draw_horizon blits strip
		// (dir+2)&3 then strip dir at pane+(2,24) = view (0,10).
		// Naming is not uniform across map directories: most use Horizons.ilbm but
		// some are prefixed with the map number (e.g. 35horizons.ilbm). Match any
		// .ilbm whose name contains "horizon", case-insensitively.
		const dirFiles = fs.readdirSync(path.dirname(file));
		const hit = dirFiles.find((f) => /horizons?\.ilbm$/i.test(f));
		const ilbm = hit ? path.join(path.dirname(file), hit) : null;
		let horizon, horizonSource;
		if (ilbm && fs.existsSync(ilbm)) {
			horizon = horizonFromILBM(ilbm);
			horizonSource = hit;
		} else {
			const raw = fs.readFileSync(file);
			horizon = raw.subarray(m.header.horizonsOffset, m.header.horizonsOffset + 4 * 576);
			horizonSource = 'map header';
		}
		fs.writeFileSync(path.join(OUT, `${key}.horizon`), horizon);

		const mapRaw = fs.readFileSync(file);
		const panels = panelsFrom(mapRaw, m.header.textPanelsOffset);
		fs.writeFileSync(path.join(OUT, `${key}.panels`), panels);

		const h = m.header;
		fs.writeFileSync(path.join(OUT, `${key}.json`), JSON.stringify({
			key,
			source: path.relative(REPO, file).replace(/\\/g, '/'),
			panels: { file: `maps/${key}.panels`, count: 36, width: 48, height: 40,
				viewX: 46, viewY: 22, slot: 57, orIntoPlanes: [0, 1] },
			horizon: { file: `maps/${key}.horizon`, source: horizonSource, width: 144, height: 32,
				strips: 4, bytesPerStrip: 576, viewX: 0, viewY: 10 },
			cells: { file: `maps/${key}.cells`, width: M.MAP_WIDTH, depth: M.MAP_DEPTH,
				height: M.MAP_HEIGHT, layers: ['cells', 'seen', 'items'], cellsPerLayer: M.PART_CELLS },
			locn: m.locn,
			starts: h.starts,
			exit: h.exit,
			timeLimit: h.timeLimit,
			water: { level: h.waterLevel, low: h.lowWaterLevel, high: h.hiWaterLevel, speed: h.waterSpeed },
			explosions: h.explosions.filter((e) => e.posn || e.speed),
			textTriggers: h.textTriggers,
			// Keyed by the byte offset the triggers reference, not a list.
			textMessages: h.textMessages,
			monsters: h.monsters,
			buttons: h.buttons,
			lifts: h.lifts,
			doors: h.doors,
			pushables: h.pushables,
			// A button's data field is a byte offset from the map base, and which
			// table it indexes depends on the action, so ship the origins too.
			tableOffsets: {
				lifts: h.liftsOffset, doors: h.doorsOffset,
				buttons: h.buttonsOffset, mapData: h.mapDataOffset,
			},
		}));

		index.maps.push({
			key, name: m.locn.legend2.split('~')[0].trim() || key,
			style: m.locn.style, sky: m.locn.sky, players: m.locn.players,
			music: m.locn.musicNum, atmos: m.locn.atmos,
			starts: h.starts,
		});
		ok++;
	} catch (e) {
		console.log(`  FAIL ${key}: ${e.message}`);
		failed++;
	}
}

fs.writeFileSync(path.join(OUT, 'maps.json'), JSON.stringify(index, null, '\t'));
console.log(`${ok} maps written to public/assets/maps, ${failed} failed`);
