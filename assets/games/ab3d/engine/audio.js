import { radiansToSourceAngle, sourceAngleTrig } from './movement.js?v=source-fidelity-8';
import { sourceMixPair } from './paula-stream.js?v=source-fidelity-3';

export { sourceMixPair };

const PLAYER_GUN_SOUNDS = new Map([[0, 3], [1, 1], [2, 9], [3, 22], [4, 9], [7, 21]]);
const ENEMY_GUN_SOUNDS = new Map([[0, 20], [2, 9], [4, 9], [5, 9], [6, 1]]);
// anims:HitNoises enables Rock/grenade at 15,200 and the four
// ExplodeIntoBits shot sizes 50-53 at 13,50.
const PROJECTILE_HIT_SOUNDS = new Map([[2, { slot: 15, volume: 200 }],
  [4, { slot: 15, volume: 200 }],
  ...[50, 51, 52, 53].map(size => [size, { slot: 13, volume: 50 }])]);
const signedWord = value => value << 16 >> 16;

// newtwo.s:CHANNELDATA (retail abd8ch runtime $420ba) always contains eight
// four-byte records. Game setup's executable code at $3ff8-$401e writes SEQ
// of Prefsfile[1] == '4' to records 2, 3, 6 and 7, disabling exactly those
// four records in four-channel mode.
export function sourceChannelRecords(channelCount = 8) {
  return Array.from({ length: 8 }, (_, index) => ({
    enabled: channelCount !== 4 || index < 2 || (index >= 4 && index < 6),
    identity: 0,
    importance: 0,
    voice: null,
  }));
}

function findSourceChannel(records, first, count, identity, initialImportance) {
  let selected = -1;
  let importance = initialImportance;
  for (let index = first; index < first + count; index++) {
    const record = records[index];
    if (!record.enabled) continue;
    if ((record.identity & 0xff) === (identity & 0xff)) {
      selected = index;
      break;
    }
    // FindLeftChannel/FindRightChannel/FindChannel use BLT to skip a record,
    // so an equal importance replaces the earlier candidate with the later.
    if (importance < signedWord(record.importance)) continue;
    importance = signedWord(record.importance);
    selected = index;
  }
  return { selected, importance };
}

function installSourceChannel(records, index, identity, importance, side, volume) {
  const record = records[index];
  record.identity = identity & 0xff;
  record.importance = signedWord(importance);
  return { index, side, volume: volume & 0xff };
}

// Exact channel choice made after MakeSomeNoise has calculated d3/d4 and
// noiseloud. The apparently asymmetric volume writes are intentional: the
// released routine stores d3 for right channels 1 and 2 and stores d3 as the
// importance of every stereo record. NOSTEREO channel 3 also falls through
// to dorightchan, allocating a second record.
export function sourceChannelAllocations(records, volumes, identity,
  { stereo = true, suppressWhilePlaying = false } = {}) {
  if (suppressWhilePlaying && records.some(record => record.enabled &&
      (record.identity & 0xff) === (identity & 0xff))) return [];

  const allocations = [];
  const allocateRight = () => {
    const found = findSourceChannel(records, 4, 4, identity, 10000);
    if (found.selected < 0) return;
    const local = found.selected - 4;
    const rightVolume = local === 0 || local === 3 ? volumes.right : volumes.left;
    allocations.push(installSourceChannel(records, found.selected, identity,
      volumes.left, 'right', rightVolume));
  };

  if (stereo) {
    const found = findSourceChannel(records, 0, 4, identity, 32767);
    if (found.selected < 0) return allocations;
    allocations.push(installSourceChannel(records, found.selected, identity,
      volumes.left, 'left', volumes.left));
    allocateRight();
    return allocations;
  }

  const found = findSourceChannel(records, 0, 8, identity, 32767);
  if (found.selected < 0 || found.importance > signedWord(volumes.importance)) return allocations;
  const index = found.selected;
  const side = index < 4 ? 'left' : 'right';
  let volume;
  if (index < 4) volume = volumes.left;
  else volume = index === 4 || index === 7 ? volumes.right : volumes.left;
  allocations.push(installSourceChannel(records, index, identity,
    volumes.importance, side, volume));
  if (index === 3) allocateRight();
  return allocations;
}

