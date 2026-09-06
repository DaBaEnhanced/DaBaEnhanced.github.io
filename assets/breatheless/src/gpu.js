// WebGPU present pass.
//
// The renderer hands us an 8-bit palette-index buffer, exactly what the Amiga
// wrote to its chunky buffer before c2p.  This pass is the c2p's replacement:
// upload the indices as an r8uint texture, look each one up in the palette, and
// point-sample it to the canvas.  Colour never leaves index space until here,
// which is what keeps the lighting tables exact.

const SHADER = `
struct Cfg { src : vec2u, dst : vec2u };
@group(0) @binding(0) var indexTex : texture_2d<u32>;
@group(0) @binding(1) var palTex   : texture_2d<f32>;
@group(0) @binding(2) var<uniform> cfg : Cfg;

@vertex
fn vs(@builtin(vertex_index) i : u32) -> @builtin(position) vec4f {
  // one oversized triangle covering the viewport
  var p = array(vec2f(-1.0, -3.0), vec2f(-1.0, 1.0), vec2f(3.0, 1.0));
  return vec4f(p[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) pos : vec4f) -> @location(0) vec4f {
  let d = vec2u(pos.xy);
  // integer nearest-neighbour scale: no filtering, no half-pixel drift
  let s = vec2u(d.x * cfg.src.x / cfg.dst.x, d.y * cfg.src.y / cfg.dst.y);
  let idx = textureLoad(indexTex, vec2i(s), 0).r;
  return textureLoad(palTex, vec2i(i32(idx), 0), 0);
}`;

/**
 * Build the best present pass this browser will give us.
 *
 * WebGPU is preferred and does the palette lookup on the GPU, but it is not
 * something to insist on. `navigator.gpu` existing does not mean an adapter
 * will be handed over: hardware acceleration can be off, the driver can be
 * blocklisted, and a machine on remote desktop or in a VM frequently has no
 * usable GPU at all. That is a property of the visitor's machine, not of how
 * the page is served, so failing there would fail for those visitors wherever
 * the game is hosted.
 *
 * So: ask three ways, and if all three come back empty, fall back to a 2D
 * canvas that does the same lookup in JavaScript. The game renders into an
 * 8-bit index buffer either way -- only the last step differs.
 */
export async function createPresenter(canvas, width, height, paletteRGBA) {
  const adapter = await requestAnyAdapter();
  if (adapter) {
    try {
      return await Presenter.create(canvas, width, height, paletteRGBA, adapter);
    } catch (e) {
      console.warn('WebGPU adapter found but unusable, falling back to 2D:', e);
    }
  }
  return new CanvasPresenter(canvas, width, height, paletteRGBA);
}

/** Chrome ships a software adapter; ask for it before giving up. */
async function requestAnyAdapter() {
  if (!navigator.gpu) return null;
  const tries = [
    undefined,
    { powerPreference: 'low-power' },
    { forceFallbackAdapter: true },        // SwiftShader, on Chrome
  ];
  for (const opts of tries) {
    try {
      const a = await navigator.gpu.requestAdapter(opts);
      if (a) return a;
    } catch { /* try the next one */ }
  }
  return null;
}

