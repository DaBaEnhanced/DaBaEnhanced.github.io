// The bevel on a high-tier monster.
//
// A monster definition carries mdfn_outline (Equates.i:776). MonsterMovement.s
// :1006 turns it into the m_outlined variant bit, and activate_planes
// (Drawviews.s:3601) answers with redraw_temp %0001000000111111 / redraw_solid 6.
//
// The port read that as "the hit flash, but colour 6" and filled the whole
// silhouette, which made the psi skeletons in the cave system flat blue
// cut-outs. It is not the same flag. Bit 10 is "force set planes"; bit 12 is
// "outline", and blit_bob (Miscroutines.s:100) handles it by drawing the bob
// TWICE -- a solid colour-6 silhouette one pixel up, then the sprite normally
// on top. All that survives is a one-pixel rim along the upper edge.
//
// The same reading fixes a second thing. The solid pass swaps solid_table in
// for bob_plane, and the plane-5 control carrying the CD32 lighting lives in
// bob_plane -- so it never runs, and DEF_PLANE walks the colour's own bits into
// all six planes. A solid fill is an absolute palette index. The port was
// adding the lit bank to it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IndexCompositor } from '../src/compositor.js';
import { LIGHT_OFFSET, OUTLINE_RISE } from '../src/view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'Sources');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const draw = fs.readFileSync(path.join(SRC, 'Drawviews.s'), 'utf8');
const misc = fs.readFileSync(path.join(SRC, 'Miscroutines.s'), 'utf8');
const mm = fs.readFileSync(path.join(SRC, 'MonsterMovement.s'), 'utf8');
const eqs = fs.readFileSync(path.join(SRC, 'Equates.i'), 'utf8');

