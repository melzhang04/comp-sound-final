import { parseScene }               from './sceneParser.js';
import { generatePiece, GRAMMARS }  from './lsystem.js';
import { CinematicEngine }          from './audio.js';

const textarea        = document.getElementById('sceneInput');
const analysisPanel   = document.getElementById('analysisPanel');
const archetypeScores = document.getElementById('archetypeScores');
const detectedSection = document.getElementById('detectedSection');
const detectedTags    = document.getElementById('detectedTags');
const paramGrid       = document.getElementById('paramGrid');
const dominantBadge   = document.getElementById('dominantBadge');
const arcDescription  = document.getElementById('arcDescription');
const screenOverlay   = document.getElementById('screenOverlay');
const playBtn         = document.getElementById('playBtn');
const stopBtn         = document.getElementById('stopBtn');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');
const charCount       = document.getElementById('charCount');
const canvas          = document.getElementById('visualizerCanvas');

const engine = new CinematicEngine();
let latestParams        = null;
let latestPiece         = null;
let highlightRAF        = 0;
let seekOffsetFraction  = 0; // visual fraction where current playback started

const ARCHETYPE_COLORS = {
  tense:       'var(--col-tense)',
  romantic:    'var(--col-romantic)',
  epic:        'var(--col-epic)',
  mysterious:  'var(--col-mysterious)',
  peaceful:    'var(--col-peaceful)',
  melancholic: 'var(--col-melancholic)',
};

const ARCHETYPE_DESCRIPTIONS = {
  tense:       'phrygian dominant · driving 8th-note pulse · staccato',
  romantic:    'lydian · legato melody · lush maj7 pads',
  epic:        'hungarian minor · marching stomp · brass attack',
  mysterious:  'octatonic · sparse bass · bell/glass timbre',
  peaceful:    'pentatonic major · step-wise melody · harp pads',
  melancholic: 'harmonic minor · bowed bass · fading arc',
};

const ARC_DESCRIPTIONS = {
  tense:       'irregular bursts · tension never fully resolves',
  romantic:    'quiet open · swells in the middle · soft resolve',
  epic:        'single continuous build from first phrase to last',
  mysterious:  'scattered silences · energy never settles',
  peaceful:    'gentle waves · serene plateau throughout',
  melancholic: 'opens heavy · slowly dissolves into silence',
};

// Canvas bar colors per L-system section type — distinct enough to tell apart at a glance
const SECTION_COLORS = {
  I: '#a8b4be',  // muted blue-gray   — quiet intro
  A: '#7898b8',  // dusty blue        — theme A
  B: '#6a9e8a',  // sage teal         — theme B
  D: '#c0a050',  // muted ochre       — development
  C: '#b87060',  // muted terracotta  — climax
  R: '#9488b8',  // dusty lavender    — resolution
  O: '#c8c0b8',  // warm light gray   — outro fade
};

textarea.addEventListener('input', () => {
  if (charCount) charCount.textContent = textarea.value.length;
});

textarea.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const text = textarea.value.trim();
  if (!text) return;

  engine.stop();
  cancelAnimationFrame(highlightRAF);

  const p     = parseScene(text);
  const piece = generatePiece(p);
  latestParams = p;
  latestPiece  = piece;

  renderScores(p);
  renderDetected(p);
  renderParams(p);
  arcDescription.textContent = ARC_DESCRIPTIONS[p.archetype] ?? '';

  drawCanvas(piece.sections, -1);
  screenOverlay.classList.add('hidden');
  analysisPanel.classList.add('visible');
  playBtn.disabled = false;
  setStatus('ready');
});

// ── Render helpers ────────────────────────────────────────────────

function renderScores(p) {
  const maxScore = Math.max(...Object.values(p.scores), 1);
  const sorted   = Object.entries(p.scores).sort((a, b) => b[1] - a[1]);
  const color    = ARCHETYPE_COLORS[p.archetype];

  dominantBadge.textContent       = p.archetype;
  dominantBadge.style.color       = color;
  dominantBadge.style.borderColor = color;

  archetypeScores.innerHTML = sorted.map(([name, score]) => {
    const pct      = Math.round(score / maxScore * 100);
    const col      = ARCHETYPE_COLORS[name];
    const dominant = name === p.archetype;
    return `
      <div class="archetype-row ${dominant ? 'dominant' : ''}">
        <div class="archetype-row-top">
          <span class="arch-color-dot" style="background:${col}"></span>
          <span class="arch-name" ${dominant ? `style="color:${col}"` : ''}>${name}</span>
          <span class="arch-score">${score > 0 ? score : '—'}</span>
        </div>
        ${score > 0 ? `
          <div class="arch-bar-track">
            <div class="arch-bar-fill" style="width:${pct}%;background:${col}"></div>
          </div>
          <span class="arch-desc">${ARCHETYPE_DESCRIPTIONS[name] ?? ''}</span>
        ` : ''}
      </div>`;
  }).join('');
}

