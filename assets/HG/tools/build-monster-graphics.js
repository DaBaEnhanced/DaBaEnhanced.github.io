'use strict';
// Decode monster graphics into a browser-side atlas.
//
// Main.s loads normal bundles into front_figures_save+load_monsterN, then
// cr_decrunch expands it and copy_figures_to_chip copies:
//   4 * 3556 bytes  front/left/right/back 67-slot figure BOBs
//       2486 bytes  dead monster BOB
//       2592 bytes  attack frames (not rendered yet)
//
// Monster20/Gargoyle is different: Monsters/smakefile runs ConvertBig, which
// writes raw two-high BOB files and never produces a normal Monster20.gfx. The
// editor tree has a fallback .gfx, but it is half-height and draws the boss
// incorrectly, so use Monsters/Bob/20_gargoyle*.bob for number 20.
//
// The style files leave mon1*/mon2*/monsterNdead as runtime placeholders, so
// the browser patches these decoded BOB slots into the active style at map load.

const fs = require('fs');
const path = require('path');
const { decrunchC } = require('./lib/crunch');
const { parseBobFile, decodeSlotImage } = require('./lib/bob');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const MONSTER_DIR = path.join(REPO, 'Test', 'HiredGunsCD32', 'MonstersGfx');
const EDITOR_MONSTER_DIR = path.join(REPO, 'Test', 'HiredGunsEditor', 'MonstersGfx');
const SOURCE_MONSTER_GFX_DIR = path.join(REPO, 'Monsters', 'Gfx');
const SOURCE_MONSTER_BOB_DIR = path.join(REPO, 'Monsters', 'Bob');
const PALETTE = path.join(OUT, 'palette.json');

const DIRECTIONS = ['front', 'left', 'right', 'back'];
const FIGURE_BOB_BYTES = 3556;
const FIGURE_BYTES = FIGURE_BOB_BYTES * 4;
const DEAD_BYTES = 2486;
const ATTACK_BYTES = 2592;
const UNPACKED_BYTES = FIGURE_BYTES + DEAD_BYTES + ATTACK_BYTES;
const BIG_FIGURE_BOB_BYTES = 10996;
const BIG_FIGURE_BYTES = BIG_FIGURE_BOB_BYTES * 4;
const BIG_DEAD_BYTES = 3696;
const ATLAS_W = 512;

function packRects(rects, atlasWidth) {
	let x = 0, y = 0, rowHeight = 0;
	for (const r of rects) {
		if (x + r.w > atlasWidth) { x = 0; y += rowHeight + 1; rowHeight = 0; }
		r.ax = x; r.ay = y;
		x += r.w + 1;
		if (r.h > rowHeight) rowHeight = r.h;
	}
	return { width: atlasWidth, height: y + rowHeight + 1 };
}

function readPalette() {
	if (!fs.existsSync(PALETTE)) return null;
	const data = JSON.parse(fs.readFileSync(PALETTE, 'utf8'));
	return data.colours.flat();
}

function buildPreview(atlas, width, height) {
	const pal = readPalette();
	if (!pal) return null;
	const rgba = new Uint8Array(atlas.length * 4);
	for (let i = 0; i < atlas.length; i++) {
		const v = atlas[i];
		if (!v) continue;
		const c = v - 1, o = i * 4;
		rgba[o] = pal[c * 3] || 0;
		rgba[o + 1] = pal[c * 3 + 1] || 0;
		rgba[o + 2] = pal[c * 3 + 2] || 0;
		rgba[o + 3] = 255;
	}
	return encodePNG(width, height, rgba);
}

function validSlot(buf, slot, numPlanes, header) {
	if (slot.width === 0 || slot.height === 0) return false;
	const rowBytes = ((slot.width + 15) >> 4) * 2;
	const end = slot.dataOffset + rowBytes * numPlanes * slot.height;
	return slot.dataOffset >= header && end <= buf.length;
}

function decodeBob(buf) {
	const bob = parseBobFile(buf);
	const images = bob.slots.map((slot) =>
		validSlot(buf, slot, bob.numPlanes, bob.header)
			? decodeSlotImage(buf, slot, bob.numPlanes, bob.maskPlane)
			: null);
	return { bob, images };
}

