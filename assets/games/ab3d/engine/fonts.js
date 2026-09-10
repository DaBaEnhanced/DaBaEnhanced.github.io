function decodeRGB12(high, low) {
  const value = high << 8 | low;
  return [((value >> 8) & 15) * 17, ((value >> 4) & 15) * 17, (value & 15) * 17, 255];
}

export class FontTextures {
  constructor(manifest, data, menuRasterColours = null) {
    this.manifest = manifest;
    this.data = data;
    this.menuRasterColours = menuRasterColours;
  }

  static async load(baseUrl = 'assets/fonts') {
    const response = await fetch(`${baseUrl}/index.json?v=source-fidelity-2`);
    if (!response.ok) throw new Error(`font manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.format !== 'alien-breed-3d-fonts-v1') {
      throw new Error(`unsupported font manifest ${manifest.format}`);
    }
    const entries = Object.entries(manifest.fonts);
    const payloads = await Promise.all(entries.map(async ([name, font]) => {
      const requests = [fetch(`${baseUrl}/${font.file}`)];
      if (font.widthsFile) requests.push(fetch(`${baseUrl}/${font.widthsFile}`));
      const responses = await Promise.all(requests);
      for (const item of responses) {
        if (!item.ok) throw new Error(`${name} font request failed: HTTP ${item.status}`);
      }
      const buffers = await Promise.all(responses.map(item => item.arrayBuffer()));
      return [name, {
        pixels: new Uint8Array(buffers[0]),
        widths: buffers[1] ? new Uint8Array(buffers[1]) : null,
      }];
    }));
    let menuRasterColours = null;
    if (manifest.menuRasterColours) {
      const colours = await fetch(`${baseUrl}/${manifest.menuRasterColours.file}`);
      if (!colours.ok) throw new Error(`menu raster colours request failed: HTTP ${colours.status}`);
      menuRasterColours = new Uint8Array(await colours.arrayBuffer());
      if (menuRasterColours.length !== manifest.menuRasterColours.count * 2) {
        throw new Error('menu raster colours have the wrong length');
      }
    }
    return new FontTextures(manifest, new Map(payloads), menuRasterColours);
  }

  glyph(name, code) {
    const font = this.manifest.fonts[name];
    const payload = this.data.get(name);
    if (!font || !payload || code < font.firstCode ||
        code >= font.firstCode + font.glyphCount) return null;
    const glyph = code - font.firstCode;
    return {
      font, payload, glyph,
      left: (glyph % font.columns) * font.glyphWidth,
      top: Math.floor(glyph / font.columns) * font.glyphHeight,
      advance: payload.widths?.[glyph] ?? font.glyphWidth,
    };
  }

  sample(name, code, x, y) {
    const glyph = this.glyph(name, code);
    if (!glyph || x < 0 || y < 0 || x >= glyph.font.glyphWidth || y >= glyph.font.glyphHeight) {
      return null;
    }
    const pixel = (glyph.top + y) * glyph.font.width + glyph.left + x;
    if (glyph.font.format === 'u8-alpha') {
      return glyph.payload.pixels[pixel] ? [255, 255, 255, 255] : null;
    }
    const at = pixel * 2;
    if (!(glyph.payload.pixels[at] | glyph.payload.pixels[at + 1])) return null;
    return decodeRGB12(glyph.payload.pixels[at], glyph.payload.pixels[at + 1]);
  }

  menuColour(y) {
    if (!this.menuRasterColours) return [255, 255, 255, 255];
    const row = Math.max(0, Math.min(255, Math.trunc(y)));
    return decodeRGB12(this.menuRasterColours[row * 2], this.menuRasterColours[row * 2 + 1]);
  }
}
