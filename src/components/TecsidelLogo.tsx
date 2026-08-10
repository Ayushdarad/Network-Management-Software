import { useEffect, useRef } from 'react';

// Tecsidel logo symbol: 3 dots connected by 2 lines
// Green top-left, Cyan top-right (larger), Magenta bottom-center

const DOTS_DEF = [
  { rx: -0.28, ry: -0.30, r: 9,  color: '#8dc63f', glow: 'rgba(141,198,63,0.5)'  }, // green
  { rx:  0.20, ry: -0.33, r: 13, color: '#29abe2', glow: 'rgba(41,171,226,0.5)'  }, // cyan (bigger)
  { rx: -0.04, ry:  0.12, r: 9,  color: '#ec008c', glow: 'rgba(236,0,140,0.5)'   }, // magenta
];

const ss = (t: number) => t * t * (3 - 2 * t);

function randEdge(W: number, H: number) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: Math.random() * W, y: -80 };
  if (side === 1) return { x: W + 80,             y: Math.random() * H };
  if (side === 2) return { x: Math.random() * W, y: H + 80 };
  return               { x: -80,                  y: Math.random() * H };
}

interface Dot {
  tx: number; ty: number; r: number; color: string; glow: string;
  sx: number; sy: number; x: number; y: number; alpha: number;
}

export default function TecsidelLogo({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W = canvas.offsetWidth;
    let H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const buildDots = (): Dot[] => {
      // Scale so logo fills the box nicely — use 35% of smallest dimension
      const scale = Math.min(W, H) * 0.35;
      // Center of canvas
      const cx = W * 0.50;
      const cy = H * 0.48;
      return DOTS_DEF.map(d => {
        const tx = cx + d.rx * scale * 2.8;
        const ty = cy + d.ry * scale * 2.8;
        const s  = randEdge(W, H);
        return { tx, ty, r: d.r * (scale / 55), color: d.color, glow: d.glow,
          sx: s.x, sy: s.y, x: s.x, y: s.y, alpha: 0 };
      });
    };

    let dots = buildDots();
    const LINES = [{ a: 0, b: 1 }, { a: 1, b: 2 }];
    let lineAlpha = 0;

    let phase = 0; // 0=fly-in 1=hold 2=scatter
    let timer = 0;
    const FLY  = 150;
    const HOLD = 90;
    const SCAT = 150;
    let pulse = 0;

    const resetScatter = () => {
      dots.forEach(d => { const s = randEdge(W, H); d.sx = s.x; d.sy = s.y; d.alpha = 0; });
      lineAlpha = 0;
    };

    let raf: number;

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      timer++;
      pulse += 0.05;

      const tFly  = Math.min(timer / FLY,  1);
      const tScat = Math.min(timer / SCAT, 1);

      // Update positions
      dots.forEach(d => {
        if (phase === 0) {
          const e = ss(tFly);
          d.x = d.sx + (d.tx - d.sx) * e;
          d.y = d.sy + (d.ty - d.sy) * e;
          d.alpha = Math.min(1, tFly * 1.5);
        } else if (phase === 1) {
          d.x = d.tx; d.y = d.ty;
          d.alpha = 0.85 + Math.sin(pulse) * 0.15;
        } else {
          const e = ss(tScat);
          d.x = d.tx + (d.sx - d.tx) * e;
          d.y = d.ty + (d.sy - d.ty) * e;
          d.alpha = Math.max(0, 1 - e * 1.3);
        }
      });

      if (phase === 0) lineAlpha = Math.min(1, tFly * 1.2);
      else if (phase === 1) lineAlpha = 0.7 + Math.sin(pulse * 0.8) * 0.3;
      else lineAlpha = Math.max(0, 1 - ss(tScat) * 1.5);

      // Draw lines
      LINES.forEach(({ a, b }) => {
        const da = dots[a], db = dots[b];
        if (lineAlpha <= 0.01) return;
        // Glow
        ctx.beginPath(); ctx.moveTo(da.x, da.y); ctx.lineTo(db.x, db.y);
        ctx.strokeStyle = '#1d6a7a'; ctx.lineWidth = 5;
        ctx.globalAlpha = lineAlpha * 0.2; ctx.lineCap = 'round'; ctx.stroke();
        // Core
        ctx.beginPath(); ctx.moveTo(da.x, da.y); ctx.lineTo(db.x, db.y);
        ctx.strokeStyle = '#2d8fa8'; ctx.lineWidth = 2.2;
        ctx.globalAlpha = lineAlpha * 0.9; ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Draw dots
      dots.forEach(d => {
        if (d.alpha <= 0.01) return;
        // Glow halo
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 3.5);
        g.addColorStop(0, d.glow); g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.globalAlpha = d.alpha * 0.45; ctx.fill();
        // Dot
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.color; ctx.globalAlpha = d.alpha; ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Phase transitions
      if      (phase === 0 && timer >= FLY)  { phase = 1; timer = 0; }
      else if (phase === 1 && timer >= HOLD) { phase = 2; timer = 0; }
      else if (phase === 2 && timer >= SCAT) { resetScatter(); phase = 0; timer = 0; }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onResize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W; canvas.height = H;
      dots = buildDots(); phase = 0; timer = 0;
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return <canvas ref={canvasRef} className={`w-full h-full ${className}`} style={{ display: 'block' }} />;
}
