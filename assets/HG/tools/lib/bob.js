'use strict';
// Parser for the game's ".bin" block-graphic files.
//
// Layout (from Graphics/*/Ass/*.s + Sources/Macros.i):
//   0                     bob_structure scratch record, bob_struct_size = 18 bytes
//   18                    67 slot entries, 14 bytes each:
//                             w:u16  h:u16  x:u16  y:u16  control:u16  dataOffset:u32
//   18 + 67*14 = 956      image data, 5 interleaved bitplanes per row
//                         (4 colour planes + 1 mask plane), rows padded to 16px
//
// The 67 slots are the fixed view frustum: 21 slots for the level above,
// 25 for the player's own level, 21 for the level below -- each group ordered
// far-to-near (depths 4,3,2,1,0).
//
// control bits: 1 = flipped horizontally, 2 = ignore view offset, 3 = random flip

const BOB_STRUCT_SIZE = 18;
const NUM_SLOTS = 67;
const SLOT_ENTRY_SIZE = 14;
const HEADER_SIZE = BOB_STRUCT_SIZE + NUM_SLOTS * SLOT_ENTRY_SIZE; // 956
const PLANES = 5; // 4 colour + 1 mask

/** Slot counts per group, ordered far (depth 4) to near (depth 0). */
const DEPTH_GROUPS = {
	other: [5, 5, 5, 3, 3],  // 21 - levels above and below
	same: [7, 7, 5, 3, 3],   // 25 - the player's own level
};

// Almost every bob carries the full 67-slot frustum table, but a few are drawn
// outside it and index their block structures by something else -- Foam.bin has
// just 4, selected by the water level. The first slot's dataOffset is where the
// table ends, so the count is derivable rather than assumed.
function slotCount(buf) {
	const first = buf.readUInt32BE(BOB_STRUCT_SIZE + 10);
	const n = Math.floor((first - BOB_STRUCT_SIZE) / SLOT_ENTRY_SIZE);
	return n > 0 && n <= NUM_SLOTS ? n : NUM_SLOTS;
}

function parseBobFile(buf) {
	// The 18-byte scratch record at the head of the file carries the mask plane
	// index: 0-5 selects a mask plane, 6 means the image has no mask plane.
	const maskPlane = buf.readUInt16BE(8);
	const numPlanes = maskPlane === 6 ? 4 : maskPlane + 1;

	const slots = [];
	const count = slotCount(buf);
	for (let i = 0; i < count; i++) {
		const o = BOB_STRUCT_SIZE + i * SLOT_ENTRY_SIZE;
		slots.push({
			index: i,
			width: buf.readUInt16BE(o),
			height: buf.readUInt16BE(o + 2),
			// x/y are SIGNED: a sprite taller or wider than its cell slot starts
			// outside the 142x84 window and is clipped by it. Trees at close
			// range have y as low as -43, for instance.
			x: buf.readInt16BE(o + 4),
			y: buf.readInt16BE(o + 6),
			control: buf.readUInt16BE(o + 8),
			dataOffset: buf.readUInt32BE(o + 10),
		});
	}
	return { slots, header: BOB_STRUCT_SIZE + count * SLOT_ENTRY_SIZE,
		size: buf.length, maskPlane, numPlanes, numSlots: count };
}

/**
 * Decode one slot's image into indexed pixels + mask.
 * Image rows store 5 planes consecutively, each ceil(w/16)*2 bytes wide.
 */
function decodeSlotImage(buf, slot, numPlanes = PLANES, maskPlane = 4) {
	const { width: w, height: h, dataOffset } = slot;
	if (w === 0 || h === 0) return null;
	const rowBytes = ((w + 15) >> 4) * 2;
	const planeBytes = rowBytes * h;
	const pixels = new Uint8Array(w * h);
	const mask = new Uint8Array(w * h);
	// Blitter BOBs store each bitplane contiguously (all rows of plane 0, then
	// all rows of plane 1, ...), not interleaved row by row as ILBM does.
	for (let p = 0; p < numPlanes; p++) {
		const isMask = p === maskPlane;
		const bit = 1 << p;
		let src = dataOffset + p * planeBytes;
		for (let y = 0; y < h; y++) {
			const rowBase = y * w;
			for (let bx = 0; bx < rowBytes; bx++) {
				const byte = buf[src + bx];
				if (byte === undefined || byte === 0) continue;
				const x0 = bx << 3;
				for (let b = 0; b < 8; b++) {
					if (!(byte & (0x80 >> b))) continue;
					const x = x0 + b;
					if (x >= w) break;
					if (isMask) mask[rowBase + x] = 1;
					else pixels[rowBase + x] |= bit;
				}
			}
			src += rowBytes;
		}
	}
	// Files with no mask plane (maskPlane 6) key transparency off colour 0,
	// which is the background colour in every style sheet.
	if (maskPlane >= numPlanes) {
		for (let i = 0; i < pixels.length; i++) mask[i] = pixels[i] !== 0 ? 1 : 0;
	}
	return { width: w, height: h, pixels, mask };
}

module.exports = {
	parseBobFile,
	decodeSlotImage,
	BOB_STRUCT_SIZE,
	NUM_SLOTS,
	SLOT_ENTRY_SIZE,
	HEADER_SIZE,
	PLANES,
	DEPTH_GROUPS,
};
