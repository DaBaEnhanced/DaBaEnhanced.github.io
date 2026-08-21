'use strict';
// Build browser metadata for ExGfx.gfx block types 22-27.
//
// Data/GameFast.dat/ExGfx.s points at grenade, stun-grenade, four sentry
// directions, and an active marker. The compiled CD32 data has the stun-grenade
// offset equal to the first sentry offset because the source label falls through
// without an incbin; draw stun grenades with the normal grenade BOB and keep the
// source oddity documented in the generated JSON.

const fs = require('fs');
const path = require('path');
const {
	decodeSlotImage, BOB_STRUCT_SIZE, NUM_SLOTS, SLOT_ENTRY_SIZE,
} = require('./lib/bob');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const DATA = path.join(REPO, 'Data', 'GameFast.dat');
const OUT = path.resolve(__dirname, '..', 'assets');
const PALETTE = path.join(OUT, 'palette.json');
const ATLAS_W = 256;

const SOURCES = [
	{ block: 22, key: 'grenade', file: 'Grenade.bin' },
	{ block: 23, key: 'stungrenade', file: 'Grenade.bin',
		note: 'ExGfx.s stungrenade label falls through to sentry; normal grenade art is used.' },
	{ block: 24, key: 'sentry_n', file: 'Sentry.bin', offset: 0 },
	{ block: 25, key: 'sentry_e', file: 'Sentry.bin', offset: 956 },
	{ block: 26, key: 'sentry_s', file: 'Sentry.bin', offset: 956 * 2 },
	{ block: 27, key: 'sentry_w', file: 'Sentry.bin', offset: 956 * 3 },
];

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

function parseBobAt(buf, offset = 0) {
	const maskPlane = buf.readUInt16BE(offset + 8);
	const numPlanes = maskPlane === 6 ? 4 : maskPlane + 1;
	const slots = [];
	for (let i = 0; i < NUM_SLOTS; i++) {
		const o = offset + BOB_STRUCT_SIZE + i * SLOT_ENTRY_SIZE;
		slots.push({
			index: i,
			width: buf.readUInt16BE(o),
			height: buf.readUInt16BE(o + 2),
			x: buf.readInt16BE(o + 4),
			y: buf.readInt16BE(o + 6),
			control: buf.readUInt16BE(o + 8),
			// Directional sentry records are four BOB slot tables laid over one
			// shared Sentry.bin data area. Their data offsets are absolute from
			// Sentry.bin, not relative to the slot-table offset.
			dataOffset: buf.readUInt32BE(o + 10),
		});
	}
	return {
		slots,
		header: offset + BOB_STRUCT_SIZE + NUM_SLOTS * SLOT_ENTRY_SIZE,
		size: buf.length,
		maskPlane,
		numPlanes,
		numSlots: NUM_SLOTS,
	};
}

function validSlot(buf, slot, numPlanes, header) {
	if (!slot.width || !slot.height || slot.control === 3) return false;
	const rowBytes = ((slot.width + 15) >> 4) * 2;
	const end = slot.dataOffset + rowBytes * numPlanes * slot.height;
	return slot.dataOffset >= header && end <= buf.length;
}

function decodeSource(src) {
	const full = fs.readFileSync(path.join(DATA, src.file));
	const bob = parseBobAt(full, src.offset || 0);
	const slots = new Array(bob.slots.length).fill(null);
	const rects = [];
	for (let i = 0; i < bob.slots.length; i++) {
		const slot = bob.slots[i];
		if (!validSlot(full, slot, bob.numPlanes, bob.header)) continue;
		const img = decodeSlotImage(full, slot, bob.numPlanes, bob.maskPlane);
		if (!img) continue;
		const rect = { block: src.block, key: src.key, slot: i, w: img.width, h: img.height, img };
		rects.push(rect);
		slots[i] = {
			x: slot.x, y: slot.y, w: slot.width, h: slot.height,
			control: slot.control,
		};
	}
	return {
		src,
		record: {
			block: src.block,
			key: src.key,
			source: `Data/GameFast.dat/${src.file}`,
			offset: src.offset || 0,
			note: src.note,
			maskPlane: bob.maskPlane,
			numPlanes: bob.numPlanes,
			planeOps: [1, 1, 1, 1, 2, 0],
			slots,
		},
		rects,
	};
}

function main() {
	const decoded = SOURCES.map(decodeSource);
	const rects = decoded.flatMap((d) => d.rects)
		.sort((a, b) => b.h - a.h || b.w - a.w);
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
	}

	const key = (block, slot) => `${block}:${slot}`;
	const rectMap = new Map(rects.map((r) => [key(r.block, r.slot), r]));
	const blocks = decoded.map((d) => {
		for (let i = 0; i < d.record.slots.length; i++) {
			const s = d.record.slots[i];
			if (!s) continue;
			const r = rectMap.get(key(d.record.block, i));
			if (r) { s.ax = r.ax; s.ay = r.ay; }
		}
		return d.record;
	});

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'exgfx.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'exgfx.json'), JSON.stringify({
		source: 'Data/GameFast.dat/ExGfx.gfx / ExGfx.s',
		atlas: { file: 'exgfx.atlas', width: atlasSize.width, height: atlasSize.height },
		blocks,
		comment: 'Block types 22-23 are grenade/stun grenade, 24-27 are sentry N/E/S/W. Atlas stores colour index+1; 0 is transparent.',
	}, null, '\t'));

	const preview = buildPreview(atlas, atlasSize.width, atlasSize.height);
	if (preview) fs.writeFileSync(path.join(OUT, 'exgfx.preview.png'), preview);
	console.log(`exgfx: ${blocks.length} blocks, atlas ${atlasSize.width}x${atlasSize.height}`);
}

main();
