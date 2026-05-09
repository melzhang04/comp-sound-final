// WebAudio FM synthesis engine. Three voices (melody, bass, pads) each
// get their own signal bus so we can treat them differently. Bass stays
// mostly dry because reverb makes low end muddy. Pads get drenched in
// reverb because that's where the cinematic space comes from. Melody
// follows whatever the scene parser decides.

const PROFILES = {
  tense: {
    fmDepth: 1.8, attack: 0.006, release: 0.08, unison: 2, detune: 5,
    vibrato: false,
    portamento: false,
    bassGain: 0.65, bassAttack: 0.008, bassRelease: 0.06,
    padFmDepth: 0.35, padMod2Ratio: 3.1, padAttack: 0.12, padRelease: 0.2, padGain: 0.18,
    modulationShape: 'standard',
    padFilterFreq: 1500,
    melodyModRatio: 2.5,
    bassType:       'pizzicato',
    padWaveType:    'strings',
    percType:       'tick',
    percFreq:       1400,
    percGain:       0.28,
  },
  romantic: {
    fmDepth: 0.5, attack: 0.18, release: 0.35, unison: 3, detune: 3,
    vibrato: true, vibratoRate: 4.5, vibratoDepth: 0.006,
    portamento: true, portamentoTime: 0.09,
    bassGain: 0.5, bassAttack: 0.1, bassRelease: 0.35,
    padFmDepth: 0.08, padMod2Ratio: 2.0, padAttack: 0.45, padRelease: 0.65, padGain: 0.2,
    modulationShape: 'string',
    padFilterFreq: 1200,
    melodyModRatio: 1.001,  // nearly-unison beating gives that violin warmth
    bassType:       'arco',
    padWaveType:    'strings',
  },
  epic: {
    fmDepth: 1.5, attack: 0.012, release: 0.12, unison: 3, detune: 8,
    vibrato: false,
    portamento: false,
    bassGain: 0.85, bassAttack: 0.015, bassRelease: 0.1,
    padFmDepth: 0.5, padMod2Ratio: 3.5, padAttack: 0.18, padRelease: 0.3, padGain: 0.22,
    modulationShape: 'brass',
    padFilterFreq: 2800,
    melodyModRatio: 1.0,    // unison mod gives the densest brass FM character
    bassType:       'tuba',
    padWaveType:    'brass',
    percType:       'boom',
    percFreq:       65,
    percGain:       0.55,
  },
  mysterious: {
    fmDepth: 3.5, attack: 0.25, release: 0.7, unison: 1, detune: 0,
    vibrato: true, vibratoRate: 2.0, vibratoDepth: 0.014,
    portamento: false,
    bassGain: 0.4, bassAttack: 0.3, bassRelease: 0.8,
    padFmDepth: 1.2, padMod2Ratio: 4.5, padAttack: 0.55, padRelease: 0.95, padGain: 0.14,
    modulationShape: 'bell',
    padFilterFreq: 900,
    melodyModRatio: 3.5,    // inharmonic ratio gives that bell/glass quality
    bassType:       'pizzicato',
    padWaveType:    'choir',
  },
  peaceful: {
    fmDepth: 0.3, attack: 0.12, release: 0.28, unison: 2, detune: 2,
    vibrato: true, vibratoRate: 4.0, vibratoDepth: 0.005,
    portamento: true, portamentoTime: 0.12,
    bassGain: 0.5, bassAttack: 0.12, bassRelease: 0.3,
    padFmDepth: 0.06, padMod2Ratio: 1.5, padAttack: 0.5, padRelease: 0.7, padGain: 0.2,
    modulationShape: 'flute',
    padFilterFreq: 1600,
    melodyModRatio: 1.0,
    bassType:       'pizzicato',
    padWaveType:    'harp',
  },
  melancholic: {
    fmDepth: 0.9, attack: 0.09, release: 0.45, unison: 2, detune: 4,
    vibrato: true, vibratoRate: 3.5, vibratoDepth: 0.008,
    portamento: false,
    bassGain: 0.55, bassAttack: 0.1, bassRelease: 0.45,
    padFmDepth: 0.2, padMod2Ratio: 2.5, padAttack: 0.4, padRelease: 0.6, padGain: 0.18,
    modulationShape: 'string',
    padFilterFreq: 1100,
    melodyModRatio: 0.999,  // sub-unison beating gives that cello richness
    bassType:       'arco',
    padWaveType:    'strings',
  },
};

