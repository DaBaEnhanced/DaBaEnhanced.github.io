// Bitmap text for the campaign shell, using the original front-end fonts.
//
// The front end is a text-driven menu system: Front.s builds screens out of
// BLIT_TEXT streams with ABSPOS/CENTRE/NEWLINE control codes, drawn with two
// proportional fonts (see tools/build-frontfont.js):
//
//   frontfont   FrontB, 64x66  display face, CAPITALS ONLY  -- titles
//   frontsmall  FrontS, 48x44  body face, has lowercase     -- menu items
//
// Coordinates here are in the front end's own 640x512 HIRES+LACE space, not
// the game's 320x212 lores screen.

// Control codes, from Sources/Macros.i.
export const TEXT = {
	ENDTEXT: 0,
	CENTRE: 252,      // centre this line
	NEWLINE: 254,
	ENDPHRASE: 245,
	PHRASEBOOK: 246,
	CENTREON: 247,
};

// Several codepoints carry UI artwork rather than letters -- confirmed by
// eyeballing assets/frontsmall.preview.png. Front.s relies on this: the menu
// separator is written `dc.b "$$$$$$..."`, and the credits read
// "Copyright % Psygnosis", where '%' is the (c) glyph.
export const GLYPH = {
	BAR: '$',         // solid block, used to rule off a menu
	COPYRIGHT: '%',   // (c)
	RETURN_KEY: ';',  // return-key icon
	NEXT: '=',        // the word "next" as one glyph
	DELETE_KEY: '{',  // "Del" icon
	DISK1: '\\',      // numbered save-disk icons, '\\' through '`'
};

const ASSETS = 'assets/';

async function fetchJSON(url) {
	const r = await fetch(ASSETS + url);
	if (!r.ok) throw new Error(`${url}: ${r.status}`);
	return r.json();
}

async function fetchBytes(url) {
	const r = await fetch(ASSETS + url);
	if (!r.ok) throw new Error(`${url}: ${r.status}`);
	return new Uint8Array(await r.arrayBuffer());
}

/**
 * Paint the whole atlas once into an RGBA canvas, tinted to `rgb`.
 *
 * The atlas stores colour index + 1 (0 = transparent) and the sheet palette is
 * a grey ramp, so tinting means scaling the ramp by the target colour. That
 * keeps the face's antialiasing instead of flattening it to a single colour.
 */
function renderAtlas(meta, atlas, rgb) {
	const { width: w, height: h } = meta.atlas;
	const cv = document.createElement('canvas');
	cv.width = w;
	cv.height = h;
	const ctx = cv.getContext('2d');
	const img = ctx.createImageData(w, h);
	const pal = meta.palette || [];
	for (let i = 0; i < atlas.length; i++) {
		const v = atlas[i];
		if (!v) continue;                        // transparent
		const src = pal[v - 1] || [255, 255, 255];
		// The ramp's brightest entry is ~240; normalise against it so the tint
		// colour is reached at full ink rather than being darkened by 240/255.
		const l = Math.max(src[0], src[1], src[2]) / 240;
		const o = i * 4;
		img.data[o] = Math.min(255, rgb[0] * l);
		img.data[o + 1] = Math.min(255, rgb[1] * l);
		img.data[o + 2] = Math.min(255, rgb[2] * l);
		img.data[o + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return cv;
}

export async function loadFont(name) {
	const meta = await fetchJSON(`${name}.json`);
	const atlas = await fetchBytes(meta.atlas.file);
	return { meta, atlas, tints: new Map() };
}

function tinted(font, rgb) {
	const key = `${rgb[0]},${rgb[1]},${rgb[2]}`;
	let cv = font.tints.get(key);
	if (!cv) {
		cv = renderAtlas(font.meta, font.atlas, rgb);
		font.tints.set(key, cv);
	}
	return cv;
}

/** Advance width of one codepoint, honouring the proportional width table. */
export function advanceOf(font, code) {
	if (code === 32) return font.meta.spaceAdvance;
	return font.meta.glyphs[code]?.advance ?? font.meta.spaceAdvance;
}

export function measureText(font, text) {
	let w = 0;
	for (let i = 0; i < text.length; i++) w += advanceOf(font, text.charCodeAt(i));
	return w;
}

/**
 * Draw `text` with its top-left at (x, y), in the font's own pixel space.
 *
 * Glyph cells are much taller than the visible face (66px cells for FrontB),
 * and the original blits the whole cell, so cells overlap vertically by design.
 */
export function drawText(ctx, font, text, x, y, rgb = [255, 255, 255]) {
	const sheet = tinted(font, rgb);
	const { cellWidth: cw, cellHeight: ch, glyphs } = font.meta;
	let px = x;
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		const g = glyphs[code];
		if (g) ctx.drawImage(sheet, g.ax, g.ay, cw, ch, px, y, cw, ch);
		px += advanceOf(font, code);
	}
	return px - x;
}

/** Draw centred on `cx`. Front.s uses this for titles and credit lines. */
export function drawCentred(ctx, font, text, cx, y, rgb) {
	const w = measureText(font, text);
	return drawText(ctx, font, text, Math.round(cx - w / 2), y, rgb);
}
