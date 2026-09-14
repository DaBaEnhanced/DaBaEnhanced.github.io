// The pain grunt and the death scream.
//
// Two things kept them repeating. decr_fitness rate-limits the grunt behind
// grunt_count -- it plays only once the counter reaches 100 and then resets it
// (Main.s:1482), and the counter ticks once per vblank for every player
// (ColdStartup.s:1215), so that is a two-second cooldown. The port had no
// cooldown at all and grunted on every hit.
//
// The scream is worse. handle_dead has no guard of its own: it sets dead_flag
// and plays the sample every time it is called. What stops it repeating in the
// original is that dead_flag gates the world's interactions with a corpse, so
// nothing keeps damaging it. The port had no such guard, so every further hit
// on a body already at zero fitness ran the whole path again -- grunt, then
// straight back into the death handler, and another scream.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const asm = fs.readFileSync(path.join(REPO, 'Sources', 'Main.s'), 'utf8');
const cold = fs.readFileSync(path.join(REPO, 'Sources', 'ColdStartup.s'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

// --- the cooldown is the source's ------------------------------------------------
{
	const fn = asm.slice(asm.search(/^decr_fitness/m));
	const body = fn.slice(0, 2000);
	const limit = Number(body.match(/cmpi\.w\s+#(\d+),grunt_count\(a0\)/)?.[1]);
	eq(limit, 100, 'decr_fitness grunts only once grunt_count reaches 100');
	ok(/blt\s+\.no_grunt/.test(body), 'and stays silent below it');
	ok(/clr\.w\s+grunt_count\(a0\)/.test(body), 'resetting the counter when it does');

	// Ticked once per vblank, for each of the four players.
	eq((cold.match(/addi\.w\s+#1,variables\+player\d\+grunt_count\(a5\)/g) || []).length, 4,
		'the counter ticks once per vblank for all four players');

	eq(Number(main.match(/const GRUNT_COOLDOWN_TICKS = (\d+);/)?.[1]), limit,
		'and the port uses the same limit');
	ok(/p\.gruntCount = Math\.min\(GRUNT_COOLDOWN_TICKS, \(p\.gruntCount \| 0\) \+ \(ticks \| 0\)\)/.test(main),
		'ticking it on the same 50Hz step as everything else');
	const grunt = main.slice(main.indexOf('function playerGrunt('));
	const gbody = grunt.slice(0, grunt.indexOf('\n}'));
	ok(/< GRUNT_COOLDOWN_TICKS\) return;/.test(gbody), 'the port stays silent below the limit');
	ok(/p\.gruntCount = 0;/.test(gbody), 'and resets on a grunt');
	// The raw call must be gone, or the cooldown is bypassed.
	eq((main.match(/sfxEx\(p\.character\?\.gender === 1 \? 7 : 10/g) || []).length, 1,
		'there is exactly one grunt call site, inside the cooldown');
}

// --- a corpse takes no further damage ---------------------------------------------
{
	ok(/tst\.\w\s+dead_flag2?\(a[01]\)/.test(
		fs.readFileSync(path.join(REPO, 'Sources', 'Controls&Movement.s'), 'utf8')),
		'dead_flag gates interactions with a dead character in the original');

	// handle_dead itself has no guard, which is why the gate has to be upstream.
	const hd = asm.slice(asm.search(/^handle_dead/m), asm.search(/^handle_dead/m) + 400);
	ok(/st\.b\s+dead_flag/.test(hd), 'handle_dead sets the flag');
	ok(!/beq|bne/.test(hd.split('\n').slice(1, 3).join('\n')),
		'and does not check it first, so it would scream again if called again');

	for (const fn of ['damagePlayerFitness', 'decrPlayerFitness']) {
		const at = main.indexOf(`function ${fn}(`);
		ok(at > 0, `${fn} exists`);
		// The whole function, not a fixed window -- damagePlayerFitness runs past
		// 700 characters and the death branch was falling outside it.
		const head = main.slice(at, main.indexOf('\n}', at));
		ok(/if \(p\.dead\) return 0;/.test(head), `${fn} refuses to damage a corpse`);
		// The guard has to come BEFORE the grunt and the death branch.
		ok(head.indexOf('if (p.dead) return 0;') < head.indexOf('fitness === 0'),
			`${fn} checks it before the death branch`);
	}
	const dmg = main.slice(main.indexOf('function damagePlayerFitness('));
	ok(dmg.indexOf('if (p.dead) return 0;') < dmg.indexOf('playerGrunt(p)'),
		'and before the grunt, so a corpse is silent too');
}

// --- the cooldown behaves ----------------------------------------------------------
//
// Replaying the port's own rule: a burst of hits yields one grunt, and the next
// is two seconds away.
{
	const LIMIT = 100;
	let count = LIMIT, grunts = 0;
	const hit = () => { if (count >= LIMIT) { count = 0; grunts++; } };
	const tick = (n) => { count = Math.min(LIMIT, count + n); };

	hit(); hit(); hit(); hit();
	eq(grunts, 1, 'four hits in one frame grunt once');
	tick(50); hit();
	eq(grunts, 1, 'and again half a second later, still once');
	tick(50); hit();
	eq(grunts, 2, 'a full second-hundred later it grunts again');

	// 50Hz, so the cooldown is two seconds.
	eq(LIMIT / 50, 2, 'the cooldown is two seconds at 50Hz');
}


// --- the monster's own attack noise --------------------------------------------
//
// MonsterMovement.s plays it at two sites -- :588 when the blow lands on a
// player, :626 when it lands on a sentry -- both guarded the same way:
//
//   tst.w mdfn_effect(a0) / beq .not_noise
//   PLAY_EX_SAMPLE_RAND mdfn_effect(a0),ch,#63,mdfn_period(a0)
//
// The port had neither, so the only thing audible when something clawed you was
// your own character grunting about it.
{
	const mm = fs.readFileSync(path.join(REPO, 'Sources', 'MonsterMovement.s'), 'utf8');
	const plays = [...mm.matchAll(/PLAY_EX_SAMPLE_RAND\s+mdfn_effect\(a\d\),[^,]+,#63,mdfn_period\(a\d\)/g)];
	eq(plays.length, 2, 'the source plays the def sample at two sites');
	eq((mm.match(/tst\.w\s+mdfn_effect\(a\d\)\s*\n\s*beq/g) || []).length, 2,
		'each guarded on the def actually having one');

	ok(/function monsterAttackSfx\(monster\)/.test(main), 'the port has the handler');
	const fn = main.slice(main.indexOf('function monsterAttackSfx(monster)'));
	const body = fn.slice(0, fn.indexOf('\n}'));
	ok(/if \(!def\?\.sample\) return;/.test(body), 'silent for a def with no sample');
	ok(/sfxEx\(def\.sample/.test(body), 'and plays it from the extra bank');
	ok(/period: def\.samplePeriod/.test(body), 'at the def period');
	// RAND is the period wobble, which playEx applies unless told otherwise.
	ok(!/vary: false/.test(body), 'with the period wobble PLAY_EX_SAMPLE_RAND implies');

	// Wired at both sites, as in the source.
	// Calls, not the definition, which matches the same text.
	eq((main.match(/monsterAttackSfx\(monster\);/g) || []).length, 2,
		'wired for both the player and the sentry hit');

	// It fires before the damage, as the source does -- a kill must not swallow
	// the noise that caused it.
	const hook = main.slice(main.indexOf('onAttackPlayer: (monster, cell, amount)'));
	const hbody = hook.slice(0, hook.indexOf('},'));
	ok(hbody.indexOf('monsterAttackSfx') < hbody.indexOf('damagePlayerFitness'),
		'and before the damage lands');

	// Every def that can attack names a sample, bar the one that cannot.
	const defs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'monsters.json'), 'utf8'));
	const list = defs.monsters || defs;
	const silent = [...new Set(list.filter((d) => d && !d.sample).map((d) => d.name))];
	eq(silent.join(','), 'Shark', 'only the Shark has no attack sample');
	const used = new Set(list.filter((d) => d?.sample).map((d) => d.sample));
	ok(used.size >= 8, `${used.size} distinct attack samples are in use`);
	const { EX_SFX } = await import('../src/audio.js');
	const missing = [...used].filter((n) => !EX_SFX[n]);
	eq(missing.length, 0, `every one of them exists in the extra bank (${missing.join(',') || 'none missing'})`);
}


// --- a location's hit area is its own box, not a fixed circle --------------------
//
// WorldMap.s:775 tests x +/- locn_hit_width and y +/- locn_hit_height. Every
// shipped location carries 10x10, so a marker is reachable 20 pixels across.
// The port used a circle of radius 40 -- four times the real span -- which is
// why a pointer nowhere near a marker still picked one up.
{
	const wm = fs.readFileSync(path.join(__dirname, '..', '..', 'Sources', 'WorldMap.s'), 'utf8');
	ok(/sub\.w\s+locn_hit_width\(a0\),d3/.test(wm), 'the source subtracts the hit width');
	ok(/add\.w\s+locn_hit_width\(a0\),d4/.test(wm), 'and adds it, so it is a box');

	const shell = fs.readFileSync(path.join(__dirname, '..', 'src', 'shell.js'), 'utf8');
	const fn = shell.slice(shell.indexOf('export function pickWorldMarker('));
	const body = fn.slice(0, fn.indexOf('\n}'));
	ok(/l\.hitWidth/.test(body) && /l\.hitHeight/.test(body),
		'the port reads each location\'s own hit box');
	ok(/Math\.abs\(dx\) > hw \|\| Math\.abs\(dy\) > hh/.test(body), 'as a box test');
	ok(!/bestD < 1600/.test(body), 'and no longer a radius-40 circle');

	// The data the fields carry, measured rather than assumed.
	const dir = path.join(__dirname, '..', 'assets', 'maps');
	const sizes = new Set();
	for (const f of fs.readdirSync(dir)) {
		if (!f.endsWith('.json') || /^campaign|^maps\.json/.test(f)) continue;
		const l = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).locn || {};
		sizes.add(`${l.hitWidth}x${l.hitHeight}`);
	}
	eq([...sizes].join(','), '10x10', 'every shipped location is a 10x10 box');
}

// --- walking into a party member trades places ------------------------------------
//
// Controls&Movement.s:4476 swaps xpos/ypos and mem_position outright. The gate
// reads backwards: beq .same_player jumps INTO the swap when both share a
// control method, and only a pair on DIFFERENT inputs needs a mutual bump.
// Every character in this port shares one input, so it always applies.
{
	const cm = fs.readFileSync(path.join(__dirname, '..', '..', 'Sources', 'Controls&Movement.s'), 'utf8');
	// The label, not the bsr.s that targets it -- and anchored on the label
	// rather than on control_method, which the control dispatch table reads
	// identically some 700 lines earlier.
	const at = cm.search(/^\.swap_player/m);
	const body = cm.slice(at, at + 900);
	ok(/beq\.s\s+\.same_player/.test(body), 'a shared control method goes straight to the swap');
	ok(/move\.b\s+xpos\(a1\),d0[\s\S]{0,80}move\.b\s+xpos\(a0\),xpos\(a1\)/.test(body),
		'and the swap exchanges positions');

	ok(/function swapWithPartyMember\(p, target\)/.test(main), 'the port has the swap');
	const fn = main.slice(main.indexOf('function swapWithPartyMember(p, target)'));
	const sbody = fn.slice(0, fn.indexOf('\n}'));
	ok(/p\.x = other\.x; p\.y = other\.y; p\.floor = other\.floor;/.test(sbody),
		'exchanging both positions');
	ok(/putHeadInMap\(game\.cells, other\)/.test(sbody), 'and re-stamping the other one');
	ok(/removeHeadFromMap\(game\.cells, other\.x/.test(sbody), 'after lifting them out first');
	// The footstep, skipped mid-shot as .firing skips it.
	ok(/if \(!p\.fireAnim\) sfxMisc\(8/.test(sbody), 'with a footstep unless mid-shot');
	ok(/MOVE\.BUMPED_PLAYER && swapWithPartyMember\(p, target\)/.test(main),
		'wired to walking into one');
}

console.log(`death sfx: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
