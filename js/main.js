import { parseScene }       from './sceneParser.js';
import { generateStructure } from './lsystem.js';
import { generatePhrase }    from './composition.js';
import { AudioEngine }       from './audioEngine.js';
import { Visualizer }        from './visualizer.js';

const input      = document.getElementById('sceneInput');
const output     = document.getElementById('output');
const tbody      = document.querySelector('#scoresTable tbody');
const playBtn    = document.getElementById('playBtn');
const stopBtn    = document.getElementById('stopBtn');
const statusText = document.getElementById('statusText');

const engine     = new AudioEngine();
const visualizer = new Visualizer(document.getElementById('visualizerCanvas'));
let currentParams    = null;
let currentStructure = null;

// analyse on Enter
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  const p = parseScene(text);
  currentParams    = p;
  currentStructure = generateStructure(p.archetype, 16);

  // Score table
  const maxScore = Math.max(...Object.values(p.scores), 1);
  tbody.innerHTML = Object.entries(p.scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => `
      <tr>
        <td>${name}</td>
        <td>${score}</td>
        <td><div class="bar"><div class="bar-fill" style="width:${Math.round(score / maxScore * 100)}%"></div></div></td>
      </tr>`)
    .join('');

  // Params
  document.getElementById('pArchetype').textContent = p.archetype;
  document.getElementById('pScale').textContent     = p.scale;
  document.getElementById('pTempo').textContent     = p.tempo + ' bpm';
  document.getElementById('pFM').textContent        = p.fmCarrier + ':' + p.fmModulator;
  document.getElementById('pReverb').textContent    = p.reverbWet;
  document.getElementById('pDensity').textContent   = p.rhythmDensity;
  document.getElementById('pDynamics').textContent  = p.dynamics;
  document.getElementById('pFilter').textContent    = p.filterType + ' @ ' + p.filterFreq + ' Hz';

  // Draw static L-system structure on canvas
  visualizer.drawStatic(currentStructure, p);

  output.style.display = 'block';
  playBtn.disabled = false;
  statusText.textContent = 'ready';
});

// play
playBtn.addEventListener('click', async () => {
  if (!currentParams || !currentStructure) return;

  await engine.init();
  engine.stop();

  playBtn.disabled = true;
  stopBtn.disabled = false;
  statusText.textContent = 'playing…';

  engine.play(currentStructure, generatePhrase, currentParams);
  visualizer.start(currentStructure, currentParams, engine.ctx);

  const beatDuration = 60 / currentParams.tempo;
  const totalDuration = currentStructure.reduce((acc, { symbol, intensity }) => {
    if (symbol === 'r') return acc + beatDuration * 4;
    const phraseBeats = Math.round(4 + (currentParams.rhythmDensity * (0.5 + intensity * 0.5)) * 12);
    return acc + phraseBeats * beatDuration;
  }, 0);

  setTimeout(() => {
    visualizer.stop();
    playBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = 'done';
  }, totalDuration * 1000 + 500);
});

// stop
stopBtn.addEventListener('click', () => {
  engine.stop();
  visualizer.stop();
  playBtn.disabled = false;
  stopBtn.disabled = true;
  statusText.textContent = 'stopped';
});
