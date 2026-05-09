// Scores a free-text scene description against cinematic archetypes using
// the NRC Word-Emotion Lexicon plus a stronger cinematic keyword layer.
// Returns a musical parameter object. No external API required.

import { lexicon as nrcLexicon } from './nrcLexicon.js';

// Cinematic-specific words. These are intentionally weighted more strongly
// than the NRC lexicon because they should define the musical tag the user sees.
const SUPPLEMENT = {
  // tense / suspense / thriller
  detective: { tense: 5 }, noir: { tense: 5, mysterious: 2 }, surveillance: { tense: 5, mysterious: 2 },
  stalker: { tense: 6 }, interrogation: { tense: 5 }, chase: { tense: 6, epic: 2 }, pursued: { tense: 5 },
  running: { tense: 3, epic: 1 }, escape: { tense: 5 }, panic: { tense: 6 }, danger: { tense: 6 },
  threat: { tense: 6 }, suspense: { tense: 7, mysterious: 2 }, thriller: { tense: 6, mysterious: 2 },
  murder: { tense: 6, mysterious: 2, melancholic: 1 }, knife: { tense: 5 }, alarm: { tense: 5 },
  alley: { tense: 3, mysterious: 1 }, rain: { tense: 2, melancholic: 2 }, rainy: { tense: 2, melancholic: 2 },
  gritty: { tense: 3 }, bleak: { tense: 2, melancholic: 3 }, drizzle: { tense: 2, melancholic: 2 },
  storm: { tense: 5, epic: 2 }, stormy: { tense: 5, epic: 2 }, dark: { tense: 3, mysterious: 3 },
  shadow: { tense: 3, mysterious: 4 }, shadows: { tense: 3, mysterious: 4 },
  fog: { tense: 2, mysterious: 4 }, foggy: { tense: 2, mysterious: 4 },

  // romantic / warm / lyrical
  lovers: { romantic: 7 }, romance: { romantic: 7 }, romantic: { romantic: 7 }, kiss: { romantic: 7 },
  embrace: { romantic: 7 }, dancing: { romantic: 5 }, dance: { romantic: 5 }, ballroom: { romantic: 5 },
  sunset: { romantic: 5, peaceful: 2 }, candlelight: { romantic: 6 }, candlelit: { romantic: 6 },
  serenade: { romantic: 7 }, waltz: { romantic: 6 }, wedding: { romantic: 6, peaceful: 2 },
  intimate: { romantic: 6 }, gentle: { romantic: 3, peaceful: 3 }, tender: { romantic: 6 },
  warm: { romantic: 3, peaceful: 2 }, hopeful: { romantic: 3, peaceful: 3, epic: 1 },

  // epic / action / heroic
  battle: { epic: 7 }, war: { epic: 7, tense: 2 }, army: { epic: 6 }, warrior: { epic: 7 },
  sword: { epic: 5 }, cavalry: { epic: 5 }, clash: { epic: 5, tense: 2 }, siege: { epic: 6 },
  charging: { epic: 6 }, soldiers: { epic: 6 }, troops: { epic: 6 }, medieval: { epic: 4 },
  cinematic: { epic: 2 }, hero: { epic: 6 }, heroic: { epic: 7 }, victory: { epic: 6 },
  kingdom: { epic: 5 }, dragon: { epic: 6, mysterious: 2 }, mountain: { epic: 4, peaceful: 1 },
  ocean: { epic: 3, peaceful: 2 }, explosion: { epic: 5, tense: 3 }, racing: { epic: 4, tense: 3 },

  // mysterious / supernatural / uncanny
  ritual: { mysterious: 7 }, otherworldly: { mysterious: 7 }, seance: { mysterious: 7 },
  eerie: { mysterious: 7, tense: 2 }, supernatural: { mysterious: 7 }, haunting: { mysterious: 5, melancholic: 3 },
  ghost: { mysterious: 7, melancholic: 2 }, haunted: { mysterious: 7, melancholic: 2 },
  secret: { mysterious: 5 }, hidden: { mysterious: 5 }, ancient: { mysterious: 5, epic: 1 },
  alien: { mysterious: 6, tense: 2 }, portal: { mysterious: 6 }, dream: { mysterious: 4, peaceful: 2 },
  strange: { mysterious: 5 }, weird: { mysterious: 5 }, magic: { mysterious: 5, romantic: 1 },
  night: { mysterious: 4, tense: 2 }, midnight: { mysterious: 5, tense: 2 },

  // peaceful / calm / nature
  birdsong: { peaceful: 7 }, meadow: { peaceful: 7 }, serene: { peaceful: 7 }, tranquil: { peaceful: 7 },
  sunrise: { peaceful: 6, romantic: 2 }, dewdrop: { peaceful: 5 }, forest: { peaceful: 5, mysterious: 1 },
  lake: { peaceful: 5 }, river: { peaceful: 5 }, garden: { peaceful: 5 }, quiet: { peaceful: 5 },
  calm: { peaceful: 7 }, soft: { peaceful: 4, romantic: 2 }, breeze: { peaceful: 5 },
  morning: { peaceful: 4 }, field: { peaceful: 4 }, village: { peaceful: 4 },

  // melancholic / sad / reflective
  farewell: { melancholic: 7 }, goodbye: { melancholic: 7 }, nostalgia: { melancholic: 7 },
  nostalgic: { melancholic: 7 }, bittersweet: { melancholic: 7, romantic: 1 }, fading: { melancholic: 5 },
  twilight: { melancholic: 4, peaceful: 2 }, lonely: { melancholic: 7 }, alone: { melancholic: 6 },
  grief: { melancholic: 7 }, loss: { melancholic: 7 }, lost: { melancholic: 6, mysterious: 1 },
  memory: { melancholic: 5, romantic: 1 }, memories: { melancholic: 5, romantic: 1 },
  abandoned: { melancholic: 6, mysterious: 2, tense: 1 }, empty: { melancholic: 5 },
  crying: { melancholic: 6 }, tears: { melancholic: 6 }, funeral: { melancholic: 7 },
};

