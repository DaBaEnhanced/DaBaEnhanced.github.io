'use strict';
// Survey every .bin block graphic and report whether it follows the 67-slot
// bob-table layout, so the builder knows which files it can decode.
const fs = require('fs');
const path = require('path');
const { parseBobFile, HEADER_SIZE } = require('./lib/bob');

const REPO = path.resolve(__dirname, '..', '..');

function survey(file) {
	const buf = fs.readFileSync(file);
	if (buf.length < HEADER_SIZE) return { ok: false, why: `too small (${buf.length})`, size: buf.length };
	const { slots, numPlanes, maskPlane } = parseBobFile(buf);
	let nonEmpty = 0, bad = 0, maxW = 0, maxH = 0, maxEnd = 0;
	for (const s of slots) {
		if (s.width === 0 && s.height === 0) continue;
		nonEmpty++;
		maxW = Math.max(maxW, s.width);
		maxH = Math.max(maxH, s.height);
		const rowBytes = ((s.width + 15) >> 4) * 2;
		const end = s.dataOffset + rowBytes * numPlanes * s.height;
		maxEnd = Math.max(maxEnd, end);
		if (s.width > 512 || s.height > 512 || s.dataOffset < HEADER_SIZE || end > buf.length) bad++;
	}
	return {
		ok: bad === 0 && nonEmpty > 0,
		why: bad ? `${bad}/${nonEmpty} slots out of range` : nonEmpty === 0 ? 'no slots' : '',
		nonEmpty, maxW, maxH, maskPlane, numPlanes, size: buf.length, maxEnd,
	};
}

const dirs = [];
for (const s of [1, 2, 3, 4, 5]) dirs.push(path.join(REPO, 'Graphics', `Style${s}`, 'Raw'));
dirs.push(path.join(REPO, 'Graphics', 'Misc', 'Raw'));

let okCount = 0, badCount = 0;
for (const dir of dirs) {
	if (!fs.existsSync(dir)) continue;
	console.log(`--- ${path.relative(REPO, dir)}`);
	for (const f of fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.bin'))) {
		const r = survey(path.join(dir, f));
		if (r.ok) { okCount++; continue; }
		badCount++;
		console.log(`  BAD  ${f.padEnd(22)} ${r.why}  (size=${r.size} planes=${r.numPlanes} mask=${r.maskPlane} max=${r.maxW}x${r.maxH})`);
	}
}
console.log(`\n${okCount} files follow the 67-slot layout, ${badCount} do not.`);
