// Screen shake, the falling-block thud, and the underwater filter.
//
// The shake table is read back out of Main.s rather than restated, because the
// whole character of the effect lives in those numbers: a damped bounce, not
// jitter, and vertical only.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
	SHAKE_TABLE, SHAKE_END, SHAKE_BLOCK_LANDS, SHAKE_EXPLOSION, SHAKE_GRENADE,
	createShakeState, startShake, stepShake, shakeActive,
} from '../src/shake.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'Sources');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const main = fs.readFileSync(path.join(SRC, 'Main.s'), 'utf8');
const push = fs.readFileSync(path.join(__dirname, '..', 'src', 'pushables.js'), 'utf8');
const mjs = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const audio = fs.readFileSync(path.join(__dirname, '..', 'src', 'audio.js'), 'utf8');

// --- the table is the one in the sources ---------------------------------------
{
	// The name appears first as an operand, so match the label definition.
	const at = main.search(/^.shake_table/m);
	ok(at > 0, 'shake_table is in Main.s');
	const body = main.slice(at, main.search(/^.do_shake/m));
	const nums = [...body.matchAll(/dc\.b\s+([-\d,\s]+)/g)]
		.flatMap((m) => m[1].split(',').map((v) => Number(v.trim())))
		.filter((n) => Number.isFinite(n));
	eq(nums.length, SHAKE_TABLE.length, 'the port has every entry');
	eq(nums.join(','), SHAKE_TABLE.join(','), 'and they are the same numbers');
	eq(SHAKE_TABLE[SHAKE_TABLE.length - 1], SHAKE_END, 'the last one is the terminator');

	// A damped bounce: alternating sign, each swing no bigger than the last.
	const peaks = [];
	let run = 0;
	for (const v of SHAKE_TABLE.slice(1, -1)) {
		if (v === 0) { if (run) peaks.push(run); run = 0; continue; }
		if (Math.abs(v) > Math.abs(run)) run = v;
	}
	if (run) peaks.push(run);
	ok(peaks.length >= 6, `the table swings back and forth (${peaks.length} peaks)`);
	ok(peaks.every((v, i) => i === 0 || Math.sign(v) !== Math.sign(peaks[i - 1])),
		'each swing reverses the one before it');
	ok(peaks.every((v, i) => i === 0 || Math.abs(v) <= Math.abs(peaks[i - 1])),
		'and none is bigger than the one before, so it decays');
	eq(Math.max(...SHAKE_TABLE.slice(0, -1).map(Math.abs)), 16, 'peaking at 16');
}

