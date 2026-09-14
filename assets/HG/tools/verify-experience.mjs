// The experience system, and the two things axis 2 found missing.
//
// Enumerating the globals block and the player struct out of the rs-offset
// tables in Equates.i -- rather than matching names -- turned up two pieces of
// state with no counterpart in the port:
//
//   1. exp(a0). draw_view accumulates EXP_NEWBLOCK into it for every cell a
//      character sees for the FIRST time, and Drawviews.s:66-97 flushes the
//      total into that player's stats the moment the view is drawn. The seen
//      bit is per-player, so four characters exploring apart each earn their
//      own. The port set the bit and never paid out, which left exploring --
//      the steady drip that funds most of a character's growth -- worth nothing.
//
//   2. behind_pushable. Drawviews.s:300 sets it to 2 when the cell straight
//      ahead holds a pushable block or a panel of any type but 0. The gadget
//      picker reads aux_here + using_grenade - behind_pushable, and since
//      using_grenade and behind_pushable are both 2, the whole expression comes
//      to one rule: a crate or a panel in front of you cancels the grenade
//      gadgets, and leaves the pick-up gadget alone.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	tableForPlayer, VIEW_GADGETS, VIEW_AUX_GADGETS,
	VIEW_GRENADE_GADGETS, VIEW_AUX_GRENADE_GADGETS, WINDOW,
} from '../src/gadgets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'Sources');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const eqs = read('Equates.i'), draw = read('Drawviews.s');
const cold = read('ColdStartup.s'), item = read('ItemUsage.s'), asmMain = read('Main.s');
const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

// --- the five awards ---------------------------------------------------------------
{
	const val = (n) => Number(eqs.match(new RegExp(`^${n}\\s+equ\\s+(\\d+)`, 'm'))?.[1]);
	const want = {
		EXP_NEWBLOCK: 1, EXP_KILL: 10, EXP_UNLOCK: 15, EXP_PSI: 5,
		EXP_EXIT: 500, EXP_MAX: 60000,
	};
	for (const [n, v] of Object.entries(want)) eq(val(n), v, `${n} is ${v} in the source`);

	// And the port carries the same numbers, by name rather than as literals.
	for (const n of ['EXP_NEWBLOCK', 'EXP_UNLOCK', 'EXP_PSI', 'EXP_EXIT', 'EXP_MAX']) {
		const m = main.match(new RegExp(`${n} = (\\d+)`));
		ok(m, `the port defines ${n}`);
		if (m) eq(Number(m[1]), want[n], `and at the source's value for ${n}`);
	}
	// EXP_KILL lives with the combat code that uses it.
	const combat = fs.readFileSync(path.join(__dirname, '..', 'src', 'combat.js'), 'utf8');
	eq(Number(combat.match(/EXP_KILL = (\d+)/)?.[1]), 10, 'and EXP_KILL beside the combat code');
}

