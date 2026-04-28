import type { Metadata } from "next";
import Link from "next/link";

import { getAllPostsForList } from "@/lib/blog";
import {
  OG_IMAGE_ALT,
  SITE_NAME,
  siteOriginSync,
  siteOrigin,
} from "@/lib/site";

const BLOG_INDEX_DESCRIPTION =
  "Articles on LLM Workbench — audit-ready run bundles, human gates, model-agnostic tracing, and the protocol behind replayable agents.";

export const metadata: Metadata = {
  title: "Blog",
  description: BLOG_INDEX_DESCRIPTION,
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/feed.xml" } },
  openGraph: {
    title: "LLM Workbench blog",
    description:
      "Audit-ready run bundles, human gates, and model-agnostic tracing for deployed agents.",
    url: "/blog",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: OG_IMAGE_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench blog",
    description:
      "Audit-ready run bundles, human gates, and model-agnostic tracing for deployed agents.",
    images: [{ url: "/twitter-image", width: 1200, height: 630, alt: OG_IMAGE_ALT }],
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
  const origin = await siteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${origin}/blog#blog`,
    name: `${SITE_NAME} blog`,
    description: BLOG_INDEX_DESCRIPTION,
    url: `${origin}/blog`,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      dateModified: p.updated ?? p.date,
      url: `${origin}/blog/${p.slug}`,
      author: {
        "@type": "Organization",
        name: p.author ?? SITE_NAME,
      },
    })),
  };

  const feedUrl = `${siteOriginSync()}/feed.xml`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] pb-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
              Writing
            </p>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight md:text-4xl">
              Blog
            </h1>
            <p className="mt-3 max-w-xl text-[var(--color-muted-foreground)]">
              Practical notes on run bundles, human gates, and model-agnostic
              tracing for agents you operate in production.
            </p>
          </div>
          <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
            <span className="text-[var(--color-foreground)]">RSS </span>
            <a href={feedUrl} className="underline-offset-4 hover:underline">
              {feedUrl.replace(/^https:\/\//, "")}
            </a>
          </p>
        </div>

        <ol className="mt-12 flex list-none flex-col gap-0 divide-y divide-[var(--color-border)] p-0">
          {posts.map((post) => (
            <li key={post.slug} className="py-10 first:pt-0 last:pb-0">
              <article itemScope itemType="https://schema.org/BlogPosting">
                <meta itemProp="datePublished" content={post.date} />
                {post.updated ? (
                  <meta itemProp="dateModified" content={post.updated} />
                ) : null}
                <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
                  <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
                  {post.author ? ` · ${post.author}` : ""}
                </p>
                <h2 className="mt-2 font-serif text-xl font-semibold tracking-tight md:text-2xl">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="underline-offset-4 transition hover:text-cyan-300 hover:underline"
                    itemProp="url"
                  >
                    <span itemProp="headline">{post.title}</span>
                  </Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]" itemProp="description">
                  {post.description}
                </p>
                {post.tags?.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
                    {post.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-2 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)]"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </li>
          ))}
        </ol>

        {posts.length === 0 ? (
          <p className="mt-12 text-[var(--color-muted-foreground)]">
            No articles yet — check back soon.
          </p>
        ) : null}
      </div>
    </>
  );
}
