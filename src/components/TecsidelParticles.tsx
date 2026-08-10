import { useEffect, useRef } from 'react';

function getSegments(letter: string): [number, number, number, number][] {
  const h = 60, m = h / 2;
  switch (letter) {
    case 'T': return [[0,0,36,0],[18,0,18,h]];
    case 'E': return [[0,0,0,h],[0,0,30,0],[0,m,24,m],[0,h,30,h]];
    case 'C': return [[22,2,6,8],[6,8,0,18],[0,18,0,m],[0,m,0,42],[0,42,6,52],[6,52,22,58]];
    case 'S': return [[26,2,10,0],[10,0,2,6],[2,6,0,14],[0,14,6,22],[6,22,20,m],[20,m,26,38],[26,38,28,46],[28,46,24,54],[24,54,14,60],[14,60,2,58]];
    case 'I': return [[0,0,0,h]];
    case 'D': return [[0,0,0,h],[0,0,14,2],[14,2,24,10],[24,10,28,m],[28,m,24,50],[24,50,14,58],[14,58,0,h]];
    case 'L': return [[0,0,0,h],[0,h,28,h]];
    default:  return [];
  }
}

const LETTER_WIDTHS: Record<string, number> = { T:36, E:32, C:30, S:30, I:4, D:30, L:30 };

interface Seg {
  tax: number; tay: number; tbx: number; tby: number;
  sax: number; say: number; sbx: number; sby: number;
  ax:  number; ay:  number; bx:  number; by:  number;
  alpha: number;
  // per-segment delay offset (0..1) for wave effects
  delay: number;
  index: number;
}

// ── scatter position generators ─────────────────────────────────
function fromEdge(W: number, H: number) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * W, y: -80 };
  if (side === 1) return { x: W + 80,             y: Math.random() * H };
  if (side === 2) return { x: Math.random() * W, y: H + 80 };
  return               { x: -80,                  y: Math.random() * H };
}

function fromCenter(W: number, H: number) {
  const angle = Math.random() * Math.PI * 2;
  const dist  = Math.max(W, H) * 0.7;
  return { x: W / 2 + Math.cos(angle) * dist, y: H / 2 + Math.sin(angle) * dist };
}

function fromCorner(W: number, H: number) {
  const corner = Math.floor(Math.random() * 4);
  const ox = corner % 2 === 0 ? -80 : W + 80;
  const oy = corner < 2       ? -80 : H + 80;
  return { x: ox + (Math.random() - 0.5) * 60, y: oy + (Math.random() - 0.5) * 60 };
}

function fromRandom(W: number, H: number) {
  return { x: (Math.random() - 0.5) * W * 2.5 + W / 2, y: (Math.random() - 0.5) * H * 2.5 + H / 2 };
}

// 4 animation modes
type Mode = 'edges' | 'explode' | 'corners' | 'vortex';
const MODES: Mode[] = ['edges', 'explode', 'corners', 'vortex'];

function getScatterPos(mode: Mode, W: number, H: number) {
  switch (mode) {
    case 'edges':   return fromEdge(W, H);
    case 'explode': return fromCenter(W, H);
    case 'corners': return fromCorner(W, H);
    case 'vortex':  return fromRandom(W, H);
  }
}

function buildSegments(W: number, H: number, mode: Mode): Seg[] {
  const text   = 'TECSIDEL';
  const lh     = 60;
  const scale  = Math.min(W * 0.78 / 260, H * 0.45 / lh);
  const totalW = text.split('').reduce((s, c) => s + (LETTER_WIDTHS[c] ?? 30) + 10, -10) * scale;
  const ox0    = (W - totalW) / 2;
  const oy0    = (H - lh * scale) / 2;
  const segs: Seg[] = [];
  let curX = 0;
  let idx  = 0;
  for (const letter of text) {
    for (const [x1, y1, x2, y2] of getSegments(letter)) {
      const tax = ox0 + (curX + x1) * scale;
      const tay = oy0 + y1 * scale;
      const tbx = ox0 + (curX + x2) * scale;
      const tby = oy0 + y2 * scale;
      const sa  = getScatterPos(mode, W, H);
      const sb  = getScatterPos(mode, W, H);
      segs.push({
        tax, tay, tbx, tby,
        sax: sa.x, say: sa.y, sbx: sb.x, sby: sb.y,
        ax: sa.x, ay: sa.y, bx: sb.x, by: sb.y,
        alpha: 0,
        delay: idx / 36,   // stagger 0..1 across all segments
        index: idx,
      });
      idx++;
    }
    curX += (LETTER_WIDTHS[letter] ?? 30) + 10;
  }
  return segs;
}

