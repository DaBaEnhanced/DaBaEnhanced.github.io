'use strict';
// Extract the FRONT-END fonts -- the faces the menus, character select and
// world map draw their text with.
//
// These are NOT assets/gamefont.*, which comes from Graphics/Misc/Raw/
// GameFont.bin and is the small 16x6 in-game face used for HUD messages. The
// front end runs in a different screen mode (bplcon0 %1101000000000100 --
// HIRES + LACE, so 640 wide) and has its own fonts, which had never been
// extracted. That is why the shell fell back to `10px monospace`.
//
// Two fonts are needed, because the CD32 main menu mixes them:
//
//   FrontB  64x66  Front.dat   display face, CAPITALS ONLY -- titles
//   FrontS  48x44  Mesg.dat    body face, has lowercase -- the menu items
//                              ("Full campaign game" etc. are lowercase, so
//                              they cannot be drawn with FrontB)
//
// Both share the same header layout, e.g. Front.dat/FrontB.s:
//
//   width  = 64      cell width in pixels
//   height = 66      cell height (row pitch on the sheet)
//   dc.w 3           plane for mask
//   dc.w planes      bitplanes in the image
//   dc.b 1           proportional, with a per-glyph width table
//
// followed by a width table of 13 rows x 10 `dc.b`, indexed from SPACE (32),
// then an all-zero back-kerning table of the same shape.

const fs = require('fs');
const path = require('path');

const { decodeILBM } = require('./lib/iff');
const { encodePNG, indexedToRGBA } = require('./lib/png');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');

const FONTS = [
	{
		name: 'frontfont',
		metrics: 'Data/Front.dat/FrontB.s',
		sheet: 'Data/Front.dat/LaceFontB.ilbm',
		// The sheet holds 57 cells for 58 codepoints: '?' (63) has no glyph.
		// Reading the rendered sheet row by row gives
		//   row 0  ! " # $ % & ' ( ) *      33-42
		//   row 1  + , - . / 0 1 2 3 4      43-52
		//   row 2  5 6 7 8 9 : ; < = >      53-62
		//   row 3  @ A B C D E F G H I      64-73   <-- '?' skipped
		//   row 4  J K L M N O P Q R S      74-83
		//   row 5  T U V W X Y Z            84-90
		// Assuming a contiguous run shifts every letter from row 3 on by one
		// cell, which mis-maps the whole alphabet and makes 'Z' look absent.
		missing: [63],
	},
	{
		name: 'worldfont',
		metrics: 'Data/World.dat/WorldFont.s',
		sheet: 'Data/World.dat/WorldFont.ilbm',
		// show_map_info blits the location legend and status with
		// worldmap_font, not the Front.dat faces -- it is 16x8, so a whole
		// different order of size from FrontS's 48x44.
		//
		// The image is 704 wide but the glyphs only occupy 336 (21 cells of
		// 16); every one of the six 8px bands ends at x=335 and the rest is
		// blank, so the stride is 21, not the 44 the sheet width implies.
		// Checked against the rendered sheet: index 32 ('A') is row 1 col 11,
		// which is where 'A' actually sits.
		columns: 21,
		missing: [],
	},
	{
		name: 'frontsmall',
		metrics: 'Data/Mesg.dat/FrontS.s',
		sheet: 'Data/Mesg.dat/FrontS.ilbm',
		// Contiguous from '!'. Verified by matching per-cell ink width against
		// the width table: ! = 6, " = 12, # = 23, ' = 5, , = 8 all agree.
		missing: [],
	},
];

const FIRST_CHAR = 33;          // '!'. See readMetrics() for why space is absent.

