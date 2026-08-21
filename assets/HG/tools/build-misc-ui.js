'use strict';
// Build small dynamic UI BOBs used after the 3D view has been drawn.

const fs = require('fs');
const path = require('path');
const { parseBobFile, decodeSlotImage } = require('./lib/bob');
const { encodePNG } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');
const RAW = path.join(REPO, 'Graphics', 'Misc', 'Raw');
const PALETTE = path.join(OUT, 'palette.json');

const ATLAS_W = 128;

const SOURCES = [
	{ key: 'compass_n', file: 'Compass_n.bin' },
	{ key: 'compass_e', file: 'Compass_e.bin' },
	{ key: 'compass_s', file: 'Compass_s.bin' },
	{ key: 'compass_w', file: 'Compass_w.bin' },
	{ key: 'icon_shield', file: 'Icon1.bin' },
	{ key: 'icon_weights', file: 'Icon2.bin' },
	{ key: 'icon_wings', file: 'Icon3.bin' },
	{ key: 'icon_water', file: 'Icon4.bin' },
	{ key: 'icon_immune', file: 'Icon5.bin' },
	{ key: 'locked', file: 'Locked.bin' },
	{ key: 'locked2', file: 'Locked2.bin' },
	{ key: 'used', file: 'Using.bin', sourceAssembly: 'Graphics/Misc/Ass/Using.s' },
	{ key: 'noammo', file: 'NoAmmo.bin' },
	{ key: 'noroom', file: 'NoRoom.bin' },
	{ key: 'heavy', file: 'TooHeavy.bin', sourceAssembly: 'Graphics/Misc/Ass/TooHeavy.s' },
	{ key: 'drowning', file: 'Drowning.bin' },
	{ key: 'poisoned', file: 'Poisoned.bin' },
	{ key: 'warning', file: 'Warning.bin' },
	{ key: 'active', file: 'Active.bin' },
	{ key: 'blocked', file: 'Blocked.bin' },
	{ key: 'blocked2', file: 'Blocked2.bin' },
	{ key: 'invalid', file: 'Invalid.bin' },
	// DELIBERATE DIVERGENCE. Both claw bobs declare plane 5 as "no draw"
	// (Claw.s / BigClaw.s, sixth bob_plane byte = 0), which leaves the lit bit
	// of whatever is underneath in place. The index is therefore
	// (under & 32) | 9: colour 9 over an unlit wall, which is pure red, but
	// colour 41 over a lit one, which is #ff9f5a -- so the scratches came out
	// half red and half orange depending on what the player happened to be
	// facing. Treated as a bug in the unfinished CD32 build rather than an
	// effect: keep is zeroed so the claws are colour 9 everywhere.
	//
	// Only the claws. Rip and Exit keep their masks, which are a different
	// effect on a screen that is not lit two ways.
	{ key: 'claws', file: 'Claws.bin', sourceAssembly: 'Graphics/Misc/Ass/Claw.s',
		mode: 'planeOp', keep: 0, set: 9 },
	{ key: 'bigclaws', file: 'BigClaws.bin', sourceAssembly: 'Graphics/Misc/Ass/BigClaw.s',
		mode: 'planeOp', keep: 0, set: 9 },
	{ key: 'rip', file: 'Rip.bin', sourceAssembly: 'Graphics/Misc/Ass/Rip.s',
		mode: 'planeOp', keep: 42, set: 21 },
	{ key: 'exit', file: 'Exit.bin', sourceAssembly: 'Graphics/Misc/Ass/Exit.s',
		mode: 'planeOp', keep: 42, set: 21 },
	{ key: 'dts_vertline', file: 'VertLine.bin' },
	{ key: 'dts_horizline', file: 'HorizLine.bin' },
	{ key: 'leader', file: 'Leader.bin', single: true },
	{ key: 'leader_off', file: 'LeaderOff.bin', single: true },
	{ key: 'dts_rotation_n', file: 'Rotations.bin', slot: 0 },
	{ key: 'dts_rotation_e', file: 'Rotations.bin', slot: 1 },
	{ key: 'dts_rotation_s', file: 'Rotations.bin', slot: 2 },
	{ key: 'dts_rotation_w', file: 'Rotations.bin', slot: 3 },
];

