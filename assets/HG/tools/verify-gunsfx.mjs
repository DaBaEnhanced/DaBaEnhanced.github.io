// Which sample bank an item fires with, and where its muzzle flash sits.
//
// Two separate mistakes that both showed up as "the guns are wrong".
//
// The game has TWO 8SVX banks. MiscSFX holds nine world noises -- blocks,
// doors, footsteps. MoreSFX holds ten effects -- the guns, the arc, the cast.
// An item's `sample` field indexes the SECOND one (Main.s:1013 loads moresfx
// before indexing by fx_sample), and the port was reading it out of the first,
// so a sniper rifle fired with a block-sliding noise and every psi amp, which
// asks for slot 10, was silent because MiscSFX has no tenth entry.
//
// Separately, muzzle_flash adds fire_x to the sprite's X and never touches its
// Y. The port jittered both, which pushed the bottom of the flash off the pane.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MISC_SFX, MORE_SFX, MORE_PINNED_PERIOD } from '../src/audio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const A = path.join(__dirname, '..', 'assets');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/** Read a bank definition: the incbin order is the sample order. */
function bank(file) {
	const text = fs.readFileSync(file, 'utf8');
	const out = [null];
	for (const m of text.matchAll(/^sample(\d+)\s*(?:incbin\s+"[^"]*\/([^/"]+)\.8svx")?\s*(?:;\s*([\d,]+))?/gim)) {
		const idx = Number(m[1]);
		out[idx] = m[2] ? { key: m[2], period: Number((m[3] || '').split(',')[0]) || 0 } : null;
	}
	return out;
}

const more = bank(path.join(REPO, 'Data', 'GameFast.dat', 'MoreSFX.s'));
const misc = bank(path.join(REPO, 'Data', 'GameChip.dat', 'MiscSFX.s'));

// --- both banks are transcribed correctly ---------------------------------------
{
	eq(more.length, 11, 'MoreSFX declares ten slots');
	eq(MORE_SFX.length, more.length, 'and the port has the same number');
	for (let i = 1; i < more.length; i++) {
		const want = more[i], got = MORE_SFX[i];
		if (!want) { eq(got, null, `slot ${i} is a hole in the bank`); continue; }
		ok(got, `slot ${i} is present`);
		eq(got?.key.toLowerCase(), want.key.toLowerCase(), `slot ${i} is ${want.key}`);
		eq(got?.period, want.period, `slot ${i} carries its own period`);
	}
	// Slot 6 has a label and no incbin. Nothing must reach for it.
	eq(MORE_SFX[6], null, 'slot 6 is the hole');

	// MiscSFX is the other bank and must stay as it is.
	for (let i = 1; i < misc.length; i++) {
		eq(MISC_SFX[i]?.key.toLowerCase(), misc[i].key.toLowerCase().replace('dooropened&closed', 'doorclosed'),
			`misc slot ${i} is unchanged`);
	}
	ok(MISC_SFX.length < MORE_SFX.length,
		'MiscSFX is the shorter bank, which is why slot 10 used to be silent');
}

// --- every gun now names a real sample ------------------------------------------
{
	const items = JSON.parse(fs.readFileSync(path.join(A, 'items.json'), 'utf8')).items;
	const used = new Set(items.filter((i) => i.sample).map((i) => i.sample));
	ok(used.size > 0, 'items name samples');
	const missing = [...used].filter((n) => !MORE_SFX[n]);
	eq(missing.length, 0, `every sample an item names exists (missing ${missing.join(',') || 'none'})`);
	// The one that used to fall off the end.
	ok(used.has(10), 'items do reach slot 10');
	eq(MISC_SFX[10], undefined, 'which the misc bank has no entry for');
	eq(MORE_SFX[10]?.key, 'Cast', 'but the more bank does');

	// Named cases, and the giveaway: several items ask for exactly the period
	// written beside the incbin, which is what identifies the bank.
	const byName = (re) => items.find((i) => re.test((i.header || []).join(' ')));
	const sniper = byName(/^SNIPER RIFLE/);
	eq(sniper.sample, 1, 'the sniper rifle names slot 1');
	eq(MORE_SFX[1].key, 'NewGun1', 'which is a gun, not BlockSlide');
	const stunner = byName(/SONIC STUNNER/);
	eq(stunner.sample, 9, 'the sonic stunner names slot 9');
	eq(MORE_SFX[9].key, 'Arc', 'which is the arc, not Bump');
	eq(stunner.samplePeriod, MORE_SFX[9].period,
		'and asks for exactly the period MoreSFX writes beside it');
	const laser = byName(/NEUTRON-FLUX/);
	eq(MORE_SFX[laser.sample].key, 'LaserCrack', 'the laser cannon gets LaserCrack');
	eq(laser.samplePeriod, MORE_SFX[laser.sample].period, 'at its own period too');
}

// --- the pinned periods ---------------------------------------------------------
//
// Main.s:1026 hands most slots the item's period but pins 3 and 4.
{
	const asm = fs.readFileSync(path.join(REPO, 'Sources', 'Main.s'), 'utf8');
	// '.no_gun' is a branch target long before it is a label, so end the slice
	// on the label definition at the start of a line.
	const at = asm.indexOf('tst.b\tvariables+fx_sample(a5)');
	const body = asm.slice(at, at + asm.slice(at).search(/^\.no_gun/m));
	eq(Object.keys(MORE_PINNED_PERIOD).sort().join(','), '3,4', 'only two slots are pinned');
	eq(MORE_PINNED_PERIOD[3], 360, 'slot 3 is pinned to 360');
	eq(MORE_PINNED_PERIOD[4], 380, 'slot 4 is pinned to 380');
	ok(/#360,d3/.test(body) && /#380,d3/.test(body), 'which is what the source writes');
	// Everything else reads fx_period, the item's own.
	for (const n of [1, 2, 5, 7, 8, 9, 10]) {
		eq(MORE_PINNED_PERIOD[n], undefined, `slot ${n} takes the item's period`);
	}
}

// --- the sample files are actually there -----------------------------------------
{
	const sfx = JSON.parse(fs.readFileSync(path.join(A, 'audio', 'sfx.json'), 'utf8'));
	for (const rec of MORE_SFX) {
		if (!rec) continue;
		const e = sfx.sfx.find((s) => s.key === rec.key);
		ok(e, `${rec.key} ships`);
		ok(e && e.seconds > 0.05, `${rec.key} is not an empty clip (${e?.seconds}s)`);
	}
}

// --- and the port plays from the right bank ---------------------------------------
{
	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	ok(/else if \(meta\.sample\) sfxMore\(/.test(main),
		"an item's own sample goes to the more bank");
	ok(!/else if \(meta\.sample\) sfxMisc\(/.test(main),
		'and not to the misc bank');
	ok(/function sfxMore\(/.test(main), 'the helper exists');
}

// --- the muzzle flash is jittered horizontally only --------------------------------
{
	const cold = fs.readFileSync(path.join(REPO, 'Sources', 'ColdStartup.s'), 'utf8');
	// Same trap: 'muzzle_flash' is a bsr target before it is a label.
	const at = cold.search(/^muzzle_flash/m);
	const body = cold.slice(at, at + cold.slice(at).search(/^.no_anim/m));
	ok(/add\.w\s+fire_x\(a0\),d0/.test(body), 'muzzle_flash adds fire_x to the sprite X');
	ok(!/add\.w\s+fire_y\(a0\),d1/.test(body), 'and never adds fire_y to its Y');
	// The shake does reach it, which is why the port moves the whole screen.
	ok(/add\.w\s+variables\+shake\(a5\),d1/.test(body), 'the shake does reach it');

	// muzzle_hit, the splat at the far end, reads both -- so fire_y still matters.
	const hit = cold.slice(cold.search(/^muzzle_hit/m));
	ok(/move\.w\s+fire_x\(a0\),d0/.test(hit.slice(0, 400)), 'muzzle_hit reads fire_x');
	ok(/move\.w\s+fire_y\(a0\),d2/.test(hit.slice(0, 400)), 'and fire_y');

	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	const draw = main.slice(main.indexOf('function drawFireEffects('));
	const flash = draw.slice(0, draw.indexOf('const hit ='));
	ok(/MUZZLE_X[\s\S]*p\.fireX/.test(flash), 'the port jitters the flash in X');
	ok(!/p\.fireY/.test(flash), 'and no longer in Y');
	ok(/gadgetY \+ MUZZLE_Y/.test(flash), 'its Y is fixed');

	// Both sprites are hardware sprites, so their coordinates carry a display
	// origin that has to come off. Horizontally that is the 128 the expressions
	// are written against; vertically it is 39, NOT the 41 they are written
	// against -- the copper puts DIWSTRT at $27. Getting that wrong put both
	// sprites two rows high, which is what was seen on screen.
	const num = (k) => {
		const m = main.match(new RegExp(`const ${k} = ([^;]+);`));
		if (!m) return NaN;
		return Function(`'use strict';const MUZZLE_ORIGIN_X=${128},MUZZLE_ORIGIN_Y=${39};return ${m[1]}`)();
	};
	eq(num('MUZZLE_ORIGIN_X'), 128, 'the horizontal origin is the 128 in the expressions');
	eq(num('MUZZLE_ORIGIN_Y'), 39, 'the vertical origin is 39, from DIWSTRT');
	// $27 is what shake_screen patches DIWSTRT to, and it is where 39 comes from.
	const mainAsm = fs.readFileSync(path.join(REPO, 'Sources', 'Main.s'), 'utf8');
	ok(/dc\.w\s+\$27,diw_strt\+2/.test(mainAsm), 'which is the $27 the copper table writes');
	eq(num('MUZZLE_X'), 73 - 32, 'flash X is 73-32 across');
	eq(num('MUZZLE_Y'), 41 + 51 - 1 + 8 - 39, 'flash Y is 60 down');
	eq(num('MUZZLE_HIT_X'), 73, 'splat X is 73 across');
	eq(num('MUZZLE_HIT_Y'), 41 + 57 - 39, 'splat Y is 59 down');
	// The splat comes off the same origin, so it must take the same correction.
	eq(num('MUZZLE_Y') - (41 + 51 - 1 + 8 - 41), num('MUZZLE_HIT_Y') - (41 + 57 - 41),
		'flash and splat are corrected by the same amount');

	// The source adds a further 8 for players 3 and 4 (Main.s:4995). That is NOT
	// reproduced: PANE_ORIGINS already carries those rows as BAND_GAP, which the
	// original's 212-row screen does not have, so taking both put the flash a
	// whole band below the view it belongs to.
	ok(!/p\.index >= 2 \? 8 : 0/.test(draw.slice(0, 1200)),
		'the bottom panes do not take the source 8 twice');
	ok(/const gadgetY = oy - 2;/.test(draw), 'their gadget origin is just oy-2');
	// And the tuning hook is gone now the value is settled.
	ok(!/muzzleNudge/.test(main), 'the runtime nudge hook has been removed');
	// But the splat still uses both, or the far-end hit stops moving.
	ok(/hit\.x/.test(draw) && /hit\.y/.test(draw), 'while the splat still uses both');
	const hitFn = main.slice(main.indexOf('function fireHitSprite('));
	ok(/p\.fireX \| 0/.test(hitFn.slice(0, 300)) && /p\.fireY \| 0/.test(hitFn.slice(0, 300)),
		'which is where fire_y is still read');
}

// --- everything that shares do_fx makes a noise ------------------------------------
//
// .use_gun, .use_launcher, .use_flamer, .use_grlauncher and .use_mine all end on
// `bra do_fx`, the routine that plays the item's own sample. The port inlined
// that in useWeapon only, so the grenade launcher and the mine fired silently.
{
	const usage = fs.readFileSync(path.join(REPO, 'Sources', 'ItemUsage.s'), 'utf8');
	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

	// Which use routines reach do_fx, read out of the source rather than listed.
	const reaching = new Set();
	let current = null;
	for (const line of usage.split('\n')) {
		const m = line.match(/^\.(use_\w+)/);
		if (m) current = m[1];
		if (current && /\bdo_fx\b/.test(line) && !/^do_fx/.test(line)) reaching.add(current);
	}
	for (const r of ['use_gun', 'use_launcher', 'use_flamer', 'use_grlauncher', 'use_mine']) {
		ok(reaching.has(r), `.${r} reaches do_fx`);
	}
	// The sentry does not, so it is legitimately silent.
	ok(!reaching.has('use_sentry'), '.use_sentry does not, so silence there is correct');

	// One helper, or they drift apart again.
	ok(/function fireItemSfx\(meta\)/.test(main), 'the port has one shared do_fx helper');
	const helper = main.slice(main.indexOf('function fireItemSfx(meta)'));
	const body = helper.slice(0, helper.indexOf('\n}'));
	ok(/meta\.exSample/.test(body) && /sfxMore\(meta\.sample/.test(body),
		'which prefers an extra sample and falls back to the moresfx slot');

	const fn = (name) => {
		const at = main.indexOf(`function ${name}(`);
		return at < 0 ? '' : main.slice(at, main.indexOf('\n}\n', at));
	};
	for (const name of ['useWeapon', 'useGrenadeLauncher', 'useMine']) {
		ok(/fireItemSfx\(meta\)/.test(fn(name)), `${name} plays the item's sample`);
	}
	// And nobody kept a private copy of the branch.
	eq((main.match(/if \(meta\.exSample\) sfxEx/g) || []).length, 1,
		'the exSample branch exists in exactly one place');

	// The launcher's own empty-click is moresfx 3, written straight to fx_sample
	// rather than routed through do_fx, so it is that bank whatever else is
	// loaded (ItemUsage.s:370).
	// The label, not the beq that jumps to it 48 lines earlier.
	const grAsm = usage.slice(usage.search(/^.no_gr_ammo/m));
	ok(/move\.b\s+#3,variables\+fx_sample\(a5\)/.test(grAsm.slice(0, 200)),
		'the launcher out-of-ammo click is sample 3');
	ok(/move\.w\s+#360,variables\+fx_period\(a5\)/.test(grAsm.slice(0, 200)),
		'at period 360');
	eq(MORE_SFX[3]?.key, 'GunEmpty', 'which is GunEmpty');
	eq(MORE_PINNED_PERIOD[3], 360, 'and 360 is the pinned period for that slot');
	ok(/sfxMore\(3\);/.test(fn('useGrenadeLauncher')), 'the port plays it');
}

// --- grenades: the height lift is a divergence, and it has to recede ----------------
//
// A grenade carries its height in the cell's variant, but all its bobs have
// control 0, so blit_block (Drawviews.s:3741) falls through to block_draw and
// never reaches .mirror -- the only place a variant becomes a vertical offset,
// and that is the door splitting in two. The original therefore draws a grenade
// at the same spot in its cell whatever its height.
//
// The port lifts it anyway, because a thrown grenade's arc reads better for it.
// What it must not do is lift by a flat pixel count: a launched grenade flies at
// a constant height 25 with no ballistics, so a flat lift pinned it 25 rows up
// the pane for the whole flight and it looked like it was climbing. Scaling by
// depth -- the same 23/13/10/6 the source uses for the door -- makes the lift
// shrink as it travels away.
{
	const exgfx = JSON.parse(fs.readFileSync(path.join(A, 'exgfx.json'), 'utf8'));
	for (const b of [22, 23]) {
		const blk = exgfx.blocks.find((x) => x.block === b);
		ok(blk, `exgfx block ${b} exists`);
		const controls = new Set((blk.slots || []).filter(Boolean).map((s) => s.control));
		eq([...controls].join(','), '0', `every slot of block ${b} has control 0`);
	}
	const draw = fs.readFileSync(path.join(REPO, 'Sources', 'Drawviews.s'), 'utf8');
	const bb = draw.slice(draw.search(/^blit_block/m));
	ok(/cmpi\.w\s+#3,d4\s*\n\s*bgt\.s\s+\.mirror/.test(bb.slice(0, 600)),
		'.mirror is reached only when control > 3, so never for a grenade');

	// The scale is the source's own, read back out of it.
	const view = fs.readFileSync(path.join(__dirname, '..', 'src', 'view.js'), 'utf8');
	const scale = JSON.parse(view.match(/const HEIGHT_SCALE = (\[[^\]]+\])/)[1]);
	eq(scale.join(','), '23,13,10,6', 'the depth scale is the door table ratios');
	ok(/dist2\s+dc\.b\s+\(dh1\*13\)\/23/.test(draw), 'which is 13/23 in the second band');
	ok(/dist3\s+dc\.b\s+\(dh1\*10\)\/23/.test(draw), 'and 10/23 in the third');
	ok(/dist4\s+dc\.b\s+\(dh1\*6\)\/23/.test(draw), 'and 6/23 in the fourth');

	// The behaviour that was wrong both ways round.
	const lift = (h, d) => Math.floor(((h & 31) * scale[d]) / 23);
	eq(lift(25, 0), 25, 'a launched grenade is lifted 25 rows right in front of you');
	ok(lift(25, 3) < 10, `and only ${lift(25, 3)} at the far band, so it recedes`);
	ok(lift(25, 0) > lift(25, 1) && lift(25, 1) > lift(25, 2) && lift(25, 2) > lift(25, 3),
		'the lift falls away monotonically with distance');
	eq(lift(0, 0), 0, 'a grenade on the ground is not lifted at any depth');
	eq(lift(0, 3), 0, 'at any depth');

	// Only grenades. Sentries are 24-27 and their variant is a facing.
	ok(/L\.ex === 22 \|\| L\.ex === 23/.test(view), 'the lift is gated to blocks 22 and 23');
	const comp = fs.readFileSync(path.join(__dirname, '..', 'src', 'compositor.js'), 'utf8');
	ok(/clipY0 \+ \(s\.dy \|\| 0\)/.test(comp), 'and the compositor applies it');
	ok(!/-\(s\.variant \|\| 0\)/.test(comp), 'not the flat one it used to');
}

// --- and they make a noise when they go off ------------------------------------------
{
	const asm = fs.readFileSync(path.join(REPO, 'Sources', 'Main.s'), 'utf8');
	const expl = asm.slice(asm.search(/^\.explosion/m));
	const body = expl.slice(0, expl.search(/^\.end\b/m));
	// Both kinds: sample 7 at period 550.
	eq((body.match(/move\.b\s+#7,variables\+fx_sample\(a5\)/g) || []).length, 2,
		'both grenade kinds play sample 7');
	eq((body.match(/move\.w\s+#550,variables\+fx_period\(a5\)/g) || []).length, 2,
		'both at period 550');
	eq(MORE_SFX[7]?.key, 'Explosion', 'slot 7 is the explosion');

	// And both shake, a stun less hard than a live one. Power is an index, so
	// the stun's larger number is the weaker shake.
	const powers = [...body.matchAll(/move\.b\s+#(\d+),shake_power\(a5\)/g)].map((m) => Number(m[1]));
	eq(powers.length, 2, 'both kinds shake the screen');
	ok(powers.includes(20) && powers.includes(17), 'at powers 20 and 17');

	const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
	eq(Number(main.match(/const GRENADE_EXPL_SAMPLE = (\d+)/)?.[1]), 7, 'the port plays slot 7');
	eq(Number(main.match(/GRENADE_EXPL_PERIOD = (\d+)/)?.[1]), 550, 'at 550');
	const fn = main.slice(main.indexOf('function grenadeExploded('));
	const fnBody = fn.slice(0, fn.indexOf('\n}'));
	ok(/sfxMore\(GRENADE_EXPL_SAMPLE/.test(fnBody), 'from the moresfx bank');
	ok(/stun \? SHAKE_GRENADE : SHAKE_EXPLOSION/.test(fnBody),
		'and shakes harder for a live grenade than a stun');

	// Wired, or it is dead code. The hook fires for BOTH kinds, which is what
	// makes a thrown grenade audible as well as a launched one.
	const combat = fs.readFileSync(path.join(__dirname, '..', 'src', 'combat.js'), 'utf8');
	ok(/hooks\.onGrenadeExplode\?\.\(at, !!g\.type\)/.test(combat),
		'explodeGrenade reports every explosion');
	const ex = combat.slice(combat.indexOf('function explodeGrenade('));
	const exBody = ex.slice(0, ex.indexOf('\n}\n'));
	ok(exBody.indexOf('onGrenadeExplode') > exBody.indexOf('if (!g.type)'),
		'after both the live and stun branches, so neither is silent');
	ok(/onGrenadeExplode: \(_cell, stun\) => grenadeExploded\(stun\)/.test(main),
		'and main.js listens');
}

console.log(`gun sfx and muzzle: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
