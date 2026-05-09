import { getScaleFrequencies, getScaleSize } from './scales.js';

const ARCHETYPE = {
  tense: {
    scale: 'phrygian_dominant',
    rootHz: 146.83,
    octaves: 3,
    chordProgressions: [[0, 1, 0, 5], [0, 5, 1, 0], [0, 3, 5, 1]],
    intervalSet: [1, 1, 1, 2, 3],
    leapSet: [4, 5, 7, 9],
    stepBias: 0.48,
    rhythmCells: [[0.5, 0.25, 0.25, 0.5, 0.5], [0.25, 0.25, 0.25, 0.25, 0.5, 0.5], [0.5, 0.5, 0.25, 0.25, 1], [0.25, 0.75, 0.5, 0.5]],
    melodyRegister: 1,
    bassOctave: -1,
    padVoicing: [0, 2, 4, 6],
    ostinatoPattern: [0, 1, 0, 5, 1, 0],
    ostinatoStep: 0.25,
    counterPattern: [5, 4, 2, 1],
    pulseEvery: 0.5,
  },

  romantic: {
    scale: 'lydian',
    rootHz: 174.61,
    octaves: 3,
    chordProgressions: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 0]],
    intervalSet: [1, 2, 2, 3, 4],
    leapSet: [4, 5, 7],
    stepBias: 0.78,
    rhythmCells: [[1, 0.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 1, 1]],
    melodyRegister: 2,
    bassOctave: -1,
    padVoicing: [0, 2, 4, 6],
    ostinatoPattern: [0, 2, 4, 2],
    ostinatoStep: 0.5,
    counterPattern: [4, 3, 2, 1],
    pulseEvery: 1,
  },

  epic: {
    scale: 'hungarian_minor',
    rootHz: 110.0,
    octaves: 4,
    chordProgressions: [[0, 5, 3, 6], [0, 6, 5, 0], [0, 3, 0, 5]],
    intervalSet: [1, 2, 3, 3, 4],
    leapSet: [4, 5, 7, 7, 12],
    stepBias: 0.45,
    rhythmCells: [[0.5, 0.5, 0.5, 0.5, 1, 1], [0.25, 0.25, 0.5, 0.5, 0.5, 1], [1, 0.5, 0.5, 1, 1], [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 1]],
    melodyRegister: 3,
    bassOctave: -1,
    padVoicing: [0, 2, 4, 7],
    ostinatoPattern: [0, 4, 7, 4, 5, 7, 12, 7],
    ostinatoStep: 0.25,
    counterPattern: [0, 5, 7, 12],
    pulseEvery: 0.5,
  },

  mysterious: {
    scale: 'octatonic',
    rootHz: 130.81,
    octaves: 3,
    chordProgressions: [[0, 3, 6, 1], [0, 2, 4, 6], [0, 5, 0, 3]],
    intervalSet: [2, 3, 3, 4],
    leapSet: [3, 6, 9, 12],
    stepBias: 0.42,
    rhythmCells: [[1, 1.5, 0.5, 1], [2, 0.5, 0.5, 1], [0.25, 1.75, 1, 1], [0.5, 0.5, 1.5, 0.5, 1]],
    melodyRegister: 2,
    bassOctave: -1,
    padVoicing: [0, 2, 5, 7],
    ostinatoPattern: [0, 3, 6, 3, 9, 6],
    ostinatoStep: 0.5,
    counterPattern: [6, 3, 9, 2],
    pulseEvery: 1,
  },

  peaceful: {
    scale: 'pentatonic_major',
    rootHz: 196.0,
    octaves: 3,
    chordProgressions: [[0, 2, 0, 1], [0, 1, 2, 0], [0, 1, 0, 2]],
    intervalSet: [1, 1, 2, 2, 3],
    leapSet: [3, 4, 5],
    stepBias: 0.88,
    rhythmCells: [[1, 1, 1, 1], [1.5, 0.5, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1], [2, 1, 1]],
    melodyRegister: 2,
    bassOctave: -1,
    padVoicing: [0, 2, 4],
    ostinatoPattern: [0, 2, 4, 2],
    ostinatoStep: 1,
    counterPattern: [2, 1, 0, 1],
    pulseEvery: 2,
  },

  melancholic: {
    scale: 'harmonic_minor',
    rootHz: 174.61,
    octaves: 3,
    chordProgressions: [[0, 5, 3, 4], [0, 3, 6, 0], [0, 6, 5, 0]],
    intervalSet: [1, 1, 2, 2, 3],
    leapSet: [3, 4, 5, 7],
    stepBias: 0.76,
    rhythmCells: [[1.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 1, 1], [0.5, 0.5, 1, 0.5, 0.5, 1]],
    melodyRegister: 2,
    bassOctave: -1,
    padVoicing: [0, 2, 4, 6],
    ostinatoPattern: [0, 2, 4, 2],
    ostinatoStep: 1,
    counterPattern: [6, 5, 3, 2],
    pulseEvery: 2,
  },
};