function divsResultWord(dividend, divisor) {
  // 68000 DIVS leaves the destination register unchanged on quotient
  // overflow. Callers below subsequently consume only its low word.
  const signedDivisor = signedWord(divisor);
  if (!signedDivisor) return signedWord(dividend);
  const quotient = Math.trunc((dividend | 0) / signedDivisor);
  return quotient < -32768 || quotient > 32767
    ? signedWord(dividend) : signedWord(quotient);
}

export function pcm8ToFloat(bytes) {
  const result = new Float32Array(bytes.length);
  for (let index = 0; index < bytes.length; index++) {
    result[index] = (bytes[index] < 128 ? bytes[index] : bytes[index] - 256) / 128;
  }
  return result;
}

// The 68000 routine uses two integer Newton steps rather than a square-root
// instruction. Keep that approximation: it can differ by one at short ranges,
// which in turn changes both attenuation and stereo bias at divisor boundaries.
export function sourceDistance(x, z) {
  const sourceX = signedWord(x);
  const sourceZ = signedWord(z);
  const squared = (Math.imul(sourceX, sourceX) + Math.imul(sourceZ, sourceZ)) | 0;
  if (!squared) return 0;
  const highBit = 31 - Math.clz32(squared >>> 0);
  let distance = signedWord(1 << (highBit >> 1));
  for (let pass = 0; pass < 2; pass++) {
    const difference = (Math.imul(distance, distance) - squared) | 0;
    const correction = divsResultWord(difference >> 1, distance);
    distance = signedWord(distance - correction);
    if (distance <= 0) distance = 1;
  }
  return distance;
}

// Port of MakeSomeNoise's range law. ObjRotated supplies the source routine
// with view-relative X/Z; the caller performs that rotation for world objects.
export function sourceVolumes(x, z, noiseVolume) {
  const sourceX = signedWord(x);
  const sourceZ = signedWord(z);
  if (!sourceX && !sourceZ) return { left: 64, right: 64, importance: 32767 };
  const distance = sourceDistance(sourceX, sourceZ);
  const divisor = signedWord((distance >> 2) + 1);
  let loudness = (signedWord(noiseVolume) << 6) | 0;
  if (loudness > 32767) loudness = 32767;
  const importance = divsResultWord(loudness, divisor);
  const volume = importance > 64 ? 64 : importance;
  const panDivisor = signedWord(divisor << 3);
  const offset = divsResultWord(Math.imul(signedWord(volume), sourceX), panDivisor);
  if (offset > 0) {
    return {
      left: Math.max(0, signedWord(volume - offset)),
      right: volume,
      importance,
    };
  }
  return {
    left: volume,
    right: Math.max(0, signedWord(volume + offset)),
    importance,
  };
}

// newtwo.s:RotateObjectPts lines 4202-4241. ObjRotated stores the high word
// after shifting the camera-space X product once and its Z product twice;
// object sound handlers copy those two words directly to Noisex/Noisez.
export function sourceSoundPosition(worldX, worldZ, listener) {
  const angleUnits = Number.isInteger(listener.angleUnits)
    ? listener.angleUnits : radiansToSourceAngle(listener.angle || 0);
  const { sinWord, cosWord } = sourceAngleTrig(angleUnits);
  // xoff/zoff are the high words of the signed 16.16 player position.  For a
  // negative fractional coordinate that is floor(), not truncation toward 0.
  const dx = signedWord(Math.floor(worldX) - Math.floor(listener.x));
  const dz = signedWord(Math.floor(worldZ) - Math.floor(listener.z));
  const across = (Math.imul(dx, cosWord) - Math.imul(dz, sinWord)) | 0;
  const forward = (Math.imul(dx, sinWord) + Math.imul(dz, cosWord)) | 0;
  return {
    x: signedWord((across << 1) >> 16),
    z: signedWord((forward << 2) >> 16),
  };
}

