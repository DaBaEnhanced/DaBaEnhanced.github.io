// The claw overlay's colour, and the one place this port deliberately does not
// match the sources.
//
// Both claw bobs declare plane 5 as "no draw", so the blit leaves the lit bit
// of whatever is behind them alone and the resulting index is (under & 32) | 9.
// That is colour 9 -- pure red -- over an unlit wall and colour 41 -- #ff9f5a --
// over a lit one, so the scratches came out half red and half orange depending
// on which way the player happened to be facing.
//
// Treated as a bug in the unfinished CD32 build rather than an effect, and
// zeroed. This file exists so that nobody later re-derives the mask from the
// assembly, finds 32, and quietly puts the two-tone claw back.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
const G = path.join(__dirname, '..', '..', 'Graphics', 'Misc', 'Ass');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const miscUi = JSON.parse(fs.readFileSync(path.join(A, 'misc-ui.json'), 'utf8'));
const pal = JSON.parse(fs.readFileSync(path.join(A, 'palette.json'), 'utf8'));

/**
 * The six bob_plane bytes: 0=no draw, 1=copy, 2=clear, 3=set. They sit after
 * the image pointer, width, height, mask-plane word and the two flag bytes.
 */
function planeOps(file) {
	const text = fs.readFileSync(path.join(G, file), 'utf8');
	const at = text.indexOf('0=no draw');
	const after = text.slice(text.lastIndexOf('dc.b', at));
	return [...after.matchAll(/dc\.b\s+(\d)/g)].slice(0, 6).map((m) => Number(m[1]));
}

// --- what the sources actually say ---------------------------------------------
//
// Measured, not assumed: the divergence is only worth having if plane 5 really
// is left alone, and this is where that is established.
for (const [name, file] of [['Claw', 'Claw.s'], ['BigClaw', 'BigClaw.s']]) {
	const ops = planeOps(file);
	eq(ops.length, 6, `${name} declares six plane ops`);
	eq(ops[5], 0, `${name} leaves plane 5 alone, which is the lit bit`);
	// And the rest are what produces colour 9: planes 0 and 3 set, 1, 2, 4 clear.
	eq(ops.slice(0, 5).join(','), '3,2,2,3,2', `${name} sets planes 0 and 3, clears the rest`);
}

// --- the two colours that used to appear ---------------------------------------
{
	const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
	eq(hex(pal.colours[9]), '#ff0000', 'colour 9 is the red the claws are meant to be');
	// 41 is 9 in the lit bank, and it is nowhere near red.
	eq(9 + pal.litBase, 41, 'the lit bank puts colour 9 at 41');
	const lit = pal.colours[41];
	ok(lit[1] > 120 && lit[2] > 60,
		`and colour 41 is ${hex(lit)}, the orange that showed over lit walls`);
}

// --- so the port zeroes the mask ------------------------------------------------
{
	for (const key of ['claws', 'bigclaws']) {
		const s = miscUi.sprites[key];
		ok(s, `${key} is in the atlas`);
		eq(s.mode, 'planeOp', `${key} is still a plane op`);
		eq(s.keep, 0, `${key} keeps nothing, so the lit bit cannot leak in`);
		eq(s.set, 9, `${key} sets colour 9`);
	}
	// (under & 0) | 9 is 9 whatever is underneath. That is the whole fix.
	for (const under of [0, 9, 32, 41, 63]) {
		eq((under & miscUi.sprites.bigclaws.keep) | miscUi.sprites.bigclaws.set, 9,
			`a claw over index ${under} draws colour 9`);
	}

	// The build tool is where the value lives, and the fallback in main.js has
	// to agree or a sprite without a mask of its own would still go two-tone.
	const build = fs.readFileSync(path.join(__dirname, 'build-misc-ui.js'), 'utf8');
	ok(/DELIBERATE DIVERGENCE/.test(build), 'the build tool says it is deliberate');
	ok(/'claws'[\s\S]{0,140}keep: 0/.test(build), 'and carries it for claws');
	ok(/'bigclaws'[\s\S]{0,140}keep: 0/.test(build), 'and bigclaws');
	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	eq(Number(main.match(/const CLAW_PLANE_KEEP = (\d+);/)?.[1]), 0,
		'the fallback in main.js agrees');
}

// --- and only the claws ---------------------------------------------------------
//
// Rip and Exit are a different overlay on the death pane, which is not lit two
// ways. They keep the masks the sources give them.
{
	for (const key of ['rip', 'exit']) {
		eq(miscUi.sprites[key]?.keep, 42, `${key} keeps its own mask`);
		eq(miscUi.sprites[key]?.set, 21, `${key} keeps its own set`);
	}
}

console.log(`claw colour: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
