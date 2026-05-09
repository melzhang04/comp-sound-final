import { parseScene } from './sceneParser.js';
import { generatePiece, GRAMMARS } from './lsystem.js';
import { CinematicEngine } from './audio.js';

const input        = document.getElementById('sceneInput');
const output       = document.getElementById('output');
const tbody        = document.querySelector('#scoresTable tbody');
const structureEl  = document.getElementById('structure');
const playBtn      = document.getElementById('playBtn');
const stopBtn      = document.getElementById('stopBtn');
const playStatus   = document.getElementById('playStatus');

const engine = new CinematicEngine();

// Latest analysed scene + L-system piece. Re-played by the Play button.
let latestParams = null;
let latestPiece  = null;

function registerColor(reg) {
  // -2 -> #222 (dark/low), 0 -> #555, +2 -> #aaa (light/high)
  const t = (reg + 2) / 4;
  const v = Math.round(34 + t * (170 - 34));
  return `rgb(${v},${v},${v})`;
}

function renderStructureBars(sections) {
  structureEl.innerHTML = sections.map(s => {
    const h = Math.round(8 + s.intensity * 100);
    return `
      <div class="seg" data-idx="${s.index}"
           title="${s.type} · intensity ${s.intensity.toFixed(2)} · register ${s.register >= 0 ? '+' : ''}${s.register}">
        <div class="bar2" style="height:${h}px; background:${registerColor(s.register)}"></div>
        <div class="lbl">${s.type}</div>
      </div>`;
  }).join('');
}

function analyse(text) {
  const p = parseScene(text);

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

  document.getElementById('pArchetype').textContent = p.archetype;
  document.getElementById('pScale').textContent     = p.scale;
  document.getElementById('pTempo').textContent     = p.tempo + ' bpm';
  document.getElementById('pFM').textContent        = p.fmCarrier + ':' + p.fmModulator;
  document.getElementById('pReverb').textContent    = p.reverbWet;
  document.getElementById('pDensity').textContent   = p.rhythmDensity;
  document.getElementById('pDynamics').textContent  = p.dynamics;
  document.getElementById('pFilter').textContent    = p.filterType + ' @ ' + p.filterFreq + ' Hz';

  const complexityEl = document.getElementById('pComplexity');
  const textureEl = document.getElementById('pTexture');
  const confidenceEl = document.getElementById('pConfidence');
  const matchesEl = document.getElementById('pMatches');
  if (complexityEl) complexityEl.textContent = p.complexity ?? '—';
  if (textureEl) textureEl.textContent = p.texture ?? '—';
  if (confidenceEl) confidenceEl.textContent = p.confidence ?? '—';
  if (matchesEl) {
    const labels = (p.matchedKeywords ?? []).map(m => m.label);
    matchesEl.textContent = labels.length ? [...new Set(labels)].slice(0, 8).join(', ') : 'none';
  }

  const piece = generatePiece(p);
  const grammar = GRAMMARS[p.archetype] ?? GRAMMARS.tense;
  document.getElementById('pAxiom').textContent    = grammar.axiom;
  document.getElementById('pExpanded').textContent = piece.expanded;
  renderStructureBars(piece.sections);

  latestParams = p;
  latestPiece  = piece;
  playBtn.disabled = false;
  output.style.display = 'block';
}

input.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  engine.stop();
  analyse(text);
});

let highlightRAF = 0;

function highlightLoop() {
  const idx = engine.currentSectionIndex();
  for (const seg of structureEl.querySelectorAll('.seg')) {
    seg.classList.toggle('playing', Number(seg.dataset.idx) === idx);
  }

  if (engine.isPlaying) {
    const pos = Math.max(0, engine.currentPosition());
    const total = engine.totalDuration;
    playStatus.textContent = `${pos.toFixed(1)}s / ${total.toFixed(1)}s`;
    highlightRAF = requestAnimationFrame(highlightLoop);
  } else {
    playStatus.textContent = '';
    for (const seg of structureEl.querySelectorAll('.seg')) {
      seg.classList.remove('playing');
    }
    playBtn.disabled = !latestPiece;
    stopBtn.disabled = true;
  }
}

playBtn.addEventListener('click', () => {
  if (!latestPiece || !latestParams) return;
  engine.playPiece(latestPiece, latestParams);
  playBtn.disabled = true;
  stopBtn.disabled = false;
  cancelAnimationFrame(highlightRAF);
  highlightRAF = requestAnimationFrame(highlightLoop);
});

stopBtn.addEventListener('click', () => {
  engine.stop();
  cancelAnimationFrame(highlightRAF);
  for (const seg of structureEl.querySelectorAll('.seg')) {
    seg.classList.remove('playing');
  }
  playStatus.textContent = '';
  playBtn.disabled = !latestPiece;
  stopBtn.disabled = true;
});