export class Presenter {
  static async create(canvas, width, height, paletteRGBA, adapter = null) {
    if (!navigator.gpu) throw new Error('WebGPU is not available in this browser.');
    adapter = adapter ?? await requestAnyAdapter();
    if (!adapter) throw new Error('No WebGPU adapter.');
    const device = await adapter.requestDevice();
    const ctx = canvas.getContext('webgpu');
    if (!ctx) throw new Error('canvas.getContext("webgpu") returned null.');
    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });
    return new Presenter(device, ctx, format, canvas, width, height, paletteRGBA);
  }

  get backend() { return 'webgpu'; }

  constructor(device, ctx, format, canvas, w, h, paletteRGBA) {
    this.device = device; this.ctx = ctx; this.canvas = canvas;
    this.w = w; this.h = h;

    this.indexTex = device.createTexture({
      size: [w, h], format: 'r8uint',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.palTex = device.createTexture({
      size: [256, 1], format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.setPalette(paletteRGBA);

    this.cfg = device.createBuffer({
      size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const module = device.createShaderModule({ code: SHADER });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    this.bind = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.indexTex.createView() },
        { binding: 1, resource: this.palTex.createView() },
        { binding: 2, resource: { buffer: this.cfg } },
      ],
    });
  }

  /** The index texture is sized to the frame, so a render-scale change needs
   *  a new one and a new bind group pointing at it. */
  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.indexTex.destroy?.();
    this.indexTex = this.device.createTexture({
      size: [w, h], format: 'r8uint',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.bind = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.indexTex.createView() },
        { binding: 1, resource: this.palTex.createView() },
        { binding: 2, resource: { buffer: this.cfg } },
      ],
    });
  }

  setPalette(rgba) {
    this.device.queue.writeTexture({ texture: this.palTex }, rgba,
      { bytesPerRow: 256 * 4 }, [256, 1]);
  }

  present(indices) {
    const { device, canvas } = this;
    // r8uint rows must be a multiple of 256 bytes; pad if the width is not.
    const pad = (this.w + 255) & ~255;
    let data = indices, bpr = this.w;
    if (pad !== this.w) {
      data = new Uint8Array(pad * this.h);
      for (let y = 0; y < this.h; y++) data.set(indices.subarray(y * this.w, (y + 1) * this.w), y * pad);
      bpr = pad;
    }
    device.queue.writeTexture({ texture: this.indexTex }, data,
      { bytesPerRow: bpr, rowsPerImage: this.h }, [this.w, this.h]);

    device.queue.writeBuffer(this.cfg, 0,
      new Uint32Array([this.w, this.h, canvas.width, canvas.height]));

    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: this.ctx.getCurrentTexture().createView(),
        loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bind);
    pass.draw(3);
    pass.end();
    device.queue.submit([enc.finish()]);
  }
}


/**
 * The same present pass on a 2D canvas, for machines with no usable GPU.
 *
 * It is the identical operation -- index in, palette colour out, nearest
 * neighbour to the canvas -- just done by the CPU. 64,000 lookups a frame into
 * a 256-entry table is nothing; the palette is pre-expanded to packed 32-bit
 * pixels once per change so the inner loop is a single array read and write.
 *
 * Scaling is left to drawImage with smoothing off, which is the browser's
 * nearest-neighbour path, so pixels stay square and sharp exactly as the
 * WebGPU shader keeps them.
 */
export class CanvasPresenter {
  constructor(canvas, w, h, paletteRGBA) {
    this.canvas = canvas;
    this.w = w; this.h = h;
    this.ctx = canvas.getContext('2d', { alpha: false });
    if (!this.ctx) throw new Error('neither WebGPU nor a 2D canvas is available.');
    // An offscreen buffer at the game's own resolution; the visible canvas is
    // whatever size the page made it, and drawImage bridges the two.
    this.off = document.createElement('canvas');
    this.off.width = w; this.off.height = h;
    this.offCtx = this.off.getContext('2d', { alpha: false });
    this.image = this.offCtx.createImageData(w, h);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.palette = new Uint32Array(256);
    this.setPalette(paletteRGBA);
  }

  get backend() { return 'canvas2d'; }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.off.width = w; this.off.height = h;
    this.image = this.offCtx.createImageData(w, h);
    this.pixels = new Uint32Array(this.image.data.buffer);
  }

  setPalette(rgba) {
    // Pack to the platform's byte order once, rather than per pixel per frame.
    const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    for (let i = 0; i < 256; i++) {
      const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
      this.palette[i] = little
        ? (255 << 24) | (b << 16) | (g << 8) | r
        : (r << 24) | (g << 16) | (b << 8) | 255;
    }
  }

  present(indices) {
    const px = this.pixels, pal = this.palette;
    for (let i = 0, n = this.w * this.h; i < n; i++) px[i] = pal[indices[i]];
    this.offCtx.putImageData(this.image, 0, 0);
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.off, 0, 0, this.canvas.width, this.canvas.height);
  }
}
