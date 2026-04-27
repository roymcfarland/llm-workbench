import type { Metadata } from "next";

import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { renderMarkdown } from "@/lib/landing/markdown";
import { PROTOCOL_OVERVIEW } from "@/lib/landing/protocol-prose";
import { siteOrigin } from "@/lib/site";

export const metadata: Metadata = {
  title: "Protocol",
  description:
    "LLM Workbench protocol overview — run bundles, integrity hashing, gates, schemas, telemetry, migrations.",
  alternates: { canonical: "/docs/protocol" },
  openGraph: {
    title: "LLM Workbench protocol",
    description:
      "Run bundles, integrity hashing, gates, schemas, telemetry, migrations.",
    url: "/docs/protocol",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "LLM Workbench protocol",
    description:
      "Run bundles, integrity hashing, gates, schemas, telemetry, migrations.",
  },
};

export default async function ProtocolDocsPage() {
  const html = renderMarkdown(PROTOCOL_OVERVIEW);
  const origin = await siteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "LLM Workbench protocol overview",
    description:
      "Run bundles, integrity hashing, gates, schemas, telemetry, migrations.",
    url: `${origin}/docs/protocol`,
    proficiencyLevel: "Expert",
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
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="mx-auto w-full max-w-3xl px-6 py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
          Protocol v{WORKBENCH_PROTOCOL_VERSION}
        </p>
        <div
          className="prose prose-invert mt-2 max-w-none"
          // server-rendered — input is a constant string, no untrusted HTML
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </>
  );
}
