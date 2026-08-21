'use strict';
// Extract the real screen palette from the game's compiled copper list.
//
// A copper list is a stream of 16-bit word pairs:
//   MOVE  word1 bit0 = 0 -> register offset (word1 & 0x1FE), word2 = value
//   WAIT  word1 bit0 = 1, word2 bit0 = 0
//   SKIP  word1 bit0 = 1, word2 bit0 = 1
//
// AGA reaches colours 32-255 by banking: BPLCON3 ($106) bits 13-15 select which
// group of 32 the COLOR00-31 registers ($180-$1BE) address. BPLCON3 bit 9 (LOCT)
// selects whether a write sets the high or low nibble of each 8-bit gun, so a
// full 24-bit colour takes two passes.

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'assets');

const REG_BPLCON3 = 0x106;
const REG_COLOR00 = 0x180;
const REG_COLOR31 = 0x1be;

// The first 3D view band starts here. GameCD32.s parks the whole palette at
// $000 up at line 10, long before the display window, then fills bank 0 and 1 in
// at `col_wait1` (C_WAIT 50) and `col_waits1` (C_WAIT 53) -- inside the view.
// Snapshotting at the first write instead of at the view's own raster line
// captured those placeholders and made half the screen black.
const VIEW_FIRST_LINE = 53;

/**
 * Play the copper list forward to `atLine` and return the palette in force
 * there. A copper list is a program, not a table: an index only means something
 * at a given raster position.
 */
// views_palette sits at the top of the list, before the display window. Its 32
// entries are compiled as zero and patched at screen-on, so writes to bank 0/1
// at or below this line are placeholders and take their value from game_palette.
const VIEWS_PALETTE_LINE = 15;

function parseCopperPalette(buf, seed, atLine = VIEW_FIRST_LINE) {
	// Two nibble planes per colour: high (LOCT=0) and low (LOCT=1).
	const hi = new Array(256).fill(null);
	const lo = new Array(256).fill(null);
	let bank = 0, loct = 0, vpos = 0;
	let moves = 0, colourWrites = 0;

	for (let o = 0; o + 3 < buf.length; o += 4) {
		const w1 = buf.readUInt16BE(o);
		const w2 = buf.readUInt16BE(o + 2);
		if (w1 & 1) {                      // WAIT or SKIP
			if (!(w2 & 1)) {                 // WAIT: advance the beam
				vpos = (w1 >> 8) & 0xff;
				if (vpos > atLine) break;
			}
			continue;
		}
		const reg = w1 & 0x1fe;
		moves++;

		if (reg === REG_BPLCON3) {
			bank = (w2 >> 13) & 7;
			loct = (w2 >> 9) & 1;
			continue;
		}
		if (reg < REG_COLOR00 || reg > REG_COLOR31) continue;

		const index = bank * 32 + ((reg - REG_COLOR00) >> 1);
		let rgb = [(w2 >> 8) & 0xf, (w2 >> 4) & 0xf, w2 & 0xf];
		// Substitute the runtime patch for the views_palette placeholders. The
		// later writes at C_WAIT 50/53 are real and must still win over them:
		// game_palette has $4f4 at colour 8, but col_wait1 drops it to $371
		// before the views are drawn. Keeping the patched value there left a
		// vivid green in the unlit bank.
		if (index < 32 && vpos <= VIEWS_PALETTE_LINE && seed && seed[index]) {
			rgb = seed[index];
		}
		// Last write wins up to the cut-off line. On AGA a LOCT=0 write sets the
		// high nibble and replicates it into the low one; only a LOCT=1 write
		// refines the low nibble. So a later high write discards an earlier low.
		if (loct) lo[index] = rgb;
		else { hi[index] = rgb; lo[index] = rgb; }
		colourWrites++;
	}

	// Combine: 8-bit gun = (high << 4) | low. Without a LOCT pass the high
	// nibble is replicated, which is the usual OCS-compatible expansion.
	const palette = [];
	for (let i = 0; i < 256; i++) {
		const h = hi[i];
		if (!h) { palette.push(null); continue; }
		const l = lo[i] || h;
		palette.push([(h[0] << 4) | l[0], (h[1] << 4) | l[1], (h[2] << 4) | l[2]]);
	}
	return { palette, moves, colourWrites, banksSeen: bank };
}

