// Briefing art, and the world map's hover readout.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const meta = JSON.parse(fs.readFileSync(path.join(A, 'briefings.json'), 'utf8'));

// --- every picture a location asks for exists --------------------------------
{
	const maps = path.join(A, 'maps');
	const wanted = new Set();
	let withPicture = 0, without = 0;
	for (const f of fs.readdirSync(maps)) {
		if (!f.endsWith('.json') || /^campaign|^maps\.json/.test(f)) continue;
		const j = JSON.parse(fs.readFileSync(path.join(maps, f), 'utf8'));
		const n = j.locn?.pictureNum | 0;
		if (n) { wanted.add(n); withPicture++; } else without++;
	}
	// 14 maps, 13 pictures: 04-Laboratory and 22-Stopover both use picture 13.
	eq(withPicture, 14, `14 campaign locations name a picture (${withPicture})`);
	ok(without > 20, `and the action and training maps name none (${without})`);
	eq(wanted.size, 13, `13 distinct pictures are used (${wanted.size})`);
	const missing = [...wanted].filter((n) => !meta.pictures[n]).sort((a, b) => a - b);
	eq(missing.length, 0, `every picture used has art (missing: ${missing.join(',') || 'none'})`);
	// 6 is absent from Graphics/Static and nothing asks for it.
	ok(!wanted.has(6), 'nothing asks for picture 6, which has no art');
}

// --- the art decoded, rather than producing noise ----------------------------
{
	for (const [num, info] of Object.entries(meta.pictures)) {
		const p = path.join(A, info.file);
		ok(fs.existsSync(p), `picture ${num} was written`);
		const b = fs.readFileSync(p);
		eq(b.readUInt32BE(16), info.width, `picture ${num} png width matches`);
		eq(b.readUInt32BE(20), info.height, `picture ${num} png height matches`);
		ok(info.width >= 128 && info.width <= 320, `picture ${num} width is plausible`);
		ok(info.height >= 128 && info.height <= 420, `picture ${num} height is plausible`);
	}
	// These are portrait photographs; a landscape one would mean the BMHD was
	// read the wrong way round.
	const portrait = Object.values(meta.pictures).every((p) => p.height > p.width);
	ok(portrait, 'every briefing picture is portrait, as the source art is');
}

// --- the decode is not noise -------------------------------------------------
//
// A wrong plane layout produces confetti: almost every pixel a different colour.
// A photograph reuses colours heavily, so a modest distinct-colour ratio is the
// signal that the interleave and bit order were right.
{
	const zlib = await import('zlib');
	const readPNG = (file) => {
		const b = fs.readFileSync(file);
		const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
		let o = 8, idat = [];
		while (o < b.length - 8) {
			const len = b.readUInt32BE(o);
			const id = b.toString('ascii', o + 4, o + 8);
			if (id === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len));
			o += 12 + len;
		}
		return { w, h, raw: zlib.inflateSync(Buffer.concat(idat)) };
	};
	for (const num of ['9', '4']) {
		const { w, h, raw } = readPNG(path.join(A, meta.pictures[num].file));
		const stride = w * 4 + 1;
		const seen = new Set();
		let sampled = 0;
		for (let y = 0; y < h; y += 3) {
			for (let x = 0; x < w; x += 3) {
				const o = y * stride + 1 + x * 4;
				seen.add((raw[o] << 16) | (raw[o + 1] << 8) | raw[o + 2]);
				sampled++;
			}
		}
		const ratio = seen.size / sampled;
		ok(ratio < 0.75, `picture ${num} reuses colours like a photograph (${ratio.toFixed(2)} distinct)`);
		ok(seen.size > 200, `picture ${num} is not flat (${seen.size} colours)`);
	}
}

