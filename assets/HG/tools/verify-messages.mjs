// In-world text triggers (Main.s:555) -- one shot each, gated by speaker and
// by how much of the party is still alive.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	createMessageState, checkTextTriggers, messageFor, stepMessages,
	activeMessageText, pushMessage, SCROLL_PX_PER_TICK,
} from '../src/messages.js';
import { cellIndex, MAP_WIDTH } from '../src/view.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };

// --- the data survived extraction -------------------------------------------
let totalTriggers = 0, mapsWith = 0, orphan = 0;
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json') && n !== 'campaign.json')) {
	const map = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
	const t = map.textTriggers || [];
	if (!t.length) continue;
	mapsWith++; totalTriggers += t.length;
	for (const tr of t) if (!map.textMessages?.[tr.offset]) orphan++;
}
ok(totalTriggers === 131, `131 triggers across the maps (got ${totalTriggers})`);
ok(mapsWith === 9, `9 maps carry triggers (got ${mapsWith})`);
// Four triggers in 17-OperationCentre point at records whose text byte is 0.
// The original shows nothing for those too: scroll_node_text+4 reads 0, which
// is neither above '4' nor a matching player digit, so push_msg is never
// reached. Dead data in the shipped map, not a parse failure -- but if the
// count ever moves, the pool walk has drifted.
ok(orphan === 4, `exactly the 4 known dead triggers (got ${orphan})`);

// --- gating rules ------------------------------------------------------------
const rec = (speaker, participants, body = 'xxxx?  hello') =>
	({ speaker, participants, text: `   ${String.fromCharCode(27)}${speaker} "line"` });

ok(messageFor(rec('5', 0), 0, 4) !== null, "'5' shows to any player");
ok(messageFor(rec('5', 0), 3, 4) !== null, "'5' shows to player 4 too");
ok(messageFor(rec('2', 0), 1, 4) !== null, "'2' shows to player 2");
ok(messageFor(rec('2', 0), 0, 4) === null, "'2' does not show to player 1");
ok(messageFor(rec('1', 0), 0, 4) !== null, "'1' shows to player 1");

// participants + 1 <= players alive
ok(messageFor(rec('5', 1), 0, 2) !== null, '1 participant needs 2 alive -- ok at 2');
ok(messageFor(rec('5', 1), 0, 1) === null, '1 participant is dropped at 1 alive');
ok(messageFor(rec('5', 2), 0, 3) !== null, '2 participants ok at 3 alive');
ok(messageFor(rec('5', 2), 0, 2) === null, '2 participants dropped at 2 alive');

// '6' is rewritten to the triggering player's digit
const six = messageFor(rec('6', 0), 2, 4);
ok(six !== null, "'6' shows to anyone");
ok(six[4] === '3', `'6' rewritten to the triggering player (got ${JSON.stringify(six[4])})`);

// --- firing against a real map ----------------------------------------------
const tomb = JSON.parse(fs.readFileSync(path.join(dir, '09-Tomb.json'), 'utf8'));
const state = createMessageState(tomb);
ok(state.triggers.length === 22, `Tomb has 22 triggers (got ${state.triggers.length})`);

const t0 = state.triggers[0];
const floor = Math.floor(t0.cell / (23 * 23));
const rem = t0.cell % (23 * 23);
const player = { x: rem % MAP_WIDTH, y: Math.floor(rem / MAP_WIDTH), floor, dead: false, active: true };
ok(cellIndex(player.x, player.y, player.floor) === t0.cell, 'reconstructed the trigger cell');

const party = [player, { x: 0, y: 0, floor: 0 }, { x: 0, y: 0, floor: 0 }, { x: 0, y: 0, floor: 0 }];
let seen = [];
ok(checkTextTriggers(state, party, { onMessage: (t, i) => seen.push([t, i]) }) === true, 'trigger fires');
ok(seen.length === 1, `fired once (got ${seen.length})`);
ok(state.queue.length === 1, 'message goes on the queue');
stepMessages(state, 1, () => 100, 320);          // promote it
ok(state.active !== null, 'message becomes active');
ok(state.scrollX === 320, 'text enters at the right edge');
ok(activeMessageText(state).length > 0, `text is displayable: ${JSON.stringify(activeMessageText(state))}`);

