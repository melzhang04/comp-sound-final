// WebAudio FM synthesis engine. Three voices (melody, bass, pads) each
// get their own signal bus so we can treat them differently. bass stays
// mostly dry because reverb makes low end muddy, pads get drenched in
// reverb because that's where the space comes from, melody follows
// whatever the scene parser decides.

const PROFILES = {
  tense: {
    fmDepth: 1.8, attack: 0.006, release: 0.08, unison: 2, detune: 5,
    vibrato: false,
    portamento: false,
    bassGain: 0.65, bassAttack: 0.008, bassRelease: 0.06,
    padFmDepth: 0.35, padMod2Ratio: 3.1, padAttack: 0.12, padRelease: 0.2, padGain: 0.18,
    modulationShape: 'standard',
    padFilterFreq: 1500,
  },
  romantic: {
    fmDepth: 0.5, attack: 0.18, release: 0.35, unison: 3, detune: 3,
    vibrato: true, vibratoRate: 4.5, vibratoDepth: 0.006,
    portamento: true, portamentoTime: 0.09,
    bassGain: 0.5, bassAttack: 0.1, bassRelease: 0.35,
    padFmDepth: 0.08, padMod2Ratio: 2.0, padAttack: 0.45, padRelease: 0.65, padGain: 0.2,
    modulationShape: 'string',
    padFilterFreq: 1200,
  },
  epic: {
    fmDepth: 1.5, attack: 0.012, release: 0.12, unison: 3, detune: 8,
    vibrato: false,
    portamento: false,
    bassGain: 0.85, bassAttack: 0.015, bassRelease: 0.1,
    padFmDepth: 0.5, padMod2Ratio: 3.5, padAttack: 0.18, padRelease: 0.3, padGain: 0.22,
    // brass attack: starts bright (high modulation), settles into sustain
    modulationShape: 'brass',
    padFilterFreq: 2800,
  },
  mysterious: {
    fmDepth: 3.5, attack: 0.25, release: 0.7, unison: 1, detune: 0,
    vibrato: true, vibratoRate: 2.0, vibratoDepth: 0.014,
    portamento: false,
    bassGain: 0.4, bassAttack: 0.3, bassRelease: 0.8,
    padFmDepth: 1.2, padMod2Ratio: 4.5, padAttack: 0.55, padRelease: 0.95, padGain: 0.14,
    // bell/chime: max modulation at attack, fast exponential decay
    modulationShape: 'bell',
    padFilterFreq: 900,
  },
  peaceful: {
    fmDepth: 0.3, attack: 0.12, release: 0.28, unison: 2, detune: 2,
    vibrato: true, vibratoRate: 4.0, vibratoDepth: 0.005,
    portamento: true, portamentoTime: 0.12,
    bassGain: 0.5, bassAttack: 0.12, bassRelease: 0.3,
    padFmDepth: 0.06, padMod2Ratio: 1.5, padAttack: 0.5, padRelease: 0.7, padGain: 0.2,
    // flute: near-pure tone with slight breathiness on the attack
    modulationShape: 'flute',
    padFilterFreq: 1600,
  },
  melancholic: {
    fmDepth: 0.9, attack: 0.09, release: 0.45, unison: 2, detune: 4,
    vibrato: true, vibratoRate: 3.5, vibratoDepth: 0.008,
    portamento: false,
    bassGain: 0.55, bassAttack: 0.1, bassRelease: 0.45,
    padFmDepth: 0.2, padMod2Ratio: 2.5, padAttack: 0.4, padRelease: 0.6, padGain: 0.18,
    // string: slow modulation ramp, steady bow pressure feel
    modulationShape: 'string',
    padFilterFreq: 1100,
  },
};

