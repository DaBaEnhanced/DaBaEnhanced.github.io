// The death screen and the outro.
//
// Both are full-screen stills with text over them, not part of the 3D view, so
// they render to their own DOM canvas rather than through the indexed pipeline.
// Their palettes came out of their own CMAPs at build time (build-endscreens.js)
// and nothing else shares them.
//
// The outro's text positions come from Data/Outro.dat/Text.s. Every line there
// is `ABSPOS x,y CENTRE` with x = 100, while the same code elsewhere writes
// `ABSPOS 0,y CENTRE` for a centred title -- so CENTRE centres on the display
// and only the y matters. That is the reading that makes both call sites sane.

import { loadFont, drawCentred } from './frontfont.js';

/**
 * The game's own 16x6 HUD font, in the shape frontfont.js draws with.
 *
 * The face matters here. The front-end fonts are display cells -- 48x44 and
 * 64x66, built for the 640x512 menu -- and against Text.s's 10px line pitch they
 * overlap into a smear. worldfont at 16x8 is legible but too wide: the longest
 * epilogue line is 46 characters and runs off both edges of a 320px backdrop.
 * The HUD font is the one that was sized for 320-wide prose.
 *
 * Its metadata is laid out as a grid plus a width table rather than the
 * per-glyph map loadFont returns, so it is converted rather than duplicated.
 */
async function loadGameFont() {
	const font = await loadFont('gamefont');
	const m = font.meta;
	if (m.glyphs) return font;                    // already in the right shape
	const glyphs = {};
	for (let i = 0; i < m.count; i++) {
		glyphs[m.startChar + i] = {
			ax: (i % m.columns) * m.cellWidth,
			ay: Math.floor(i / m.columns) * m.cellHeight,
			advance: (m.widths && m.widths[i]) || m.cellWidth,
		};
	}
	font.meta = {
		...m,
		glyphs,
		spaceAdvance: (m.widths && m.widths[0]) || m.cellWidth,
	};
	return font;
}

// SETPEN 2 in Text.s, against the backdrop's green CRT field.
const OUTRO_INK = [190, 235, 190];

const state = {
	meta: null,
	images: {},
	font: null,
	active: null,
};

export async function loadEndScreens(assetsBase = 'assets/') {
	if (state.meta) return state.meta;
	const meta = await (await fetch(`${assetsBase}endscreens.json`)).json();
	await Promise.all(Object.entries(meta.images).map(([key, info]) =>
		new Promise((resolve) => {
			const img = new Image();
			img.onload = () => { state.images[key] = img; resolve(); };
			img.onerror = () => resolve();          // a missing still is not fatal
			img.src = assetsBase + info.file;
		})));
	state.meta = meta;
	return meta;
}

function host() { return document.getElementById('endscreen'); }
function canvas() { return document.getElementById('endscreen-canvas'); }

/**
 * Integer-upscale the still to fill as much of the window as fits.
 *
 * `zoom` renders the backdrop larger than its own pixels before anything is
 * drawn over it. The epilogue pages need it: the front-end fonts live in the
 * 640x512 HIRES space, so at 1:1 on a 320-wide backdrop every glyph is twice
 * the size it should be and Text.s's 10px line pitch collides into a smear.
 * Doubling the backdrop puts the font back at its native size and turns that
 * pitch into a readable 20px.
 */
function paint(key, draw, zoom = 1) {
	const img = state.images[key];
	const c = canvas();
	if (!c || !img) return null;
	const w = img.width * zoom, h = img.height * zoom;
	const scale = Math.max(1, Math.min(
		Math.floor(window.innerWidth / w),
		Math.floor((window.innerHeight - 40) / h)));
	c.width = w;
	c.height = h;
	c.style.width = `${w * scale}px`;
	c.style.height = `${h * scale}px`;
	const ctx = c.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.clearRect(0, 0, w, h);
	ctx.drawImage(img, 0, 0, w, h);
	if (draw) draw(ctx, c, zoom);
	return ctx;
}

function show(caption) {
	const h = host();
	if (!h) return;
	h.classList.remove('hidden');
	const cap = document.getElementById('endscreen-caption');
	if (cap) cap.textContent = caption || '';
}

function hide() {
	host()?.classList.add('hidden');
	state.active = null;
}

/**
 * Wait for the player to advance, or for a timeout.
 *
 * @returns 'advance' or 'timeout'
 */
function waitForAdvance(ms) {
	return new Promise((resolve) => {
		let done = false;
		const finish = (why) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			window.removeEventListener('pointerdown', onGesture, true);
			window.removeEventListener('keydown', onGesture, true);
			resolve(why);
		};
		const onGesture = (e) => {
			if (e.type === 'keydown' && (e.key === 'F5' || e.key === 'F12')) return;
			e.preventDefault();
			e.stopPropagation();
			finish('advance');
		};
		const timer = ms ? setTimeout(() => finish('timeout'), ms) : 0;
		window.addEventListener('pointerdown', onGesture, true);
		window.addEventListener('keydown', onGesture, true);
	});
}

/** GAME OVER. Resolves when the player dismisses it. */
export async function showDeathScreen({ audio } = {}) {
	await loadEndScreens();
	state.active = 'death';
	paint('death');
	show('press any key');
	audio?.playMusic?.(state.meta.music.death);
	await waitForAdvance(0);
	hide();
	return 'done';
}

/**
 * The ending: the mushroom cloud, then one page per surviving character saying
 * what became of them.
 *
 * @param party  character INDICES in party order.
 *
 * Text.s's `start` table is twelve ordered pointers and they line up one for one
 * with the character roster -- clavius/cheule/cim/... against Clavius, "Siygess,
 * Cheule", "MC 128-7 CIM". So the epilogue is chosen by index. Matching on the
 * name does not work: the roster carries surnames ("Spey, Bonden") that Text.s
 * does not, and only three of the twelve would ever match.
 */
export async function showOutro({ audio, party = [] } = {}) {
	const meta = await loadEndScreens();
	if (!state.font) state.font = await loadGameFont().catch(() => null);
	state.active = 'outro';

	audio?.playMusic?.(meta.music.outro);
	paint('mushroom');
	show('press any key');
	await waitForAdvance(12000);

	// Only the characters who were actually on the mission get an epilogue, in
	// party order. An index with no entry is skipped rather than guessed at.
	const wanted = party.length
		? party.map((i) => meta.outro[i | 0]).filter(Boolean)
		: meta.outro;

	for (const person of wanted) {
		paint('backdrop', (ctx, c, zoom) => {
			if (!state.font) return;
			for (const line of person.lines) {
				drawCentred(ctx, state.font, line.text, c.width / 2, line.y * zoom,
					OUTRO_INK);
			}
		});
		show(`${person.key}  --  press any key`);
		await waitForAdvance(0);
	}
	hide();
	return 'done';
}

/** For the debug menu: show one screen without playing the campaign. */
export async function previewEndScreen(which, opts = {}) {
	if (which === 'death') return showDeathScreen(opts);
	return showOutro(opts);
}

export function endScreenActive() { return state.active; }
