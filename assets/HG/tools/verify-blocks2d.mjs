// The top-down icon derivation, checked against the shipped maps.
//
// Every map already carries the icon the original editor computed, in the low
// six bits of map_part2 (`block_2d`). That is a golden reference for the port
// of make_2d_map: run the derivation over all 47 maps and compare cell by cell.
//
// Exact agreement is not possible everywhere. The original picks one of three
// plain-floor and three plain-ceiling variants with rand(), so those cells hold
// whatever the dice gave when the map was last saved. A disagreement inside one
// of those triples is expected; anything else is a real defect.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { blockIcon, floorIcons, MAP_WIDTH, MAP_DEPTH, MAP_HEIGHT } from '../src/editor/blocks2d.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

const LEVEL = MAP_WIDTH * MAP_DEPTH;
const N = LEVEL * MAP_HEIGHT;
const CEILING_VARIANTS = new Set([9, 2, 16]);
const FLOOR_VARIANTS = new Set([6, 26, 33]);
const sameTriple = (a, b) =>
	(CEILING_VARIANTS.has(a) && CEILING_VARIANTS.has(b)) ||
	(FLOOR_VARIANTS.has(a) && FLOOR_VARIANTS.has(b));

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')
	&& fs.existsSync(path.join(dir, f.replace('.json', '.cells'))));

let total = 0, exact = 0, diceOnly = 0, real = 0;
const worst = [];
for (const f of files) {
	const key = f.replace('.json', '');
	const buf = fs.readFileSync(path.join(dir, `${key}.cells`));
	const w = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
	const cells = w.subarray(0, N);
	const seen = w.subarray(N, N * 2);

	let mapReal = 0;
	for (let z = 0; z < MAP_HEIGHT; z++) {
		for (let y = 0; y < MAP_DEPTH; y++) {
			for (let x = 0; x < MAP_WIDTH; x++) {
				const i = z * LEVEL + y * MAP_WIDTH + x;
				const want = seen[i] & 0x3f;
				const got = blockIcon(cells, x, y, z);
				total++;
				if (got === want) exact++;
				else if (sameTriple(got, want)) diceOnly++;
				else { real++; mapReal++; }
			}
		}
	}
	if (mapReal) worst.push([key, mapReal]);
}

const agree = exact + diceOnly;
const pct = (n) => `${((n / total) * 100).toFixed(2)}%`;
console.log(`  ${total} cells across ${files.length} maps`);
console.log(`  exact ${exact} (${pct(exact)}), dice-only ${diceOnly} (${pct(diceOnly)}), other ${real} (${pct(real)})`);
if (worst.length) {
	worst.sort((a, b) => b[1] - a[1]);
	console.log('  worst maps:', worst.slice(0, 5).map(([k, n]) => `${k}:${n}`).join(' '));
}

ok(total === files.length * N, 'every cell of every map was checked');
ok(real === 0, `no disagreement outside the random variants (${real})`);
ok(exact / total > 0.9, `the vast majority match exactly (${pct(exact)})`);

// floorIcons must agree with per-cell calls
{
	const buf = fs.readFileSync(path.join(dir, '01-ArtificialIsland.cells'));
	const w = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
	const cells = w.subarray(0, N);
	const bulk = floorIcons(cells, 11);
	let same = true;
	for (let y = 0; y < MAP_DEPTH; y++) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			if (bulk[y * MAP_WIDTH + x] !== blockIcon(cells, x, y, 11)) same = false;
		}
	}
	ok(same, 'floorIcons matches cell-by-cell derivation');
	ok(bulk.length === LEVEL, 'a floor is 23x23');
}

// determinism -- the same cell must not change icon between redraws
{
	const buf = fs.readFileSync(path.join(dir, '09-Tomb.cells'));
	const w = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
	const cells = w.subarray(0, N);
	const a = floorIcons(cells, 11);
	const b = floorIcons(cells, 11);
	ok(a.every((v, i) => v === b[i]), 'the derivation is deterministic across redraws');
}

console.log(`blocks2d: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
