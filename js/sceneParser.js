// Scores a free-text scene description against cinematic archetypes using
// the NRC Word-Emotion Lexicon (6468 words) plus a small cinematic supplement
// for domain-specific words NRC doesn't cover
// Returns a musical parameter object. No external API required.

import { lexicon as nrcLexicon } from './nrcLexicon.js';

// Cinematic-specific words not well represented in NRC
const SUPPLEMENT = {
  // tense
  detective: { tense: 3 }, noir: { tense: 3 }, surveillance: { tense: 3 },
  stalker: { tense: 3 }, interrogation: { tense: 3 },
  alley: { tense: 1 }, rain: { tense: 1, melancholic: 1 },
  gritty: { tense: 1 }, bleak: { tense: 1, melancholic: 1 },
  drizzle: { tense: 1, melancholic: 1 }, overcast: { melancholic: 1 },
  fog: { tense: 1, mysterious: 1 }, foggy: { tense: 1, mysterious: 1 },
  // romantic
  lovers: { romantic: 3 }, romance: { romantic: 3 }, kiss: { romantic: 3 },
  embrace: { romantic: 3 }, dancing: { romantic: 2 }, dance: { romantic: 2 },
  sunset: { romantic: 2, peaceful: 1 }, candlelight: { romantic: 2 },
  serenade: { romantic: 3 }, candlelit: { romantic: 2 }, waltz: { romantic: 2 },
  // epic
  battle: { epic: 3 }, war: { epic: 3 }, army: { epic: 3 }, warrior: { epic: 3 },
  sword: { epic: 2 }, cavalry: { epic: 2 }, clash: { epic: 2 }, siege: { epic: 2 },
  charging: { epic: 2 }, soldiers: { epic: 2 }, troops: { epic: 2 },
  medieval: { epic: 1 }, cinematic: { epic: 1 },
  // mysterious
  ritual: { mysterious: 3 }, otherworldly: { mysterious: 3 },
  seance: { mysterious: 3 }, eerie: { mysterious: 2 },
  supernatural: { mysterious: 3 }, haunting: { mysterious: 2, melancholic: 1 },
  // peaceful
  birdsong: { peaceful: 3 }, meadow: { peaceful: 3 },
  serene: { peaceful: 3 }, tranquil: { peaceful: 3 },
  sunrise: { peaceful: 2 }, dewdrop: { peaceful: 2 },
  // melancholic
  farewell: { melancholic: 3 }, nostalgia: { melancholic: 3 },
  nostalgic: { melancholic: 3 }, bittersweet: { melancholic: 3 },
  fading: { melancholic: 2 }, twilight: { melancholic: 1, peaceful: 1 },
};

// Musical parameter presets per archetype.
// Tempos are deliberately on the brisker side so the music feels alive even
// in slower archetypes; the rhythm cells in composition.js then dial the
// density up or down with 8th and 16th subdivisions.
const PRESETS = {
  tense: {
    tempoBase: 112, tempoRange: 18,
    scale: 'phrygian_dominant',
    fmCarrier: 1, fmModulator: 2.5,
    filterType: 'highpass', filterFreq: 900,
    reverbWet: 0.25,
    rhythmDensity: 0.6,
    dynamics: 0.6,
  },
  romantic: {
    tempoBase: 92, tempoRange: 16,
    scale: 'lydian',
    fmCarrier: 1, fmModulator: 1.5,
    filterType: 'lowpass', filterFreq: 1600,
    reverbWet: 0.5,
    rhythmDensity: 0.55,
    dynamics: 0.55,
  },
  epic: {
    tempoBase: 138, tempoRange: 24,
    scale: 'hungarian_minor',
    fmCarrier: 1, fmModulator: 3.0,
    filterType: 'lowpass', filterFreq: 2400,
    reverbWet: 0.55,
    rhythmDensity: 0.85,
    dynamics: 0.9,
  },
  mysterious: {
    tempoBase: 84, tempoRange: 16,
    scale: 'octatonic',
    fmCarrier: 1, fmModulator: 4.0,
    filterType: 'bandpass', filterFreq: 800,
    reverbWet: 0.7,
    rhythmDensity: 0.4,
    dynamics: 0.5,
  },
  peaceful: {
    tempoBase: 96, tempoRange: 14,
    scale: 'pentatonic_major',
    fmCarrier: 1, fmModulator: 1.2,
    filterType: 'lowpass', filterFreq: 2000,
    reverbWet: 0.4,
    rhythmDensity: 0.55,
    dynamics: 0.55,
  },
  melancholic: {
    tempoBase: 84, tempoRange: 12,
    scale: 'harmonic_minor',
    fmCarrier: 1, fmModulator: 2.0,
    filterType: 'lowpass', filterFreq: 1200,
    reverbWet: 0.55,
    rhythmDensity: 0.5,
    dynamics: 0.5,
  },
};

const ARCHETYPES = Object.keys(PRESETS);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreArchetypes(tokens) {
  const scores = Object.fromEntries(ARCHETYPES.map(a => [a, 0]));
  for (const token of tokens) {
    const nrc = nrcLexicon[token];
    if (nrc) {
      for (const [archetype, score] of Object.entries(nrc)) {
        if (scores[archetype] !== undefined) scores[archetype] += score;
      }
    }
    const sup = SUPPLEMENT[token];
    if (sup) {
      for (const [archetype, score] of Object.entries(sup)) {
        if (scores[archetype] !== undefined) scores[archetype] += score;
      }
    }
  }
  return scores;
}

function blendParam(scores, total, field) {
  let value = 0;
  for (const [name, score] of Object.entries(scores)) {
    value += (score / total) * PRESETS[name][field];
  }
  return value;
}

export function parseScene(description) {
  const tokens = tokenize(description);
  const scores = scoreArchetypes(tokens);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  let dominant = 'tense';
  let maxScore = -1;
  for (const [name, score] of Object.entries(scores)) {
    if (score > maxScore) { maxScore = score; dominant = name; }
  }

  if (total === 0) {
    const p = PRESETS[dominant];
    return { archetype: dominant, tempo: p.tempoBase, scale: p.scale,
      fmCarrier: p.fmCarrier, fmModulator: p.fmModulator,
      filterType: p.filterType, filterFreq: p.filterFreq,
      reverbWet: p.reverbWet, rhythmDensity: p.rhythmDensity,
      dynamics: p.dynamics, scores };
  }

  const preset = PRESETS[dominant];
  return {
    archetype: dominant,
    tempo: Math.round(blendParam(scores, total, 'tempoBase') +
      (Math.random() * blendParam(scores, total, 'tempoRange') -
        blendParam(scores, total, 'tempoRange') / 2)),
    scale: preset.scale,
    fmCarrier: preset.fmCarrier,
    fmModulator: Math.round(blendParam(scores, total, 'fmModulator') * 10) / 10,
    filterType: preset.filterType,
    filterFreq: Math.round(blendParam(scores, total, 'filterFreq')),
    reverbWet: Math.round(blendParam(scores, total, 'reverbWet') * 100) / 100,
    rhythmDensity: Math.round(blendParam(scores, total, 'rhythmDensity') * 100) / 100,
    dynamics: Math.round(blendParam(scores, total, 'dynamics') * 100) / 100,
    scores,
  };
}
