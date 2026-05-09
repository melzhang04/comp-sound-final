// Scale and mode library.
// Each scale is a list of semitone offsets from the root (root = 0).
// Picked to give each cinematic archetype a distinctive sonic fingerprint.

const SCALE_INTERVALS = {
  // Diatonic modes
  major:             [0, 2, 4, 5, 7, 9, 11],
  minor:             [0, 2, 3, 5, 7, 8, 10],
  aeolian:           [0, 2, 3, 5, 7, 8, 10],
  dorian:            [0, 2, 3, 5, 7, 9, 10],
  phrygian:          [0, 1, 3, 5, 7, 8, 10],
  lydian:            [0, 2, 4, 6, 7, 9, 11],
  mixolydian:        [0, 2, 4, 5, 7, 9, 10],
  locrian:           [0, 1, 3, 5, 6, 8, 10],

  // Minor variants — adds drama, tension, "movie-score" feel
  harmonic_minor:    [0, 2, 3, 5, 7, 8, 11],   // minor + raised 7 (longing)
  melodic_minor:     [0, 2, 3, 5, 7, 9, 11],   // jazz minor
  hungarian_minor:   [0, 2, 3, 6, 7, 8, 11],   // double-harmonic, "epic"
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],   // tense, exotic, action
  lydian_dominant:   [0, 2, 4, 6, 7, 9, 10],   // bright + edgy

  // Symmetrical / non-diatonic — instantly "non-tonal"
  whole_tone:        [0, 2, 4, 6, 8, 10],      // dreamlike, suspended
  octatonic:         [0, 2, 3, 5, 6, 8, 9, 11],// tense, alien (diminished)

  // Pentatonic / world — open, no half-step clashes
  pentatonic_major:  [0, 2, 4, 7, 9],          // peaceful, folk
  pentatonic_minor:  [0, 3, 5, 7, 10],         // bluesy, melancholic
  hirajoshi:         [0, 2, 3, 7, 8],          // Japanese, mysterious
  in_sen:            [0, 1, 5, 7, 10],         // sparse, eerie
};

// Equal temperament: f = root * 2^(semitones/12)
function semitonesToHz(rootHz, semitones) {
  return rootHz * Math.pow(2, semitones / 12);
}

// Returns a flat array of frequencies for the given scale across `octaves`.
export function getScaleFrequencies(scaleName, rootHz = 220, octaves = 3) {
  const intervals = SCALE_INTERVALS[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);

  const freqs = [];
  for (let oct = 0; oct < octaves; oct++) {
    const octaveRoot = rootHz * Math.pow(2, oct);
    for (const interval of intervals) {
      freqs.push(semitonesToHz(octaveRoot, interval));
    }
  }
  return freqs;
}

// Number of notes per octave for a scale (used for chord stacking).
export function getScaleSize(scaleName) {
  const intervals = SCALE_INTERVALS[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  return intervals.length;
}

// Frequency of a single scale degree at a given octave offset.
export function getNote(scaleName, rootHz = 220, degree = 0, octave = 0) {
  const intervals = SCALE_INTERVALS[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  const semitones = intervals[degree % intervals.length] + (octave * 12);
  return semitonesToHz(rootHz, semitones);
}

export { SCALE_INTERVALS };