function decodeNormalMonster(file, number) {
	const packed = fs.readFileSync(file);
	const unpacked = decrunchC(packed);
	if (unpacked.length !== UNPACKED_BYTES) {
		throw new Error(`${path.basename(file)}: unexpected unpacked length ${unpacked.length}`);
	}
	const dirs = {};
	for (let i = 0; i < DIRECTIONS.length; i++) {
		const start = i * FIGURE_BOB_BYTES;
		dirs[DIRECTIONS[i]] = decodeBob(unpacked.subarray(start, start + FIGURE_BOB_BYTES));
	}
	const dead = decodeBob(unpacked.subarray(FIGURE_BYTES, FIGURE_BYTES + DEAD_BYTES));
	const attack = decodeBob(unpacked.subarray(FIGURE_BYTES + DEAD_BYTES,
		FIGURE_BYTES + DEAD_BYTES + ATTACK_BYTES));
	return {
		number,
		file: path.relative(REPO, file).replace(/\\/g, '/'),
		sourceKind: 'crunchedGfx',
		packedBytes: packed.length,
		unpackedBytes: unpacked.length,
		dirs,
		dead,
		attack,
	};
}

function decodeBigMonster(number) {
	const figureFile = path.join(SOURCE_MONSTER_BOB_DIR, '20_gargoyle.bob');
	const deadFile = path.join(SOURCE_MONSTER_BOB_DIR, '20_gargoyle_dead.bob');
	const attackFile = path.join(SOURCE_MONSTER_BOB_DIR, '20_gargoyle_attack.bob');
	const figure = fs.readFileSync(figureFile);
	const deadRaw = fs.readFileSync(deadFile);
	const attackRaw = fs.readFileSync(attackFile);
	if (figure.length !== BIG_FIGURE_BYTES) {
		throw new Error(`20_gargoyle.bob: unexpected length ${figure.length}`);
	}
	if (deadRaw.length !== BIG_DEAD_BYTES) {
		throw new Error(`20_gargoyle_dead.bob: unexpected length ${deadRaw.length}`);
	}
	if (attackRaw.length !== 5152) {
		throw new Error(`20_gargoyle_attack.bob: unexpected length ${attackRaw.length}`);
	}

	const dirs = {};
	for (let i = 0; i < DIRECTIONS.length; i++) {
		const start = i * BIG_FIGURE_BOB_BYTES;
		dirs[DIRECTIONS[i]] = decodeBob(figure.subarray(start, start + BIG_FIGURE_BOB_BYTES));
	}
	return {
		number,
		file: path.relative(REPO, figureFile).replace(/\\/g, '/'),
		files: {
			figure: path.relative(REPO, figureFile).replace(/\\/g, '/'),
			dead: path.relative(REPO, deadFile).replace(/\\/g, '/'),
			attack: path.relative(REPO, attackFile).replace(/\\/g, '/'),
		},
		sourceKind: 'rawBigBob',
		packedBytes: null,
		unpackedBytes: figure.length + deadRaw.length + attackRaw.length,
		dirs,
		dead: decodeBob(deadRaw),
		attack: decodeBob(attackRaw),
	};
}

function monsterGfxName(number) {
	return `Monster${String(number).padStart(2, '0')}.gfx`;
}

function firstExisting(paths) {
	return paths.find((p) => fs.existsSync(p)) || null;
}

function normalMonsterSource(number) {
	const name = monsterGfxName(number);
	return firstExisting([
		path.join(MONSTER_DIR, name),
		path.join(SOURCE_MONSTER_GFX_DIR, name),
		path.join(EDITOR_MONSTER_DIR, name),
	]);
}

function monsterSources() {
	const sources = [];
	for (let number = 1; number <= 19; number++) {
		const file = normalMonsterSource(number);
		if (file) sources.push({ kind: 'normal', number, file });
	}
	const big = path.join(SOURCE_MONSTER_BOB_DIR, '20_gargoyle.bob');
	const bigDead = path.join(SOURCE_MONSTER_BOB_DIR, '20_gargoyle_dead.bob');
	if (fs.existsSync(big) && fs.existsSync(bigDead)) {
		sources.push({ kind: 'big', number: 20 });
	} else {
		const file = normalMonsterSource(20);
		if (file) sources.push({ kind: 'normal', number: 20, file });
	}
	return sources;
}

