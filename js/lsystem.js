// Lindenmayer system (L-system) for large-scale musical form.
//
// An L-system is a parallel rewriting system: starting from an axiom string,
// every symbol is replaced simultaneously according to a set of production
// rules. After N iterations, we get a longer string whose shape is determined
// by the rules. We use it here to decide the *form* of a piece — when the
// music builds, pulls back, peaks, and resolves — instead of just looping.
//
// Alphabet
// --------
// Section symbols (each one becomes a phrase when rendered):
//   I  intro          A  theme A         B  theme B
//   D  development    C  climax          R  resolution    O  outro
//
// Modifier symbols (attach to the *next* section symbol):
//   +  intensify (louder, denser)
//   -  soften   (quieter, sparser)
//   ^  octave up
//   v  octave down
//   *  extend   (phrase plays longer)
//
// Pipeline
// --------
//   axiom  --rules-->  expanded string  --render-->  [section, section, ...]
//
//   Each section is an object the audio engine / composer can read:
//     { type, intensity, register, lengthMul, index }

// Per-archetype axioms + production rules.
// Tuned by hand so each archetype has a recognisable dramatic shape.
const GRAMMARS = {
  // Epic: relentless build toward a huge climax, brief resolution.
  epic: {
    axiom: 'IADCRO',
    rules: {
      A: 'A+D',
      D: 'D+C',
      C: 'C^+C',
      R: 'R-O',
    },
    iterations: 2,
  },

  // Tense: jagged, unstable — pushes and pulls without settling.
  tense: {
    axiom: 'IABCRO',
    rules: {
      A: 'A+B-',
      B: 'B+C-A',
      C: 'C-+C',
      R: '-R',
    },
    iterations: 2,
  },

  // Romantic: an arch — gentle rise, lyrical peak, soft return.
  romantic: {
    axiom: 'IABCRO',
    rules: {
      A: 'AAB',
      B: 'AB+A',
      C: 'C+R-',
      R: 'RA-',
    },
    iterations: 2,
  },

  // Peaceful: gentle, breathing waves; never strays far.
  peaceful: {
    axiom: 'IABRO',
    rules: {
      A: 'A-BA',
      B: 'BAB-',
      R: 'R-R',
    },
    iterations: 2,
  },

  // Mysterious: sparse, unpredictable, register jumps.
  mysterious: {
    axiom: 'IADRO',
    rules: {
      A: 'A-^D',
      D: 'AvD-',
      R: '--R',
    },
    iterations: 2,
  },

  // Melancholic: slowly descending, fading away.
  melancholic: {
    axiom: 'IABRO',
    rules: {
      A: 'AB-',
      B: 'BvA-',
      R: 'R-O',
    },
    iterations: 2,
  },
};

const SECTION_SYMBOLS = new Set(['I', 'A', 'B', 'D', 'C', 'R', 'O']);
const MODIFIER_SYMBOLS = new Set(['+', '-', '^', 'v', '*']);

// Base intensity (0–1) per section type. Modifiers bend it from there.
const BASE_INTENSITY = {
  I: 0.30,
  A: 0.55,
  B: 0.55,
  D: 0.70,
  C: 0.90,
  R: 0.45,
  O: 0.20,
};

// Apply production rules once across the whole string (parallel rewriting).
function rewrite(str, rules) {
  let out = '';
  for (const ch of str) {
    out += rules[ch] !== undefined ? rules[ch] : ch;
  }
  return out;
}

// Run the L-system N times, returning the expanded string.
export function expand(grammar) {
  let s = grammar.axiom;
  for (let i = 0; i < grammar.iterations; i++) {
    s = rewrite(s, grammar.rules);
  }
  return s;
}

export function renderStructure(expanded) {
  const sections = [];
  let pendingIntensity = 0;
  let pendingRegister = 0;
  let pendingLength = 1;

  let index = 0;

  for (const ch of expanded) {
    if (MODIFIER_SYMBOLS.has(ch)) {
      switch (ch) {
        case '+': pendingIntensity += 0.12; break;
        case '-': pendingIntensity -= 0.12; break;
        case '^': pendingRegister  += 1;    break;
        case 'v': pendingRegister  -= 1;    break;
        case '*': pendingLength    *= 1.5;  break;
      }
      continue;
    }

    if (!SECTION_SYMBOLS.has(ch)) continue;

    const base = BASE_INTENSITY[ch];
    const intensity = Math.max(0, Math.min(1, base + pendingIntensity));
    const register  = Math.max(-2, Math.min(2, pendingRegister));
    const lengthMul = Math.max(0.5, Math.min(3, pendingLength));

    sections.push({
      type: ch,
      intensity,
      register,
      lengthMul,
      index: index++,
    });

    // modifiers only affect the next section, not all subsequent ones
    pendingIntensity = 0;
    pendingRegister  = 0;
    pendingLength    = 1;
  }

  return sections;
}

export function applySectionToParams(baseParams, section) {
  const k = section.intensity; // 0..1

  return {
    ...baseParams,
    // Dynamics scales linearly with intensity (clamped to a musical range)
    dynamics:      Math.max(0.2, Math.min(1, baseParams.dynamics * (0.6 + k * 0.8))),
    // Denser sections fill more of the bar with notes
    rhythmDensity: Math.max(0.1, Math.min(1, baseParams.rhythmDensity * (0.5 + k * 1.0))),
    // Register shift: doubles or halves the perceived root octave via fmCarrier
    // (composition.js uses ROOTS[archetype]; we fold register into a transpose
    // factor that the audio engine can read separately)
    transpose:     Math.pow(2, section.register),
    // Section-aware metadata for the renderer / visualiser
    sectionType:   section.type,
    sectionIndex:  section.index,
    lengthMul:     section.lengthMul,
  };
}

// One-shot helper: scene params -> ordered list of section param objects.
export function generatePiece(params) {
  const grammar = GRAMMARS[params.archetype] ?? GRAMMARS.tense;
  const expanded = expand(grammar);
  const sections = renderStructure(expanded);

  const piece = sections.map(s => ({
    section: s,
    params:  applySectionToParams(params, s),
  }));

  return { axiom: grammar.axiom, expanded, sections, piece };
}

export { GRAMMARS, SECTION_SYMBOLS, MODIFIER_SYMBOLS, BASE_INTENSITY };
