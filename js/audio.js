import { generatePhrase } from './composition.js';

function makeReverbIR(ctx, durationSec = 2.6, decay = 3.2) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  const onsetSamples = ctx.sampleRate * 0.012;
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const onset = 1 - Math.exp(-i / onsetSamples);
      const env = onset * Math.pow(1 - t, decay);
      const noise = Math.random() * 2 - 1;
      lp += 0.32 * (noise - lp);
      data[i] = lp * env;
    }
  }
  return ir;
}

const VOICE = {
  bass:      { gain: 0.22, wave: 'sine',     attack: 0.018, detune: 0,  modScale: 0.65 },
  bassPulse: { gain: 0.13, wave: 'triangle', attack: 0.006, detune: 0,  modScale: 0.9  },
  harmony:   { gain: 0.11, wave: 'triangle', attack: 0.08,  detune: 7,  modScale: 0.55 },
  ostinato:  { gain: 0.10, wave: 'square',   attack: 0.01,  detune: 0,  modScale: 1.0  },
  counter:   { gain: 0.09, wave: 'triangle', attack: 0.025, detune: -5, modScale: 0.75 },
  melody:    { gain: 0.15, wave: 'sine',     attack: 0.014, detune: 5,  modScale: 1.1  },
};

const ARCHETYPE_TEXTURE = {
  tense:       { wave: 'sawtooth', modScale: 1.25, brightness: 1.15 },
  romantic:    { wave: 'triangle', modScale: 0.72, brightness: 0.92 },
  epic:        { wave: 'sawtooth', modScale: 1.12, brightness: 1.25 },
  mysterious:  { wave: 'sine',     modScale: 1.45, brightness: 0.72 },
  peaceful:    { wave: 'sine',     modScale: 0.55, brightness: 0.85 },
  melancholic: { wave: 'triangle', modScale: 0.9,  brightness: 0.75 },
};

