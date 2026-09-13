// Locked doors.
//
// door_direction is a four-state field, and 3 is LOCKED: .door_lock sets it and
// .door_unlock clears it (Controls&Movement.s:7183). The open and close
// triggers both bail out on it (Main.s:2276, 2288), so nothing but a button
// wired to unlock can move a locked door.
//
// The one that matters is a locked door with NO key. open_door reads door_key
// and branches straight to .do_lock the moment it reads zero -- before it ever
// looks at what the player is carrying. Such a door is simply not openable by
// hand. The port had the condition the other way round and refused only when
// there WAS a key you lacked, so every keyless locked door opened on a nudge.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDoorState, triggerDoor, DOOR } from '../src/doors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const MAPS = path.join(__dirname, '..', 'assets', 'maps');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const main = fs.readFileSync(path.join(REPO, 'Sources', 'Main.s'), 'utf8');
const ctrl = fs.readFileSync(path.join(REPO, 'Sources', 'Controls&Movement.s'), 'utf8');

// --- what 3 means, from the source ------------------------------------------------
{
	// The names are branch targets before they are labels, so anchor on the
	// definition at the start of a line.
	const lock = ctrl.slice(ctrl.search(/^.door_lock$/m));
	ok(/cmp\.b\s+#3,door_direction\(a1\)/.test(lock.slice(0, 400)),
		'.door_lock compares direction against 3');
	ok(/move\.b\s+#3,door_trig\(a1\)/.test(lock.slice(0, 400)), 'and asks for trig 3');
	const unlock = ctrl.slice(ctrl.search(/^.door_unlock$/m));
	ok(/cmp\.b\s+#3,door_direction\(a1\)/.test(unlock.slice(0, 400)),
		'.door_unlock only acts on a locked door');
	eq(DOOR.LOCKED, 3, 'and the port agrees that 3 is locked');

	// Both movement triggers refuse a locked door.
	const trig = main.slice(main.indexOf('tst.b\tdoor_trig(a0)'));
	const body = trig.slice(0, trig.search(/^\.cont_trig/m));
	eq((body.match(/cmpi\.b\s+#3,door_direction\(a0\)\s*\n\s*beq/g) || []).length, 2,
		'both the open and close triggers bail out on a locked door');
}

// --- the keyless case, which is the bug ---------------------------------------------
{
	const open = main.slice(main.indexOf('cmp.b\t#3,door_direction(a1)', main.indexOf('.not_button_only')));
	const body = open.slice(0, 400);
	ok(/move\.b\s+door_key\(a1\),d0\s*\n\s*beq\.s\s+\.do_lock/.test(body),
		'open_door branches to .do_lock the moment the key reads zero');
	// The carrying test comes AFTER that branch, so it never runs for key 0.
	ok(body.indexOf('carrying_item') > body.indexOf('beq.s\t.do_lock'),
		'and only then does it check what the player carries');
}

// --- the port, case by case -----------------------------------------------------------
{
	const at = 100;
	const make = (direction, key) =>
		createDoorState([{ posn: at << 2, direction, key, delay: 18 }]);
	const fire = (direction, key, carrying) =>
		triggerDoor(make(direction, key), at, carrying ? { carrying } : {});

	ok(fire(DOOR.STOPPED, 0).opening, 'an ordinary door opens');
	ok(fire(DOOR.STOPPED, 7).opening, 'so does a keyed door that is not locked');

	// The four Laboratory outer doors are this shape.
	const keyless = fire(DOOR.LOCKED, 0);
	ok(keyless.locked, 'a locked door with no key stays locked');
	ok(!keyless.unlocked, 'and is not unlocked by walking into it');
	// Even with a key in hand -- there is no key that fits a keyless lock.
	ok(fire(DOOR.LOCKED, 0, () => true).locked,
		'carrying everything does not open a keyless lock either');

	ok(fire(DOOR.LOCKED, 7).locked, 'a keyed lock refuses without the key');
	const unlocked = fire(DOOR.LOCKED, 7, (k) => k === 7);
	ok(unlocked.unlocked, 'and opens with it');
	eq(unlocked.key, 7, 'reporting which key was used');
	ok(fire(DOOR.LOCKED, 7, (k) => k === 9).locked, 'the wrong key does not do');

	// button_only is a separate refusal and must survive.
	const state = createDoorState([{ posn: at << 2, direction: 0, key: 0, buttonOnly: -1 }]);
	const b = triggerDoor(state, at, {});
	ok(b.buttonOnly && b.locked, 'a button-only door still ignores being walked into');
}

// --- and the doors this actually affects ----------------------------------------------
{
	const W = 23, LEVEL = W * 23;
	let keyless = 0, keyed = 0;
	const maps = new Set();
	for (const f of fs.readdirSync(MAPS)) {
		if (!f.endsWith('.json') || /^campaign|^maps\.json/.test(f)) continue;
		const j = JSON.parse(fs.readFileSync(path.join(MAPS, f), 'utf8'));
		for (const d of j.doors || []) {
			if ((d.direction | 0) !== DOOR.LOCKED) continue;
			if ((d.key | 0) === 0) { keyless++; maps.add(f); } else keyed++;
		}
	}
	ok(keyless > 0, `${keyless} doors ship locked with no key, across ${maps.size} maps`);
	ok(keyed > 0, `and ${keyed} ship locked behind a key`);

	// 04-Laboratory's outer four are the ones that opened onto the map boundary.
	const lab = JSON.parse(fs.readFileSync(path.join(MAPS, '04-Laboratory.json'), 'utf8'));
	const outer = (lab.doors || []).filter((d) => {
		const c = d.posn >>> 2, rem = c % LEVEL;
		const x = rem % W, y = Math.floor(rem / W);
		return x <= 1 || y <= 1 || x >= 21 || y >= 21;
	});
	eq(outer.length, 4, '04-Laboratory has four doors on its perimeter');
	ok(outer.every((d) => (d.direction | 0) === DOOR.LOCKED), 'and every one ships locked');
	ok(outer.every((d) => (d.key | 0) === 0), 'with no key, so none of them can be opened');
}

console.log(`doors: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
