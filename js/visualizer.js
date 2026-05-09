// Draws the L-system phrase structure on a canvas and animates a playhead
// that tracks AudioContext.currentTime as the music plays.

const COLORS = {
  a:      '#555555',
  b:      '#aaaaaa',
  c:      '#111111',
  r:      null,
  active: '#d47c2f',
  text:   '#888888',
};

// compute start/end times for each phrase, mirroring audioEngine.play() logic
function computePhraseTimes(structure, params, startTime) {
  const beatDuration = 60 / params.tempo;
  let cursor = startTime;
  return structure.map(({ symbol, intensity }) => {
    const start = cursor;
    if (symbol === 'r') {
      cursor += beatDuration * 4;
    } else {
      const scaledDensity = params.rhythmDensity * (0.5 + intensity * 0.5);
      const phraseBeats = Math.round(4 + scaledDensity * 12);
      cursor += phraseBeats * beatDuration;
    }
    return { start, end: cursor, symbol, intensity };
  });
}

export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx2d  = canvas.getContext('2d');
    this._rafId = null;
  }

  // structure: [{ symbol, intensity }]
  // params: musical params from sceneParser
  // audioCtx: live AudioContext
  start(structure, params, audioCtx) {
    this.stop();
    const startTime = audioCtx.currentTime + 0.1;
    const phraseTimes = computePhraseTimes(structure, params, startTime);
    this._loop(structure, phraseTimes, audioCtx);
  }

  stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _loop(structure, phraseTimes, audioCtx) {
    this._draw(structure, phraseTimes, audioCtx.currentTime);
    this._rafId = requestAnimationFrame(
      () => this._loop(structure, phraseTimes, audioCtx)
    );
  }

  _draw(structure, phraseTimes, now) {
    const canvas = this.canvas;
    const ctx    = this.ctx2d;
    const dpr    = window.devicePixelRatio || 1;

    const W = canvas.offsetWidth  || 600;
    const H = canvas.offsetHeight || 120;

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, W, H);

    const n      = structure.length;
    const barW   = W / n;
    const maxBarH = H * 0.72;
    const baseY  = H * 0.88;

    // find active phrase
    let activeIdx = -1;
    for (let i = 0; i < phraseTimes.length; i++) {
      if (now >= phraseTimes[i].start && now < phraseTimes[i].end) {
        activeIdx = i;
        break;
      }
    }

    for (let i = 0; i < n; i++) {
      const { symbol, intensity } = structure[i];
      const pt       = phraseTimes[i];
      const isActive = i === activeIdx;
      const isPast   = now >= pt.end;
      const x        = i * barW;
      const barH     = Math.max(3, intensity * maxBarH);
      const y        = baseY - barH;
      const pad      = 3;

      if (symbol === 'r') {
        ctx.strokeStyle = isActive ? COLORS.active : '#cccccc';
        ctx.lineWidth   = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x + pad, y, barW - pad * 2, barH);
        ctx.setLineDash([]);
      } else {
        let color = COLORS[symbol] ?? COLORS.a;
        if (isActive) color = COLORS.active;
        else if (isPast) color = color + '66'; // fade past phrases

        ctx.fillStyle = color;
        ctx.fillRect(x + pad, y, barW - pad * 2, barH);

        // progress fill within active bar
        if (isActive && pt.end > pt.start) {
          const progress = (now - pt.start) / (pt.end - pt.start);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(x + pad, y, (barW - pad * 2) * progress, barH);
        }
      }

      // symbol label
      ctx.fillStyle = isActive ? COLORS.active : COLORS.text;
      ctx.font      = `${Math.max(9, Math.floor(barW * 0.35))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(symbol, x + barW / 2, baseY + 14);
    }

    // Playhead line
    if (activeIdx >= 0) {
      const pt       = phraseTimes[activeIdx];
      const progress = (now - pt.start) / (pt.end - pt.start);
      const px       = activeIdx * barW + progress * barW;
      ctx.strokeStyle = COLORS.active;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, baseY + 4);
      ctx.stroke();
    }
  }

  // draw the static structure before playback starts
  drawStatic(structure, params) {
    const phraseTimes = computePhraseTimes(structure, params, 0);
    this._draw(structure, phraseTimes, -1);
  }
}