export class CinematicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.filter = null;
    this.convolver = null;
    this.dry = null;
    this.wet = null;
    this.compressor = null;

    this.activeNodes = [];
    this.sectionTimings = [];
    this.startedAt = 0;
    this.totalDuration = 0;
    this._stopped = true;
  }

  get isPlaying() {
    if (this._stopped || !this.ctx || this.startedAt === 0) return false;
    return this.ctx.currentTime < this.startedAt + this.totalDuration;
  }

  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 0.85;

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = makeReverbIR(ctx);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.7;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.3;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.25;

    this.master = ctx.createGain();
    this.master.gain.value = 0.58;

    this.filter.connect(this.dry);
    this.filter.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.dry.connect(this.compressor);
    this.wet.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(ctx.destination);
  }

  applyScene(params) {
    if (!this.ctx) this.init();
    if (params.filterType) this.filter.type = params.filterType;
    if (params.filterFreq) {
      this.filter.frequency.cancelScheduledValues(this.ctx.currentTime);
      this.filter.frequency.setValueAtTime(params.filterFreq, this.ctx.currentTime);
    }
    if (params.reverbWet !== undefined) {
      this.wet.gain.setValueAtTime(params.reverbWet, this.ctx.currentTime);
      this.dry.gain.setValueAtTime(1 - params.reverbWet * 0.5, this.ctx.currentTime);
    }
  }

  scheduleSectionAutomation(startTime, duration, params) {
    const texture = ARCHETYPE_TEXTURE[params.archetype] ?? ARCHETYPE_TEXTURE.tense;
    const targetFreq = Math.max(180, Math.min(8000, (params.filterFreq ?? 1600) * texture.brightness));
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, startTime);
    this.filter.frequency.linearRampToValueAtTime(targetFreq, startTime + Math.min(0.35, duration * 0.25));
  }

  scheduleNote(tStart, note, params) {
    if (!note.freq || note.velocity <= 0) return;
    const ctx = this.ctx;
    const voice = VOICE[note.voice] ?? VOICE.melody;
    const texture = ARCHETYPE_TEXTURE[params.archetype] ?? ARCHETYPE_TEXTURE.tense;
    const dur = Math.max(0.03, note.duration);
    const freq = note.freq * (params.transpose ?? 1);
    const nyquist = ctx.sampleRate / 2;
    if (freq <= 0 || freq >= nyquist) return;

    const carrier = ctx.createOscillator();
    carrier.type = voice.wave;
    carrier.frequency.value = Math.min(freq * (params.fmCarrier ?? 1), nyquist * 0.92);

    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = Math.min(freq * (params.fmModulator ?? 2), nyquist * 0.92);

    const modGain = ctx.createGain();
    const peakIndex = freq * (params.fmModulator ?? 2) * voice.modScale * texture.modScale * 0.18;
    const modAttack = Math.min(0.08, dur * 0.35);
    modGain.gain.setValueAtTime(0.0001, tStart);
    modGain.gain.linearRampToValueAtTime(Math.max(0.5, peakIndex), tStart + modAttack);
    modGain.gain.exponentialRampToValueAtTime(Math.max(0.2, peakIndex * 0.12), tStart + dur);

    const voiceGain = ctx.createGain();
    const attack = Math.max(0.012, Math.min(voice.attack, dur * 0.35));
    const release = Math.min(0.18, Math.max(0.04, dur * 0.35));
    const sustainStart = Math.max(tStart + attack, tStart + dur - release);
    const peakAmp = Math.max(0.001, Math.min(0.8, note.velocity * voice.gain));
    voiceGain.gain.setValueAtTime(0.0001, tStart);
    voiceGain.gain.linearRampToValueAtTime(peakAmp, tStart + attack);
    voiceGain.gain.setValueAtTime(peakAmp, sustainStart);
    voiceGain.gain.exponentialRampToValueAtTime(0.0008, tStart + dur);
    voiceGain.gain.linearRampToValueAtTime(0, tStart + dur + 0.04);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, note.pan ?? 0)), tStart);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(voiceGain);

    const active = [carrier, modulator];

    if (voice.detune) {
      const detuned = ctx.createOscillator();
      detuned.type = carrier.type;
      detuned.frequency.value = carrier.frequency.value;
      detuned.detune.value = voice.detune;
      detuned.connect(voiceGain);
      detuned.start(tStart);
      detuned.stop(tStart + dur + 0.08);
      active.push(detuned);
    }

    voiceGain.connect(panner);
    panner.connect(this.filter);

    carrier.start(tStart);
    modulator.start(tStart);
    const tStop = tStart + dur + 0.08;
    carrier.stop(tStop);
    modulator.stop(tStop);

    this.activeNodes.push(...active);
  }

  playPiece(piece, baseParams) {
    this.stop();
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.applyScene(baseParams);

    const startAt = this.ctx.currentTime + 0.15;
    let cursor = startAt;
    const timings = [];

    for (const { section, params } of piece.piece) {
      const phrase = generatePhrase(params);
      const lengthMul = section.lengthMul ?? 1;
      const phraseDur = phrase.phraseDuration * lengthMul;

      timings.push({
        index: section.index,
        type: section.type,
        startTime: cursor,
        endTime: cursor + phraseDur,
      });

      this.scheduleSectionAutomation(cursor, phraseDur, params);

      for (const note of phrase.notes) {
        const scaledNote = {
          ...note,
          time: note.time * lengthMul,
          duration: note.duration * lengthMul,
        };
        this.scheduleNote(cursor + scaledNote.time, scaledNote, params);
      }

      cursor += phraseDur;
    }

    this.sectionTimings = timings;
    this.startedAt = startAt;
    this.totalDuration = cursor - startAt;
    this._stopped = false;

    return {
      startedAt: this.startedAt,
      totalDuration: this.totalDuration,
      sectionTimings: this.sectionTimings,
    };
  }

  currentPosition() {
    if (!this.ctx || !this.isPlaying) return -1;
    return this.ctx.currentTime - this.startedAt;
  }

  currentSectionIndex() {
    if (!this.ctx || !this.isPlaying) return -1;
    const now = this.ctx.currentTime;
    for (const t of this.sectionTimings) {
      if (now >= t.startTime && now < t.endTime) return t.index;
    }
    return -1;
  }

  stop() {
    this._stopped = true;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const node of this.activeNodes) {
      try { node.stop(now); } catch (_) { /* already stopped */ }
    }
    this.activeNodes = [];
  }
}
