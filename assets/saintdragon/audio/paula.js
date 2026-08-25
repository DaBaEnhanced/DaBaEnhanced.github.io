'use strict';
// Saint Dragon audio for the web port.
//
// The game's instruments are not samples but small 68k programs that sweep
// their own sample pointers and run envelopes, so reproducing them by hand is
// unreliable.  Instead the original driver was run and every write it made to
// the Amiga audio hardware was recorded -- AUDxLC/LEN/PER/VOL and DMACON, with
// the sound-effect voices muted so the stream is music only.  Replaying that
// here through a software Paula gives the real tune rather than an imitation.
//
// The score loops forever by construction (every channel opens with a
// loop-start whose count is zero), so looping the stream gives music of
// whatever length a level happens to take.

const PAL_CLOCK = 3546895;      // Amiga colour clock, PAL
const FPS = 50;

// Cutoff of the output filter below.  The Amiga's own fixed filter sits lower,
// but 7 kHz matched the original most closely by ear.
const LOWPASS_HZ = 7000;

// AUDxLEN counts words, and 0 means 65536 -- not "no buffer".  Treating it as
// empty leaves a loud sample looping where the driver intended silence.
function bufSize(c) { return (c.len || 65536) * 2; }

class Paula {
  // `mem` is a byte reader: addr -> signed sample, or null outside the blob.
  constructor(mem, sampleRate) {
    this.mem = mem;
    this.sr = sampleRate;
    this.dmacon = 0;
    this.ch = [0, 1, 2, 3].map(() => ({
      lc: 0, len: 0, per: 400, vol: 0, dma: false,
      base: 0, size: 0, off: 0,
    }));
  }

  write(reg, v) {
    if (reg === 0x096) {                                  // DMACON
      const prev = this.dmacon;
      this.dmacon = (v & 0x8000) ? (this.dmacon | (v & 0x7FFF))
                                 : (this.dmacon & ~(v & 0x7FFF));
      for (let i = 0; i < 4; i++) {
        const on = !!(this.dmacon & (1 << i));
        const c = this.ch[i];
        if (on && !(prev & (1 << i))) {                   // channel starts
          c.base = c.lc; c.size = bufSize(c); c.off = 0;
        }
        c.dma = on;
      }
      return;
    }
    if (reg < 0x0A0 || reg >= 0x0E0) return;
    const i = (reg - 0x0A0) >> 4, o = (reg - 0x0A0) & 0xF, c = this.ch[i];
    if (o === 0)      c.lc = ((v & 0x1FF) << 16) | (c.lc & 0xFFFF);
    else if (o === 2) c.lc = (c.lc & 0xFFFF0000) | (v & 0xFFFF);
    else if (o === 4) c.len = v;
    else if (o === 6) c.per = v >= 124 ? v : 124;
    else if (o === 8) c.vol = Math.min(64, v & 0x7F);
  }

  // Mix `n` samples into `outL`/`outR` starting at `at`.  Paula's panning is
  // fixed in hardware -- channels 0 and 3 feed the left output, 1 and 2 the
  // right -- so the stereo image is a property of the machine, not a choice.
  // `mask` selects the channels currently owned by music voices.
  mix(outL, outR, at, n, mask) {
    const master = (this.dmacon & 0x0200) !== 0;
    for (let i = 0; i < 4; i++) {
      const c = this.ch[i];
      const out = (i === 0 || i === 3) ? outL : outR;
      if (mask !== undefined && !(mask & (1 << i))) continue;
      if (!master || !c.dma || c.size < 2 || !c.base) continue;
      const step = (PAL_CLOCK / c.per) / this.sr;
      const gain = c.vol / 64 / 4;
      let off = c.off, base = c.base, size = c.size;
      for (let k = 0; k < n; k++) {
        // Linear interpolation between adjacent bytes.  Paula emits a stepped
        // waveform at the DMA rate and the Amiga's analog stage smooths it;
        // point-sampling a 32-byte buffer up to 48 kHz instead produces harsh
        // aliasing, which is heard as noise.
        const i0 = off | 0;
        const s0 = this.mem(base + i0);
        if (s0 !== null) {
          const frac = off - i0;
          const s1 = this.mem(base + ((i0 + 1) % size));
          out[at + k] += (s1 === null ? s0 : s0 + (s1 - s0) * frac) * gain;
        }
        off += step;
        if (off >= size) {                                // DMA reloads LC/LEN
          off -= size;
          base = c.lc; size = bufSize(c);
        }
      }
      c.off = off; c.base = base; c.size = size;
    }
  }
}

// Maps Amiga addresses onto the packed sample blob.
function makeReader(blob, regions) {
  const rs = regions.slice().sort((a, b) => a.addr - b.addr);
  return (addr) => {
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (addr >= r.addr && addr < r.addr + r.len) {
        const b = blob[r.off + (addr - r.addr)];
        return (b > 127 ? b - 256 : b) / 128;
      }
    }
    return null;
  };
}

