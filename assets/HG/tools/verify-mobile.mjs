// Focused checks for the touch-only controller additions.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LEVEL_CELLS, cellIndex } from '../src/view.js';
import { canPullBlock } from '../src/pushables.js';
import { fittedGameScale } from '../src/layout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

// The runtime and stylesheet both guard the overlay; desktop continues through
// pickGadget and its source-accurate right-button alternates.
assert(main.includes("matchMedia('(hover: none), (pointer: coarse)')"),
	'mobile action runtime is not coarse-pointer guarded');
assert(html.includes('@media (hover: hover) and (pointer: fine)'),
	'mobile action overlay is not hidden for a fine desktop pointer');
assert(main.includes("e?.pointerType === 'touch'"),
	'character edge navigation is not touch-event guarded');
assert(html.includes('@media (orientation: portrait)') &&
	html.includes('@media (orientation: landscape)'),
	'fullscreen controls are not orientation responsive');
assert(html.includes(':not(#qsave):not(#qload):not(#load-level):not(#fullscreen)'),
	'fullscreen did not reduce the toolbar to the four requested controls');

for (const [w, h] of [[390, 700], [700, 300], [250, 180], [1280, 720]]) {
	const scale = fittedGameScale(w, h, 320, 220, { fractional: true });
	const fw = 320 * scale, fh = 220 * scale;
	assert(fw <= w + 1e-9 && fh <= h + 1e-9, `${w}x${h}: fullscreen fit is clipped`);
	assert(Math.abs(fw / fh - 320 / 220) < 1e-12, `${w}x${h}: fullscreen fit is deformed`);
}
assert(fittedGameScale(700, 300, 320, 220) === 1,
	'normal presentation stopped using integer scale');

const FLOOR = 1;
const BLOCK = 1 << 1;
const PUSHABLE = 1 << 8;
const cells = new Uint32Array(LEVEL_CELLS * 2);
cells.fill(FLOOR);
const player = { x: 5, y: 5, floor: 1, direction: 0 };
const front = cellIndex(5, 4, 1);
const back = cellIndex(5, 6, 1);
cells[front] = FLOOR | BLOCK | PUSHABLE | (1 << 11);
assert(canPullBlock(cells, player), 'pullable block did not expose Pull');
cells[back] |= BLOCK;
assert(!canPullBlock(cells, player), 'blocked rear still exposed Pull');
cells[back] &= ~BLOCK;
cells[front] &= ~PUSHABLE;
assert(!canPullBlock(cells, player), 'ordinary block exposed Pull');

console.log('mobile controls: desktop guards and contextual pull eligibility checked');
