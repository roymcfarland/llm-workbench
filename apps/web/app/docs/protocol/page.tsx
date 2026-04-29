import type { Metadata } from "next";

import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import { renderMarkdown } from "@/lib/landing/markdown";
import { PROTOCOL_OVERVIEW } from "@/lib/landing/protocol-prose";
import { OG_IMAGE_ALT, siteOrigin } from "@/lib/site";

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
    images: [
      { url: "/opengraph-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench protocol",
    description:
      "Run bundles, persistence vs export, correlation IDs, gates, MCP + REST surfaces.",
    images: [
      { url: "/twitter-image", width: 1200, height: 630, alt: OG_IMAGE_ALT },
    ],
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
      "Deep dive: bundles vs wire state, canonical hashing, gates, correlation IDs, MCP export_bundle.",
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
