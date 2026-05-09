// Scores a free-text scene description against cinematic archetypes using
// the NRC Word-Emotion Lexicon (6468 words) plus a small cinematic supplement
// for domain-specific words NRC doesn't cover.
// Direct-modifier layer adjusts continuous params (tempo, dynamics, etc.)
// without requiring an archetype signal. No external API required.

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

// Genre/style keywords → direct overrides applied on top of blended params.
// Each entry is a partial params object merged after blending.
const GENRE_OVERRIDES = {
  jazz:       { scaleOverride: 'lydian_dominant', rhythmDensity: 0.65, reverbWet: 0.3,  swingFeel: true  },
  jazzy:      { scaleOverride: 'lydian_dominant', rhythmDensity: 0.6,  reverbWet: 0.3,  swingFeel: true  },
  bebop:      { scaleOverride: 'lydian_dominant', rhythmDensity: 0.85, reverbWet: 0.2,  swingFeel: true  },
  swing:      { scaleOverride: 'lydian_dominant', rhythmDensity: 0.7,  reverbWet: 0.35, swingFeel: true  },
  blues:      { scaleOverride: 'pentatonic_minor', rhythmDensity: 0.55, reverbWet: 0.35, dynamics: 0.65  },
  bluesy:     { scaleOverride: 'pentatonic_minor', rhythmDensity: 0.5,  reverbWet: 0.35                  },
  gospel:     { scaleOverride: 'pentatonic_major', rhythmDensity: 0.7,  dynamics: 0.75                   },
  folk:       { scaleOverride: 'major',            rhythmDensity: 0.45, reverbWet: 0.3                   },
  lullaby:    { scaleOverride: 'major',            tempoMult: 0.7,      rhythmDensity: 0.3, reverbWet: 0.5},
  march:      { scaleOverride: 'major',            tempoMult: 1.15,     rhythmDensity: 0.9, dynamics: 0.8 },
  hymn:       { scaleOverride: 'major',            tempoMult: 0.75,     rhythmDensity: 0.3, reverbWet: 0.6},
  tango:      { scaleOverride: 'harmonic_minor',   tempoMult: 1.1,      rhythmDensity: 0.75, dynamics: 0.7},
  flamenco:   { scaleOverride: 'phrygian_dominant',rhythmDensity: 0.8,  dynamics: 0.75                   },
  orchestral: { reverbWet: 0.65, dynamics: 0.8, rhythmDensity: 0.7                                       },
  ambient:    { tempoMult: 0.7,  rhythmDensity: 0.2, reverbWet: 0.8,   dynamics: 0.35                    },
  electronic: { fmModulator: 4.5, filterFreq: 2000, rhythmDensity: 0.8                                   },
  minimal:    { rhythmDensity: 0.2, reverbWet: 0.55, dynamics: 0.35                                      },
};

// Direct param modifiers — descriptive words that adjust continuous params
// without changing the archetype. Values are deltas applied after blending.
const MODIFIERS = {
  // Tempo
  fast:      { tempoDelta:  18 }, quick:     { tempoDelta:  14 }, rapid:     { tempoDelta:  16 },
  frantic:   { tempoDelta:  22 }, rushing:   { tempoDelta:  14 }, hurried:   { tempoDelta:  12 },
  slow:      { tempoDelta: -16 }, slowly:    { tempoDelta: -14 }, sluggish:  { tempoDelta: -10 },
  languid:   { tempoDelta: -14 }, leisurely: { tempoDelta: -10 }, dragging:  { tempoDelta: -12 },
  plodding:  { tempoDelta: -18 }, crawling:  { tempoDelta: -20 }, gradual:   { tempoDelta: -8  },
  // Dynamics
  loud:      { dynamicsDelta:  0.2  }, thunderous: { dynamicsDelta:  0.25 },
  powerful:  { dynamicsDelta:  0.15 }, intense:    { dynamicsDelta:  0.15 },
  booming:   { dynamicsDelta:  0.2  }, roaring:    { dynamicsDelta:  0.2  },
  quiet:     { dynamicsDelta: -0.2  }, soft:       { dynamicsDelta: -0.15 },
  gentle:    { dynamicsDelta: -0.15 }, hushed:     { dynamicsDelta: -0.2  },
  whispered: { dynamicsDelta: -0.25 }, faint:      { dynamicsDelta: -0.2  },
  muted:     { dynamicsDelta: -0.15 }, delicate:   { dynamicsDelta: -0.1  },
  // Rhythm density
  sparse:    { densityDelta: -0.25 }, empty:      { densityDelta: -0.2  },
  spacious:  { densityDelta: -0.15 }, sparse:     { densityDelta: -0.2  },
  busy:      { densityDelta:  0.2  }, dense:      { densityDelta:  0.2  },
  frenzied:  { densityDelta:  0.25 }, flurry:     { densityDelta:  0.2  },
  // Filter / tone color
  bright:    { filterFreqMult: 1.5  }, crisp:     { filterFreqMult: 1.35 },
  sharp:     { filterFreqMult: 1.4  }, clear:     { filterFreqMult: 1.25 },
  dark:      { filterFreqMult: 0.5  }, murky:     { filterFreqMult: 0.4  },
  muddy:     { filterFreqMult: 0.45 }, warm:      { filterFreqMult: 0.7  },
  muffled:   { filterFreqMult: 0.55 }, deep:      { filterFreqMult: 0.6  },
  hollow:    { filterFreqMult: 0.65 }, thin:      { filterFreqMult: 1.3  },
  // Reverb / space
  cavernous: { reverbDelta:  0.25 }, vast:      { reverbDelta:  0.2  },
  spacious:  { reverbDelta:  0.15 }, open:      { reverbDelta:  0.1  },
  expansive: { reverbDelta:  0.2  }, distant:   { reverbDelta:  0.2  },
  intimate:  { reverbDelta: -0.15 }, close:     { reverbDelta: -0.1  },
  dry:       { reverbDelta: -0.2  }, anechoic:  { reverbDelta: -0.25 },
  // FM modulation / timbre
  metallic:  { fmModDelta:  2.0 }, harsh:     { fmModDelta:  1.5 },
  buzzing:   { fmModDelta:  1.5 }, abrasive:  { fmModDelta:  2.0 },
  glassy:    { fmModDelta: -0.5 }, smooth:    { fmModDelta: -0.5 },
  pure:      { fmModDelta: -1.0 }, clean:     { fmModDelta: -0.5 },
};