function buildImpulse(ctx, durationSec = 2.8, decay = 3.5) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t   = i / length;
      const pre = i < ctx.sampleRate * 0.02 ? 0 : 1;
      data[i]   = pre * (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return ir;
}

export class AudioEngine {
  constructor() {
    this.ctx        = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverb     = null;

    this.melodyFilter = null;
    this.melodyDry    = null;
    this.melodyWet    = null;

    this.bassFilter = null;
    this.bassDry    = null;
    this.bassWet    = null;

    this.padFilter = null;
    this.padDry    = null;
    this.padWet    = null;
    this.padWaves  = {};      // keyed by type: strings, choir, harp, brass

    this.percBus     = null;
    this.noiseBuffer = null;  // pre-baked noise for percussion ticks

    this.scheduledNodes  = [];
    this._running        = false;
    this._prevMelodyFreq = null;
  }

  async init() {
    if (this.ctx) { await this.ctx.resume(); return; }

    this.ctx = new AudioContext();
    await this.ctx.resume();
    const ctx = this.ctx;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value      = 22;
    this.compressor.ratio.value     = 3.5;
    this.compressor.attack.value    = 0.004;
    this.compressor.release.value   = 0.22;
    this.compressor.connect(ctx.destination);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.72;
    this.masterGain.connect(this.compressor);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = buildImpulse(ctx);
    this.reverb.connect(this.masterGain);

    this.melodyFilter = ctx.createBiquadFilter();
    this.melodyDry    = ctx.createGain();
    this.melodyWet    = ctx.createGain();
    this.melodyFilter.connect(this.melodyDry);
    this.melodyFilter.connect(this.melodyWet);
    this.melodyDry.connect(this.masterGain);
    this.melodyWet.connect(this.reverb);

    this.bassFilter = ctx.createBiquadFilter();
    this.bassFilter.type            = 'lowpass';
    this.bassFilter.frequency.value = 500;
    this.bassFilter.Q.value         = 0.5;
    this.bassDry = ctx.createGain();
    this.bassWet = ctx.createGain();
    this.bassFilter.connect(this.bassDry);
    this.bassFilter.connect(this.bassWet);
    this.bassDry.connect(this.masterGain);
    this.bassWet.connect(this.reverb);

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type            = 'lowpass';
    this.padFilter.frequency.value = 1800;
    this.padFilter.Q.value         = 0.7;
    this.padDry = ctx.createGain();
    this.padWet = ctx.createGain();
    this.padFilter.connect(this.padDry);
    this.padFilter.connect(this.padWet);
    this.padDry.connect(this.masterGain);
    this.padWet.connect(this.reverb);

    // Percussion goes dry directly to master, no filtering needed
    this.percBus = ctx.createGain();
    this.percBus.gain.value = 1.0;
    this.percBus.connect(this.masterGain);

    // ---- Pad wavetables ----
    // Strings: 1/n harmonic falloff, warm bowed feel
    const mkWave = (imag) => {
      const r = new Float32Array(imag.length);
      const m = new Float32Array(imag);
      return ctx.createPeriodicWave(r, m, { disableNormalization: false });
    };

    this.padWaves.strings = mkWave([0, 1, 0.40, 0.15, 0.07, 0.03, 0.015, 0.007]);
    // Choir: formant boost at harmonics 3-5 gives a vowel-like quality
    this.padWaves.choir   = mkWave([0, 1, 0.45, 0.80, 0.70, 0.35, 0.14, 0.06, 0.02]);
    // Harp: brighter, more even spread before rolling off
    this.padWaves.harp    = mkWave([0, 1, 0.65, 0.38, 0.20, 0.10, 0.05, 0.025]);
    // Brass: strong even harmonics, rich and powerful
    this.padWaves.brass   = mkWave([0, 1, 0.90, 0.65, 0.45, 0.28, 0.15, 0.07, 0.03]);

    // Pre-baked 150ms noise burst for the tense percussion tick
    const noiseLen = Math.floor(ctx.sampleRate * 0.15);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;
    this.noiseBuffer = noiseBuf;
  }

