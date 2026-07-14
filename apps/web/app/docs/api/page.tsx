import type { Metadata } from "next";
import Link from "next/link";

import {
  API_REFERENCE_PACKAGES,
  getApiReferenceMarkdown,
} from "@/lib/landing/api-reference-loader";
import { renderMarkdownWithHeadings } from "@/lib/landing/markdown";
import { GITHUB_URL, SITE_NAME, siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API reference",
  description:
    "Generated API reference for LLM Workbench's runtime, UI, React, AI SDK, and MCP packages.",
  alternates: { canonical: "/docs/api" },
  openGraph: {
    title: "LLM Workbench API reference",
    description:
      "Generated from the JSDoc comments on every public LLM Workbench package export.",
    url: "/docs/api",
    type: "article",
    siteName: "LLM Workbench",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench API reference",
    description:
      "Generated API documentation for the runtime, UI, React, AI SDK, and MCP packages.",
  },
};

export default async function ApiReferenceDocsPage() {
  const references = await Promise.all(
    API_REFERENCE_PACKAGES.map(async (packageReference) => ({
      ...packageReference,
      html: renderMarkdownWithHeadings(
        await getApiReferenceMarkdown(packageReference.name),
      ).html,
    })),
  );
  const origin = await siteOrigin();
  const url = `${origin}/docs/api`;

  const techArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "LLM Workbench API reference",
    description:
      "Generated API documentation for the runtime, UI, React, AI SDK, and MCP packages.",
    url,
    inLanguage: "en-US",
    proficiencyLevel: "Advanced",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: [
      "LLM Workbench",
      "API reference",
      "TypeDoc",
      "runtime",
      "React",
      "Vercel AI SDK",
      "MCP",
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
        item: `${origin}/docs/api`,
      },
      { "@type": "ListItem", position: 3, name: "API reference", item: url },
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
              <li className="text-[var(--color-foreground)]">api</li>
            </ol>
          </nav>

          <header className="mt-6 border-b border-[var(--color-border)] pb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
              Reference · API
            </p>
            <h1 className="mt-2 font-serif text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              API reference, generated from{" "}
              <span className="aurora-shift bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                source
              </span>
            </h1>
            <span
              aria-hidden="true"
              className="mt-5 block h-px w-24 bg-gradient-to-r from-cyan-400/70 via-violet-400/40 to-transparent"
            />
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)]">
              Public exports from all five packages, regenerated from their JSDoc
              comments every time the web app builds.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 font-mono text-xs">
              <a
                href="/docs/getting-started"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-3 py-1 text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Getting started
              </a>
              <a
                href="/docs/architecture"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-3 py-1 text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Architecture
              </a>
              <a
                href="/docs/protocol"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-3 py-1 text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Protocol reference
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
            <article className="min-w-0 max-w-3xl">
              {references.map((reference) => (
                <section key={reference.name} className="scroll-mt-20" id={reference.name}>
                  <h2 className="mt-10 mb-4 font-serif text-2xl font-semibold tracking-tight first:mt-0">
                    {reference.title}
                  </h2>
                  <div
                    // Generated from this repository's public JSDoc at build time.
                    dangerouslySetInnerHTML={{ __html: reference.html }}
                  />
                </section>
              ))}
            </article>

            <aside className="hidden md:block" aria-label="On this page">
              <div className="sticky top-20">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                  On this page
                </p>
                <ol className="mt-3 flex list-none flex-col gap-1 border-l border-[var(--color-border)] pl-4 font-mono text-[11px]">
                  {references.map((reference) => (
                    <li key={reference.name}>
                      <a
                        href={`#${reference.name}`}
                        className="block py-1 text-[var(--color-muted-foreground)] transition hover:text-cyan-300"
                      >
                        {reference.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
