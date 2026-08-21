// Authoring text triggers.
//
// A trigger and its message are two tables joined by a byte offset, and the
// original hand-packed those offsets. Here they are assigned and reflowed, so
// what matters is that the pair always stays consistent, and that what the
// editor writes is what messages.js reads at runtime.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	triggerAt, triggerCells, addTrigger, removeTrigger, setTriggerMessage,
	composeText, decomposeText, reflowMessages, poolUsage, checkMessages,
	messageBytes, SPEAKER_MARK, TRIGGER_LIMIT, POOL_BYTES,
} from '../src/editor/messages.js';
import { messageFor, createMessageState } from '../src/messages.js';
import { createMapDoc, cellIndex } from '../src/editor/mapdoc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)})`);

const load = (key) => createMapDoc(
	JSON.parse(fs.readFileSync(path.join(MAPS, `${key}.json`), 'utf8')),
	new Uint8Array(fs.readFileSync(path.join(MAPS, `${key}.cells`))));
const keys = fs.readdirSync(MAPS).filter((f) => f.endsWith('.cells'))
	.map((f) => f.slice(0, -6));

// --- the stored line format --------------------------------------------------
{
	const text = composeText('6', 'Oops');
	eq(text.indexOf(SPEAKER_MARK), 3, 'the marker sits after three spaces');
	eq(text[4], '6', 'and the code right after it');
	// messageFor rewrites index 4 in place, so that position is load-bearing.
	eq(messageFor({ text, speaker: '6', participants: 0 }, 2, 4)[4], '3',
		'speaker 6 is rewritten to the triggering player');

	const back = decomposeText(text);
	eq(back.code, '6', 'the code round-trips');
	eq(back.body, 'Oops', 'and so does the body');
	eq(decomposeText(composeText('1', 'He said "no"')).body, 'He said "no"',
		'inner quotes survive');
	eq(decomposeText('no marker at all').body, 'no marker at all',
		'a line with no marker still yields a body');

	// The shipped lines must decompose too, or the format is misread. One of
	// them is odd and it is worth being precise about which: offset 1172 in
	// 09-Tomb has no leading spaces, so its marker sits at index 0 rather than
	// 3, and the extracted `speaker` field reads "I" -- the first letter of the
	// sentence, picked up from where the code normally lives.
	//
	// decomposeText finds the marker rather than assuming its position, so it
	// still reads code 6 and the right body. The runtime tolerates it too:
	// messageFor gates on `speaker`, and "I" sorts above "4" so the line is open
	// to anyone, while not being "6" it skips the index-4 rewrite -- which on
	// this string would have overwritten the "I". Editing it normalises it.
	const doc = load('09-Tomb');
	let bodyLost = 0, oddSpeaker = 0;
	for (const key of Object.keys(doc.meta.textMessages)) {
		const rec = doc.meta.textMessages[key];
		const d = decomposeText(rec.text);
		// What must always hold: the words survive the trip.
		if (decomposeText(composeText(d.code, d.body)).body !== d.body) bodyLost++;
		if (d.code !== rec.speaker) oddSpeaker++;
	}
	eq(bodyLost, 0, 'every shipped message keeps its words through the pair');
	eq(oddSpeaker, 1, 'exactly one shipped message has a speaker field that '
		+ 'disagrees with its text, and it is the known one');
	eq(decomposeText(doc.meta.textMessages[1172].text).code, '6',
		'and that one still reads as speaker 6 from the text itself');
}

// --- placing, editing and removing --------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	eq((doc.meta.textTriggers || []).length, 0, 'the map starts with no triggers');
	const [x, y, z] = [5, 5, 6];

	eq(triggerAt(doc, x, y, z), null, 'nothing on the cell yet');
	const t = addTrigger(doc, x, y, z, { body: 'Hello', speaker: '6', participants: 1 });
	ok(t, 'a trigger is placed');
	eq(t.cell, cellIndex(x, y, z), 'on the right cell');
	// posn is a BYTE offset, which is what the runtime shifts down.
	eq(t.posn, cellIndex(x, y, z) * 4, 'and its posn is a byte offset');

	const found = triggerAt(doc, x, y, z);
	eq(decomposeText(found.record.text).body, 'Hello', 'the words are stored');
	eq(found.record.speaker, '6', 'and the speaker');
	eq(found.record.participants, 1, 'and the participant count');

	ok(setTriggerMessage(doc, found, { body: 'Goodbye' }), 'the words can change');
	eq(decomposeText(triggerAt(doc, x, y, z).record.text).body, 'Goodbye', 'and take');
	ok(setTriggerMessage(doc, triggerAt(doc, x, y, z), { speaker: '2' }),
		'the speaker can change');
	eq(triggerAt(doc, x, y, z).record.speaker, '2', 'and takes');
	ok(!setTriggerMessage(doc, triggerAt(doc, x, y, z), { speaker: '2' }),
		'setting the same speaker is a no-op');

	// A cell holds one trigger: a second could never fire.
	addTrigger(doc, x, y, z, { body: 'Second' });
	eq(doc.meta.textTriggers.length, 1, 'a repeat placement replaces rather than stacks');
	eq(decomposeText(triggerAt(doc, x, y, z).record.text).body, 'Second',
		'with the new words');

	ok(removeTrigger(doc, x, y, z), 'it can be removed');
	eq(triggerAt(doc, x, y, z), null, 'and is gone');
	eq(Object.keys(doc.meta.textMessages).length, 0, 'taking its message with it');
	ok(!removeTrigger(doc, x, y, z), 'removing nothing reports nothing');
}

