// Shared palette-index compositor.
//
// The Amiga built each frame in a planar index buffer and let the hardware turn
// indices into colour. Both renderers do the same here: they composite into one
// 320x212 index buffer and differ only in how they present it. That keeps the
// WebGPU and Canvas2D paths identical by construction rather than by discipline,
// and it is what makes the CD32 lighting expressible at all -- lighting is an
// index offset, which has no meaning once pixels are already RGBA.

import {
	SCREEN_W, SCREEN_H, VIEW_W, VIEW_H,
	SKY_BAND_HEIGHT, SKY_UPPER_INDEX, SKY_LOWER_INDEX,
	SKY_GRADIENT_ROWS, skyRowIndex,
	LIGHT_OFFSET, WATER_OFFSET, EXPLOSION_COLOUR, FOAM_COLOUR, HW_INDEX_COUNT,
	FIELD_COLOUR_BASE, FIELD_COLOUR_ROWS,
} from './view.js';

const DECAL_LIGHT = 0, DECAL_WATER = 1, DECAL_EXPLOSION = 2, DECAL_FOAM = 3;
const PLAYER_PARTS = ['front', 'left', 'right', 'back'];

export class IndexCompositor {
	constructor() {
		this.indices = new Uint8Array(SCREEN_W * SCREEN_H);
	}

	clear() { this.indices.fill(0); }

	fillRect(x, y, w, h, colour) {
		const { indices } = this;
		const x0 = Math.max(0, x | 0);
		const y0 = Math.max(0, y | 0);
		const x1 = Math.min(SCREEN_W, (x + w) | 0);
		const y1 = Math.min(SCREEN_H, (y + h) | 0);
		if (x1 <= x0 || y1 <= y0) return;
		for (let yy = y0; yy < y1; yy++) {
			indices.fill(colour & 255, yy * SCREEN_W + x0, yy * SCREEN_W + x1);
		}
	}

	fillRectClipped(x, y, w, h, colour, clip) {
		if (!clip) { this.fillRect(x, y, w, h, colour); return; }
		const { indices } = this;
		const x0 = Math.max(0, clip.x0 | 0, x | 0);
		const y0 = Math.max(0, clip.y0 | 0, y | 0);
		const x1 = Math.min(SCREEN_W, clip.x1 | 0, (x + w) | 0);
		const y1 = Math.min(SCREEN_H, clip.y1 | 0, (y + h) | 0);
		if (x1 <= x0 || y1 <= y0) return;
		for (let yy = y0; yy < y1; yy++) {
			indices.fill(colour & 255, yy * SCREEN_W + x0, yy * SCREEN_W + x1);
		}
	}

	strokeRect(x, y, w, h, colour) {
		this.fillRect(x, y, w, 1, colour);
		this.fillRect(x, y + h - 1, w, 1, colour);
		this.fillRect(x, y, 1, h, colour);
		this.fillRect(x + w - 1, y, 1, h, colour);
	}

	strokeRectClipped(x, y, w, h, colour, clip) {
		this.fillRectClipped(x, y, w, 1, colour, clip);
		this.fillRectClipped(x, y + h - 1, w, 1, colour, clip);
		this.fillRectClipped(x, y, 1, h, colour, clip);
		this.fillRectClipped(x + w - 1, y, 1, h, colour, clip);
	}

	/** black_out_window: clear the clipped 3D view interior back to colour 0. */
	clearView(originX, originY, viewX, viewY) {
		const { indices } = this;
		const x0 = originX + viewX, x1 = x0 + VIEW_W;
		for (let y = 0; y < VIEW_H; y++) {
			const row = (originY + viewY + y) * SCREEN_W;
			indices.fill(0, row + x0, row + x1);
		}
	}

	/**
	 * cpu_player_window/blit_player_window for Windows.gfx records.
	 * These BOBs have no mask, so colour index 0 is copied as a real pixel.
	 */
	drawWindowFrame(frame, atlas, originX, originY, opts = {}) {
		this.drawWindowFrameClipped(frame, atlas, originX, originY, null, opts);
	}

