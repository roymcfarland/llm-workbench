import Link from "next/link";
import { Bot, Braces, Orbit, Plug, Route, Shield } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const items = [
  {
    icon: Orbit,
    title: "DAG-native control plane",
    body: "Workflows as first-class graphs: begin steps, gates, checkpoints, and completion — all traced.",
    href: "/docs/protocol",
  },
  {
    icon: Shield,
    title: "Human gates, machine receipts",
    body: "PAUSE_BEFORE / PAUSE_AFTER resolve into structured decisions with timestamps reviewers can audit.",
    href: "/docs/protocol",
  },
  {
    icon: Braces,
    title: "Tamper-evident bundles",
    body: "Canonical JSON + SHA-256 integrity so exports, forks, and compliance reviews share one truth.",
    href: "/docs/protocol",
  },
  {
    icon: Plug,
    title: "MCP + OpenAPI surface",
    body: "Streamable HTTP tools, well-known discovery, and a published OpenAPI spec for agents and integrators.",
    href: "/.well-known/mcp.json",
  },
  {
    icon: Bot,
    title: "AI SDK tracing",
    body: "Drop-in wrappers record model I/O, tokens, cost, and duration without owning your provider graph.",
    href: "/docs/protocol",
  },
  {
    icon: Route,
    title: "Replayable semantics",
    body: "Rehydrate runs from bundles — debug production incidents the same way you replay a test tape.",
    href: "/runs/demo",
  },
] as const;

export function OrbitFeatures() {
  return (
    <section
      aria-labelledby="orbit-heading"
      className="relative mx-auto max-w-6xl px-6 py-24"
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[120%] max-w-[1400px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_oklch(0.55_0.2_260/0.14),_transparent_70%)]" />

      <div className="relative mb-12 max-w-2xl landing-reveal" style={{ animationDelay: "0s" }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
          constellation
        </p>
        <h2
          id="orbit-heading"
          className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          Built for agents, auditors, and the engineers between them.
        </h2>
        <p className="mt-3 text-[var(--color-muted-foreground)] sm:text-lg">
          A reference plane that is as legible to curl as it is to Cursor — same protocol, same bundles,
          different consumers.
        </p>
      </div>

      <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          const inner = (
            <>
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]/80 shadow-inner shadow-cyan-500/5">
                  <Icon className="h-5 w-5 text-cyan-400/90" aria-hidden />
                </div>
                <CardTitle className="font-serif text-lg">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {item.body}
                </CardDescription>
              </CardHeader>
            </>
          );
          const cardClass =
            "group relative overflow-hidden border-[var(--color-border)] bg-[var(--color-card)]/45 backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-cyan-500/25 hover:shadow-[0_28px_80px_-40px_oklch(0.55_0.18_240/0.55)]";

          return (
            <Link
              key={item.title}
              href={item.href}
              className="landing-reveal block rounded-xl"
              style={{ animationDelay: `${0.06 + i * 0.065}s` }}
            >
              <Card className={cardClass}>{inner}</Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
