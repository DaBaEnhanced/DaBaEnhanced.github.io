'use strict';
// Build the 67-slot skeleton BOB used for AUX type 7 in the 3D view.
//
// Drawviews.s:2936 / 3187 blit miscgfx+skeleton_bob with .draw_bob_illuminate
// for every frustum slot except the cell underfoot. Slot 66 (bob 44) is a
// control-3 placeholder in Skeleton.bin, so standing on a corpse never shows
// the bones -- .skel_below2 draws the first carried item's container aux
// instead.

const fs = require('fs');
const path = require('path');
const { parseBobFile, decodeSlotImage, NUM_SLOTS } = require('./lib/bob');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const SRC = path.join(REPO, 'Graphics', 'Misc', 'Raw', 'Skeleton.bin');
const PALETTE = path.join(OUT, 'palette.json');
const ATLAS_W = 256;
const CONTROL_NONE = 3;

function packRects(rects, atlasWidth) {
	let x = 0, y = 0, rowHeight = 0;
	for (const r of rects) {
		if (x + r.w > atlasWidth) { x = 0; y += rowHeight + 1; rowHeight = 0; }
		r.ax = x; r.ay = y;
		x += r.w + 1;
		if (r.h > rowHeight) rowHeight = r.h;
	}
	return { width: atlasWidth, height: y + rowHeight + 1 };
}

function readPalette() {
	if (!fs.existsSync(PALETTE)) return null;
	const data = JSON.parse(fs.readFileSync(PALETTE, 'utf8'));
	return data.colours.flat();
}

function buildPreview(atlas, width, height) {
	const pal = readPalette();
	if (!pal) return null;
	const rgba = new Uint8Array(atlas.length * 4);
	for (let i = 0; i < atlas.length; i++) {
		const v = atlas[i];
		if (!v) continue;
		const c = v - 1, o = i * 4;
		rgba[o] = pal[c * 3] || 0;
		rgba[o + 1] = pal[c * 3 + 1] || 0;
		rgba[o + 2] = pal[c * 3 + 2] || 0;
		rgba[o + 3] = 255;
	}
	return encodePNG(width, height, rgba);
}

function validSlot(buf, slot, numPlanes, header) {
	if (!slot || !slot.width || !slot.height || slot.control === CONTROL_NONE) return false;
	const rowBytes = ((slot.width + 15) >> 4) * 2;
	const end = slot.dataOffset + rowBytes * numPlanes * slot.height;
	return slot.dataOffset >= header && end <= buf.length;
}

function main() {
	if (!fs.existsSync(SRC)) throw new Error(`missing ${SRC}`);
	const buf = fs.readFileSync(SRC);
	const bob = parseBobFile(buf);
	if (bob.numSlots !== NUM_SLOTS) {
		throw new Error(`Skeleton.bin: expected ${NUM_SLOTS} slots, got ${bob.numSlots}`);
	}
	const slots = new Array(bob.numSlots).fill(null);
	const rects = [];
	for (let i = 0; i < bob.slots.length; i++) {
		const slot = bob.slots[i];
		if (!validSlot(buf, slot, bob.numPlanes, bob.header)) continue;
		const img = decodeSlotImage(buf, slot, bob.numPlanes, bob.maskPlane);
		if (!img) continue;
		rects.push({ slot: i, w: img.width, h: img.height, img });
		slots[i] = {
			x: slot.x, y: slot.y, w: slot.width, h: slot.height,
			control: slot.control,
		};
	}
	rects.sort((a, b) => b.h - a.h || b.w - a.w);
	const atlasSize = packRects(rects, ATLAS_W);
	const atlas = new Uint8Array(atlasSize.width * atlasSize.height);
	for (const r of rects) {
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				const si = y * r.w + x;
				if (!r.img.mask[si]) continue;
				atlas[(r.ay + y) * atlasSize.width + r.ax + x] = r.img.pixels[si] + 1;
			}
		}
		const s = slots[r.slot];
		s.ax = r.ax;
		s.ay = r.ay;
	}

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'skeleton.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'skeleton.json'), JSON.stringify({
		source: 'Graphics/Misc/Raw/Skeleton.bin',
		sourceAssembly: 'Graphics/Misc/Ass/Skeleton.s / MiscGfxCD32.s',
		atlas: { file: 'skeleton.atlas', width: atlasSize.width, height: atlasSize.height },
		maskPlane: bob.maskPlane,
		numPlanes: bob.numPlanes,
		slots,
		comment: 'AUX type 7 corpse BOB. Atlas stores colour index+1; 0 is transparent. Control-3 placeholders (close-range slots 18-20/43-45/64-66, including underfoot bob 44) are omitted.',
	}, null, '\t'));
	const preview = buildPreview(atlas, atlasSize.width, atlasSize.height);
	if (preview) fs.writeFileSync(path.join(OUT, 'skeleton.preview.png'), preview);
	const present = slots.filter(Boolean).length;
	let covered = 0;
	for (const v of atlas) if (v) covered++;
	console.log(`skeleton: ${present}/${NUM_SLOTS} slots, atlas ${atlasSize.width}x${atlasSize.height}, ` +
		`${(covered / atlas.length * 100).toFixed(1)}% covered`);
}

main();
