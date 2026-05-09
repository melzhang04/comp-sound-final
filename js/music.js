import { lexicon as nrcLexicon } from './nrcLexicon.js';

const ARCHETYPES = ['tense','romantic','epic','mysterious','peaceful','melancholic'];

const PRESETS = {
  tense:      {tempoBase:68,tempoRange:16,scale:'phrygian',fmCarrier:1,fmModulator:2.5,filterType:'highpass',filterFreq:900,reverbWet:0.25,rhythmDensity:0.3,dynamics:0.55},
  romantic:   {tempoBase:64,tempoRange:14,scale:'major',fmCarrier:1,fmModulator:1.5,filterType:'lowpass',filterFreq:1400,reverbWet:0.5,rhythmDensity:0.5,dynamics:0.5},
  epic:       {tempoBase:118,tempoRange:28,scale:'minor',fmCarrier:1,fmModulator:3.0,filterType:'lowpass',filterFreq:2200,reverbWet:0.55,rhythmDensity:0.8,dynamics:0.85},
  mysterious: {tempoBase:54,tempoRange:14,scale:'dorian',fmCarrier:1,fmModulator:4.0,filterType:'bandpass',filterFreq:700,reverbWet:0.7,rhythmDensity:0.35,dynamics:0.45},
  peaceful:   {tempoBase:76,tempoRange:18,scale:'lydian',fmCarrier:1,fmModulator:1.2,filterType:'lowpass',filterFreq:1800,reverbWet:0.4,rhythmDensity:0.55,dynamics:0.5},
  melancholic:{tempoBase:58,tempoRange:14,scale:'aeolian',fmCarrier:1,fmModulator:2.0,filterType:'lowpass',filterFreq:1000,reverbWet:0.5,rhythmDensity:0.4,dynamics:0.45},
};

const SCALE_INTERVALS = {
  major:    [0,2,4,5,7,9,11],
  minor:    [0,2,3,5,7,8,10],
  aeolian:  [0,2,3,5,7,8,10],
  dorian:   [0,2,3,5,7,9,10],
  phrygian: [0,1,3,5,7,8,10],
  lydian:   [0,2,4,6,7,9,11],
};

// ─── PITCH SET THEORY ─────────────────────────────────────────────────────────
// Archetype → initial pitch class set (normal form)
const ARCHETYPE_PITCH_SETS = {
  tense:      [0,1,3,4,6],   // ic-heavy, dissonant
  romantic:   [0,2,4,7,9],   // pentatonic-flavoured, open
  epic:       [0,2,5,7,10],  // quartal, powerful
  mysterious: [0,1,4,6,8],   // whole-tone fragments
  peaceful:   [0,2,4,6,9],   // lydian-flavoured
  melancholic:[0,2,3,7,8],   // minor with flat-6
};

function transpose(pitchSet, n) {
  return pitchSet.map(p => (p + n) % 12);
}

function invert(pitchSet) {
  const first = pitchSet[0];
  return pitchSet.map(p => (first * 2 - p + 12) % 12);
}

function retrograde(pitchSet) {
  return [...pitchSet].reverse();
}

function retrogradInverse(pitchSet) {
  return retrograde(invert(pitchSet));
}

const OPS = ['T','I','R','RI'];

function applyRandomOp(pitchSet) {
  const op = OPS[Math.floor(Math.random() * OPS.length)];
  let result, label;
  if (op === 'T') {
    const n = Math.floor(Math.random() * 11) + 1;
    result = transpose(pitchSet, n);
    label = `T${n}`;
  } else if (op === 'I') {
    result = invert(pitchSet);
    label = 'I';
  } else if (op === 'R') {
    result = retrograde(pitchSet);
    label = 'R';
  } else {
    result = retrogradInverse(pitchSet);
    label = 'RI';
  }
  return { result, label };
}

function pitchSetToFreqs(pitchSet, rootHz) {
  // Map pitch classes 0–11 to semitones above root
  return pitchSet.map(pc => rootHz * Math.pow(2, pc / 12));
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean);
}

function parseScene(description) {
  const tokens = tokenize(description);
  const scores = Object.fromEntries(ARCHETYPES.map(a => [a, 0]));

  for (const token of tokens) {
    const nrc = nrcLexicon[token];

    if (nrc) {
      for (const [a, v] of Object.entries(nrc)) {
        if (scores[a] !== undefined) {
          scores[a] += v;
        }
      }
    }
  }

  const total = Object.values(scores).reduce((a,b) => a+b, 0);
  let dominant = 'mysterious';
  let maxScore = -1;
  for (const [name, score] of Object.entries(scores)) {
    if (score > maxScore) { maxScore = score; dominant = name; }
  }

  function blendParam(field) {
    if (total === 0) return PRESETS[dominant][field];
    let v = 0;
    for (const [name, score] of Object.entries(scores)) v += (score/total) * PRESETS[name][field];
    return v;
  }

  const preset = PRESETS[dominant];
  return {
    archetype: dominant,
    tempo: Math.round(blendParam('tempoBase') + (Math.random()*blendParam('tempoRange') - blendParam('tempoRange')/2)),
    scale: preset.scale,
    fmCarrier: preset.fmCarrier,
    fmModulator: Math.round(blendParam('fmModulator') * 10) / 10,
    filterType: preset.filterType,
    filterFreq: Math.round(blendParam('filterFreq')),
    reverbWet: Math.round(blendParam('reverbWet') * 100) / 100,
    rhythmDensity: Math.round(blendParam('rhythmDensity') * 100) / 100,
    dynamics: Math.round(blendParam('dynamics') * 100) / 100,
    scores,
  };
}

