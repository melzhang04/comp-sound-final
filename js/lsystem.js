// L-system (Lindenmayer system) for macro-level compositional structure.
// stochastic variant: each symbol has 2-3 possible expansions chosen randomly,
// so the structure is different on every run.
// parametric intensity: instead of 3 fixed levels, each phrase's intensity
// is shaped by a per archetype envelope function of its position in the piece.
//
// Symbols:
//   a = normal phrase
//   b = soft phrase
//   c = climax phrase
//   r = rest/silence

// how much each symbol type boosts or cuts the envelope value at that position.
// the envelope gives the energy "shape"
const SYMBOL_MULT = { a: 1.0, b: 0.5, c: 1.5, r: 0 };

const L_SYSTEMS = {
  tense: {
    axiom: 'aab',
    rules: {
      // irregular, jagged, tension doesn't build cleanly
      a: ['ab', 'acb', 'aab'],
      b: ['bca', 'bab', 'cab'],
      c: ['bc', 'cbc', 'cab'],
    },
    
    envelope: t => 0.35 + 0.65 * Math.pow(Math.abs(Math.sin(t * Math.PI * 2.7 + 0.4)), 0.5),
  },

  romantic: {
    axiom: 'aba',
    rules: {
      // arch shape, quiet open, swell in the middle, resolve quietly
      a: ['ab', 'aba', 'aab'],
      b: ['bab', 'cab', 'bcb'],
    },
    envelope: t => 0.25 + 0.75 * Math.sin(Math.PI * t),
  },

  epic: {
    axiom: 'a',
    rules: {
      // escalates continuously, every expansion adds more weight
      a: ['abca', 'abcca', 'acba'],
      b: ['abb', 'bab', 'abc'],
      c: ['cac', 'cbc', 'cca'],
    },
    // linear ramp, the whole piece is a single long build
    envelope: t => 0.2 + 0.8 * t,
  },

  mysterious: {
    axiom: 'arb',
    rules: {
      // silences scatter unpredictably
      a: ['arb', 'abr', 'rab'],
      b: ['bra', 'rba', 'bar'],
      r: ['rr', 'rar', 'rba'],
    },
    // slow undulating wave, energy never settles or fully resolves
    envelope: t => 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2.8 - 0.5)),
  },

  peaceful: {
    axiom: 'aba',
    rules: {
      // gentle self-similar waves, no hard climaxes
      a: ['aba', 'aab', 'abba'],
      b: ['bab', 'bba', 'abb'],
    },
    // stays comfortably high, serene plateau with a soft arch
    envelope: t => 0.55 + 0.35 * Math.sin(Math.PI * t),
  },

  melancholic: {
    axiom: 'cba',
    rules: {
      // opens heavy, slowly dissolves into silence
      c: ['cba', 'cab', 'cbba'],
      b: ['bar', 'bra', 'bab'],
      a: ['arb', 'aba', 'arr'],
    },
    // high start, steady fade
    envelope: t => 0.95 - 0.6 * t,
  },
};

function pickRule(rules, symbol) {
  const options = rules[symbol];
  if (!options) return symbol;
  return options[Math.floor(Math.random() * options.length)];
}

function expand(axiom, rules, targetLength) {
  let str = axiom;
  while (str.length < targetLength) {
    const next = str.split('').map(s => pickRule(rules, s)).join('');
    if (next.length === str.length) break;
    str = next;
  }
  return str.slice(0, targetLength);
}

function capRests(symbols, maxRestFraction = 0.4) {
  const maxRests = Math.floor(symbols.length * maxRestFraction);
  let restCount = 0;
  return symbols.map(s => {
    if (s === 'r') {
      if (restCount >= maxRests) return 'b';
      restCount++;
    }
    return s;
  });
}

export function generateStructure(archetype, targetLength = 16) {
  const sys     = L_SYSTEMS[archetype] ?? L_SYSTEMS.tense;
  const raw     = expand(sys.axiom, sys.rules, targetLength);
  const symbols = capRests(raw.split(''));
  const n       = symbols.length;

  return symbols.map((symbol, i) => {
    if (symbol === 'r') return { symbol, intensity: 0 };
    const t        = n > 1 ? i / (n - 1) : 0.5;
    const envelope = sys.envelope(t);
    const mult     = SYMBOL_MULT[symbol] ?? 1.0;
    const intensity = Math.max(0.08, Math.min(1.0, envelope * mult));
    return { symbol, intensity };
  });
}

export function getIntensityCurve(archetype, targetLength = 16) {
  return generateStructure(archetype, targetLength).map(d => d.intensity);
}
