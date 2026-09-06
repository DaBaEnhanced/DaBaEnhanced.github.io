// A compact Protracker replayer, kept free of WebAudio so it can be rendered
// and tested headlessly (tools/modrender.mjs).
//
// The modules come from tools/p61tomod.py, which converts Breathless' P61A
// music to standard .mod. Paula plays 8-bit signed samples at
// 3546895 / period Hz; timing is `speed` ticks per row at `tempo` BPM, where
// the tick rate is tempo * 2 / 5 Hz (125 BPM = 50 Hz, the Amiga default).

const PAL_CLOCK = 3546895;
const FINETUNE = [
  8363, 8413, 8463, 8529, 8581, 8651, 8723, 8757,
  7895, 7941, 7985, 8046, 8107, 8169, 8232, 8280,
];

// AudioWorkletGlobalScope is a deliberately tiny realm: no fetch, no timers, no
// document -- and no TextDecoder. This file is evaluated inside it, so using
// `new TextDecoder('latin1')` here threw the moment a module was parsed, the
// player was never created, and the game played silence with the error trapped
// inside the worklet where nothing was listening. Latin-1 is a byte-for-byte
// mapping to the first 256 code points, so it needs no decoder.
function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) break;                 // the names are NUL-padded
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

export function parseMod(bytes) {
  const d = bytes;
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const title = latin1(d.subarray(0, 20));
  const samples = [];
  for (let i = 0; i < 31; i++) {
    const o = 20 + i * 30;
    samples.push({
      name: latin1(d.subarray(o, o + 22)),
      length: dv.getUint16(o + 22) * 2,
      finetune: d[o + 24] & 0x0f,
      volume: Math.min(64, d[o + 25]),
      repeatOffset: dv.getUint16(o + 26) * 2,
      repeatLength: dv.getUint16(o + 28) * 2,
      data: null,
    });
  }
  const songLength = d[950];
  const order = Array.from(d.subarray(952, 1080));
  const numPatterns = Math.max(...order.slice(0, songLength)) + 1;

  const patterns = [];
  for (let p = 0; p < numPatterns; p++) {
    const rows = [];
    for (let r = 0; r < 64; r++) {
      const cells = [];
      for (let c = 0; c < 4; c++) {
        const o = 1084 + p * 1024 + r * 16 + c * 4;
        const b0 = d[o], b1 = d[o + 1], b2 = d[o + 2], b3 = d[o + 3];
        cells.push({
          sample: (b0 & 0xf0) | (b2 >> 4),
          period: ((b0 & 0x0f) << 8) | b1,
          cmd: b2 & 0x0f,
          info: b3,
        });
      }
      rows.push(cells);
    }
    patterns.push(rows);
  }

  let pos = 1084 + numPatterns * 1024;
  for (const s of samples) {
    s.data = new Int8Array(d.buffer, d.byteOffset + pos, Math.min(s.length, d.length - pos));
    pos += s.length;
    if (s.repeatLength <= 2) { s.repeatOffset = 0; s.repeatLength = 0; }
  }
  return { title, samples, order, songLength, numPatterns, patterns };
}

export class ModPlayer {
  constructor(mod, sampleRate = 48000) {
    this.mod = mod;
    this.rate = sampleRate;
    this.reset();
  }

  /** P61_SetPosition: jump to a song position, clamped to the order list. */
  setPosition(pos) {
    this.songPos = Math.max(0, Math.min(this.mod.songLength - 1, pos | 0));
    this.row = 0; this.tick = 0; this.tickAcc = 0;
    this.jump = null;
  }

  reset() {
    this.speed = 6;
    this.tempo = 125;
    this.songPos = 0;
    this.row = 0;
    this.tick = 0;
    this.samplesPerTick = (this.rate * 5) / (this.tempo * 2);
    this.tickAcc = 0;
    this.patternDelay = 0;
    this.jump = null;
    this.ended = false;
    this.channels = [0, 1, 2, 3].map(() => ({
      sample: 0, period: 0, targetPeriod: 0, volume: 0,
      pos: 0, step: 0, playing: false,
      portaSpeed: 0, vibPos: 0, vibSpeed: 0, vibDepth: 0,
      arp: 0, offset: 0, loopCount: 0, loopRow: 0, retrig: 0,
      finetune: 0, lastInfo: 0,
    }));
  }

