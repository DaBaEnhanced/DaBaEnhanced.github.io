// Sound effects, from Sorgenti/Audio.asm (PlaySoundFX / AllocSoundFX).
//
// Paula is four independent DMA sample players, so the channel arbitration --
// not the sample playback -- is where the behaviour lives.  That part is pure
// logic and is kept separate from WebAudio so it can be tested headlessly.
//
// Per-sound fields come from the SGLD (see tools/sgld.py):
//   period      Amiga period; rate = 3546895 / period (PAL)
//   volume      0..64
//   priority    1..7
//   channelMask bits 0-3 = which of the four channels may be used,
//               bit 7    = the "alone" flag: refuse if this sound is already
//                          playing anywhere (Audio.asm tests snd_mask with bpl)
//   loop        byte offset of the loop point, 0 for one-shot
//
// Distance attenuation (AllocSoundFX takes the SQUARED distance):
//   distSq <= 32768        -> factor 64 (full volume)
//   factor = 64 - (distSq >> 15), and >= 64 means out of range entirely
//   volume = (factor * snd_volume) >> 6
// Priority is then reduced by ChgPriTable[factor], so distant sounds lose
// arbitration to near ones even at equal nominal priority.

import { fetchChecked } from './fetch.js';

const PAL_CLOCK = 3546895;
const NUM_CHANNELS = 4;

// The music runs in an AudioWorklet so it never glitches on main-thread hitches.
// The worklet source is assembled from protracker.js at run time, so the
// replayer has exactly one copy in the tree.
const WORKLET_TAIL = `
registerProcessor('mod', class extends AudioWorkletProcessor {
  constructor() {
    super();
    this.player = null;
    this.gain = 1;
    this.channels = 4;              // P61_channels + 1
    this.port.onmessage = (e) => {
      const m = e.data;
      try {
        if (m.type === 'load') {
          const mod = parseMod(new Uint8Array(m.bytes));
          this.player = new ModPlayer(mod, sampleRate);
          // P61_SetPosition: the presentation sequences start their module part
          // way in -- the ending jumps to the last pattern of the title music.
          if (m.startPos) this.player.setPosition(m.startPos);
        } else if (m.type === 'stop') this.player = null;
        else if (m.type === 'gain') this.gain = m.value;
        else if (m.type === 'channels') this.channels = m.value;
      } catch (err) {
        // An exception in here is invisible to the page: it unwinds into the
        // audio thread and the only symptom is silence. That is precisely how
        // \`TextDecoder is not defined\` survived -- AudioWorkletGlobalScope has
        // no TextDecoder, parseMod threw on every module, and nothing said so.
        this.port.postMessage({ type: 'error',
                                message: String(err && err.message || err) });
      }
    };
  }
  process(_i, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] ?? out[0];
    L.fill(0); if (R !== L) R.fill(0);
    if (this.player) {
      this.player.mix(L, R, L.length, this.channels);
      if (this.gain !== 1) {
        for (let i = 0; i < L.length; i++) { L[i] *= this.gain; R[i] *= this.gain; }
      }
    }
    return true;
  }
});
`;