/** Pull `width`/`height` equates out of the font's .s header. */
function readMetrics(file) {
	const text = fs.readFileSync(file, 'latin1');
	const num = (name) => {
		const m = text.match(new RegExp(`^${name}\\s+equ\\s+(\\d+)`, 'm'));
		if (!m) throw new Error(`${path.basename(file)}: no '${name} equ'`);
		return parseInt(m[1], 10);
	};
	// `dc.w N ;plane for mask` is the first dc.w after the height, and 6 means
	// "no mask". Pixels with that plane's bit set are not glyph ink.
	const mask = text.match(/dc\.w\s+(\d+)\s*;\s*plane for mask/);
	return {
		cellW: num('width'),
		cellH: num('height'),
		maskPlane: mask ? parseInt(mask[1], 10) : 6,
	};
}

/**
 * The width table is 13 rows of 10 `dc.b` starting at SPACE (32), followed by
 * an all-zero back-kerning table of the same shape. Only the first block is the
 * advance width.
 */
function readWidths(file) {
	const text = fs.readFileSync(file, 'latin1');
	const rows = [];
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(/^\s+dc\.b\s+((?:\d{1,3}\s*,\s*){9}\d{1,3})/);
		if (!m) continue;
		rows.push(m[1].split(',').map((v) => parseInt(v.trim(), 10)));
		if (rows.length >= 13) break;      // widths only; kerning follows
	}
	const flat = rows.flat();
	if (flat.length < 95) throw new Error(`${path.basename(file)}: width table has ${flat.length} entries`);
	const widths = {};
	for (let i = 0; i < flat.length; i++) widths[32 + i] = flat[i];
	return widths;
}

/**
 * A sheet pixel is glyph ink when it is non-zero and does NOT have the mask
 * plane's bit set. Every one of these sheets stores something else in that
 * plane -- FrontB/FrontS carry a black-on-black dither across all their cells,
 * WorldFont draws the cell grid in it. Counting those as ink makes each glyph
 * measure the full cell width.
 */
const inkTest = (maskPlane) => {
	const bit = maskPlane >= 0 && maskPlane < 6 ? 1 << maskPlane : 0;
	return (v) => v > 0 && (v & bit) === 0;
};

