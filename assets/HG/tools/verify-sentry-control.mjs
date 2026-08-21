// Taking over a sentry.
//
// A NEW capability: the original reserved CAT_SENTRYCNTRL (25), wired it into
// the use dispatch, and left the handler as a bare `rts` with no item assigned.
// What makes it worth having is that both shipped kits set shootPlayers, so a
// deployed turret shoots your own party as readily as it shoots monsters.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createSentryState, addSentry, activeSentries, takeOverSentry, sentryAtCell,
	clearSentryAtCell,
} from '../src/sentries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)})`);

const items = JSON.parse(fs.readFileSync(path.join(A, 'items.json'), 'utf8'));
const kits = items.items.filter((d) => d && d.categoryName === 'sentry');

// --- the premise ---------------------------------------------------------------
{
	eq(kits.length, 2, 'two sentry kits ship');
	ok(kits.every((k) => (k.sentry.shootPlayers | 0) !== 0),
		'and both of them shoot players, which is the thing worth changing');
	eq(items.items.filter((d) => d && d.categoryName === 'sentrycntrl').length, 0,
		'no shipped item uses the reserved control category, so this rides on the kit');
}

const MAP_W = 23, LEVEL = MAP_W * 23;
const FLOOR_HERE = 1;
function world() {
	const cells = new Uint32Array(LEVEL * 20);
	// A floor under the whole test row, so a sentry has something to stand on.
	for (let x = 0; x < MAP_W; x++) cells[LEVEL * 5 + 4 * MAP_W + x] = FLOOR_HERE;
	return cells;
}
const CELL = LEVEL * 6 + 4 * MAP_W + 5;

// --- taking one over ------------------------------------------------------------
{
	const cells = world();
	const state = createSentryState();
	ok(addSentry(state, cells, CELL, 0, kits[0], 1), 'a sentry is deployed by player 1');
	const s = sentryAtCell(state, CELL);
	ok(s, 'and can be found on its cell');
	eq(s.owner, 1, 'owned by the player who put it there');
	ok(s.shootPlayers !== 0, 'and shooting players, as the kit says');

	const done = takeOverSentry(state, cells, CELL, 3);
	ok(done, 'it can be taken over');
	eq(done.wasHostile, true, 'and reports that it had been shooting the party');
	eq(s.owner, 3, 'the owner moves to whoever did it');
	eq(s.shootPlayers, 0, 'and it stops shooting players');
	// putSentryInMap consumes the flag as it stamps the cell -- the flash lives
	// in the variant's bit 4, not on the record, so that is where to look.
	eq(s.white, false, 'the flash flag is consumed when the cell is stamped');
	const variant = (cells[CELL] >>> 23) & 0x1f;
	ok((variant & 16) !== 0, 'and the cell carries the white bit, so it shows');

	// Monsters are still fair game: that check is unconditional in moveSentries.
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'sentries.js'), 'utf8');
	const monsterLine = src.match(/if \(t >= BLOCK\.MONSTER_FIRST[\s\S]{0,120}/)[0];
	ok(!/shootPlayers/.test(monsterLine),
		'the monster check does not consult shootPlayers, so a tamed sentry still fights');

	// Doing it twice is harmless and says so.
	const again = takeOverSentry(state, cells, CELL, 2);
	ok(again, 'a second takeover works');
	eq(again.wasHostile, false, 'and knows it was already holding fire');
	eq(s.owner, 2, 'while still changing hands');
}

// --- it only applies where there is a sentry ------------------------------------
{
	const cells = world();
	const state = createSentryState();
	eq(takeOverSentry(state, cells, CELL, 1), null, 'an empty cell cannot be taken over');
	eq(sentryAtCell(state, CELL), null, 'and reports no sentry');
	eq(takeOverSentry(state, cells, -5, 1), null, 'nor can a cell off the map');
	eq(sentryAtCell(state, 999999), null, 'and out of range reads as nothing');

	addSentry(state, cells, CELL, 0, kits[0], 1);
	clearSentryAtCell(state, cells, CELL);
	eq(takeOverSentry(state, cells, CELL, 1), null,
		'a destroyed sentry cannot be taken over either');
}

// --- one sentry, not all of them -------------------------------------------------
{
	const cells = world();
	const state = createSentryState();
	const a = CELL, b = CELL + 1;
	addSentry(state, cells, a, 0, kits[0], 1);
	addSentry(state, cells, b, 0, kits[1], 1);
	eq(activeSentries(state).length, 2, 'two sentries are out');

	takeOverSentry(state, cells, a, 4);
	eq(sentryAtCell(state, a).shootPlayers, 0, 'the one in front is tamed');
	ok(sentryAtCell(state, b).shootPlayers !== 0, 'the other is untouched');
	eq(sentryAtCell(state, b).owner, 1, 'and keeps its owner');
}

// --- the kit does both jobs, chosen by what is ahead -----------------------------
{
	const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	ok(/sentryAtCell\(game\.sentryState, ahead\)/.test(src),
		'useSentry checks the cell ahead for a sentry first');
	ok(/takeOverSentryAhead/.test(src), 'and reprograms it rather than deploying');
	ok(/consumeHeldAmmo\(p, 1, true\)/.test(src), 'a takeover costs a charge like a deploy');
}

console.log(`sentry control: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
