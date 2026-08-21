'use strict';
// Decode the character figure and face BOBs from Test/HiredGunsCD32/CharactersGfx/*.gfx.
//
// The game loads each character bundle with LOAD_FILE2_TMP, then `cr_decrunch`
// expands it to:
//   14224 bytes  4 x 67-slot player figure BOBs
//    1126 bytes  two-slot face BOB
// `copy_figures_to_chip` copies the figure bytes to miscgfx plNin_bob..plNout_bob
// and `copy_face` copies the final 1126 bytes to miscgfx face1_bob..face4_bob.

const fs = require('fs');
const path = require('path');
const { decrunchC } = require('./lib/crunch');
const { parseBobFile, decodeSlotImage } = require('./lib/bob');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const CHAR_DIR = path.join(REPO, 'Test', 'HiredGunsCD32', 'CharactersGfx');
const CHARACTERS = path.join(OUT, 'characters.json');
const PALETTE = path.join(OUT, 'palette.json');

const DIRECTIONS = ['front', 'left', 'right', 'back'];
const FIGURE_BOB_BYTES = 3556;
const FIGURE_BYTES = FIGURE_BOB_BYTES * 4;
const FACE_BYTES = 1126;
const ATLAS_W = 512;
const CONTROL_NONE = 3;

function pack(rects) {
	let x = 0, y = 0, rowH = 0;
	for (const r of rects) {
		if (x + r.w > ATLAS_W) {
			x = 0;
			y += rowH + 1;
			rowH = 0;
		}
		r.ax = x;
		r.ay = y;
		x += r.w + 1;
		rowH = Math.max(rowH, r.h);
	}
	return { width: ATLAS_W, height: y + rowH };
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
	if (!slot || slot.control === CONTROL_NONE || slot.width === 0 || slot.height === 0) return false;
	const rowBytes = ((slot.width + 15) >> 4) * 2;
	const end = slot.dataOffset + rowBytes * numPlanes * slot.height;
	return slot.dataOffset >= header && end <= buf.length;
}

function decodeFigureBob(buf, label) {
	const bob = parseBobFile(buf);
	if (bob.numSlots !== 67 || bob.numPlanes !== 5 || bob.maskPlane !== 4) {
		throw new Error(`${label}: unexpected figure BOB layout`);
	}
	const images = bob.slots.map((slot) =>
		validSlot(buf, slot, bob.numPlanes, bob.header)
			? decodeSlotImage(buf, slot, bob.numPlanes, bob.maskPlane)
			: null);
	return { bob, images };
}

