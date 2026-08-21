'use strict';
// Extract the MED (MMD0) music modules: song structure and patterns to JSON,
// instrument PCM to WAV. The replayer itself lives in the runtime; this step
// just gets the data out of the Amiga containers losslessly.

const fs = require('fs');
const path = require('path');
const { parseMED } = require('./lib/med');
const { encodeWAV8 } = require('./lib/wav');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets', 'music');

// Instrument PCM is stored untuned; MED plays it back via Amiga periods, so a
// nominal rate is used for the WAV container and the replayer repitches.
const NOMINAL_RATE = 8363;

function findModules() {
	const found = [];
	const seen = new Set();
	const roots = ['Data', 'Test/HiredGunsCD32', 'Test/HiredGuns'];
	for (const root of roots) {
		const dir = path.join(REPO, root);
		if (!fs.existsSync(dir)) continue;
		const walk = (d) => {
			for (const e of fs.readdirSync(d, { withFileTypes: true })) {
				const p = path.join(d, e.name);
				if (e.isDirectory()) walk(p);
				else if (e.name.toLowerCase().endsWith('.mod')) {
					const key = e.name.replace(/\.mod$/i, '');
					if (seen.has(key.toLowerCase())) continue; // CD32 copies win
					seen.add(key.toLowerCase());
					found.push({ key, file: p });
				}
			}
		};
		walk(dir);
	}
	return found;
}

fs.mkdirSync(OUT, { recursive: true });
const manifest = { modules: [] };
let ok = 0, failed = 0;

for (const { key, file } of findModules()) {
	try {
		const m = parseMED(fs.readFileSync(file));
		const sampleDir = path.join(OUT, key);
		fs.mkdirSync(sampleDir, { recursive: true });

		const instruments = m.song.instruments.slice(0, m.song.numSamples).map((inst, i) => {
			const s = m.samples[i];
			const entry = {
				index: i,
				volume: inst.volume,
				transpose: inst.transpose,
				repeat: inst.repeat,
				repeatLength: inst.repeatLength,
			};
			if (!s) return { ...entry, empty: true };
			if (s.synth) return { ...entry, synth: true, type: s.type };
			if (!s.data || !s.data.length) return { ...entry, empty: true };
			const name = `${i}.wav`;
			fs.writeFileSync(path.join(sampleDir, name), encodeWAV8(s.data, NOMINAL_RATE));
			return { ...entry, file: `music/${key}/${name}`, length: s.data.length };
		});

		// Patterns are emitted densely: null for an empty cell, else [note, instrument, command, data].
		const blocks = m.blocks.map((b) => b && ({
			tracks: b.numTracks,
			lines: b.lines,
			rows: b.notes.map((row) => row.map((n) => (n ? [n.note, n.instrument, n.command, n.data] : null))),
		}));

		fs.writeFileSync(path.join(OUT, `${key}.json`), JSON.stringify({
			key,
			source: path.relative(REPO, file).replace(/\\/g, '/'),
			format: m.header.magic,
			tempo: m.song.defTempo,
			tempo2: m.song.tempo2,
			bpmMode: m.song.bpmMode,
			rowsPerBeat: m.song.rowsPerBeat,
			transpose: m.song.playTranspose,
			masterVolume: m.song.masterVolume,
			trackVolumes: m.song.trackVolumes,
			flags: m.song.flags,
			playSeq: m.song.playSeq,
			numBlocks: m.song.numBlocks,
			instruments,
			blocks,
		}));

		const pcm = instruments.filter((i) => i.file).length;
		manifest.modules.push({
			key, file: `music/${key}.json`,
			blocks: m.song.numBlocks, seqLength: m.song.songLength,
			tempo: m.song.defTempo, instruments: pcm,
		});
		console.log(`  ${key.padEnd(14)} ${m.song.numBlocks} blocks, seq ${m.song.songLength}, ${pcm} instruments`);
		ok++;
	} catch (e) {
		console.log(`  FAIL ${key}: ${e.message}`);
		failed++;
	}
}

manifest.modules.sort((a, b) => a.key.localeCompare(b.key));
fs.writeFileSync(path.join(OUT, 'music.json'), JSON.stringify(manifest, null, '\t'));
console.log(`\n${ok} modules extracted, ${failed} failed`);
