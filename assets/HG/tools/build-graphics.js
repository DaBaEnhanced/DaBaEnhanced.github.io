'use strict';
// Build web-loadable graphics bundles from the original Amiga art.
//
// For each of the 5 map styles, emits:
//   public/assets/styleN.atlas   raw 8-bit atlas, one byte per pixel = palette
//                                index (0 = transparent)
//   public/assets/styleN.json    palette + per-graphic 67-slot tables, each slot
//                                carrying its atlas rect and its on-screen x/y/w/h
//
// Keeping the atlas as palette indices (rather than baking RGBA) means the
// renderer can reproduce the Amiga's palette tricks -- fire flash, fades,
// monster outline flashing -- by swapping the LUT, exactly as the original did.

const fs = require('fs');
const path = require('path');
const { parseBobFile, decodeSlotImage, NUM_SLOTS, HEADER_SIZE } = require('./lib/bob');
const { parseStyleFile, GRAPHIC_NAMES } = require('./lib/stylefile');
const { decodeILBM } = require('./lib/iff');
const { encodePNG, indexedToRGBA } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');

// bob_control. Equates.i's block_structure comment calls value 3 "none", but
// the blitter (Miscroutines.s) actually treats it as random_flip: it reads the
// raster position and rewrites the control to 0 or 1. Those slots carry real
// artwork -- 904 of them across the styles -- so they must still be drawn.
const CONTROL_NORMAL = 0;
const CONTROL_FLIPPED = 1;
const CONTROL_NORM_AND_FLIPPED = 2;
const CONTROL_RANDOM_FLIP = 3;

/** Mirror an indexed bitmap top-to-bottom, in place of the Amiga's flipped blit. */
function flipVertical(img) {
	if (!img) return img;
	const { width: w, height: h, pixels, mask } = img;
	const outPixels = new Uint8Array(w * h);
	const outMask = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		const src = (h - 1 - y) * w;
		outPixels.set(pixels.subarray(src, src + w), y * w);
		outMask.set(mask.subarray(src, src + w), y * w);
	}
	return { width: w, height: h, pixels: outPixels, mask: outMask };
}

/** Shelf packer: places rects into rows, growing height as needed. */
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

/** Read the 16-entry style palette from a representative ILBM of that style. */
function readStylePalette(styleDir) {
	const ilbmDir = path.join(styleDir, 'ILBM');
	for (const preferred of ['Stone.ilbm', 'Grass.ilbm', 'Doors.ilbm']) {
		const p = path.join(ilbmDir, preferred);
		if (!fs.existsSync(p)) continue;
		const img = decodeILBM(fs.readFileSync(p));
		const pal = [];
		for (let i = 0; i < 16; i++) {
			pal.push([img.palette[i * 3], img.palette[i * 3 + 1], img.palette[i * 3 + 2]]);
		}
		return pal;
	}
	throw new Error(`no palette source ILBM in ${ilbmDir}`);
}

