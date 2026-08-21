'use strict';
// IFF 8SVX decoder (8-bit signed mono samples, the Amiga sound-effect format).
// Handles both uncompressed bodies and Fibonacci-delta compression.

const FIB_DELTA = [-34, -21, -13, -8, -5, -3, -2, -1, 0, 1, 2, 3, 5, 8, 13, 21, 34];

function id(buf, off) {
	return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
}

/** Fibonacci-delta decode: each nibble selects a delta from the table. */
function fibDelta(src) {
	// First two bytes are padding + the initial sample value.
	const out = new Int8Array((src.length - 2) * 2);
	let prev = src.readInt8(1);
	let o = 0;
	for (let i = 2; i < src.length; i++) {
		const b = src[i];
		prev = Math.max(-128, Math.min(127, prev + FIB_DELTA[b >> 4]));
		out[o++] = prev;
		prev = Math.max(-128, Math.min(127, prev + FIB_DELTA[b & 0x0f]));
		out[o++] = prev;
	}
	return out;
}

function decode8SVX(buf) {
	if (id(buf, 0) !== 'FORM' || id(buf, 8) !== '8SVX') throw new Error('not an 8SVX FORM');

	let vhdr = null, name = '', body = null;
	let off = 12;
	const end = Math.min(buf.length, 8 + buf.readUInt32BE(4));
	while (off + 8 <= end) {
		const chunk = id(buf, off);
		const size = buf.readUInt32BE(off + 4);
		const data = off + 8;
		switch (chunk) {
			case 'VHDR':
				vhdr = {
					oneShotHiSamples: buf.readUInt32BE(data),
					repeatHiSamples: buf.readUInt32BE(data + 4),
					samplesPerHiCycle: buf.readUInt32BE(data + 8),
					samplesPerSec: buf.readUInt16BE(data + 12),
					ctOctave: buf[data + 14],
					compression: buf[data + 15],
					volume: buf.readUInt32BE(data + 16),
				};
				break;
			case 'NAME':
				name = buf.toString('latin1', data, data + size).replace(/\0.*$/, '');
				break;
			case 'BODY':
				body = buf.subarray(data, data + size);
				break;
			default:
				break;
		}
		off = data + size + (size & 1);
	}
	if (!vhdr) throw new Error('missing VHDR');
	if (!body) throw new Error('missing BODY');

	let samples;
	if (vhdr.compression === 0) {
		samples = new Int8Array(body.buffer, body.byteOffset, body.length);
	} else if (vhdr.compression === 1) {
		samples = fibDelta(body);
	} else {
		throw new Error(`unsupported compression ${vhdr.compression}`);
	}

	return {
		name,
		sampleRate: vhdr.samplesPerSec || 8363,
		samples,
		oneShot: vhdr.oneShotHiSamples,
		repeat: vhdr.repeatHiSamples,
		volume: vhdr.volume,
		compression: vhdr.compression,
	};
}

module.exports = { decode8SVX, fibDelta };
