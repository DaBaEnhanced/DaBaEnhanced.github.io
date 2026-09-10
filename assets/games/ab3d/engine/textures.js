const LOOKUP_BYTES = 32 * 32 * 2;
// NEWTWO.s:waterlist lines 6847-6855. Keep the recovered eight-frame byte
// offsets immutable and shared: constructing this literal in sampleWater made
// every Sharp water pixel allocate an otherwise identical temporary array.
const WATER_FRAME_OFFSETS = Object.freeze([0, 2, 256, 258, 512, 514, 768, 770]);

export function unpackTexel(word, selector) {
  if (selector === 0) return word & 31;
  if (selector === 1) return (word >>> 5) & 31;
  return (word >>> 10) & 31;
}

export function decodeRGB16Palette(buffer) {
  if (buffer.byteLength !== 256 * 3 * 2) throw new Error('invalid AB3D screen palette');
  const view = new DataView(buffer);
  const colours = [];
  for (let index = 0; index < 256; index++) {
    colours.push([
      Math.min(255, view.getUint16(index * 6)),
      Math.min(255, view.getUint16(index * 6 + 2)),
      Math.min(255, view.getUint16(index * 6 + 4)),
    ]);
  }
  return colours;
}

// Every renderer palette path ultimately produces one of the Amiga's 4,096
// RGB12 words. Cache those immutable triples once instead of allocating a new
// JavaScript array for every wall/plane/object pixel; this changes neither the
// recovered word nor its four-bit-to-eight-bit channel expansion.
const RGB12_COLOURS = Object.freeze(Array.from({ length: 0x1000 }, (_, word) =>
  Object.freeze([
    ((word >>> 8) & 15) * 17,
    ((word >>> 4) & 15) * 17,
    (word & 15) * 17,
  ])));

export function decodeRGB12(word) {
  return RGB12_COLOURS[word & 0x0fff];
}

export function objectLightRow(brightness) {
  if (brightness < 2) return 0;
  return Math.min(14, Math.floor((brightness + 2) / 4));
}

// wallroutine3.chipmem:SCALE is the 65-word table used after screendivide
// clamps the combined wall light to 0..64. Its sequence is
// 0,1,1,2,2,...,31,31 and the final values remain saturated at row 31.
export function wallLightRow(brightness) {
  return Math.max(0, Math.min(31, Math.floor((Math.trunc(brightness) + 1) / 2)));
}

export class ObjectTextures {
  constructor(manifest, atlases, palettes) {
    this.manifest = manifest;
    this.atlases = atlases;
    this.palettes = palettes;
    this.graphicTypes = new Map(manifest.graphicTypes.map(type => [type.id, type]));
  }