function buildStyle(styleNum) {
	// The art directories are 1-based (Style1..Style5) but the game refers to
	// styles 0-based via locn_style -- Style1.s builds Style00.gfx. Outputs are
	// named with the game's index so nothing has to remember the offset.
	const gameStyle = styleNum - 1;
	const styleDir = path.join(REPO, 'Graphics', `Style${styleNum}`);
	const styleSrc = path.join(styleDir, 'Ass', `Style${styleNum}.s`);
	console.log(`\n=== Style${styleNum} (game style ${gameStyle}) ===`);

	const { order, incbin, placeholder } = parseStyleFile(styleSrc, REPO);
	if (order.length !== 49) console.warn(`  ! expected 49 table entries, got ${order.length}`);

	const palette = readStylePalette(styleDir);

	// Load each distinct .bin once; several table entries share a file.
	const files = new Map(); // resolved path -> { slots, images, numPlanes }
	const skipped = [];
	for (const sym of order) {
		if (!sym) continue;
		const file = incbin.get(sym);
		if (!file) continue; // placeholder (monster gfx, loaded per-map at runtime)
		if (files.has(file)) continue;
		const buf = fs.readFileSync(file);
		if (buf.length < HEADER_SIZE) { skipped.push([sym, 'smaller than a bob header']); continue; }
		const { slots, numPlanes, maskPlane } = parseBobFile(buf);

		// MapBlocks (the overhead automap tiles) and the HUD sprites use their
		// own, smaller tables -- they are not 67-slot block graphics. Detect
		// that by range-checking rather than by filename.
		const valid = (s) => {
			if (s.width === 0 || s.height === 0) return false;
			if (s.width > 512 || s.height > 512) return false;
			const rowBytes = ((s.width + 15) >> 4) * 2;
			const end = s.dataOffset + rowBytes * numPlanes * s.height;
			return s.dataOffset >= HEADER_SIZE && end <= buf.length;
		};
		const usable = slots.filter((s) => s.width || s.height);
		if (usable.length === 0 || usable.some((s) => !valid(s))) {
			skipped.push([sym, 'not a 67-slot block graphic']);
			continue;
		}

		// bob_control (Equates.i): 0 = normal, 1 = flipped, 2 = norm & flipped,
		// 3 = none. Ceiling and floor share one source image: the floor slots
		// point at the very same data as the ceiling slots and carry control 1,
		// meaning "draw it flipped". Baking the flip here keeps both renderers
		// simple and guarantees they cannot disagree about it.
		const images = slots.map((s) => {
			// blit_block opens with `cmpi.w #3,d4 / beq .exit` -- control 3 is
			// "nothing to draw". Those slots carry placeholder geometry and a
			// dataOffset pointing at the very start of the image data, so drawing
			// them paints garbage: 160 of the 161 sized control-3 slots in every
			// style are exactly that. An earlier pass here mistook 3 for
			// random_flip -- which is -1 in a BLOCK structure and 2 in a BOB
			// header, two different fields -- and reinstated all of them.
			if (s.control === CONTROL_RANDOM_FLIP) return null;
			if (!valid(s)) return null;
			const img = decodeSlotImage(buf, s, numPlanes, maskPlane);
			// CONTROL_RANDOM_FLIP is drawn unflipped here. The original picks
			// between unflipped and flipped per blit from the raster position
			// (Miscroutines.s reads vhposr and masks bit 0), which is not
			// reproducible; unflipped is one of the two outcomes it chooses.
			return s.control === CONTROL_FLIPPED ? flipVertical(img) : img;
		});
		// bob_plane[0..5] lives in the 18-byte header at offset 12.
		files.set(file, { slots, images, numPlanes, maskPlane,
			planeOps: [...buf.subarray(12, 18)] });
	}

	// Collect every non-empty slot image as a rect to pack.
	//
	// control=2 ("norm & flipped") means the bob is drawn twice: once as stored,
	// then again mirrored directly beneath it. That is how a wall gets its lower
	// half -- only the top half is stored, and 494 of the 530 control=2 slots
	// bottom out at exactly y=42, the view's centre line. A depth-0 wall stored
	// as y=0 h=42 therefore also covers 42..84 once mirrored.
	const rects = [];
	for (const [file, data] of files) {
		data.images.forEach((img, i) => {
			if (!img) return;
			rects.push({ file, slot: i, w: img.width, h: img.height, img });
			// control > 3 is blit_block's .mirror path (Drawviews.s:3765): the bob
			// is drawn twice, upright then flipped `control` pixels lower, and the
			// cell's variant slides the two halves apart. That is how a door opens
			// -- one image, not eleven. It needs the same flipped copy as control 2.
			if (data.slots[i].control === CONTROL_NORM_AND_FLIPPED ||
				data.slots[i].control > CONTROL_RANDOM_FLIP) {
				rects.push({
					file, slot: i, mirror: true,
					w: img.width, h: img.height, img: flipVertical(img),
				});
			}
		});
	}
	rects.sort((a, b) => b.h - a.h || b.w - a.w); // tallest first packs tighter

	const { width: aw, height: ah } = packRects(rects, 512);
	const atlas = new Uint8Array(aw * ah);
	for (const r of rects) {
		const { pixels, mask } = r.img;
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				const si = y * r.w + x;
				// Stored as index+1 so that 0 can mean "no pixel". Colour index 0
				// is a REAL colour the art uses -- 5.4% of drawn pixels in style1,
				// including the whole PanelText plate and much of Field/Puddle.
				// Conflating it with transparency erased those entirely.
				atlas[(r.ay + y) * aw + (r.ax + x)] = mask[si] ? pixels[si] + 1 : 0;
			}
		}
	}

	const rectKey = (file, slot, mirror) => `${file}#${slot}${mirror ? '#m' : ''}`;
	const rectMap = new Map(rects.map((r) => [rectKey(r.file, r.slot, r.mirror), r]));

	const graphics = order.map((sym, idx) => {
		const name = GRAPHIC_NAMES[idx] || `gfx${idx}`;
		if (!sym) return { index: idx, name, present: false };
		const file = incbin.get(sym);
		if (!file) {
			return {
				index: idx, name, symbol: sym, present: false,
				runtimeLoaded: true, placeholderSize: placeholder.get(sym) || 0,
			};
		}
		const data = files.get(file);
		if (!data) {
			return {
				index: idx, name, symbol: sym, present: false,
				source: path.relative(REPO, file).replace(/\\/g, '/'),
				note: 'uses a non-block graphic layout; handled separately',
			};
		}
		const slots = data.slots.map((s, i) => {
			const r = rectMap.get(rectKey(file, i));
			if (!r) return null; // empty slot (e.g. the cell directly in front)
			const out = { x: s.x, y: s.y, w: s.width, h: s.height, control: s.control, ax: r.ax, ay: r.ay };
			const m = rectMap.get(rectKey(file, i, true));
			// The mirrored half sits immediately below the stored half -- except on
			// the .mirror path, where `control` is the gap between the two halves.
			const split = s.control > CONTROL_RANDOM_FLIP;
			if (split) out.split = s.control;
			if (m) {
				out.mirror = { x: s.x, y: s.y + (split ? s.control : s.height),
					w: s.width, h: s.height, ax: m.ax, ay: m.ay };
			}
			return out;
		});
		// bob_plane ops (Macros.i: 0 nodraw, 1 copy, 2 clear, 3 set). Ordinary art
		// is 1,1,1,1,2,x -- four colour planes copied, plane 4 cleared. A few
		// graphics copy NO colour plane and are pure plane arithmetic instead:
		//   Puddle  0,0,0,0,1,0  copies its mask into plane 4 -> +16, the water
		//                        bank, so the floor under it shows through tinted
		//                        azure. It is a filter, not a blue blob.
		//   Field   2,3,3,2,2,0  forces colour 6, the register scroll_field cycles
		//   Exit    3,0,3,0,3,0  ORs bits 0, 2 and 4 into whatever is beneath
		// Those are flagged so the renderer applies them as bank ops, not blits.
		const planeOps = data.planeOps;
		const colourCopy = planeOps.slice(0, 4).some((o) => o === 1);
		return {
			index: idx, name, symbol: sym, present: true,
			source: path.relative(REPO, file).replace(/\\/g, '/'),
			planeOps, planeOnly: !colourCopy,
			slots,
		};
	});

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, `style${gameStyle}.atlas`), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, `style${gameStyle}.json`), JSON.stringify({
		style: gameStyle,
		sourceDir: `Graphics/Style${styleNum}`,
		atlas: { file: `style${gameStyle}.atlas`, width: aw, height: ah },
		palette,
		numSlots: NUM_SLOTS,
		graphics,
	}, null, '\t'));

	// A PNG preview of the atlas, purely for eyeballing correctness.
	fs.writeFileSync(
		path.join(OUT, `style${gameStyle}.preview.png`),
		encodePNG(aw, ah, indexedToRGBA(atlas.map((v) => (v ? v - 1 : 0)), palette.flat(), -1))
	);

	const present = graphics.filter((g) => g.present).length;
	console.log(`  ${files.size} bin files, ${rects.length} slot images`);
	console.log(`  atlas ${aw}x${ah} (${(aw * ah / 1024).toFixed(0)} KB), ${present}/49 graphics resolved`);
	for (const [sym, why] of skipped) console.log(`  skipped ${sym}: ${why}`);
	return { styleNum, rects: rects.length, aw, ah };
}