  applyParams(params) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.melodyFilter.type = params.filterType;
    this.melodyFilter.frequency.setTargetAtTime(params.filterFreq, now, 0.1);
    this.melodyFilter.Q.value = 1.0;
    this.melodyDry.gain.setTargetAtTime(1 - params.reverbWet * 0.5, now, 0.1);
    this.melodyWet.gain.setTargetAtTime(params.reverbWet,           now, 0.1);

    this.bassDry.gain.setTargetAtTime(0.93, now, 0.1);
    this.bassWet.gain.setTargetAtTime(0.07, now, 0.1);

    const padWet = Math.min(0.85, params.reverbWet * 1.5);
    this.padDry.gain.setTargetAtTime(1 - padWet * 0.55, now, 0.1);
    this.padWet.gain.setTargetAtTime(padWet,             now, 0.1);

    const synthProfile = PROFILES[params.archetype] ?? PROFILES.tense;
    this.padFilter.frequency.setTargetAtTime(synthProfile.padFilterFreq ?? 1800, now, 0.15);
  }

  _scheduleMelodyNote(tStart, freq, duration, velocity, params) {
    const ctx     = this.ctx;
    const profile = PROFILES[params.archetype] ?? PROFILES.tense;
    const attack  = Math.min(profile.attack,  duration * 0.4);
    const release = Math.min(profile.release, duration * 0.5);
    const count   = profile.unison ?? 1;
    const detune  = profile.detune ?? 0;
    const gainPer = (velocity * 0.32) / count;

    for (let i = 0; i < count; i++) {
      const centOffset = count === 1 ? 0 : (i / (count - 1) - 0.5) * detune * 2;
      const voiceFreq  = freq * Math.pow(2, centOffset / 1200);

      const ampGain = ctx.createGain();
      ampGain.gain.setValueAtTime(0, tStart);
      ampGain.gain.linearRampToValueAtTime(gainPer, tStart + attack);
      ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainPer * 0.6), tStart + duration - release);
      ampGain.gain.exponentialRampToValueAtTime(0.0001, tStart + duration);

      let destination = this.melodyFilter;
      if (count > 1 && i !== Math.floor(count / 2)) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = (i / (count - 1) - 0.5) * 0.4;
        pan.connect(this.melodyFilter);
        destination = pan;
        this.scheduledNodes.push(pan);
      }

      // Per-archetype modulator ratio gives each instrument its characteristic FM timbre
      const modRatio = profile.melodyModRatio ?? params.fmModulator ?? 2;
      const modFreq  = voiceFreq * modRatio;
      const modIndex = modFreq * profile.fmDepth;

      const mod     = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.type            = 'sine';
      mod.frequency.value = modFreq;

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';

      if (profile.portamento && this._prevMelodyFreq) {
        const prevVoiceFreq = this._prevMelodyFreq * Math.pow(2, centOffset / 1200);
        carrier.frequency.setValueAtTime(prevVoiceFreq, tStart);
        carrier.frequency.linearRampToValueAtTime(voiceFreq, tStart + profile.portamentoTime);
      } else {
        carrier.frequency.setValueAtTime(voiceFreq, tStart);
      }

      const shape = profile.modulationShape ?? 'standard';
      if (shape === 'brass') {
        modGain.gain.setValueAtTime(modIndex * 2.2, tStart);
        modGain.gain.exponentialRampToValueAtTime(Math.max(0.5, modIndex * 0.5), tStart + Math.min(0.08, duration * 0.25));
        modGain.gain.exponentialRampToValueAtTime(Math.max(0.1, modIndex * 0.2), tStart + duration);
      } else if (shape === 'bell') {
        modGain.gain.setValueAtTime(modIndex * 4.0, tStart + 0.001);
        modGain.gain.exponentialRampToValueAtTime(Math.max(0.1, modIndex * 0.04), tStart + Math.min(0.25, duration * 0.4));
        modGain.gain.linearRampToValueAtTime(0.001, tStart + duration);
      } else if (shape === 'string') {
        modGain.gain.setValueAtTime(0, tStart);
        modGain.gain.linearRampToValueAtTime(modIndex * 0.5, tStart + Math.min(0.18, duration * 0.5));
        modGain.gain.linearRampToValueAtTime(modIndex * 0.4, tStart + duration);
      } else if (shape === 'flute') {
        modGain.gain.setValueAtTime(modIndex * 0.35, tStart);
        modGain.gain.linearRampToValueAtTime(modIndex * 0.65, tStart + Math.min(0.05, duration * 0.2));
        modGain.gain.linearRampToValueAtTime(modIndex * 0.4, tStart + duration);
      } else {
        modGain.gain.setValueAtTime(0, tStart);
        modGain.gain.linearRampToValueAtTime(modIndex, tStart + Math.min(0.03, duration * 0.15));
        modGain.gain.exponentialRampToValueAtTime(Math.max(1, modIndex * 0.3), tStart + duration);
      }

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(ampGain);
      ampGain.connect(destination);

      const tStop = tStart + duration + 0.06;
      carrier.start(tStart); carrier.stop(tStop);
      mod.start(tStart);     mod.stop(tStop);

      if (profile.vibrato && duration > 0.4) {
        const lfo     = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type            = 'sine';
        lfo.frequency.value = profile.vibratoRate ?? 4;
        lfoGain.gain.value  = voiceFreq * (profile.vibratoDepth ?? 0.006);
        lfo.connect(lfoGain);
        lfoGain.connect(carrier.frequency);
        const onset = tStart + Math.min(0.35, duration * 0.45);
        lfo.start(onset);
        lfo.stop(tStop);
        this.scheduledNodes.push(lfo, lfoGain);
      }

      this.scheduledNodes.push(carrier, mod, modGain, ampGain);
    }

    this._prevMelodyFreq = freq;
  }

  _scheduleBassNote(tStart, freq, duration, velocity, profile) {
    const ctx      = this.ctx;
    const bassType = profile.bassType ?? 'standard';

    if (bassType === 'pizzicato') {
      // Instant attack, fast exponential decay; plucked string character
      const carrier = ctx.createOscillator();
      carrier.type            = 'triangle';
      carrier.frequency.value = freq;

      const ampGain = ctx.createGain();
      const peak    = velocity * (profile.bassGain ?? 0.6);
      ampGain.gain.setValueAtTime(peak, tStart + 0.001);
      ampGain.gain.exponentialRampToValueAtTime(0.0001, tStart + Math.min(0.3, duration * 0.5));

      carrier.connect(ampGain);
      ampGain.connect(this.bassFilter);
      carrier.start(tStart);
      carrier.stop(tStart + duration + 0.05);
      this.scheduledNodes.push(carrier, ampGain);

    } else if (bassType === 'arco') {
      // Slow bow attack, steady sustain; cello/contrabass
      const modFreq  = freq * 2;
      const modIndex = freq * 0.12;

      const mod     = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.type            = 'sine';
      mod.frequency.value = modFreq;
      modGain.gain.setValueAtTime(0, tStart);
      modGain.gain.linearRampToValueAtTime(modIndex, tStart + 0.18);
      modGain.gain.linearRampToValueAtTime(modIndex * 0.7, tStart + duration);

      const carrier = ctx.createOscillator();
      carrier.type            = 'triangle';
      carrier.frequency.value = freq;

      const gain    = velocity * (profile.bassGain ?? 0.55);
      const release = Math.min(0.4, duration * 0.3);
      const ampGain = ctx.createGain();
      ampGain.gain.setValueAtTime(0, tStart);
      ampGain.gain.linearRampToValueAtTime(gain, tStart + 0.15);
      ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.7), tStart + duration - release);
      ampGain.gain.exponentialRampToValueAtTime(0.0001, tStart + duration);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(ampGain);
      ampGain.connect(this.bassFilter);

      const tStop = tStart + duration + 0.06;
      carrier.start(tStart); carrier.stop(tStop);
      mod.start(tStart);     mod.stop(tStop);
      this.scheduledNodes.push(carrier, mod, modGain, ampGain);

    } else if (bassType === 'tuba') {
      // Round and heavy: wider FM, slow-ish attack, fills the low end
      const modFreq  = freq * 2;
      const modIndex = freq * 0.20;

      const mod     = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.type            = 'sine';
      mod.frequency.value = modFreq;
      modGain.gain.setValueAtTime(0, tStart);
      modGain.gain.linearRampToValueAtTime(modIndex, tStart + 0.06);
      modGain.gain.exponentialRampToValueAtTime(modIndex * 0.35, tStart + duration);

      const carrier = ctx.createOscillator();
      carrier.type            = 'triangle';
      carrier.frequency.value = freq;

      const gain    = velocity * (profile.bassGain ?? 0.85);
      const ampGain = ctx.createGain();
      ampGain.gain.setValueAtTime(0, tStart);
      ampGain.gain.linearRampToValueAtTime(gain, tStart + 0.05);
      ampGain.gain.setValueAtTime(gain * 0.85, tStart + duration - 0.08);
      ampGain.gain.exponentialRampToValueAtTime(0.0001, tStart + duration);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(ampGain);
      ampGain.connect(this.bassFilter);

      const tStop = tStart + duration + 0.06;
      carrier.start(tStart); carrier.stop(tStop);
      mod.start(tStart);     mod.stop(tStop);
      this.scheduledNodes.push(carrier, mod, modGain, ampGain);

    } else {
      // Standard: triangle carrier + light FM warmth
      const modFreq  = freq * 2;
      const modIndex = freq * 0.08;

      const mod     = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.type            = 'sine';
      mod.frequency.value = modFreq;
      modGain.gain.setValueAtTime(0, tStart);
      modGain.gain.linearRampToValueAtTime(modIndex, tStart + (profile.bassAttack ?? 0.01));
      modGain.gain.exponentialRampToValueAtTime(0.001, tStart + duration);

      const carrier = ctx.createOscillator();
      carrier.type            = 'triangle';
      carrier.frequency.value = freq;

      const gain    = velocity * (profile.bassGain ?? 0.6);
      const attack  = Math.min(profile.bassAttack ?? 0.01, duration * 0.3);
      const release = Math.min(profile.bassRelease ?? 0.06, duration * 0.5);
      const ampGain = ctx.createGain();
      ampGain.gain.setValueAtTime(0, tStart);
      ampGain.gain.linearRampToValueAtTime(gain, tStart + attack);
      ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.65), tStart + duration - release);
      ampGain.gain.exponentialRampToValueAtTime(0.0001, tStart + duration);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(ampGain);
      ampGain.connect(this.bassFilter);

      const tStop = tStart + duration + 0.06;
      carrier.start(tStart); carrier.stop(tStop);
      mod.start(tStart);     mod.stop(tStop);
      this.scheduledNodes.push(carrier, mod, modGain, ampGain);
    }
  }

  _schedulePadNote(tStart, freq, duration, velocity, profile) {
    const ctx     = this.ctx;
    const attack  = Math.min(profile.padAttack,  duration * 0.5);
    const release = Math.min(profile.padRelease, duration * 0.6);
    const gain    = velocity * (profile.padGain ?? 0.18);
    const fmDepth = profile.padFmDepth ?? 0.2;

    const mod2Freq  = freq * (profile.padMod2Ratio ?? 3.0);
    const mod2Index = mod2Freq * fmDepth * 0.3;

    const mod2     = ctx.createOscillator();
    const mod2Gain = ctx.createGain();
    mod2.type            = 'sine';
    mod2.frequency.value = mod2Freq;
    mod2Gain.gain.setValueAtTime(0, tStart);
    mod2Gain.gain.linearRampToValueAtTime(mod2Index, tStart + attack * 0.5);
    mod2Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, mod2Index * 0.1), tStart + duration);

    const mod1Freq  = freq * 2;
    const mod1Index = freq * fmDepth;

    const mod1     = ctx.createOscillator();
    const mod1Gain = ctx.createGain();
    mod1.type            = 'sine';
    mod1.frequency.value = mod1Freq;
    mod1Gain.gain.setValueAtTime(0, tStart);
    mod1Gain.gain.linearRampToValueAtTime(mod1Index, tStart + attack);
    mod1Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, mod1Index * 0.15), tStart + duration);

    const carrier = ctx.createOscillator();
    const wave    = this.padWaves[profile.padWaveType ?? 'strings'] ?? this.padWaves.strings;
    if (wave) carrier.setPeriodicWave(wave);
    else      carrier.type = 'sine';
    carrier.frequency.value = freq;

    const ampGain = ctx.createGain();
    ampGain.gain.setValueAtTime(0, tStart);
    ampGain.gain.linearRampToValueAtTime(gain, tStart + attack);
    ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.75), tStart + duration - release);
    ampGain.gain.exponentialRampToValueAtTime(0.0001, tStart + duration);

    mod2.connect(mod2Gain);
    mod2Gain.connect(mod1.frequency);
    mod1.connect(mod1Gain);
    mod1Gain.connect(carrier.frequency);
    carrier.connect(ampGain);
    ampGain.connect(this.padFilter);

    const tStop = tStart + duration + 0.1;
    carrier.start(tStart); carrier.stop(tStop);
    mod1.start(tStart);    mod1.stop(tStop);
    mod2.start(tStart);    mod2.stop(tStop);

    this.scheduledNodes.push(carrier, mod1, mod2, mod1Gain, mod2Gain, ampGain);
  }

  _schedulePercussionNote(tStart, velocity, profile) {
    const ctx = this.ctx;

    if (profile.percType === 'boom') {
      // Low taiko-like boom: sine with pitch drop + fast decay
      const freq = profile.percFreq ?? 70;
      const osc  = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 1.6, tStart);
      osc.frequency.exponentialRampToValueAtTime(freq, tStart + 0.04);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime((profile.percGain ?? 0.5) * velocity, tStart);
      amp.gain.exponentialRampToValueAtTime(0.0001, tStart + 0.38);

      osc.connect(amp);
      amp.connect(this.percBus);
      osc.start(tStart);
      osc.stop(tStart + 0.42);
      this.scheduledNodes.push(osc, amp);

    } else if (profile.percType === 'tick' && this.noiseBuffer) {
      // Sharp noise burst filtered to a mid-freq band, staccato woodblock click
      const src    = ctx.createBufferSource();
      src.buffer   = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type            = 'bandpass';
      filter.frequency.value = profile.percFreq ?? 1500;
      filter.Q.value         = 4;

      const amp = ctx.createGain();
      amp.gain.setValueAtTime((profile.percGain ?? 0.25) * velocity, tStart);
      amp.gain.exponentialRampToValueAtTime(0.0001, tStart + 0.04);

      src.connect(filter);
      filter.connect(amp);
      amp.connect(this.percBus);
      src.start(tStart);
      src.stop(tStart + 0.05);
      this.scheduledNodes.push(src, filter, amp);
    }
  }

  _scheduleNote(tStart, note, params) {
    const profile = PROFILES[params.archetype] ?? PROFILES.tense;
    switch (note.voice) {
      case 'bass':        this._scheduleBassNote       (tStart, note.freq, note.duration, note.velocity, profile); break;
      case 'harmony':     this._schedulePadNote        (tStart, note.freq, note.duration, note.velocity, profile); break;
      case 'percussion':  this._schedulePercussionNote (tStart, note.velocity, profile);                           break;
      default:            this._scheduleMelodyNote     (tStart, note.freq, note.duration, note.velocity, params);  break;
    }
  }

  play(structure, phraseGenerator, params) {
    if (!this.ctx || this._running) return;
    this._running        = true;
    this._prevMelodyFreq = null;

    this.applyParams(params);
    let cursor = this.ctx.currentTime + 0.1;

    for (const { symbol, intensity } of structure) {
      if (symbol === 'r') {
        cursor += (60 / params.tempo) * 4;
        this._prevMelodyFreq = null;
        continue;
      }

      const scaledParams = {
        ...params,
        dynamics:      params.dynamics * intensity,
        rhythmDensity: params.rhythmDensity * (0.5 + intensity * 0.5),
      };

      const { notes, phraseDuration } = phraseGenerator(scaledParams);

      for (const note of notes) {
        if (note.voice !== 'percussion' && !note.freq) continue;
        this._scheduleNote(cursor + note.time, note, params);
      }

      cursor += phraseDuration;
    }
  }

  stop() {
    if (!this.ctx || !this._running) return;
    this._running        = false;
    this._prevMelodyFreq = null;

    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);

    setTimeout(() => {
      for (const node of this.scheduledNodes) {
        try { node.disconnect(); } catch (_) {}
      }
      this.scheduledNodes = [];
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(0.72, this.ctx.currentTime);
    }, 400);
  }
}