export function soundRequestForEvent(event) {
  // playershoot.s:Player1Shot copies the player's own ObjRotated pair and ID
  // $fb for both the selected gun sample and the empty-weapon sample 12.
  if (event.type === 'shot') {
    return { slot: PLAYER_GUN_SOUNDS.get(event.gun), volume: 300,
      relativeX: 0, relativeZ: 0, identity: 0xfb };
  }
  if (event.type === 'empty-weapon') {
    return { slot: 12, volume: 300, relativeX: 0, relativeZ: 0, identity: 0xfb };
  }
  if (event.type === 'pickup') {
    // anims:ItsAMediKit/ItsAnAmmoClip/ItsABigGun take Noisex from the
    // player's ObjRotated entry, while ItsAKey writes Noisex=Noisez=0.
    // Both cases are listener-relative zero, not the pickup's world position.
    return {
      slot: event.objectType === 9 ? 11 : 4, volume: 50,
      relativeX: 0, relativeZ: 0,
      identity: event.objectId & 0xff,
    };
  }
  // newtwo.s:.inteleport writes Noisex/Noisez=0 and identity $fa.
  if (event.type === 'teleport') {
    return { slot: 26, volume: 100, relativeX: 0, relativeZ: 0, identity: 0xfa };
  }
  if (event.type === 'footstep') {
    return {
      slot: event.slot, volume: event.volume,
      relativeX: event.relativeX, relativeZ: event.relativeZ,
      identity: 0xf9,
    };
  }
  if (event.type === 'switch-operated') {
    // anims:CheckSwitches/P1_SpaceIsPressed/P2_SpaceIsPressed explicitly
    // clear Noisex and Noisez before MakeSomeNoise.
    return { slot: 10, volume: 50, relativeX: 0, relativeZ: 0,
      identity: 0xfc, suppressWhilePlaying: true };
  }
  if (event.type === 'mover-started') {
    // anims:liftwalls installs ID $fe with notifplaying set; doorwalls installs
    // ID $fd with notifplaying clear. Both explicitly use relative position 0,0.
    return event.mover === 'lift'
      ? { slot: 5, volume: 50, relativeX: 0, relativeZ: 0,
        identity: 0xfe, suppressWhilePlaying: true }
      : { slot: 5, volume: 50, relativeX: 0, relativeZ: 0, identity: 0xfd };
  }
  if (event.type === 'enemy-projectile-fired') {
    // aliencontrol.s:FireAtPlayer1 copies byte 1 of the firing object's point
    // word to IDNUM before MakeSomeNoise.
    return { slot: ENEMY_GUN_SOUNDS.get(event.gun), volume: 100,
      objectId: event.objectId, identity: event.objectId & 0xff };
  }
  if (event.type === 'projectile-impact') {
    const hit = PROJECTILE_HIT_SOUNDS.get(event.gun);
    // anims:ItsABullet uses its packed point index (the record's first word)
    // as IDNUM for every enabled HitNoises entry.
    return hit ? { ...hit, objectId: event.objectId,
      identity: event.objectId & 0xff } : null;
  }
  if (event.type === 'enemy-hitscan-hit' || event.type === 'enemy-hitscan-miss') {
    return { slot: 3, volume: 200, objectId: event.objectId,
      identity: event.objectId & 0xff };
  }
  if (event.type === 'enemy-flame-hit' || event.type === 'enemy-flame-miss') {
    return { slot: 21, volume: 200, objectId: event.objectId,
      identity: event.objectId & 0xff, oncePerTick: true };
  }
  if (event.type === 'player-damage') {
    return { slot: 19, volume: 100, relativeX: 0, relativeZ: 0, identity: 0xfb };
  }
  if (event.type === 'enemy-sound') {
    // All recovered enemy handlers write move.b 1(a0),IDNUM.
    return { slot: event.slot, volume: event.volume, objectId: event.objectId,
      identity: event.objectId & 0xff };
  }
  return null;
}

export class AudioEngine {
  static async load() {
    const response = await fetch('assets/audio/index.json');
    if (!response.ok) throw new Error(`audio manifest request failed: HTTP ${response.status}`);
    return new AudioEngine(await response.json());
  }

  constructor(manifest, preferences = {}) {
    if (manifest.format !== 'alien-breed-3d-audio-v1') {
      throw new Error(`unsupported audio manifest ${manifest.format}`);
    }
    this.manifest = manifest;
    this.samples = new Map(manifest.samples.map(sample => [sample.slot, sample]));
    this.pcmBuffers = new Map();
    this.buffers = new Map();
    this.context = null;
    this.paulaNode = null;
    this.paulaSetup = null;
    this.nextVoiceToken = 1;
    this.voices = [];
    // Unpacked retail abd8ch runtime $2a9a contains the standalone default
    // Prefsfile bytes "k4nx": four-channel and non-stereo. The original
    // external prefs loader can select the other tested allocator branches,
    // but no browser-only default is substituted here.
    this.channelCount = preferences.channelCount ?? 4;
    if (this.channelCount !== 4 && this.channelCount !== 8) {
      throw new RangeError(`unsupported source channel preference ${this.channelCount}`);
    }
    this.stereo = preferences.stereo ?? false;
    this.channelRecords = sourceChannelRecords(this.channelCount);
    this.playQueue = Promise.resolve();
    this.world = null;
    this.eventCursor = 0;
  }