function buildImpulse(ctx, durationSec = 2.8, decay = 3.5) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t   = i / length;
      const pre = i < ctx.sampleRate * 0.02 ? 0 : 1; // 20ms pre-delay
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

    // Melody bus
    this.melodyFilter = null;
    this.melodyDry    = null;
    this.melodyWet    = null;

    // Bass bus
    this.bassFilter = null;
    this.bassDry    = null;
    this.bassWet    = null;

    // Pad bus
    this.padFilter = null;
    this.padDry    = null;
    this.padWet    = null;
    this.padWave   = null; // PeriodicWave for pad timbre

    this.scheduledNodes  = [];
    this._running        = false;
    this._prevMelodyFreq = null;
  }

  async init() {
    if (this.ctx) { await this.ctx.resume(); return; }

    this.ctx = new AudioContext();
    await this.ctx.resume();
    const ctx = this.ctx;

    // gentle limiting at the end of the chain — keeps things from clipping
    // without squashing the dynamics too hard
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

    // one reverb shared by all three buses — procedurally generated IR
    // with a 20ms pre-delay so it doesn't smear the attack
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = buildImpulse(ctx);
    this.reverb.connect(this.masterGain);

    // melody goes through whatever filter the scene asks for
    this.melodyFilter = ctx.createBiquadFilter();
    this.melodyDry    = ctx.createGain();
    this.melodyWet    = ctx.createGain();
    this.melodyFilter.connect(this.melodyDry);
    this.melodyFilter.connect(this.melodyWet);
    this.melodyDry.connect(this.masterGain);
    this.melodyWet.connect(this.reverb);

    // bass gets a hard LP at 500Hz — cuts the FM harmonics that make it buzzy
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

    // pads get a gentle LP just to knock off any harsh FM edges
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

    // custom waveform for the pad carrier — rolling off harmonics like a bowed string
    // feels warmer than a plain sine and less harsh than sawtooth
    const wReal = new Float32Array([0, 0,   0,    0,    0,    0,    0,    0   ]);
    const wImag = new Float32Array([0, 1, 0.4, 0.15, 0.07, 0.03, 0.015, 0.007]);
    this.padWave = ctx.createPeriodicWave(wReal, wImag, { disableNormalization: false });
  }

  applyParams(params) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.melodyFilter.type = params.filterType;
    this.melodyFilter.frequency.setTargetAtTime(params.filterFreq, now, 0.1);
    this.melodyFilter.Q.value = 1.0;
    this.melodyDry.gain.setTargetAtTime(1 - params.reverbWet * 0.5, now, 0.1);
    this.melodyWet.gain.setTargetAtTime(params.reverbWet,           now, 0.1);

    // bass stays mostly dry no matter what the scene says
    this.bassDry.gain.setTargetAtTime(0.93, now, 0.1);
    this.bassWet.gain.setTargetAtTime(0.07, now, 0.1);

    // pads get extra reverb on top of whatever the scene asks for
    const padWet = Math.min(0.85, params.reverbWet * 1.5);
    this.padDry.gain.setTargetAtTime(1 - padWet * 0.55, now, 0.1);
    this.padWet.gain.setTargetAtTime(padWet,             now, 0.1);

    // pad filter cutoff varies per archetype — epic gets bright open pads, mysterious gets dark
    const synthProfile = PROFILES[params.archetype] ?? PROFILES.tense;
    this.padFilter.frequency.setTargetAtTime(synthProfile.padFilterFreq ?? 1800, now, 0.15);
  }

  // each unison voice gets its own FM pair + panner so they spread across
  // the stereo field. portamento slides the carrier frequency from the
  // previous note — only on archetypes where it fits (romantic, peaceful)
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

      const modFreq  = voiceFreq * (params.fmModulator ?? 2);
      const modIndex = modFreq * profile.fmDepth;

      const mod     = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.type            = 'sine';
      mod.frequency.value = modFreq;

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';

      // slide from wherever we just were instead of jumping cold
      if (profile.portamento && this._prevMelodyFreq) {
        const prevVoiceFreq = this._prevMelodyFreq * Math.pow(2, centOffset / 1200);
        carrier.frequency.setValueAtTime(prevVoiceFreq, tStart);
        carrier.frequency.linearRampToValueAtTime(voiceFreq, tStart + profile.portamentoTime);
      } else {
        carrier.frequency.setValueAtTime(voiceFreq, tStart);
      }

      // Modulation envelope shape determines the timbral character
      const shape = profile.modulationShape ?? 'standard';
      if (shape === 'brass') {
        // starts overbright on the attack (like a brass tongue), settles into body
        modGain.gain.setValueAtTime(modIndex * 2.2, tStart);
        modGain.gain.exponentialRampToValueAtTime(Math.max(0.5, modIndex * 0.5), tStart + Math.min(0.08, duration * 0.25));
        modGain.gain.exponentialRampToValueAtTime(Math.max(0.1, modIndex * 0.2), tStart + duration);
      } else if (shape === 'bell') {
        // full brightness at the strike, fast exponential decay, glass/chime
        modGain.gain.setValueAtTime(modIndex * 4.0, tStart + 0.001);
        modGain.gain.exponentialRampToValueAtTime(Math.max(0.1, modIndex * 0.04), tStart + Math.min(0.25, duration * 0.4));
        modGain.gain.linearRampToValueAtTime(0.001, tStart + duration);
      } else if (shape === 'string') {
        // modulation rises slowly like a bow drawing across a string
        modGain.gain.setValueAtTime(0, tStart);
        modGain.gain.linearRampToValueAtTime(modIndex * 0.5, tStart + Math.min(0.18, duration * 0.5));
        modGain.gain.linearRampToValueAtTime(modIndex * 0.4, tStart + duration);
      } else if (shape === 'flute') {
        // slight breathiness at the start, settles to a purer tone
        modGain.gain.setValueAtTime(modIndex * 0.35, tStart);
        modGain.gain.linearRampToValueAtTime(modIndex * 0.65, tStart + Math.min(0.05, duration * 0.2));
        modGain.gain.linearRampToValueAtTime(modIndex * 0.4, tStart + duration);
      } else {
        // standard: ramp up, slight decay
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

      // vibrato kicks in after the note settles — immediate vibrato sounds cheesy
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

  // triangle wave has more body than sine at low frequencies without being
  // as harsh as sawtooth. the tiny bit of FM just adds some warmth on the attack.
  _scheduleBassNote(tStart, freq, duration, velocity, profile) {
    const ctx     = this.ctx;
    const attack  = Math.min(profile.bassAttack,  duration * 0.3);
    const release = Math.min(profile.bassRelease, duration * 0.5);
    const gain    = velocity * (profile.bassGain ?? 0.6);

    const modFreq  = freq * 2;
    const modIndex = freq * 0.08;

    const mod     = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.type            = 'sine';
    mod.frequency.value = modFreq;
    modGain.gain.setValueAtTime(0, tStart);
    modGain.gain.linearRampToValueAtTime(modIndex, tStart + attack);
    modGain.gain.exponentialRampToValueAtTime(0.001, tStart + duration);

    const carrier = ctx.createOscillator();
    carrier.type            = 'triangle';
    carrier.frequency.value = freq;

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

  // cascaded FM means the outer modulator is modulating the inner modulator,
  // not the carrier directly. this creates a more complex, evolving timbre
  // compared to basic 1-op FM — the sound shifts as the modulation decays.
  _schedulePadNote(tStart, freq, duration, velocity, profile) {
    const ctx     = this.ctx;
    const attack  = Math.min(profile.padAttack,  duration * 0.5);
    const release = Math.min(profile.padRelease, duration * 0.6);
    const gain    = velocity * (profile.padGain ?? 0.18);
    const fmDepth = profile.padFmDepth ?? 0.2;

    // outer modulator feeds into the inner modulator's frequency
    const mod2Freq  = freq * (profile.padMod2Ratio ?? 3.0);
    const mod2Index = mod2Freq * fmDepth * 0.3;

    const mod2     = ctx.createOscillator();
    const mod2Gain = ctx.createGain();
    mod2.type            = 'sine';
    mod2.frequency.value = mod2Freq;
    mod2Gain.gain.setValueAtTime(0, tStart);
    mod2Gain.gain.linearRampToValueAtTime(mod2Index, tStart + attack * 0.5);
    mod2Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, mod2Index * 0.1), tStart + duration);

    // inner modulator feeds into the carrier frequency
    const mod1Freq  = freq * 2;
    const mod1Index = freq * fmDepth;

    const mod1     = ctx.createOscillator();
    const mod1Gain = ctx.createGain();
    mod1.type            = 'sine';
    mod1.frequency.value = mod1Freq;
    mod1Gain.gain.setValueAtTime(0, tStart);
    mod1Gain.gain.linearRampToValueAtTime(mod1Index, tStart + attack);
    mod1Gain.gain.exponentialRampToValueAtTime(Math.max(0.001, mod1Index * 0.15), tStart + duration);

    // carrier uses the warm wavetable defined in init()
    const carrier = ctx.createOscillator();
    if (this.padWave) {
      carrier.setPeriodicWave(this.padWave);
    } else {
      carrier.type = 'sine';
    }
    carrier.frequency.value = freq;

    const ampGain = ctx.createGain();
    ampGain.gain.setValueAtTime(0, tStart);
    ampGain.gain.linearRampToValueAtTime(gain, tStart + attack);
    ampGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.75), tStart + duration - release);
    ampGain.gain.exponentialRampToValueAtTime(0.0001, tStart + duration);

    // wire up the cascade
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

  // route each note to the right voice based on what composition.js tagged it as
  _scheduleNote(tStart, note, params) {
    const profile = PROFILES[params.archetype] ?? PROFILES.tense;
    switch (note.voice) {
      case 'bass':    this._scheduleBassNote   (tStart, note.freq, note.duration, note.velocity, profile); break;
      case 'harmony': this._schedulePadNote    (tStart, note.freq, note.duration, note.velocity, profile); break;
      default:        this._scheduleMelodyNote (tStart, note.freq, note.duration, note.velocity, params);  break;
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
        this._prevMelodyFreq = null; // don't slide across a rest
        continue;
      }

      const scaledParams = {
        ...params,
        dynamics:      params.dynamics * intensity,
        rhythmDensity: params.rhythmDensity * (0.5 + intensity * 0.5),
      };

      const { notes, phraseDuration } = phraseGenerator(scaledParams);

      for (const note of notes) {
        if (!note.freq) continue;
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