function rand() { return Math.random(); }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function getProfile(archetype) { return ARCHETYPE[archetype] ?? ARCHETYPE.tense; }

function clampIndex(idx, scaleFreqs) {
  return Math.max(0, Math.min(scaleFreqs.length - 1, idx));
}

function scaleDegreeFreq(degree, scaleFreqs, scaleSize, baseOctave = 1) {
  return scaleFreqs[clampIndex(baseOctave * scaleSize + degree, scaleFreqs)];
}

function buildChord(degree, voicing, scaleFreqs, scaleSize, baseOctave = 1) {
  return voicing.map(offset => scaleDegreeFreq(degree + offset, scaleFreqs, scaleSize, baseOctave));
}

function generateBass(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord, params) {
  const notes = [];
  const baseOct = Math.max(0, profile.bassOctave + 1);
  const density = params.rhythmDensity ?? 0.6;
  const complexity = params.complexity ?? 0.6;

  for (let i = 0; i < prog.length; i++) {
    const root = scaleDegreeFreq(prog[i], scaleFreqs, scaleSize, baseOct) * 0.5;
    const chordStart = i * beatsPerChord * beatDur;

    notes.push({
      freq: root,
      time: chordStart,
      duration: beatsPerChord * beatDur * 0.96,
      velocity: clamp(0.36 + params.dynamics * 0.28, 0.28, 0.72),
      voice: 'bass',
      pan: -0.08,
    });

    const pulseEvery = profile.pulseEvery ?? 1;
    if (density + complexity > 1.05) {
      for (let beat = 0; beat < beatsPerChord; beat += pulseEvery) {
        notes.push({
          freq: root,
          time: chordStart + beat * beatDur,
          duration: beatDur * Math.min(0.38, pulseEvery * 0.55),
          velocity: clamp(0.20 + params.dynamics * 0.22, 0.18, 0.48),
          voice: 'bassPulse',
          pan: -0.12,
        });
      }
    }
  }
  return notes;
}

function generateHarmony(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord, params) {
  const notes = [];
  for (let i = 0; i < prog.length; i++) {
    const chord = buildChord(prog[i], profile.padVoicing, scaleFreqs, scaleSize, 1);
    for (let j = 0; j < chord.length; j++) {
      notes.push({
        freq: chord[j],
        time: i * beatsPerChord * beatDur + j * 0.025,
        duration: beatsPerChord * beatDur * 0.96,
        velocity: clamp(0.12 + params.dynamics * 0.16, 0.12, 0.32),
        voice: 'harmony',
        pan: -0.25 + j * 0.14,
      });
    }
  }
  return notes;
}

function generateOstinato(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord, params) {
  const notes = [];
  const density = params.rhythmDensity ?? 0.6;
  const complexity = params.complexity ?? 0.6;
  const step = profile.ostinatoStep ?? 0.5;
  const totalBeats = prog.length * beatsPerChord;

  if (complexity < 0.45 && density < 0.55) return notes;

  let beat = 0;
  let n = 0;
  while (beat < totalBeats) {
    const chordIndex = Math.min(prog.length - 1, Math.floor(beat / beatsPerChord));
    const degree = prog[chordIndex] + profile.ostinatoPattern[n % profile.ostinatoPattern.length];
    const octave = params.archetype === 'epic' ? 2 : 1;
    const restChance = clamp(0.28 - density * 0.18 - complexity * 0.12, 0.02, 0.22);

    if (rand() > restChance) {
      notes.push({
        freq: scaleDegreeFreq(degree, scaleFreqs, scaleSize, octave),
        time: beat * beatDur,
        duration: beatDur * step * 0.78,
        velocity: clamp(0.12 + params.dynamics * 0.22, 0.12, 0.38),
        voice: 'ostinato',
        pan: 0.28,
      });
    }

    beat += step;
    n++;
  }
  return notes;
}

