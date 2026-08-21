// redraw_level's composite icon index (HGedit3.c:582-600).
import fs from 'fs';
import {
	tileFor, describeTile, floorTiles, TILE_STRIDE, FLOOR_STATES,
	TILE_UNDER_STONE, TILE_OPAQUE, FLOWING_BIT,
} from '../src/editor/tileindex.js';
import { setField, FIELD_NAMES } from '../src/editor/edit.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);
const w = (...ops) => ops.reduce((a, [f, v]) => setField(a, f, v), 0) >>> 0;

// The arithmetic, straight from the C.
eq(tileFor(0), 0, 'an empty cell is icon 0');
eq(tileFor(w(['block', 0])), 1, 'block n is icon n+1');
eq(tileFor(w(['block', 2])), 3, 'Ft Boost is the FT icon at 3');
eq(tileFor(w(['block', 3])), 4, 'Exit is the EX icon at 4');
eq(tileFor(w(['block', 5])), 6, 'Barrier is the BA icon at 6');
eq(tileFor(w(['block', 6])), 7, 'Teleport is the TL icon at 7');
eq(tileFor(w(['floor', 0])), 33, 'floor f is (f+1)*33');
eq(tileFor(w(['floor', 3])), 132, 'the last floor state is 132');
eq(tileFor(w(['floor', 0], ['block', 4])), 38, 'floor and block add');
eq(tileFor(w(['panel', 0])), 165, 'a panel adds a flat 165');
eq(tileFor(w(['panel', 2])), 165, 'which panel does not change the icon');
eq(tileFor(w(['aux', 0])), 660, 'aux adds a flat 660');
eq(tileFor(w(['aux', 15])), 660, 'which aux does not change the icon');
eq(tileFor(0, true), 330, 'flowing water adds a flat 330');
eq(tileFor(w(['floor', 0], ['panel', 0], ['aux', 6]), true), 33 + 165 + 330 + 660,
	'every contribution stacks');

// The three that replace the index outright.
eq(tileFor(0, false, w(['block', 0])), TILE_UNDER_STONE, 'an empty cell under stone is 1325');
eq(tileFor(w(['block', 0]), false, w(['block', 0])), 1, 'but only when the cell is empty');
eq(tileFor(0, false, w(['block', 4])), 0, 'and only when what is above is stone');
eq(tileFor(0x40), TILE_OPAQUE, 'opaque with no block is 1324');
eq(tileFor(0x40 | w(['block', 0])), 1, 'opaque WITH a block keeps its own icon');

// Nothing may address past the file.
const TILES = JSON.parse(fs.readFileSync(new URL('../assets/editor-tiles.json', import.meta.url)));
eq(TILES.count, 1333, 'Blocks.dat holds 1333 icons');
eq(FLOOR_STATES * 8 * TILE_STRIDE, 1320, 'the composite range is 1320 icons');
ok(TILE_UNDER_STONE < TILES.count && TILE_OPAQUE < TILES.count, 'the specials are in range');

// Exhaustive: every reachable cell must land on a real icon.
{
	let worst = -1, bad = 0;
	for (let f = -1; f < 4; f++) {
		for (let b = -1; b < 32; b++) {
			for (const panel of [-1, 0, 1, 2]) {
				for (const aux of [-1, 0, 6, 15]) {
					for (const flow of [false, true]) {
						let cell = 0;
						if (f >= 0) cell = setField(cell, 'floor', f);
						if (b >= 0) cell = setField(cell, 'block', b);
						if (panel >= 0) cell = setField(cell, 'panel', panel);
						if (aux >= 0) cell = setField(cell, 'aux', aux);
						const n = tileFor(cell >>> 0, flow);
						if (n >= TILES.count || n < 0) bad++;
						if (n > worst) worst = n;
					}
				}
			}
		}
	}
	eq(bad, 0, 'no reachable cell addresses past the file');
	ok(worst <= 1319, `the highest composite icon is in the 1320 range (${worst})`);
}

// describeTile must invert tileFor for everything the composite range covers.
{
	let bad = 0;
	for (let n = 0; n < FLOOR_STATES * 8 * TILE_STRIDE; n++) {
		const d = describeTile(n);
		const back = d.floorState * TILE_STRIDE + d.blockState +
			(d.panel ? 165 : 0) + (d.flowing ? 330 : 0) + (d.aux ? 660 : 0);
		if (back !== n) bad++;
	}
	eq(bad, 0, 'describeTile round-trips every composite index');
	eq(describeTile(TILE_UNDER_STONE).special, 'Empty, with stone overhead', '1325 is named');
	eq(describeTile(TILE_OPAQUE).special, 'Opaque, no block (invisible wall)', '1324 is named');
}

// The flowing bit must be the one worldfx.js reads, not a guess.
eq(FLOWING_BIT, 11, 'flowing_bit sits below egg_hatch:12 and egg_contents:8');
{
	const cells = new Uint32Array(23 * 23 * 2);
	const seen = new Uint32Array(23 * 23 * 2);
	seen[0] = 1 << FLOWING_BIT;
	eq(floorTiles(cells, seen, 0, 23, 23)[0], 330, 'floorTiles reads flowing from layer 2');
	eq(floorTiles(cells, null, 0, 23, 23)[0], 0, 'and tolerates no layer 2 at all');
}

// Every campaign map, against the real data.
{
	const dir = new URL('../assets/maps/', import.meta.url);
	const names = fs.readdirSync(dir)
		.filter((f) => f.endsWith('.cells'))
		.map((f) => f.slice(0, -'.cells'.length));
	let cellsSeen = 0, outOfRange = 0, redHatch = 0, mapsSeen = 0;
	const used = new Set();
	for (const name of names) {
		const cellBytes = new Uint8Array(fs.readFileSync(new URL(`${name}.cells`, dir)));
		const words = new Uint32Array(cellBytes.buffer, cellBytes.byteOffset,
			Math.floor(cellBytes.byteLength / 4));
		const per = 23 * 23 * 20;
		const cells = words.subarray(0, per), seen = words.subarray(per, per * 2);
		mapsSeen++;
		for (let z = 0; z < 20; z++) {
			for (const n of floorTiles(cells, seen, z, 23, 23)) {
				cellsSeen++;
				used.add(n);
				if (n >= TILES.count) outOfRange++;
				// Blocks 8-15 and 22-31 have no art; the editor draws red hatch.
				const d = describeTile(n);
				if (d && !d.special) {
					const b = d.blockState - 1;
					if (b >= 0 && (FIELD_NAMES.block[b] === '--' || b >= FIELD_NAMES.block.length)) redHatch++;
				}
			}
		}
	}
	ok(mapsSeen === 47, `all 47 campaign maps read (${mapsSeen})`);
	ok(cellsSeen > 400000, `every map floor indexed (${cellsSeen} cells)`);
	eq(outOfRange, 0, 'no campaign cell addresses past the file');
	eq(redHatch, 0, 'no campaign cell lands on an unused block value');
	ok(used.size > 20, `the campaign uses ${used.size} distinct icons`);
}

console.log(`tileindex: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
