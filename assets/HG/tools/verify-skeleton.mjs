// Smoke test for AUX type 7 skeleton BOBs in the 3D view.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import {
	LEVEL_CELLS, MAP_HEIGHT, MAP_WIDTH, VIEW_H, VIEW_W, VIEW_X, VIEW_Y, SCREEN_W,
	cellIndex, buildDrawList,
} from '../src/view.js';
import { IndexCompositor } from '../src/compositor.js';
import { createInventory, skeletonUnderfootAux } from '../src/inventory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const R = require('./lib/viewrender.js');
const ASSETS = path.resolve(__dirname, '..', 'assets');

const tables = JSON.parse(fs.readFileSync(path.join(ASSETS, 'viewtables.json'), 'utf8'));
const style = JSON.parse(fs.readFileSync(path.join(ASSETS, 'style2.json'), 'utf8'));
const styleAtlas = {
	width: style.atlas.width,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, style.atlas.file))),
};
const skeleton = JSON.parse(fs.readFileSync(path.join(ASSETS, 'skeleton.json'), 'utf8'));
const skeletonAtlas = {
	width: skeleton.atlas.width,
	data: new Uint8Array(fs.readFileSync(path.join(ASSETS, skeleton.atlas.file))),
	slots: skeleton.slots || [],
};
const itemsData = JSON.parse(fs.readFileSync(path.join(ASSETS, 'items.json'), 'utf8'));

const FLOOR_HERE = 1;
const AUX_HERE = 32;
const AUX_SKELETON = 7;
const AUX_SHIFT = 28;
const AUX_DATA_MASK = 0x000ff000;
const AUX_DATA_SHIFT = 12;
const FLOOR_SHIFT = 9;
const LIGHT_BIT = 31;
const SLOT_AHEAD = 57;
const floorCell = FLOOR_HERE | (3 << FLOOR_SHIFT);

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

const present = skeleton.slots.filter(Boolean).length;
assert(present === 58, `expected 58 drawable skeleton slots, got ${present}`);
assert(skeleton.slots[41]?.ax !== undefined, 'near same-level skeleton slot 41 missing');
assert(!skeleton.slots[44], 'underfoot bob 44 must stay a control-3 placeholder');

const cells = new Uint32Array(LEVEL_CELLS * MAP_HEIGHT);
const items = new Uint32Array(cells.length);
const seen = new Uint32Array(cells.length);
for (let z = 0; z < MAP_HEIGHT; z++) {
	for (let y = 0; y < MAP_WIDTH; y++) {
		for (let x = 0; x < MAP_WIDTH; x++) {
			const idx = cellIndex(x, y, z);
			cells[idx] = floorCell;
			items[idx] = 1 << LIGHT_BIT;
		}
	}
}

const ahead = cellIndex(10, 9, 2);
cells[ahead] |= AUX_HERE | (AUX_SKELETON << AUX_SHIFT);
seen[ahead] = (0 << AUX_DATA_SHIFT) & AUX_DATA_MASK;

const list = buildDrawList({
	cells, items,
	x: 10, y: 10, floor: 2, direction: 0,
	tables, style,
});
const layer = list.find((s) => s.skeleton);
assert(layer, 'skeleton BOB was not emitted one step ahead');
assert(layer.slot === tables.slotMap[SLOT_AHEAD].bob, `ahead slot bob ${layer.slot}`);
assert(skeleton.slots[layer.slot]?.ax !== undefined, `slot ${layer.slot} has no atlas rect`);

const renderArgs = {
	cells, items,
	base: cellIndex(10, 10, 2),
	direction: 0,
	tables, style, atlas: styleAtlas,
	skeleton, skeletonAtlas,
};
const withSkel = R.renderView(renderArgs).pixels;
const withoutSkel = R.renderView({ ...renderArgs, skeletonAtlas: null }).pixels;
let diff = 0;
for (let i = 0; i < withSkel.length; i++) {
	if (withSkel[i] !== withoutSkel[i]) diff++;
}
assert(diff > 0, 'skeleton atlas did not change rendered pixels');

const comp = new IndexCompositor();
comp.clear();
comp.drawView(list, styleAtlas, 0, 0, VIEW_X, VIEW_Y, { skeleton: skeletonAtlas });
const runtime = new Uint8Array(VIEW_W * VIEW_H);
for (let y = 0; y < VIEW_H; y++) {
	const src = (VIEW_Y + y) * SCREEN_W + VIEW_X;
	runtime.set(comp.indices.subarray(src, src + VIEW_W), y * VIEW_W);
}
let mismatch = 0;
for (let i = 0; i < runtime.length; i++) if (runtime[i] !== withSkel[i]) mismatch++;
assert(mismatch === 0, `runtime/oracle skeleton pixels differ (${mismatch})`);

const here = cellIndex(10, 10, 2);
cells[ahead] = floorCell;
cells[here] |= AUX_HERE | (AUX_SKELETON << AUX_SHIFT);
seen[here] = (0 << AUX_DATA_SHIFT) & AUX_DATA_MASK;

const dead = { inventory: createInventory() };
const emptyAux = skeletonUnderfootAux(seen, [dead], itemsData, here);
assert(emptyAux === 0, 'empty skeleton must not show a container underfoot');
const emptyList = buildDrawList({
	cells, items,
	x: 10, y: 10, floor: 2, direction: 0,
	tables, style,
	skeletonUnderfootAux: emptyAux,
});
assert(!emptyList.some((s) => s.skeleton), 'underfoot must not emit the skeleton BOB');
const emptyExtra = emptyList.length;

dead.inventory.using = { num: 15, damage: 0, ammo: 0, outlined: 0 };
const aux = skeletonUnderfootAux(seen, [dead], itemsData, here);
assert(aux >= 2 && aux <= 6, `held item 15 should have container aux, got ${aux}`);
const footList = buildDrawList({
	cells, items,
	x: 10, y: 10, floor: 2, direction: 0,
	tables, style,
	skeletonUnderfootAux: aux,
});
assert(!footList.some((s) => s.skeleton), 'underfoot skeleton BOB still emitted');
const crate = style.graphics[32 + aux]?.slots?.[tables.slotMap[66].bob];
assert(crate, `style missing underfoot container slot for aux ${aux}`);
assert(footList.some((s) => s.ax === crate.ax && s.ay === crate.ay && s.w === crate.w),
	`underfoot container gfx ${32 + aux} missing`);
assert(footList.length > emptyExtra, 'held-item underfoot did not add a draw-list entry');

console.log(`skeleton smoke: ahead slot ${layer.slot} drew ${diff} pixels, ` +
	`underfoot empty=skip held-aux=${aux}`);
