'use strict';
// Dump the 67-slot table of a .bin block graphic, to verify the layout.
const fs = require('fs');
const { parseBobFile, HEADER_SIZE, NUM_SLOTS } = require('./lib/bob');

const file = process.argv[2];
const buf = fs.readFileSync(file);
const { slots } = parseBobFile(buf);

console.log(`${file}  size=${buf.length}  header=${HEADER_SIZE}  imageData=${buf.length - HEADER_SIZE}`);

const groups = [[0, 21, 'above/below'], [21, 46, 'same level'], [46, NUM_SLOTS, 'other level']];
for (const [from, to, label] of groups) {
	console.log(`--- slots ${from}..${to - 1}  (${label})`);
	for (let i = from; i < to; i++) {
		const s = slots[i];
		console.log(
			`  ${String(i).padStart(2)}  ${String(s.width).padStart(3)}x${String(s.height).padStart(3)}` +
			`  at ${String(s.x).padStart(3)},${String(s.y).padStart(3)}` +
			`  ctrl=${s.control}  data=${s.dataOffset}`
		);
	}
}

// Sanity: do the data offsets ascend and stay in range?
let bad = 0;
for (const s of slots) {
	if (s.width === 0) continue;
	const rowBytes = ((s.width + 15) >> 4) * 2;
	const need = s.dataOffset + rowBytes * 5 * s.height;
	if (s.dataOffset < HEADER_SIZE || need > buf.length) {
		console.log(`  !! slot ${s.index} out of range: needs ${need}, file is ${buf.length}`);
		bad++;
	}
}
console.log(bad === 0 ? 'all slot data offsets in range' : `${bad} slots out of range`);