function generateCounterMelody(profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats, params) {
  const notes = [];
  const complexity = params.complexity ?? 0.6;
  if (complexity < 0.5) return notes;

  const stepBeats = params.archetype === 'tense' || params.archetype === 'epic' ? 1 : 2;
  let timeBeat = 0;
  let idx = 0;
  while (timeBeat < phraseBeats) {
    const chordIndex = Math.min(prog.length - 1, Math.floor(timeBeat / 2));
    const degree = prog[chordIndex] + profile.counterPattern[idx % profile.counterPattern.length];
    const duration = beatDur * stepBeats * 0.88;

    notes.push({
      freq: scaleDegreeFreq(degree, scaleFreqs, scaleSize, 1),
      time: timeBeat * beatDur,
      duration,
      velocity: clamp(0.10 + params.dynamics * 0.14, 0.10, 0.28),
      voice: 'counter',
      pan: -0.32,
    });

    timeBeat += stepBeats;
    idx++;
  }
  return notes;
}

function generateMelody(profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats, params) {
  const notes = [];
  const totalDur = phraseBeats * beatDur;
  const totalScale = scaleFreqs.length;
  const density = clamp((params.rhythmDensity ?? 0.6) + (params.complexity ?? 0.6) * 0.12, 0.1, 1);
  const dynamics = params.dynamics ?? 0.6;
  const sectionLift = params.sectionType === 'C' ? 1 : params.sectionType === 'I' ? -1 : 0;

  let cursor = Math.min(totalScale - 1, (profile.melodyRegister + sectionLift) * scaleSize + prog[0]);
  let time = 0;
  let cell = pick(profile.rhythmCells).slice();
  let cellIdx = 0;

  while (time < totalDur) {
    if (cellIdx >= cell.length) {
      cell = pick(profile.rhythmCells).slice();
      cellIdx = 0;
    }

    const beatFrac = cell[cellIdx++];
    const dur = beatFrac * beatDur;
    if (time + dur > totalDur) break;

    const extraLeapChance = params.sectionType === 'C' ? 0.12 : 0;
    const isStep = rand() < clamp(profile.stepBias - extraLeapChance, 0.25, 0.9);
    const interval = isStep ? pick(profile.intervalSet) : pick(profile.leapSet);
    const direction = rand() < 0.55 ? 1 : -1;
    cursor += interval * direction;

    if (cursor < 0) cursor = -cursor;
    if (cursor >= totalScale) cursor = totalScale - (cursor - totalScale + 1);
    cursor = clamp(cursor, 0, totalScale - 1);

    const restChance = clamp(0.22 - density * 0.18 - (params.complexity ?? 0.6) * 0.06, 0.02, 0.18);
    if (rand() < restChance) {
      time += dur;
      continue;
    }

    notes.push({
      freq: scaleFreqs[cursor],
      time,
      duration: dur * 0.92,
      velocity: clamp(dynamics * (0.62 + rand() * 0.42), 0.08, 0.9),
      voice: 'melody',
      pan: 0.06,
    });

    time += dur;
  }
  return notes;
}

export function generatePhrase(params) {
  const profile = getProfile(params.archetype);
  const scaleName = params.scale || profile.scale;
  const rootHz = profile.rootHz;
  const octaves = profile.octaves;
  const scaleSize = getScaleSize(scaleName);
  const scaleFreqs = getScaleFrequencies(scaleName, rootHz, octaves);

  const beatDur = 60 / params.tempo;
  const prog = pick(profile.chordProgressions);
  const beatsPerChord = params.sectionType === 'I' || params.sectionType === 'O' ? 3 : 2;
  const phraseBeats = prog.length * beatsPerChord;
  const phraseDuration = phraseBeats * beatDur;

  const bassNotes = generateBass(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord, params);
  const harmonyNotes = generateHarmony(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord, params);
  const melodyNotes = generateMelody(profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats, params);
  const ostinatoNotes = generateOstinato(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord, params);
  const counterNotes = generateCounterMelody(profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats, params);

  const notes = [...bassNotes, ...harmonyNotes, ...ostinatoNotes, ...counterNotes, ...melodyNotes]
    .sort((a, b) => a.time - b.time);

  return { notes, phraseDuration, progression: prog };
}

export { ARCHETYPE };