  /**
   * Paula fetches one sample every `period` cycles of the 3.546895 MHz PAL
   * clock, so the output rate is PAL_CLOCK / period. Period 428 is C-2 and
   * gives 8287 Hz, which is the number to check any change here against.
   *
   * This divided by `period * 2`, which is half the rate -- every note in every
   * module played exactly one octave too low. The mistake is an easy one and
   * worth naming: references commonly write the rate as 7093789.2 / (period*2),
   * where 7093789.2 is TWICE PAL_CLOCK. Using the halved constant *and* the
   * doubled divisor drops an octave. Audio.js's own sound-effect path had it
   * right all along -- `PAL_CLOCK / s.period` -- so the two halves of this port
   * disagreed with each other, and the music was the half that was wrong.
   */
  periodToStep(period, finetune) {
    if (!period) return 0;
    const base = PAL_CLOCK / period;
    const f = FINETUNE[finetune] / FINETUNE[0];
    return (base * f) / this.rate;
  }

  startNote(ch, cell) {
    // A note with no sample number retriggers the channel's CURRENT sample --
    // that is the normal way a Protracker line reads, with the instrument named
    // once and the melody written as bare periods after it. Resolving the
    // sample from `cell.sample` alone made every such note look up samples[-1],
    // find nothing, and switch the channel off instead of retriggering it:
    // MUS2 and MUS3 played one note and then fell silent for good.
    const num = cell.sample || ch.sample;
    const s = this.mod.samples[num - 1];
    // Volume and finetune are reloaded only when a sample number is actually
    // given; a bare note keeps whatever the channel is currently using.
    if (cell.sample) {
      ch.sample = cell.sample;
      ch.volume = s ? s.volume : 0;
      ch.finetune = s ? s.finetune : 0;
    }
    if (cell.period) {
      if (cell.cmd === 0x3 || cell.cmd === 0x5) {
        ch.targetPeriod = cell.period;               // tone portamento: glide only
      } else {
        ch.period = ch.targetPeriod = cell.period;
        ch.pos = ch.offset;
        ch.playing = !!(s && s.data && s.data.length);
        ch.vibPos = 0;
      }
    }
    ch.offset = 0;
  }

  rowEffects(ch, cell) {
    const info = cell.info, hi = info >> 4, lo = info & 0x0f;
    if (info) ch.lastInfo = info;
    switch (cell.cmd) {
      case 0x0: ch.arp = info; break;
      case 0x1: ch.portaUp = info; break;
      case 0x2: ch.portaDown = info; break;
      case 0x3: if (info) ch.portaSpeed = info; break;
      case 0x4: if (hi) ch.vibSpeed = hi; if (lo) ch.vibDepth = lo; break;
      case 0x9: ch.offset = info * 256; ch.pos = ch.offset; break;
      case 0xb: this.jump = { pos: info, row: 0 }; break;
      case 0xc: ch.volume = Math.min(64, info); break;
      case 0xd: this.jump = { pos: this.songPos + 1, row: hi * 10 + lo }; break;
      case 0xe:
        if (hi === 0x6) {                            // pattern loop
          if (lo === 0) ch.loopRow = this.row;
          else if (ch.loopCount === 0) { ch.loopCount = lo; this.jump = { pos: this.songPos, row: ch.loopRow }; }
          else if (--ch.loopCount) this.jump = { pos: this.songPos, row: ch.loopRow };
        } else if (hi === 0xc) ch.cut = lo;
        else if (hi === 0xd) ch.delay = lo;
        else if (hi === 0xe) this.patternDelay = lo;
        else if (hi === 0xa) ch.volume = Math.min(64, ch.volume + lo);
        else if (hi === 0xb) ch.volume = Math.max(0, ch.volume - lo);
        break;
      case 0xf:
        if (info < 32) this.speed = info || 1;
        else { this.tempo = info; this.samplesPerTick = (this.rate * 5) / (this.tempo * 2); }
        break;
      default: break;
    }
  }

