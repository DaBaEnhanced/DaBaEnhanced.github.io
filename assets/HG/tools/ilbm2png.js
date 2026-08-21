'use strict';
// Dump an ILBM to PNG for visual inspection.
//   node ilbm2png.js <in.ilbm> <out.png> [--transparent=<index>|--opaque]
const fs = require('fs');
const path = require('path');
const { decodeILBM } = require('./lib/iff');
const { encodePNG, indexedToRGBA } = require('./lib/png');

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
	console.error('usage: node ilbm2png.js <in.ilbm> <out.png> [--transparent=N|--opaque]');
	process.exit(1);
}
let transparent = 0;
for (const arg of process.argv.slice(4)) {
	if (arg === '--opaque') transparent = -1;
	else if (arg.startsWith('--transparent=')) transparent = Number(arg.split('=')[1]);
}

const img = decodeILBM(fs.readFileSync(inFile));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, encodePNG(img.width, img.height, indexedToRGBA(img.pixels, img.palette, transparent)));
console.log(`${path.basename(inFile)} -> ${outFile}  ${img.width}x${img.height} planes=${img.nPlanes}`);
