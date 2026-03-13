/**
 * GlassBackground — High-quality animated Japanese gradient mesh
 *
 * Uses HTML Canvas at full devicePixelRatio for crisp, artifact-free
 * gradient rendering on every display density. No SVG feTurbulence
 * (which causes visible pixelation on high-DPI screens).
 *
 * Layers:
 * 1. Deep ink base (painted on canvas)
 * 2. Multiple soft radial gradient blobs with slow drift animation
 * 3. Ultra-fine CSS noise overlay (tiny repeating tile, not SVG)
 * 4. Subtle vignette
 */
import { useEffect, useRef, useState, useCallback } from "react";

/* ── Blob configuration ── */
interface Blob {
  cx: number; // center X ratio (0–1)
  cy: number; // center Y ratio (0–1)
  rx: number; // radius X ratio (of canvas width)
  ry: number; // radius Y ratio (of canvas height)
  color: [number, number, number]; // RGB
  alpha: number;
  // drift parameters
  driftX: number;
  driftY: number;
  driftSpeed: number;
  phase: number;
  scaleOsc: number;
}

const BLOBS: Blob[] = [
  // Warm terracotta — bottom right
  {
    cx: 0.78, cy: 0.82, rx: 0.42, ry: 0.45,
    color: [180, 82, 48], alpha: 0.22,
    driftX: 0.03, driftY: 0.025, driftSpeed: 0.00012, phase: 0, scaleOsc: 0.04,
  },
  // Deep indigo — top left
  {
    cx: 0.18, cy: 0.15, rx: 0.40, ry: 0.38,
    color: [45, 55, 115], alpha: 0.28,
    driftX: 0.025, driftY: 0.03, driftSpeed: 0.0001, phase: 1.2, scaleOsc: 0.03,
  },
  // Muted teal — center right
  {
    cx: 0.68, cy: 0.38, rx: 0.30, ry: 0.28,
    color: [40, 110, 100], alpha: 0.13,
    driftX: 0.035, driftY: 0.02, driftSpeed: 0.00014, phase: 2.5, scaleOsc: 0.05,
  },
  // Dusky purple — bottom left
  {
    cx: 0.25, cy: 0.72, rx: 0.25, ry: 0.26,
    color: [75, 48, 105], alpha: 0.10,
    driftX: 0.02, driftY: 0.035, driftSpeed: 0.00011, phase: 3.8, scaleOsc: 0.04,
  },
  // Golden highlight — top center
  {
    cx: 0.52, cy: 0.12, rx: 0.22, ry: 0.18,
    color: [165, 120, 55], alpha: 0.07,
    driftX: 0.015, driftY: 0.02, driftSpeed: 0.00015, phase: 5.0, scaleOsc: 0.06,
  },
  // Soft coral accent — lower center
  {
    cx: 0.45, cy: 0.60, rx: 0.28, ry: 0.24,
    color: [195, 90, 65], alpha: 0.08,
    driftX: 0.028, driftY: 0.018, driftSpeed: 0.00009, phase: 4.2, scaleOsc: 0.03,
  },
];

/* ── Base background color ── */
const BASE_R = 16, BASE_G = 19, BASE_B = 28; // hsl(230 15% 8%) ≈ rgb(16,19,28)

export function GlassBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);

  const paint = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Resize canvas buffer to match display size × DPR
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    // Fill base
    ctx.fillStyle = `rgb(${BASE_R},${BASE_G},${BASE_B})`;
    ctx.fillRect(0, 0, w, h);

    // Paint each blob as a radial gradient
    for (const blob of BLOBS) {
      const t = time;
      const ox = Math.sin(t * blob.driftSpeed + blob.phase) * blob.driftX * w;
      const oy = Math.cos(t * blob.driftSpeed * 0.8 + blob.phase) * blob.driftY * h;
      const scaleFactor = 1 + Math.sin(t * blob.driftSpeed * 1.3 + blob.phase * 2) * blob.scaleOsc;

      const cx = blob.cx * w + ox;
      const cy = blob.cy * h + oy;
      const radX = blob.rx * w * scaleFactor;
      const radY = blob.ry * h * scaleFactor;

      // Use elliptical gradient via save/scale/restore
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, radY / radX);

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radX);
      const [r, g, b] = blob.color;
      grad.addColorStop(0, `rgba(${r},${g},${b},${blob.alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${blob.alpha * 0.5})`);
      grad.addColorStop(0.7, `rgba(${r},${g},${b},${blob.alpha * 0.15})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radX, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Reset composite for next frame
    ctx.globalCompositeOperation = "source-over";

    animRef.current = requestAnimationFrame(paint);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    animRef.current = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(animRef.current);
  }, [mounted, paint]);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* ── Canvas gradient mesh (full DPR, zero pixelation) ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full transition-opacity duration-[2s]"
        style={{ opacity: mounted ? 1 : 0 }}
      />

      {/* ── Fine noise overlay (CSS image, not SVG feTurbulence) ── */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.045,
          mixBlendMode: "overlay",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />

      {/* ── Subtle vignette ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 35%, hsla(230, 15%, 4%, 0.45) 100%)",
        }}
      />
    </div>
  );
}
