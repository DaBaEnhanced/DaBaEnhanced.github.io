// An optional CRT filter over the whole page.
//
// Purely cosmetic and off by default: nothing under it changes, and the parity
// path is untouched. It is a CSS overlay rather than a WebGL post-process
// because the thing it has to cover is not one canvas -- the game screen, the
// shell, the editor, the end screens and the intro are separate elements, and
// re-plumbing all of them through a shader to draw some scanlines would be a
// poor trade.
//
// Three layers, in the order a real tube produces them:
//
//   scanlines   the gaps between raster lines, at the display's own pixel pitch
//   aperture    the RGB phosphor stripe, three subpixels to a triad
//   glass       vignette and a corner-to-corner sheen
//
// The scanline pitch follows the integer upscale the game is already using, so
// the dark line lands between rendered pixel rows instead of cutting through
// them and turning everything to mush.

const CRT_KEY = 'hiredguns-crt';

const state = { on: false, scale: 3 };

function host() { return document.getElementById('crt'); }

/**
 * @param scale the integer upscale the screen is drawn at, so one scanline
 *              covers one source pixel row rather than an arbitrary count
 */
export function setCrtScale(scale) {
	const next = Math.max(2, Math.min(8, scale | 0));
	if (next === state.scale) return;
	state.scale = next;
	apply();
}

function apply() {
	const el = host();
	if (!el) return;
	el.classList.toggle('on', state.on);
	if (!state.on) return;
	const px = state.scale;
	// One dark line per source pixel row. Below 3x there is no room for a gap
	// that does not swallow the image, so the lines thin out instead.
	const gap = px >= 4 ? 2 : 1;
	el.style.setProperty('--crt-pitch', `${px}px`);
	el.style.setProperty('--crt-gap', `${gap}px`);
}

export function crtEnabled() { return state.on; }

/**
 * @param persist false to change the filter WITHOUT touching the saved
 *                preference -- the editor turns it off for as long as it is
 *                open, and a page closed in there must not come back with the
 *                user's choice overwritten.
 */
export function setCrt(on, persist = true) {
	state.on = !!on;
	const box = document.getElementById('crt-toggle-box');
	if (box) box.checked = state.on;
	if (persist) {
		try { localStorage.setItem(CRT_KEY, state.on ? '1' : '0'); } catch (_) { /* private mode */ }
	}
	apply();
	return state.on;
}

export function initCrt() {
	let saved = false;
    try { saved = localStorage.getItem(CRT_KEY) === '1'; } catch (_) { /* private mode */ }
	setCrt(saved);
	document.getElementById('crt-toggle-box')
		?.addEventListener('change', (e) => setCrt(e.target.checked));
}