	drawWindowFrameClipped(frame, atlas, originX, originY, clip, opts = {}) {
		if (!frame) return;
		const { indices } = this;
		const w = frame.width, h = frame.height;
		const clearColour = opts.clearColour ?? 0;
		const clipX0 = clip ? Math.max(0, clip.x0 | 0) : 0;
		const clipY0 = clip ? Math.max(0, clip.y0 | 0) : 0;
		const clipX1 = clip ? Math.min(SCREEN_W, clip.x1 | 0) : SCREEN_W;
		const clipY1 = clip ? Math.min(SCREEN_H, clip.y1 | 0) : SCREEN_H;
		if (frame.clear || !atlas || frame.ax === undefined) {
			for (let y = 0; y < h; y++) {
				const dy = originY + y;
				if (dy < clipY0 || dy >= clipY1) continue;
				const x0 = Math.max(clipX0, originX);
				const x1 = Math.min(clipX1, originX + w);
				if (x1 <= x0) continue;
				indices.fill(clearColour, dy * SCREEN_W + x0, dy * SCREEN_W + x1);
			}
			return;
		}
		for (let y = 0; y < h; y++) {
			const dy = originY + y;
			if (dy < clipY0 || dy >= clipY1) continue;
			let src = (frame.ay + y) * atlas.width + frame.ax;
			let dst = dy * SCREEN_W + originX;
			for (let x = 0; x < w; x++, src++, dst++) {
				const dx = originX + x;
				if (dx < clipX0 || dx >= clipX1) continue;
				const v = atlas.data[src];
				indices[dst] = v ? v - 1 : 0;
			}
		}
	}

	/** Draw an index+1 atlas rect, treating 0 as transparent. */
	drawIndexedSprite(rect, atlas, x, y, colourOffset = 0) {
		this.drawIndexedSpriteClipped(rect, atlas, x, y, null, colourOffset);
	}

	drawPlaneOpSprite(rect, atlas, x, y, keep, set, clip = null) {
		if (!rect || !atlas) return;
		const { indices } = this;
		const w = rect.w ?? rect.width, h = rect.h ?? rect.height;
		const dx0 = (x + (rect.x || 0)) | 0;
		const dy0 = (y + (rect.y || 0)) | 0;
		const clipX0 = clip ? Math.max(0, clip.x0 | 0) : 0;
		const clipY0 = clip ? Math.max(0, clip.y0 | 0) : 0;
		const clipX1 = clip ? Math.min(SCREEN_W, clip.x1 | 0) : SCREEN_W;
		const clipY1 = clip ? Math.min(SCREEN_H, clip.y1 | 0) : SCREEN_H;
		for (let yy = 0; yy < h; yy++) {
			const dy = dy0 + yy;
			if (dy < clipY0 || dy >= clipY1) continue;
			let src = (rect.ay + yy) * atlas.width + rect.ax;
			let dst = dy * SCREEN_W + dx0;
			for (let xx = 0; xx < w; xx++, src++, dst++) {
				const dx = dx0 + xx;
				if (dx < clipX0 || dx >= clipX1) continue;
				if (!atlas.data[src]) continue;
				const v = indices[dst];
				indices[dst] = (v & keep) | set;
			}
		}
	}

	drawIndexedSpriteClipped(rect, atlas, x, y, clip, colourOffset = 0) {
		this.blitIndexedSprite(rect, atlas, x, y, clip, colourOffset, -1);
	}

	drawMaskedSolid(rect, atlas, x, y, colour, clip = null) {
		this.blitIndexedSprite(rect, atlas, x, y, clip, 0, colour & 255);
	}