// easing functions
const ss    = (t: number) => t * t * (3 - 2 * t);         // smoothstep
const easeIn  = (t: number) => t * t * t;                  // cubic ease-in
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);    // cubic ease-out
const wave    = (t: number, d: number) => ss(Math.max(0, Math.min(1, (t - d * 0.4) / 0.7))); // staggered wave

export default function TecsidelParticles({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;

    let currentMode: Mode = MODES[Math.floor(Math.random() * MODES.length)];
    let nextMode: Mode    = MODES[Math.floor(Math.random() * MODES.length)];
    let segs = buildSegments(W, H, currentMode);

    let phase = 0; // 0=fly-in 1=hold 2=scatter
    let timer = 0;

    const FLY_FRAMES     = 160;
    const SCATTER_FRAMES = 160;
    const HOLD_FRAMES    = 90;

    let raf: number;

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      timer++;

      const tFly  = Math.min(timer / FLY_FRAMES,     1);
      const tScat = Math.min(timer / SCATTER_FRAMES, 1);

      for (const s of segs) {

        if (phase === 0) {
          // ── FLY-IN: style depends on currentMode ───────────
          let e: number;
          if (currentMode === 'vortex') {
            // staggered wave — each segment arrives one by one left→right
            e = wave(tFly, s.delay);
          } else if (currentMode === 'corners') {
            // fast ease-out — snaps into place quickly
            e = easeOut(tFly);
          } else {
            e = ss(tFly);
          }
          s.ax    = s.sax + (s.tax - s.sax) * e;
          s.ay    = s.say + (s.tay - s.say) * e;
          s.bx    = s.sbx + (s.tbx - s.sbx) * e;
          s.by    = s.sby + (s.tby - s.sby) * e;
          s.alpha = Math.min(1, tFly * 1.6);

        } else if (phase === 1) {
          s.ax = s.tax; s.ay = s.tay;
          s.bx = s.tbx; s.by = s.tby;
          // breathing pulse — speed varies by mode
          const freq = currentMode === 'explode' ? 0.08 : 0.055;
          s.alpha = 0.72 + Math.sin(timer * freq) * 0.28;

        } else if (phase === 2) {
          // ── SCATTER: style depends on nextMode (what comes next) ──
          let e: number;
          if (nextMode === 'vortex') {
            // wave scatter — disappears letter by letter right→left
            e = wave(tScat, 1 - s.delay);
          } else if (nextMode === 'explode') {
            // ease-in — slow start then bursts out
            e = easeIn(tScat);
          } else {
            e = ss(tScat);
          }
          s.ax    = s.tax + (s.sax - s.tax) * e;
          s.ay    = s.tay + (s.say - s.tay) * e;
          s.bx    = s.tbx + (s.sbx - s.tbx) * e;
          s.by    = s.tby + (s.sby - s.tby) * e;
          s.alpha = Math.max(0, 1 - e * 1.2);
        }

        if (s.alpha <= 0.01) continue;

        // glow halo
        ctx.beginPath();
        ctx.moveTo(s.ax, s.ay);
        ctx.lineTo(s.bx, s.by);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth   = 7;
        ctx.globalAlpha = s.alpha * 0.15;
        ctx.lineCap     = 'round';
        ctx.stroke();

        // core line
        ctx.beginPath();
        ctx.moveTo(s.ax, s.ay);
        ctx.lineTo(s.bx, s.by);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth   = 1.8;
        ctx.globalAlpha = s.alpha * 0.95;
        ctx.stroke();

        // endpoint dots
        for (const [ex, ey] of [[s.ax, s.ay], [s.bx, s.by]] as [number,number][]) {
          ctx.beginPath();
          ctx.arc(ex, ey, 2, 0, Math.PI * 2);
          ctx.fillStyle   = '#ffffff';
          ctx.globalAlpha = s.alpha * 0.7;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // ── transitions ─────────────────────────────────────────
      if (phase === 0 && timer >= FLY_FRAMES) {
        phase = 1; timer = 0;

      } else if (phase === 1 && timer >= HOLD_FRAMES) {
        phase = 2; timer = 0;
        // pick next mode now, build scatter positions for it
        nextMode = MODES[Math.floor(Math.random() * MODES.length)];
        const next = buildSegments(W, H, nextMode);
        segs.forEach((s, i) => {
          s.sax = next[i].sax; s.say = next[i].say;
          s.sbx = next[i].sbx; s.sby = next[i].sby;
        });

      } else if (phase === 2 && timer >= SCATTER_FRAMES) {
        // next cycle: nextMode becomes currentMode
        currentMode = nextMode;
        segs.forEach(s => { s.alpha = 0; });
        phase = 0; timer = 0;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onResize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W; canvas.height = H;
      segs = buildSegments(W, H, currentMode);
      phase = 0; timer = 0;
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <canvas ref={canvasRef} className={`w-full h-full ${className}`} style={{ display: 'block' }} />
  );
}
