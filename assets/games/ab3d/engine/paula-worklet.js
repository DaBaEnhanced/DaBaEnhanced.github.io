import {
  RetailPaulaEightChannel, RetailPaulaFourChannel,
} from './paula-stream.js?v=source-fidelity-3';

class AlienBreedPaulaProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const settings = options.processorOptions;
    this.sourceRate = settings.sourceRate;
    this.configure(settings.channelCount, settings.channelZeroFallback);
    this.port.onmessage = event => {
      const message = event.data;
      if (message.type === 'preferences') {
        this.configure(message.channelCount, message.channelZeroFallback);
      } else if (message.type === 'play') {
        this.mixer.play(message.channel, new Uint8Array(message.bytes),
          message.volume, message.token);
      } else if (message.type === 'stop') {
        this.mixer.stop(message.channel, message.token);
      }
    };
  }

  configure(channelCount, channelZeroFallback) {
    // pauseopts' retail $402e-$40dc path stops all Paula DMA before selecting
    // fourchannel/eightchannel, so replacing the mixer also drops old voices.
    this.mixer = channelCount === 8
      ? new RetailPaulaEightChannel(sampleRate, this.sourceRate,
        new Uint8Array(channelZeroFallback))
      : new RetailPaulaFourChannel(sampleRate, this.sourceRate);
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const rendered = this.mixer.render(output[0].length);
    output[0].set(rendered.left);
    output[1].set(rendered.right);
    for (const item of rendered.ended) this.port.postMessage({ type: 'ended', ...item });
    return true;
  }
}

registerProcessor('alien-breed-paula', AlienBreedPaulaProcessor);
