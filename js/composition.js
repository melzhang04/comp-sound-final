import { getScaleFrequencies, getScaleSize } from './scales.js';
const ARCHETYPE = {
  tense: {
    scale: 'phrygian_dominant',
    rootHz: 146.83, // D3
    octaves: 3,
    chordProgressions: [
      [0, 1, 0, 5],     // tonic, lowered-2, tonic, raised-6  — exotic, jagged
      [0, 5, 1, 0],
      [0, 3, 5, 1],
    ],
    intervalSet: [1, 1, 1, 2, 3],          // mostly half-steps + a few skips
    leapSet:     [4, 5, 7],
    stepBias:    0.55,                      // mix of step + leap (jagged)
    rhythmCells: [
      [0.5, 0.25, 0.25, 0.5, 0.5],          // syncopated 8 16 16 8 8
      [0.25, 0.25, 0.25, 0.25, 0.5, 0.5],   // 16 16 16 16 8 8
      [0.5, 0.5, 0.25, 0.25, 1],
      [0.25, 0.75, 0.5, 0.5],               // dotted-16 push
    ],
    melodyRegister: 1,                       // start ~1 octave above bass
    bassOctave:    -1,
    padVoicing:    [0, 2, 4],
  },

  romantic: {
    scale: 'lydian',
    rootHz: 174.61, // F3 — warm mid-low so the melody sits in soprano range
    octaves: 3,
    chordProgressions: [
      [0, 4, 5, 3],     // I, V, vi, IV   — classic
      [0, 5, 3, 4],     // I, vi, IV, V
      [0, 3, 4, 0],
    ],
    intervalSet: [1, 2, 2, 3, 4],            // 3rds, 4ths
    leapSet:     [4, 5, 7],
    stepBias:    0.78,                       // mostly stepwise → lyrical
    rhythmCells: [
      [1, 0.5, 0.5, 1, 1],                   // singing quarter+eighth feel
      [0.5, 0.5, 1, 0.5, 0.5, 1],
      [1.5, 0.5, 1, 1],                      // dotted swing
      [0.5, 0.5, 0.5, 0.5, 1, 1],
    ],
    melodyRegister: 1,
    bassOctave:    -1,
    padVoicing:    [0, 2, 4],
  },

  epic: {
    scale: 'hungarian_minor',
    rootHz: 110.00, // A2 — keeps it big and low
    octaves: 4,
    chordProgressions: [
      [0, 5, 3, 6],                          // i, VI, iv, ♭VII — heroic
      [0, 6, 5, 0],                          // i, ♭VII, VI, i
      [0, 3, 0, 5],
    ],
    intervalSet: [1, 2, 3, 3, 4],
    leapSet:     [4, 5, 7, 7, 12],           // big leaps, full octaves
    stepBias:    0.5,
    rhythmCells: [
      [0.5, 0.5, 0.5, 0.5, 1, 1],            // driving 8ths into halves
      [0.25, 0.25, 0.5, 0.5, 0.5, 1],
      [1, 0.5, 0.5, 1, 1],
      [0.25, 0.25, 0.25, 0.25, 0.5, 0.5, 1], // surge
    ],
    melodyRegister: 3,                       // sit high above the low bass
    bassOctave:    -1,
    padVoicing:    [0, 2, 4],
  },

  mysterious: {
    scale: 'octatonic',
    rootHz: 130.81, // C3
    octaves: 3,
    chordProgressions: [
      [0, 3, 6, 1],                          // diminished cycle
      [0, 2, 4, 6],                          // symmetrical climb
      [0, 5, 0, 3],
    ],
    intervalSet: [2, 3, 3, 4],               // skips & tritones (octatonic)
    leapSet:     [3, 6, 9, 12],              // tritone-ish jumps
    stepBias:    0.45,
    rhythmCells: [
      [1, 1.5, 0.5, 1],                      // unsettled
      [2, 0.5, 0.5, 1],
      [0.25, 1.75, 1, 1],                    // sudden short-then-held
      [0.5, 0.5, 1.5, 0.5, 1],
    ],
    melodyRegister: 2,
    bassOctave:    -1,
    padVoicing:    [0, 2, 5],                // open / non-triadic stack
  },

  peaceful: {
    scale: 'pentatonic_major',
    rootHz: 196.00, // G3
    octaves: 3,
    chordProgressions: [
      [0, 2, 0, 1],                          // I, V, I, IV (in pentatonic)
      [0, 1, 2, 0],
      [0, 1, 0, 2],
    ],
    intervalSet: [1, 1, 2, 2, 3],            // smooth small steps
    leapSet:     [3, 4, 5],
    stepBias:    0.85,                       // very lyrical, almost no leaps
    rhythmCells: [
      [1, 1, 1, 1],                          // calm walking quarters
      [1.5, 0.5, 1, 1],
      [0.5, 0.5, 1, 0.5, 0.5, 1],
      [2, 1, 1],
    ],
    melodyRegister: 2,
    bassOctave:    -1,
    padVoicing:    [0, 2, 4],
  },

  melancholic: {
    scale: 'harmonic_minor',
    rootHz: 174.61, // F3
    octaves: 3,
    chordProgressions: [
      [0, 5, 3, 4],                          // i, VI, iv, V — yearning
      [0, 3, 6, 0],
      [0, 6, 5, 0],
    ],
    intervalSet: [1, 1, 2, 2, 3],            // mostly stepwise
    leapSet:     [3, 4, 5, 7],
    stepBias:    0.75,
    rhythmCells: [
      [1.5, 0.5, 1, 1],                      // sigh-like dotted figure
      [1, 1, 0.5, 0.5, 1],
      [2, 1, 1],
      [0.5, 0.5, 1, 0.5, 0.5, 1],
    ],
    melodyRegister: 2,
    bassOctave:    -1,
    padVoicing:    [0, 2, 4],
  },
};

