import { generatePhrase } from './composition.js';

// Build a stereo decaying-noise impulse response for the convolver.
// This avoids needing an external IR file — fully procedural reverb.
function makeReverbIR(ctx, durationSec = 2.6, decay = 3.2) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return ir;
}

export class CinematicEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.filter = null;
    this.convolver = null;
    this.dry = null;
    this.wet = null;
    this.compressor = null;

    this.activeNodes = []; // oscillators currently scheduled, for stop()
    this.sectionTimings = [];
    this.startedAt = 0;
    this.totalDuration = 0;
    this._stopped = true;
  }

  // Derived flag: true while we're inside the scheduled playback window
  // and haven't been explicitly stopped. Single source of truth for the UI
  // — no setTimeout / wall-clock drift bugs.
  get isPlaying() {
    if (this._stopped || !this.ctx || this.startedAt === 0) return false;
    return this.ctx.currentTime < this.startedAt + this.totalDuration;
  }

  // Lazy-init: AudioContext must be created in response to a user gesture.
  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 0.7;

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
    this.master.gain.value = 0.6;

    // Wire the master bus
    this.filter.connect(this.dry);
    this.filter.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.dry.connect(this.compressor);
    this.wet.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(ctx.destination);
  }

  // Configure the master filter + reverb mix from scene params.
  applyScene(params) {
    if (!this.ctx) this.init();
    if (params.filterType) this.filter.type = params.filterType;
    if (params.filterFreq) {
      this.filter.frequency.cancelScheduledValues(this.ctx.currentTime);
      this.filter.frequency.setValueAtTime(params.filterFreq, this.ctx.currentTime);
    }
    if (params.reverbWet !== undefined) {
      this.wet.gain.setValueAtTime(params.reverbWet,        this.ctx.currentTime);
      this.dry.gain.setValueAtTime(1 - params.reverbWet * 0.5, this.ctx.currentTime);
    }
  }

  // Schedule one FM-synth note at absolute audio time `tStart`.
  scheduleNote(tStart, note, params) {
    if (!note.freq || note.velocity <= 0) return;
    const ctx = this.ctx;
    const dur = note.duration;
    const freq = note.freq * (params.transpose ?? 1);

    // ---- FM voice ----
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = freq * params.fmCarrier;

    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = freq * params.fmModulator;

    // Modulation index is *gain on the modulator output* before it sums into
    // carrier.frequency. We sweep it over time with a small envelope so the
    // timbre breathes (this is the "modulation index over time" technique
    // covered in class).
    const modGain = ctx.createGain();
    const peakIndex = freq * params.fmModulator * 0.9;
    modGain.gain.setValueAtTime(0, tStart);
    modGain.gain.linearRampToValueAtTime(peakIndex, tStart + Math.min(0.04, dur * 0.2));
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, peakIndex * 0.25), tStart + dur);

    // Voice amplitude envelope (ADSR-ish: fast attack, exponential release)
    const voiceGain = ctx.createGain();
    const attack = Math.min(0.02, dur * 0.15);
    const peakAmp = Math.max(0.001, note.velocity * 0.22);
    voiceGain.gain.setValueAtTime(0, tStart);
    voiceGain.gain.linearRampToValueAtTime(peakAmp, tStart + attack);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, tStart + dur);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(voiceGain);
    voiceGain.connect(this.filter);

    carrier.start(tStart);
    modulator.start(tStart);
    const tStop = tStart + dur + 0.05;
    carrier.stop(tStop);
    modulator.stop(tStop);

    this.activeNodes.push(carrier, modulator);
  }

  // Schedule a whole piece (output of lsystem.generatePiece).
  // Returns { startedAt, totalDuration, sectionTimings }.
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
      const phraseDur = phrase.phraseDuration * (section.lengthMul ?? 1);

      timings.push({
        index: section.index,
        type: section.type,
        startTime: cursor,
        endTime: cursor + phraseDur,
      });

      for (const note of phrase.notes) {
        this.scheduleNote(cursor + note.time, note, params);
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

  // Read current playback time (seconds since piece start). -1 if not playing.
  currentPosition() {
    if (!this.ctx || !this.isPlaying) return -1;
    return this.ctx.currentTime - this.startedAt;
  }

  // Find currently-playing section index, or -1 if none.
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