function extract(font) {
	const metricsFile = path.join(REPO, font.metrics);
	const { cellW, cellH, maskPlane } = readMetrics(metricsFile);
	const isInk = inkTest(maskPlane);
	const widths = readWidths(metricsFile);
	const sheet = decodeILBM(fs.readFileSync(path.join(REPO, font.sheet)));

	// The sheets are 640 wide but the cell pitch need not divide it evenly --
	// FrontS is 13 columns of 48 (624px), leaving 16px unused on the right.
	// Usually the sheet is packed to its full width, but WorldFont lays out 21
	// columns (336px) inside a 704px image and leaves the rest blank, so the
	// stride has to be given explicitly there.
	const columns = font.columns || Math.floor(sheet.width / cellW);
	const sheetRows = Math.floor(sheet.height / cellH);
	const missing = new Set(font.missing);

	// The .s files do not store a space cell in the image; they synthesise one
	// at assembly time ahead of the incbin, e.g. FrontB.s:
	//     data  REPT ((width/8)*height)*planes
	//             dc.b 0                        ;space
	//           ENDR
	//           incbin "ram:frontb.bin"
	// so cell 0 of the ILBM is '!' and space is advance-only.
	const order = [];
	for (let c = FIRST_CHAR, n = 0; n < columns * sheetRows; c++) {
		if (missing.has(c)) continue;
		order.push(c);
		n++;
	}

	const cellInk = (sx, sy) => {
		let n = 0;
		for (let y = 0; y < cellH; y++) {
			for (let x = 0; x < cellW; x++) {
				if (isInk(sheet.pixels[(sy + y) * sheet.width + (sx + x)])) n++;
			}
		}
		return n;
	};

	// Trim to the last cell that actually carries ink; the tail of the sheet is
	// blank padding, not glyphs.
	let last = -1;
	for (let n = 0; n < order.length; n++) {
		const sx = (n % columns) * cellW, sy = Math.floor(n / columns) * cellH;
		if (cellInk(sx, sy) > 0) last = n;
	}
	const count = last + 1;

	const atlasRows = Math.ceil(count / columns);
	const aw = columns * cellW, ah = atlasRows * cellH;
	// One byte per pixel: 0 = transparent, else the sheet's colour index + 1,
	// matching the convention the block atlases use (colour 0 is a real colour).
	const atlas = new Uint8Array(aw * ah);

	const glyphs = {};
	for (let n = 0; n < count; n++) {
		const c = order[n];
		const sx = (n % columns) * cellW, sy = Math.floor(n / columns) * cellH;
		const ax = (n % columns) * cellW, ay = Math.floor(n / columns) * cellH;
		let ink = 0, minX = cellW, maxX = -1;
		for (let y = 0; y < cellH; y++) {
			for (let x = 0; x < cellW; x++) {
				const v = sheet.pixels[(sy + y) * sheet.width + (sx + x)];
				if (!isInk(v)) continue;
				atlas[(ay + y) * aw + (ax + x)] = v + 1;
				ink++;
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
			}
		}
		glyphs[c] = {
			ax, ay, w: cellW, h: cellH,
			advance: widths[c] ?? cellW,
			ink,
			inkWidth: maxX < 0 ? 0 : maxX - minX + 1,
		};
	}

	fs.mkdirSync(OUT, { recursive: true });
	fs.writeFileSync(path.join(OUT, `${font.name}.atlas`), Buffer.from(atlas));
	fs.writeFileSync(path.join(OUT, `${font.name}.json`), JSON.stringify({
		source: font.sheet,
		metricsSource: font.metrics,
		comment: 'Front-end font. Atlas stores colour index + 1, so 0 means ' +
			'transparent. SPACE (32) has no cell and only advances. Advances ' +
			'come from the .s width table, indexed from SPACE.',
		atlas: { file: `${font.name}.atlas`, width: aw, height: ah },
		cellWidth: cellW, cellHeight: cellH, columns,
		firstChar: FIRST_CHAR,
		lastChar: order[count - 1],
		missing: font.missing,
		spaceAdvance: widths[32] ?? Math.round(cellW / 3),
		palette: sheet.palette
			? Array.from({ length: sheet.palette.length / 3 },
				(_, i) => [sheet.palette[i * 3], sheet.palette[i * 3 + 1], sheet.palette[i * 3 + 2]])
			: null,
		glyphs,
	}, null, '\t'));

	// Preview so the sheet can be eyeballed without a browser -- the character
	// mapping is only confirmable by looking at it.
	fs.writeFileSync(path.join(OUT, `${font.name}.preview.png`),
		encodePNG(aw, ah, indexedToRGBA(
			Array.from(atlas, (v) => (v ? v - 1 : 0)), sheet.palette || [], -1)));

	// Sanity-check the cell->char mapping on the letters: every A-Z cell must
	// carry ink, and that ink must fit inside the declared advance. A shifted
	// mapping breaks both -- letters land on blank or mismatched cells.
	// (Equality only holds for the big display faces; the 16x8 world font has
	// real side bearings, so ink is narrower than the advance.)
	let agree = 0, letters = 0;
	for (let c = 65; c <= 90; c++) {
		const g = glyphs[c];
		if (!g) continue;
		letters++;
		if (g.inkWidth > 0 && g.inkWidth <= g.advance) agree++;
	}
	console.log(`${font.name}: ${count} glyphs ${cellW}x${cellH}, ${columns} cols, ` +
		`atlas ${aw}x${ah}, chars ${FIRST_CHAR}-${order[count - 1]}`);
	console.log(`  A-Z ink fits advance: ${agree}/${letters}`);
	return { agree, letters };
}

function main() {
	let bad = 0;
	for (const font of FONTS) {
		const r = extract(font);
		if (r.agree !== r.letters) bad++;
	}
	if (bad) {
		console.error(`\n${bad} font(s) have letters whose advance disagrees with ` +
			`their ink width -- the cell->char mapping is probably shifted.`);
		process.exitCode = 1;
	}
}

main();