// standing there must not re-fire
seen = [];
checkTextTriggers(state, party, { onMessage: (t, i) => seen.push([t, i]) });
ok(seen.length === 0, 'a fired trigger never fires again');

// and it scrolls off
const crossing = 320 + 100;                       // band width + text width
for (let i = 0; i < crossing - 1; i++) stepMessages(state, 1, () => 100, 320);
ok(state.active !== null, 'still on screen while crossing the band');
ok(state.scrollX < 0, 'text has moved past the left edge');
stepMessages(state, 1, () => 100, 320);
ok(state.active === null, 'message ends when it has fully scrolled off');
ok(SCROLL_PX_PER_TICK === 1, 'one pixel per vblank, as scroll_scrolly shifts');

// queue behaviour: order kept, duplicates refused
const q = createMessageState({ textTriggers: [], textMessages: {} });
ok(pushMessage(q, 'one', 0) === true, 'first message queues');
ok(pushMessage(q, 'two', 1) === true, 'second message queues');
ok(pushMessage(q, 'one', 0) === false, 'duplicate refused while queued');
stepMessages(q, 1, () => 10, 320);
ok(q.active.text === 'one', 'first queued message plays first');
ok(pushMessage(q, 'one', 0) === false, 'duplicate refused while playing');
for (let i = 0; i < 400; i++) stepMessages(q, 1, () => 10, 320);
ok(q.active?.text === 'two', 'the next message follows on');

console.log(`messages: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

// --- name substitution (ColdStartup.s:3388) ---------------------------------
{
	const { renderMessage, createChatterState, stepChatter, randomFromBank,
		fitnessBand, IDLE_CHATTER_TICKS, BANK_IDLE } = await import('../src/messages.js');
	const E = String.fromCharCode(27);
	const names = ['Clavius', 'Cheule', 'CIM', 'Desverger'];

	ok(renderMessage(`   ${E}1 "Oops"`, names) === 'Clavius "Oops"',
		'bare digit resolves to that player');
	ok(renderMessage(`${E}p2 "Excuse me."`, names) === 'Cheule "Excuse me."',
		"'p' + digit resolves the same way");
	ok(renderMessage(`${E}5 "Hello"`, names, () => 3) === 'Desverger "Hello"',
		"'5' resolves to the chosen living player");
	ok(!renderMessage(`${E}1 "Oops"`, names).includes(E), 'no marker survives into the output');
	ok(!/^\d/.test(renderMessage(`   ${E}1 "Oops"`, names)),
		'output never starts with a bare speaker digit');

	// --- chatter banks ------------------------------------------------------
	const banks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'messages.json'), 'utf8'));
	const chat = createChatterState(banks);
	ok(chat.banks.length === 26, `26 banks loaded (got ${chat.banks.length})`);
	ok((chat.banks[BANK_IDLE]?.messages || []).length === 35,
		`idle bank has 35 lines (got ${(chat.banks[BANK_IDLE]?.messages || []).length})`);

	// the timer fires at 2500 ticks, and only with company
	ok(stepChatter(chat, 4, IDLE_CHATTER_TICKS - 1) === '', 'silent before the timer expires');
	ok(stepChatter(chat, 4, 1) !== '', 'speaks when the timer expires');
	ok(stepChatter(chat, 4, IDLE_CHATTER_TICKS) !== '', 'timer resets and fires again');
	ok(stepChatter(chat, 1, IDLE_CHATTER_TICKS) === '', 'a lone survivor says nothing');

	// every idle line renders to something readable
	let blank = 0;
	for (let i = 0; i < chat.banks[BANK_IDLE].messages.length; i++) {
		// through randomFromBank, which is what restores the stripped marker
		const line = randomFromBank({ banks: [{ messages: [chat.banks[BANK_IDLE].messages[i]] }] }, 0);
		const out = renderMessage(line, names, () => 0);
		if (!out || /^\d/.test(out) || out.includes(E)) blank++;
	}
	ok(blank === 0, `all 35 idle lines render cleanly (${blank} bad)`);

	ok(fitnessBand(65535) === 10 && fitnessBand(0) === 0, 'fitness band maths');
	ok(randomFromBank(chat, 999) === '', 'a missing bank is silent, not a crash');
}
console.log('substitution + chatter ok');
