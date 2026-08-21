'use strict';
// Rob Northen ProPack (RNC) method-1 decompressor.
//
// Used for the shipped campaign data: World/Locations.dat and the .rnc copies of
// each map. Format:
//
//   0   'R' 'N' 'C' method(1)
//   4   unpacked size   u32 BE
//   8   packed size     u32 BE
//   12  unpacked CRC    u16 BE
//   14  packed CRC      u16 BE
//   16  leeway          u8
//   17  chunk count     u8
//   18  packed stream
//
// The stream is LZ77 with three Huffman tables (literal-run length, match
// distance, match length) rebuilt at the start of each chunk. Bits are read LSB
// first from little-endian 16-bit words; after a literal run the bit buffer is
// re-primed from the new input position.

const HEADER_SIZE = 18;

function readHeader(buf) {
	if (buf.length < HEADER_SIZE) throw new Error('too short for an RNC header');
	if (buf[0] !== 0x52 || buf[1] !== 0x4e || buf[2] !== 0x43) throw new Error('not RNC');
	return {
		method: buf[3],
		unpackedSize: buf.readUInt32BE(4),
		packedSize: buf.readUInt32BE(8),
		unpackedCRC: buf.readUInt16BE(12),
		packedCRC: buf.readUInt16BE(14),
		leeway: buf[16],
		chunks: buf[17],
	};
}

/** Reverse the low `bits` bits of `value`. */
function mirror(value, bits) {
	let out = 0;
	for (let i = 0; i < bits; i++) {
		out = (out << 1) | ((value >> i) & 1);
	}
	return out >>> 0;
}

// Bit reader ported register-for-register from Sources/RNC_1.S (Rob Northen's
// own MC68000 method-1 source, shipped with the game).
//
// bit_count counts DOWN and going negative triggers a refill; bit_buffer is
// 32-bit with the live bits at the bottom. Crucially the buffer is never reset:
// after a literal run the surviving low bits are kept and the word at the new
// input position is OR'd in above them (unpack12), and bit_count is left alone.
const swap32 = (x) => (((x << 16) | (x >>> 16)) >>> 0);

class BitReader {
	constructor(buf, pos) {
		this.buf = buf;
		this.pos = pos;
		this.bitCount = 0;
		this.bitBuffer = this.word(pos);
	}
	word(p) {
		return (((this.buf[p] || 0) | ((this.buf[p + 1] || 0) << 8)) >>> 0);
	}
	/** input_bits3: consume the remaining bits, pull in the next word. */
	refill(n) {
		this.bitCount += n;
		this.bitBuffer = this.bitBuffer >>> this.bitCount;
		this.bitBuffer = swap32(this.bitBuffer);
		this.pos += 4;
		this.pos -= 1; const b1 = this.buf[this.pos] || 0;
		let low = (this.bitBuffer & 0xff00) | b1;
		low = (((low << 8) | (low >>> 8)) & 0xffff);        // rol.w #8
		this.pos -= 1; const b2 = this.buf[this.pos] || 0;
		low = (low & 0xff00) | b2;
		this.bitBuffer = (((this.bitBuffer & 0xffff0000) >>> 0) | low) >>> 0;
		this.bitBuffer = swap32(this.bitBuffer);
		const adjusted = n - this.bitCount;
		this.bitCount = 16 - adjusted;
		return adjusted;
	}
	/** input_bits: value = buffer & mask, then consume n bits. */
	read(mask, n) {
		const v = (this.bitBuffer & mask) >>> 0;
		this.bitCount -= n;
		if (this.bitCount < 0) n = this.refill(n);
		this.bitBuffer = this.bitBuffer >>> n;
		return v;
	}
	bits(n) { return n === 0 ? 0 : this.read((1 << n) - 1, n); }
	peek(mask) { return (this.bitBuffer & mask) >>> 0; }
	/** unpack12 tail: re-merge after a literal run, keeping bit_count. */
	mergeAfterLiterals() {
		const w = this.word(this.pos) << this.bitCount;
		const keep = ((1 << this.bitCount) - 1) >>> 0;
		this.bitBuffer = (((this.bitBuffer & keep) >>> 0) | w) >>> 0;
	}
}

/** Rebuild one Huffman table from the stream. */
function readHuffTable(bits) {
	const num = bits.bits(5);   // make_huftable: moveq #$1f,d0 / moveq #5,d1
	const table = [];
	if (num === 0) return table;

	const leafLen = new Array(num);
	let leafMax = 1;
	for (let i = 0; i < num; i++) {
		leafLen[i] = bits.bits(4);
		if (leafLen[i] > leafMax) leafMax = leafLen[i];
	}

	let code = 0;
	for (let len = 1; len <= leafMax; len++) {
		for (let i = 0; i < num; i++) {
			if (leafLen[i] !== len) continue;
			table.push({ code: mirror(code >>> (16 - len), len), len, value: i });
			code = (code + (1 << (16 - len))) >>> 0;
		}
	}
	return table;
}

function huffDecode(bits, table) {
	if (table.length === 0) return 0;
	for (const e of table) {
		const mask = (1 << e.len) - 1;
		if (bits.peek(mask) !== e.code) continue;
		bits.read(mask, e.len);
		let val = e.value;
		if (val >= 2) {
			// input_value: read (value-1) more bits and set bit (value-1).
			const extra = val - 1;
			val = (bits.read((1 << extra) - 1, extra) | (1 << extra)) >>> 0;
		}
		return val;
	}
	throw new Error('no matching Huffman code');
}

/** @returns {{header, data: Buffer}} */
function unpack(buf) {
	const header = readHeader(buf);
	if (header.method !== 1) throw new Error(`unsupported RNC method ${header.method}`);

	const out = Buffer.alloc(header.unpackedSize);
	let outPos = 0;
	const bits = new BitReader(buf, HEADER_SIZE);
	bits.read(3, 2); // unpack7 discards two bits

	while (outPos < header.unpackedSize) {
		const raw = readHuffTable(bits);
		const dist = readHuffTable(bits);
		const len = readHuffTable(bits);
		let counts = bits.read(0xffff, 16) - 1;   // unpack9: counts = n - 1

		for (;;) {
			// unpack12: literal run
			const n = huffDecode(bits, raw) - 1;
			if (n >= 0) {
				for (let i = 0; i <= n; i++) out[outPos++] = buf[bits.pos++];
				bits.mergeAfterLiterals();
			}
			// unpack13: dbra counts
			if (counts-- === 0) break;
			// unpack10: match
			const distance = huffDecode(bits, dist) + 1;
			let length = huffDecode(bits, len) + 1;
			let src = outPos - distance;
			for (let i = 0; i <= length; i++) out[outPos++] = out[src++];
		}
	}
	return { header, data: out };
}

module.exports = { unpack, readHeader, HEADER_SIZE };
