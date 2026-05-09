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

  // Minor variants
  harmonic_minor:    [0, 2, 3, 5, 7, 8, 11],
  melodic_minor:     [0, 2, 3, 5, 7, 9, 11],
  hungarian_minor:   [0, 2, 3, 6, 7, 8, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
  lydian_dominant:   [0, 2, 4, 6, 7, 9, 10],

  // Symmetrical / non-diatonic
  whole_tone:        [0, 2, 4, 6, 8, 10],
  octatonic:         [0, 2, 3, 5, 6, 8, 9, 11],

  // Pentatonic / world
  pentatonic_major:  [0, 2, 4, 7, 9],
  pentatonic_minor:  [0, 3, 5, 7, 10],
  hirajoshi:         [0, 2, 3, 7, 8],
  in_sen:            [0, 1, 5, 7, 10],
};

function semitonesToHz(rootHz, semitones) {
  return rootHz * Math.pow(2, semitones / 12);
}

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

export function getScaleSize(scaleName) {
  const intervals = SCALE_INTERVALS[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  return intervals.length;
}

export function getNote(scaleName, rootHz = 220, degree = 0, octave = 0) {
  const intervals = SCALE_INTERVALS[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  const semitones = intervals[degree % intervals.length] + (octave * 12);
  return semitonesToHz(rootHz, semitones);
}

export { SCALE_INTERVALS };
