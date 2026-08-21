'use strict';
// Quick ground-truth inspector: decode an ILBM and report structure + palette +
// which colour indices are actually used, so we can confirm the 4-plane/mask
// assumption the ilbm2raw scripts imply.

const fs = require('fs');
const { decodeILBM } = require('./lib/iff');

const file = process.argv[2];
const img = decodeILBM(fs.readFileSync(file));

console.log(`${file}`);
console.log(`  ${img.width}x${img.height} planes=${img.nPlanes} masking=${img.masking} transparent=${img.transparent}`);
console.log(`  palette entries: ${img.palette ? img.palette.length / 3 : 0}`);

const used = new Set();
for (let i = 0; i < img.pixels.length; i++) used.add(img.pixels[i]);
const sorted = [...used].sort((a, b) => a - b);
console.log(`  colour indices used: ${sorted.length} -> [${sorted.join(',')}]`);

if (img.palette) {
	const n = img.palette.length / 3;
	const rows = [];
	for (let i = 0; i < n; i++) {
		const r = img.palette[i * 3], g = img.palette[i * 3 + 1], b = img.palette[i * 3 + 2];
		rows.push(`${String(i).padStart(2)}:${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
	}
	for (let i = 0; i < rows.length; i += 8) console.log('   ' + rows.slice(i, i + 8).join(' '));
}

// Histogram of the top-left 32x25 region (first rect in Stone.s is 80,0,32,25).
if (process.argv[3]) {
	const [x, y, w, h] = process.argv[3].split(',').map(Number);
	const counts = new Map();
	for (let row = 0; row < h; row++)
		for (let col = 0; col < w; col++) {
			const v = img.pixels[(y + row) * img.width + (x + col)];
			counts.set(v, (counts.get(v) || 0) + 1);
		}
	console.log(`  rect ${x},${y},${w},${h} histogram:`,
		[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}x${v}`).join(' '));
}