// --- a kill pays physique/10, and only on the kill ------------------------------------
//
// The equate's comment says "for every hit on monster", but all three sites
// guard on damage_monster_fitness returning non-zero, which is the death.
{
	const sites = [item, item, asmMain];
	let guarded = 0;
	for (const text of [item, asmMain]) {
		for (const m of text.matchAll(/divu\s+#EXP_KILL,d\d/g)) {
			const around = text.slice(Math.max(0, m.index - 400), m.index + 400);
			if (/tst\.l\s+d0\s*\n\s*beq\.s\s+\.not_dead/.test(around)) guarded++;
		}
	}
	eq(guarded, 3, 'all three kill awards are behind the death test');
	ok(/if \(killed && owner >= 0\) addExperience\(game\.players\[owner\], Math\.floor\(physique \/ 10\)\)/
		.test(main), 'and the port pays physique/10 on the kill, not the hit');
	eq(sites.length, 3, 'three sites in total');
}

// --- 1. a newly seen cell is worth a point ----------------------------------------------
{
	// The source: one award, inside the seen-bit loop, before the bit is set.
	// Anchored on the award itself: .next_block is a label six times over in
	// this file, and indexOf lands on the first one, 800 lines too early.
	const awardAt = draw.indexOf('addi.w\t#EXP_NEWBLOCK');
	const loop = draw.slice(awardAt - 500, awardAt + 200);
	ok(/and\.l\s+d4,d2\s*\n\s*bne\.s\s+\.seen_already/.test(loop),
		'the loop skips a cell whose seen bit is already set');
	ok(/addi\.w\s+#EXP_NEWBLOCK,exp\(a0\)/.test(loop), 'and awards EXP_NEWBLOCK when it is not');
	ok(loop.indexOf('EXP_NEWBLOCK') < loop.indexOf('or.l\td4,0(a4,d1.w)'),
		'before setting the bit, so it fires exactly once per cell');
	// Per-player: the bit number comes from the player's own field.
	ok(/move\.w\s+seen_bit_num\(a0\),d1\s*\n\s*bset\.l\s+d1,d4/.test(draw),
		'the seen bit is the player\'s own, so each character earns separately');
	// Flushed per view, per player -- four times a redraw.
	eq((draw.match(/INCR_EXP d0,global_vars\+player\d_stats\+experience\(a5\)/g) || []).length, 4,
		'and flushed into stats after each of the four views');
	ok(/clr\.w\s+exp\(a0\)[\s\S]{0,80}bsr\s+draw_view/.test(draw),
		'the accumulator is cleared before each view');

	// The port: the same test, in markSeenFromView.
	const at = main.indexOf('function markSeenFromView(');
	ok(at > 0, 'the port has markSeenFromView');
	const body = main.slice(at, main.indexOf('\n}', at));
	ok(/if \(!\(game\.seen\[idx\] & seenMask\)\) discovered \+= EXP_NEWBLOCK;/.test(body),
		'which counts a cell only when its bit was clear');
	ok(body.indexOf('discovered += EXP_NEWBLOCK') < body.indexOf('game.seen[idx] = (game.seen[idx] | seenMask)'),
		'before setting it, as the source does');
	ok(/if \(discovered\) addExperience\(p, discovered\);/.test(body),
		'and pays the total out to that player');
	ok(/const seenBit = SEEN_BIT_BASE \+ \(p\.index \| 0\);/.test(body),
		'using the player\'s own seen bit');

	// The rule, replayed: revisiting the same cells pays nothing.
	const seen = new Uint32Array(16);
	const mask = 1 << 3;
	const sweep = (cells) => {
		let got = 0;
		for (const i of cells) { if (!(seen[i] & mask)) got += 1; seen[i] |= mask; }
		return got;
	};
	eq(sweep([0, 1, 2, 3]), 4, 'four fresh cells pay four');
	eq(sweep([0, 1, 2, 3]), 0, 'the same four again pay nothing');
	eq(sweep([2, 3, 4, 5]), 2, 'and an overlapping sweep pays only for the new ones');
	// A different character has their own bit and starts from scratch.
	const other = 1 << 4;
	let got = 0;
	for (const i of [0, 1, 2, 3]) { if (!(seen[i] & other)) got += 1; seen[i] |= other; }
	eq(got, 4, 'a second character earns the same cells over again');
}

// --- 2. a crate ahead cancels the grenade gadgets -------------------------------------
{
	// The source's three inputs and their values.
	ok(/move\.w\s+#1,aux_here\(a3\)/.test(draw), 'aux_here is 1');
	ok(/move\.w\s+#2,using_grenade\(a0\)/.test(read('Controls&Movement.s')), 'using_grenade is 2');
	ok(/move\.w\s+#2,behind_pushable\(a0\)/.test(draw), 'behind_pushable is 2');
	ok(/clr\.w\s+behind_pushable\(a0\)/.test(draw), 'and 0 otherwise');

	// What sets it: a pushable block, or a panel that is not type 0.
	// To the LABEL .skip_pushable, not the bra.s two lines in that targets it.
	const setAt = draw.indexOf('btst.l\t#pushable_bit_num,d0');
	const set = draw.slice(setAt, setAt + draw.slice(setAt).search(/^\.skip_pushable/m));
	ok(/btst\.l\s+#pushable_bit_num,d0[\s\S]{0,60}move\.w\s+#2,behind_pushable/.test(set),
		'a pushable block ahead sets it');
	ok(/and\.l\s+#keep_panel,d0\s*\n\s*beq\.s\s+\.no_panel/.test(set), 'no panel clears it');
	ok(/cmp\.l\s+#\(0<<panel_shift\)!keep_panel_here_bit,d0\s*\n\s*beq\.s\s+\.no_panel/.test(set),
		'and so does a panel of type 0 -- only other types count');

	// The arithmetic, and the negative correction.
	ok(/sub\.w\s+variables\+player1\+behind_pushable\(a5\),d2/.test(cold),
		'the picker subtracts it from aux_here + using_grenade');
	ok(/tst\.w\s+d2\s*\n\s*bpl\.s\s+\.ok_g\s*\n\s*addq\.w\s+#2,d2/.test(cold),
		'correcting a negative result by adding 2 back');

	// Replay the source's selector over every combination, then require the port
	// to agree. This is what shows the subtraction is exactly "ignore the grenade".
	const sourcePick = (aux, gren, push) => {
		let d2 = aux + gren - push;
		if (d2 < 0) d2 += 2;
		if (d2 === 2) return 'no_aux_grenade';
		if (d2 < 2) return d2 === 0 ? 'no_aux' : 'aux';
		return 'aux_grenade';
	};
	const portPick = (aux, gren, push) => {
		const t = tableForPlayer({
			windowType: WINDOW.VIEW, hasAux: !!aux,
			usingGrenade: gren === 2, behindPushable: push === 2,
		});
		if (t === VIEW_AUX_GRENADE_GADGETS) return 'aux_grenade';
		if (t === VIEW_GRENADE_GADGETS) return 'no_aux_grenade';
		if (t === VIEW_AUX_GADGETS) return 'aux';
		if (t === VIEW_GADGETS) return 'no_aux';
		return 'other';
	};
	let checked = 0;
	for (const aux of [0, 1]) for (const gren of [0, 2]) for (const push of [0, 2]) {
		eq(portPick(aux, gren, push), sourcePick(aux, gren, push),
			`aux=${aux} grenade=${gren} pushable=${push}`);
		checked++;
	}
	eq(checked, 8, 'all eight combinations agree');

	// Stated plainly: with something in front, the grenade sets never appear.
	for (const aux of [0, 1]) {
		eq(sourcePick(aux, 2, 2), sourcePick(aux, 0, 0 + aux * 0),
			`with a crate ahead, holding a grenade changes nothing (aux=${aux})`);
	}
	eq(sourcePick(0, 2, 0), 'no_aux_grenade', 'but in the open the grenade set does show');
	eq(sourcePick(1, 2, 0), 'aux_grenade', 'and with something to pick up too');
}

// --- and the port computes the flag the same way ------------------------------------------
{
	const at = main.indexOf('function facingPushableOrPanel(');
	ok(at > 0, 'the port has the flag');
	const body = main.slice(at, main.indexOf('\n}', at));
	ok(/STEP_DELTA\[p\.direction & 3\]/.test(body), 'reading the cell straight ahead');
	ok(/if \(cell & PUSHABLE_BIT\) return true;/.test(body), 'a pushable block counts');
	ok(/panel !== 0 && panel !== PANEL_HERE_BIT/.test(body),
		'and a panel of any type but 0, written as the source\'s two tests');
	ok(/p\.behindPushable = facingPushableOrPanel\(p\);/.test(main),
		'refreshed with the rest of the player flags');
	// It has to survive a save, or a reloaded game shows the wrong gadgets.
	const save = fs.readFileSync(path.join(__dirname, '..', 'src', 'save.js'), 'utf8');
	ok(/'behindPushable'/.test(save), 'and is saved with the player');
}

console.log(`experience + gadgets: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
