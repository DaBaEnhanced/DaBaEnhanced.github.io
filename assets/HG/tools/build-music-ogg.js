'use strict';
// Render every extracted MED/MMD0 module to OGG via ffmpeg+libopenmpt.
//   node tools/build-music-ogg.js

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets', 'music');
const MANIFEST = path.join(OUT, 'music.json');
const FFMPEG = 'I:\\Software\\ffmpeg-2022-12-15-git-9adf02247c-full_build\\bin\\ffmpeg.exe';

function findFfmpeg() {
	if (fs.existsSync(FFMPEG)) return FFMPEG;
	const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
	if (r.status === 0) return 'ffmpeg';
	throw new Error('ffmpeg with libopenmpt not found');
}

function convert(ffmpeg, src, dest) {
	const args = [
		'-hide_banner', '-loglevel', 'error', '-y',
		'-i', src,
		'-c:a', 'libvorbis', '-q:a', '5',
		dest,
	];
	const r = spawnSync(ffmpeg, args, { encoding: 'utf8' });
	if (r.status !== 0) {
		throw new Error((r.stderr || r.stdout || 'ffmpeg failed').trim().slice(0, 400));
	}
}

function main() {
	const ffmpeg = findFfmpeg();
	const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
	fs.mkdirSync(OUT, { recursive: true });
	let ok = 0, failed = 0;
	for (const mod of manifest.modules) {
		const json = JSON.parse(fs.readFileSync(path.join(OUT, path.basename(mod.file)), 'utf8'));
		const src = path.join(REPO, json.source.replace(/\//g, path.sep));
		if (!fs.existsSync(src)) {
			console.log(`  MISS ${mod.key}: ${json.source}`);
			failed++;
			continue;
		}
		const oggName = `${mod.key}.ogg`;
		const dest = path.join(OUT, oggName);
		try {
			convert(ffmpeg, src, dest);
			const bytes = fs.statSync(dest).size;
			mod.ogg = `music/${oggName}`;
			mod.oggBytes = bytes;
			ok++;
			console.log(`  ${mod.key}: ${(bytes / 1024).toFixed(0)} KB`);
		} catch (e) {
			console.log(`  FAIL ${mod.key}: ${e.message}`);
			failed++;
		}
	}
	fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, '\t'));
	console.log(`music ogg: ${ok} converted, ${failed} failed`);
}

main();