// --- the flag, from the definition to the blit -------------------------------------
{
	ok(/mdfn_outline\s+rs\.b\s+1/.test(eqs), 'a monster definition carries an outline byte');
	ok(/m_outlined\s+equ\s+variant_shift\+1/.test(eqs), 'which becomes variant bit 1');
	ok(/tst\.b\s+mdfn_outline\(a2\)[\s\S]{0,60}bset\.l\s+#m_outlined,d0/.test(mm),
		'MonsterMovement stamps it into the cell word');

	// activate_planes: the two cases, and they are NOT the same bit.
	const flash = draw.match(/btst\.l\s+#m_flashed,d1[\s\S]{0,200}?rts/)[0];
	ok(/move\.w\s+#%0000010000111111,variables\+redraw_temp/.test(flash),
		'm_flashed asks for redraw_temp %0000010000111111');
	ok(/move\.w\s+#1,variables\+redraw_solid/.test(flash), 'with solid colour 1');

	const out = draw.match(/btst\.l\s+#m_outlined,d1[\s\S]{0,200}?rts/)[0];
	const mask = out.match(/move\.w\s+#%(\d{16}),variables\+redraw_temp/)[1];
	eq(mask, '0001000000111111', 'm_outlined asks for a different mask');
	ok(/move\.w\s+#6,variables\+redraw_solid/.test(out), 'with colour 6');

	// Which bit each mask actually sets, counted rather than eyeballed.
	const bitsOf = (s) => [...s].reverse().map((c, i) => (c === '1' ? i : -1)).filter((i) => i >= 0);
	eq(bitsOf('0000010000111111').join(','), '0,1,2,3,4,5,10', 'the flash sets bit 10');
	eq(bitsOf(mask).join(','), '0,1,2,3,4,5,12', 'the outline sets bit 12');

	// And the header says what those two bits mean.
	ok(/bit 10\s+= force set planes/.test(misc), 'bit 10 is force-set-planes');
	ok(/bit 12\s+= outline/.test(misc), 'bit 12 is outline');
}

// --- blit_bob draws an outlined bob twice ---------------------------------------------
{
	const blit = misc.slice(misc.search(/^blit_bob/m));
	// To the LABEL, not the beq that targets it four lines earlier.
	const head = blit.slice(0, blit.search(/^\.no_outline/m));
	ok(/btst\.l\s+#12,d6/.test(head), 'blit_bob tests bit 12 first');
	ok(/move\.b\s+#6,d4/.test(head), 'forces the solid colour to 6');
	ok(/bset\.l\s+#10,d6/.test(head), 'turns the solid flag on for the first pass');
	ok(/subi\.w\s+#1,d7[\s\S]{0,40}bsr\s+\.do_blit/.test(head),
		'draws it one pixel UP');
	ok(/bclr\.l\s+#10,d6[\s\S]{0,60}addi\.w\s+#1,d7[\s\S]{0,40}bsr\s+\.do_blit/.test(head),
		'then drops the flag, restores y, and draws the bob normally');
	// Counted with the comments stripped: sitting just below the live code is a
	// commented-out block with two more .do_blit calls, an abandoned four-way
	// outline. What shipped is the single upward pass.
	const live = head.split(String.fromCharCode(10))
		.filter((l) => !/^\s*;/.test(l)).join(String.fromCharCode(10));
	eq((live.match(/bsr\s+\.do_blit/g) || []).length, 2, 'two passes, not one');
	ok(/;\s*subi\.w\s+#1,d5/.test(head), 'the four-way version is present but commented out');
	// The port's rise has to be that one pixel.
	eq(OUTLINE_RISE, 1, 'and the port rises by the same one pixel');

	// cpu_bob, the other half of draw_bob, knows nothing about bit 12 -- which is
	// fine, because monsters are copied into chip memory and take the blitter path.
	const cpu = misc.slice(misc.search(/^cpu_bob/m), misc.search(/^cpu_bob/m) + 600);
	ok(!/btst\.l\s+#12,d6/.test(cpu), 'cpu_bob ignores the outline flag');
	ok(/btst\.l\s+#10,d6/.test(cpu), 'though it does handle the solid one');
}

// --- a solid fill is an absolute index --------------------------------------------------
{
	// Lighting rides on plane 5 of bob_plane...
	ok(/move\.b\s+#2,bob_plane\+5\(a0\)/.test(draw), 'the lit control is written into bob_plane+5');
	// ...and the solid path replaces bob_plane with a table built from the colour.
	const loop = misc.slice(misc.indexOf('move.b\tblit_outline(a1),d0'));
	ok(/btst\.l\s+#10,d6[\s\S]{0,120}lea\s+solid_table\(pc\),a1/.test(loop),
		'the solid path swaps solid_table in for bob_plane');
	ok(/asr\.b\s+#1,d0/.test(misc), 'DEF_PLANE walks the colour bits out one at a time');
	// Colour 6 is %000110, so planes 4 and 5 are cleared: no water, no light.
	eq((6 >> 4) & 1, 0, 'colour 6 leaves plane 4 clear');
	eq((6 >> 5) & 1, 0, 'and plane 5, so a solid fill is never bank-shifted');
}

// --- which monsters wear it -----------------------------------------------------------
{
	const list = JSON.parse(fs.readFileSync(
		path.join(__dirname, '..', 'assets', 'monsters.json'), 'utf8')).monsters;
	const outlined = list.map((m, i) => ({ i, ...m })).filter((m) => m.outline);
	eq(outlined.length, 17, 'seventeen definitions are outlined');

	// 02-CaveSystem, where this was reported: graphic 3 and graphic 4.
	const cave = JSON.parse(fs.readFileSync(
		path.join(__dirname, '..', 'assets', 'maps', '02-CaveSystem.json'), 'utf8'));
	eq(cave.locn.mons1, 3, 'the cave system\'s first monster is graphic 3');
	eq(cave.locn.mons2, 4, 'and its second is graphic 4');

	const skeletons = list.map((m, i) => ({ i, ...m })).filter((m) => m.monsterNumber === 4);
	eq(skeletons.length, 4, 'four definitions share the skeleton graphic');
	eq(skeletons.filter((m) => m.outline).map((m) => m.i).join(','), '14,15',
		'of which two are outlined -- the pair that was drawn flat blue');
	// They are the top two tiers, and the tell is that they cannot be stunned.
	ok(skeletons.filter((m) => m.outline).every((m) => !m.stunnable),
		'both unstunnable, which is what the bevel is advertising');
	ok(skeletons.filter((m) => !m.outline).every((m) => m.stunnable),
		'while the two plain ones can be stunned');
	const phys = skeletons.map((m) => m.physique);
	ok(phys[2] > phys[1] && phys[3] > phys[2], 'and they are the stronger two');
}

// --- the draw list keeps the two apart ----------------------------------------------------
{
	const view = fs.readFileSync(path.join(__dirname, '..', 'src', 'view.js'), 'utf8');
	ok(/\.\.\.\(\(variant & 1\) \? \{ solid: MONSTER_SOLID_WHITE \}/.test(view),
		'a flashed monster still fills solid');
	ok(/: \(variant & 2\) \? \{ outline: MONSTER_SOLID_OUTLINE \} : \{\}\)/.test(view),
		'an outlined one emits `outline`, not `solid`');
	// m_flashed is tested first in the source and returns, so it wins.
	ok(view.indexOf('variant & 1') < view.indexOf('variant & 2'),
		'and the flash takes precedence, as activate_planes does');
}

// --- and the pixels come out right -----------------------------------------------------
//
// A 6x6 block of one colour, drawn outlined. The rim must appear one row ABOVE
// the sprite, and the sprite's own colour must survive underneath -- a fill
// would have wiped it.
{
	const W = 8;
	const atlas = { width: W, data: new Uint8Array(W * 16) };
	const COLOUR = 9;
	for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) atlas.data[y * W + x] = COLOUR + 1;
	const rect = { ax: 0, ay: 0, x: 20, y: 20, w: 6, h: 6 };

	const run = (extra) => {
		const c = new IndexCompositor();
		c.clear();
		c.drawView([{ ...rect, ...extra }], atlas, 0, 0, 0, 0, {}, null);
		return c;
	};
	const px = (c, x, y) => c.indices[y * 320 + x];

	const plain = run({});
	eq(px(plain, 22, 20), COLOUR, 'a plain sprite paints its own colour');
	eq(px(plain, 22, 19), 0, 'and nothing above it');

	const out = run({ outline: 6 });
	eq(px(out, 22, 19), 6, 'outlined: colour 6 one row above the sprite');
	eq(px(out, 22, 20), COLOUR, 'the sprite itself is untouched -- not a fill');
	eq(px(out, 22, 25), COLOUR, 'all the way down');
	// Count it: only the top row should be rim.
	let rim = 0;
	for (const v of out.indices) if (v === 6) rim++;
	eq(rim, 6, 'exactly one row of rim, six pixels wide');

	const filled = run({ solid: 6 });
	let flat = 0;
	for (const v of filled.indices) if (v === 6) flat++;
	eq(flat, 36, 'whereas a solid fill covers all 36 -- the bug that was reported');

	// Lit, the fill stays absolute.
	const litFill = run({ solid: 6, lit: true });
	let banked = 0, absolute = 0;
	for (const v of litFill.indices) {
		if (v === 6 + LIGHT_OFFSET) banked++;
		if (v === 6) absolute++;
	}
	eq(banked, 0, 'a lit solid fill is not bank-shifted');
	eq(absolute, 36, 'it stays at the absolute index');

	// But the outline's second pass lights normally.
	const litOut = run({ outline: 6, lit: true });
	eq(px(litOut, 22, 19), 6, 'the rim is absolute too');
	eq(px(litOut, 22, 20), COLOUR + LIGHT_OFFSET, 'while the sprite under it is lit');
}

console.log(`monster outline: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