// ─── WEBAUDIO FM ENGINE ───────────────────────────────────────────────────────
let audioCtx = null;
let isPlaying = false;
let stopFlag = false;
let currentParams = null;
let masterGain = null;
let filterNode = null;
let reverbNode = null;
let reverbGain = null;
let dryGain = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// Simple synthetic reverb via IIR-like feedback delay
function createReverb(ctx, wetLevel) {
  const convolver = ctx.createConvolver();
  const len = ctx.sampleRate * 2.5;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
  }
  convolver.buffer = buf;
  return convolver;
}

// Play a single FM note
function playFMNote(ctx, freq, duration, startTime, params, destination) {
  const { fmCarrier, fmModulator, dynamics } = params;

  // Modulator
  const modFreq = freq * fmModulator;
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  modulator.type = 'sine';
  modulator.frequency.setValueAtTime(modFreq, startTime);
  const modIndex = modFreq * 2.5 * dynamics;
  modGain.gain.setValueAtTime(modIndex, startTime);
  modGain.gain.exponentialRampToValueAtTime(modIndex * 0.1, startTime + duration * 0.8);
  modulator.connect(modGain);

  // Carrier
  const carrier = ctx.createOscillator();
  const envGain = ctx.createGain();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(freq * fmCarrier, startTime);
  modGain.connect(carrier.frequency);

  // Envelope
  const peak = 0.18 * dynamics;
  envGain.gain.setValueAtTime(0, startTime);
  envGain.gain.linearRampToValueAtTime(peak, startTime + 0.02);
  envGain.gain.exponentialRampToValueAtTime(peak * 0.6, startTime + duration * 0.4);
  envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  carrier.connect(envGain);
  envGain.connect(destination);

  modulator.start(startTime);
  modulator.stop(startTime + duration + 0.05);
  carrier.start(startTime);
  carrier.stop(startTime + duration + 0.05);
}

// ─── MUSIC LOOP ───────────────────────────────────────────────────────────────
const opsLogEl = document.getElementById('opsLog');
const currentSetEl = document.getElementById('currentSet');
const statusBar = document.getElementById('statusBar');

function startDrone(ctx, freqs, params, destination) {
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0, ctx.currentTime);
  droneGain.gain.linearRampToValueAtTime(0.08 * params.dynamics, ctx.currentTime + 2.0);

  freqs.slice(0, 3).forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = i === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq * 0.5, ctx.currentTime);

    gain.gain.setValueAtTime(0.03, ctx.currentTime);

    osc.connect(gain);
    gain.connect(droneGain);

    osc.start();
  });

  droneGain.connect(destination);
  return droneGain;
}

async function startMusic(params) {
  stopFlag = false;
  isPlaying = true;

  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') await ctx.resume();

  // Master chain
  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.7, ctx.currentTime);

  filterNode = ctx.createBiquadFilter();
  filterNode.type = params.filterType;
  filterNode.frequency.setValueAtTime(params.filterFreq, ctx.currentTime);
  filterNode.Q.setValueAtTime(0.8, ctx.currentTime);

  reverbNode = createReverb(ctx, params.reverbWet);
  reverbGain = ctx.createGain();
  reverbGain.gain.setValueAtTime(params.reverbWet, ctx.currentTime);
  dryGain = ctx.createGain();
  dryGain.gain.setValueAtTime(1 - params.reverbWet * 0.5, ctx.currentTime);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, ctx.currentTime);
  compressor.ratio.setValueAtTime(4, ctx.currentTime);

  // Routing: masterGain → filter → dry+wet → compressor → destination
  masterGain.connect(filterNode);
  filterNode.connect(dryGain);
  filterNode.connect(reverbNode);
  reverbNode.connect(reverbGain);
  dryGain.connect(compressor);
  reverbGain.connect(compressor);
  compressor.connect(ctx.destination);

  // Pitch set engine
  const rootHz = 130.81; // C3
  let currentSet = [...ARCHETYPE_PITCH_SETS[params.archetype]];
  const initialFreqs = pitchSetToFreqs(currentSet, rootHz);
  const drone = startDrone(ctx, initialFreqs, params, masterGain);
  const beatDuration = 60 / params.tempo;
  const opLabels = [];

  updateOpsLog(opLabels);
  updateCurrentSet(currentSet);

  let phraseCount = 0;

  while (!stopFlag) {
    phraseCount++;

    // Every phrase: apply an operation to the pitch set
    if (phraseCount > 1) {
      const { result, label } = applyRandomOp(currentSet);
      currentSet = result;
      opLabels.push(label);
      if (opLabels.length > 12) opLabels.shift();
      updateOpsLog(opLabels);
      updateCurrentSet(currentSet);
    }

    // Get frequencies for this phrase from pitch set
    const freqs = pitchSetToFreqs(currentSet, rootHz);

    // Build a phrase of notes: 6–10 notes
    const noteCount = 6 + Math.floor(params.rhythmDensity * 6);
    const noteDuration = beatDuration * 1.4;
    const phraseLen = noteCount * noteDuration * 1000; // ms

    let t = ctx.currentTime;
    for (let i = 0; i < noteCount; i++) {
      if (stopFlag) break;
      const isRest = Math.random() < 0.15;
      if (!isRest) {
        // pick a freq from current set, possibly an octave up
        const octave = Math.random() < 0.3 ? 2 : 1;
        const freq = freqs[Math.floor(Math.random() * freqs.length)] * octave;
        const dur = noteDuration * (0.5 + Math.random() * 0.7);
        playFMNote(ctx, freq, dur, t, params, masterGain);
      }
      t += noteDuration;
    }

    setStatus('playing', `Phrase ${phraseCount} · ${params.archetype} · ${params.tempo} bpm`);

    // Wait for phrase to finish
    await sleep(phraseLen);
  }

  // Fade out
  masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  await sleep(1600);
  isPlaying = false;
  updatePlayStop(false);
  setStatus('', '');
}