// The planet: a single 96x42 one-bitplane mask (Graphics/Misc/Raw/Planet.bin,
// image data at offset 32, 12*42 = 504 bytes). draw_horizon blits it only when
// facing south, at pane+(22,14) = view (20,0), with redraw_temp %10010000 --
// which sets plane 4, turning sky colour 38 into 54. So it is not a sprite in
// its own colours: it re-tints the sky gradient through the nosky_planet ramp,
// giving the faint "planet seen through the atmosphere" wash.
// Graphics/Misc/ILBM/Planet.ilbm holds TWO variants stacked, each 96 wide, with
// value-2 guide frames around them:
//   rows 0..58   a full cratered disc      <- the CD32 build uses THIS one
//   rows 69..110 a crescent plus a ring arc
// Graphics/Misc/Raw/Planet.bin is a byte-exact copy of the disc (0.0% diff
// against rows 0..41), i.e. it is NOT stale -- it is the shipped CD32 variant.
// Confirmed against CD32 footage.
const PLANET_VARIANT_Y = 0;
const PLANET_BOB_W = 96, PLANET_BOB_H = 42;

function buildPlanet() {
	const src = path.join(REPO, 'Graphics', 'Misc', 'ILBM', 'Planet.ilbm');
	if (!fs.existsSync(src)) { console.warn('  ! Planet.ilbm missing'); return; }
	const img = decodeILBM(fs.readFileSync(src));
	const w = PLANET_BOB_W, h = PLANET_BOB_H;
	const rowBytes = w / 8;
	const out = Buffer.alloc(rowBytes * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const sy = PLANET_VARIANT_Y + y;
			if (sy >= img.height || x >= img.width) continue;
			// Value 1 is the artwork; value 2 is only the editor's guide frame.
			if (img.pixels[sy * img.width + x] !== 1) continue;
			out[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
		}
	}
	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'planet.bin'), out);
	fs.writeFileSync(path.join(OUT, 'planet.json'), JSON.stringify({
		file: 'planet.bin', width: w, height: h, rowBytes,
		source: 'Graphics/Misc/ILBM/Planet.ilbm rows 0..41 (disc variant, CD32)',
		viewX: 20, viewY: 0, onlyFacing: 2,
		comment: 'Sets plane 4 over the sky, so sky colour 38 becomes 54; feed 54 ' +
			'from the nosky_planet ramp.',
	}));
	let set = 0;
	for (const b of out) set += (b.toString(2).match(/1/g) || []).length;
	console.log(`
planet: ${w}x${h} disc variant (CD32) from ILBM, ${set} set pixels -> assets/planet.bin`);
}

