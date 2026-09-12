// Booting with a missing asset.
//
// Most assets are loaded with a catch, so one missing extra does not take the
// whole boot down. For briefing art or end screens that is right. For a handful
// it is not, and monsters.json is the one that bites: without it
// createMonsterState gets an empty defs table, addMonster refuses every type,
// and every egg silently fails to hatch.
//
// What is left on screen are the monster blocks baked into the shipped map
// data, which render like enemies, never move, and cannot be killed because no
// record backs them. It looks like a bug in the monster code and it comes back
// clean on reload -- so the boot has to refuse rather than start broken.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMonsterState } from '../src/monsters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

// --- what a missing monsters.json actually does ---------------------------------
//
// Measured, not assumed. This is the behaviour the gate exists to prevent.
{
	const map = JSON.parse(fs.readFileSync(path.join(A, 'maps', '01-ArtificialIsland.json'), 'utf8'));
	const withDefs = JSON.parse(fs.readFileSync(path.join(A, 'monsters.json'), 'utf8'));

	const good = createMonsterState(map, withDefs);
	ok(good.defs.length > 0, `with monsters.json there are ${good.defs.length} definitions`);

	// What the old `.catch(() => null)` produced.
	const broken = createMonsterState(map, null);
	eq(broken.defs.length, 0, 'without it the defs table is empty');
	eq(broken.monsters.length, 0, 'and no monster records exist');

	// An empty defs table makes every hatch refuse, which is why nothing spawns.
	// addMonster is module-private, so this exercises it through the state it
	// reads: a type index that resolves with defs and does not without.
	ok(good.defs[0], 'type 0 resolves with definitions loaded');
	eq(broken.defs[0], undefined, 'and resolves to nothing without them');
}

// --- the enemies you would still see ---------------------------------------------
//
// The reason the failure reads as "monsters are broken" rather than "monsters
// are missing": the shipped cell data has monster blocks stamped into it, and
// nothing ever clears them. They are drawn, and with no record behind them they
// neither move nor take damage.
{
	const monsters = fs.readFileSync(path.join(__dirname, '..', 'src', 'monsters.js'), 'utf8');
	const stamp = monsters.slice(monsters.indexOf('export function stampMonsters('));
	const body = stamp.slice(0, stamp.indexOf('\n}'));
	ok(!/clear|erase/i.test(body), 'stampMonsters only stamps records, it never clears blocks');

	const dir = path.join(A, 'maps');
	let mapsWithBlocks = 0, blocks = 0;
	for (const f of fs.readdirSync(dir)) {
		if (!f.endsWith('.cells')) continue;
		const buf = fs.readFileSync(path.join(dir, f));
		const cells = new Uint32Array(buf.buffer, buf.byteOffset, buf.length >> 2);
		let n = 0;
		for (let i = 0; i < cells.length; i++) {
			const w = cells[i] >>> 0;
			if (!(w & 2)) continue;
			const b = (w >>> 11) & 0x3f;
			if (b >= 8 && b <= 15) n++;
		}
		if (n) { mapsWithBlocks++; blocks += n; }
	}
	ok(blocks > 0, `${blocks} monster blocks are baked into ${mapsWithBlocks} shipped maps`);
}

// --- so the boot refuses ----------------------------------------------------------
{
	ok(/const REQUIRED_ASSETS = \[/.test(main), 'there is a required-asset list');
	const list = main.slice(main.indexOf('const REQUIRED_ASSETS = ['));
	const body = list.slice(0, list.indexOf('];'));
	for (const name of ['viewtables.json', 'items.json', 'monsters.json',
		'monster-graphics.json', 'characters.json', 'exgfx.json']) {
		ok(body.includes(`'${name}'`), `${name} is required`);
	}
	// Optional extras must NOT be on it, or a missing briefing picture stops the
	// game from starting at all.
	for (const name of ['briefings.json', 'endscreens.json', 'cursors.json', 'music/music.json']) {
		ok(!body.includes(`'${name}'`), `${name} stays optional`);
	}

	ok(/function missingRequiredAssets\(\)/.test(main), 'the list is actually checked');
	ok(/const missing = missingRequiredAssets\(\);/.test(main), 'during boot');
	ok(/throw new Error\(`could not load \$\{missing\.join/.test(main),
		'and a missing one stops the boot');

	// The two that cause this specific failure no longer swallow at all, the way
	// items.json already did not.
	ok(/game\.monsterDefs = await loadJSON\('monsters\.json'\);/.test(main),
		'monsters.json is loaded without a catch');
	ok(/game\.monsterGraphics = await loadJSON\('monster-graphics\.json'\);/.test(main),
		'and monster-graphics.json');
	ok(/game\.itemDefs = await loadJSON\('items\.json'\);/.test(main),
		'matching how items.json was already treated');

	// Optional ones still swallow, or one missing extra takes the boot down.
	const optional = (main.match(/catch\(\(\) => null\)/g) || []).length;
	ok(optional > 10, `${optional} optional assets still fail soft`);

	// And the failure is visible. A status line is too easy to miss for something
	// whose whole point is that a quiet failure is the problem.
	const tail = main.slice(main.indexOf('main().catch('));
	ok(/drop-hint/.test(tail), 'a boot failure is shown over the page');
	ok(/classList\.add\('on'\)/.test(tail), 'with the overlay actually turned on');
}

console.log(`boot: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
