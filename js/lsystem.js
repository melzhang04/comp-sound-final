// L-system (Lindenmayer system) for macro-level compositional structure.
// expands an axiom string using rewriting rules to produce a sequence of
// phrase directives: when to build, pull back, climax, or rest.
//
// Symbols:
//   a = normal phrase  (intensity 0.65)
//   b = soft phrase    (intensity 0.35)
//   c = climax phrase  (intensity 1.00)
//   r = rest/silence   (intensity 0.00)

const SYMBOL_INTENSITY = { a: 0.65, b: 0.35, c: 1.0, r: 0.0 };

// each archetype has a distinct narrative shape
const L_SYSTEMS = {
  tense: {
    axiom: 'aab',
    rules: { a: 'ab', b: 'ca', c: 'bc' },
    // produces a tightening, irregular build with peaks
  },
  romantic: {
    axiom: 'aba',
    rules: { a: 'ab', b: 'bab' },
    // arch shape: rises toward center then resolves
  },
  epic: {
    axiom: 'a',
    rules: { a: 'abca', b: 'ab', c: 'cac' },
    // escalates toward multiple climaxes
  },
  mysterious: {
    axiom: 'arb',
    rules: { a: 'arb', b: 'ba', r: 'rr' },
    // sparse, unpredictable, lots of silence
  },
  peaceful: {
    axiom: 'aba',
    rules: { a: 'aba', b: 'b' },
    // gentle, self-similar waves
  },
  melancholic: {
    axiom: 'cba',
    rules: { c: 'cb', b: 'ba', a: 'ar' },
    // descends from intensity toward silence
  },
};

// expand the axiom by applying rules until the string reaches targetLength.
// Caps rests at 40% of total to keep mysterious from becoming pure silence.
function expand(axiom, rules, targetLength) {
  let str = axiom;
  while (str.length < targetLength) {
    const next = str.split('').map(s => rules[s] ?? s).join('');
    if (next.length === str.length) break; // no rules fired, stop
    str = next;
  }
  // trim to targetLength
  return str.slice(0, targetLength);
}

function capRests(symbols, maxRestFraction = 0.4) {
  const maxRests = Math.floor(symbols.length * maxRestFraction);
  let restCount = 0;
  return symbols.map(s => {
    if (s === 'r') {
      if (restCount >= maxRests) return 'b'; // demote excess rests to soft phrases
      restCount++;
    }
    return s;
  });
}

// returns an array of phrase directives: [{ symbol, intensity }, ...]
export function generateStructure(archetype, targetLength = 16) {
  const sys = L_SYSTEMS[archetype] ?? L_SYSTEMS.tense;
  const raw = expand(sys.axiom, sys.rules, targetLength);
  const symbols = capRests(raw.split(''));

  return symbols.map(symbol => ({
    symbol,
    intensity: SYMBOL_INTENSITY[symbol] ?? 0.65,
  }));
}

// returns just the intensity curve as a number array (useful for visualizer)
export function getIntensityCurve(archetype, targetLength = 16) {
  return generateStructure(archetype, targetLength).map(d => d.intensity);
}