	blitIndexedSprite(rect, atlas, x, y, clip, colourOffset, solid) {
		if (!rect || !atlas) return;
		const { indices } = this;
		const w = rect.w ?? rect.width, h = rect.h ?? rect.height;
		const dx0 = (x + (rect.x || 0)) | 0;
		const dy0 = (y + (rect.y || 0)) | 0;
		const clipX0 = clip ? Math.max(0, clip.x0 | 0) : 0;
		const clipY0 = clip ? Math.max(0, clip.y0 | 0) : 0;
		const clipX1 = clip ? Math.min(SCREEN_W, clip.x1 | 0) : SCREEN_W;
		const clipY1 = clip ? Math.min(SCREEN_H, clip.y1 | 0) : SCREEN_H;
		const paint = solid >= 0 ? (solid & 255) : -1;
		for (let yy = 0; yy < h; yy++) {
			const dy = dy0 + yy;
			if (dy < clipY0 || dy >= clipY1) continue;
			let src = (rect.ay + yy) * atlas.width + rect.ax;
			let dst = dy * SCREEN_W + dx0;
			for (let xx = 0; xx < w; xx++, src++, dst++) {
				const dx = dx0 + xx;
				if (dx < clipX0 || dx >= clipX1) continue;
				const v = atlas.data[src];
				if (!v) continue;
				indices[dst] = paint >= 0 ? paint : (((v - 1) + colourOffset) & 255);
			}
		}
	}

	measureText(font, text) {
		if (!font) return 0;
		let w = 0;
		for (const ch of String(text)) {
			const code = ch.charCodeAt(0);
			const i = code - font.startChar;
			w += i >= 0 && i < font.widths.length
				? (font.widths[i] || font.cellWidth)
				: (font.widths[31] || font.cellWidth);
		}
		return w;
	}

	/** Fill one full screen row with a palette index -- one copper raster. */
	fillRow(y, colour) {
		if (y < 0 || y >= SCREEN_H) return;
		this.indices.fill(colour & 255, y * SCREEN_W, (y + 1) * SCREEN_W);
	}

	drawText(font, text, x, y, colour, opts = {}) {
		if (!font || !font.atlasData) return;
		const { indices } = this;
		const atlas = font.atlasData;
		const clip = opts.clip || null;
		const clipX0 = clip ? Math.max(0, clip.x0 | 0) : 0;
		const clipY0 = clip ? Math.max(0, clip.y0 | 0) : 0;
		const clipX1 = clip ? Math.min(SCREEN_W, clip.x1 | 0) : SCREEN_W;
		const clipY1 = clip ? Math.min(SCREEN_H, clip.y1 | 0) : SCREEN_H;
		const maxX = opts.maxWidth ? Math.min(x + opts.maxWidth, clipX1) : clipX1;
		const startX = x | 0;
		let cx = startX;
		let cy = y | 0;
		const lineHeight = opts.lineHeight || font.cellHeight + 1;
		const drawGlyph = (glyph, gx, gy) => {
			const col = glyph % font.columns;
			const row = Math.floor(glyph / font.columns);
			const ax = col * font.cellWidth;
			const ay = row * font.cellHeight;
			const width = font.widths[glyph] || font.cellWidth;
			for (let yy = 0; yy < font.cellHeight; yy++) {
				const dy = gy + yy;
				if (dy < clipY0 || dy >= clipY1) continue;
				let src = (ay + yy) * atlas.width + ax;
				let dst = dy * SCREEN_W + gx;
				for (let xx = 0; xx < width; xx++, src++, dst++) {
					const dx = gx + xx;
					if (dx < clipX0 || dx >= maxX) continue;
					if (atlas.data[src]) indices[dst] = colour & 255;
				}
			}
		};

		for (const ch of String(text)) {
			if (ch === '\n') {
				cx = startX;
				cy += lineHeight;
				continue;
			}
			const code = ch.charCodeAt(0);
			const fallback = '?'.charCodeAt(0) - font.startChar;
			const glyph = code >= font.startChar && code < font.startChar + font.count
				? code - font.startChar
				: fallback;
			const width = font.widths[glyph] || font.cellWidth;
			if (cx + width > maxX) break;
			drawGlyph(glyph, cx, cy);
			cx += width;
		}
	}

