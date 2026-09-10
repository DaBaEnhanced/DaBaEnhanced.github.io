// Live translation of the direct four-channel path in newtwo.s:fourchannel.
// Logical LEFTCHANDATA 0/1 feed Paula channels 0/3 (left output), while
// RIGHTCHANDATA 0/1 feed Paula channels 1/2 (right output). All use period 443;
// the browser sample rate conversion only repeats/advances those source bytes.

const signedByte = value => value << 24 >> 24;
const BLOCK_BYTES = 200;

// newtwo.s:newsampbitl loops 50 times over four bytes. The quieter stream is
// table-scaled by trunc((quietVolume << 6) / loudVolume), then its packed long
// is added to the louder stream as one 68000 long (including byte carries).
export function sourceMixPair(first, second, firstVolume, secondVolume) {
  if (first.length < BLOCK_BYTES || second.length < BLOCK_BYTES) {
    throw new RangeError('source mixer requires one 200-byte interrupt block');
  }
  let loud = first;
  let quiet = second;
  let loudVolume = firstVolume & 0xff;
  let quietVolume = secondVolume & 0xff;
  if (loudVolume < quietVolume) {
    [loud, quiet] = [quiet, loud];
    [loudVolume, quietVolume] = [quietVolume, loudVolume];
  }
  const ratio = loudVolume ? Math.trunc((quietVolume << 6) / loudVolume) : 0;
  const output = new Uint8Array(BLOCK_BYTES);
  for (let at = 0; at < BLOCK_BYTES; at += 4) {
    const loudLong = ((loud[at] << 24) | (loud[at + 1] << 16) |
      (loud[at + 2] << 8) | loud[at + 3]) >>> 0;
    let scaledLong = 0;
    for (let byte = 0; byte < 4; byte++) {
      const scaled = (Math.imul(signedByte(quiet[at + byte]), ratio) >> 6) & 0xff;
      scaledLong = ((scaledLong << 8) | scaled) >>> 0;
    }
    const mixed = (loudLong + scaledLong) >>> 0;
    output[at] = mixed >>> 24;
    output[at + 1] = mixed >>> 16;
    output[at + 2] = mixed >>> 8;
    output[at + 3] = mixed;
  }
  return { bytes: output, volume: loudVolume, swapped: loud !== first, ratio };
}

export class RetailPaulaFourChannel {
  constructor(outputRate, sourceRate) {
    if (!(outputRate > 0) || !(sourceRate > 0)) throw new RangeError('invalid audio rate');
    this.outputRate = outputRate;
    this.sourceRate = sourceRate;
    this.channels = Array.from({ length: 8 }, () => null);
    this.ended = [];
  }

  play(channel, bytes, volume, token) {
    if (![0, 1, 4, 5].includes(channel)) {
      throw new RangeError(`logical channel ${channel} is disabled by k4nx`);
    }
    this.channels[channel] = {
      bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      volume: volume & 0xff,
      token,
      position: 0,
      phase: 0,
    };
  }

  stop(channel, token) {
    const voice = this.channels[channel];
    if (voice?.token === token) this.channels[channel] = null;
  }

  render(frameCount) {
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    const step = this.sourceRate / this.outputRate;
    for (let frame = 0; frame < frameCount; frame++) {
      for (const channel of [0, 1, 4, 5]) {
        const voice = this.channels[channel];
        if (!voice) continue;
        const value = signedByte(voice.bytes[voice.position]) / 128 * (voice.volume / 64);
        if (channel < 4) left[frame] += value;
        else right[frame] += value;
        voice.phase += step;
        while (voice.phase >= 1) {
          voice.phase -= 1;
          voice.position++;
          if (voice.position < voice.bytes.length) continue;
          this.channels[channel] = null;
          this.ended.push({ channel, token: voice.token });
          break;
        }
      }
    }
    const ended = this.ended;
    this.ended = [];
    return { left, right, ended };
  }
}