  setSourcePreferences(channelCount, stereo) {
    if (channelCount !== 4 && channelCount !== 8) {
      throw new RangeError(`unsupported source channel preference ${channelCount}`);
    }
    const task = async () => {
      // Retail abd8ch $402e-$40dc disables Paula DMA before rewriting all four
      // hardware channel records when pauseopts changes STEROPT. Retire the
      // browser translations of those records before installing the new mode.
      for (const voice of this.voices) {
        if (!voice.ended) voice.source.stop();
        voice.ended = true;
      }
      this.voices = [];
      this.channelCount = channelCount;
      this.stereo = Boolean(stereo);
      this.channelRecords = sourceChannelRecords(channelCount);
      if (this.paulaNode) {
        const channelZeroFallback = channelCount === 8 ? await this.pcm(6) : null;
        this.paulaNode.port.postMessage({
          type: 'preferences', channelCount, channelZeroFallback,
        });
      }
      return { channelCount: this.channelCount, stereo: this.stereo };
    };
    const result = this.playQueue.then(task, task);
    this.playQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async unlock() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return false;
    if (!this.context) this.context = new Context();
    if (!this.paulaSetup && this.context.audioWorklet && globalThis.AudioWorkletNode) {
      this.paulaSetup = this.setupPaulaWorklet();
    }
    if (this.paulaSetup) await this.paulaSetup;
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context.state === 'running';
  }

  async setupPaulaWorklet() {
    try {
      await this.context.audioWorklet.addModule(
        new URL('./paula-worklet.js?v=source-fidelity-4', import.meta.url));
      const channelZeroFallback = this.channelCount === 8 ? await this.pcm(6) : null;
      this.paulaNode = new globalThis.AudioWorkletNode(this.context,
        'alien-breed-paula', {
          numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
          processorOptions: {
            sourceRate: this.manifest.sampleRate,
            channelCount: this.channelCount,
            channelZeroFallback,
          },
        });
      this.paulaNode.port.onmessage = event => {
        if (event.data?.type === 'ended') {
          this.finishPaulaVoice(event.data.channel, event.data.token);
        }
      };
      this.paulaNode.connect(this.context.destination);
    } catch {
      // Older Web Audio implementations retain the source-selected fallback
      // below; this is an explicitly non-Paula delivery path, not game logic.
      this.paulaNode = null;
    }
  }

  async buffer(slot) {
    if (this.buffers.has(slot)) return this.buffers.get(slot);
    const sample = this.samples.get(slot);
    if (!sample?.enabled || !sample.file || !this.context) return null;
    const promise = fetch(`assets/audio/${sample.file}`).then(async response => {
      if (!response.ok) throw new Error(`audio sample request failed: HTTP ${response.status}`);
      const floats = pcm8ToFloat(new Uint8Array(await response.arrayBuffer()));
      const rate = Math.round(this.manifest.sampleRate);
      const buffer = this.context.createBuffer(1, floats.length, rate);
      buffer.copyToChannel(floats, 0);
      return buffer;
    });
    this.buffers.set(slot, promise);
    return promise;
  }