/**
 * Banks 0 and 1 are placeholders in the compiled list: `views_palette` is 32
 * C_MOVEs of zero, patched at screen-on by
 *   Main.s:6488  DISPLAY_PALETTE game_palette, views_palette(a1)
 * from the 32-word table at Main.s:7389. Those are 12-bit $rgb values, and they
 * are the SAME source nibbles the copper's C_BANK 32 block feeds through COL1 --
 * so the four banks are one palette in two brightnesses and two tints:
 *
 *   0-15  plain block palette (unlit)     32-47  COL1 lift of it   (lit)
 *   16-31 plain water tint   (unlit)      48-63  COL1 lift of that (lit)
 *
 * Lighting is therefore the haze-and-contrast lift, NOT colour-vs-black. An
 * earlier reading had banks 0-1 staying black through the view, which made half
 * of every map pitch dark.
 */
function parseGamePalette(src) {
	const text = fs.readFileSync(src, 'latin1');
	const start = text.search(/^game_palette\s/m);
	if (start < 0) throw new Error('game_palette not found in Main.s');
	const out = [];
	for (const line of text.slice(start).split(/\r?\n/)) {
		const m = line.match(/dc\.w\s+(.*)$/);
		if (!m) { if (out.length) break; continue; }
		for (const tok of m[1].split(',')) {
			const v = tok.trim().match(/^\$([0-9a-f]{3})$/i);
			if (!v) continue;
			const n = parseInt(v[1], 16);
			// Kept as nibbles: these are fed back through the copper replay as if
			// they had been compiled into views_palette in the first place.
			out.push([(n >> 8) & 0xf, (n >> 4) & 0xf, n & 0xf]);
		}
		if (out.length >= 32) break;
	}
	if (out.length < 32) throw new Error(`game_palette: got ${out.length} of 32 entries`);
	return out.slice(0, 32);
}

const file = process.argv[2] || path.join(REPO, 'Sources', 'CopperLists', 'gamecd32');
const buf = fs.readFileSync(file);
// Banks 0 and 1 are patched in from Main.s at screen-on (see above), so the
// replay is seeded with them and the list's own later writes still apply on top.
const views = parseGamePalette(path.join(REPO, 'Sources', 'Main.s'));
const { palette, moves, colourWrites } = parseCopperPalette(buf, views);

const defined = palette.filter(Boolean).length;
console.log(`${path.relative(REPO, file)}  ${buf.length} bytes`);
console.log(`  ${moves} copper MOVEs, ${colourWrites} colour writes, ${defined} indices defined`);

const hex = (c) => (c ? c.map((v) => v.toString(16).padStart(2, '0')).join('') : '------');
for (let row = 0; row < 8; row++) {
	const cells = [];
	for (let i = row * 8; i < row * 8 + 8; i++) cells.push(`${String(i).padStart(2)}:${hex(palette[i])}`);
	console.log('   ' + cells.join(' '));
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'palette.json'), JSON.stringify({
	source: path.relative(REPO, file).replace(/\\/g, '/'),
	viewsPaletteSource: 'Sources/Main.s game_palette',
	comment: 'The four 16-colour banks the 3D view composites through. Plane 4 is ' +
		'the water bit (+16) and plane 5 the lit bit (+32), so one art colour i ' +
		'lands at i, 16+i, 32+i or 48+i. Banks 0-1 are game_palette (Main.s), ' +
		'patched into the copper list views_palette placeholders at screen-on; ' +
		'banks 2-3 are baked into the list -- the same colours run through the ' +
		'COL1/COL2 contrast-and-haze lift. Lighting IS that lift, not colour ' +
		'versus black.',
	colours: palette.slice(0, 64),
	unlitBase: 0,
	waterBase: 16,
	litBase: 32,
	litWaterBase: 48,
	unlitPalette: palette.slice(0, 16),
	waterPalette: palette.slice(16, 32),
	litPalette: palette.slice(32, 48),
	litWaterPalette: palette.slice(48, 64),
}, null, '\t'));
console.log(`\nwrote assets/palette.json (64 entries)`);
