// Menace - a software Paula, replaying the captured register stream.
//
// The instruments are programs, not static samples: the driver advances its own
// pointers, retriggers and runs envelopes. So nothing is synthesised here. The
// emulator logged exactly what the hardware was told to play - AUDxLC, AUDxLEN,
// AUDxPER, AUDxVOL and DMACON - and this replays that, which makes the result
// ground truth rather than an approximation.
//
// Two details that are not optional:
//
//   Timestamps are DRIVER TICKS, not frames. The driver runs on VERTB at
//   exactly 50 Hz; the emulator's own frame loop drops some, so stamping by
//   frame stretched the tune by about 20%.
//
//   Panning is fixed in hardware: channels 0 and 3 left, 1 and 2 right. Summing
//   all four to mono is the mistake this port already made once.

export const PAL_CLOCK = 3546895;
export const TICK_HZ = 50;

const INTERLUDE_MODES = new Set(['intro0', 'intro1', 'intro2', 'credits',
                                 'legend', 'index', 'mothership']);
const LEVEL_END_MODES = new Set(['tally', 'ending', 'mothershipEnd', 'continue']);

// Reconstruct the tune the original route would currently own when Web Audio
// is enabled after a user gesture. Most screens inherit a tune; these groups
// describe the last explicit request on each route.
export function musicForMode(mode, guardianState = 0, warning = false,
                             scoreReturn = 'credits') {
  if (INTERLUDE_MODES.has(mode)) return 1;
  if (LEVEL_END_MODES.has(mode)) return 2;
  const deathRoute = mode === 'death' || mode === 'deathTally'
    || mode === 'deathRestart'
    || ((mode === 'nameentry' || mode === 'hiscore') && scoreReturn === 'deathRestart');
  if (deathRoute) return null;                  // $6fdb4 stops the driver
  if (mode === 'game') {
    if (warning || guardianState === 3) return null;
    return guardianState ? 0 : 2;
  }
  // Name entry/high scores after completing the game inherit tune 2.
  if (mode === 'nameentry' || mode === 'hiscore') return 2;
  return 1;
}

