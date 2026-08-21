'use strict';
// Decisive check on the .bin decoder: the rect list in Graphics/*/Ass/<name>.s
// maps 1:1, in order, onto the non-empty slots of the matching .bin. So each
// decoded slot must equal the corresponding crop of the source ILBM.
//
// Also tests the vertically- and horizontally-flipped variants, so a row-order
// or mirror bug is named rather than guessed at.

const fs = require('fs');
const path = require('path');
const { decodeILBM } = require('./lib/iff');
const { parseBobFile, decodeSlotImage } = require('./lib/bob');

const REPO = path.resolve(__dirname, '..', '..');

/** Pull `-b4cmf<x>,<y>,<w>,<h>` / `-mb4cf...` rects out of an ilbm2raw script. */
function readRects(scriptFile) {
	const text = fs.readFileSync(scriptFile, 'latin1');
	const rects = [];
	for (const m of text.matchAll(/-m?b4cm?f(\d+),(\d+),(\d+),(\d+)/g)) {
		rects.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
	}
	return rects;
}

function compare(binFile, ilbmFile, scriptFile) {
	const rects = readRects(scriptFile);
	if (!rects.length) return null;

	const img = decodeILBM(fs.readFileSync(ilbmFile));
	const buf = fs.readFileSync(binFile);
	const { slots, numPlanes, maskPlane } = parseBobFile(buf);
	const used = slots.filter((s) => s.width && s.height);

	const stats = { rects: rects.length, slots: used.length, exact: 0, vflip: 0, hflip: 0, other: 0 };
	if (rects.length !== used.length) stats.countMismatch = true;

	const n = Math.min(rects.length, used.length);
	for (let i = 0; i < n; i++) {
		const r = rects[i];
		const slot = used[i];
		if (slot.width !== r.w || slot.height !== r.h) { stats.other++; continue; }
		const dec = decodeSlotImage(buf, slot, numPlanes, maskPlane);

		let exact = 0, vflip = 0, hflip = 0;
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				const ref = img.pixels[(r.y + y) * img.width + (r.x + x)];
				// Only compare where the source is non-transparent; the mask plane
				// legitimately zeroes other pixels.
				if (dec.pixels[y * r.w + x] === ref) exact++;
				if (dec.pixels[(r.h - 1 - y) * r.w + x] === ref) vflip++;
				if (dec.pixels[y * r.w + (r.w - 1 - x)] === ref) hflip++;
			}
		}
		const total = r.w * r.h;
		const best = Math.max(exact, vflip, hflip);
		if (exact === total) stats.exact++;
		else if (vflip === total) stats.vflip++;
		else if (hflip === total) stats.hflip++;
		else {
			stats.other++;
			if (!stats.firstBad) {
				stats.firstBad = `slot ${i} ${r.w}x${r.h}: exact ${(exact / total * 100).toFixed(1)}% ` +
					`vflip ${(vflip / total * 100).toFixed(1)}% hflip ${(hflip / total * 100).toFixed(1)}%`;
			}
		}
	}
	return stats;
}

// Every style graphic whose script carries an explicit rect list.
const targets = [];
for (const s of [1, 2, 3, 4, 5]) {
	const assDir = path.join(REPO, 'Graphics', `Style${s}`, 'Ass');
	if (!fs.existsSync(assDir)) continue;
	for (const f of fs.readdirSync(assDir)) {
		if (!f.endsWith('.s')) continue;
		const script = path.join(assDir, f);
		const base = f.replace(/\.s$/, '');
		const bin = path.join(REPO, 'Graphics', `Style${s}`, 'Raw', `${base}.bin`);
		if (!fs.existsSync(bin)) continue;
		// The script names its source ILBM in a copy line.
		const text = fs.readFileSync(script, 'latin1');
		const m = text.match(/([\w/\\:.]+\.ilbm)/i);
		if (!m) continue;
		const ilbmName = path.basename(m[1]);
		const ilbm = path.join(REPO, 'Graphics', `Style${s}`, 'ILBM', ilbmName);
		if (!fs.existsSync(ilbm)) continue;
		targets.push({ label: `Style${s}/${base}`, bin, ilbm, script });
	}
}

let totals = { exact: 0, vflip: 0, hflip: 0, other: 0 };
for (const t of targets) {
	const r = compare(t.bin, t.ilbm, t.script);
	if (!r) continue;
	for (const k of ['exact', 'vflip', 'hflip', 'other']) totals[k] += r[k];
	const flag = r.countMismatch ? `  (rects ${r.rects} vs slots ${r.slots})` : '';
	console.log(`${t.label.padEnd(22)} exact=${String(r.exact).padStart(3)} ` +
		`vflip=${String(r.vflip).padStart(3)} hflip=${String(r.hflip).padStart(3)} ` +
		`other=${String(r.other).padStart(3)}${flag}`);
	if (r.firstBad) console.log(`    ${r.firstBad}`);
}
console.log(`\nTOTAL  exact=${totals.exact} vflip=${totals.vflip} hflip=${totals.hflip} other=${totals.other}`);