  static async load(root = 'assets/objects/') {
    const response = await fetch(`${root}index.json?v=source-fidelity-6`);
    if (!response.ok) throw new Error(`object manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.format !== 'alien-breed-3d-object-atlases-v1') {
      throw new Error('unknown object-atlas format');
    }
    const atlasEntries = Object.entries(manifest.atlases);
    const paletteEntries = Object.entries(manifest.palettes);
    const loaded = await Promise.all([
      ...atlasEntries.map(([, atlas]) => fetch(`${root}${atlas.file}`).then(checkedBuffer)),
      ...paletteEntries.map(([, palette]) => fetch(`${root}${palette.file}`).then(checkedBuffer)),
    ]);
    const atlases = new Map(atlasEntries.map(([name, atlas], index) => {
      const data = new Uint8Array(loaded[index]);
      const storageHeight = atlas.storageHeight || atlas.height;
      if (data.length !== atlas.width * storageHeight) throw new Error(`invalid object atlas ${name}`);
      return [name, { ...atlas, data }];
    }));
    const paletteBase = atlasEntries.length;
    const palettes = new Map(paletteEntries.map(([name, palette], index) => {
      const buffer = loaded[paletteBase + index];
      if (buffer.byteLength !== 15 * 32 * 2) throw new Error(`invalid object palette ${name}`);
      return [name, new DataView(buffer)];
    }));
    return new ObjectTextures(manifest, atlases, palettes);
  }

  sample(graphicType, frameIndex, x, y, brightness) {
    const type = this.graphicTypes.get(graphicType);
    if (!type) return null;
    const atlas = this.atlases.get(type.atlas);
    const palette = this.palettes.get(type.palette);
    const frame = type.frames[frameIndex];
    const storageHeight = atlas?.storageHeight || atlas?.height;
    if (!atlas || !palette || !frame || x < 0 || y < 0 ||
        frame.x + x >= atlas.width || frame.y + y >= storageHeight) return null;
    const texel = atlas.data[(frame.y + y) * atlas.width + frame.x + x];
    if (!texel) return null;
    const row = objectLightRow(brightness);
    return decodeRGB12(palette.getUint16((row * 32 + texel) * 2));
  }
}

export class PanelTexture {
  constructor(manifest, indices, palette, keyMasks, borders) {
    this.width = manifest.width;
    this.height = manifest.height;
    this.manifest = manifest;
    this.indices = indices;
    this.palette = palette;
    this.keyMasks = keyMasks;
    this.borders = borders;
    this.conditionCache = -1;
    this.borderCache = '';
    this.borderPixels = null;
    this.gaugeCache = '';
    this.gaugePixels = null;
    this.data = new Uint8Array(this.width * this.height * 4);
  }

  static async load(root = 'assets/panel/') {
    const response = await fetch(`${root}index.json?v=source-fidelity-4`);
    if (!response.ok) throw new Error(`panel manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.format !== 'alien-breed-3d-panel-v1') throw new Error('unknown panel format');
    const [indexBuffer, paletteBuffer, keyBuffer, leftBorder, rightBorder,
      borderPalette, borderScanlinePalette, healthStrip, ammoStrip] = await Promise.all([
      fetch(`${root}${manifest.indices}`).then(checkedBuffer),
      fetch(`${root}${manifest.palette}`).then(checkedBuffer),
      fetch(`${root}${manifest.keys.file}`).then(checkedBuffer),
      fetch(`${root}${manifest.borders.left}`).then(checkedBuffer),
      fetch(`${root}${manifest.borders.right}`).then(checkedBuffer),
      fetch(`${root}${manifest.borders.palette}`).then(checkedBuffer),
      fetch(`${root}${manifest.borders.scanlinePalette.file}`).then(checkedBuffer),
      fetch(`${root}${manifest.borders.health.file}`).then(checkedBuffer),
      fetch(`${root}${manifest.borders.ammo.file}`).then(checkedBuffer),
    ]);
    const indices = new Uint8Array(indexBuffer);
    const palette = new Uint8Array(paletteBuffer);
    const keyMasks = new Uint8Array(keyBuffer);
    if (indices.length !== manifest.width * manifest.height || palette.length !== 256 * 3 ||
        keyMasks.length !== manifest.keys.width * manifest.keys.height * manifest.keys.masks.length) {
      throw new Error('invalid panel assets');
    }
    const borders = {
      left: new Uint8Array(leftBorder), right: new Uint8Array(rightBorder),
      palette: new Uint8Array(borderPalette), health: new Uint8Array(healthStrip),
      scanlinePalette: new DataView(borderScanlinePalette), ammo: new Uint8Array(ammoStrip),
    };
    if (borders.left.length !== manifest.borders.spriteBytes * 2 ||
        borders.right.length !== manifest.borders.spriteBytes * 2 ||
        borders.palette.length !== 16 * 3 ||
        borders.scanlinePalette.byteLength !== manifest.borders.scanlinePalette.rows * 2 ||
        borders.health.length !== 128 * 4 || borders.ammo.length !== 64 * 8) {
      throw new Error('invalid border assets');
    }
    return new PanelTexture(manifest, indices, palette, keyMasks, borders);
  }