// AUDxLC high/low, LEN, PER, VOL live at $a0 + channel*$10 + offset.
export function render(log, mem, base, sampleRate, tailTicks = 0) {
  const ch = [0, 1, 2, 3].map(() => ({
    lc: 0, len: 0, per: 400, vol: 0, dma: false, ptr: 0, size: 0, off: 0,
  }));
  let dmacon = 0;

  const byTick = new Map();
  let last = 0;
  for (const [t, r, v] of log) {
    if (!byTick.has(t)) byTick.set(t, []);
    byTick.get(t).push([r, v]);
    if (t > last) last = t;
  }

  const spt = sampleRate / TICK_HZ;                 // samples per driver tick
  // Paula does not stop when the driver stops writing. The capture ends at the
  // last register write, but the channel keeps fetching until DMA is cleared or
  // the sample runs into its loop - so rendering only to `last` chopped the tail
  // off every one-shot. The DANGER voice's log ends at tick 33, giving a 0.66 s
  // buffer of what is a longer sample, which is why it sounded cut off and
  // re-triggered over itself on the 10 tick timer.
  //
  // Keep the channels running past the last event and trim the silence
  // afterwards, so the buffer is as long as the sound actually is.
  const end = last + tailTicks;
  const n = Math.ceil((end + 1) * spt);
  const L = new Float32Array(n), R = new Float32Array(n);
  let cursor = 0;

  for (let t = 0; t <= end; t++) {
    for (const [r, v] of byTick.get(t) || []) {
      if (r === 0x096) {                            // DMACON
        dmacon = (v & 0x8000) ? (dmacon | (v & 0x7fff)) : (dmacon & ~(v & 0x7fff));
        for (let i = 0; i < 4; i++) {
          const on = !!(dmacon & (1 << i));
          if (on && !ch[i].dma) {                   // off -> on restarts
            ch[i].ptr = ch[i].lc;
            ch[i].size = ch[i].len * 2;
            ch[i].off = 0;
          }
          ch[i].dma = on;
        }
        continue;
      }
      const i = (r - 0xa0) >> 4, o = (r - 0xa0) & 0xf;
      if (i < 0 || i > 3) continue;
      const c = ch[i];
      if (o === 0) c.lc = ((v & 0x1ff) << 16) | (c.lc & 0xffff);
      else if (o === 2) c.lc = (c.lc & 0xffff0000) | (v & 0xffff);
      else if (o === 4) c.len = v;
      else if (o === 6) c.per = v < 124 ? 124 : v;  // Paula's floor
      else if (o === 8) c.vol = Math.min(64, v & 0x7f);
    }

    const start = Math.floor(cursor);
    const count = Math.floor(cursor + spt) - start;
    for (let i = 0; i < 4; i++) {
      const c = ch[i];
      if (!c.dma || c.size < 2 || !c.ptr) continue;
      const step = (PAL_CLOCK / c.per) / sampleRate;
      const gain = c.vol / 64 / 2;                  // two channels per side
      const dst = (i === 0 || i === 3) ? L : R;
      let { off, ptr, size } = c;
      for (let k = 0; k < count; k++) {
        const idx = ptr + (off | 0) - base;
        if (idx >= 0 && idx < mem.length) {
          const b = mem[idx];
          dst[start + k] += ((b > 127 ? b - 256 : b) / 128) * gain;
        }
        off += step;
        if (off >= size) {                          // DMA reloads LC/LEN
          off -= size;
          ptr = c.lc;
          size = c.len * 2 || size;
          // Past the end of the log there is no driver left to silence the
          // channel, so a sample that loops would sound for the whole tail.
          // One pass is the sound; the loop after it is the driver's business.
          if (t > last) { c.dma = false; break; }
        }
      }
      c.off = off; c.ptr = ptr; c.size = size;
    }
    cursor += spt;
  }
  // Trim back to the last sample that actually carries signal, so the tail is
  // the sound's own and not three seconds of silence on every effect.
  let len = Math.floor(cursor);
  const FLOOR = 1 / 4096;
  while (len > 1 && Math.abs(L[len - 1]) < FLOOR && Math.abs(R[len - 1]) < FLOOR) len--;
  return { L, R, length: Math.max(1, len) };
}

export class Audio {
  constructor(manifest, base = 'assets') {
    this.man = manifest;
    this.base = base;
    this.ctx = null;
    this.mem = null;
    this.cache = new Map();
    this.music = null;
    this.initPromise = null;
    this.live = new Set();
    this.musicSrcs = new Set();
    this.musicGen = 0;
    this.muted = false;
  }