function decodeCharacterGraphics(character) {
	const gfxPath = character.gfxPath.replace(/\//g, path.sep);
	const file = path.join(REPO, 'Test', 'HiredGunsCD32', gfxPath);
	if (!file.startsWith(CHAR_DIR)) throw new Error(`unexpected gfx path ${character.gfxPath}`);
	const packed = fs.readFileSync(file);
	const unpacked = decrunchC(packed);
	if (unpacked.length !== FIGURE_BYTES + FACE_BYTES) {
		throw new Error(`${character.gfxPath}: unexpected unpacked length ${unpacked.length}`);
	}

	const figures = {};
	for (let i = 0; i < DIRECTIONS.length; i++) {
		const start = i * FIGURE_BOB_BYTES;
		figures[DIRECTIONS[i]] = decodeFigureBob(
			unpacked.subarray(start, start + FIGURE_BOB_BYTES),
			`${character.gfxPath}:${DIRECTIONS[i]}`,
		);
	}

	const face = unpacked.subarray(FIGURE_BYTES, FIGURE_BYTES + FACE_BYTES);
	const bob = parseBobFile(face);
	if (bob.numSlots !== 2 || bob.slots[0].width !== 48 || bob.slots[0].height !== 26 ||
			bob.slots[1].width !== 48 || bob.slots[1].height !== 10) {
		throw new Error(`${character.gfxPath}: unexpected face BOB layout`);
	}

	const view = decodeSlotImage(face, bob.slots[0], bob.numPlanes, bob.maskPlane);
	const tab = decodeSlotImage(face, bob.slots[1], bob.numPlanes, bob.maskPlane);
	return {
		character,
		source: `Test/HiredGunsCD32/${character.gfxPath}`,
		packedBytes: packed.length,
		unpackedBytes: unpacked.length,
		figures,
		faceBob: bob,
		images: { view, tab },
	};
}

function main() {
	if (!fs.existsSync(CHARACTERS)) {
		throw new Error('assets/characters.json not found; run build-gamedata.js first');
	}
	const chars = JSON.parse(fs.readFileSync(CHARACTERS, 'utf8')).characters;
	const decoded = chars.map(decodeCharacterGraphics);

	const rects = [];
	for (const d of decoded) {
		for (const part of DIRECTIONS) {
			const data = d.figures[part];
			for (let slot = 0; slot < data.bob.slots.length; slot++) {
				const img = data.images[slot];
				if (!img) continue;
				rects.push({
					kind: 'figure',
					part,
					slot,
					character: d.character.character,
					name: d.character.name,
					source: d.source,
					w: img.width,
					h: img.height,
					img,
				});
			}
		}
		for (const key of ['view', 'tab']) {
			const slot = d.faceBob.slots[key === 'view' ? 0 : 1];
			rects.push({
				kind: 'face',
				key,
				character: d.character.character,
				name: d.character.name,
				source: d.source,
				w: slot.width,
				h: slot.height,
				x: slot.x,
				y: slot.y,
				control: slot.control,
				img: d.images[key],
				maskPlane: d.faceBob.maskPlane,
				numPlanes: d.faceBob.numPlanes,
			});
		}
	}
	rects.sort((a, b) => b.h - a.h || b.w - a.w);
	const atlasSize = pack(rects);
	const atlas = new Uint8Array(atlasSize.width * atlasSize.height);

	for (const rect of rects) {
		const image = rect.img;
		for (let y = 0; y < image.height; y++) {
			for (let x = 0; x < image.width; x++) {
				const src = y * image.width + x;
				if (!image.mask[src]) continue;
				atlas[(rect.ay + y) * atlasSize.width + rect.ax + x] =
					image.pixels[src] + 1;
			}
		}
	}

	const rectKey = (character, kind, partOrKey, slot = '') =>
		`${character}:${kind}:${partOrKey}:${slot}`;
	const rectMap = new Map(rects.map((r) => [
		rectKey(r.character, r.kind, r.kind === 'face' ? r.key : r.part, r.slot ?? ''),
		r,
	]));
	const characters = decoded.map((d) => {
		const figures = {};
		for (const part of DIRECTIONS) {
			const data = d.figures[part];
			figures[part] = {
				maskPlane: data.bob.maskPlane,
				numPlanes: data.bob.numPlanes,
				planeOps: [1, 1, 1, 1, 2, 0],
				planeOnly: false,
				slots: data.bob.slots.map((s, slot) => {
					const r = rectMap.get(rectKey(d.character.character, 'figure', part, slot));
					if (!r) return null;
					return {
						x: s.x, y: s.y, w: s.width, h: s.height,
						control: s.control, ax: r.ax, ay: r.ay,
					};
				}),
			};
		}
		const view = rectMap.get(rectKey(d.character.character, 'face', 'view'));
		const tab = rectMap.get(rectKey(d.character.character, 'face', 'tab'));
		const strip = ({ kind, key, img, part, slot, ...r }) => r;
		return {
			character: d.character.character,
			name: d.character.name,
			gfxPath: d.character.gfxPath,
			source: d.source,
			packedBytes: d.packedBytes,
			unpackedBytes: d.unpackedBytes,
			figures,
			faces: { view: strip(view), tab: strip(tab) },
		};
	});

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'character-portraits.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'character-portraits.json'), JSON.stringify({
		source: 'Test/HiredGunsCD32/CharactersGfx/*.gfx',
		sourceRoutine: 'Sources/Miscroutines.s cr_decrunch + Main.s copy_figures_to_chip/copy_face',
		atlas: {
			file: 'character-portraits.atlas',
			width: atlasSize.width,
			height: atlasSize.height,
		},
		count: characters.length,
		characters,
		comment: 'Decrunched character .gfx bundles. Each file has four 67-slot figure BOBs (front/left/right/back) plus a 48x26 view face and a 48x10 tab face. Atlas stores colour index+1; 0 is transparent.',
	}, null, '\t'));

	const preview = buildPreview(atlas, atlasSize.width, atlasSize.height);
	if (preview) fs.writeFileSync(path.join(OUT, 'character-portraits.preview.png'), preview);

	console.log(`character graphics: ${characters.length} characters, atlas ${atlasSize.width}x${atlasSize.height}`);
	for (const c of characters.slice(0, 4)) {
		console.log(`  preselected ${c.character}: ${c.name} (${c.gfxPath})`);
	}
}

main();
