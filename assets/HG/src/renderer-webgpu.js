// WebGPU renderer.
//
// Composites through the same IndexCompositor as the Canvas2D path, then hands
// the 320x212 palette-index buffer to the GPU: a fragment shader does the
// palette lookup and the integer upscale.
//
// It was previously an instanced-quad pipeline writing straight to RGBA. That
// could not express CD32 lighting at all, because lighting is an index offset
// (a covered pixel moves from the unlit bank into the lit one) and an index has
// no meaning once the pixel is already colour. Keeping the composite indexed
// until the very last step is also what the hardware did, and it means the two
// renderers agree by construction rather than by discipline.
//
// The palette stays on the GPU as a 256-entry lookup, so the Amiga's palette
// tricks -- the per-line sky gradient, fades, fire flash -- remain a matter of
// swapping the LUT.

import { SCREEN_W, SCREEN_H } from './view.js';
import { IndexCompositor } from './compositor.js';

const SHADER = /* wgsl */`
@group(0) @binding(0) var indices : texture_2d<u32>;
@group(0) @binding(1) var<uniform> palette : array<vec4<f32>, 256>;

struct VSOut {
	@builtin(position) pos : vec4<f32>,
	@location(0) uv : vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> VSOut {
	var p = array<vec2<f32>, 6>(
		vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
		vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0),
	);
	var o : VSOut;
	o.pos = vec4<f32>(p[vi], 0.0, 1.0);
	// y flipped: the index buffer is top-down.
	o.uv = vec2<f32>((p[vi].x + 1.0) * 0.5, (1.0 - p[vi].y) * 0.5);
	return o;
}

@fragment
fn fs(in : VSOut) -> @location(0) vec4<f32> {
	// Nearest sampling by construction: index straight into the texel grid.
	let texel = vec2<i32>(
		i32(in.uv.x * f32(${SCREEN_W})),
		i32(in.uv.y * f32(${SCREEN_H})),
	);
	let idx = textureLoad(indices, texel, 0).r;
	return palette[idx];
}
`;

export class RendererWebGPU extends IndexCompositor {
	constructor(canvas) {
		super();
		this.canvas = canvas;
	}

	static async isSupported() { return !!navigator.gpu; }

	async init() {
		if (!navigator.gpu) throw new Error('WebGPU not available');
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error('no WebGPU adapter');
		this.device = await adapter.requestDevice();
		this.context = this.canvas.getContext('webgpu');
		this.format = navigator.gpu.getPreferredCanvasFormat();
		this.context.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });

		const module = this.device.createShaderModule({ code: SHADER });
		this.pipeline = this.device.createRenderPipeline({
			layout: 'auto',
			vertex: { module, entryPoint: 'vs' },
			fragment: { module, entryPoint: 'fs', targets: [{ format: this.format }] },
			primitive: { topology: 'triangle-list' },
		});

		this.indexTexture = this.device.createTexture({
			size: [SCREEN_W, SCREEN_H],
			format: 'r8uint',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
		});
		this.paletteBuffer = this.device.createBuffer({
			size: 256 * 16,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.bindGroup = this.device.createBindGroup({
			layout: this.pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: this.indexTexture.createView() },
				{ binding: 1, resource: { buffer: this.paletteBuffer } },
			],
		});
	}

	setAtlas(atlas) { this.atlas = atlas; }
	setOverlays(overlays) { this.overlays = overlays; }

	setPalette(palette) {
		const data = new Float32Array(256 * 4);
		for (let i = 0; i < 256; i++) {
			const c = palette[i] || [0, 0, 0];
			data[i * 4] = c[0] / 255; data[i * 4 + 1] = c[1] / 255;
			data[i * 4 + 2] = c[2] / 255; data[i * 4 + 3] = 1;
		}
		this.device.queue.writeBuffer(this.paletteBuffer, 0, data);
	}

	present() {
		const w = this.canvas.width | 0, h = this.canvas.height | 0;
		if (w && h && (w !== this._cfgW || h !== this._cfgH)) {
			this.context.configure({
				device: this.device, format: this.format, alphaMode: 'opaque',
			});
			this._cfgW = w;
			this._cfgH = h;
		}
		this.device.queue.writeTexture(
			{ texture: this.indexTexture },
			this.indices,
			{ bytesPerRow: SCREEN_W, rowsPerImage: SCREEN_H },
			[SCREEN_W, SCREEN_H],
		);

		const enc = this.device.createCommandEncoder();
		const pass = enc.beginRenderPass({
			colorAttachments: [{
				view: this.context.getCurrentTexture().createView(),
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				loadOp: 'clear', storeOp: 'store',
			}],
		});
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bindGroup);
		pass.draw(6);
		pass.end();
		this.device.queue.submit([enc.finish()]);
	}

	get name() { return 'WebGPU'; }
}
