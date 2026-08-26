// Smoke test for the Front / ChSelect / WorldMap campaign shell.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	FRONT_ITEMS, SHELL, TRAINING_CHARS, applyFrontChoice, beginLocation,
	classifyMapNum, completeMission, confirmParty, createShell, locationsOf,
	togglePartyChar, focusFace, handleShellClick,
} from '../src/shell.js';
import { COMPLETION } from '../src/completion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const campaign = JSON.parse(fs.readFileSync(
	path.join(__dirname, '..', 'assets', 'maps', 'campaign.json'), 'utf8'));

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

// Front.s:2115 main_menu_text draws PHRASE 27, 28, 29, 3, 4, which resolve
// against Sources/engtext (as entry n-1) to Training / Full campaign game /
// Short action game / Continue a saved game / Exit to Workbench.
assert(FRONT_ITEMS.map((i) => i.id).join(',') === 'training,campaign,action,editor,load',
	'front menu order');
assert(FRONT_ITEMS[1].label === 'Full campaign game', 'front menu wording');
assert(TRAINING_CHARS.join(',') === '1,2,6,7', 'training party Cheule/CIM/Rorian/Jenillee');
assert(classifyMapNum(13) === 'campaign' && classifyMapNum(43) === 'training', 'map classes');
assert(campaign.starts.includes(13), 'campaign starts at dropzone 13');
assert(locationsOf(campaign, 'training').length === 5, 'five training maps');
assert(locationsOf(campaign, 'action').length >= 15, 'action maps present');

const shell = createShell();
assert(shell.mode === SHELL.FRONT, 'starts on front');
shell.cursor = FRONT_ITEMS.findIndex((i) => i.id === 'campaign');
const camp = applyFrontChoice(shell, campaign);
assert(shell.mode === SHELL.CHSELECT && camp.music === 'ChSelect', 'campaign goes to chselect');
togglePartyChar(shell, 0);
togglePartyChar(shell, 1);
togglePartyChar(shell, 2);
togglePartyChar(shell, 3);
const world = confirmParty(shell, campaign);
	assert(world.music === 'World' && shell.mode === SHELL.WORLD, 'party confirm opens world');
	assert(shell.here === 13, 'campaign starts at dropzone');
	assert(shell.reachable.every((l) => l.mapNum !== 13), 'dropzone is not selectable');
	assert(shell.reachable.some((l) => l.mapNum === 7), 'dropzone links to depot 7');
	shell.cursor = shell.reachable.findIndex((l) => l.mapNum === 7);
	const blocked = beginLocation({ ...shell, cursor: -1, reachable: [shell.list.find((l) => l.mapNum === 13)].filter(Boolean) }, campaign);
	assert(!blocked.play, 'dropzone cannot be played');
	const play = beginLocation(shell, campaign);
	assert(play.play && play.play.startsWith('07-'), 'first playable is depot 7');
	assert(shell.mode === SHELL.WORLD, 'map stays on world until load finishes');

const after = completeMission(shell, campaign, { type: COMPLETION.CAMPAIGN_COMPLETE });
assert(shell.mode === SHELL.RESULT, 'result screen');
	assert(shell.completed.some((k) => k.startsWith('07-')), 'depot marked complete');
	assert(shell.unlocked.includes(2) || shell.unlocked.includes(1), 'depot destinations unlock');
assert(after.music === 'Front', 'result music');

const train = createShell();
train.cursor = FRONT_ITEMS.findIndex((i) => i.id === 'training');
applyFrontChoice(train, campaign);
assert(train.mode === SHELL.TRAINING && train.party.join(',') === '1,2,6,7', 'training skips chselect');

console.log(`shell smoke: ${campaign.locations.length} locations, front/chselect/world/result ok`);

// The menu grew, so anything that used to index it by number must not have
// been left pointing at the wrong line.
{
	const { FRONT_ITEMS: FI, FRONT_SEPARATOR_AT, FRONT_MENU_POS, SHELL_H, handleShellKey } =
		await import('../src/shell.js');
	const shell = createShell();
	// Escaping the load screen must land back on 'Continue a saved game'.
	shell.mode = SHELL.LOAD;
	handleShellKey(shell, campaign, 'Escape');
	assert(FI[shell.cursor].id === 'load', 'escape from load returns to the load line');
	// Every entry needs a position, and they must all fit on screen.
	assert(FRONT_SEPARATOR_AT > 0 && FRONT_SEPARATOR_AT < FI.length, 'separator inside the menu');
	// Guards the pairing that broke when the menu last changed shape.
	assert(FRONT_MENU_POS.length === FI.length, 'one position per menu entry');
	assert(FRONT_MENU_POS.every((p) => p.y + 44 < SHELL_H), 'every line fits on screen');
	// Selecting the editor reports it rather than trying to start a map.
	shell.mode = SHELL.FRONT;
	shell.cursor = FI.findIndex((i) => i.id === 'editor');
	assert(applyFrontChoice(shell, campaign).editor === true, 'editor entry reports itself');
	assert(shell.mode === SHELL.FRONT, 'editor entry does not leave the front menu');
}
console.log('front menu: editor entry and indices ok');