	/** skyline_window: two solid bands, the upper one carrying the copper gradient. */
	fillBackground(originX, originY, viewX, viewY, gradient) {
		const { indices } = this;
		const x0 = originX + viewX, x1 = x0 + VIEW_W;
		for (let vy = 0; vy < VIEW_H; vy++) {
			const paneY = viewY + vy;
			const upper = paneY < SKY_BAND_HEIGHT;
			let c = upper ? SKY_UPPER_INDEX : SKY_LOWER_INDEX;
			if (gradient && upper && vy < SKY_GRADIENT_ROWS) c = skyRowIndex(vy);
			const row = (originY + paneY) * SCREEN_W;
			indices.fill(c, row + x0, row + x1);
		}
	}

	/** Solid horizontal runs (horizon strips, planet), optionally per-row tinted. */
	drawSpans(runs, colour, originX, originY, viewX, viewY, gradientBase) {
		const { indices } = this;
		const ox = originX + viewX, oy = originY + viewY;
		for (const r of runs) {
			if (r.y < 0 || r.y >= VIEW_H) continue;
			const c = gradientBase ? gradientBase + r.row : colour;
			const base = (oy + r.y) * SCREEN_W + ox;
			indices.fill(c, base + r.x, base + Math.min(r.x + r.w, VIEW_W));
		}
	}

	/**
	 * Paint a draw list, clipped to the pane's 3D window.
	 * `overlays` carries the miscgfx atlases keyed light / water / explosions /
	 * foam; light/water/foam are one-bit decals, while CD32 explosions are
	 * masked indexed sprites.
	 */
	drawView(list, atlas, originX, originY, viewX, viewY, overlays, panels) {
		const { indices } = this;
		const clipX0 = originX + viewX, clipY0 = originY + viewY;
		const clipX1 = clipX0 + VIEW_W, clipY1 = clipY0 + VIEW_H;
		const ov = overlays || {};

		for (let i = 0; i < list.length; i++) {
			const s = list[i];
			if (s.light) { this.applyDecal(s, ov.light, DECAL_LIGHT, clipX0, clipY0, clipX1, clipY1); continue; }
			if (s.waterDecal) { this.applyDecal(s, ov.water, DECAL_WATER, clipX0, clipY0, clipX1, clipY1); continue; }
			if (s.explSprite) {
				this.drawIndexedSpriteClipped(s, ov.explosions,
					clipX0, clipY0, { x0: clipX0, y0: clipY0, x1: clipX1, y1: clipY1 });
				continue;
			}
			if (s.explDecal) { this.applyDecal(s, ov.explosions, DECAL_EXPLOSION, clipX0, clipY0, clipX1, clipY1); continue; }
			if (s.foamDecal) { this.applyDecal(s, ov.foam, DECAL_FOAM, clipX0, clipY0, clipX1, clipY1); continue; }
			if (s.planeOp) { this.applyPlaneOp(s, atlas, clipX0, clipY0, clipX1, clipY1); continue; }
			if (s.panel !== undefined) { this.applyPanel(s, panels, clipX0, clipY0); continue; }
			if (s.exgfx) {
				this.drawExgfx(s, ov.exgfx, clipX0, clipY0, clipX1, clipY1);
				continue;
			}
			if (s.player !== undefined) {
				this.drawPlayerFigure(s, ov.players, clipX0, clipY0, clipX1, clipY1);
				continue;
			}
			if (s.skeleton) {
				this.drawSkeleton(s, ov.skeleton, clipX0, clipY0, clipX1, clipY1);
				continue;
			}
			const dx0 = clipX0 + s.x, dy0 = clipY0 + s.y;
			// A split door half carries its own vertical clip, so the two halves
			// stay inside the closed door's extent as they slide apart.
			const lo = s.clipY0 !== undefined ? Math.max(clipY0, clipY0 + s.clipY0) : clipY0;
			const hi = s.clipY1 !== undefined ? Math.min(clipY1, clipY0 + s.clipY1) : clipY1;
			for (let yy = 0; yy < s.h; yy++) {
				const dy = dy0 + yy;
				if (dy < lo || dy >= hi) continue;
				let src = (s.ay + yy) * atlas.width + s.ax;
				let dst = dy * SCREEN_W + dx0;
				const bank = s.lit ? LIGHT_OFFSET : 0;
				// draw_bob's .solid path: every masked pixel takes one colour
				// instead of the bob's own, which is how a hit monster flashes.
				const paint = s.solid ? (s.solid + bank) & 255 : -1;
				for (let xx = 0; xx < s.w; xx++, src++, dst++) {
					const dx = dx0 + xx;
					if (dx < clipX0 || dx >= clipX1) continue;
					const v = atlas.data[src];
					if (v) indices[dst] = paint >= 0 ? paint : (v - 1) + bank;  // atlas stores index+1
				}
			}
		}
	}

