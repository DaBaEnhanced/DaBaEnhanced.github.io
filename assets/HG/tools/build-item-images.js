'use strict';
// Build the CD32 inventory item icon atlas from the compiled game BOB.
//
// Graphics/Misc/Ass/smakefile builds Test/HiredGunsCD32/Game/Items.gfx from
// ItemsCD32.ilbm via `ilbm2raw -b6cm`. The final BOB is the authoritative
// runtime format: six colour planes plus a separate mask plane. Decoding that
// mask avoids treating palette index 0 as black filler inside transparent areas.

const fs = require('fs');
const path = require('path');
const { decodeSlotImage, BOB_STRUCT_SIZE, SLOT_ENTRY_SIZE } = require('./lib/bob');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const SRC = path.join(REPO, 'Test', 'HiredGunsCD32', 'Game', 'Items.gfx');
const PALETTE = path.join(OUT, 'palette.json');

const ATLAS_W = 512;
const COLOUR_PLANES = 6;
const TOTAL_PLANES = 7;
const MASK_PLANE = 6;

function parseSlots(buf) {
	const firstData = buf.readUInt32BE(BOB_STRUCT_SIZE + 10);
	const count = Math.floor((firstData - BOB_STRUCT_SIZE) / SLOT_ENTRY_SIZE);
	if (count <= 0 || count > 256) {
		throw new Error(`bad item slot count from first data offset ${firstData}`);
	}
	const slots = [];
	for (let i = 0; i < count; i++) {
		const o = BOB_STRUCT_SIZE + i * SLOT_ENTRY_SIZE;
		slots.push({
			index: i,
			width: buf.readUInt16BE(o),
			height: buf.readUInt16BE(o + 2),
			x: buf.readInt16BE(o + 4),
			y: buf.readInt16BE(o + 6),
			control: buf.readUInt16BE(o + 8),
			dataOffset: buf.readUInt32BE(o + 10),
		});
	}
	return slots;
}

function pack(items) {
	let x = 0, y = 0, rowH = 0;
	for (const item of items) {
		if (x + item.w > ATLAS_W) {
			x = 0;
			y += rowH + 1;
			rowH = 0;
		}
		item.ax = x;
		item.ay = y;
		x += item.w + 1;
		rowH = Math.max(rowH, item.h);
	}
	return { width: ATLAS_W, height: y + rowH };
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

function main() {
	const buf = fs.readFileSync(SRC);
	const headerMaskPlane = buf.readUInt16BE(8);
	if (headerMaskPlane !== 7) {
		throw new Error(`unexpected Items.gfx mask plane ${headerMaskPlane}`);
	}

	const slots = parseSlots(buf);
	const decoded = slots.map((slot) => ({
		slot,
		image: decodeSlotImage(buf, slot, TOTAL_PLANES, MASK_PLANE),
	}));
	const items = decoded.map(({ slot, image }) => ({
		index: slot.index,
		sourceOffset: slot.dataOffset,
		w: image?.width || slot.width,
		h: image?.height || slot.height,
		x: slot.x,
		y: slot.y,
		control: slot.control,
	}));
	const atlasSize = pack(items);
	const atlas = new Uint8Array(atlasSize.width * atlasSize.height);

	for (let i = 0; i < decoded.length; i++) {
		const { image } = decoded[i];
		const item = items[i];
		if (!image) continue;
		for (let y = 0; y < image.height; y++) {
			for (let x = 0; x < image.width; x++) {
				const src = y * image.width + x;
				if (!image.mask[src]) continue;
				atlas[(item.ay + y) * atlasSize.width + item.ax + x] =
					(image.pixels[src] & ((1 << COLOUR_PLANES) - 1)) + 1;
			}
		}
	}

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'item-images.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'item-images.json'), JSON.stringify({
		source: 'Test/HiredGunsCD32/Game/Items.gfx',
		sourceAssembly: 'Graphics/Misc/Ass/itemscd32.s',
		sourceRecipe: 'Graphics/Misc/Ass/smakefile: ilbm2raw -b6cm -@itemscd32.script',
		atlas: { file: 'item-images.atlas', width: atlasSize.width, height: atlasSize.height },
		count: items.length,
		maskPlane: MASK_PLANE,
		colourPlanes: COLOUR_PLANES,
		items,
		comment: 'CD32 item_images BOB decoded from compiled Items.gfx. Atlas stores colour index+1; 0 is transparent. The BOB has six colour planes plus a separate mask plane.',
	}, null, '\t'));

	const preview = buildPreview(atlas, atlasSize.width, atlasSize.height);
	if (preview) {
		fs.writeFileSync(path.join(OUT, 'item-images.preview.png'), preview);
	}

	console.log(`item images: ${items.length} icons, atlas ${atlasSize.width}x${atlasSize.height}`);
}

main();
