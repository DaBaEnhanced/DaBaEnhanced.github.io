// The health-bar damage flash: its palette must not collide, and its art must
// line up with the 2px bar it straddles.
//
// Both of these have been wrong at some point -- the message band was parked on
// the flash's palette entries and turned it blue, and the sprite was drawn from
// the pane origin so the burst sagged two pixels below the bar.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${a}, want ${b})`);

const fx = JSON.parse(fs.readFileSync(path.join(A, 'fire-effects.json'), 'utf8'));
const atlas = new Uint8Array(fs.readFileSync(path.join(A, fx.atlas.file)));
const AW = fx.atlas.width;
const ink = (r, x, y) => atlas[(r.ay + y) * AW + r.ax + x] !== 0;

const f0 = fx.sprites.fitness_0, f1 = fx.sprites.fitness_1;
ok(f0 && f1, 'both flash sprites exist');
eq(f0.h, 17, 'the burst is 17 rows tall');

// --- the gap that the bar shows through --------------------------------------
{
	const rowInk = (r) => {
		const out = [];
		for (let y = 0; y < r.h; y++) {
			let n = 0;
			for (let x = 0; x < r.w; x++) if (ink(r, x, y)) n++;
			out.push(n);
		}
		return out;
	};
	for (const [name, r] of [['fitness_0', f0], ['fitness_1', f1]]) {
		const rows = rowInk(r);
		const blank = rows.map((n, i) => (n === 0 ? i : -1)).filter((i) => i >= 0);
		eq(blank.join(','), '7,8', `${name} is blank exactly at rows 7-8`);
	}
	// main.js offsets the sprite by FLASH_BAR_ROW so those rows land on the bar.
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	const m = src.match(/const FLASH_BAR_ROW = (\d+);/);
	ok(m, 'FLASH_BAR_ROW is defined');
	eq(Number(m[1]), 7, 'and matches where the blank rows start');
	ok(/flashY = oy \+ Math\.floor\(FITNESS_BAR_OFFSET \/ 40\) - FLASH_BAR_ROW/.test(src),
		'the flash is placed relative to the bar, not the pane origin');
}

// --- the two halves tile, they do not overlap --------------------------------
{
	const colSpan = (r) => {
		let lo = -1, hi = -1;
		for (let x = 0; x < r.w; x++) {
			let any = false;
			for (let y = 0; y < r.h; y++) if (ink(r, x, y)) { any = true; break; }
			if (any) { if (lo < 0) lo = x; hi = x; }
		}
		return [lo, hi];
	};
	const a = colSpan(f0), b = colSpan(f1);
	eq(a.join('-'), '0-15', 'fitness_0 is the left half');
	eq(b.join('-'), '16-31', 'fitness_1 is the right half');
	ok(a[1] < b[0], 'so drawing both at the same x tiles a 32px burst');
}

// --- nothing may share the flash's palette entries ---------------------------
{
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	const band = Number(src.match(/const BAND_PAL_BASE = (\d+);/)[1]);
	const bandLen = (src.match(/const BAND_COLOURS = \[([\s\S]*?)\n\];/)[1]
		.match(/\[0x/g) || []).length;
	const base = fx.palettes.fitness.base;
	const len = fx.palettes.fitness.colours.length;
	eq(base, 208, 'the flash palette is where fire-effects.json says');
	ok(bandLen > 0, `the message band declares ${bandLen} colours`);
	ok(band >= base + len || band + bandLen <= base,
		`the message band at ${band}-${band + bandLen - 1} clears the flash at ${base}-${base + len - 1}`);

	// And it must clear everything else that owns palette space. The field's
	// range is read out of view.js rather than copied, because copying it is
	// how it got clobbered: the band was moved to 224 without anyone noticing
	// FIELD_COLOUR_BASE was already there.
	const view = fs.readFileSync(path.join(__dirname, '..', 'src', 'view.js'), 'utf8');
	const num = (name, src = view) => {
		const m = src.match(new RegExp(`${name} = (\\d+)`));
		if (!m) throw new Error(`${name} not found in view.js`);
		return Number(m[1]);
	};
	const claimed = [
		['sky gradient', num('SKY_GRADIENT_BASE'), num('SKY_GRADIENT_ROWS')],
		['muzzle', 108, 16],
		['hit flash', fx.palettes.hit.base, fx.palettes.hit.colours.length],
		['planet', num('PLANET_GRADIENT_BASE'), num('PLANET_H')],
		['horizon', num('HORIZON_FAR_BASE'), num('HORIZON_H')],
		['field cycle', num('FIELD_COLOUR_BASE'), num('FIELD_COLOUR_ROWS')],
	];
	for (const [who, at, n] of claimed) {
		ok(band >= at + n || band + bandLen <= at,
			`the band clears ${who} at ${at}-${at + n - 1}`);
	}
	ok(band + bandLen <= 256, 'and stays inside the palette');

	// The flash's own colours must actually be white-ish, or the fix is cosmetic.
	const white = fx.palettes.fitness.colours.every((c) => c[0] > 200 && c[1] > 200);
	ok(white, 'the flash palette is white, as the damage flash should be');
}

console.log(`hud flash: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