  tickEffects(ch, cell) {
    const info = cell.info, hi = info >> 4, lo = info & 0x0f;
    switch (cell.cmd) {
      case 0x0:                                       // arpeggio
        if (ch.arp) {
          const n = this.tick % 3;
          const semis = n === 0 ? 0 : n === 1 ? (ch.arp >> 4) : (ch.arp & 0xf);
          ch.arpPeriod = Math.round(ch.period / Math.pow(2, semis / 12));
        }
        break;
      case 0x1: ch.period = Math.max(113, ch.period - info); break;
      case 0x2: ch.period = Math.min(856, ch.period + info); break;
      case 0x3: case 0x5: {                           // tone portamento
        if (ch.targetPeriod) {
          if (ch.period < ch.targetPeriod) ch.period = Math.min(ch.targetPeriod, ch.period + ch.portaSpeed);
          else if (ch.period > ch.targetPeriod) ch.period = Math.max(ch.targetPeriod, ch.period - ch.portaSpeed);
        }
        if (cell.cmd === 0x5) this.volSlide(ch, info);
        break;
      }
      case 0x4: case 0x6:                             // vibrato
        ch.vibPos = (ch.vibPos + ch.vibSpeed) & 63;
        if (cell.cmd === 0x6) this.volSlide(ch, info);
        break;
      case 0xa: this.volSlide(ch, info); break;
      case 0xe:
        if (hi === 0xc && this.tick === lo) ch.volume = 0;
        else if (hi === 0xd && this.tick === lo) { ch.pos = 0; ch.playing = true; }
        else if (hi === 0x9 && lo && this.tick % lo === 0) ch.pos = 0;
        break;
      default: break;
    }
  }

  volSlide(ch, info) {
    const hi = info >> 4, lo = info & 0x0f;
    if (hi) ch.volume = Math.min(64, ch.volume + hi);
    else if (lo) ch.volume = Math.max(0, ch.volume - lo);
  }

  doTick() {
    const pat = this.mod.patterns[this.mod.order[this.songPos]];
    if (!pat) { this.ended = true; return; }
    const row = pat[this.row];
    for (let c = 0; c < 4; c++) {
      const ch = this.channels[c], cell = row[c];
      if (this.tick === 0) {
        ch.arpPeriod = 0;
        if (!(cell.cmd === 0xe && (cell.info >> 4) === 0xd)) this.startNote(ch, cell);
        this.rowEffects(ch, cell);
      } else {
        this.tickEffects(ch, cell);
      }
      const vib = (cell.cmd === 0x4 || cell.cmd === 0x6)
        ? Math.round(Math.sin((ch.vibPos / 64) * 2 * Math.PI) * ch.vibDepth * 2) : 0;
      const p = (ch.arpPeriod || ch.period) + vib;
      ch.step = this.periodToStep(Math.max(50, p), ch.finetune);
    }

    if (++this.tick >= this.speed) {
      this.tick = 0;
      if (this.patternDelay > 0) { this.patternDelay--; return; }
      if (this.jump) {
        this.songPos = this.jump.pos; this.row = this.jump.row; this.jump = null;
        if (this.songPos >= this.mod.songLength) { this.songPos = 0; this.ended = true; }
      } else if (++this.row >= 64) {
        this.row = 0;
        if (++this.songPos >= this.mod.songLength) { this.songPos = 0; this.ended = true; }
      }
    }
  }

  /** Mix `n` frames into a stereo pair of Float32Arrays. */
  /**
   * `voices` is P61_channels + 1: how many of the four the music is allowed to
   * use. In game the fourth is reserved for sound effects, so its part is
   * simply not heard -- the in-game music really is a different arrangement
   * from the title music, not the same one mixed differently.
   */
  mix(left, right, n, voices = 4) {
    let i = 0;
    while (i < n) {
      if (this.tickAcc <= 0) { this.doTick(); this.tickAcc = this.samplesPerTick; }
      const run = Math.min(n - i, Math.ceil(this.tickAcc));
      for (let c = 0; c < 4; c++) {
        const ch = this.channels[c];
        if (c >= voices) continue;               // reserved for sound effects
        if (!ch.playing || !ch.step) continue;
        const s = this.mod.samples[ch.sample - 1];
        if (!s || !s.data.length) { ch.playing = false; continue; }
        const vol = ch.volume / 64;
        const target = (c === 0 || c === 3) ? left : right;
        const other = (c === 0 || c === 3) ? right : left;
        let pos = ch.pos;
        for (let k = 0; k < run; k++) {
          const idx = pos | 0;
          if (idx >= s.length) {
            if (s.repeatLength > 2) pos = s.repeatOffset + (pos - s.length);
            else { ch.playing = false; break; }
          }
          const v = (s.data[pos | 0] ?? 0) / 128 * vol;
          target[i + k] += v * 0.75;                  // Amiga hard panning, softened
          other[i + k] += v * 0.25;
          pos += ch.step;
          if (s.repeatLength > 2 && pos >= s.repeatOffset + s.repeatLength) {
            pos -= s.repeatLength;
          }
        }
        ch.pos = pos;
      }
      this.tickAcc -= run;
      i += run;
    }
  }
}
