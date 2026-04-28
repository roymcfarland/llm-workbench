"use client";

import { useEffect, useRef, useState } from "react";

type TelemetryLine = { id: number; text: string };

const SAMPLES = [
  '{"type":"step_started","stepId":"parser1","t":"…"}',
  '{"type":"model_io","model":"claude-haiku-4-5","durationMs":220}',
  '{"type":"artifact_written","key":"resume.md","version":3}',
  '{"type":"human_gate_resolved","decision":"approved"}',
  '{"type":"rule_changed","ruleSetId":"prod-v2"}',
  '{"type":"run_status_changed","status":"completed"}',
  '{"integrity":"sha256:7f83b1657…","bundleId":"run_01J…"}',
  '{"type":"model_io","provider":"anthropic","usage":{"totalTokens":412}}',
  '{"type":"step_completed","stepId":"output","ok":true}',
] as const;

export function TelemetryRain() {
  const lineIdRef = useRef(0);
  const [lines, setLines] = useState<TelemetryLine[]>(() => [
    { id: lineIdRef.current++, text: "> ingest · workflow snapshot loaded" },
    { id: lineIdRef.current++, text: "> trace · subscribing to run store…" },
  ]);

  useEffect(() => {
    if (typeof window.matchMedia === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const id = window.setInterval(() => {
      const sample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
      setLines((prev) => [
        ...prev.slice(-11),
        { id: lineIdRef.current++, text: `> emit · ${sample}` },
      ]);
    }, 780);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      aria-label="Illustrative trace event stream"
      className="relative border-y border-cyan-500/15 bg-[#040508] py-14 text-cyan-100/90 [contain:layout] [overflow-anchor:none]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.03) 2px, rgba(34,211,238,0.03) 4px)",
        }}
      />
      <div
        aria-hidden
        className="crt-scan pointer-events-none absolute inset-0 opacity-40 motion-reduce:opacity-25"
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-400/70">
              live telemetry (illustrative)
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Every run emits a{" "}
              <span className="bg-gradient-to-r from-cyan-300/95 via-teal-200/90 to-emerald-200/95 bg-clip-text text-transparent">
                structured spine
              </span>
              .
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-cyan-100/55">
            Events stream into the bundle as the DAG advances: gates, model I/O, artifacts,
            integrity — all machine-addressable before a human touches the UI.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-cyan-500/25 bg-black/55 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_28px_80px_-44px_rgba(6,182,212,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
          <div
            aria-hidden
            className="telemetry-terminal-sheen pointer-events-none absolute inset-0 z-0 opacity-[0.55]"
          />
          <div className="relative z-10">
            <div className="flex items-center gap-2 border-b border-cyan-500/15 bg-black/30 px-4 py-2.5 backdrop-blur-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/90 shadow-[0_0_12px_rgba(239,68,68,0.45)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90 shadow-[0_0_10px_rgba(251,191,36,0.35)]" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.4)]" />
              <span className="ml-2 truncate font-mono text-[10px] text-cyan-300/50">
                workbench://trace/session/live
              </span>
            </div>
            {/* Fixed viewport height avoids layout shift as lines append; scrollbar reserves space */}
            <div
              className="h-[220px] overflow-y-scroll overflow-x-hidden [scrollbar-gutter:stable] px-4 py-3 font-mono text-[11px] leading-snug md:text-xs"
              style={{ overscrollBehavior: "contain" }}
            >
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="border-b border-cyan-500/10 py-[0.4375rem] text-cyan-100/85 [overflow-wrap:anywhere] last:border-b-0"
                >
                  {line.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
