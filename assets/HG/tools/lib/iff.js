'use strict';
// IFF ILBM decoder for the Hired Guns source art.
// Handles BMHD/CMAP/BODY with ByteRun1 (compression 1) and uncompressed bodies,
// optional interleaved mask plane (masking 1), and EHB/HAM are rejected loudly
// because none of the game art uses them.

function id(buf, off) {
	return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
}

// ByteRun1 (Amiga "cmpByteRun1") unpacker.
function unpackByteRun1(src, srcOff, srcEnd, dstLen) {
	const dst = Buffer.alloc(dstLen);
	let s = srcOff;
	let d = 0;
	while (d < dstLen && s < srcEnd) {
		const n = src.readInt8(s++);
		if (n >= 0) {
			const count = n + 1;
			for (let i = 0; i < count && d < dstLen; i++) dst[d++] = src[s++];
		} else if (n !== -128) {
			const count = 1 - n;
			const b = src[s++];
			for (let i = 0; i < count && d < dstLen; i++) dst[d++] = b;
		}
		// n === -128 is a no-op per the spec.
	}
	return dst;
}

/**
 * Decode an ILBM into an indexed-colour bitmap.
 * @returns {{width, height, nPlanes, masking, transparent, palette: Uint8Array (n*3),
 *            pixels: Uint8Array (w*h, colour indices), mask: Uint8Array|null}}
 */
function decodeILBM(buf) {
	if (id(buf, 0) !== 'FORM') throw new Error('not an IFF FORM');
	const formType = id(buf, 8);
	if (formType !== 'ILBM' && formType !== 'PBM ') {
		throw new Error(`unsupported FORM type ${formType}`);
	}
	const planar = formType === 'ILBM';

	let bmhd = null;
	let palette = null;
	let bodyOff = -1;
	let bodyLen = 0;

	let off = 12;
	const end = Math.min(buf.length, 8 + buf.readUInt32BE(4));
	while (off + 8 <= end) {
		const chunkId = id(buf, off);
		const size = buf.readUInt32BE(off + 4);
		const dataOff = off + 8;
		switch (chunkId) {
			case 'BMHD':
				bmhd = {
					width: buf.readUInt16BE(dataOff),
					height: buf.readUInt16BE(dataOff + 2),
					xOrigin: buf.readInt16BE(dataOff + 4),
					yOrigin: buf.readInt16BE(dataOff + 6),
					nPlanes: buf[dataOff + 8],
					masking: buf[dataOff + 9],
					compression: buf[dataOff + 10],
					transparent: buf.readUInt16BE(dataOff + 12),
					xAspect: buf[dataOff + 14],
					yAspect: buf[dataOff + 15],
				};
				break;
			case 'CMAP':
				palette = Uint8Array.prototype.slice.call(buf.subarray(dataOff, dataOff + size));
				break;
			case 'BODY':
				bodyOff = dataOff;
				bodyLen = size;
				break;
			default:
				break; // CAMG/DPPS/CRNG/etc. are not needed here.
		}
		off = dataOff + size + (size & 1); // chunks are word-aligned
	}

	if (!bmhd) throw new Error('missing BMHD');
	if (bodyOff < 0) throw new Error('missing BODY');

	const { width, height, nPlanes, masking, compression } = bmhd;
	const rowBytes = ((width + 15) >> 4) * 2; // rows are word-aligned
	const hasMaskPlane = masking === 1;
	const planesPerRow = nPlanes + (hasMaskPlane ? 1 : 0);

	let body;
	const rawLen = rowBytes * planesPerRow * height;
	if (compression === 1) {
		body = unpackByteRun1(buf, bodyOff, bodyOff + bodyLen, rawLen);
	} else if (compression === 0) {
		body = buf.subarray(bodyOff, bodyOff + rawLen);
	} else {
		throw new Error(`unsupported compression ${compression}`);
	}

	const pixels = new Uint8Array(width * height);
	const mask = hasMaskPlane ? new Uint8Array(width * height) : null;

	// Deinterleave: each row stores plane 0..n-1 (then mask) consecutively.
	let src = 0;
	for (let y = 0; y < height; y++) {
		const rowBase = y * width;
		for (let p = 0; p < planesPerRow; p++) {
			const isMask = hasMaskPlane && p === nPlanes;
			const bit = 1 << p;
			for (let bx = 0; bx < rowBytes; bx++) {
				const byte = body[src + bx];
				if (byte === 0) continue;
				const x0 = bx << 3;
				for (let b = 0; b < 8; b++) {
					if (!(byte & (0x80 >> b))) continue;
					const x = x0 + b;
					if (x >= width) break;
					if (isMask) mask[rowBase + x] = 1;
					else pixels[rowBase + x] |= bit;
				}
			}
			src += rowBytes;
		}
	}

	if (planar === false) {
		// PBM  is chunky; re-read straight.
		for (let i = 0; i < width * height && i < body.length; i++) pixels[i] = body[i];
	}

	return {
		width,
		height,
		nPlanes,
		masking,
		transparent: bmhd.transparent,
		palette,
		pixels,
		mask,
	};
}

