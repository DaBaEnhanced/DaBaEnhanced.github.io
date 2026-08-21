'use strict';
// Convert every 8SVX sound effect to WAV and emit a manifest.
//   node build-audio.js

const fs = require('fs');
const path = require('path');
const { decode8SVX } = require('./lib/svx8');
const { encodeWAV8 } = require('./lib/wav');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets', 'audio');

const SOURCES = [
	['Audio/Effects', 'effects'],
	['Audio/ExtraEffects', 'extra'],
];

fs.mkdirSync(OUT, { recursive: true });
const manifest = { sfx: [] };
let ok = 0, failed = 0, totalBytes = 0;

for (const [rel, group] of SOURCES) {
	const dir = path.join(REPO, rel);
	if (!fs.existsSync(dir)) { console.warn(`missing ${rel}`); continue; }
	const groupDir = path.join(OUT, group);
	fs.mkdirSync(groupDir, { recursive: true });

	for (const file of fs.readdirSync(dir)) {
		if (!file.toLowerCase().endsWith('.8svx')) continue;
		const src = path.join(dir, file);
		const key = file.replace(/\.8svx$/i, '');
		try {
			const snd = decode8SVX(fs.readFileSync(src));
			const wav = encodeWAV8(snd.samples, snd.sampleRate);
			const outName = `${key}.wav`;
			fs.writeFileSync(path.join(groupDir, outName), wav);
			manifest.sfx.push({
				key, group,
				file: `audio/${group}/${outName}`,
				name: snd.name || undefined,
				sampleRate: snd.sampleRate,
				samples: snd.samples.length,
				seconds: +(snd.samples.length / snd.sampleRate).toFixed(3),
				// A non-zero repeat section means the effect loops (atmospheres).
				loop: snd.repeat > 0
					? { start: snd.oneShot, length: snd.repeat }
					: undefined,
				compressed: snd.compression === 1 || undefined,
			});
			totalBytes += wav.length;
			ok++;
		} catch (e) {
			console.log(`  FAIL ${group}/${file}: ${e.message}`);
			failed++;
		}
	}
}

// Pick up hand-added .wav files sitting in the output group folders -- sounds
// this port needs that the original has no sample for (e.g. item pickup).
// Without this, re-running the tool would leave them out of the manifest and
// they would silently never load.
for (const [, group] of SOURCES) {
	const groupDir = path.join(OUT, group);
	if (!fs.existsSync(groupDir)) continue;
	for (const file of fs.readdirSync(groupDir)) {
		if (!file.toLowerCase().endsWith('.wav')) continue;
		const key = file.replace(/\.wav$/i, '');
		if (manifest.sfx.some((s) => s.key === key)) continue;   // came from an 8SVX
		const buf = fs.readFileSync(path.join(groupDir, file));
		const sampleRate = buf.readUInt32LE(24);
		const bits = buf.readUInt16LE(34);
		const channels = buf.readUInt16LE(22);
		const frames = (buf.length - 44) / Math.max(1, (bits / 8) * channels);
		manifest.sfx.push({
			key, group,
			file: `audio/${group}/${file}`,
			sampleRate,
			samples: frames,
			seconds: +(frames / sampleRate).toFixed(3),
			// Not a Paula sample, so it has no authored period: it plays at its
			// own rate (playKey uses rate 1 when no period is given).
			added: true,
		});
		console.log(`  + ${group}/${file} (hand-added, ${sampleRate}Hz)`);
	}
}

manifest.sfx.sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key));
fs.writeFileSync(path.join(OUT, 'sfx.json'), JSON.stringify(manifest, null, '\t'));

const looping = manifest.sfx.filter((s) => s.loop).length;
const totalSecs = manifest.sfx.reduce((n, s) => n + s.seconds, 0);
console.log(`${ok} effects converted, ${failed} failed`);
console.log(`  ${looping} looping, ${totalSecs.toFixed(1)}s total, ${(totalBytes / 1024).toFixed(0)} KB of WAV`);
const rates = new Map();
for (const s of manifest.sfx) rates.set(s.sampleRate, (rates.get(s.sampleRate) || 0) + 1);
console.log(`  sample rates: ${[...rates.entries()].sort((a, b) => b[1] - a[1])
	.map(([r, n]) => `${r}Hz x${n}`).join(', ')}`);