// Audio.asm:ChgPriTable, indexed by the distance volume factor 0..63
const CHG_PRI = [7,
  6, 5, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** Volume factor and adjusted priority for a sound at squared distance d. */
export function attenuate(sound, distSq) {
  let factor;
  if (distSq <= 32768) factor = 64;
  else {
    factor = distSq >> 15;
    if (factor >= 64) return null;                  // too far to be heard at all
    factor = 64 - factor;
  }
  const volume = (factor * sound.volume) >> 6;
  if (volume === 0) return null;
  const priority = sound.priority - (CHG_PRI[factor] ?? 0);
  return { volume, priority, factor };
}

/**
 * Channel arbitration.  `channels[i]` is null or { sound, priority }.
 * Returns the channel index to use, or -1 to drop the sound.
 */
export function allocate(channels, sound, priority) {
  const mask = sound.channelMask & 0x0f;
  if (sound.channelMask & 0x80) {                   // "alone": one instance only
    for (const c of channels) if (c && c.sound === sound.name) return -1;
  }
  for (let i = 0; i < NUM_CHANNELS; i++) {          // a free channel wins outright
    if ((mask & (1 << i)) && !channels[i]) return i;
  }
  for (let i = 0; i < NUM_CHANNELS; i++) {          // else steal, lowest index first
    if (!(mask & (1 << i))) continue;
    if (priority >= channels[i].priority) return i;
  }
  return -1;
}

export class Audio {
  constructor(manifest, base = 'assets') {
    this.manifest = manifest;
    this.base = base;
    this.sounds = manifest.sounds;
    this.buffers = new Map();
    this.channels = new Array(NUM_CHANNELS).fill(null);
    this.ctx = null;
    this.enabled = false;
    this.rng = 0x2468;
    this.failed = [];
    this.musicError = null;
    this.musicRequest = 0;
    this.gameChannels = 4;    // P61_channels + 1 for the current screen
  }

  /** Must be called from a user gesture -- browsers will not start audio otherwise. */
  async start() {
    if (this.ctx) return this.resume();
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    // Creating a context inside a gesture is not enough on its own: under the
    // autoplay policy it can still arrive suspended, and a suspended context
    // produces silence with no error anywhere. Nothing here called resume().
    await this.resume();
    // One missing sound file used to take the whole of audio down with it:
    // preload() awaited Promise.all, a single rejection propagated out of
    // start(), the worklet was never built, and `enabled` was never set --
    // silently, because the caller had no catch. Sounds now fail one at a time.
    await this.preload();
    await this.startMusicWorklet();
    this.enabled = true;
    return true;
  }

  /** Safe to call on any later gesture; a context can be suspended again. */
  async resume() {
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* nothing more to try */ }
    }
    return this.ctx.state === 'running';
  }

  /** What is actually going on, for the HUD and for harnesses. */
  status() {
    return {
      context: this.ctx?.state ?? 'none',
      worklet: this.music ? 'ready' : 'missing',
      music: this.currentMusic ?? null,
      error: this.musicError ?? null,
      sounds: this.buffers.size,
      failed: this.failed.length,
    };
  }

  async preload() {
    const jobs = [];
    for (const [name, s] of Object.entries(this.sounds)) {
      if (!s.file || !s.file.endsWith('.raw')) continue;
      jobs.push(fetchChecked(`${this.base}/${s.file}`)
        .then((r) => r.arrayBuffer())
        .then((ab) => {
          const pcm = new Int8Array(ab);
          const buf = this.ctx.createBuffer(1, pcm.length, this.ctx.sampleRate);
          const out = buf.getChannelData(0);
          for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 128;
          this.buffers.set(name, buf);
        })
        .catch((e) => { this.failed.push(`${name}: ${e.message}`); }));
    }
    await Promise.all(jobs);
    if (this.failed.length) console.warn('sounds that did not load:', this.failed);
  }

  async startMusicWorklet() {
    try {
      // No r.ok check here used to mean a 404 handed `.text()` the server's
      // error page, which then failed to parse inside addModule with a syntax
      // error that said nothing about the real problem.
      const r = await fetchChecked('src/protracker.js');
      const src = await r.text();
      if (/^\s*</.test(src)) throw new Error('src/protracker.js returned HTML, not JS');
      const code = src.replace(/^export /gm, '') + WORKLET_TAIL;
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.music = new AudioWorkletNode(this.ctx, 'mod', { outputChannelCount: [2] });
      this.music.channelBudget = 4;
      this.music.port.onmessage = (e) => {
        if (e.data?.type !== 'error') return;
        this.musicError = `worklet: ${e.data.message}`;
        console.error('MUSIC UNAVAILABLE:', this.musicError);
      };
      // Anything thrown while the worklet's own module script runs.
      this.music.onprocessorerror = (e) => {
        this.musicError = 'the audio worklet crashed';
        console.error('MUSIC UNAVAILABLE:', this.musicError, e);
      };
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      // Through `master`, not straight to the output. The LED filter is a
      // hardware filter on Paula's analogue output -- it is not a per-voice
      // effect, and it applies to the music exactly as it does to the sound
      // effects. Wiring the music past it left it unfiltered and harsh, which
      // is what upsampling Paula's stepped output to 48kHz sounds like when
      // nothing smooths it back down.
      this.music.connect(this.musicGain).connect(this.master);
    } catch (e) {
      this.musicError = String(e && e.message ? e.message : e);
      console.error('MUSIC UNAVAILABLE:', this.musicError);
      this.music = null;
    }
  }

  /** Start a converted module by name (MUS1..MUS5, MUST, MUSL). */
  /** `startPos` is P61_SetPosition: which song position to begin at. */
  async playMusic(name, startPos = 0) {
    const request = ++this.musicRequest;
    if (!this.music || (this.currentMusic === name && this.currentPos === startPos)) return false;
    const url = `${this.base}/mods/${name}.mod`;
    let r;
    try {
      r = await fetchChecked(url);
    } catch (e) {
      if (request !== this.musicRequest) return false;
      this.musicError = e.message;
      console.error('MUSIC UNAVAILABLE:', this.musicError);
      return false;
    }
    if (request !== this.musicRequest) return false;
    const bytes = await r.arrayBuffer();
    if (request !== this.musicRequest) return false;
    this.currentMusic = name; this.currentPos = startPos;
    this.music.port.postMessage({ type: 'load', bytes, startPos }, [bytes]);
    return true;
  }

  /**
   * InitAudio2 with music playing: `FreeChannels = %1000` -- only channel 3 is
   * free -- and the music holds 0 and 1 at priority 7 (effectively unstealable)
   * and 2 at priority 2. Modelling that as real occupants is what stops sound
   * effects landing on top of the music's own voices.
   */
  reserveForMusic(on) {
    const hold = (i, priority) => {
      this.channels[i] = on ? { sound: '(music)', priority, music: true } : null;
    };
    if (on) { hold(0, 7); hold(1, 7); hold(2, 2); }
    else for (let i = 0; i < 3; i++) { if (this.channels[i]?.music) this.channels[i] = null; }
  }

  /**
   * How many Paula channels the music may use. Audio.asm:InitAudio2 sets
   * `P61_channels = 3-1` in game -- three for the music, the fourth reserved so
   * a sound effect always has somewhere to go -- and Presentation.asm sets
   * `4-1` on the title and ending screens, where there are no sound effects.
   * A sound that steals channel 2 drops it to `2-1` until the sound ends.
   */
  setMusicChannels(n) {
    const want = Math.max(1, Math.min(4, n | 0));
    if (!this.music || this.music.channelBudget === want) return;
    this.music.channelBudget = want;
    this.music.port.postMessage({ type: 'channels', value: want });
  }

  /** The budget for a screen: 3 in game, 4 where there are no sound effects. */
  setGameChannels(n) {
    this.gameChannels = Math.max(1, Math.min(4, n | 0));
    // Do not hand back a channel a sound effect is currently using.
    this.setMusicChannels(this.channels[2] && !this.channels[2].music
      ? this.gameChannels - 1 : this.gameChannels);
    this.reserveForMusic(this.gameChannels < 4);
  }

  stopMusic() {
    this.musicRequest++;
    this.currentMusic = null; this.currentPos = 0;
    this.music?.port.postMessage({ type: 'stop' });
  }

  setMusicVolume(v) {
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  /**
   * The Amiga's LED filter. `InitAudio2` switches it with bit 1 of $bfe001 --
   * clear is ON -- and FilterState defaults to 1, so it is ON unless the player
   * turns it off in the sound menu.
   *
   * The corner frequency is a property of the hardware rather than anything in
   * the source, so this is a FITTED value, not a measured one: the A1200's LED
   * filter is a two-pole Butterworth measured by others at about 3.3kHz, and
   * that is what is used here. It matters more than it looks. Paula emits
   * stepped output at 8-16kHz and the analogue filter is what smooths it; play
   * that back at 48kHz with nothing rolling it off and the aliasing is audible
   * as harshness the real machine does not have.
   */
  setFilter(on) {
    if (!this.ctx) return;
    if (!this.filterNode) {
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 3275;   // A1200 LED filter, fitted
      this.filterNode.Q.value = 0.707;
    }
    try {
      this.master.disconnect();
      this.filterNode.disconnect();
    } catch { /* not connected yet */ }
    if (on) this.master.connect(this.filterNode).connect(this.ctx.destination);
    else this.master.connect(this.ctx.destination);
    this.filterOn = !!on;
  }

  rnd(max) {
    this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
    return (this.rng >> 8) % (max + 1);
  }

  /** Follow RND and alias indirection to the entry that owns the sample. */
  resolve(name) {
    let s = this.sounds[name];
    if (!s) return null;
    if (s.type === 'RND' && s.choices) {
      const pick = s.choices[this.rnd(s.choices.length - 1)];
      s = this.sounds[pick] ?? s;
      name = pick;
    }
    const sampleName = s.alias ?? name;              // alias: same sample, own pitch
    return { ...s, name, sampleName };
  }

  /** PlaySoundFX. `distSq` is the squared world distance, 0 for global sounds. */
  play(name, distSq = 0) {
    if (!this.enabled) return -1;
    const s = this.resolve(name);
    if (!s) return -1;
    const att = attenuate(s, distSq);
    if (!att) return -1;
    const ch = allocate(this.channels, s, att.priority);
    if (ch < 0) return -1;

    const buf = this.buffers.get(s.sampleName);
    if (!buf) return -1;
    this.stopChannel(ch);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (PAL_CLOCK / s.period) / this.ctx.sampleRate;
    if (s.loop) {
      src.loop = true;
      src.loopStart = s.loop / this.ctx.sampleRate;
      src.loopEnd = buf.duration;
    }
    const gain = this.ctx.createGain();
    gain.gain.value = att.volume / 64;
    src.connect(gain).connect(this.master);
    src.start();

    const entry = { sound: s.name, priority: att.priority, src, gain, loop: !!s.loop };
    this.channels[ch] = entry;
    // A sound landing on channel 2 takes it off the music, which drops to two
    // voices until the sound is done (Audio.asm:110 and :884).
    if (ch === 2) this.setMusicChannels(this.gameChannels - 1);
    src.onended = () => {
      if (this.channels[ch] !== entry) return;
      this.channels[ch] = null;
      if (ch === 2) this.setMusicChannels(this.gameChannels);
    };
    return ch;
  }

  stopChannel(i) {
    const c = this.channels[i];
    if (!c) return;
    try { c.src.onended = null; c.src.stop(); } catch { /* already stopped */ }
    this.channels[i] = null;
  }

  /** BufferedStopSoundFX: silence a specific looping sound (the flamethrower). */
  stop(name) {
    for (let i = 0; i < NUM_CHANNELS; i++) {
      if (this.channels[i] && this.channels[i].sound === name) this.stopChannel(i);
    }
  }

  stopAll() { for (let i = 0; i < NUM_CHANNELS; i++) this.stopChannel(i); }
}
