const SOURCE_HZ = 50;
const FADE_FRAMES = 16 * 16;
const HOLD_FRAMES = 401;

export class EndingTimeline {
  constructor(manifest) {
    this.manifest = manifest;
    this.active = false;
    this.phase = 'intro';
    this.frames = 0;
    this.scrollPixels = 0;
  }

  start() {
    this.active = true;
    this.phase = 'intro';
    this.frames = 0;
    this.scrollPixels = 0;
  }

  stop() { this.active = false; }

  skipIntro() {
    if (this.phase === 'intro') {
      this.phase = 'scroll';
      this.frames = FADE_FRAMES + HOLD_FRAMES;
      this.scrollPixels = 0;
    }
  }

  update(seconds) {
    if (!this.active || seconds <= 0) return false;
    const addedFrames = seconds * SOURCE_HZ;
    this.frames += addedFrames;
    if (this.phase === 'intro' && this.frames >= FADE_FRAMES + HOLD_FRAMES) {
      this.phase = 'scroll';
      this.scrollPixels = 0;
      return true;
    }
    if (this.phase === 'scroll') {
      this.scrollPixels += addedFrames / this.manifest.sourceTicksPerPixel;
    }
    return true;
  }

  introOpacity() {
    return Math.min(1, Math.floor(this.frames / 16) / 15);
  }

  visibleLines() {
    const height = this.manifest.height;
    const lineHeight = this.manifest.lineHeight;
    if (this.phase === 'intro') {
      return this.manifest.intro.map((record, index) => ({ record, y: index * lineHeight }));
    }
    const offset = this.scrollPixels;
    if (offset < height) {
      return [
        ...this.manifest.intro.map((record, index) => ({ record, y: index * lineHeight - offset })),
        ...this.manifest.scroll.map((record, index) => ({ record, y: height + index * lineHeight - offset })),
      ].filter(line => line.y > -lineHeight && line.y < height);
    }
    const cycleHeight = this.manifest.scroll.length * lineHeight;
    const cycleOffset = (offset - height) % cycleHeight;
    const result = [];
    for (const cycle of [0, cycleHeight]) {
      for (let index = 0; index < this.manifest.scroll.length; index++) {
        const y = index * lineHeight - cycleOffset + cycle;
        if (y > -lineHeight && y < height) result.push({ record: this.manifest.scroll[index], y });
      }
    }
    return result;
  }
}

export class EndingSequence extends EndingTimeline {
  constructor(manifest, fonts) {
    super(manifest);
    this.fonts = fonts;
    this.surface = document.createElement('canvas');
    this.surface.width = manifest.width;
    this.surface.height = manifest.height;
    this.context = this.surface.getContext('2d');
    this.glyphs = new Map();
  }

  static async load(fonts, baseUrl = 'assets/ending') {
    const response = await fetch(`${baseUrl}/index.json`);
    if (!response.ok) throw new Error(`ending manifest request failed: HTTP ${response.status}`);
    const manifest = await response.json();
    if (manifest.format !== 'alien-breed-3d-ending-v1') {
      throw new Error(`unsupported ending manifest ${manifest.format}`);
    }
    return new EndingSequence(manifest, fonts);
  }

  glyph(fontName, code) {
    const key = `${fontName}:${code}`;
    if (this.glyphs.has(key)) return this.glyphs.get(key);
    const glyph = this.fonts.glyph(fontName, code);
    if (!glyph) return null;
    const canvas = document.createElement('canvas');
    canvas.width = glyph.font.glyphWidth;
    canvas.height = glyph.font.glyphHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    for (let y = 0; y < glyph.font.glyphHeight; y++) {
      for (let x = 0; x < glyph.font.glyphWidth; x++) {
        if (this.fonts.sample(fontName, code, x, y)) context.fillRect(x, y, 1, 1);
      }
    }
    const cached = { canvas, advance: glyph.advance };
    this.glyphs.set(key, cached);
    return cached;
  }

  recordWidth(record) {
    const fontName = `ending-${record.font}`;
    let width = 0;
    for (const character of record.text) width += this.fonts.glyph(fontName, character.charCodeAt(0))?.advance || 0;
    return width;
  }

  drawRecord(record, y) {
    if (record.font < 0 || y <= -this.manifest.lineHeight || y >= this.manifest.height) return;
    const fontName = `ending-${record.font}`;
    let x = record.centred ? 320 - Math.floor(this.recordWidth(record) / 2) : 0;
    for (const character of record.text) {
      const glyph = this.glyph(fontName, character.charCodeAt(0));
      if (!glyph) continue;
      this.context.drawImage(glyph.canvas, Math.floor(x), Math.floor(y));
      x += glyph.advance;
    }
  }

  draw(target, width, height) {
    this.context.clearRect(0, 0, this.manifest.width, this.manifest.height);
    this.context.fillStyle = '#000';
    this.context.fillRect(0, 0, this.manifest.width, this.manifest.height);
    this.context.globalAlpha = this.phase === 'intro' ? this.introOpacity() : 1;
    for (const { record, y } of this.visibleLines()) this.drawRecord(record, y);
    this.context.globalAlpha = 1;

    target.imageSmoothingEnabled = false;
    target.clearRect(0, 0, width, height);
    // The Amiga ending is 640-pixel hires but retains the same physical width
    // as a 320-pixel lores screen.
    const scale = Math.min(width / 320, height / 256);
    target.drawImage(this.surface, (width - 320 * scale) / 2, (height - 256 * scale) / 2,
      320 * scale, 256 * scale);
  }
}