function main() {
	const decoded = monsterSources()
		.sort((a, b) => a.number - b.number)
		.map((source) => source.kind === 'big'
			? decodeBigMonster(source.number)
			: decodeNormalMonster(source.file, source.number));

	const rects = [];
	for (const monster of decoded) {
		for (const dir of DIRECTIONS) {
			const data = monster.dirs[dir];
			for (let slot = 0; slot < data.bob.slots.length; slot++) {
				const img = data.images[slot];
				if (!img) continue;
				rects.push({ monster: monster.number, part: dir, slot,
					w: img.width, h: img.height, img });
			}
		}
		for (let slot = 0; slot < monster.dead.bob.slots.length; slot++) {
			const img = monster.dead.images[slot];
			if (!img) continue;
			rects.push({ monster: monster.number, part: 'dead', slot,
				w: img.width, h: img.height, img });
		}
		for (let slot = 0; slot < monster.attack.bob.slots.length; slot++) {
			const img = monster.attack.images[slot];
			if (!img) continue;
			rects.push({ monster: monster.number, part: 'attack', slot,
				w: img.width, h: img.height, img });
		}
	}
	rects.sort((a, b) => b.h - a.h || b.w - a.w);

	const atlasSize = packRects(rects, ATLAS_W);
	const atlas = new Uint8Array(atlasSize.width * atlasSize.height);
	for (const r of rects) {
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				const si = y * r.w + x;
				if (!r.img.mask[si]) continue;
				atlas[(r.ay + y) * atlasSize.width + r.ax + x] = r.img.pixels[si] + 1;
			}
		}
	}

	const key = (monster, part, slot) => `${monster}:${part}:${slot}`;
	const rectMap = new Map(rects.map((r) => [key(r.monster, r.part, r.slot), r]));
	const monsters = decoded.map((monster) => {
		const parts = {};
		for (const part of [...DIRECTIONS, 'dead', 'attack']) {
			const data = part === 'dead' ? monster.dead :
				part === 'attack' ? monster.attack : monster.dirs[part];
			parts[part] = {
				maskPlane: data.bob.maskPlane,
				numPlanes: data.bob.numPlanes,
				planeOps: [1, 1, 1, 1, 2, 0],
				planeOnly: false,
				slots: data.bob.slots.map((s, slot) => {
					const r = rectMap.get(key(monster.number, part, slot));
					if (!r) return null;
					return {
						x: s.x, y: s.y, w: s.width, h: s.height,
						control: s.control, ax: r.ax, ay: r.ay,
					};
				}),
			};
		}
		return {
			number: monster.number,
			source: monster.file,
			sourceKind: monster.sourceKind,
			files: monster.files,
			packedBytes: monster.packedBytes,
			unpackedBytes: monster.unpackedBytes,
			parts,
		};
	});

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'monster-graphics.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'monster-graphics.json'), JSON.stringify({
		source: 'Test/HiredGunsCD32/MonstersGfx/Monster01-19.gfx + Monsters/Bob/20_gargoyle*.bob',
		sourceRoutine: 'Sources/Main.s load_monsters + copy_figures_to_chip',
		atlas: {
			file: 'monster-graphics.atlas',
			width: atlasSize.width,
			height: atlasSize.height,
		},
		count: monsters.length,
		monsters,
		comment: 'Decrunched normal monster .gfx bundles. Monster20/Gargoyle uses the source ConvertBig raw BOBs because the game build never creates a normal Monster20.gfx and the editor fallback is half-height. Each monster has front/left/right/back 67-slot figure BOBs, one dead BOB, and the one-slot attack BOB copied by Main.s copy_attack. Atlas stores colour index+1; 0 is transparent.',
	}, null, '\t'));

	const preview = buildPreview(atlas, atlasSize.width, atlasSize.height);
	if (preview) fs.writeFileSync(path.join(OUT, 'monster-graphics.preview.png'), preview);

	console.log(`monster graphics: ${monsters.length} monsters, atlas ${atlasSize.width}x${atlasSize.height}`);
}

main();