// --- the world map hover -----------------------------------------------------
{
	const shell = await import('../src/shell.js');
	for (const fn of ['pickWorldLocation', 'pickWorldMarker', 'hoverWorld',
		'clearWorldHover', 'displayedLocation', 'markedLocations', 'hoverIsReachable']) {
		ok(typeof shell[fn] === 'function', `${fn} is exported`);
	}
	const s = shell.createShell();
	eq(s.hoverKey, null, 'a new shell has no hover');

	// Off the map, and in the wrong mode, resolve to nothing.
	s.mode = shell.SHELL.WORLD;
	s.list = [];
	s.reachable = [];
	eq(shell.pickWorldMarker(s, 100, 100), null, 'nothing to hover with no markers');
	s.mode = shell.SHELL.FRONT;
	eq(shell.pickWorldMarker(s, 100, 100), null, 'and nothing outside the world map');

	// Hovering reads ANY marker; only reachable ones can be entered.
	s.mode = shell.SHELL.WORLD;
	s.list = [{ key: 'a', typeFlag: 0 }, { key: 'b', typeFlag: 0 }];
	s.reachable = [{ key: 'a' }];
	s.cursor = 0;

	s.hoverKey = null;
	eq(shell.displayedLocation(s)?.key, 'a', 'with no pointer the cursor is described');
	s.hoverKey = 'b';
	eq(shell.displayedLocation(s)?.key, 'b', 'an unreachable marker still describes itself');
	eq(shell.hoverIsReachable(s), false, 'and is reported as unreachable');
	eq(shell.currentLocation(s)?.key, 'a', 'while launching still uses the cursor');
	s.hoverKey = 'a';
	eq(shell.hoverIsReachable(s), true, 'a reachable marker is reported as such');

	// Over empty map: nothing at all, rather than the last answer.
	s.hoverKey = '';
	eq(shell.displayedLocation(s), null, 'empty map describes nothing');
	eq(shell.currentLocation(s)?.key, 'a', 'and the cursor is untouched by it');

	ok(shell.clearWorldHover(s), 'clearing reports the change');
	ok(!shell.clearWorldHover(s), 'and is a no-op the second time');
	eq(shell.displayedLocation(s)?.key, 'a', 'leaving the map describes the cursor again');

	// The marker set is the one the map actually draws.
	s.list = [
		{ key: 'campaign', typeFlag: 0 },
		{ key: 'action', typeFlag: 1 },
	];
	const marked = shell.markedLocations(s).map((l) => l.key);
	ok(marked.includes('campaign'), 'campaign locations are hoverable');
	ok(!marked.includes('action'), 'action locations are not drawn, so not hoverable');

	// Keyboard navigation takes the highlight back from the pointer.
	s.hoverKey = 'campaign';
	shell.moveCursor(s, 1, 2);
	eq(s.hoverKey, null, 'keyboard navigation clears the hover');
}

// --- the world panel lines up with its own art -------------------------------
//
// Panel.ilbm is two identical 21-row slots sharing a middle row, each with a
// 17-row band. Text belongs centred in those bands; it used to be placed by
// hand-picked row numbers and sat below both, with the second line running off
// its band and the hint line off the art entirely.
{
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'shell.js'), 'utf8');
	const num = (name) => {
		const m = src.match(new RegExp(`${name} = (\\d+)`));
		if (!m) throw new Error(`${name} not found in shell.js`);
		return Number(m[1]);
	};

	const ART_H = num('WORLD_PANEL_ART_H');
	const FONT = num('WORLD_FONT_ROWS');
	eq(ART_H, 41, 'the panel art is 41 rows');
	eq(FONT, 8, 'worldfont is 8 rows tall');

	// Recompute what shell.js computes, and check it against the art.
	const bands = [{ top: 2, bottom: 18 }, { top: 22, bottom: 38 }];
	const bandRow = (i) => Math.round((bands[i].top + bands[i].bottom + 1 - FONT) / 2);
	for (let i = 0; i < bands.length; i++) {
		const top = bandRow(i), bottom = top + FONT - 1;
		ok(top >= bands[i].top, `line ${i} starts inside band ${i} (${top} >= ${bands[i].top})`);
		ok(bottom <= bands[i].bottom, `line ${i} ends inside band ${i} (${bottom} <= ${bands[i].bottom})`);
		// Centred, not merely contained.
		const slack = (bands[i].bottom - bands[i].top + 1) - FONT;
		ok(Math.abs((top - bands[i].top) - Math.floor(slack / 2)) <= 1,
			`line ${i} is centred in its band`);
	}
	ok(src.includes('panelBandRow(0)') && src.includes('panelBandRow(1)'),
		'both lines are placed from the bands rather than by hand');

	// The hint has no band, so it must clear the art without falling off screen.
	const HINT = ART_H + 4;
	ok(HINT >= ART_H, 'the hint line clears the panel art');
	const panelH = (HINT + FONT + 2) * 2;
	const panelY = 512 - panelH;
	ok(panelY + (HINT + FONT) * 2 <= 512, 'and still fits on screen');

	// The map takes the space the panel is not using.
	const viewH = panelY - num('WORLD_VIEW_GAP');
	ok(viewH > 308, `the map view is taller than it was (${viewH} > 308)`);
	eq(panelY + panelH, 512, 'and the panel reaches the bottom, leaving no dead band');
	ok(viewH / 2 <= 384, 'without sampling past the bottom of the world image');
}

console.log(`briefings: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