// Replay the recorded register stream into one buffer, ready to loop.
// `raw` is packed (frame, reg, value) triples; frame 0xFFFF marks writes made
// before the window began, which set up the channel state the loop starts in.
function renderMusic(raw, mask, read, sampleRate) {
  const paula = new Paula(read, sampleRate);
  const frames = mask.length;
  const spf = sampleRate / FPS;
  const size = Math.ceil(frames * spf) + sampleRate;
  const left = new Float32Array(size), right = new Float32Array(size);
  let i = 0;
  while (i * 3 < raw.length && raw[i * 3] === 0xFFFF) {
    paula.write(raw[i * 3 + 1], raw[i * 3 + 2]);
    i++;
  }
  let cursor = 0;
  for (let f = 0; f < frames; f++) {
    while (i * 3 < raw.length && raw[i * 3] === f) {
      paula.write(raw[i * 3 + 1], raw[i * 3 + 2]);
      i++;
    }
    const start = Math.floor(cursor);
    const n = Math.floor(cursor + spf) - start;
    paula.mix(left, right, start, n, mask[f]);
    cursor += spf;
  }
  const len = Math.floor(cursor);
  const l = left.subarray(0, len), r = right.subarray(0, len);
  lowpass(l, sampleRate, LOWPASS_HZ);
  lowpass(r, sampleRate, LOWPASS_HZ);
  return { left: l, right: r };
}

// The Amiga's audio output runs through an analog low-pass before it reaches
// the speaker, so the raw stepped signal is never what you actually heard.
// One pole at ~4.4 kHz is a fair approximation of an A500's fixed filter.
function lowpass(buf, sampleRate, cutoff) {
  const a = 1 - Math.exp(-2 * Math.PI * cutoff / sampleRate);
  let y = 0;
  for (let i = 0; i < buf.length; i++) {
    y += a * (buf[i] - y);
    buf[i] = y;
  }
}

class SaintDragonAudio {
  constructor(ctx) {
    this.ctx = ctx;
    this.tracks = new Map();          // name -> AudioBuffer
    this.sfx = new Map();
    this.sfxLevels = new Map();
    this.musicNode = null;
    this.current = null;
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(ctx.destination);
    this.sfxGain.connect(ctx.destination);
  }

  static async load(ctx, base = '.', version = '') {
    const a = new SaintDragonAudio(ctx);
    const url = name => `${base}/${name}${version ? `?v=${version}` : ''}`;
    const [man, sfx] = await Promise.all([
      fetch(url('manifest.json')).then(r => r.json()),
      fetch(url('sfx.bin')).then(r => r.arrayBuffer()),
    ]);

    // "level" is song 0; "boss" is song 1, which the game selects by writing 1
    // to $18(a6) when a boss appears and clears again afterwards.
    for (const name of Object.keys(man.tracks)) {
      const t = man.tracks[name];
      const [samples, music, maskBuf] = await Promise.all([
        fetch(url(`${name}.samples.bin`)).then(r => r.arrayBuffer()),
        fetch(url(`${name}.music.bin`)).then(r => r.arrayBuffer()),
        fetch(url(`${name}.mask.bin`)).then(r => r.arrayBuffer()),
      ]);
      const read = makeReader(new Uint8Array(samples), t.regions);
      const { left, right } = renderMusic(new Uint16Array(music),
                                          new Uint8Array(maskBuf),
                                          read, ctx.sampleRate);
      let peak = 0;
      for (let k = 0; k < left.length; k++)
        peak = Math.max(peak, Math.abs(left[k]), Math.abs(right[k]));
      if (peak > 1)
        for (let k = 0; k < left.length; k++) { left[k] /= peak; right[k] /= peak; }
      const buf = ctx.createBuffer(2, left.length, ctx.sampleRate);
      buf.copyToChannel(left, 0);
      buf.copyToChannel(right, 1);
      a.tracks.set(name, buf);
    }

    const sb = new Uint8Array(sfx);
    for (const s of man.sfx) {
      const buf = ctx.createBuffer(1, s.len, s.rate);
      const d = buf.getChannelData(0);
      for (let k = 0; k < s.len; k++) {
        const b = sb[s.off + k];
        d[k] = (b > 127 ? b - 256 : b) / 128;
      }
      a.sfx.set(s.id, buf);
      a.sfxLevels.set(s.id, s.volume ?? 1);
    }
    return a;
  }

  // The game switches tracks by stopping one and starting the other -- there is
  // no crossfade -- so a plain swap matches it.
  playMusic(name = 'level') {
    const buf = this.tracks.get(name);
    if (!buf || this.current === name) return;
    this.stopMusic();
    const n = this.ctx.createBufferSource();
    n.buffer = buf;
    n.loop = true;                    // loops for as long as the level or fight lasts
    n.connect(this.musicGain);
    n.start();
    this.musicNode = n;
    this.current = name;
  }

  stopMusic() {
    if (this.musicNode) this.musicNode.stop();
    this.musicNode = null;
    this.current = null;
  }

  get trackNames() { return [...this.tracks.keys()]; }

  // Sound ids are the game's own: 68..84 are the sampled effects.
  playSfx(id, rate, volume) {
    const buf = this.sfx.get(id);
    if (!buf) return;
    volume ??= this.sfxLevels.get(id) ?? 1;
    const n = this.ctx.createBufferSource();
    n.buffer = buf;
    if (rate) n.playbackRate.value = rate / buf.sampleRate;
    if (volume === 1) {
      n.connect(this.sfxGain);
    } else {
      const gain = this.ctx.createGain();
      gain.gain.value = Math.max(0, volume);
      n.connect(gain);
      gain.connect(this.sfxGain);
    }
    n.start();
  }

  set musicVolume(v) { this.musicGain.gain.value = v; }
  set sfxVolume(v) { this.sfxGain.gain.value = v; }
}

if (typeof module !== 'undefined') module.exports = { SaintDragonAudio, Paula };
