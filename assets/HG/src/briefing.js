// The pre-mission briefing.
//
// A location names its picture through locn.picture_num, which Static.s turns
// into "Static/StaticNN.pic" (Static.s:167). 0 means no picture -- every action
// and training map -- so those go straight into the level.
//
// The text is the location's own, already carried in each map's locn: `legend`
// is the coordinate readout, `legend2` the log entry and threat rating, `info`
// the description. `~` is the padding character throughout this data, used to
// fill fixed-width fields, so it is stripped rather than drawn.

import { loadFont, drawCentred, drawText, measureText } from './frontfont.js';

const state = { meta: null, images: new Map(), font: null };

export async function loadBriefings(assetsBase = 'assets/') {
	if (state.meta) return state.meta;
	state.meta = await (await fetch(`${assetsBase}briefings.json`)).json();
	state.base = assetsBase;
	return state.meta;
}

function picture(num) {
	if (state.images.has(num)) return state.images.get(num);
	const info = state.meta?.pictures?.[num];
	if (!info) return null;
	const img = new Image();
	img.src = state.base + info.file;
	state.images.set(num, img);
	return img;
}

/** Strip the `~` padding this data uses to fill fixed-width fields. */
const clean = (s) => String(s || '').replace(/~+/g, ' ').replace(/\s+/g, ' ').trim();

/** Break a string into lines that fit `width` in the given font. */
function wrap(font, text, width) {
	const out = [];
	let line = '';
	for (const word of clean(text).split(' ')) {
		if (!word) continue;
		const next = line ? `${line} ${word}` : word;
		if (line && measureText(font, next) > width) {
			out.push(line);
			line = word;
		} else {
			line = next;
		}
	}
	if (line) out.push(line);
	return out;
}

const W = 640, H = 400;
const PAD = 16;
const INK = [200, 220, 210];
const INK_DIM = [130, 150, 145];
const INK_HOT = [255, 225, 150];

/**
 * Show the briefing for a location. Resolves when it is dismissed, or at once
 * when the location has no picture.
 *
 * @param locn  the location record (map.locn)
 */
export async function showBriefing(locn, { audio } = {}) {
	const meta = await loadBriefings();
	const num = locn?.pictureNum | 0;
	if (!num || !meta.pictures[num]) return 'no picture';
	if (!state.font) state.font = await loadFont('gamefont').then(adapt).catch(() => null);

	const host = document.getElementById('endscreen');
	const canvas = document.getElementById('endscreen-canvas');
	if (!host || !canvas) return 'no player';

	const img = picture(num);
	if (img && !img.complete) {
		await new Promise((r) => { img.onload = r; img.onerror = r; });
	}

	const scale = Math.max(1, Math.min(
		Math.floor(window.innerWidth / W), Math.floor((window.innerHeight - 40) / H)));
	canvas.width = W;
	canvas.height = H;
	canvas.style.width = `${W * scale}px`;
	canvas.style.height = `${H * scale}px`;
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, W, H);

	// Picture on the left at whatever whole scale fits the height, text beside
	// it. The art is portrait and varies from 128x178 to 272x393, so a fixed
	// split would either crop the tall ones or strand the short ones.
	let textX = PAD;
	if (img && img.width) {
		const fit = Math.max(1, Math.floor((H - PAD * 2) / img.height));
		const iw = img.width * fit, ih = img.height * fit;
		ctx.drawImage(img, PAD, Math.floor((H - ih) / 2), iw, ih);
		textX = PAD + iw + PAD;
	}
	const textW = W - textX - PAD;

	if (state.font) {
		let y = PAD + 8;
		const put = (text, ink, gap = 2) => {
			for (const line of wrap(state.font, text, textW)) {
				drawText(ctx, state.font, line, textX, y, ink);
				y += state.font.meta.cellHeight + gap;
			}
		};
		// legend2's first sentence is the name; the rest is the threat rating.
		const legend2 = clean(locn.legend2);
		const split = legend2.indexOf('ESTIMATED THREAT');
		put(split > 0 ? legend2.slice(0, split) : legend2, INK_HOT, 4);
		if (split > 0) put(legend2.slice(split), INK_DIM, 6);
		put(clean(locn.legend), INK_DIM, 6);
		y += 4;
		put(clean(locn.info), INK, 2);
		if (locn.legend3) put(clean(locn.legend3), INK_DIM, 2);

		drawCentred(ctx, state.font, 'PRESS ANY KEY TO BEGIN', W / 2, H - PAD, INK_DIM);
	}

	host.classList.remove('hidden');
	const cap = document.getElementById('endscreen-caption');
	if (cap) cap.textContent = '';
	await new Promise((resolve) => {
		const onGesture = (e) => {
			if (e.type === 'keydown' && (e.key === 'F5' || e.key === 'F12')) return;
			e.preventDefault();
			e.stopPropagation();
			window.removeEventListener('pointerdown', onGesture, true);
			window.removeEventListener('keydown', onGesture, true);
			resolve();
		};
		window.addEventListener('pointerdown', onGesture, true);
		window.addEventListener('keydown', onGesture, true);
	});
	host.classList.add('hidden');
	return 'done';
}

/** gamefont is a grid plus a width table; frontfont.js draws a glyph map. */
function adapt(font) {
	const m = font.meta;
	if (m.glyphs) return font;
	const glyphs = {};
	for (let i = 0; i < m.count; i++) {
		glyphs[m.startChar + i] = {
			ax: (i % m.columns) * m.cellWidth,
			ay: Math.floor(i / m.columns) * m.cellHeight,
			advance: (m.widths && m.widths[i]) || m.cellWidth,
		};
	}
	font.meta = { ...m, glyphs, spaceAdvance: (m.widths && m.widths[0]) || m.cellWidth };
	return font;
}
