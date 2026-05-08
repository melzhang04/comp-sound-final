import { parseScene } from './sceneParser.js';

const input   = document.getElementById('sceneInput');
const output  = document.getElementById('output');
const tbody   = document.querySelector('#scoresTable tbody');

input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  const p = parseScene(text);

  // Score table
  const maxScore = Math.max(...Object.values(p.scores), 1);
  tbody.innerHTML = Object.entries(p.scores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => `
      <tr>
        <td>${name}</td>
        <td>${score}</td>
        <td><div class="bar"><div class="bar-fill" style="width:${Math.round(score/maxScore*100)}%"></div></div></td>
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

  output.style.display = 'block';
});
