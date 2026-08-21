'use strict';
// Convert original Front / ChSelect / WorldMap ILBMs to PNG for the campaign shell.

const fs = require('fs');
const path = require('path');
const { decodeILBM, decodeHAM8 } = require('./lib/iff');
const { encodePNG, indexedToRGBA } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets', 'frontend');

function indexedPNG(file, transparent = -1) {
	const img = decodeILBM(fs.readFileSync(file));
	return {
		width: img.width,
		height: img.height,
		rgba: indexedToRGBA(img.pixels, img.palette, transparent),
	};
}

function writePNG(name, img) {
	fs.writeFileSync(path.join(OUT, name), encodePNG(img.width, img.height, img.rgba));
	console.log(`  ${name} ${img.width}x${img.height}`);
}

function main() {
	fs.mkdirSync(OUT, { recursive: true });
	// Keep all 640x512. The front end runs HIRES + LACE (bplcon0
	// %1101000000000100), so the stored ILBM already holds every displayed row
	// -- interlace is how the Amiga puts them on a CRT, not a packing scheme.
	// Dropping the odd rows threw away half the backdrop.
	const fill = indexedPNG(path.join(REPO, 'Data/Front.dat/FillCD32.ilbm'));
	writePNG('front.png', fill);

	const faces = indexedPNG(path.join(REPO, 'Data/ChSelect.dat/FacesCD32.ilbm'));
	writePNG('faces.png', faces);

	// The 2x2 party slots use a separate small-face sheet (ChSelect.s:813
	// .small_face_bob -- 64x80, 3 planes). The sheet is a 6x3 grid, and
	// redraw_small_faces indexes it linearly by character, so it reads
	// row-major. Colour 0 is transparent here.
	const small = indexedPNG(path.join(REPO, 'Data/ChSelect.dat/SmallFacesCD32.ilbm'), 0);
	writePNG('smallfaces.png', small);

	const panel = indexedPNG(path.join(REPO, 'Data/World.dat/Panel.ilbm'));
	writePNG('panel.png', panel);

	const sprites = indexedPNG(path.join(REPO, 'Data/World.dat/Sprites.ilbm'), 0);
	writePNG('sprites.png', sprites);

	const world = decodeHAM8(fs.readFileSync(path.join(REPO, 'Data/World.dat/Map4.ham8')));
	writePNG('world.png', world);

	fs.writeFileSync(path.join(OUT, 'frontend.json'), JSON.stringify({
		front: { file: 'frontend/front.png', width: fill.width, height: fill.height },
		faces: {
			file: 'frontend/faces.png', width: faces.width, height: faces.height, count: 12,
			// Ink spans x 240..2159 = exactly 12 x 160.
			stripOrigin: 240, faceWidth: 160,
			// ChSelect.s:17 MIN_FACES_X 87-16, MAX_FACES_X (2624/2)-329-32,
			// both doubled on CD32 -> the scroll runs 142..1902 in 160 steps,
			// which parks the selected face at screen x 98 every time.
			scrollMin: 142, scrollMax: 1902, selectedScreenX: 98,
		},
		smallFaces: {
			file: 'frontend/smallfaces.png', width: small.width, height: small.height,
			cellWidth: 64, cellHeight: 80, columns: 6,
			// redraw_small_faces blit positions, relative to the info region.
			slots: [[458, 16], [538, 16], [458, 112], [538, 112]],
		},
		panel: { file: 'frontend/panel.png', width: panel.width, height: panel.height },
		sprites: { file: 'frontend/sprites.png', width: sprites.width, height: sprites.height },
		world: { file: 'frontend/world.png', width: world.width, height: world.height },
		menu: [
			{ id: 'training', label: 'TRAINING', x: 153, y: 100 },
			{ id: 'campaign', label: 'CAMPAIGN', x: 153, y: 122 },
			{ id: 'action', label: 'ACTION', x: 153, y: 144 },
			{ id: 'continue', label: 'CONTINUE', x: 153, y: 183 },
			{ id: 'quit', label: 'QUIT', x: 153, y: 205 },
		],
	}, null, '\t'));
}

main();