function renderDetected(p) {
  const keywords = p.matchedKeywords ?? [];
  const seen     = new Set();
  const chips    = keywords
    .filter(k => { if (seen.has(k.label)) return false; seen.add(k.label); return true; })
    .slice(0, 12)
    .map(k => {
      const cls = k.source === 'cinematic' ? 'tag-cinematic'
                : k.source === 'phrase'    ? 'tag-genre'
                : 'tag-modifier';
      return `<span class="tag ${cls}">${k.label}</span>`;
    });

  if (chips.length === 0) {
    detectedSection.style.display = 'none';
  } else {
    detectedSection.style.display = '';
    detectedTags.innerHTML = chips.join('');
  }
}

function renderParams(p) {
  const entries = [
    { key: 'Archetype',  val: p.archetype,              color: ARCHETYPE_COLORS[p.archetype] },
    { key: 'Scale',      val: p.scale.replace(/_/g, ' ')                                     },
    { key: 'Tempo',      val: p.tempo + ' bpm',          bar: (p.tempo - 30) / 190            },
    { key: 'FM ratio',   val: p.fmCarrier + ':' + p.fmModulator                              },
    { key: 'Reverb',     val: p.reverbWet,               bar: p.reverbWet                     },
    { key: 'Density',    val: p.rhythmDensity,           bar: p.rhythmDensity                 },
    { key: 'Dynamics',   val: p.dynamics,                bar: p.dynamics                      },
    { key: 'Complexity', val: p.complexity ?? '—',       bar: p.complexity                    },
  ];

  paramGrid.innerHTML = entries.map(({ key, val, bar, color }) => `
    <div class="param-cell">
      <div class="param-key">${key}</div>
      <div class="param-val"${color ? ` style="color:${color}"` : ''}>${val}</div>
      ${bar != null ? `
        <div class="param-bar-track">
          <div class="param-bar-fill" style="width:${Math.round(Math.min(1, Math.max(0, bar)) * 100)}%"></div>
        </div>` : ''}
    </div>`).join('');
}

// ── Canvas visualizer ─────────────────────────────────────────────
// playheadFraction: 0..1 = position through the piece, -1 = no playhead

function drawCanvas(sections, playheadFraction) {
  const ctx2d = canvas.getContext('2d');
  const dpr   = window.devicePixelRatio || 1;
  const W     = canvas.offsetWidth  || 600;
  const H     = canvas.offsetHeight || 120;

  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx2d.scale(dpr, dpr);
  }

  ctx2d.clearRect(0, 0, W, H);

  const n                  = sections.length;
  const barW               = W / n;
  const maxBarH            = H * 0.72;
  const baseY              = H * 0.88;
  const pad                = 3;
  const activeSectionIndex = playheadFraction >= 0
    ? Math.min(n - 1, Math.floor(playheadFraction * n))
    : -1;

  for (let i = 0; i < n; i++) {
    const { type, intensity } = sections[i];
    const isActive = i === activeSectionIndex;
    const isPast   = activeSectionIndex >= 0 && i < activeSectionIndex;
    const barH     = Math.max(3, intensity * maxBarH);
    const x        = i * barW;
    const y        = baseY - barH;

    let color = SECTION_COLORS[type] ?? '#9a8878';
    if (isPast) color += '66';

    ctx2d.fillStyle = color;
    ctx2d.fillRect(x + pad, y, barW - pad * 2, barH);

    ctx2d.fillStyle = isActive ? '#c05030' : '#9c7c65';
    ctx2d.font      = '11px monospace';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(type, x + barW / 2, baseY + 13);
  }

  if (playheadFraction >= 0) {
    const x = playheadFraction * W;
    ctx2d.strokeStyle = '#c05030';
    ctx2d.lineWidth   = 1.5;
    ctx2d.beginPath();
    ctx2d.moveTo(x, 0);
    ctx2d.lineTo(x, baseY + 4);
    ctx2d.stroke();

    // Small triangle handle at the top
    ctx2d.fillStyle = '#c05030';
    ctx2d.beginPath();
    ctx2d.moveTo(x - 5, 0);
    ctx2d.lineTo(x + 5, 0);
    ctx2d.lineTo(x, 7);
    ctx2d.closePath();
    ctx2d.fill();
  }
}