  render(conditions = 0) {
    const keyConditions = conditions & 15;
    if (keyConditions === this.conditionCache) return this.data;
    const composed = composePanelIndices(
      this.indices, this.width, this.height, this.keyMasks, this.manifest.keys, keyConditions);
    for (let index = 0; index < composed.length; index++) {
      const colour = composed[index] * 3;
      const target = index * 4;
      this.data[target] = this.palette[colour];
      this.data[target + 1] = this.palette[colour + 1];
      this.data[target + 2] = this.palette[colour + 2];
      this.data[target + 3] = 255;
    }
    this.conditionCache = keyConditions;
    return this.data;
  }

  renderBorders(energy = 127, ammunition = 0) {
    const health = Math.max(0, Math.min(127, Math.floor(energy)));
    const ammo = Math.max(0, Math.min(63, Math.floor(ammunition)));
    const cache = `${health}:${ammo}`;
    if (cache === this.borderCache) return this.borderPixels;
    const sprites = composeBorderSprites(
      this.borders.left, this.borders.right, this.borders.health, this.borders.ammo,
      this.manifest.borders, health, ammo);
    this.borderPixels = {
      width: this.manifest.borders.width,
      height: this.manifest.borders.height,
      y: this.manifest.borders.verticalStart - this.manifest.borders.displayStart,
      left: decodeAttachedSprites(sprites.left, this.manifest.borders, this.borders.palette,
        this.borders.scanlinePalette, 'left', this.palette),
      right: decodeAttachedSprites(sprites.right, this.manifest.borders, this.borders.palette,
        this.borders.scanlinePalette, 'right', this.palette),
    };
    this.borderCache = cache;
    return this.borderPixels;
  }

  renderGauges(energy = 127, ammunition = 0) {
    const health = Math.max(0, Math.min(127, Math.floor(energy)));
    const ammo = Math.max(0, Math.min(63, Math.floor(ammunition)));
    const cache = `${health}:${ammo}`;
    if (cache === this.gaugeCache) return this.gaugePixels;

    // Browser-only Enhanced presentation requested by the user. The gauge
    // pixels are not recreated artwork: composeBorderSprites above applies
    // the released health/ammo strip writes recovered from NEWTWO.s
    // putinsmallscr (lines 1989-2039). Comparing that decoded result with the
    // same source sprites at zero values removes only the static attached-
    // sprite artwork and retains exactly the source-derived dynamic strips.
    const loaded = this.renderBorders(health, ammo);
    const empty = this.renderBorders(0, 0);
    this.gaugePixels = {
      width: loaded.width,
      height: loaded.height,
      y: loaded.y,
      left: isolateGaugePixels(loaded.left, empty.left),
      right: isolateGaugePixels(loaded.right, empty.right),
    };
    this.gaugeCache = cache;
    return this.gaugePixels;
  }
}

export function isolateGaugePixels(loaded, empty) {
  if (loaded.length !== empty.length || loaded.length % 4) {
    throw new RangeError('decoded border images must have matching RGBA lengths');
  }
  const output = new Uint8Array(loaded.length);
  for (let at = 0; at < loaded.length; at += 4) {
    const changed = loaded[at] !== empty[at] || loaded[at + 1] !== empty[at + 1] ||
      loaded[at + 2] !== empty[at + 2] || loaded[at + 3] !== empty[at + 3];
    if (!changed || !loaded[at + 3]) continue;
    output.set(loaded.subarray(at, at + 4), at);
  }
  return output;
}

export function composePanelIndices(base, width, height, masks, overlay, conditions) {
  const output = new Uint8Array(base);
  const frameSize = overlay.width * overlay.height;
  for (let frame = 0; frame < overlay.masks.length; frame++) {
    if (!(conditions & overlay.masks[frame])) continue;
    const source = frame * frameSize;
    // Retail abd8ch's unique OffsetToGraph table uses the key bit-scan index
    // for four distinct destinations. The older extracted anims snapshot's
    // hardcoded +40*8*11+22 is only the yellow entry.
    const position = overlay.positions[frame];
    for (let y = 0; y < overlay.height; y++) {
      for (let x = 0; x < overlay.width; x++) {
        const targetX = position.x + x, targetY = position.y + y;
        if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;
        output[targetY * width + targetX] |= masks[source + y * overlay.width + x];
      }
    }
  }
  return output;
}