function stopMusic() {
  stopFlag = true;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function updateOpsLog(labels) {
  if (labels.length === 0) {
    opsLogEl.innerHTML = '<span style="color:var(--dim)">Awaiting first phrase…</span>';
    return;
  }
  opsLogEl.innerHTML = labels.map((l,i) => {
    const isLatest = i === labels.length - 1;
    return `<span class="op-entry" style="${isLatest ? 'color:var(--accent);font-weight:700' : ''}">${l}</span>`;
  }).join(' → ');
}

function updateCurrentSet(set) {
  currentSetEl.innerHTML = `Current set: <span>[${set.join(', ')}]</span>`;
}

function setStatus(type, msg) {
  statusBar.className = `status-bar${type ? ' '+type : ''}`;
  statusBar.innerHTML = type === 'playing'
    ? `<span class="blink">●</span> ${msg}`
    : msg;
}

function updatePlayStop(playing) {
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  if (playing) {
    playBtn.style.display = 'none';
    stopBtn.style.display = '';
  } else {
    playBtn.style.display = '';
    stopBtn.style.display = 'none';
    playBtn.classList.remove('active');
  }
}

// ─── MAIN INTERACTION ─────────────────────────────────────────────────────────
const sceneInput = document.getElementById('sceneInput');
const outputEl = document.getElementById('output');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');

sceneInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const text = sceneInput.value.trim();
  if (!text) return;
  analyzeScene(text);
});

playBtn.addEventListener('click', () => {
  if (!currentParams || isPlaying) return;
  playBtn.classList.add('active');
  updatePlayStop(true);
  startMusic(currentParams);
});

stopBtn.addEventListener('click', () => {
  stopMusic();
  updatePlayStop(false);
  setStatus('', '');
});

function analyzeScene(text) {
  setStatus('analyzing', 'Analysing…');
  const p = parseScene(text);
  currentParams = p;

  // Scores
  const maxScore = Math.max(...Object.values(p.scores), 1);
  const grid = document.getElementById('scoresGrid');
  grid.innerHTML = Object.entries(p.scores)
    .sort((a,b) => b[1]-a[1])
    .map(([name, score]) => {
      const isDom = name === p.archetype;
      const pct = Math.round((score / maxScore) * 100);
      return `
        <div class="score-row">
          <div class="score-name${isDom?' dominant':''}">${name}</div>
          <div class="bar-track">
            <div class="bar-fill${isDom?' dominant':''}" style="width:${pct}%"></div>
          </div>
          <div class="score-val">${score}</div>
        </div>`;
    }).join('');

  // Params
  document.getElementById('pArchetype').textContent = p.archetype;
  document.getElementById('pScale').textContent = p.scale;
  document.getElementById('pTempo').textContent = p.tempo + ' bpm';
  document.getElementById('pFM').textContent = p.fmCarrier + ':' + p.fmModulator;
  document.getElementById('pReverb').textContent = p.reverbWet;
  document.getElementById('pDensity').textContent = p.rhythmDensity;
  document.getElementById('pDynamics').textContent = p.dynamics;
  document.getElementById('pFilter').textContent = p.filterType + ' @ ' + p.filterFreq + ' Hz';

  // Pitch set init
  const initSet = ARCHETYPE_PITCH_SETS[p.archetype];
  updateOpsLog([]);
  updateCurrentSet(initSet);

  outputEl.style.display = 'block';
  playBtn.disabled = false;
  setStatus('', 'Ready · press Play to perform');
}