  async init() {
    if (this.ctx && this.mem) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (!this.ctx)
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const url = this.base + '/samples.bin';
      const r = await fetch(url);
      if (!r.ok) throw new Error(`audio asset ${url}: HTTP ${r.status}`);
      try { this.mem = new Uint8Array(await r.arrayBuffer()); }
      catch (e) { throw new Error(`audio asset ${url}: ${e.message}`); }
    })();
    try { await this.initPromise; }
    catch (e) { this.initPromise = null; throw e; }
  }

  async buffer(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const url = this.base + '/snd_' + name + '.json';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`audio asset ${url}: HTTP ${response.status}`);
    let log;
    try { log = await response.json(); }
    catch (e) { throw new Error(`audio asset ${url}: ${e.message}`); }
    // Only one-shots get a tail. A TUNE's log ends where the tune ends, so
    // running the channels on past it appends whatever note was last sounding -
    // and because the tune loops, that stray note came back every time round.
    // That is the "hang" and the tune sounding like it changed mid-level.
    const { L, R, length } = render(log, this.mem, this.man.audio.sampleBase,
                                   this.ctx.sampleRate,
                                   name.startsWith('sfx') ? TICK_HZ * 3 : 0);
    // Effects were captured on channel 0, which Paula pans hard left. That is
    // a property of the capture harness, not the effect: the caller picks the
    // channel at run time as d0 = (channel << 8) | effect. Centre them so an
    // effect is not stuck in one ear; the tunes keep their real panning.
    if (name.startsWith('sfx')) {
      for (let i = 0; i < length; i++) { const m = L[i] + R[i]; L[i] = R[i] = m; }
    }
    const buf = this.ctx.createBuffer(2, Math.max(1, length), this.ctx.sampleRate);
    buf.copyToChannel(L.subarray(0, length), 0);
    buf.copyToChannel(R.subarray(0, length), 1);
    this.cache.set(name, buf);
    return buf;
  }

  // Every source goes in `live`, because play() is async: by the time a source
  // exists the caller may already have turned the sound off, and a source
  // nobody holds a reference to cannot be stopped. That is why disabling audio
  // silenced only some of what was playing.
  async play(name, { loop = false, gain = 0.7, rate = 1 } = {}) {
    await this.init();
    if (this.muted) return null;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const buf = await this.buffer(name);
    // stopAll may have run while the buffer was loading.
    if (this.muted) return null;
    const src = this.ctx.createBufferSource();
    this.live.add(src);
    // A looping source is music by construction. Keeping them in their own set
    // means stopMusic can silence one that got away - an orphan left by a race,
    // or by any path that replaced this.music without stopping it - instead of
    // only the one we happen to be holding.
    if (loop) this.musicSrcs.add(src);
    src.onended = () => {
      if (this.live) this.live.delete(src);
      if (this.musicSrcs) this.musicSrcs.delete(src);
    };
    src.buffer = buf;
    src.loop = loop;
    if (rate !== 1) src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.ctx.destination);
    src.start();
    return src;
  }

  // The driver does not cut from one tune to the next - it fades. A change is
  // out, silence, then in, which is what the guardian sequence sounds like:
  // level theme out, DANGER, boss theme in, boss theme out, the death
  // explosions, then the level theme back in under the index screen.
  //
  // Web Audio has no equivalent of the driver's volume ramp, so the music keeps
  // its own gain node and rides that instead of being started and stopped.
  MUSIC_GAIN = 0.5;

  // playMusic awaits init() and the buffer, so two calls close together both
  // reach the end and both assign this.music - leaving the first source playing
  // with nothing referencing it. That is two tunes at once that no stopMusic
  // can reach. A generation token makes the later call the only survivor.
  async playMusic(n, { fade = 700 } = {}) {
    const gen = this.musicGen = (this.musicGen || 0) + 1;
    await this.init();
    if (gen !== this.musicGen || this.muted) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const buf = await this.buffer('tune' + n);
    if (gen !== this.musicGen || this.muted) return;
    this.stopMusic(true);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = this.musicRate || 1;
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(fade ? 0 : this.MUSIC_GAIN, now);
    if (fade) g.gain.linearRampToValueAtTime(this.MUSIC_GAIN, now + fade / 1000);
    src.connect(g).connect(this.ctx.destination);
    this.live.add(src);
    this.musicSrcs.add(src);
    src.onended = () => { this.live.delete(src); this.musicSrcs.delete(src); };
    src.start();
    this.music = src;
    this.musicGain = g;
    this.musicN = n;
  }

  // Ramp down and stop once silent, so the tail is not clipped.
  fadeOutMusic(ms = 700) {
    this.musicGen = (this.musicGen || 0) + 1;      // and cancel any in flight
    if (this.musicSrcs) {
      for (const s of this.musicSrcs) if (s !== this.music) { try { s.stop(); } catch {} }
    }
    if (!this.music) return;
    const src = this.music, g = this.musicGain;
    this.music = null; this.musicGain = null; this.musicN = null;
    if (!g) { try { src.stop(); } catch {} return; }
    const now = this.ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + ms / 1000);
      src.stop(now + ms / 1000 + 0.05);
    } catch { try { src.stop(); } catch {} }
  }

  stopMusic(keepGen = false) {
    if (!keepGen) this.musicGen = (this.musicGen || 0) + 1;   // cancel any in flight
    if (this.music) { try { this.music.stop(); } catch {} }
    if (this.musicSrcs) {
      for (const s of this.musicSrcs) {
        try { s.stop(); } catch {}
        this.live.delete(s);
      }
      this.musicSrcs.clear();
    }
    this.music = null; this.musicGain = null; this.musicN = null;
  }

  // Turning the sound off has to reach everything, including sources that were
  // still loading when it happened.
  stopAll() {
    this.muted = true;
    this.stopMusic();
    if (this.live) { for (const s of this.live) { try { s.stop(); } catch {} } this.live.clear(); }
  }

  resumeAll() { this.muted = false; }

  // Debug: retime the tune without reloading it. The capture is a register
  // stream rendered at a fixed rate, so this is the knob for checking whether
  // the driver's tempo was captured correctly.
  setMusicRate(r) {
    this.musicRate = r;
    if (this.music) { try { this.music.playbackRate.value = r; } catch {} }
  }

  // Effects are named by their low byte, as the driver indexes them. $709aa
  // rotates $6e(a5) through the four channels before playing $8a, so repeated
  // explosions land on different voices instead of cutting each other off.
  // Web Audio mixes overlapping sources anyway, but the rotation is kept so the
  // gain does not stack when several fire at once.
  // $72680 `tst.b $515c4.l / bne` - the DANGER voice is on a 10 tick timer but
  // refuses to start while the previous one is still sounding, which is why a
  // long sample plays a handful of times across the guardian's arrival rather
  // than once every 10 ticks. Returns false when it declined.
  // A one-shot that refuses to start over itself. The claim is made by sfx()
  // below, so this is only the test.
  sfxOnce(n, opts = {}) {
    if (this.sfxBusy(n)) return false;
    this.sfxAll(n, opts);
    return true;
  }

  //
  // ONE source, louder - not four. Four channels carrying the same sample is
  // one sound at four times the level; four Web Audio sources are four
  // independent async loads that start milliseconds apart and phase against
  // each other, which is what turned every powerup into a stutter. Paula pans
  // 0/3 left and 1/2 right, and these buffers are already centred, so two per
  // side collapses to a single centred voice.
  sfxAll(n, opts = {}) { this.sfx(n, { ...opts, gain: 0.95 }); }

  // $730ec/$730f4 request the hatch-launch effect on channels 0 and 1. The
  // captured one-shot is centred, so one louder source is the Web Audio
  // equivalent of that stereo pair without phasey duplicate async starts.
  sfxPair(n, opts = {}) { this.sfx(n, { ...opts, gain: 0.8 }); }

  // $515c4 - is this effect still sounding? $72680 tests it BEFORE touching the
  // timer, so the countdown does not even start until the voice has finished.
  sfxBusy(n) {
    const t = this.busy && this.busy.get('sfx' + n);
    if (!t) return false;
    return t > (globalThis.performance ? performance.now() : Date.now()) / 1000;
  }

  sfx(n, { rate = 1, gain = null } = {}) {
    // $515c4 is set by the DRIVER whenever it starts a sample, not by one
    // particular caller, so the busy window is claimed here rather than in
    // sfxOnce - otherwise anything that plays an effect by another route
    // leaves the flag clear and a caller polling sfxBusy sees silence.
    // buffer() caches, so after the first play the exact length is known;
    // until then hold for a conservative second.
    const name = 'sfx' + n;
    this.busy = this.busy || new Map();
    const cached = this.cache && this.cache.get(name);
    const now = (globalThis.performance ? performance.now() : Date.now()) / 1000;
    this.busy.set(name, now + (cached ? cached.duration / rate : 1));
    this.rr = ((this.rr || 0) + 1) & 3;
    this.play('sfx' + n, { gain: gain === null ? 0.6 - this.rr * 0.05 : gain,
                           rate }).catch(() => {});
  }
}
