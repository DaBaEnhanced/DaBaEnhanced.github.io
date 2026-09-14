// Sound coverage: every noise the original makes, against every noise the port
// makes.
//
// This axis has been the productive one -- the wrong sample bank, the silent
// grenade launcher, the missing monster attack, and then six more found by
// enumerating the sources. So rather than check the six by hand, this walks
// ALL the PLAY_* call sites in the assembly and requires each sample index to
// be reachable from the port. A new one that nobody wired up fails here.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EX_SFX, MISC_SFX, MORE_SFX } from '../src/audio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'Sources');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const eq = (a, b, m) => ok(a === b, `${m} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const files = ['Main.s', 'Controls&Movement.s', 'ItemUsage.s', 'MonsterMovement.s', 'ColdStartup.s'];
const asm = Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(SRC, f), 'utf8')]));
const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const all = [main,
	fs.readFileSync(path.join(__dirname, '..', 'src', 'combat.js'), 'utf8'),
	fs.readFileSync(path.join(__dirname, '..', 'src', 'sentries.js'), 'utf8'),
	fs.readFileSync(path.join(__dirname, '..', 'src', 'audio.js'), 'utf8'),
].join('\n');

// --- every literal sample the sources play -----------------------------------------
{
	const exWanted = new Set(), miscWanted = new Set();
	for (const text of Object.values(asm)) {
		for (const m of text.matchAll(/PLAY_EX_SAMPLE(?:_RAND2?|_MEM)?\s+#(\d+),/g)) {
			exWanted.add(Number(m[1]));
		}
		// PLAY_SAMPLE a1,#9,... and PLAY_SAMPLE_MEM a2,#2,... -- the bank index
		// is the first #n after the address register.
		for (const m of text.matchAll(/PLAY_SAMPLE(?:_MEM)?\s+\w+,#(\d+),/g)) {
			miscWanted.add(Number(m[1]));
		}
	}
	ok(exWanted.size > 10, `the sources name ${exWanted.size} extra samples by number`);
	ok(miscWanted.size > 5, `and ${miscWanted.size} misc samples`);

	// Every one has to exist in the bank the port carries.
	const exMissing = [...exWanted].filter((n) => !EX_SFX[n]).sort((a, b) => a - b);
	eq(exMissing.length, 0, `every extra sample exists (${exMissing.join(',') || 'none missing'})`);
	const miscMissing = [...miscWanted].filter((n) => !MISC_SFX[n]).sort((a, b) => a - b);
	eq(miscMissing.length, 0, `every misc sample exists (${miscMissing.join(',') || 'none missing'})`);

	// And every one has to be REACHABLE from the port -- named in a call, or in a
	// constant that feeds one. A sample that exists but nothing plays is the gap
	// this file is here to catch.
	const reachable = (n) => new RegExp(`\\b${n}\\b`).test(all);
	const exUnplayed = [...exWanted].filter((n) => !reachable(n)).sort((a, b) => a - b);
	eq(exUnplayed.length, 0,
		`every extra sample the sources play is reachable from the port ` +
		`(unplayed: ${exUnplayed.map((n) => `${n}:${EX_SFX[n]}`).join(', ') || 'none'})`);
}

// --- the six found by the audit, pinned individually --------------------------------
//
// Named rather than left to the sweep above, because each has a period, a gate
// or a volume that the sweep cannot see.
{
	// 1. The blast, with its period chosen by density (Main.s:2711).
	// The label, not the branch that targets it further up.
	const expl = asm['Main.s'].slice(asm['Main.s'].search(/^\.do_explosion/m));
	const periods = [...expl.slice(0, 900).matchAll(/move\.w\s+#(\d+),d3/g)].map((m) => Number(m[1]));
	eq(periods.sort((a, b) => a - b).join(','), '256,276,296,316',
		'the four blast periods come from the density');
	const portPeriods = JSON.parse(main.match(/const EXPLOSION_PERIOD = (\[[^\]]+\])/)[1]);
	eq(portPeriods.join(','), '256,276,296,316', 'and the port has all four');
	eq(Number(main.match(/const EXPLOSION_SAMPLE = (\d+)/)?.[1]), 26, 'played as extra sample 26');
	ok(/hooks\.onExplosion\?\.\(slot\.density\)/.test(all), 'combat.js reports every blast');
	ok(/onExplosion: \(density\) => explosionSfx\(density\)/.test(main), 'and main.js plays it');

	// 2/3. Sentries and monsters firing: extra sample 8 at period 95.
	ok(/PLAY_EX_SAMPLE_MEM\s+#8,#1,#95/.test(asm['Main.s']), 'sentry_fire plays sample 8 at 95');
	ok(/PLAY_EX_SAMPLE_MEM\s+#8,#1,#95/.test(asm['MonsterMovement.s']), 'and so does a monster');
	eq(Number(main.match(/const GUN_SAMPLE = (\d+), GUN_PERIOD = (\d+)/)?.[1]), 8, 'the port matches');
	eq(Number(main.match(/GUN_PERIOD = (\d+)/)?.[1]), 95, 'at the same period');
	ok(/hooks\.onSentryFire\?\.\(s\)/.test(all), 'sentries report firing');
	ok(/onSentryFire: \(\) => rangedFireSfx\(\)/.test(main), 'and it is wired');
	ok(/addFireball: \(from, opts\) => \{ rangedFireSfx\(\)/.test(main),
		'a monster firing is audible too');

	// 4. Weapon impact: three outcomes, volume falling with distance.
	const cold = asm['ColdStartup.s'];
	ok(/PLAY_EX_SAMPLE_RAND\s+#29,#2,d4,#128/.test(cold), 'the ricochet is sample 29 at 128');
	ok(/PLAY_EX_SAMPLE_RAND\s+#11,#2,d4,#150/.test(cold), 'the door clang is 11 at 150');
	ok(/PLAY_SAMPLE\s+a1,#9,#2,d4,#428/.test(cold), 'and the thud is misc 9 at 428');
	eq(Number(main.match(/const IMPACT_RICOCHET = (\d+)/)?.[1]), 29, 'the port ricochets with 29');
	eq(Number(main.match(/const IMPACT_DOOR = (\d+)/)?.[1]), 11, 'clangs with 11');
	eq(Number(main.match(/const IMPACT_THUD = (\d+)/)?.[1]), 9, 'and thuds with 9');
	// Volume: 63 to start, 10 a cell, floored (ItemUsage.s:468, 496).
	ok(/move\.b\s+#63,fire_dist_vol\(a0\)/.test(asm['ItemUsage.s']), 'volume starts at 63');
	ok(/sub\.b\s+#10,fire_dist_vol\(a0\)/.test(asm['ItemUsage.s']), 'and drops 10 a cell');
	ok(/Math\.max\(0, 63 - 10 \* \(target\.dist \| 0\)\)/.test(main), 'which the port reproduces');
	// The weapons that never ricochet.
	ok(/exSample === 24 \|\| meta\?\.sample === 8 \|\| meta\?\.sample === 9/.test(main),
		'and the three weapon classes that never ricochet are excluded');
	ok(/weaponImpactSfx\(meta, target\)/.test(main), 'the impact is wired to firing');

	// 5. Two reload sounds, not one.
	ok(/cmp\.w\s+#22,item_exsample\(a1\)/.test(asm['Controls&Movement.s']),
		'the machine-gun reload is keyed on extra sample 22');
	ok(/cmp\.b\s+#49,itemgun_clip1\(a1\)/.test(asm['Controls&Movement.s']),
		'and the beam reload on clip 49');
	eq(Number(main.match(/RELOAD_MG = (\d+)/)?.[1]), 32, 'the port plays 32 for the first');
	eq(Number(main.match(/RELOAD_BEAM = (\d+)/)?.[1]), 25, 'and 25 for the second');
	ok(/function reloadSfx\(meta\)/.test(main), 'behind one chooser');
	ok(!/sfxEx\(25, \{ period: 271, vary: false \}\);\s*\n\s*status\(`reloaded/.test(main),
		'and no longer plays the beam sound for everything');

	// 6. The blaster's substitution.
	ok(/cmpi\.b\s+#18,item_image\(a1\)/.test(asm['ItemUsage.s']), 'the blaster is keyed on image 18');
	eq(Number(main.match(/const BLASTER_IMAGE = (\d+)/)?.[1]), 18, 'the port agrees');
	eq(Number(main.match(/BLASTER_SAMPLE = (\d+)/)?.[1]), 30, 'and swaps in sample 30');
	const fire = main.slice(main.indexOf('function fireItemSfx(meta)'));
	ok(fire.indexOf('BLASTER_IMAGE') < fire.indexOf('meta.exSample'),
		'checked before the normal sample, as the source does');
}

console.log(`sfx coverage: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