/** Crop an indexed bitmap to a rect, returning a new indexed bitmap. */
function crop(img, x, y, w, h) {
	const out = new Uint8Array(w * h);
	for (let row = 0; row < h; row++) {
		const sy = y + row;
		if (sy < 0 || sy >= img.height) continue;
		for (let col = 0; col < w; col++) {
			const sx = x + col;
			if (sx < 0 || sx >= img.width) continue;
			out[row * w + col] = img.pixels[sy * img.width + sx];
		}
	}
	return { width: w, height: h, pixels: out, palette: img.palette };
}

// 24-bit ILBM (Map4.24ilbm): planes 0-7 red, 8-15 green, 16-23 blue.
function decodeILBM24(buf) {
	if (id(buf, 0) !== 'FORM') throw new Error('not an IFF FORM');
	let width = 0, height = 0, nPlanes = 0, compression = 0;
	let bodyOff = -1, bodyLen = 0;
	let off = 12;
	const end = Math.min(buf.length, 8 + buf.readUInt32BE(4));
	while (off + 8 <= end) {
		const chunkId = id(buf, off);
		const size = buf.readUInt32BE(off + 4);
		const dataOff = off + 8;
		if (chunkId === 'BMHD') {
			width = buf.readUInt16BE(dataOff);
			height = buf.readUInt16BE(dataOff + 2);
			nPlanes = buf[dataOff + 8];
			compression = buf[dataOff + 10];
		} else if (chunkId === 'BODY') {
			bodyOff = dataOff;
			bodyLen = size;
		}
		off = dataOff + size + (size & 1);
	}
	if (!width || bodyOff < 0) throw new Error('bad 24-bit ILBM');
	const rowBytes = ((width + 15) >> 4) * 2;
	const rawLen = rowBytes * nPlanes * height;
	const body = compression === 1
		? unpackByteRun1(buf, bodyOff, bodyOff + bodyLen, rawLen)
		: buf.subarray(bodyOff, bodyOff + rawLen);
	const rgba = new Uint8Array(width * height * 4);
	// Map4.24ilbm stores each plane as a full-height bitmap, not ILBM's
	// usual per-row plane interleave: plane 0 (all rows), then plane 1, ...
	for (let p = 0; p < nPlanes; p++) {
		const channel = p >> 3;
		const mask = 1 << (7 - (p & 7));
		const planeOff = p * rowBytes * height;
		for (let y = 0; y < height; y++) {
			const src = planeOff + y * rowBytes;
			for (let bx = 0; bx < rowBytes; bx++) {
				const byte = body[src + bx];
				if (!byte) continue;
				const x0 = bx << 3;
				for (let b = 0; b < 8; b++) {
					if (!(byte & (0x80 >> b))) continue;
					const x = x0 + b;
					if (x >= width) break;
					const o = (y * width + x) * 4;
					rgba[o + channel] |= mask;
					rgba[o + 3] = 255;
				}
			}
		}
	}
	return { width, height, rgba };
}

// AGA HAM8: 8-bit index, top 2 bits = hold/modify mode, bottom 6 = data.
function ham8ToRGBA(pixels, width, height, palette) {
	const rgba = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y++) {
		let r = palette[0] || 0, g = palette[1] || 0, b = palette[2] || 0;
		for (let x = 0; x < width; x++) {
			const v = pixels[y * width + x];
			const mode = v >> 6;
			const data = v & 63;
			if (mode === 0) {
				r = palette[data * 3] || 0;
				g = palette[data * 3 + 1] || 0;
				b = palette[data * 3 + 2] || 0;
			} else if (mode === 1) b = data << 2;
			else if (mode === 2) r = data << 2;
			else g = data << 2;
			const o = (y * width + x) * 4;
			rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
		}
	}
	return { width, height, rgba };
}

function decodeHAM8(buf) {
	const img = decodeILBM(buf);
	if (!img.palette) throw new Error('HAM8 ILBM missing CMAP');
	return ham8ToRGBA(img.pixels, img.width, img.height, img.palette);
}

module.exports = { decodeILBM, decodeILBM24, decodeHAM8, ham8ToRGBA, crop, unpackByteRun1 };