export function composeBorderSprites(leftBase, rightBase, healthStrip, ammoStrip,
  layout, energy, ammunition) {
  const left = new Uint8Array(leftBase), right = new Uint8Array(rightBase);
  const pair = layout.spriteBytes;
  const healthDestination = layout.health.destination;
  for (let unit = 0; unit < layout.health.maximum; unit++) {
    const target = healthDestination + unit * 16;
    left[target] = left[target + 8] = left[pair + target] = left[pair + target + 8] = 0;
  }
  const healthStart = layout.health.maximum - energy;
  for (let unit = 0; unit < energy; unit++) {
    const source = (healthStart + unit) * 4;
    const target = healthDestination + (healthStart + unit) * 16;
    left[target] = healthStrip[source];
    left[target + 8] = healthStrip[source + 1];
    left[pair + target] = healthStrip[source + 2];
    left[pair + target + 8] = healthStrip[source + 3];
  }

  const ammoDestination = layout.ammo.destination;
  for (let unit = 0; unit < layout.ammo.maximum; unit++) {
    for (let row = 0; row < 2; row++) {
      const target = ammoDestination + (unit * 2 + row) * 16;
      right[target] = right[target + 8] = right[pair + target] = right[pair + target + 8] = 0;
    }
  }
  const ammoStart = layout.ammo.maximum - ammunition;
  for (let unit = 0; unit < ammunition; unit++) {
    const source = (ammoStart + unit) * 8;
    for (let row = 0; row < 2; row++) {
      const target = ammoDestination + ((ammoStart + unit) * 2 + row) * 16;
      right[target] = ammoStrip[source + row * 4];
      right[target + 8] = ammoStrip[source + row * 4 + 1];
      right[pair + target] = ammoStrip[source + row * 4 + 2];
      right[pair + target + 8] = ammoStrip[source + row * 4 + 3];
    }
  }
  return { left, right };
}

function borderCopperTransitionRGB(side, x, y, colour, borderPalette, panelPalette) {
  // The packaged retail AGA capture (Alien Breed 3D AGA/___SShot.png) covers
  // maximum health and the bottom ammunition unit, hence every gauge texel
  // which can be opaque on local rows 150..153. Together with NEWTWO.s
  // putinsmallscr lines 1989-2039 and BigFieldCop's palette/PanelCop handoff,
  // it identifies two raster states:
  //
  // * row 150 is crossed while high-nibble border COLOR writes have happened
  //   but their low-nibble writes have not;
  // * rows 151..153 contain the subsequent PanelCop palette handoff.
  //
  // These predicates cover exactly the 50 disagreeing opaque capture texels;
  // they express recovered palette state and never substitute captured RGB.
  const highNibbleOnly = y === 150 && (
    (side === 'left' && colour >= 1 && colour <= 5) ||
    (side === 'right' && (x <= 14 || (x >= 49 && x <= 50))));
  if (highNibbleOnly) {
    const at = colour * 3;
    // The right pair's colour 13 has already entered the PanelCop bank while
    // its low nibbles are still pending (capture row 150, x 12..13).
    const activePalette = side === 'right' && colour === 13 && panelPalette
      ? panelPalette : borderPalette;
    return [activePalette[at] >>> 4, activePalette[at + 1] >>> 4,
      activePalette[at + 2] >>> 4].map(nibble => nibble * 17);
  }
  const panelHandoff = (y === 151 && side === 'right' && x >= 8 && x <= 15) ||
    ((y === 152 || y === 153) && colour === 13);
  if (panelHandoff && panelPalette) {
    const at = colour * 3;
    return [panelPalette[at], panelPalette[at + 1], panelPalette[at + 2]];
  }
  return null;
}