// CD32 lighting. Light1-3 are standard 67-slot bobs but ONE plane with mask
// plane 0, i.e. pure 1-bit masks rather than colour art. draw_bob applies them
// with redraw_temp %1000000000100000 (bit 5), so a covered pixel gains plane 5
// and its palette index moves +32 into the lit bank. They are therefore stored
// here as masks and applied by the renderer as an index offset, never blitted.
//   light 0 = side light, 1 = rear-wall light, 2 = floor light
// One-plane miscgfx mask sets. These are standard 67-slot bobs but a single
// plane with mask plane 0, i.e. pure coverage masks rather than colour art.
// They carry no image planes at all: every bob_plane op is set or clear, so a
// covered pixel is rewritten in place rather than blitted over.
//
// redraw_temp bits 0-5 are draw_bob's ACTIVE PLANE mask (Miscroutines.s:20), and
// block_draw then rewrites plane 5 for CD32 (Drawviews.s:3880). Combining that
// with each bob's own ops gives:
//
//   file        ops (planes 0-5)  redraw_temp        effect on a covered pixel
//   Light1-3    0,0,0,0,0,3       %1000000000100000  plane 5 set   -> +32
//   Water1-4    0,0,0,0,3,0       %0000000000110000  plane 4 set   -> +16
//                                 (block_draw forces plane 5 NODRAW for water,
//                                  so the lit state underneath survives, unless
//                                  .draw_bob_illuminate sets it)
//   Foam        3,2,2,2,0,0       %0000000001011111  low planes -> colour 1,
//                                 (planes 4-5 nodraw, so both banks survive)
const MASK_SETS = [
	{ key: 'lights', files: ['Light1', 'Light2', 'Light3'],
	  planes: [5], redrawTemp: 0b1000000000100000,
	  order: '0 = side light, 1 = rear-wall light, 2 = floor light' },
	{ key: 'water', files: ['Water1', 'Water2', 'Water3', 'Water4'],
	  planes: [4], redrawTemp: 0b0000000000110000,
	  order: 'indexed by the cell water level 0..3' },
	// Foam is a single bob drawn once per view when the player's OWN cell holds
	// water; the water level selects the block structure, so its first four
	// slots are the images and the rest are unused.
	{ key: 'foam', files: ['Foam'],
	  planes: [0, 1, 2, 3], redrawTemp: 0b0000000001011111,
	  order: 'single set; slot index is the water level 0..3, not a view slot' },
];