// Portrait clicks resolve from their displayed position. In particular, the
// framed portrait at x 98..257 must not resolve to the next character.
{
	const s = createShell();
	s.mode = SHELL.CHSELECT;
	focusFace(s, 5, true);
	handleShellClick(s, campaign, 178, 20, {}, false);
	assert(s.focusChar === 5 && s.party.join(',') === '5',
		'clicking the framed portrait did not choose the current character');
	handleShellClick(s, campaign, 338, 20, {}, false);
	assert(s.focusChar === 6, 'clicking the next displayed portrait did not focus it');

	// Edge navigation remains a touch affordance. Mouse uses the portrait under
	// the pointer; touch moves exactly one character even at the wide right edge.
	focusFace(s, 5, true);
	handleShellClick(s, campaign, 0, 20, {}, false);
	assert(s.focusChar === 4, 'desktop click did not focus the visible previous portrait');
	focusFace(s, 5, true);
	handleShellClick(s, campaign, 0, 20, {}, true);
	assert(s.focusChar === 4, 'touch left edge did not move one character');
	focusFace(s, 5, true);
	handleShellClick(s, campaign, 639, 20, {}, true);
	assert(s.focusChar === 6, 'touch right edge did not move one character');
}
console.log('character select: portrait hit-testing and touch-only edge navigation checked');

// The action list is 20 entries and only ~8 rows fit, so it must scroll and
// the cursor must always be on screen.
{
	const { LIST_ROWS, listScrollTop } = await import('../src/shell.js');
	const shell = createShell();
	shell.mode = SHELL.ACTION;
	shell.list = locationsOf(campaign, 'action');
	assert(shell.list.length > LIST_ROWS, `action list overflows one screen (${shell.list.length} > ${LIST_ROWS})`);
	let worst = 0;
	for (let c = 0; c < shell.list.length; c++) {
		shell.cursor = c;
		const top = listScrollTop(shell);
		assert(top >= 0 && top <= shell.list.length - LIST_ROWS, `scroll top in range at ${c}`);
		assert(c >= top && c < top + LIST_ROWS, `cursor ${c} visible (window ${top}..${top + LIST_ROWS - 1})`);
		worst = Math.max(worst, top);
	}
	assert(worst === shell.list.length - LIST_ROWS, 'last entry reachable at the bottom of the list');
	// Short lists must not scroll at all.
	shell.list = locationsOf(campaign, 'training');
	shell.cursor = shell.list.length - 1;
	assert(listScrollTop(shell) === 0, 'training list (5) never scrolls');
}
console.log(`action list: scrolls, every one of 20 entries reachable`);

// Action and training levels must actually launch. `reachable` starts as an
// empty array -- truthy -- so a `reachable || list` fallback silently made
// currentLocation return null on every screen except the world map, and no
// standalone level could be started.
{
	const { currentLocation, beginLocation, confirmParty } = await import('../src/shell.js');
	for (const [kind, flag] of [['action', 1], ['training', 1]]) {
		const s = createShell();
		s.actionFlag = flag;
		s.trainingFlag = kind === 'training' ? 1 : 0;
		s.party = [0, 1, 2, 3];
		if (kind === 'training') s.party = TRAINING_CHARS.slice();
		confirmParty(s, campaign);
		assert(s.list.length > 0, `${kind} list is populated`);
		assert(Array.isArray(s.reachable) && s.reachable.length === 0,
			`${kind}: reachable is still the empty array`);
		s.cursor = 0;
		const loc = currentLocation(s);
		assert(loc !== null, `${kind}: the cursor resolves to a level`);
		const r = beginLocation(s, campaign);
		assert(r.play, `${kind}: selecting a level starts it (got ${JSON.stringify(r)})`);
	}
	// the world map still uses `reachable`
	const w = createShell();
	w.party = [0, 1, 2, 3];
	confirmParty(w, campaign);
	assert(w.mode === SHELL.WORLD, 'campaign goes to the world map');
	assert(currentLocation(w) === w.reachable[w.cursor], 'world map still reads reachable');
}
console.log('standalone levels launch from their lists');
