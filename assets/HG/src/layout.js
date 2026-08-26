// Pure display-layout helpers. Kept out of main.js so fullscreen fitting can
// be checked without creating a browser DOM.

/**
 * Largest uniform scale that fits the native game rectangle in the available
 * space. Fullscreen allows fractional/down scales; normal presentation keeps
 * the source-accurate whole-pixel enlargement used by the desktop page.
 */
export function fittedGameScale(width, height, nativeWidth, nativeHeight,
	{ fractional = false } = {}) {
	const w = Math.max(0, Number(width) || 0);
	const h = Math.max(0, Number(height) || 0);
	const raw = Math.min(w / nativeWidth, h / nativeHeight);
	if (fractional) return Math.max(0.01, raw);
	return Math.max(1, Math.floor(raw));
}
