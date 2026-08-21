// The psi amps.
//
// .use_psiamp subtracts 82 from the item number and jumps into psi_table
// (ItemUsage.s:1089), so the table's first entry IS item number 82 and the last
// is 110. The port's usePsi switches on the same item number, which is easy to
// get wrong by one because items.json is indexed from zero -- FIREBALL sits at
// index 81 but is item 82.
//
// So this reads the table out of the assembly rather than restating it, and
// checks three things: every number the table covers has a handler, the numbers
// MIRACLE can roll are all among them, and the port's cases still line up with
// the routines they claim to be.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'Sources', 'ItemUsage.s');
const MAIN = path.join(__dirname, '..', 'src', 'main.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const asm = fs.readFileSync(SRC, 'utf8');
const main = fs.readFileSync(MAIN, 'utf8');

// --- the table, straight out of the assembly ---------------------------------
const BASE = Number(asm.match(/sub\.l\s+#(\d+),d0[\s\S]{0,400}?lea\s+psi_table/)?.[1]);
eq(BASE, 82, 'the dispatch subtracts 82 before indexing psi_table');

const table = asm
	.slice(asm.indexOf('\npsi_table'))
	.split('\n')
	.slice(1)
	.reduce((acc, line) => {
		const m = line.match(/^\s+bra\.w\s+\.(\w+)/);
		if (m) { acc.push(m[1]); return acc; }
		return acc.length ? (acc.done = true, acc) : acc;      // stop at the gap
	}, [])
	.slice(0, 29);
eq(table.length, 29, 'psi_table has 29 entries');
eq(table[0], 'fireball', 'entry 0 is fireball');
eq(table[28], 'miracle', 'the last entry is miracle');

const numFor = (name) => BASE + table.indexOf(name);
eq(numFor('bridge'), 92, 'bridge is item 92');
eq(numFor('farsight'), 104, 'farsight is item 104');
eq(numFor('miracle'), 110, 'miracle is item 110');

// --- items.json is the same list, off by one ---------------------------------
//
// The off-by-one is the whole reason this file exists, so pin it against names
// rather than trusting it.
{
	const items = JSON.parse(fs.readFileSync(
		path.join(__dirname, '..', 'assets', 'items.json'), 'utf8')).items;
	const label = (num) => (items[num - 1]?.header || []).join(' ').trim();
	eq(label(82), 'PSIONIC-AMP FIREBALL', 'item 82 is the fireball amp');
	eq(label(98), 'PSIONIC-AMP PART WAVES', 'item 98 is part waves');
	eq(label(99), 'PSIONIC-AMP QUENCH', 'item 99 is quench');
	eq(label(107), 'PSIONIC-AMP CURE POISON', 'item 107 is cure poison');
	// The two the game never gives out have blank entries, which is the
	// independent confirmation that 93 and 106 really are the unused pair.
	eq(label(93), '', 'item 93 (float) has no item entry');
	eq(label(106), '', 'item 106 (shift) has no item entry');
	for (const name of ['float', 'shift']) {
		ok(new RegExp(`^\\.${name}\\s*\\n;not used`, 'm').test(asm),
			`.${name} is a ";not used" label in the source`);
	}
}

// --- every number the table covers is handled --------------------------------
const body = main.slice(main.indexOf('function usePsi(p)'));
const handled = new Set(
	[...body.slice(0, body.indexOf('\n}')).matchAll(/^\t\tcase (\d+):/gm)]
		.map((m) => Number(m[1])));

const missing = [];
for (let n = BASE; n < BASE + table.length; n++) if (!handled.has(n)) missing.push(n);
eq(missing.length, 0,
	`every psi item has a handler (missing ${missing.map((n) => `${n} ${table[n - BASE]}`).join(', ') || 'none'})`);
eq(handled.size, 29, `and there are no cases beyond the table (${[...handled].sort((a, b) => a - b).join(',')})`);

// --- what MIRACLE can roll ---------------------------------------------------
//
// .miracle divides by 28 and adds 82, so it reaches 82..109 -- everything but
// itself. A hole anywhere in that range is a spell that silently does nothing
// when a miracle lands on it, which is exactly how the four unhandled ones hid.
{
	const m = main.match(/const rolled = (\d+) \+ Math\.floor\(Math\.random\(\) \* (\d+)\);/);
	ok(m, 'the miracle roll is written the way the source computes it');
	const [, from, span] = m.map(Number);
	eq(from, 82, 'miracle rolls from 82');
	eq(span, 28, 'across 28 spells');
	ok(!asm.slice(asm.indexOf('\n.miracle')).match(/divu\s+#(\d+)/)?.[1]
		|| asm.slice(asm.indexOf('\n.miracle')).match(/divu\s+#(\d+)/)[1] === '28',
		'which is the divisor the original uses');
	const unrollable = [];
	for (let n = from; n < from + span; n++) if (!handled.has(n)) unrollable.push(n);
	eq(unrollable.length, 0, `miracle cannot land on a hole (${unrollable.join(',') || 'none'})`);
	eq(from + span - 1, numFor('miracle') - 1,
		'and the roll stops one short of miracle, so it cannot recurse');
}

// --- the cases are the routines they claim to be -----------------------------
//
// Behaviour the port shares with a named routine, checked so a renumbering
// breaks here rather than silently casting the wrong spell.
{
	const caseBody = (n) => {
		const at = body.indexOf(`\n\t\tcase ${n}:`);
		if (at < 0) return '';
		const next = body.slice(at + 1).search(/\n\t\tcase \d+:|\n\t\tdefault:/);
		return body.slice(at, next < 0 ? undefined : at + 1 + next);
	};
	ok(/setFloor\(ahead, 2\)/.test(caseBody(92)), '92 lays a floor, as .bridge does');
	ok(/revealFloor\(p\)/.test(caseBody(104)), '104 reveals the map, as .farsight does');
	ok(/density: 1/.test(caseBody(82)) && /density: 3/.test(caseBody(83)),
		'82 is the medium fireball and 83 the full inferno');
	ok(/partWaves\(p\)/.test(caseBody(98)), '98 parts the waves');
	ok(/quench\(p\)/.test(caseBody(99)), '99 quenches');
	// The two unused ones fall through in the assembly; they must fall through
	// here too rather than getting a copy that can drift.
	ok(/^\s*case 93:\s*\n\s*case 94:/m.test(body), '93 falls through to feather');
	ok(/^\s*case 106:\s*\n\s*case 107:/m.test(body), '106 falls through to cure poison');
}

// --- the two new routines, against their assembly ----------------------------
{
	// .cleave_wave clears keep_water and the flowing bit, stepping UP a level.
	const cleave = main.slice(main.indexOf('function cleaveWave('));
	ok(/at \+= LEVEL_CELLS/.test(cleave.slice(0, 600)),
		'cleaveWave walks up the column, matching the original add');
	ok(/~KEEP_WATER/.test(cleave.slice(0, 600)) && /FLOWING_BIT/.test(cleave.slice(0, 600)),
		'and clears both the water field and the flowing bit');

	const KEEP_WATER = (() => {
		const m = main.match(/const KEEP_WATER = \(0b11 << (\d+)\) \| WATER_HERE;/);
		return m ? (0b11 << Number(m[1])) | 4 : null;
	})();
	// keep_water, Equates.i:590: %00000000000001100000000000000100
	eq(KEEP_WATER, 0b00000000000001100000000000000100, 'KEEP_WATER matches keep_water');
	eq(Number(main.match(/const FLOWING_BIT = (\d+);/)?.[1]), 11,
		'FLOWING_BIT matches flowing_bit_num');
	eq(Number(main.match(/const CONT_CONSUMABLE = (\d+);/)?.[1]),
		Number(fs.readFileSync(path.join(__dirname, '..', '..', 'Sources', 'Equates.i'), 'utf8')
			.match(/^CONT_CONSUMABLE\s+equ\s+(\d+)/m)[1]),
		'CONT_CONSUMABLE matches the equate');
	eq(Number(main.match(/const QUENCH_ITEM = (\d+);/)?.[1]),
		Number(asm.match(/or\.l\s+#\((\d+)<<item_type_shift\)/)[1]),
		'quench places the item number the original writes');
	// Bit 31 of the items layer is the light bit; the mask must not reach it.
	const mask = Number(main.match(/const ITEM_DATA_MASK = (0x[0-9a-f]+);/)[1]);
	eq(mask, 0x00ffffff, 'ITEM_DATA_MASK covers type, damage and ammo');
	eq((mask >>> 31) & 1, 0, 'and leaves the light bit alone');
}

console.log(`psi: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
