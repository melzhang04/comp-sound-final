import { getScaleFrequencies, getScaleSize } from './scales.js';

const ARCHETYPE = {
  tense: {
    scale: 'phrygian_dominant',
    rootHz: 146.83,
    octaves: 3,
    chordProgressions: [
      [0, 1, 0, 5],
      [0, 5, 1, 0],
      [0, 3, 5, 1],
    ],
    intervalSet: [1, 1, 1, 2, 3],
    leapSet:     [4, 5, 7],
    stepBias:    0.55,
    rhythmCells: [
      [0.5, 0.25, 0.25, 0.5, 0.5],
      [0.25, 0.25, 0.25, 0.25, 0.5, 0.5],
      [0.5, 0.5, 0.25, 0.25, 1],
      [0.25, 0.75, 0.5, 0.5],
    ],
    melodyRegister: 1,
    bassOctave:     -1,
    padVoicing:     [0, 2, 4],
  },

  romantic: {
    scale: 'lydian',
    rootHz: 174.61,
    octaves: 3,
    chordProgressions: [
      [0, 4, 5, 3],
      [0, 5, 3, 4],
      [0, 3, 4, 0],
    ],
    intervalSet: [1, 2, 2, 3, 4],
    leapSet:     [4, 5, 7],
    stepBias:    0.78,
    rhythmCells: [
      [1, 0.5, 0.5, 1, 1],
      [0.5, 0.5, 1, 0.5, 0.5, 1],
      [1.5, 0.5, 1, 1],
      [0.5, 0.5, 0.5, 0.5, 1, 1],
    ],
    melodyRegister: 1,
    bassOctave:     -1,
    padVoicing:     [0, 2, 4],
  },

  epic: {
    scale: 'hungarian_minor',
    rootHz: 110.00,
    octaves: 4,
    chordProgressions: [
      [0, 5, 3, 6],
      [0, 6, 5, 0],
      [0, 3, 0, 5],
    ],
    intervalSet: [1, 2, 3, 3, 4],
    leapSet:     [4, 5, 7, 7, 12],
    stepBias:    0.5,
    rhythmCells: [
      [0.5, 0.5, 0.5, 0.5, 1, 1],
      [0.25, 0.25, 0.5, 0.5, 0.5, 1],
      [1, 0.5, 0.5, 1, 1],
      [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 1],
    ],
    melodyRegister: 3,
    bassOctave:     -1,
    padVoicing:     [0, 2, 4],
  },

  mysterious: {
    scale: 'octatonic',
    rootHz: 130.81,
    octaves: 3,
    chordProgressions: [
      [0, 3, 6, 1],
      [0, 2, 4, 6],
      [0, 5, 0, 3],
    ],
    intervalSet: [2, 3, 3, 4],
    leapSet:     [3, 6, 9, 12],
    stepBias:    0.45,
    rhythmCells: [
      [1, 1.5, 0.5, 1],
      [2, 0.5, 0.5, 1],
      [0.25, 1.75, 1, 1],
      [0.5, 0.5, 1.5, 0.5, 1],
    ],
    melodyRegister: 2,
    bassOctave:     -1,
    padVoicing:     [0, 2, 5],
  },

  peaceful: {
    scale: 'pentatonic_major',
    rootHz: 196.00,
    octaves: 3,
    chordProgressions: [
      [0, 2, 0, 1],
      [0, 1, 2, 0],
      [0, 1, 0, 2],
    ],
    intervalSet: [1, 1, 2, 2, 3],
    leapSet:     [3, 4, 5],
    stepBias:    0.85,
    rhythmCells: [
      [1, 1, 1, 1],
      [1.5, 0.5, 1, 1],
      [0.5, 0.5, 1, 0.5, 0.5, 1],
      [2, 1, 1],
    ],
    melodyRegister: 2,
    bassOctave:     -1,
    padVoicing:     [0, 2, 4],
  },

  melancholic: {
    scale: 'harmonic_minor',
    rootHz: 174.61,
    octaves: 3,
    chordProgressions: [
      [0, 5, 3, 4],
      [0, 3, 6, 0],
      [0, 6, 5, 0],
    ],
    intervalSet: [1, 1, 2, 2, 3],
    leapSet:     [3, 4, 5, 7],
    stepBias:    0.75,
    rhythmCells: [
      [1.5, 0.5, 1, 1],
      [1, 1, 0.5, 0.5, 1],
      [2, 1, 1],
      [0.5, 0.5, 1, 0.5, 0.5, 1],
    ],
    melodyRegister: 2,
    bassOctave:     -1,
    padVoicing:     [0, 2, 4],
  },
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function getProfile(archetype) { return ARCHETYPE[archetype] ?? ARCHETYPE.tense; }

function buildChord(degree, voicing, scaleFreqs, scaleSize, baseOctave = 1) {
  return voicing.map(offset => {
    const idx = baseOctave * scaleSize + degree + offset;
    return scaleFreqs[Math.max(0, Math.min(scaleFreqs.length - 1, idx))];
  });
}

function generateBass(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord) {
  const baseOct = Math.max(0, profile.bassOctave + 1);
  return prog.map((degree, i) => {
    const idx = baseOct * scaleSize + degree;
    const f   = scaleFreqs[Math.max(0, Math.min(scaleFreqs.length - 1, idx))];
    return {
      freq:     f * 0.5,
      time:     i * beatsPerChord * beatDur,
      duration: beatsPerChord * beatDur * 0.95,
      velocity: 0.55,
      voice:    'bass',
    };
  });
}

function generateHarmony(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord) {
  const notes = [];
  for (let i = 0; i < prog.length; i++) {
    const chord = buildChord(prog[i], profile.padVoicing, scaleFreqs, scaleSize, 1);
    for (const f of chord) {
      notes.push({
        freq:     f,
        time:     i * beatsPerChord * beatDur,
        duration: beatsPerChord * beatDur * 0.9,
        velocity: 0.28,
        voice:    'harmony',
      });
    }
  }
  return notes;
}

function generateMelody(profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats, dynamics, density) {
  const notes    = [];
  const totalDur = phraseBeats * beatDur;
  const total    = scaleFreqs.length;

  let cursor  = Math.min(total - 1, profile.melodyRegister * scaleSize + prog[0]);
  let time    = 0;
  let cell    = pick(profile.rhythmCells).slice();
  let cellIdx = 0;

  while (time < totalDur) {
    if (cellIdx >= cell.length) {
      cell    = pick(profile.rhythmCells).slice();
      cellIdx = 0;
    }

    const dur = cell[cellIdx++] * beatDur;
    if (time + dur > totalDur) break;

    const isStep   = Math.random() < profile.stepBias;
    const interval = isStep ? pick(profile.intervalSet) : pick(profile.leapSet);
    const dir      = Math.random() < 0.55 ? 1 : -1;
    cursor        += interval * dir;

    // Reflect at boundaries so the line bounces rather than teleports
    if (cursor < 0)      cursor = -cursor;
    if (cursor >= total) cursor = total - (cursor - total + 1);
    cursor = Math.max(0, Math.min(total - 1, cursor));

    const restChance = Math.max(0, 0.25 - density * 0.2);
    if (Math.random() < restChance) { time += dur; continue; }

    notes.push({
      freq:     scaleFreqs[cursor],
      time,
      duration: dur * 0.92,
      velocity: Math.max(0.05, dynamics * (0.7 + Math.random() * 0.4)),
      voice:    'melody',
    });

    time += dur;
  }
  return notes;
}

export function generatePhrase(params) {
  const profile       = getProfile(params.archetype);
  const scaleSize     = getScaleSize(profile.scale);
  const scaleFreqs    = getScaleFrequencies(profile.scale, profile.rootHz, profile.octaves);
  const beatDur       = 60 / params.tempo;
  const prog          = pick(profile.chordProgressions);
  const beatsPerChord = 2;
  const phraseBeats   = prog.length * beatsPerChord;
  const phraseDuration = phraseBeats * beatDur;

  const notes = [
    ...generateBass   (profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord),
    ...generateHarmony(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord),
    ...generateMelody (profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats,
                       params.dynamics, params.rhythmDensity),
  ].sort((a, b) => a.time - b.time);

  return { notes, phraseDuration, progression: prog };
}

export { ARCHETYPE };
