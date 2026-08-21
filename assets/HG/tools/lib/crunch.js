'use strict';
// Backwards LZ decruncher used by character/monster figure .gfx bundles.
// Ported from Sources/Miscroutines.s:4205 (`cr_decrunch` / `decrunchc`).

function decrunchC(buf) {
	if (buf.length < 10) throw new Error('crunched buffer too short');
	let bitCount = buf[0] + 1;
	let checksum = buf[1];
	const unpackedSize = buf.readUInt32BE(2);
	const packedSize = buf.readUInt32BE(6);
	if (packedSize > buf.length) {
		throw new Error(`packed size ${packedSize} exceeds buffer length ${buf.length}`);
	}

	const out = Buffer.alloc(unpackedSize);
	let dst = unpackedSize;
	let src = packedSize;
	let currentByte = buf[--src];
	checksum ^= currentByte;

	function readBits(n) {
		let value = 0;
		for (let i = 0; i < n; i++) {
			bitCount--;
			if (bitCount === 0) {
				currentByte = buf[--src];
				checksum ^= currentByte;
				bitCount = 8;
			}
			const bit = currentByte & 1;
			currentByte >>= 1;
			value = ((value << 1) | bit) & 0xffff;
		}
		return value;
	}

	function putByte(value) {
		if (dst <= 0) throw new Error('literal write before output start');
		out[--dst] = value & 255;
	}

	function duplicate(lengthMinusOne, offsetBits) {
		const offset = readBits(offsetBits);
		for (let i = 0; i <= lengthMinusOne; i++) {
			if (dst <= 0) throw new Error('duplicate write before output start');
			dst--;
			const from = dst + offset + 1;
			if (from < 0 || from >= unpackedSize) {
				throw new Error(`duplicate source ${from} outside ${unpackedSize}`);
			}
			out[dst] = out[from];
		}
	}

	while (dst > 0) {
		let token = readBits(1);
		if (token === 1) {
			token = readBits(2);
			if (token < 2) {
				duplicate(token + 2, token + 9);
			} else if (token === 3) {
				const count = readBits(8) + 8;
				for (let i = 0; i <= count; i++) putByte(readBits(8));
			} else {
				duplicate(readBits(8), 12);
			}
		} else {
			token = readBits(1);
			if (token === 1) {
				duplicate(1, 8);
			} else {
				const count = readBits(3);
				for (let i = 0; i <= count; i++) putByte(readBits(8));
			}
		}
	}

	if ((checksum & 255) !== 0) {
		throw new Error(`decrunch checksum failed (${checksum & 255})`);
	}
	return out;
}

module.exports = { decrunchC };