// Phrase-level cues help multi-word scene descriptions score more accurately.
const PHRASE_SUPPLEMENT = {
  'rainy city': { tense: 5, melancholic: 2 },
  'at night': { mysterious: 4, tense: 2 },
  'dark alley': { tense: 6, mysterious: 3 },
  'walking alone': { melancholic: 4, mysterious: 2 },
  'love story': { romantic: 7 },
  'slow dance': { romantic: 6 },
  'final battle': { epic: 8 },
  'epic battle': { epic: 8 },
  'haunted house': { mysterious: 8, tense: 3 },
  'quiet forest': { peaceful: 7, mysterious: 1 },
  'peaceful meadow': { peaceful: 8 },
  'sad farewell': { melancholic: 8 },
};

const PRESETS = {
  tense: {
    tempoBase: 122, tempoRange: 22,
    scale: 'phrygian_dominant',
    fmCarrier: 1, fmModulator: 3.2,
    filterType: 'highpass', filterFreq: 1050,
    reverbWet: 0.28,
    rhythmDensity: 0.78,
    dynamics: 0.72,
    complexity: 0.86,
    texture: 'sharp',
  },
  romantic: {
    tempoBase: 86, tempoRange: 14,
    scale: 'lydian',
    fmCarrier: 1, fmModulator: 1.35,
    filterType: 'lowpass', filterFreq: 1750,
    reverbWet: 0.58,
    rhythmDensity: 0.58,
    dynamics: 0.58,
    complexity: 0.62,
    texture: 'warm',
  },
  epic: {
    tempoBase: 142, tempoRange: 24,
    scale: 'hungarian_minor',
    fmCarrier: 1, fmModulator: 3.4,
    filterType: 'lowpass', filterFreq: 2800,
    reverbWet: 0.55,
    rhythmDensity: 0.92,
    dynamics: 0.95,
    complexity: 0.94,
    texture: 'bold',
  },
  mysterious: {
    tempoBase: 78, tempoRange: 14,
    scale: 'octatonic',
    fmCarrier: 1, fmModulator: 4.6,
    filterType: 'bandpass', filterFreq: 760,
    reverbWet: 0.76,
    rhythmDensity: 0.52,
    dynamics: 0.50,
    complexity: 0.78,
    texture: 'glassy',
  },
  peaceful: {
    tempoBase: 88, tempoRange: 10,
    scale: 'pentatonic_major',
    fmCarrier: 1, fmModulator: 1.05,
    filterType: 'lowpass', filterFreq: 2200,
    reverbWet: 0.48,
    rhythmDensity: 0.42,
    dynamics: 0.45,
    complexity: 0.42,
    texture: 'airy',
  },
  melancholic: {
    tempoBase: 76, tempoRange: 10,
    scale: 'harmonic_minor',
    fmCarrier: 1, fmModulator: 2.15,
    filterType: 'lowpass', filterFreq: 1150,
    reverbWet: 0.64,
    rhythmDensity: 0.46,
    dynamics: 0.48,
    complexity: 0.55,
    texture: 'hollow',
  },
};

const ARCHETYPES = Object.keys(PRESETS);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function tokenVariants(token) {
  const variants = new Set([token]);
  if (token.endsWith('ies') && token.length > 4) variants.add(token.slice(0, -3) + 'y');
  if (token.endsWith('ing') && token.length > 5) variants.add(token.slice(0, -3));
  if (token.endsWith('ed') && token.length > 4) variants.add(token.slice(0, -2));
  if (token.endsWith('s') && token.length > 3) variants.add(token.slice(0, -1));
  return [...variants];
}

