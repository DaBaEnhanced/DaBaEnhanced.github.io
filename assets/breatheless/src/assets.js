// Loads the extracted Breathless assets (see tools/extract.py).

import { fetchJSON, fetchBytes } from './fetch.js';

export async function loadAssets(base = 'assets') {
  const j = (p) => fetchJSON(`${base}/${p}`);
  const b = (p) => fetchBytes(`${base}/${p}`);

  const manifest = await j('manifest.json');
  const [palettes, lighting, textures, sprites] = await Promise.all([
    b('palettes.bin'), b('lighting.bin'), b('textures.bin'), b('sprites.bin'),
  ]);

  // Texture entries indexed by name and by the 0-based order they appear in the TGLD.
  const texByName = manifest.textures.entries;

  // The HD set, if `tools/hd/upscale.py` has been run. Optional by design: the
  // game is complete without it, so a missing hd/ directory is not an error.
  //
  // It is a straight swap rather than a second code path. HD textures are still
  // palette indices -- the whole renderer works in index space and the lighting
  // tables are index remaps -- so the only thing that differs is that there are
  // four texels per world unit instead of one, which every sample site reads
  // from `scale`.
  //
  // Fetched ON DEMAND, never at startup. The HD art is 10.8 MB gzipped against
  // 1.1 MB for the original set, so loading it eagerly would make everyone who
  // leaves HD off pay ten times over for art they never see.
  let hdPromise = null;
  const loadHD = () => (hdPromise ??= (async () => {
    const meta = await j('hd/hd.json');
    const [htex, hspr] = await Promise.all([b('hd/textures.bin'),
                                            b('hd/sprites.bin')]);
    // Textures and sprites carry their own scale: a 4x texture set costs
    // 4.1 MB gzipped and covers most of the screen, while a 4x sprite set is
    // 184 MB, so they are priced separately and need not match.
    for (const t of Object.values(meta.textures)) t.scale = t.scale ?? meta.scale;
    for (const o of Object.values(meta.objects)) {
      for (const f of o.frames) f.scale = f.scale ?? o.scale ?? meta.spriteScale ?? 1;
    }
    return { meta, textures: htex, sprites: hspr };
  })().catch(() => null));   // no HD assets built; the 1x set is complete

  const assets = {
    base, manifest, palettes, lighting, texByName,
    textures, sprites, hd: null, hdOn: false,
    baseTextures: textures, baseSprites: sprites, baseTexByName: texByName,
    loadLevel: (id) => j(`levels/${id}.json`),

    /**
     * Point the renderer at the HD or the original art. Object frame lists are
     * swapped in place because `level.objs` holds references to the manifest's
     * own entries, so replacing the array would leave live objects behind.
     *
     * Async on the way in, because turning HD on is what triggers the download;
     * turning it off is immediate. Resolves to what the art is actually set to,
     * which is `false` if the HD set could not be fetched -- a build without
     * hd/ and a visitor who lost their connection look the same from here, and
     * both should leave the game playable rather than half-swapped.
     */
    async setHD(on) {
      if (on && !this.hd) this.hd = await loadHD();
      const want = !!(on && this.hd);
      if (want === this.hdOn) return this.hdOn;
      this.hdOn = want;
      this.textures = want ? this.hd.textures : this.baseTextures;
      this.sprites = want ? this.hd.sprites : this.baseSprites;
      this.texByName = want ? this.hd.meta.textures : this.baseTexByName;
      for (const [name, def] of Object.entries(this.manifest.objects.entries)) {
        if (!def.baseFrames) def.baseFrames = def.frames;
        const hf = this.hd?.meta.objects[name]?.frames;
        def.frames = want && hf ? hf : def.baseFrames;
      }
      return this.hdOn;
    },
  };
  return assets;
}

/** Palette `n` as RGBA bytes, for upload as a 256x1 texture. */
export function paletteRGBA(assets, n = 0) {
  const src = assets.palettes.subarray(n * 768, n * 768 + 768);
  const out = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    out[i * 4] = src[i * 3];
    out[i * 4 + 1] = src[i * 3 + 1];
    out[i * 4 + 2] = src[i * 3 + 2];
    out[i * 4 + 3] = 255;
  }
  return out;
}