function pack(sprites) {
	let x = 0, y = 0, rowH = 0;
	for (const sprite of sprites) {
		if (x + sprite.w > ATLAS_W) {
			x = 0;
			y += rowH + 1;
			rowH = 0;
		}
		sprite.ax = x;
		sprite.ay = y;
		x += sprite.w + 1;
		rowH = Math.max(rowH, sprite.h);
	}
	return { width: ATLAS_W, height: y + rowH };
}

function readPalette() {
	if (!fs.existsSync(PALETTE)) return null;
	const data = JSON.parse(fs.readFileSync(PALETTE, 'utf8'));
	return data.colours.flat();
}

function buildPreview(atlas, width, height, sprites) {
	const pal = readPalette();
	if (!pal) return null;
	const visible = new Uint8Array(atlas.length);
	const previewIndices = new Uint8Array(atlas.length);
	for (const sprite of sprites) {
		const previewColour = sprite.mode === 'planeOp' ? (sprite.set ?? 1) : null;
		for (let y = 0; y < sprite.h; y++) {
			for (let x = 0; x < sprite.w; x++) {
				const i = (sprite.ay + y) * width + sprite.ax + x;
				const v = atlas[i];
				if (!v) continue;
				visible[i] = 1;
				previewIndices[i] = previewColour == null ? v - 1 : previewColour;
			}
		}
	}
	const rgba = new Uint8Array(atlas.length * 4);
	for (let i = 0; i < atlas.length; i++) {
		if (!visible[i]) continue;
		const c = previewIndices[i], o = i * 4;
		rgba[o] = pal[c * 3] || 0;
		rgba[o + 1] = pal[c * 3 + 1] || 0;
		rgba[o + 2] = pal[c * 3 + 2] || 0;
		rgba[o + 3] = 255;
	}
	return encodePNG(width, height, rgba);
}

function main() {
	const decoded = SOURCES.map((src) => {
		const filePath = path.join(RAW, src.file);
		const buf = fs.readFileSync(filePath);
		const bob = src.single ? null : parseBobFile(buf);
		const slot = src.single
			? {
				width: buf.readUInt16BE(4), height: buf.readUInt16BE(6),
				x: 0, y: 0, control: 0, dataOffset: 18,
			}
			: bob.slots[src.slot || 0];
		const maskPlane = src.single ? buf.readUInt16BE(8) : bob.maskPlane;
		const numPlanes = src.single ? maskPlane + 1 : bob.numPlanes;
		const image = decodeSlotImage(buf, slot, numPlanes, maskPlane);
		return {
			src,
			bob,
			slot,
			image,
			sprite: {
				key: src.key,
				source: `Graphics/Misc/Raw/${src.file}`,
				sourceAssembly: src.sourceAssembly ||
					`Graphics/Misc/Ass/${src.file.replace(/\.bin$/i, '.s')}`,
				mode: src.mode || 'indexed',
				keep: src.keep,
				set: src.set,
				w: image.width,
				h: image.height,
				x: slot.x,
				y: slot.y,
				control: slot.control,
				maskPlane,
				numPlanes,
			},
		};
	});

	const sprites = decoded.map((d) => d.sprite);
	const atlasSize = pack(sprites);
	const atlas = new Uint8Array(atlasSize.width * atlasSize.height);

	for (const d of decoded) {
		const { image, sprite } = d;
		for (let y = 0; y < image.height; y++) {
			for (let x = 0; x < image.width; x++) {
				const src = y * image.width + x;
				if (!image.mask[src]) continue;
				atlas[(sprite.ay + y) * atlasSize.width + sprite.ax + x] =
					image.pixels[src] + 1;
			}
		}
	}

	const byKey = {};
	for (const sprite of sprites) byKey[sprite.key] = sprite;

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'misc-ui.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'misc-ui.json'), JSON.stringify({
		source: 'Graphics/Misc/Raw HUD, message, Claws, RIP/exit and DTS line/rotation BOBs',
		atlas: { file: 'misc-ui.atlas', width: atlasSize.width, height: atlasSize.height },
		sprites: byKey,
		comment: 'Dynamic UI BOBs drawn after the 3D view. Indexed sprites store colour index+1; planeOp sprites store coverage for source set/clear masks.',
	}, null, '\t'));

	const preview = buildPreview(atlas, atlasSize.width, atlasSize.height, sprites);
	if (preview) fs.writeFileSync(path.join(OUT, 'misc-ui.preview.png'), preview);

	console.log(`misc ui: ${sprites.length} sprites, atlas ${atlasSize.width}x${atlasSize.height}`);
}

main();
