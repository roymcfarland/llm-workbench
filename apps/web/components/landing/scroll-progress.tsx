"use client";

import { useEffect, useState } from "react";

export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scroll = doc.scrollTop;
      const height = doc.scrollHeight - doc.clientHeight;
      setP(height > 0 ? Math.min(1, scroll / height) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[100] h-[2px] w-full bg-[var(--color-border)]/40"
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 transition-[transform] duration-150 ease-out"
        style={{ transform: `scaleX(${p})` }}
      />
    </div>
  );
}
