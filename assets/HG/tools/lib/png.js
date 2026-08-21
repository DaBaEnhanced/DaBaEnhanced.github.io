'use strict';
// Minimal PNG encoder (RGBA8, no interlace) built on node's zlib.
const zlib = require('zlib');

const CRC_TABLE = (() => {
	const t = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c;
	}
	return t;
})();

function crc32(buf) {
	let c = -1;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

function chunk(type, data) {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, 'ascii');
	data.copy(out, 8);
	const crcBuf = out.subarray(4, 8 + data.length);
	out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
	return out;
}

/** rgba: Uint8Array of w*h*4 */
function encodePNG(width, height, rgba) {
	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0; // filter: none
		Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;  // bit depth
	ihdr[9] = 6;  // colour type RGBA
	ihdr[10] = 0; // deflate
	ihdr[11] = 0; // filter method
	ihdr[12] = 0; // no interlace
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

/**
 * Convert an indexed bitmap to RGBA.
 * Amiga CMAP guns are already 8-bit here (the source art stores them scaled up
 * from 4-bit, e.g. 0xe0 for gun value 14), so they are used verbatim.
 * @param transparentIndex colour index to render as alpha=0, or -1 for none
 */
function indexedToRGBA(pixels, palette, transparentIndex = 0) {
	const rgba = new Uint8Array(pixels.length * 4);
	for (let i = 0; i < pixels.length; i++) {
		const c = pixels[i];
		const o = i * 4;
		if (c === transparentIndex) continue; // leave fully transparent
		rgba[o] = palette[c * 3];
		rgba[o + 1] = palette[c * 3 + 1];
		rgba[o + 2] = palette[c * 3 + 2];
		rgba[o + 3] = 255;
	}
	return rgba;
}

module.exports = { encodePNG, indexedToRGBA, crc32 };