function addScores(scores, matchLog, scoreMap, label, source, weight = 1) {
  const applied = {};
  for (const [archetype, score] of Object.entries(scoreMap)) {
    if (scores[archetype] === undefined) continue;
    const weighted = score * weight;
    scores[archetype] += weighted;
    applied[archetype] = round2(weighted);
  }
  matchLog.push({ label, source, scores: applied });
}

function scoreArchetypes(description, tokens) {
  const scores = Object.fromEntries(ARCHETYPES.map(a => [a, 0]));
  const matches = [];
  const normalized = ` ${description.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `;

  for (const [phrase, scoreMap] of Object.entries(PHRASE_SUPPLEMENT)) {
    if (normalized.includes(` ${phrase} `)) {
      addScores(scores, matches, scoreMap, phrase, 'phrase', 2.0);
    }
  }

  for (const token of tokens) {
    let supplementMatched = false;
    for (const variant of tokenVariants(token)) {
      const sup = SUPPLEMENT[variant];
      if (sup) {
        addScores(scores, matches, sup, variant, 'cinematic', 1.4);
        supplementMatched = true;
        break;
      }
    }

    // Keep NRC useful, but lower its weight so generic words do not overpower
    // direct cinematic tags like "battle", "romance", "eerie", etc.
    if (!supplementMatched) {
      for (const variant of tokenVariants(token)) {
        const nrc = nrcLexicon[variant];
        if (nrc) {
          addScores(scores, matches, nrc, variant, 'nrc', 0.45);
          break;
        }
      }
    }
  }

  return { scores, matches };
}

function blendParam(scores, total, field) {
  let value = 0;
  for (const [name, score] of Object.entries(scores)) {
    value += (score / total) * PRESETS[name][field];
  }
  return value;
}

function dominantBlend(scores, total, dominant, field, confidence) {
  const dominantValue = PRESETS[dominant][field];
  if (total === 0 || typeof dominantValue !== 'number') return dominantValue;

  const blendedValue = blendParam(scores, total, field);
  const dominantWeight = clamp(0.72 + confidence * 0.25, 0.72, 0.95);
  return dominantValue * dominantWeight + blendedValue * (1 - dominantWeight);
}

function pickDominant(scores) {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [dominant, maxScore] = ranked[0];
  const secondScore = ranked[1]?.[1] ?? 0;
  const confidence = maxScore <= 0 ? 0 : clamp((maxScore - secondScore) / maxScore, 0, 1);
  return { dominant, maxScore, secondScore, confidence, ranked };
}

export function parseScene(description) {
  const tokens = tokenize(description);
  const { scores, matches } = scoreArchetypes(description, tokens);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const { dominant, confidence, ranked } = pickDominant(scores);
  const preset = PRESETS[dominant];

  if (total === 0) {
    return {
      archetype: 'mysterious',
      tempo: PRESETS.mysterious.tempoBase,
      scale: PRESETS.mysterious.scale,
      fmCarrier: PRESETS.mysterious.fmCarrier,
      fmModulator: PRESETS.mysterious.fmModulator,
      filterType: PRESETS.mysterious.filterType,
      filterFreq: PRESETS.mysterious.filterFreq,
      reverbWet: PRESETS.mysterious.reverbWet,
      rhythmDensity: PRESETS.mysterious.rhythmDensity,
      dynamics: PRESETS.mysterious.dynamics,
      complexity: PRESETS.mysterious.complexity,
      texture: PRESETS.mysterious.texture,
      confidence: 0,
      matchedKeywords: [],
      rankedArchetypes: ranked,
      scores,
    };
  }

  const tempoRange = dominantBlend(scores, total, dominant, 'tempoRange', confidence);
  const tempo = dominantBlend(scores, total, dominant, 'tempoBase', confidence) +
    (Math.random() * tempoRange - tempoRange / 2);

  return {
    archetype: dominant,
    tempo: Math.round(tempo),
    scale: preset.scale,
    fmCarrier: preset.fmCarrier,
    fmModulator: round2(dominantBlend(scores, total, dominant, 'fmModulator', confidence)),
    filterType: preset.filterType,
    filterFreq: Math.round(dominantBlend(scores, total, dominant, 'filterFreq', confidence)),
    reverbWet: round2(dominantBlend(scores, total, dominant, 'reverbWet', confidence)),
    rhythmDensity: round2(dominantBlend(scores, total, dominant, 'rhythmDensity', confidence)),
    dynamics: round2(dominantBlend(scores, total, dominant, 'dynamics', confidence)),
    complexity: round2(dominantBlend(scores, total, dominant, 'complexity', confidence)),
    texture: preset.texture,
    confidence: round2(confidence),
    matchedKeywords: matches,
    rankedArchetypes: ranked,
    scores,
  };
}
