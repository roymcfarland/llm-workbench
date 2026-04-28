"use client";

import { useEffect, useState } from "react";

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
  const [lines, setLines] = useState<string[]>(() => [
    "> ingest · workflow snapshot loaded",
    "> trace · subscribing to run store…",
  ]);

  useEffect(() => {
    if (typeof window.matchMedia === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const id = window.setInterval(() => {
      const next = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
      setLines((prev) => [...prev.slice(-11), `> emit · ${next}`]);
    }, 780);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      aria-label="Illustrative trace event stream"
      className="relative border-y border-cyan-500/15 bg-[#040508] py-14 text-cyan-100/90"
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
              Every run emits a structured spine.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-cyan-100/55">
            Events stream into the bundle as the DAG advances: gates, model I/O, artifacts,
            integrity — all machine-addressable before a human touches the UI.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-black/50 shadow-md shadow-cyan-950/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 border-b border-cyan-500/10 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
            <span className="ml-2 font-mono text-[10px] text-cyan-300/50">
              workbench://trace/session/live
            </span>
          </div>
          <div className="max-h-[220px] overflow-y-auto scroll-smooth px-4 py-3 font-mono text-[11px] leading-relaxed md:text-xs">
            {lines.map((line, i) => (
              <div
                key={`${i}-${line.slice(0, 24)}`}
                className="border-b border-cyan-500/5 py-1 text-cyan-100/85 last:border-b-0"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
