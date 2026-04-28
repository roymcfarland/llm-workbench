"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type SectionRevealProps = {
  children: ReactNode;
  className?: string;
};

export function SectionReveal({ children, className }: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInstant(true);
      setVisible(true);
      return undefined;
    }

    const el = ref.current;
    if (!el) return undefined;

    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { rootMargin: "-6% 0px -10% 0px", threshold: [0, 0.08, 0.15] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        !instant &&
          "motion-safe:transition-[opacity,transform,filter] motion-safe:duration-[1100ms] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible || instant
          ? "opacity-100 motion-safe:translate-y-0 motion-safe:blur-0"
          : "opacity-0 motion-safe:translate-y-12 motion-safe:blur-[4px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
