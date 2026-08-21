// Canvas2D renderer: composites through the shared index compositor, then
// expands the palette on the CPU and blits with nearest-neighbour scaling.

import { SCREEN_W, SCREEN_H } from './view.js';
import { IndexCompositor } from './compositor.js';

export class Renderer2D extends IndexCompositor {
	constructor(canvas) {
		super();
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false });
		this.ctx.imageSmoothingEnabled = false;
		this.image = this.ctx.createImageData(SCREEN_W, SCREEN_H);
	}

	setAtlas(atlas) { this.atlas = atlas; }
	setOverlays(overlays) { this.overlays = overlays; }
	setPalette(palette) { this.palette = palette; }

	present() {
		const { indices, palette, image } = this;
		const data = image.data;
		for (let i = 0, o = 0; i < indices.length; i++, o += 4) {
			const c = palette[indices[i]] || [0, 0, 0];
			data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
		}
		if (!this.scratch) {
			this.scratch = document.createElement('canvas');
			this.scratch.width = SCREEN_W;
			this.scratch.height = SCREEN_H;
			this.scratchCtx = this.scratch.getContext('2d');
		}
		this.scratchCtx.putImageData(image, 0, 0);
		this.ctx.imageSmoothingEnabled = false;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.drawImage(this.scratch, 0, 0, this.canvas.width, this.canvas.height);
	}

	get name() { return 'Canvas2D'; }
}