	drawPlayerFigure(s, players, clipX0, clipY0, clipX1, clipY1) {
		if (!players) return;
		const block = s.player | 0;
		const playerIndex = block >> 2;
		const part = PLAYER_PARTS[block & 3];
		const character = players.selected?.[playerIndex] ?? playerIndex;
		const record = players.characters?.find((c) => c.character === character) ||
			players.characters?.[playerIndex];
		const rect = record?.figures?.[part]?.slots?.[s.slot | 0];
		if (!rect) return;
		const clip = { x0: clipX0, y0: clipY0, x1: clipX1, y1: clipY1 };
		const bank = s.lit ? LIGHT_OFFSET : 0;
		if (s.solid) {
			this.drawMaskedSolid(rect, players, clipX0, clipY0, (s.solid + bank) & 255, clip);
			return;
		}
		this.drawIndexedSpriteClipped(rect, players, clipX0, clipY0, clip, bank);
	}

	drawExgfx(s, exgfxAtlas, clipX0, clipY0, clipX1, clipY1) {
		if (!exgfxAtlas) return;
		// The dy is the grenade lift, already scaled for this depth in view.js.
		// Nothing else sets it, and the original sets nothing at all -- see the
		// note beside grenadeLift.
		this.drawIndexedSpriteClipped(s, exgfxAtlas,
			clipX0, clipY0 + (s.dy || 0),
			{ x0: clipX0, y0: clipY0, x1: clipX1, y1: clipY1 },
			s.lit ? LIGHT_OFFSET : 0);
	}

	drawSkeleton(s, skeleton, clipX0, clipY0, clipX1, clipY1) {
		if (!skeleton) return;
		const rect = skeleton.slots?.[s.slot | 0];
		if (!rect) return;
		this.drawIndexedSpriteClipped(rect, skeleton,
			clipX0, clipY0,
			{ x0: clipX0, y0: clipY0, x1: clipX1, y1: clipY1 },
			s.lit ? LIGHT_OFFSET : 0);
	}

	/**
	 * A style graphic that copies no colour plane (Puddle, Field): its atlas
	 * entry is coverage, and each covered pixel becomes (v & keep) | set. The
	 * puddle's keep is planes 0-3, so the floor's own colour survives and only
	 * its bank moves -- that is why it reads as tinted glass over the ground.
	 */
	applyPlaneOp(s, atlas, clipX0, clipY0, clipX1, clipY1) {
		const { indices } = this;
		const dx0 = clipX0 + s.x, dy0 = clipY0 + s.y;
		for (let yy = 0; yy < s.h; yy++) {
			const dy = dy0 + yy;
			if (dy < clipY0 || dy >= clipY1) continue;
			const fieldBand = s.field
				? Math.max(0, Math.min(FIELD_COLOUR_ROWS - 1, Math.floor((dy - clipY0) / 4)))
				: 0;
			let src = (s.ay + yy) * atlas.width + s.ax;
			let dst = dy * SCREEN_W + dx0;
			for (let xx = 0; xx < s.w; xx++, src++, dst++) {
				const dx = dx0 + xx;
				if (dx < clipX0 || dx >= clipX1) continue;
				if (!atlas.data[src]) continue;
				if (s.field) {
					indices[dst] = FIELD_COLOUR_BASE + fieldBand;
					continue;
				}
				const v = indices[dst];
				if (v >= HW_INDEX_COUNT) continue;
				indices[dst] = (v & s.keep) | s.set;
			}
		}
	}