// Musical parameter presets per archetype
const PRESETS = {
  tense: {
    tempoBase: 68, tempoRange: 16,
    scale: 'phrygian',
    fmCarrier: 1, fmModulator: 2.5,
    filterType: 'highpass', filterFreq: 900,
    reverbWet: 0.25,
    rhythmDensity: 0.3,
    dynamics: 0.55,
  },
  romantic: {
    tempoBase: 64, tempoRange: 14,
    scale: 'major',
    fmCarrier: 1, fmModulator: 1.5,
    filterType: 'lowpass', filterFreq: 1400,
    reverbWet: 0.5,
    rhythmDensity: 0.5,
    dynamics: 0.5,
  },
  epic: {
    tempoBase: 118, tempoRange: 28,
    scale: 'minor',
    fmCarrier: 1, fmModulator: 3.0,
    filterType: 'lowpass', filterFreq: 2200,
    reverbWet: 0.55,
    rhythmDensity: 0.8,
    dynamics: 0.85,
  },
  mysterious: {
    tempoBase: 54, tempoRange: 14,
    scale: 'dorian',
    fmCarrier: 1, fmModulator: 4.0,
    filterType: 'bandpass', filterFreq: 700,
    reverbWet: 0.7,
    rhythmDensity: 0.35,
    dynamics: 0.45,
  },
  peaceful: {
    tempoBase: 76, tempoRange: 18,
    scale: 'lydian',
    fmCarrier: 1, fmModulator: 1.2,
    filterType: 'lowpass', filterFreq: 1800,
    reverbWet: 0.4,
    rhythmDensity: 0.55,
    dynamics: 0.5,
  },
  melancholic: {
    tempoBase: 58, tempoRange: 14,
    scale: 'aeolian',
    fmCarrier: 1, fmModulator: 2.0,
    filterType: 'lowpass', filterFreq: 1000,
    reverbWet: 0.5,
    rhythmDensity: 0.4,
    dynamics: 0.45,
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

// Collect all modifier and genre-override deltas from the token list
function collectModifiers(tokens) {
  const acc = {
    tempoDelta: 0, dynamicsDelta: 0, densityDelta: 0,
    filterFreqMult: 1.0, reverbDelta: 0, fmModDelta: 0,
    tempoMult: 1.0, scaleOverride: null, swingFeel: false,
    // passthrough overrides from genre keywords
    rhythmDensityOverride: null, reverbWetOverride: null,
    dynamicsOverride: null, filterFreqOverride: null, fmModulatorOverride: null,
  };

  for (const token of tokens) {
    const mod = MODIFIERS[token];
    if (mod) {
      if (mod.tempoDelta     !== undefined) acc.tempoDelta     += mod.tempoDelta;
      if (mod.dynamicsDelta  !== undefined) acc.dynamicsDelta  += mod.dynamicsDelta;
      if (mod.densityDelta   !== undefined) acc.densityDelta   += mod.densityDelta;
      if (mod.filterFreqMult !== undefined) acc.filterFreqMult *= mod.filterFreqMult;
      if (mod.reverbDelta    !== undefined) acc.reverbDelta    += mod.reverbDelta;
      if (mod.fmModDelta     !== undefined) acc.fmModDelta     += mod.fmModDelta;
    }

    const genre = GENRE_OVERRIDES[token];
    if (genre) {
      if (genre.scaleOverride  !== undefined) acc.scaleOverride  = genre.scaleOverride;
      if (genre.swingFeel      !== undefined) acc.swingFeel      = genre.swingFeel;
      if (genre.tempoMult      !== undefined) acc.tempoMult     *= genre.tempoMult;
      // Genre overrides win over blended values for these fields
      if (genre.rhythmDensity  !== undefined) acc.rhythmDensityOverride = genre.rhythmDensity;
      if (genre.reverbWet      !== undefined) acc.reverbWetOverride     = genre.reverbWet;
      if (genre.dynamics       !== undefined) acc.dynamicsOverride      = genre.dynamics;
      if (genre.filterFreq     !== undefined) acc.filterFreqOverride    = genre.filterFreq;
      if (genre.fmModulator    !== undefined) acc.fmModulatorOverride   = genre.fmModulator;
    }
  }

  return acc;
}

export function parseScene(description) {
  const tokens  = tokenize(description);
  const scores  = scoreArchetypes(tokens);
  const total   = Object.values(scores).reduce((a, b) => a + b, 0);
  const mods    = collectModifiers(tokens);

  let dominant = 'tense';
  let maxScore = -1;
  for (const [name, score] of Object.entries(scores)) {
    if (score > maxScore) { maxScore = score; dominant = name; }
  }

  const preset = PRESETS[dominant];

  // Base continuous params — blended or defaulted
  let tempo, fmModulator, filterFreq, reverbWet, rhythmDensity, dynamics;

  if (total === 0) {
    tempo        = preset.tempoBase;
    fmModulator  = preset.fmModulator;
    filterFreq   = preset.filterFreq;
    reverbWet    = preset.reverbWet;
    rhythmDensity = preset.rhythmDensity;
    dynamics     = preset.dynamics;
  } else {
    tempo        = Math.round(blendParam(scores, total, 'tempoBase') +
                    (Math.random() * blendParam(scores, total, 'tempoRange') -
                      blendParam(scores, total, 'tempoRange') / 2));
    fmModulator  = Math.round(blendParam(scores, total, 'fmModulator') * 10) / 10;
    filterFreq   = Math.round(blendParam(scores, total, 'filterFreq'));
    reverbWet    = Math.round(blendParam(scores, total, 'reverbWet') * 100) / 100;
    rhythmDensity = Math.round(blendParam(scores, total, 'rhythmDensity') * 100) / 100;
    dynamics     = Math.round(blendParam(scores, total, 'dynamics') * 100) / 100;
  }

  // Apply genre overrides (take priority over blended values)
  if (mods.rhythmDensityOverride !== null) rhythmDensity = mods.rhythmDensityOverride;
  if (mods.reverbWetOverride     !== null) reverbWet     = mods.reverbWetOverride;
  if (mods.dynamicsOverride      !== null) dynamics      = mods.dynamicsOverride;
  if (mods.filterFreqOverride    !== null) filterFreq    = mods.filterFreqOverride;
  if (mods.fmModulatorOverride   !== null) fmModulator   = mods.fmModulatorOverride;

  // Apply direct modifier deltas
  tempo         = Math.round(tempo * mods.tempoMult + mods.tempoDelta);
  dynamics      = Math.round(Math.max(0.05, Math.min(1, dynamics + mods.dynamicsDelta)) * 100) / 100;
  rhythmDensity = Math.round(Math.max(0.05, Math.min(1, rhythmDensity + mods.densityDelta)) * 100) / 100;
  filterFreq    = Math.round(Math.max(80, filterFreq * mods.filterFreqMult));
  reverbWet     = Math.round(Math.max(0, Math.min(0.95, reverbWet + mods.reverbDelta)) * 100) / 100;
  fmModulator   = Math.round(Math.max(0.5, fmModulator + mods.fmModDelta) * 10) / 10;
  tempo         = Math.max(30, Math.min(220, tempo));

  return {
    archetype:    dominant,
    tempo,
    scale:        mods.scaleOverride ?? preset.scale,
    fmCarrier:    preset.fmCarrier,
    fmModulator,
    filterType:   preset.filterType,
    filterFreq,
    reverbWet,
    rhythmDensity,
    dynamics,
    swingFeel:    mods.swingFeel,
    scores,
  };
}
