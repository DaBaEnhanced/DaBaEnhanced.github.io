const SOURCE_HZ = 50;
const FADE_FRAMES = 16 * 16;
const HOLD_FRAMES = 401;
const STORY_FADE_FRAMES = 8;

function rgb12(value) {
  return [value >> 8 & 15, value >> 4 & 15, value & 15].map(channel => channel * 17);
}

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
    const response = await fetch(`${baseUrl}/index.json?v=source-fidelity-2`);
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
    // newtwo.s:DRAWLINEOFTEXT loads each 16-bit font row into the low word of
    // D0, then BFINS consumes CHARWIDTHS[n] bits from the right of that value.
    // The recovered rows are consequently right-aligned inside their 16-bit
    // cells. Widths above 16 insert zeroes before the complete stored row.
    canvas.width = glyph.advance;
    canvas.height = glyph.font.glyphHeight;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    for (let y = 0; y < glyph.font.glyphHeight; y++) {
      for (let x = 0; x < glyph.advance; x++) {
        const sourceX = x + 16 - glyph.advance;
        if (sourceX >= 0 && sourceX < 16 &&
            this.fonts.sample(fontName, code, sourceX, y)) {
          context.fillRect(x, y, 1, 1);
        }
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

export class StorySequence {
  constructor(manifest, fonts) {
    if (!Array.isArray(manifest.stories) || manifest.stories.length !== 16) {
      throw new Error('ending manifest lacks the sixteen released level stories');
    }
    this.manifest = manifest;
    this.text = new EndingSequence(manifest, fonts);
    this.active = false;
    this.phase = 'fade-in';
    this.frames = 0;
    this.level = 0;
  }

  start(level) {
    this.level = Math.max(0, Math.min(15, level | 0));
    this.active = true;
    this.phase = 'fade-in';
    this.frames = 0;
  }

  stop() { this.active = false; }

  dismiss() {
    // newtwo.s:PLAYTHEGAME waits for either mouse button or `lastpressed`
    // after the loading work, then starts the eight-frame $8f8..$111 fade.
    if (this.active && this.phase === 'wait') {
      this.phase = 'fade-out';
      this.frames = 0;
      return true;
    }
    return false;
  }

  colour() {
    if (this.phase === 'wait') return rgb12(0x7f7);
    const frame = Math.min(STORY_FADE_FRAMES - 1, Math.floor(this.frames));
    // newtwo.s:PLAYTHEGAME .fdup adds/subtracts exactly $121 once per VBlank.
    return rgb12(this.phase === 'fade-out' ? 0x8f8 - frame * 0x121 : 0x010 + frame * 0x121);
  }

  update(seconds) {
    if (!this.active || seconds <= 0) return { redraw: false, completed: false };
    if (this.phase === 'wait') return { redraw: false, completed: false };
    this.frames += seconds * SOURCE_HZ;
    if (this.frames < STORY_FADE_FRAMES) return { redraw: true, completed: false };
    if (this.phase === 'fade-in') {
      this.phase = 'wait';
      this.frames = 0;
      return { redraw: true, completed: false };
    }
    this.active = false;
    return { redraw: true, completed: true };
  }

  draw(target, width, height) {
    const renderer = this.text;
    const context = renderer.context;
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.clearRect(0, 0, this.manifest.width, this.manifest.height);
    // TWEENTEXT draws records 0..14; the sixteenth record in every released
    // block is storage padding and is not visited by DOWNTEXT's DBRA #14.
    for (let row = 0; row < 15; row++) {
      renderer.drawRecord(this.manifest.stories[this.level][row], row * this.manifest.lineHeight);
    }
    context.globalCompositeOperation = 'source-in';
    const [red, green, blue] = this.colour();
    context.fillStyle = `rgb(${red} ${green} ${blue})`;
    context.fillRect(0, 0, this.manifest.width, this.manifest.height);
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#000';
    context.fillRect(0, 0, this.manifest.width, this.manifest.height);
    context.globalCompositeOperation = 'source-over';

    target.imageSmoothingEnabled = false;
    target.clearRect(0, 0, width, height);
    const scale = Math.min(width / 320, height / 256);
    target.drawImage(renderer.surface, (width - 320 * scale) / 2, (height - 256 * scale) / 2,
      320 * scale, 256 * scale);
  }
}
