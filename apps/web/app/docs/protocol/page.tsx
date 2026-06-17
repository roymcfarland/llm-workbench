import type { Metadata } from "next";
import Link from "next/link";

import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { renderMarkdownWithHeadings } from "@/lib/landing/markdown";
import { PROTOCOL_OVERVIEW } from "@/lib/landing/protocol-prose";
import { GITHUB_URL, SITE_NAME, siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  title: "Protocol",
  description:
    "Deep dive: RunBundle vs RunStoreState, canonical SHA-256, trace correlation, gates, forks, MCP tools (export_bundle), REST wire format.",
  alternates: { canonical: "/docs/protocol" },
  openGraph: {
    title: "LLM Workbench protocol",
    description:
      "Run bundles, live persistence wire format, integrity hashing, gates, telemetry, OTel bridge, integrations.",
    url: "/docs/protocol",
    type: "article",
    siteName: "LLM Workbench",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench protocol",
    description:
      "Run bundles, persistence vs export, correlation IDs, gates, MCP + REST surfaces.",
  },
};

export default async function ProtocolDocsPage() {
  const { html, headings } = renderMarkdownWithHeadings(PROTOCOL_OVERVIEW);
  const origin = await siteOrigin();
  const url = `${origin}/docs/protocol`;

  // Use H2 headings for the sidebar TOC (deeper levels overcrowd the rail).
  const tocItems = headings.filter((h) => h.level === 2);

  const techArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "LLM Workbench protocol overview",
    description:
      "Deep dive: bundles vs wire state, canonical hashing, gates, correlation IDs, MCP export_bundle.",
    url,
    inLanguage: "en-US",
    proficiencyLevel: "Expert",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: [
      "LLM Workbench",
      "run bundle",
      "trace events",
      "gates",
      "MCP",
      "model-agnostic",
      `protocol v${WORKBENCH_PROTOCOL_VERSION}`,
    ],
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Docs",
        item: `${origin}/docs/protocol`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Protocol",
        item: url,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="landing-mesh pointer-events-none absolute inset-x-0 top-0 -z-10 h-[24rem] opacity-50 mix-blend-screen"
        />
        <div className="mx-auto w-full max-w-6xl px-6 py-14 md:pb-24 md:pt-16">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-[var(--color-muted-foreground)]">
              <li>
                <Link href="/" className="hover:text-cyan-300 hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden className="select-none opacity-60">
                /
              </li>
              <li>docs</li>
              <li aria-hidden className="select-none opacity-60">
                /
              </li>
              <li className="text-[var(--color-foreground)]">protocol</li>
            </ol>
          </nav>

          <header className="mt-6 border-b border-[var(--color-border)] pb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
              Reference · Protocol v{WORKBENCH_PROTOCOL_VERSION}
            </p>
            <h1 className="mt-2 font-serif text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              The{" "}
              <span className="aurora-shift bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                Workbench
              </span>{" "}
              protocol
            </h1>
            <span
              aria-hidden="true"
              className="mt-5 block h-px w-24 bg-gradient-to-r from-cyan-400/70 via-violet-400/40 to-transparent"
            />
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)]">
              Runtime-and-wire-format pair for recording, gating, and replaying
              LLM-powered work. Boring on the surface — JSON in, JSON out,
              structured trace events — so it survives upgrades, model swaps,
              framework migrations, and audits.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs">
              <a
                href="/api/openapi.json"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-3 py-1 text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                /api/openapi.json
              </a>
              <a
                href="/.well-known/mcp.json"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-3 py-1 text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                /.well-known/mcp.json
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-3 py-1 text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Source on GitHub
              </a>
            </div>
          </header>

          <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_15rem]">
            <article
              className="min-w-0 max-w-3xl"
              // server-rendered — input is a constant string, no untrusted HTML
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {tocItems.length > 0 ? (
              <aside
                className="hidden md:block"
                aria-label="On this page"
              >
                <div className="sticky top-20">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                    On this page
                  </p>
                  <ol className="mt-3 flex list-none flex-col gap-1 border-l border-[var(--color-border)] pl-4 font-mono text-[11px]">
                    {tocItems.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="block py-1 text-[var(--color-muted-foreground)] transition hover:text-cyan-300"
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