export function decodeAttachedSprites(data, layout, palette, scanlinePalette = null,
    side = null, panelPalette = null) {
  const output = new Uint8Array(layout.width * layout.height * 4);
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const byte = x >> 3, bit = 0x80 >>> (x & 7);
      const first = 16 + y * 16 + byte;
      let colour = 0;
      if (data[first] & bit) colour |= 1;
      if (data[first + 8] & bit) colour |= 2;
      if (data[layout.spriteBytes + first] & bit) colour |= 4;
      if (data[layout.spriteBytes + first + 8] & bit) colour |= 8;
      const target = (y * layout.width + x) * 4;
      let rgb = side ? borderCopperTransitionRGB(
        side, x, y, colour, palette, panelPalette) : null;
      const scanline = layout.scanlinePalette;
      if (!rgb && scanlinePalette && colour === scanline?.colourIndex) {
        // putinsmallscr writes healthpal to COLOR15 once per 96-pixel chunky
        // row. Each row is displayed twice vertically; attached sprites begin
        // eight display lines later and retain the final word below the view.
        const screenY = layout.verticalStart - layout.displayStart + y;
        const row = Math.min(scanline.rows - 1,
          Math.floor(screenY / scanline.displayLineRepeat));
        rgb = decodeRGB12(scanlinePalette.getUint16(row * 2));
      }
      output[target] = rgb ? rgb[0] : palette[colour * 3];
      output[target + 1] = rgb ? rgb[1] : palette[colour * 3 + 1];
      output[target + 2] = rgb ? rgb[2] : palette[colour * 3 + 2];
      output[target + 3] = colour ? 255 : 0;
    }
  }
  return output;
}

export class TextureBanks {
  constructor(manifest, palette, banks, floor, floorLookup, plainScale, backdrop = null,
      water = null, waterBrighten = null, waterWorkspaces = null) {
    this.manifest = manifest;
    this.palette = palette;
    this.banks = banks;
    this.floor = floor;
    this.floorLookup = floorLookup;
    this.plainScale = plainScale;
    this.backdrop = backdrop;
    this.water = water;
    this.waterBrighten = waterBrighten;
    this.waterWorkspaces = waterWorkspaces;
  }

