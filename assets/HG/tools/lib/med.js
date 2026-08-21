'use strict';
// OctaMED MMD0 module parser (the format Hired Guns' music uses, played back by
// Sources/MEDmodplayer.s).
//
// Layout:
//   MMD0 header (52 bytes) -> song pointer, block-pointer array, sample-pointer
//   array. The song record holds 63 instrument headers, the play sequence and
//   the tempo/volume state; each block is a pattern of numtracks x lines notes,
//   3 bytes per note.

const MMD0_HEADER_SIZE = 52;
const NUM_INSTR = 63;
const INSTR_HDR_SIZE = 8;

function id(buf, off) {
	return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
}

function parseHeader(buf) {
	const magic = id(buf, 0);
	if (magic !== 'MMD0' && magic !== 'MMD1') throw new Error(`not a MED module (${magic})`);
	return {
		magic,
		modLength: buf.readUInt32BE(4),
		songOffset: buf.readUInt32BE(8),
		blockArrOffset: buf.readUInt32BE(16),
		sampleArrOffset: buf.readUInt32BE(24),
		expDataOffset: buf.readUInt32BE(32),
		playSeqNum: buf.readUInt16BE(46),
	};
}

function parseSong(buf, off) {
	const instruments = [];
	for (let i = 0; i < NUM_INSTR; i++) {
		const o = off + i * INSTR_HDR_SIZE;
		instruments.push({
			repeat: buf.readUInt16BE(o) * 2,      // stored in words
			repeatLength: buf.readUInt16BE(o + 2) * 2,
			midiChannel: buf[o + 4],
			midiPreset: buf[o + 5],
			volume: buf[o + 6],
			transpose: buf.readInt8(o + 7),
		});
	}
	let o = off + NUM_INSTR * INSTR_HDR_SIZE; // 504
	const numBlocks = buf.readUInt16BE(o); o += 2;
	const songLength = buf.readUInt16BE(o); o += 2;
	const playSeq = Array.from(buf.subarray(o, o + 256)); o += 256;
	const defTempo = buf.readUInt16BE(o); o += 2;
	const playTranspose = buf.readInt8(o); o += 1;
	const flags = buf[o++];
	const flags2 = buf[o++];
	const tempo2 = buf[o++];
	const trackVolumes = Array.from(buf.subarray(o, o + 16)); o += 16;
	const masterVolume = buf[o++];
	const numSamples = buf[o++];

	return {
		instruments, numBlocks, songLength,
		playSeq: playSeq.slice(0, songLength),
		defTempo, playTranspose, flags, flags2, tempo2,
		trackVolumes, masterVolume, numSamples,
		// flags2 bit 5 selects BPM mode; low 5 bits are beat rows per beat.
		bpmMode: !!(flags2 & 0x20),
		rowsPerBeat: (flags2 & 0x1f) + 1,
	};
}

/** Decode one pattern block: numtracks x lines, 3 bytes per note. */
function parseBlock(buf, off) {
	const numTracks = buf[off];
	const lines = buf[off + 1] + 1; // stored as count-1
	const notes = [];
	let o = off + 2;
	for (let line = 0; line < lines; line++) {
		const row = [];
		for (let t = 0; t < numTracks; t++) {
			const b0 = buf[o], b1 = buf[o + 1], b2 = buf[o + 2];
			o += 3;
			const note = b0 & 0x3f;
			const instrument = ((b0 & 0xc0) >> 2) | ((b1 & 0xf0) >> 4);
			const command = b1 & 0x0f;
			row.push(note || instrument || command || b2
				? { note, instrument, command, data: b2 }
				: null);
		}
		notes.push(row);
	}
	return { numTracks, lines, notes };
}

/** Instrument sample data: length, type, then raw 8-bit signed PCM. */
function parseSample(buf, off) {
	const length = buf.readUInt32BE(off);
	const type = buf.readInt16BE(off + 4);
	const dataOff = off + 6;
	if (type !== 0) {
		// Synth/hybrid instruments carry a wavetable program instead of PCM.
		return { length, type, synth: true, data: null };
	}
	const end = Math.min(buf.length, dataOff + length);
	return {
		length, type, synth: false,
		data: new Int8Array(buf.buffer, buf.byteOffset + dataOff, Math.max(0, end - dataOff)),
	};
}

function parseMED(buf) {
	const header = parseHeader(buf);
	const song = parseSong(buf, header.songOffset);

	const blocks = [];
	for (let i = 0; i < song.numBlocks; i++) {
		const ptr = buf.readUInt32BE(header.blockArrOffset + i * 4);
		blocks.push(ptr ? parseBlock(buf, ptr) : null);
	}

	const samples = [];
	if (header.sampleArrOffset) {
		for (let i = 0; i < song.numSamples; i++) {
			const ptr = buf.readUInt32BE(header.sampleArrOffset + i * 4);
			samples.push(ptr ? parseSample(buf, ptr) : null);
		}
	}

	return { header, song, blocks, samples };
}

module.exports = { parseMED, parseHeader, parseSong, parseBlock, parseSample };
