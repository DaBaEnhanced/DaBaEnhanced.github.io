'use strict';
// Minimal RIFF/WAVE writer. 8-bit WAV is unsigned, so signed Amiga samples are
// biased by 128 on the way out.

function encodeWAV8(samples, sampleRate) {
	const dataLen = samples.length;
	const buf = Buffer.alloc(44 + dataLen + (dataLen & 1));
	buf.write('RIFF', 0, 'ascii');
	buf.writeUInt32LE(36 + dataLen, 4);
	buf.write('WAVE', 8, 'ascii');
	buf.write('fmt ', 12, 'ascii');
	buf.writeUInt32LE(16, 16);       // fmt chunk size
	buf.writeUInt16LE(1, 20);        // PCM
	buf.writeUInt16LE(1, 22);        // mono
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate, 28); // byte rate (1 byte/sample, mono)
	buf.writeUInt16LE(1, 32);        // block align
	buf.writeUInt16LE(8, 34);        // bits per sample
	buf.write('data', 36, 'ascii');
	buf.writeUInt32LE(dataLen, 40);
	for (let i = 0; i < dataLen; i++) buf[44 + i] = (samples[i] + 128) & 0xff;
	return buf;
}

module.exports = { encodeWAV8 };
