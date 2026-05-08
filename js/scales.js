// scale definitions as semitone intervals within one octave (root = 0).
// provides frequency arrays for use by the composition engine.

const SCALE_INTERVALS = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
};

// Equal temperament: f = root * 2^(semitones/12)
function semitonesToHz(rootHz, semitones) {
  return rootHz * Math.pow(2, semitones / 12);
}

// returns a flat array of frequencies for the given scale across `octaves` octaves.
// rootHz is the frequency of the root note (e.g. 220 for A3).
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

// returns the frequency of a single scale degree (0-indexed) at a given octave offset.
export function getNote(scaleName, rootHz = 220, degree = 0, octave = 0) {
  const intervals = SCALE_INTERVALS[scaleName];
  if (!intervals) throw new Error(`Unknown scale: ${scaleName}`);
  const semitones = intervals[degree % intervals.length] + (octave * 12);
  return semitonesToHz(rootHz, semitones);
}

export { SCALE_INTERVALS };