  static async load(root = 'assets/walls/') {
    const response = await fetch(`${root}index.json?v=source-fidelity-19`);
    if (!response.ok) throw new Error(`wall manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.format !== 'alien-breed-3d-wall-banks-v1') throw new Error('unknown wall-bank format');
    const loaded = await Promise.all([
      fetch(`${root}${manifest.palette.file}`).then(checkedBuffer),
      ...manifest.banks.map(bank => fetch(`${root}${bank.file}`).then(checkedBuffer)),
      fetch(`${root}${manifest.floor.file}`).then(checkedBuffer),
      fetch(`${root}${manifest.floor.lookup}`).then(checkedBuffer),
      fetch(`${root}${manifest.floor.plainScale}`).then(checkedBuffer),
      fetch(`${root}${manifest.backdrop.file}`).then(checkedBuffer),
      fetch(`${root}${manifest.floor.water.file}`).then(checkedBuffer),
      fetch(`${root}${manifest.floor.water.brighten}?v=${manifest.floor.water.brightenSha256}`).then(checkedBuffer),
      fetch(`${root}${manifest.floor.water.workspaces}`).then(checkedBuffer),
    ]);
    const paletteBuffer = loaded[0];
    const buffers = loaded.slice(1, 1 + manifest.banks.length);
    const asset = 1 + manifest.banks.length;
    const floor = new Uint8Array(loaded[asset]);
    const floorLookup = new Uint8Array(loaded[asset + 1]);
    const plainScale = new DataView(loaded[asset + 2]);
    const backdrop = new DataView(loaded[asset + 3]);
    const water = new DataView(loaded[asset + 4]);
    const waterBrighten = new DataView(loaded[asset + 5]);
    const waterWorkspaces = new DataView(loaded[asset + 6]);
    if (floor.length !== 65536 || floorLookup.length !== 19 * 256 * 2) {
      throw new Error('invalid floor texture assets');
    }
    if (plainScale.byteLength !== 16 * 64) throw new Error('invalid plain-floor scale asset');
    if (backdrop.byteLength !== manifest.backdrop.width * manifest.backdrop.height * 2) {
      throw new Error('invalid backdrop asset');
    }
    if (water.byteLength !== manifest.floor.water.bytes ||
        waterBrighten.byteLength !== manifest.floor.water.brightenBytes ||
        waterBrighten.byteLength !== 11264) {
      throw new Error('invalid retail water assets');
    }
    if (waterWorkspaces.byteLength !== 16 * manifest.floor.water.workspaceBytesPerLevel) {
      throw new Error('invalid retail water WorkSpace snapshots');
    }
    const palette = decodeRGB16Palette(paletteBuffer);
    const banks = buffers.map((buffer, id) => {
      const bytes = new Uint8Array(buffer);
      if (bytes.length !== manifest.banks[id].bytes || bytes.length <= LOOKUP_BYTES) {
        throw new Error(`invalid wall bank ${id}`);
      }
      return { ...manifest.banks[id], data: bytes, view: new DataView(buffer) };
    });
    return new TextureBanks(
      manifest, palette, banks, floor, floorLookup, plainScale, backdrop,
      water, waterBrighten, waterWorkspaces);
  }

  sample(bankId, u, v, brightness, columnStride = null) {
    const bank = this.banks[bankId];
    if (!bank) return [255, 0, 255];
    // This is the same validation as the former Array.every expression, kept
    // scalar so dense browser modes do not allocate one array per wall pixel.
    if (!Number.isFinite(u) || !Number.isFinite(v) || !Number.isFinite(brightness)) {
      throw new Error(`invalid texture coordinates bank=${bankId} u=${u} v=${v} light=${brightness}`);
    }
    // wallroutine3.chipmem:screendivide lines 383-401 masks the command-local
    // U with HORAND, adds fromtile, then addresses ChunkAddr through
    // divthreetab. It never wraps that absolute column by a decoded image
    // width. VALSHIFT then multiplies the packed-column number by the height
    // encoded in this particular wall command; a few retail commands select a
    // different stride from their bank's common layout. V has likewise already
    // been masked by ScreenWallstripdraw. Keep these as direct recovered-bank
    // coordinates so neither case is silently reinterpreted by browser metadata.
    const x = Math.floor(u);
    const y = Math.floor(v);
    const stride = columnStride === null ? bank.height : Math.trunc(columnStride);
    if (x < 0 || y < 0 || !Number.isInteger(stride) || stride <= 0 || y >= stride) {
      throw new Error(`source wall coordinate outside recovered bank ${bankId}: u=${x} v=${y}`);
    }
    const group = Math.floor(x / 3);
    const wordOffset = LOOKUP_BYTES + (group * stride + y) * 2;
    if (wordOffset + 2 > bank.data.length) {
      throw new Error(`source wall coordinate outside recovered bank ${bankId}: u=${x} v=${y}`);
    }
    const texel = unpackTexel(bank.view.getUint16(wordOffset), x % 3);
    const row = wallLightRow(brightness);
    return decodeRGB12(bank.view.getUint16(row * 64 + texel * 2));
  }

  sampleFloor(texture, u, v, brightness) {
    const texel = this.floorTexel(texture, u, v);
    // floorbright in newtwo.s maps 0,1,2,...,28 to 0,1,1,...,14.
    const row = Math.max(0, Math.min(14, Math.floor((brightness + 1) / 2)));
    return this.sampleFloorPaletteIndex(row * 256 + texel);
  }

  floorTexel(texture, u, v) {
    const lane = texture & 3;
    const block = (texture >>> 8) & 3;
    const x = modulo(Math.floor(u), 64);
    const y = modulo(Math.floor(v), 64);
    return this.floor[(y * 256 + block * 64 + x) * 4 + lane];
  }

  sampleFloorPaletteIndex(index) {
    // NEWTWO.s:gouraudfloor writes the texture byte into d0, advances the
    // packed brightness accumulator, then addresses (floorscalecols,d0.w*2).
    const at = (index & 0xffff) * 2;
    if (at + 1 >= this.floorLookup.length) {
      throw new Error(`source floor palette index outside recovered lookup: ${index}`);
    }
    return decodeRGB12((this.floorLookup[at] << 8) | this.floorLookup[at + 1]);
  }

  waterWorkspaceForLevel(level) {
    if (!this.waterWorkspaces || typeof level !== 'string') return null;
    const index = level.toUpperCase().charCodeAt(0) - 65;
    const bytes = this.manifest.floor.water.workspaceBytesPerLevel;
    if (index < 0 || index >= 16) return null;
    const copy = this.waterWorkspaces.buffer.slice(
      this.waterWorkspaces.byteOffset + index * bytes,
      this.waterWorkspaces.byteOffset + (index + 1) * bytes);
    return new DataView(copy);
  }

  sampleWater(frame, packedCoordinate, underlyingLowByte, distance) {
    if (!this.water || !this.waterBrighten) {
      throw new Error('retail water tables are unavailable');
    }
    const coordinate = packedCoordinate & 0x3f3f;
    const waterWord = this.water.getUint16(WATER_FRAME_OFFSETS[frame & 7] + coordinate * 4);
    const composite = (waterWord & 0xff00) | (underlyingLowByte & 0xff);
    // texturedwater lines 6873-6885 clears the distance low byte, doubles
    // that word offset, and saturates it at the thirteenth 512-byte row.
    let brightenOffset = ((distance & 0xff00) * 2) & 0xffff;
    const signedOffset = brightenOffset & 0x8000 ? brightenOffset - 0x10000 : brightenOffset;
    if (signedOffset >= 12 * 512) brightenOffset = 12 * 512;
    const at = signedOffset < 0 ? signedOffset + composite * 2
      : brightenOffset + composite * 2;
    // The released oldbrightenfile is 11,264 bytes. waterfile's high byte is
    // at most 9, so the capped row's maximum address is
    // 12*512 + 0x09ff*2 = 11,262: the final word of brightentab. This follows
    // NEWTWO.s:texturedwater lines 6869-6959 and its data layout at 8823-8826;
    // no legal water colour lookup reaches the following WorkSpace label.
    if (at < 0 || at + 1 >= this.waterBrighten.byteLength) {
      throw new Error(
        `source water lookup outside recovered brighten table: ${at} ` +
        `(frame=${frame & 7} coordinate=${coordinate} colour=${composite} distance=${distance})`);
    }
    return decodeRGB12(this.waterBrighten.getUint16(at));
  }

  samplePlainFloor(texture, brightness) {
    if (!this.plainScale) return [0, 0, 0];
    // SimpleFloorLine preserves the tile's two selector bits and its $300
    // block, producing the four 64-byte lanes within each 256-byte block.
    const lane = texture & 3;
    const block = (texture >>> 8) & 3;
    const row = Math.max(0, Math.min(28, Math.floor(brightness)));
    return decodeRGB12(this.plainScale.getUint16(block * 256 + lane * 64 + row * 2));
  }

  sampleBackdrop(angle, x, y, angleUnits = null) {
    if (!this.backdrop || !this.manifest.backdrop) return [0, 0, 0];
    const { width, height } = this.manifest.backdrop;
    // anims:putinbackdrop multiplies tmpangpos by 432 and DIVS #8192 before
    // adding display columns. Prefer the recovered integer angle so exact
    // boundary headings cannot move one panorama column through float roundoff.
    const heading = Number.isInteger(angleUnits)
      ? Math.trunc(((angleUnits & 8191) * width) / 8192)
      : Math.floor(angle / (Math.PI * 2) * width);
    // anims:putinbackdrop's three 32-column loops copy a native 96x38 window.
    // Expansion belongs to putinsmallscr/the caller, not this recovered-data
    // lookup, so x and y are source panorama coordinates here.
    const sourceX = modulo(heading + Math.trunc(x), width);
    const sourceY = Math.max(0, Math.min(height - 1, Math.trunc(y)));
    return decodeRGB12(this.backdrop.getUint16((sourceX * height + sourceY) * 2));
  }
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

async function checkedBuffer(response) {
  if (!response.ok) throw new Error(`asset request failed: HTTP ${response.status}`);
  return response.arrayBuffer();
}