function buildMaskSet(set) {
	const rects = [];
	const entries = [];
	for (let i = 0; i < set.files.length; i++) {
		const src = path.join(REPO, 'Graphics', 'Misc', 'Raw', `${set.files[i]}.bin`);
		if (!fs.existsSync(src)) { console.warn(`  ! ${set.files[i]}.bin missing`); continue; }
		const buf = fs.readFileSync(src);
		const { slots, numPlanes, maskPlane, header } = parseBobFile(buf);
		const entry = { index: i, name: set.files[i], slots: new Array(NUM_SLOTS).fill(null) };
		slots.forEach((sl, n) => {
			// control 3 = nothing to draw (see buildStyle). Water3 slots 64-66 are
			// exactly this: 32x20 placeholders that painted a stray tinted block in
			// the corner of the view whenever water reached level 2.
			if (sl.control === CONTROL_RANDOM_FLIP) return;
			if (!sl.width || !sl.height || sl.width > 512 || sl.height > 512) return;
			const rowBytes = ((sl.width + 15) >> 4) * 2;
			if (sl.dataOffset < header ||
				sl.dataOffset + rowBytes * numPlanes * sl.height > buf.length) return;
			let img = decodeSlotImage(buf, sl, numPlanes, maskPlane);
			if (!img) return;
			// The masks carry the SAME bob_control pattern as the block art they
			// cover (above=0 normal, same=2 norm&flipped, below=1 flipped), so they
			// need the identical flip and mirrored-half treatment. Without it the
			// coverage is upside down relative to the art.
			if (sl.control === CONTROL_FLIPPED) img = flipVertical(img);
			rects.push({ set: i, slot: n, w: sl.width, h: sl.height, img });
			entry.slots[n] = { x: sl.x, y: sl.y, w: sl.width, h: sl.height };
			if (sl.control === CONTROL_NORM_AND_FLIPPED) {
				rects.push({ set: i, slot: n, mirror: true,
					w: sl.width, h: sl.height, img: flipVertical(img) });
				entry.slots[n].mirror = { x: sl.x, y: sl.y + sl.height, w: sl.width, h: sl.height };
			}
		});
		entries.push(entry);
	}
	if (!rects.length) return null;
	rects.sort((a, b) => b.h - a.h || b.w - a.w);
	const { width: aw, height: ah } = packRects(rects, 512);
	const atlas = new Uint8Array(aw * ah);
	for (const r of rects) {
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				if (r.img.mask[y * r.w + x]) atlas[(r.ay + y) * aw + (r.ax + x)] = 1;
			}
		}
		const e = entries.find((q) => q.index === r.set);
		if (!e || !e.slots[r.slot]) continue;
		if (r.mirror) { e.slots[r.slot].mirror.ax = r.ax; e.slots[r.slot].mirror.ay = r.ay; }
		else { e.slots[r.slot].ax = r.ax; e.slots[r.slot].ay = r.ay; }
	}
	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, `${set.key}.atlas`), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, `${set.key}.json`), JSON.stringify({
		atlas: { file: `${set.key}.atlas`, width: aw, height: ah },
		planes: set.planes,
		redrawTemp: set.redrawTemp,
		order: set.order,
		comment: 'One-bit coverage masks. A covered pixel gains the listed bitplanes; ' +
			'never blitted as pixels.',
		sets: entries,
	}));
	let set1 = 0; for (const v of atlas) if (v) set1++;
	console.log(`  ${set.key.padEnd(11)} atlas ${aw}x${ah}, ` +
		`slots ${entries.map((e) => `${e.name}:${e.slots.filter(Boolean).length}`).join(' ')}, ` +
		`${(set1 / atlas.length * 100).toFixed(1)}% covered`);
	return entries;
}

const EXPLOSION_SPRITE_FILES = ['expl1', 'expl2', 'expl3', 'expl4'];
const EXPLOSION_PALETTE = new Map([
	[3, 9],
	[5, 33],
	[7, 41],
]);

function validSlot(buf, sl, numPlanes, header) {
	if (!sl || !sl.width || !sl.height || sl.width > 512 || sl.height > 512) return false;
	const rowBytes = ((sl.width + 15) >> 4) * 2;
	return sl.dataOffset >= header &&
		sl.dataOffset + rowBytes * numPlanes * sl.height <= buf.length;
}

