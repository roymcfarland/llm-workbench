import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getAllPostsForList, getAllTags, tagSlug } from "@/lib/blog";
import {
  BLOG_INDEX_DESCRIPTION,
  BLOG_INDEX_OG_ALT,
  SITE_NAME,
  siteOriginSync,
  siteOrigin,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description: BLOG_INDEX_DESCRIPTION,
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/feed.xml" } },
  openGraph: {
    title: "LLM Workbench blog",
    description:
      "Audit-ready run bundles, human gates, model-agnostic tracing, token economics, and AI governance for deployed agents.",
    url: "/blog",
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    images: [{ url: "/blog/opengraph-image", width: 1200, height: 630, alt: BLOG_INDEX_OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench blog",
    description:
      "Audit-ready run bundles, human gates, model-agnostic tracing, token economics, and AI governance for deployed agents.",
    images: [{ url: "/blog/twitter-image", width: 1200, height: 630, alt: BLOG_INDEX_OG_ALT }],
  },
};

function formatBlogDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function BlogIndexPage() {
  const posts = getAllPostsForList();
  const allTags = getAllTags();
  const origin = await siteOrigin();

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${origin}/blog#blog`,
    name: `${SITE_NAME} blog`,
    description: BLOG_INDEX_DESCRIPTION,
    url: `${origin}/blog`,
    inLanguage: "en-US",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${origin}/blog` },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      dateModified: p.updated ?? p.date,
      url: `${origin}/blog/${p.slug}`,
      keywords: p.tags?.join(", "),
      author: {
        "@type": "Organization",
        name: p.author ?? SITE_NAME,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${origin}/blog` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SITE_NAME} blog — articles`,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: posts.length,
    itemListElement: posts.map((p, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${origin}/blog/${p.slug}`,
      name: p.title,
    })),
  };

  const feedUrl = `${siteOriginSync()}/feed.xml`;
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="landing-mesh pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] opacity-50 mix-blend-screen"
        />
        <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 md:pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                Writing
              </p>
              <h1 className="mt-2 font-serif text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                The{" "}
                <span className="aurora-shift bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Workbench
                </span>{" "}
                blog
              </h1>
              <p className="mt-3 max-w-xl text-[var(--color-muted-foreground)]">
                Practical notes on run bundles, human gates, model-agnostic
                tracing, token economics, and AI governance for agents you
                operate in production.
              </p>
            </div>
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              <span className="text-[var(--color-foreground)]">RSS </span>
              <a href={feedUrl} className="underline-offset-4 hover:underline">
                {feedUrl.replace(/^https:\/\//, "")}
              </a>
            </p>
          </div>

          {allTags.length > 0 ? (
            <nav aria-label="Topics" className="mt-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
                Topics
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {allTags.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/blog/tags/${t.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
                    >
                      {t.tag}
                      <span className="opacity-60">{t.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {featured ? (
            <article
              itemScope
              itemType="https://schema.org/BlogPosting"
              className="group/featured relative mt-12 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]/60 p-6 shadow-lg shadow-cyan-500/5 transition hover:border-cyan-400/40 md:p-8"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl transition group-hover/featured:bg-cyan-500/15"
              />
              <meta itemProp="datePublished" content={featured.date} />
              {featured.updated ? (
                <meta itemProp="dateModified" content={featured.updated} />
              ) : null}
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                  Latest
                </span>{" "}
                <time dateTime={featured.date}>
                  {formatBlogDate(featured.date)}
                </time>
                {featured.author ? ` · ${featured.author}` : ""}
              </p>
              <h2 className="mt-4 font-serif text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                <Link
                  href={`/blog/${featured.slug}`}
                  className="underline-offset-4 transition hover:text-cyan-300 hover:underline"
                  itemProp="url"
                >
                  <span itemProp="headline">{featured.title}</span>
                </Link>
              </h2>
              <p
                className="mt-3 leading-relaxed text-[var(--color-muted-foreground)]"
                itemProp="description"
              >
                {featured.description}
              </p>
              {featured.tags?.length ? (
                <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tags">
                  {featured.tags.map((tag) => (
                    <li key={tag}>
                      <Link
                        href={`/blog/tags/${tagSlug(tag)}`}
                        className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/60 px-2 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
                      >
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-xs text-cyan-300">
                <Link
                  href={`/blog/${featured.slug}`}
                  className="underline-offset-4 transition hover:underline"
                >
                  Read the post
                </Link>
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover/featured:translate-x-0.5"
                  aria-hidden="true"
                />
              </div>
            </article>
          ) : null}

          {rest.length > 0 ? (
            <ol className="mt-8 grid list-none grid-cols-1 gap-5 p-0">
              {rest.map((post) => (
                <li key={post.slug} className="contents">
                  <article
                    itemScope
                    itemType="https://schema.org/BlogPosting"
                    className="group/card relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/40 p-5 transition hover:border-cyan-400/40 hover:bg-[var(--color-card)]/55 md:p-6"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent transition-opacity group-hover/card:via-cyan-400/40"
                    />
                    <meta itemProp="datePublished" content={post.date} />
                    {post.updated ? (
                      <meta itemProp="dateModified" content={post.updated} />
                    ) : null}
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
                      <time dateTime={post.date}>
                        {formatBlogDate(post.date)}
                      </time>
                      {post.author ? ` · ${post.author}` : ""}
                    </p>
                    <h2 className="mt-2 font-serif text-balance text-xl font-semibold tracking-tight md:text-2xl">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="underline-offset-4 transition group-hover/card:text-cyan-300 hover:underline"
                        itemProp="url"
                      >
                        <span itemProp="headline">{post.title}</span>
                      </Link>
                    </h2>
                    <p
                      className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]"
                      itemProp="description"
                    >
                      {post.description}
                    </p>
                    {post.tags?.length ? (
                      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
                        {post.tags.slice(0, 4).map((tag) => (
                          <li key={tag}>
                            <Link
                              href={`/blog/tags/${tagSlug(tag)}`}
                              className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/60 px-2 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
                            >
                              {tag}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>
          ) : null}

          {posts.length === 0 ? (
            <p className="mt-12 text-[var(--color-muted-foreground)]">
              No articles yet — check back soon.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
