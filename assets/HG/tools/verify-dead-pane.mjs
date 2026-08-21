// Smoke test for source-style dead/exit pane rendering.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IndexCompositor } from '../src/compositor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'assets');

const DEAD_EXIT_CLEAR_COLOUR = 5;
const RIP_PLANE_KEEP = 42;
const RIP_PLANE_SET = 21;

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

function loadAtlas(meta, base) {
	return {
		width: meta.atlas.width,
		height: meta.atlas.height,
		data: new Uint8Array(fs.readFileSync(path.join(base, meta.atlas.file))),
	};
}

const windows = JSON.parse(fs.readFileSync(path.join(ASSETS, 'windows.json'), 'utf8'));
const windowAtlas = loadAtlas(windows, ASSETS);
const misc = JSON.parse(fs.readFileSync(path.join(ASSETS, 'misc-ui.json'), 'utf8'));
const miscAtlas = loadAtlas(misc, ASSETS);

function countPanePixels(indices, colour) {
	let count = 0;
	for (let y = 0; y < 103; y++) {
		for (let x = 0; x < 160; x++) {
			if (indices[y * 320 + x] === colour) count++;
		}
	}
	return count;
}

function verifySymbol(key, x, y) {
	const r = new IndexCompositor();
	const rect = misc.sprites[key];
	assert(rect?.mode === 'planeOp', `${key} is not a plane-op sprite`);
	assert(rect.keep === RIP_PLANE_KEEP && rect.set === RIP_PLANE_SET,
		`${key} plane operation mismatch`);

	r.drawWindowFrame(windows.windows[4], windowAtlas, 0, 0,
		{ clearColour: DEAD_EXIT_CLEAR_COLOUR });
	r.drawPlaneOpSprite(rect, miscAtlas, x, y,
		rect.keep ?? RIP_PLANE_KEEP, rect.set ?? RIP_PLANE_SET);

	const background = countPanePixels(r.indices, DEAD_EXIT_CLEAR_COLOUR);
	const symbol = countPanePixels(r.indices, RIP_PLANE_SET);
	assert(background > 10000, `${key} clear window did not fill the pane`);
	assert(symbol > 100, `${key} symbol did not render`);
}

verifySymbol('rip', 23, 22);
verifySymbol('exit', 0, 22);

console.log('dead pane smoke: source-style window5 fill and RIP/exit plane-op symbols checked');