  async pcm(slot) {
    if (this.pcmBuffers.has(slot)) return this.pcmBuffers.get(slot);
    const sample = this.samples.get(slot);
    if (!sample?.enabled || !sample.file) return null;
    const promise = fetch(`assets/audio/${sample.file}`).then(async response => {
      if (!response.ok) throw new Error(`audio sample request failed: HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    });
    this.pcmBuffers.set(slot, promise);
    return promise;
  }

  finishPaulaVoice(channel, token) {
    const record = this.channelRecords[channel];
    const voice = record?.voice;
    if (!voice || voice.token !== token) return;
    voice.ended = true;
    record.voice = null;
    record.identity = 0xff;
    record.importance = 0;
    this.voices = this.voices.filter(item => !item.ended);
  }

  process(world, listener) {
    if (this.world !== world) {
      this.world = world;
      this.eventCursor = 0;
    }
    const events = world.events.slice(this.eventCursor);
    this.eventCursor = world.events.length;
    const perTick = new Set();
    for (const event of events) {
      const request = soundRequestForEvent(event);
      if (!request || request.slot === undefined) continue;
      const key = request.oncePerTick ? `${request.slot}:${request.objectId}` : null;
      if (key && perTick.has(key)) continue;
      if (key) perTick.add(key);
      const viewRelative = request.relativeX !== undefined || request.relativeZ !== undefined;
      let x = viewRelative ? request.relativeX : request.x;
      let z = viewRelative ? request.relativeZ : request.z;
      if (request.objectId !== undefined) {
        const object = world.objects[request.objectId];
        x ??= object?.position.x;
        z ??= object?.position.z;
      }
      void this.play(request.slot, listener, x, z, request.volume,
        request.identity, request.suppressWhilePlaying, viewRelative);
    }
  }

  play(slot, listener, worldX = listener.x, worldZ = listener.z, noiseVolume = 100,
    identity = null, suppressWhilePlaying = false, viewRelative = false) {
    const task = () => this.playNow(slot, listener, worldX, worldZ, noiseVolume,
      identity, suppressWhilePlaying, viewRelative);
    const result = this.playQueue.then(task, task);
    this.playQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async playNow(slot, listener, worldX = listener.x, worldZ = listener.z, noiseVolume = 100,
    identity = null, suppressWhilePlaying = false, viewRelative = false) {
    if (!this.context || this.context.state !== 'running') return false;
    let relativeX = worldX ?? 0, relativeZ = worldZ ?? 0;
    if (!viewRelative) {
      const rotated = sourceSoundPosition(
        worldX ?? listener.x, worldZ ?? listener.z, listener);
      relativeX = rotated.x;
      relativeZ = rotated.z;
    }
    const volumes = sourceVolumes(Math.trunc(relativeX), Math.trunc(relativeZ), noiseVolume);
    if (!volumes.importance) return false;

    // The queue preserves MakeSomeNoise call order while fetches complete.
    const payload = this.paulaNode ? await this.pcm(slot) : await this.buffer(slot);
    if (!payload || !this.context || this.context.state !== 'running') return false;

    this.voices = this.voices.filter(voice => !voice.ended);
    const allocations = sourceChannelAllocations(this.channelRecords, volumes,
      identity ?? 0, { stereo: this.stereo, suppressWhilePlaying });
    if (!allocations.length) return false;

    const startAt = this.context.currentTime;
    for (const allocation of allocations) {
      const record = this.channelRecords[allocation.index];
      if (record.voice && !record.voice.ended) {
        record.voice.source.stop();
        record.voice.ended = true;
      }
      if (this.paulaNode) {
        const token = this.nextVoiceToken++;
        const voice = {
          token, importance: record.importance, identity: identity ?? 0,
          channel: allocation.index, ended: false,
          source: {
            stop: () => this.paulaNode?.port.postMessage({
              type: 'stop', channel: allocation.index, token,
            }),
          },
        };
        record.voice = voice;
        this.voices.push(voice);
        this.paulaNode.port.postMessage({
          type: 'play', channel: allocation.index, token,
          volume: allocation.volume, bytes: payload,
        });
        continue;
      }
      const source = this.context.createBufferSource();
      source.buffer = payload;
      source.playbackRate.value = this.manifest.sampleRate / payload.sampleRate;
      const gain = this.context.createGain();
      gain.gain.value = allocation.volume / 64;
      const panner = this.context.createStereoPanner();
      panner.pan.value = allocation.side === 'left' ? -1 : 1;
      source.connect(gain).connect(panner).connect(this.context.destination);
      const voice = {
        source, importance: record.importance, identity: identity ?? 0,
        channel: allocation.index, ended: false,
      };
      record.voice = voice;
      source.onended = () => {
        voice.ended = true;
        if (record.voice !== voice) return;
        record.voice = null;
        // The interrupt end handlers store $ff in identity and clear the word.
        record.identity = 0xff;
        record.importance = 0;
      };
      this.voices.push(voice);
      source.start(startAt);
    }
    this.voices = this.voices.filter(voice => !voice.ended);
    return true;
  }
}