	/** OR a text panel's 2-bit image into planes 0-1, as the original does. */
	applyPanel(s, panels, clipX0, clipY0) {
		if (!panels) return;
		const { indices } = this;
		const size = s.w * s.h;
		const base = s.panel * size;
		for (let y = 0; y < s.h; y++) {
			const dy = clipY0 + s.y + y;
			let dst = dy * SCREEN_W + clipX0 + s.x;
			let src = base + y * s.w;
			for (let x = 0; x < s.w; x++, src++, dst++) {
				const v = panels[src];
				if (v) indices[dst] |= v;
			}
		}
	}

	/**
	 * Apply one miscgfx mask rect, in draw order. These never write colour: the
	 * bob carries no image planes, only per-plane set/clear ops, so a covered
	 * pixel is rewritten in place.
	 *
	 *   light      plane 5 set        -> +32, into the lit bank
	 *   water      plane 4 set        -> +16; plus plane 5 when the cell is lit
	 *   explosion  planes 0-4 set/clear, plane 5 untouched -> colour 9 in place
	 *
	 * Colour 0 is a real colour and must be included: it is the dominant unlit
	 * index and the whole lower sky band, so lighting it is how a wall face
	 * becomes visible at all, and watering it is what produces the blue-grey
	 * haze (index 48) that fills the distance across open water. An earlier gate
	 * of 1-15 dropped both. The only thing a decal cannot touch is a synthetic
	 * gradient row, which stands in for a copper rewrite and has no bitplanes.
	 */
	applyDecal(s, maskAtlas, kind, clipX0, clipY0, clipX1, clipY1) {
		if (!maskAtlas) return;
		const { indices } = this;
		const dx0 = clipX0 + s.x, dy0 = clipY0 + s.y;
		for (let yy = 0; yy < s.h; yy++) {
			const dy = dy0 + yy;
			if (dy < clipY0 || dy >= clipY1) continue;
			let src = (s.ay + yy) * maskAtlas.width + s.ax;
			let dst = dy * SCREEN_W + dx0;
			for (let xx = 0; xx < s.w; xx++, src++, dst++) {
				const dx = dx0 + xx;
				if (dx < clipX0 || dx >= clipX1) continue;
				if (!maskAtlas.data[src]) continue;
				const v = indices[dst];
				if (kind === DECAL_EXPLOSION) {
					indices[dst] = (v & LIGHT_OFFSET) | EXPLOSION_COLOUR;
					continue;
				}
				if (kind === DECAL_FOAM) {
					// Planes 4 and 5 are nodraw, so both banks survive underneath.
					indices[dst] = (v & (LIGHT_OFFSET | WATER_OFFSET)) | FOAM_COLOUR;
					continue;
				}
				if (v >= HW_INDEX_COUNT) continue;
				if (kind === DECAL_LIGHT) {
					indices[dst] = v | LIGHT_OFFSET;
				} else {
					// Water sets plane 4; .draw_bob_illuminate additionally sets
					// plane 5, so a lit surface lands in 48-63 whatever it was.
					indices[dst] = s.lit
						? ((v & 15) | LIGHT_OFFSET | WATER_OFFSET)
						: (v | WATER_OFFSET);
				}
			}
		}
	}

}