function buildExplosionSprites() {
	const rects = [];
	const entries = [];
	for (let i = 0; i < EXPLOSION_SPRITE_FILES.length; i++) {
		const name = EXPLOSION_SPRITE_FILES[i];
		const src = path.join(REPO, 'Graphics', 'Misc', 'Raw', `${name}.bin`);
		if (!fs.existsSync(src)) { console.warn(`  ! ${name}.bin missing`); continue; }
		const buf = fs.readFileSync(src);
		const { slots, numPlanes, maskPlane, header } = parseBobFile(buf);
		const entry = { index: i, name, slots: new Array(NUM_SLOTS).fill(null) };
		slots.forEach((sl, n) => {
			if (sl.control === CONTROL_RANDOM_FLIP) return;
			if (!validSlot(buf, sl, numPlanes, header)) return;
			let img = decodeSlotImage(buf, sl, numPlanes, maskPlane);
			if (!img) return;
			if (sl.control === CONTROL_FLIPPED) img = flipVertical(img);
			rects.push({ set: i, slot: n, w: sl.width, h: sl.height, img });
			entry.slots[n] = { x: sl.x, y: sl.y, w: sl.width, h: sl.height };
			if (sl.control === CONTROL_NORM_AND_FLIPPED) {
				rects.push({ set: i, slot: n, mirror: true,
					w: sl.width, h: sl.height, img: flipVertical(img) });
				entry.slots[n].mirror = { x: sl.x, y: sl.y + sl.height, w: sl.width, h: sl.height };
			}
		});
		entries.push(entry);
	}
	if (!rects.length) return null;
	rects.sort((a, b) => b.h - a.h || b.w - a.w);
	const { width: aw, height: ah } = packRects(rects, 512);
	const atlas = new Uint8Array(aw * ah);
	for (const r of rects) {
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				const src = y * r.w + x;
				if (!r.img.mask[src]) continue;
				const colour = EXPLOSION_PALETTE.get(r.img.pixels[src]);
				if (colour === undefined) continue;
				atlas[(r.ay + y) * aw + (r.ax + x)] = colour + 1;
			}
		}
		const e = entries.find((q) => q.index === r.set);
		if (!e || !e.slots[r.slot]) continue;
		if (r.mirror) { e.slots[r.slot].mirror.ax = r.ax; e.slots[r.slot].mirror.ay = r.ay; }
		else { e.slots[r.slot].ax = r.ax; e.slots[r.slot].ay = r.ay; }
	}
	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'explosions.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'explosions.json'), JSON.stringify({
		kind: 'indexedSprite',
		atlas: { file: 'explosions.atlas', width: aw, height: ah },
		source: 'Graphics/Misc/Raw/expl1.bin..expl4.bin (CD32)',
		sourceAssembly: 'Graphics/Misc/Ass/expl1_64.s..expl4_64.s',
		order: 'indexed by explosion ferocity 0..3',
		paletteMap: Object.fromEntries(EXPLOSION_PALETTE),
		comment: 'CD32 explosion BOBs are real masked colour sprites, unlike the older Explosion1-4 plane-rewrite masks. Atlas stores final palette index+1; 0 is transparent. Slot 44 is absent in the shipped raw files because its image data runs past EOF.',
		sets: entries,
	}, null, '\t'));
	let set1 = 0; for (const v of atlas) if (v) set1++;
	console.log(`  ${'explosions'.padEnd(11)} atlas ${aw}x${ah}, ` +
		`slots ${entries.map((e) => `${e.name}:${e.slots.filter(Boolean).length}`).join(' ')}, ` +
		`${(set1 / atlas.length * 100).toFixed(1)}% covered (CD32 colour sprites)`);
	return entries;
}

const FIRE_EFFECT_INDEX_BASE = 108;
const FIRE_EFFECT_PALETTES = {
	muzzleBases: [108, 112, 116, 120],
	hit: { base: 124, colours: [[255, 255, 255], [0, 0, 0], [255, 185, 171]] },
	fitness: { base: 208, colours: [[255, 255, 255], [255, 255, 255], [255, 225, 255]] },
};

function ilbmSprite(img, x0, y0, w, h) {
	const pixels = new Uint8Array(w * h);
	const mask = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const v = img.pixels[(y0 + y) * img.width + (x0 + x)];
			if (!v) continue;
			const dst = y * w + x;
			mask[dst] = 1;
			pixels[dst] = v;
		}
	}
	return { width: w, height: h, pixels, mask };
}