function rand() { return Math.random(); }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function getProfile(archetype) { return ARCHETYPE[archetype] ?? ARCHETYPE.tense; }

// Build a triad (or wider voicing) above a given scale degree.
// Voicings are scale-step offsets, e.g. [0, 2, 4] = root + 3rd + 5th of the scale.
function buildChord(degree, voicing, scaleFreqs, scaleSize, octaves, baseOctave = 1) {
  const chord = [];
  for (const offset of voicing) {
    const idx = (baseOctave * scaleSize) + degree + offset;
    const safe = Math.max(0, Math.min(scaleFreqs.length - 1, idx));
    chord.push(scaleFreqs[safe]);
  }
  return chord;
}

// Bass: one note per chord, low octave. Sustained for almost the full chord.
function generateBass(profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord) {
  const notes = [];
  const baseOct = Math.max(0, profile.bassOctave + 1); // index into scaleFreqs by octave
  for (let i = 0; i < prog.length; i++) {
    const idx = (baseOct * scaleSize) + prog[i];
    const safe = Math.max(0, Math.min(scaleFreqs.length - 1, idx));
    notes.push({
      freq: scaleFreqs[safe] * 0.5,                // octave below the scale array
      time: i * beatsPerChord * beatDur,
      duration: beatsPerChord * beatDur * 0.95,
      velocity: 0.55,
      voice: 'bass',
    });
  }
  return notes;
}

// Harmony / pad: held triad per chord change.
function generateHarmony(profile, prog, scaleFreqs, scaleSize, octaves, beatDur, beatsPerChord) {
  const notes = [];
  for (let i = 0; i < prog.length; i++) {
    const chord = buildChord(prog[i], profile.padVoicing, scaleFreqs, scaleSize, octaves, 1);
    for (const f of chord) {
      notes.push({
        freq: f,
        time: i * beatsPerChord * beatDur,
        duration: beatsPerChord * beatDur * 0.9,
        velocity: 0.28,
        voice: 'harmony',
      });
    }
  }
  return notes;
}

// Melody: top line, with archetype-specific contour & rhythm.
function generateMelody(profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats, dynamics, density) {
  const notes = [];
  const totalDur = phraseBeats * beatDur;
  const totalScale = scaleFreqs.length;

  // Start cursor inside the chosen melody register
  let cursor = Math.min(totalScale - 1, profile.melodyRegister * scaleSize + prog[0]);

  let time = 0;
  let cell = pick(profile.rhythmCells).slice();
  let cellIdx = 0;

  while (time < totalDur) {
    if (cellIdx >= cell.length) {
      // Pull a new rhythm cell — keeps the line evolving across the phrase
      cell = pick(profile.rhythmCells).slice();
      cellIdx = 0;
    }

    const beatFrac = cell[cellIdx++];
    const dur = beatFrac * beatDur;
    if (time + dur > totalDur) break;

    // Move along the scale: step (small interval) or leap (big interval)
    const isStep = rand() < profile.stepBias;
    const interval = isStep ? pick(profile.intervalSet) : pick(profile.leapSet);
    const direction = rand() < 0.55 ? 1 : -1;
    cursor += interval * direction;

    // Keep cursor inside scale array (reflect at boundaries instead of wrap,
    // so the line bounces rather than teleports)
    if (cursor < 0)             cursor = -cursor;
    if (cursor >= totalScale)   cursor = totalScale - (cursor - totalScale + 1);
    cursor = Math.max(0, Math.min(totalScale - 1, cursor));

    // Density-controlled rests: less density → more silences in the melody
    const restChance = Math.max(0, 0.25 - density * 0.2);
    if (rand() < restChance) {
      time += dur;
      continue;
    }

    const vel = Math.max(0.05, dynamics * (0.7 + rand() * 0.4));
    notes.push({
      freq: scaleFreqs[cursor],
      time,
      duration: dur * 0.92,
      velocity: vel,
      voice: 'melody',
    });

    time += dur;
  }
  return notes;
}

// Generate one phrase's worth of all three voices, sorted by start time.
// Returns { notes, phraseDuration, progression }.
export function generatePhrase(params) {
  const profile = getProfile(params.archetype);

  // Use the archetype's signature scale by default, but honour an override
  // (e.g. blended scale from sceneParser).
  const scaleName = profile.scale;
  const rootHz    = profile.rootHz;
  const octaves   = profile.octaves;
  const scaleSize = getScaleSize(scaleName);
  const scaleFreqs = getScaleFrequencies(scaleName, rootHz, octaves);

  const beatDur = 60 / params.tempo;
  const prog = pick(profile.chordProgressions);

  // 2 beats per chord = 8 beats for 4-chord, 6 for 3-chord, 4 for 2-chord.
  const beatsPerChord = 2;
  const phraseBeats = prog.length * beatsPerChord;
  const phraseDuration = phraseBeats * beatDur;

  const bassNotes    = generateBass    (profile, prog, scaleFreqs, scaleSize, beatDur, beatsPerChord);
  const harmonyNotes = generateHarmony (profile, prog, scaleFreqs, scaleSize, octaves, beatDur, beatsPerChord);
  const melodyNotes  = generateMelody  (profile, prog, scaleFreqs, scaleSize, beatDur, phraseBeats,
                                        params.dynamics, params.rhythmDensity);

  const notes = [...bassNotes, ...harmonyNotes, ...melodyNotes]
    .sort((a, b) => a.time - b.time);

  return { notes, phraseDuration, progression: prog };
}

export { ARCHETYPE };
