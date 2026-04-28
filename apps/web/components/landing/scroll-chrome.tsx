"use client";

import Lenis from "lenis";
import { useEffect, useState } from "react";

function useProgressWithLenis(): number {
  const [p, setP] = useState(0);

  useEffect(() => {
    if (typeof window.matchMedia === "undefined") return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer =
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches;
    const onNative = () => {
      const doc = document.documentElement;
      const scroll = doc.scrollTop;
      const height = doc.scrollHeight - doc.clientHeight;
      setP(height > 0 ? Math.min(1, scroll / height) : 0);
    };

    // Touch-primary viewports: native scroll avoids jank when the DOM height
    // changes (e.g. live trace lines) and plays nicer with iOS rubber-banding.
    if (reduced || coarsePointer) {
      onNative();
      window.addEventListener("scroll", onNative, { passive: true });
      return () => window.removeEventListener("scroll", onNative);
    }

    const lenis = new Lenis({
      lerp: 0.06,
      smoothWheel: true,
      wheelMultiplier: 0.88,
      touchMultiplier: 1.05,
      anchors: true,
    });

    const unsub = lenis.on("scroll", (instance) => {
      setP(instance.progress);
    });
    setP(lenis.progress);

    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      unsub();
      lenis.destroy();
    };
  }, []);

  return p;
}

export function ScrollChrome() {
  const p = useProgressWithLenis();

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] h-[2px] w-full bg-[var(--color-border)]/35"
    >
      <div
        className="h-full origin-left will-change-transform bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 shadow-[0_0_24px_oklch(0.72_0.17_260_/_0.45)] motion-reduce:transition-none"
        style={{ transform: `scaleX(${p})` }}
      />
    </div>
  );
}
