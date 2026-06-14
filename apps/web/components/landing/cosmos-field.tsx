"use client";

import { useEffect, useRef } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isDarkTheme(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export function CosmosField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let raf = 0;
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let t = 0;
    let reduced = prefersReducedMotion();
    let dark = isDarkTheme();

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduce = () => {
      reduced = mqReduce.matches;
    };
    mqReduce.addEventListener("change", onReduce);

    const root = document.documentElement;
    const moTheme = new MutationObserver(() => {
      dark = root.classList.contains("dark");
    });
    moTheme.observe(root, { attributes: true, attributeFilter: ["class"] });

    const initParticles = () => {
      const rect = canvas.getBoundingClientRect();
      const area = Math.max(rect.width * rect.height, 1);
      const count = Math.floor(area / 11000);
      const n = Math.min(110, Math.max(48, count));
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.floor(rect.width * dpr));
      h = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
      initParticles();
      if (reduced) paintStatic();
    };

    const trailClear = () => {
      dark = isDarkTheme();
      ctx.fillStyle = dark ? "rgba(12, 12, 15, 0.22)" : "rgba(250, 250, 252, 0.35)";
      ctx.fillRect(0, 0, w, h);
    };

    const paintStatic = () => {
      dark = isDarkTheme();
      ctx.fillStyle = dark ? "#0a0a0c" : "#f8fafc";
      ctx.fillRect(0, 0, w, h);
      const blobs = [
        { ox: 0.22, oy: 0.12, hue: 195 },
        { ox: 0.78, oy: 0.18, hue: 285 },
        { ox: 0.5, oy: 0.85, hue: 330 },
      ];
      for (const b of blobs) {
        const grd = ctx.createRadialGradient(b.ox * w, b.oy * h, 0, b.ox * w, b.oy * h, w * 0.42);
        grd.addColorStop(0, `hsla(${b.hue}, 78%, 58%, ${dark ? 0.09 : 0.11})`);
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }
    };

    // Observe + paint AFTER trailClear/paintStatic are defined: resize() calls
    // paintStatic() under reduced motion, so it must not run in their TDZ.
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = () => {
      dark = isDarkTheme();
      trailClear();
      t += 0.007;

      const blobs = [
        { ox: 0.2 + Math.sin(t * 0.65) * 0.06, oy: 0.12 + Math.cos(t * 0.4) * 0.03, hue: 195 },
        { ox: 0.78 + Math.cos(t * 0.48) * 0.05, oy: 0.18 + Math.sin(t * 0.55) * 0.04, hue: 285 },
        { ox: 0.52 + Math.sin(t * 0.28) * 0.07, oy: 0.88 + Math.cos(t * 0.22) * 0.04, hue: 330 },
      ];
      for (const b of blobs) {
        const grd = ctx.createRadialGradient(b.ox * w, b.oy * h, 0, b.ox * w, b.oy * h, w * 0.52);
        grd.addColorStop(0, `hsla(${b.hue}, ${dark ? 82 : 70}%, ${dark ? 58 : 45}%, ${dark ? 0.11 : 0.08})`);
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }

      const connectDist = 138 * dpr;
      const lineBase = dark ? "148, 163, 184" : "100, 116, 139";
      const dotFill = dark ? "rgba(226, 232, 240, 0.5)" : "rgba(51, 65, 85, 0.65)";

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < connectDist) {
            const alpha = (1 - dist / connectDist) * (dark ? 0.22 : 0.14);
            ctx.strokeStyle = `rgba(${lineBase}, ${alpha})`;
            ctx.lineWidth = 0.55 * dpr;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.fillStyle = dotFill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.15 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    if (reduced) {
      paintStatic();
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mqReduce.removeEventListener("change", onReduce);
      moTheme.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
