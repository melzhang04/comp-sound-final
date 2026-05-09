// Fm synthesis audio engine built on the WebAudio API.
//
// signal chain per note:
//   modulator oscillator → modulator gain (index) ─┐
//                                                   ↓
//   carrier oscillator (freq modulated) → carrier gain → filter → reverb send → master compressor → out

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.filter = null;
    this.reverb = null;
    this.dryGain = null;
    this.wetGain = null;
    this.compressor = null;
    this.scheduledNodes = [];
    this._running = false;
  }

  async init() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    await this.ctx.resume();

    // master compressor
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.25;
    this.compressor.connect(this.ctx.destination);

    // master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.compressor);

    // reverb convolver w/ synthetic impulse
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._buildImpulse(2.5, 0.5);

    // Dry/wet mix
    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.dryGain.connect(this.masterGain);
    this.wetGain.connect(this.reverb);
    this.reverb.connect(this.masterGain);

    // filter
    this.filter = this.ctx.createBiquadFilter();
    this.filter.connect(this.dryGain);
    this.filter.connect(this.wetGain);
  }

  // builds a synthetic reverb impulse response
  _buildImpulse(durationSec, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = this.ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  // Apply scene parameters to the shared filter and reverb mix
  applyParams(params) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.filter.type = params.filterType;
    this.filter.frequency.setTargetAtTime(params.filterFreq, now, 0.1);
    this.filter.Q.value = 1.2;

    this.dryGain.gain.setTargetAtTime(1 - params.reverbWet, now, 0.1);
    this.wetGain.gain.setTargetAtTime(params.reverbWet, now, 0.1);
  }

  // schedule a single FM note
  // startTime: AudioContext time in seconds
  // freq: carrier frequency in Hz
  // duration: note duration in seconds
  // velocity: 0–1 amplitude scale
  // fmCarrier, fmModulator: ratio of carrier to modulator frequency
  _scheduleNote(startTime, freq, duration, velocity, fmCarrier, fmModulator) {
    const ctx = this.ctx;
    const modFreq = freq * fmModulator;
    const modIndex = freq * 2.5; // mod depth scales with carrier freq

    // modulator
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.type = 'sine';
    mod.frequency.value = modFreq;
    modGain.gain.setValueAtTime(0, startTime);
    modGain.gain.linearRampToValueAtTime(modIndex, startTime + 0.02);
    modGain.gain.setTargetAtTime(0, startTime + duration * 0.7, duration * 0.1);
    mod.connect(modGain);

    // carrier
    const carrier = ctx.createOscillator();
    const carrierGain = ctx.createGain();
    carrier.type = 'sine';
    carrier.frequency.value = freq * fmCarrier;

    // amplitude envelope
    const attack  = Math.min(0.04, duration * 0.1);
    const release = Math.min(0.15, duration * 0.3);
    carrierGain.gain.setValueAtTime(0, startTime);
    carrierGain.gain.linearRampToValueAtTime(velocity * 0.4, startTime + attack);
    carrierGain.gain.setTargetAtTime(velocity * 0.25, startTime + attack, duration * 0.15);
    carrierGain.gain.setValueAtTime(velocity * 0.25, startTime + duration - release);
    carrierGain.gain.linearRampToValueAtTime(0, startTime + duration);

    carrier.connect(carrierGain);
    carrierGain.connect(this.filter);

    // connect modulator frequency modulation
    modGain.connect(carrier.frequency);

    // schedule start/stop
    mod.start(startTime);
    mod.stop(startTime + duration + 0.05);
    carrier.start(startTime);
    carrier.stop(startTime + duration + 0.05);

    this.scheduledNodes.push(mod, modGain, carrier, carrierGain);
  }

  // play a full sequence of phrases built from L-system structure + composition phrases.
  // structure: [{ symbol, intensity }] from lsystem.js
  // phraseGenerator: function(intensityScale) → { notes, phraseDuration } from composition.js
  // params: musical params from sceneParser.js 
  play(structure, phraseGenerator, params) {
    if (!this.ctx || this._running) return;
    this._running = true;

    this.applyParams(params);

    let cursor = this.ctx.currentTime + 0.1; // small lead-in

    for (const { symbol, intensity } of structure) {
      if (symbol === 'r') {
        // Rest: advance cursor by one beat
        cursor += (60 / params.tempo) * 4;
        continue;
      }

      // scale dynamics and density by L-system intensity
      const scaledParams = {
        ...params,
        dynamics: params.dynamics * intensity,
        rhythmDensity: params.rhythmDensity * (0.5 + intensity * 0.5),
      };

      const { notes, phraseDuration } = phraseGenerator(scaledParams);

      for (const note of notes) {
        if (note.freq === null) continue;
        this._scheduleNote(
          cursor + note.time,
          note.freq,
          note.duration,
          note.velocity,
          params.fmCarrier,
          params.fmModulator,
        );
      }

      cursor += phraseDuration;
    }
  }

  stop() {
    if (!this.ctx || !this._running) return;
    this._running = false;

    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);

    setTimeout(() => {
      for (const node of this.scheduledNodes) {
        try { node.disconnect(); } catch (_) {}
      }
      this.scheduledNodes = [];
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    }, 400);
  }
}