// --- offsets stay packed and consistent ---------------------------------------
{
	const doc = load('01-ArtificialIsland');
	const at = (n) => [3 + n, 4, 6];
	for (let i = 0; i < 5; i++) {
		addTrigger(doc, ...at(i), { body: `Line number ${i} with some length` });
	}
	eq(new Set(doc.meta.textTriggers.map((t) => t.offset)).size, 5,
		'every trigger has its own offset');

	// Packed end to end: each offset is the previous plus that message's bytes.
	const packed = () => {
		let cursor = 0;
		return doc.meta.textTriggers.every((t) => {
			const good = t.offset === cursor;
			cursor += messageBytes(doc.meta.textMessages[t.offset]);
			return good;
		});
	};
	ok(packed(), 'offsets run end to end');

	// Deleting from the middle must close the hole, or a map edited enough
	// times exhausts a 3KB budget it is barely using.
	removeTrigger(doc, ...at(2));
	eq(doc.meta.textTriggers.length, 4, 'one fewer trigger');
	ok(packed(), 'and the pool is repacked');
	let dangling = 0;
	for (const t of doc.meta.textTriggers) if (!doc.meta.textMessages[t.offset]) dangling++;
	eq(dangling, 0, 'no trigger points at a missing message');

	// Growing a line shifts everything after it.
	setTriggerMessage(doc, triggerAt(doc, ...at(0)),
		{ body: 'A very much longer line than the one it replaces, by some margin' });
	ok(packed(), 'a longer message reflows the rest');
	eq(reflowMessages(doc), 0, 'and a further reflow is a no-op');
}

// --- limits and validation ----------------------------------------------------
{
	const doc = load('01-ArtificialIsland');
	for (let i = 0; i < TRIGGER_LIMIT; i++) {
		addTrigger(doc, i % 20, 2 + Math.floor(i / 20), 6, { body: `m${i}` });
	}
	eq(doc.meta.textTriggers.length, TRIGGER_LIMIT, `the table fills at ${TRIGGER_LIMIT}`);
	eq(addTrigger(doc, 21, 21, 6, { body: 'one too many' }), null,
		'and refuses the next rather than overflowing');
	eq(checkMessages(doc).length, 0, 'a full but valid table reports nothing');

	// The pool is finite and the warning has to fire before it is exceeded.
	const usage = poolUsage(doc);
	ok(usage.used > 0 && !usage.over,
		`the pool is in use but not over (${usage.used}/${POOL_BYTES})`);
	setTriggerMessage(doc, triggerAt(doc, 0, 2, 6), { body: 'x'.repeat(POOL_BYTES) });
	ok(checkMessages(doc).some((w) => /pool/.test(w)), 'an oversized pool is reported');

	const empty = load('01-ArtificialIsland');
	addTrigger(empty, 4, 4, 6, { body: '   ' });
	ok(checkMessages(empty).some((w) => /empty/.test(w)), 'an empty message is reported');
}

// --- what the editor writes is what the runtime reads -------------------------
{
	const doc = load('01-ArtificialIsland');
	addTrigger(doc, 7, 7, 6, { body: 'Anyone can say this', speaker: '5', participants: 0 });
	addTrigger(doc, 8, 7, 6, { body: 'Only player two', speaker: '2', participants: 0 });
	addTrigger(doc, 9, 7, 6, { body: 'Needs a crowd', speaker: '5', participants: 3 });

	const state = createMessageState(doc.meta);
	eq(state.triggers.length, 3, 'the runtime sees all three');
	for (const t of state.triggers) ok(state.pool[t.offset], 'each resolves to a message');

	const rec = (n) => state.pool[state.triggers[n].offset];
	ok(messageFor(rec(0), 0, 4), 'an open line fires for player 1');
	ok(messageFor(rec(0), 3, 4), 'and for player 4');
	eq(messageFor(rec(1), 0, 4), null, 'a player-2 line does not fire for player 1');
	ok(messageFor(rec(1), 1, 4), 'but does for player 2');
	eq(messageFor(rec(2), 0, 2), null, 'a line needing four does not fire for two');
	ok(messageFor(rec(2), 0, 4), 'but does for four');

	// The markers the editor draws are the cells the runtime checks.
	const cells = triggerCells(doc);
	eq(cells.length, 3, 'three markers');
	eq(cells.join(','), state.triggers.map((t) => t.cell).join(','),
		'and they are exactly the runtime cells');
}

// --- the shipped maps still read correctly ------------------------------------
{
	let triggers = 0, dangling = 0, over = 0;
	for (const key of keys) {
		const doc = load(key);
		const list = doc.meta.textTriggers || [];
		triggers += list.length;
		for (const t of list) if (!(doc.meta.textMessages || {})[t.offset]) dangling++;
		if (poolUsage(doc).over) over++;
	}
	eq(triggers, 131, `the campaign ships 131 triggers (${triggers})`);
	// 17-OperationCentre ships five triggers but only one message: the four at
	// offsets 200/216/232/248 point into a part of the pool that carries no
	// decodable line. They simply never speak. Pinned rather than papered over,
	// so a real regression in offset handling still shows up here.
	eq(dangling, 4, `four shipped triggers dangle, all in one map (${dangling})`);
	const opCentre = load('17-OperationCentre');
	eq((opCentre.meta.textTriggers || []).length, 5, 'and that map is the one with five');
	eq(Object.keys(opCentre.meta.textMessages || {}).length, 1, 'against a single message');
	ok(checkMessages(opCentre).some((w) => /no message/.test(w)),
		'which the editor reports rather than hiding');
	eq(over, 0, 'no shipped pool is over budget');
}

console.log(`message editing: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