// ── Playback highlight loop ───────────────────────────────────────

function highlightLoop() {
  if (!latestPiece) return;

  const pos = engine.currentPosition();
  let fraction;
  if (engine.isPlaying) {
    const p = Math.max(0, pos); // clamp negative pre-roll to 0
    fraction = engine.totalDuration > 0
      ? Math.min(1, seekOffsetFraction + (p / engine.totalDuration) * (1 - seekOffsetFraction))
      : seekOffsetFraction;
  } else {
    fraction = -1;
  }
  drawCanvas(latestPiece.sections, fraction);

  if (engine.isPlaying) {
    statusText.textContent = `${Math.max(0, pos).toFixed(1)}s / ${engine.totalDuration.toFixed(1)}s`;
    highlightRAF = requestAnimationFrame(highlightLoop);
  } else {
    setStatus('done');
    playBtn.disabled = false;
    stopBtn.disabled = true;
    drawCanvas(latestPiece.sections, -1);
  }
}

// ── Scrubbing ─────────────────────────────────────────────────────

let isScrubbing  = false;
let scrubFraction = 0;

function scrubToFraction(fraction) {
  scrubFraction = Math.max(0, Math.min(1, fraction));
  drawCanvas(latestPiece.sections, scrubFraction);
}

function seekAndPlay(fraction) {
  if (!latestPiece || !latestParams) return;
  const n          = latestPiece.sections.length;
  const sectionIdx = Math.max(0, Math.min(n - 1, Math.floor(fraction * n)));
  seekOffsetFraction = fraction; // keep exact scrub position, no snap
  engine.stop();
  engine.playPiece({ ...latestPiece, piece: latestPiece.piece.slice(sectionIdx) }, latestParams);
  playBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus('playing');
  cancelAnimationFrame(highlightRAF);
  highlightRAF = requestAnimationFrame(highlightLoop);
}

function fractionFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  return (clientX - rect.left) / rect.width;
}

canvas.addEventListener('mousedown', (e) => {
  if (!latestPiece) return;
  isScrubbing = true;
  if (engine.isPlaying) { engine.stop(); cancelAnimationFrame(highlightRAF); }
  scrubToFraction(fractionFromEvent(e));
  canvas.style.cursor = 'ew-resize';
});

window.addEventListener('mousemove', (e) => {
  if (!isScrubbing || !latestPiece) return;
  scrubToFraction(fractionFromEvent(e));
});

window.addEventListener('mouseup', () => {
  if (!isScrubbing) return;
  isScrubbing = false;
  canvas.style.cursor = '';
  seekAndPlay(scrubFraction);
});

canvas.addEventListener('touchstart', (e) => {
  if (!latestPiece) return;
  e.preventDefault();
  isScrubbing = true;
  if (engine.isPlaying) { engine.stop(); cancelAnimationFrame(highlightRAF); }
  scrubToFraction(fractionFromEvent(e));
}, { passive: false });

window.addEventListener('touchmove', (e) => {
  if (!isScrubbing || !latestPiece) return;
  e.preventDefault();
  scrubToFraction(fractionFromEvent(e));
}, { passive: false });

window.addEventListener('touchend', () => {
  if (!isScrubbing) return;
  isScrubbing = false;
  seekAndPlay(scrubFraction);
});

// ── Status ────────────────────────────────────────────────────────

function setStatus(state) {
  statusDot.className = 'status-dot' +
    (state === 'playing' ? ' active' : (state === 'ready' || state === 'done') ? ' done' : '');
  if (state !== 'playing') statusText.textContent = state;
}

// ── Transport ─────────────────────────────────────────────────────

playBtn.addEventListener('click', () => {
  if (!latestPiece || !latestParams) return;
  seekOffsetFraction = 0;
  engine.playPiece(latestPiece, latestParams);
  playBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus('playing');
  cancelAnimationFrame(highlightRAF);
  highlightRAF = requestAnimationFrame(highlightLoop);
});

stopBtn.addEventListener('click', () => {
  engine.stop();
  cancelAnimationFrame(highlightRAF);
  playBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('stopped');
  if (latestPiece) drawCanvas(latestPiece.sections, -1);
});