// --- the starting powers are the ones the sources use --------------------------
{
	const powers = [...main.matchAll(/move\.b\s+#(\d+),shake_power\(a5\)/g)]
		.map((m) => Number(m[1]));
	ok(powers.includes(SHAKE_BLOCK_LANDS), `a block landing uses ${SHAKE_BLOCK_LANDS}`);
	ok(powers.includes(SHAKE_EXPLOSION), `an explosion uses ${SHAKE_EXPLOSION}`);
	ok(powers.includes(SHAKE_GRENADE), `a grenade uses ${SHAKE_GRENADE}`);

	// Power is an INDEX, so a smaller number shakes harder. That reads backwards
	// and is the thing most likely to be got wrong later.
	const peak = (from) => Math.max(...SHAKE_TABLE.slice(from, -1).map(Math.abs));
	ok(peak(SHAKE_BLOCK_LANDS) > peak(SHAKE_EXPLOSION),
		'a landing block shakes harder than an explosion');
	ok(peak(SHAKE_EXPLOSION) > peak(SHAKE_GRENADE),
		'and an explosion harder than a grenade');

	const xs = [...main.matchAll(/move\.b\s+#(-?\d+),shake_x\(a5\)/g)].map((m) => Number(m[1]));
	ok(xs.length > 0 && xs.every((v) => v === 0),
		`shake_x is zero at all ${xs.length} call sites, so the shake is vertical only`);
}

// --- running one ---------------------------------------------------------------
{
	const st = createShakeState();
	eq(stepShake(st), 0, 'at rest it offsets nothing');
	ok(!shakeActive(st), 'and reports itself idle');

	startShake(st, SHAKE_BLOCK_LANDS);
	ok(shakeActive(st), 'starting one makes it active');
	const seen = [];
	for (let i = 0; i < 200 && shakeActive(st); i++) seen.push(stepShake(st));
	eq(seen[0], 12, 'the first frame is the first table entry');
	eq(Math.max(...seen.map(Math.abs)), 16, 'it peaks at 16');
	eq(seen.length, SHAKE_TABLE.length - SHAKE_BLOCK_LANDS,
		'and runs the table out exactly once, the terminator included');
	eq(seen[seen.length - 1], 0, 'ending level');
	ok(!shakeActive(st), 'then stops');
	eq(st.offset, 0, 'leaving the screen where it started');
	eq(stepShake(st), 0, 'and stays there');

	// A second landing mid-bounce restarts, as writing shake_power does.
	startShake(st, SHAKE_BLOCK_LANDS);
	for (let i = 0; i < 5; i++) stepShake(st);
	const mid = st.power;
	startShake(st, SHAKE_BLOCK_LANDS);
	ok(st.power < mid, 'a second shake restarts rather than being swallowed');

	startShake(st, 999);
	ok(!shakeActive(st), 'a power past the table is refused');
	startShake(st, -3);
	ok(!shakeActive(st), 'and so is a negative one');
}

// --- the landing gate matches Main.s:4270 --------------------------------------
//
// Two branches are silent for different reasons and they are easy to swap:
// empty space below means still falling, a creature below means squashed.
// Neither gets a thud.
{
	const at = push.indexOf('function blockHasLanded(');
	ok(at > 0, 'the gate is ported');
	const body = push.slice(at, push.indexOf('\n}', at));
	for (const [what, re] of [
		['a floor underfoot lands it', /FLOOR_HERE\) return true/],
		['so does something opaque below', /OPAQUE_BIT\) return true/],
		['empty space below is still falling', /BLOCK_HERE\)\) return false/],
		['a monster below is squashed, not landed on', /t < 16\) return false/],
		['and a player', /t >= 32\) return false/],
		['and a sentry', /t >= 24\) return false/],
	]) ok(re.test(body), what);

	const asm = main.slice(main.indexOf('.do_fall'), main.search(/^.no_sound/m));
	for (const n of [8, 47, 16, 32, 22, 27, 24]) {
		ok(asm.includes(`#(${n}<<block_shift)`), `the source tests block ${n}`);
		ok(body.includes(String(n)), `and the port carries ${n} too`);
	}

	// Wired, or the gate is dead code.
	ok(/onBlockLand\?\.\(/.test(push), 'blocksFall reports a landing');
	ok(/onBlockLand: \(cell\) => blockLanded\(cell\)/.test(mjs), 'and main.js listens');
	const handler = mjs.slice(mjs.indexOf('function blockLanded('), mjs.indexOf('function playLandingSfx('));
	ok(/startShake\(game\.shake, SHAKE_BLOCK_LANDS\)/.test(handler), 'the handler shakes the screen');
	ok(/LAND_EX_BIGCLANG|LAND_MISC_THUD/.test(handler), 'and makes a noise');
	ok(/PLAY_EX_SAMPLE_MEM\s+#28,#1,#153/.test(main),
		'the source plays ex sample 28 at period 153');
	ok(/LAND_EX_BIGCLANG = 28, LAND_EX_PERIOD = 153/.test(mjs), 'and so does the port');
	// The fallback is the sample literally named for this.
	ok(/\{ key: 'BlockThud', period: 600 \}/.test(audio), 'with BlockThud behind it');
}

// --- the offset reaches the screen ---------------------------------------------
{
	ok(/function applyShake\(\)/.test(mjs), 'the offset is pushed to the element');
	const fn = mjs.slice(mjs.indexOf('function applyShake()'));
	const body = fn.slice(0, fn.indexOf('\n}'));
	ok(/translateY/.test(body), 'as a vertical translate');
	ok(!/translateX/.test(body), 'and nothing horizontal');
	ok(/game\.shakeScale/.test(body), 'scaled by the integer upscale, so it moves whole pixels');
	ok(/for \(let i = 0; i < ticks; i\+\+\) stepShake\(game\.shake\)/.test(mjs),
		'and it steps on the 50Hz tick, not per rendered frame');
}

// --- the underwater filter -----------------------------------------------------
//
// An addition: the original filters nothing, Paula just plays a sample at a
// period. So what matters is that it stays out of the way when the party is dry.
{
	const { DRY_HZ, UNDERWATER_HZ } = await import('../src/audio.js');
	ok(DRY_HZ >= 20000, `dry is wide open (${DRY_HZ}Hz), so nothing is coloured above water`);
	ok(UNDERWATER_HZ > 200 && UNDERWATER_HZ < 2000,
		`and submerged is a muffle rather than a mute (${UNDERWATER_HZ}Hz)`);
	ok(/type = 'lowpass'/.test(audio), 'it is a lowpass');
	ok(/setTargetAtTime/.test(audio), 'ramped, so a shoreline does not click');
	ok(/this\.submerged === want/.test(audio), 'and a no-op when nothing changed');

	const fn = mjs.slice(mjs.indexOf('function activePlayerSubmerged()'));
	const body = fn.slice(0, fn.indexOf('\n}'));
	ok(/\(cell & 4\) !== 0/.test(body), 'it tests the water bit');
	ok(/>>> 17\) & 0x3\) >= 2/.test(body), 'and a depth of at least half, as drowning does');
	ok(/game\.players\?\.\[game\.active\]/.test(body), 'for the pane being looked through');

	// The same submerged test drowning uses, or the sound and the damage would
	// disagree about where the surface is.
	const drown = mjs.slice(mjs.indexOf('function stepDrowning('));
	ok(/\(cell & 4\) && waterLevel >= 2/.test(drown.slice(0, 900)),
		'which is the test stepDrowning applies');
}

console.log(`shake and water: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