// newtwo.s:newsampbitl combines logical pairs 0+2 and 1+3 on each side into
// four alternating 200-byte Paula buffers. End checks occur after producing a
// complete block. Initialization also points left logical channel 0 at
// SampleList slot 6 while its logical volume remains zero; all four physical
// Paula volumes already contain 63, and the zero-volume branch deliberately
// leaves that register unchanged. The same slot is reinstalled at volume 63
// whenever it ends. In the retail runtime table slot 6 is Splash.
export class RetailPaulaEightChannel {
  constructor(outputRate, sourceRate, channelZeroFallback) {
    if (!(outputRate > 0) || !(sourceRate > 0)) throw new RangeError('invalid audio rate');
    if (!(channelZeroFallback instanceof Uint8Array) ||
        !channelZeroFallback.length || channelZeroFallback.length % BLOCK_BYTES) {
      throw new RangeError('eight-channel mode requires the block-aligned slot-6 sample');
    }
    this.outputRate = outputRate;
    this.sourceRate = sourceRate;
    this.channelZeroFallback = channelZeroFallback;
    this.channels = Array.from({ length: 8 }, () => null);
    // newtwo.s initialization lines 920-943 and 999-1000: Paula channels are
    // set to volume 63 before pos0LEFT receives SampleList+6*8. vol0left is
    // still its data-section zero, so newsampbitl copies the stream without
    // writing a new hardware volume.
    this.channels[0] = {
      bytes: channelZeroFallback, volume: 0, token: null,
      position: 0, fallback: true,
    };
    this.ended = [];
    this.phase = 0;
    this.pairs = [
      { channels: [0, 2], side: 'left', bytes: null, position: BLOCK_BYTES, volume: 63 },
      { channels: [4, 6], side: 'right', bytes: null, position: BLOCK_BYTES, volume: 63 },
      { channels: [1, 3], side: 'left', bytes: null, position: BLOCK_BYTES, volume: 63 },
      { channels: [5, 7], side: 'right', bytes: null, position: BLOCK_BYTES, volume: 63 },
    ];
    this.silence = new Uint8Array(BLOCK_BYTES);
  }

  play(channel, bytes, volume, token) {
    if (channel < 0 || channel >= 8) throw new RangeError(`invalid logical channel ${channel}`);
    const sample = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!sample.length || sample.length % BLOCK_BYTES) {
      throw new RangeError('retail eight-channel samples must contain complete 200-byte blocks');
    }
    this.channels[channel] = {
      bytes: sample, volume: volume & 0xff, token, position: 0, fallback: false,
    };
  }

  stop(channel, token) {
    const voice = this.channels[channel];
    if (voice?.token === token) this.channels[channel] = null;
  }

  blockFor(channel) {
    const voice = this.channels[channel];
    return voice ? voice.bytes.subarray(voice.position, voice.position + BLOCK_BYTES) : this.silence;
  }

  finishBlock(channel) {
    const voice = this.channels[channel];
    if (!voice) return;
    voice.position += BLOCK_BYTES;
    if (voice.position < voice.bytes.length) return;
    if (!voice.fallback) this.ended.push({ channel, token: voice.token });
    if (channel === 0) {
      this.channels[0] = {
        bytes: this.channelZeroFallback, volume: 63, token: null,
        position: 0, fallback: true,
      };
    } else {
      this.channels[channel] = null;
    }
  }

  fillPair(pair) {
    const [first, second] = pair.channels;
    const firstVoice = this.channels[first];
    const secondVoice = this.channels[second];
    const mixed = sourceMixPair(this.blockFor(first), this.blockFor(second),
      firstVoice?.volume ?? 0, secondVoice?.volume ?? 0);
    pair.bytes = mixed.bytes;
    // Each fbig branch skips its Paula volume write when the louder logical
    // volume is zero. Preserve the already-programmed physical volume.
    if (mixed.volume) pair.volume = mixed.volume;
    pair.position = 0;
    this.finishBlock(first);
    this.finishBlock(second);
  }

  render(frameCount) {
    const left = new Float32Array(frameCount);
    const right = new Float32Array(frameCount);
    const step = this.sourceRate / this.outputRate;
    for (let frame = 0; frame < frameCount; frame++) {
      for (const pair of this.pairs) {
        if (pair.position >= BLOCK_BYTES) this.fillPair(pair);
        const value = signedByte(pair.bytes[pair.position]) / 128 * (pair.volume / 64);
        if (pair.side === 'left') left[frame] += value;
        else right[frame] += value;
      }
      this.phase += step;
      while (this.phase >= 1) {
        this.phase -= 1;
        for (const pair of this.pairs) pair.position++;
      }
    }
    const ended = this.ended;
    this.ended = [];
    return { left, right, ended };
  }
}
