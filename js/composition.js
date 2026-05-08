// Generates a phrase — a timed sequence of note events — from musical params.
// A phrase is the repeatable unit the L-system will arrange into a full piece.

import { getScaleFrequencies } from './scales.js';

// Root frequency per archetype (sets the register/feel)
const ROOTS = {
  tense:       146.83, // D3 — dark, taut
  romantic:    261.63, // C4 — warm, central
  epic:         82.41, // E2 — low, powerful
  mysterious:  123.47, // B2 — eerie, hollow
  peaceful:    196.00, // G3 — bright, open
  melancholic: 220.00, // A3 — mournful
};

// How each archetype moves through the scale
const CONTOUR = {
  tense:       { direction: 'erratic', registerBias: 0.7, leapChance: 0.45, restChance: 0.30, octaves: 2 },
  romantic:    { direction: 'arch',    registerBias: 0.4, leapChance: 0.10, restChance: 0.15, octaves: 2 },
  epic:        { direction: 'rising',  registerBias: 0.3, leapChance: 0.50, restChance: 0.08, octaves: 3 },
  mysterious:  { direction: 'erratic', registerBias: 0.3, leapChance: 0.60, restChance: 0.25, octaves: 2 },
  peaceful:    { direction: 'wave',    registerBias: 0.5, leapChance: 0.10, restChance: 0.18, octaves: 2 },
  melancholic: { direction: 'falling', registerBias: 0.5, leapChance: 0.20, restChance: 0.28, octaves: 2 },
};

// Rhythmic subdivision patterns per archetype (fractions of a beat)
const RHYTHMS = {
  tense:       [0.5, 0.5, 1, 0.5, 0.5, 1, 1],
  romantic:    [1, 1, 2, 1, 1, 2],
  epic:        [1, 0.5, 0.5, 1, 1, 0.5, 0.5, 1],
  mysterious:  [2, 1, 1, 2, 0.5, 0.5, 1],
  peaceful:    [1, 1, 1, 1, 2, 1, 1],
  melancholic: [2, 1, 1, 2, 2, 1, 1],
};

function rand() { return Math.random(); }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

// Move cursor through scale array based on contour direction
function nextIndex(current, total, direction) {
  switch (direction) {
    case 'rising':  return Math.min(current + (rand() < 0.7 ? 1 : 2), total - 1);
    case 'falling': return Math.max(current - (rand() < 0.7 ? 1 : 2), 0);
    case 'arch': {
      const mid = Math.floor(total / 2);
      return current < mid ? current + 1 : current - 1;
    }
    case 'wave':
      return Math.round(current + Math.sin(current) * 2 + (rand() * 2 - 1)) % total;
    case 'erratic':
    default:
      return Math.floor(rand() * total);
  }
}

// Returns { notes, phraseDuration }
// notes: [{ freq, time, duration, velocity }]  (freq=null means rest)
export function generatePhrase(params) {
  const { archetype, tempo, scale, rhythmDensity, dynamics } = params;

  const beatDuration = 60 / tempo;
  const profile = CONTOUR[archetype] ?? CONTOUR.tense;
  const rhythm = RHYTHMS[archetype] ?? RHYTHMS.tense;
  const rootHz = ROOTS[archetype] ?? 220;

  const freqs = getScaleFrequencies(scale, rootHz, profile.octaves);
  const totalNotes = freqs.length;

  // Starting position in the scale array, biased toward the archetype's register
  let cursor = Math.floor(profile.registerBias * (totalNotes - 1));

  // Density scales how many beats the phrase spans (4–16 beats)
  const phraseBeats = Math.round(4 + rhythmDensity * 12);
  const phraseDuration = phraseBeats * beatDuration;

  const notes = [];
  let time = 0;

  while (time < phraseDuration) {
    const beatFraction = pick(rhythm);
    const duration = beatFraction * beatDuration;

    if (time + duration > phraseDuration) break;

    const isRest = rand() < (profile.restChance * (1 - rhythmDensity + 0.3));

    if (isRest) {
      notes.push({ freq: null, time, duration, velocity: 0 });
    } else {
      // Leap or step
      if (rand() < profile.leapChance) {
        cursor = Math.floor(rand() * totalNotes);
      } else {
        cursor = Math.abs(nextIndex(cursor, totalNotes, profile.direction) % totalNotes);
      }

      // Slight velocity variation for expression
      const velocity = Math.min(1, dynamics * (0.8 + rand() * 0.4));

      notes.push({ freq: freqs[cursor], time, duration, velocity });
    }

    time += duration;
  }

  return { notes, phraseDuration };
}