function addFireRect(rects, sprites, key, x, y, w, h, img) {
	const sprite = { key, x: 0, y: 0, w, h };
	sprites[key] = sprite;
	rects.push({ sprite, w, h, img: ilbmSprite(img, x, y, w, h) });
	return sprite;
}

function buildFireEffects() {
	const source = path.join(REPO, 'Data', 'GameChip.dat', 'FireEffectsCD32.ilbm');
	if (!fs.existsSync(source)) return null;
	const img = decodeILBM(fs.readFileSync(source));
	const rects = [];
	const sprites = {};
	const animNames = ['muzzle', 'zap', 'electric'];
	for (let anim = 0; anim < animNames.length; anim++) {
		for (let frame = 0; frame < 5; frame++) {
			addFireRect(rects, sprites, `${animNames[anim]}_${frame}`,
				frame * 64, anim * 40, 64, 40, img);
		}
	}
	for (let dist = 0; dist < 4; dist++) {
		for (let pos = 0; pos < 9; pos++) {
			addFireRect(rects, sprites, `hit_${dist}_${pos}`,
				pos * 16, 160 + dist * 16, 32, 16, img);
		}
	}
	for (let frame = 0; frame < 2; frame++) {
		// These are the two attached CD32 hardware sprite records from
		// FireEffectsCD32.script. Runtime draws both at the same screen origin;
		// the second crop's visible pixels live in its right half.
		addFireRect(rects, sprites, `fitness_${frame}`,
			frame * 16, 224, 32, 17, img);
	}
	rects.sort((a, b) => b.h - a.h || b.w - a.w);
	const { width: aw, height: ah } = packRects(rects, 512);
	const atlas = new Uint8Array(aw * ah);
	for (const r of rects) {
		for (let y = 0; y < r.h; y++) {
			for (let x = 0; x < r.w; x++) {
				const src = y * r.w + x;
				if (!r.img.mask[src]) continue;
				atlas[(r.ay + y) * aw + r.ax + x] = r.img.pixels[src] + 1;
			}
		}
		r.sprite.ax = r.ax;
		r.sprite.ay = r.ay;
	}
	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, 'fire-effects.atlas'), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, 'fire-effects.json'), JSON.stringify({
		source: 'Data/GameChip.dat/FireEffectsCD32.ilbm',
		sourceAssembly: 'Data/GameChip.dat/FireEffectsCD32.s',
		sourceScript: 'Data/GameChip.dat/FireEffectsCD32.script',
		atlas: { file: 'fire-effects.atlas', width: aw, height: ah },
		paletteBase: FIRE_EFFECT_INDEX_BASE,
		palettes: FIRE_EFFECT_PALETTES,
		animations: {
			1: { name: 'muzzle', frames: ['muzzle_0', 'muzzle_1', 'muzzle_2', 'muzzle_3', 'muzzle_4'] },
			2: { name: 'zap', frames: ['zap_0', 'zap_1', 'zap_2', 'zap_3', 'zap_4'] },
			3: { name: 'electric', frames: ['electric_0', 'electric_1', 'electric_2', 'electric_3', 'electric_4'] },
		},
		hit: {
			distances: 4,
			positions: 9,
			keys: Array.from({ length: 4 }, (_, d) =>
				Array.from({ length: 9 }, (_, p) => `hit_${d}_${p}`)),
		},
		fitness: { frames: ['fitness_0', 'fitness_1'] },
		sprites,
		comment: 'CD32 hardware sprite effects cropped from the original script. Atlas stores local sprite colour+1 and runtime draws with web synthetic palette offsets so sprite colours do not collide with sky gradient rows.',
	}, null, '\t'));
	let set1 = 0; for (const v of atlas) if (v) set1++;
	console.log(`  ${'fire-effects'.padEnd(11)} atlas ${aw}x${ah}, ` +
		`${Object.keys(sprites).length} sprites, ${(set1 / atlas.length * 100).toFixed(1)}% covered`);
	return sprites;
}

function buildMiscMasks() {
	console.log('');
	console.log('miscgfx mask sets:');
	for (const set of MASK_SETS) buildMaskSet(set);
	buildExplosionSprites();
	buildFireEffects();
}

const styles = process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3, 4, 5];
for (const n of styles) {
	try { buildStyle(n); } catch (e) { console.error(`  FAILED style${n}: ${e.message}`); }
}
buildPlanet();
buildMiscMasks();
