import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPostBySlug,
  getPostSlugs,
  getRelatedPosts,
  readingTimeIso,
  tagSlug,
  wordCountOf,
} from "@/lib/blog";
import { blogPostOgImageAlt, SITE_NAME, siteOrigin } from "@/lib/site";

type PageProps = { params: Promise<{ slug: string }> };

/** Matches `id` from `generateImageMetadata` in `opengraph-image.tsx` / `twitter-image.tsx`. */
const OG_FILE_ID = "article";

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return {
      title: "Not found",
      robots: { index: false, follow: true },
    };
  }

  const path = `/blog/${slug}`;
  const title = `${post.title} · Blog`;

  return {
    title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description: post.description,
      url: path,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      locale: "en_US",
      siteName: "LLM Workbench",
      images: [
        {
          url: `/blog/${slug}/opengraph-image/${OG_FILE_ID}`,
          width: 1200,
          height: 630,
          alt: blogPostOgImageAlt(post.title),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [
        {
          url: `/blog/${slug}/twitter-image/${OG_FILE_ID}`,
          width: 1200,
          height: 630,
          alt: blogPostOgImageAlt(post.title),
        },
      ],
    },
    ...(post.tags?.length ? { keywords: post.tags } : {}),
    authors: [{ name: post.author ?? SITE_NAME }],
  };
}

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

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const related = getRelatedPosts(post, 3);
  const origin = await siteOrigin();
  const url = `${origin}/blog/${slug}`;
  const ogImageUrl = `${origin}/blog/${slug}/opengraph-image/${OG_FILE_ID}`;
  const wordCount = wordCountOf(post.rawMarkdown);
  const timeRequired = readingTimeIso(wordCount);
  // Pick a sensible articleSection from tags so structured data isn't a
  // hard-coded string. First tag wins; everything else is `keywords`.
  const articleSection = post.tags?.[0]
    ? capitalize(post.tags[0])
    : "Engineering";

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    author: {
      "@type": "Organization",
      name: post.author ?? SITE_NAME,
      url: origin,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
      logo: {
        "@type": "ImageObject",
        url: `${origin}/opengraph-image`,
        width: 1200,
        height: 630,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    isPartOf: { "@type": "Blog", "@id": `${origin}/blog#blog` },
    url,
    image: [
      {
        "@type": "ImageObject",
        url: ogImageUrl,
        width: 1200,
        height: 630,
      },
    ],
    keywords: post.tags?.join(", "),
    articleSection,
    inLanguage: "en-US",
    wordCount,
    timeRequired,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Blog",
        item: `${origin}/blog`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: post.title,
        item: url,
      },
    ],
  };

  const readingMinutes = Math.max(1, Math.round(wordCount / 220));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="landing-mesh pointer-events-none absolute inset-x-0 top-0 -z-10 h-[24rem] opacity-40 mix-blend-screen"
        />
        <article className="mx-auto w-full max-w-3xl px-6 py-14 md:pb-24 md:pt-14">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-[var(--color-muted-foreground)]">
              <li>
                <Link href="/blog" className="hover:text-cyan-300 hover:underline">
                  Blog
                </Link>
              </li>
              <li aria-hidden className="select-none opacity-60">
                /
              </li>
              <li className="truncate text-[var(--color-foreground)]">
                {post.slug}
              </li>
            </ol>
          </nav>

          <header className="mt-8 border-b border-[var(--color-border)] pb-10">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--color-muted-foreground)]">
              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                {articleSection}
              </span>
              <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
              {post.updated && post.updated !== post.date ? (
                <>
                  <span aria-hidden className="opacity-50">
                    ·
                  </span>
                  <span>
                    updated{" "}
                    <time dateTime={post.updated}>
                      {formatBlogDate(post.updated)}
                    </time>
                  </span>
                </>
              ) : null}
              {post.author ? (
                <>
                  <span aria-hidden className="opacity-50">
                    ·
                  </span>
                  <span>{post.author}</span>
                </>
              ) : null}
              <span aria-hidden className="opacity-50">
                ·
              </span>
              <span>{readingMinutes} min read</span>
            </div>
            <h1 className="mt-5 font-serif text-balance text-3xl font-semibold tracking-tight md:text-[2.15rem] md:leading-tight">
              {post.title}
            </h1>
            <span
              aria-hidden="true"
              className="mt-5 block h-px w-24 bg-gradient-to-r from-cyan-400/70 via-violet-400/40 to-transparent"
            />
            <p className="mt-5 text-lg leading-relaxed text-[var(--color-muted-foreground)]">
              {post.description}
            </p>
            {post.tags?.length ? (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/blog/tags/${tagSlug(tag)}`}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/60 px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </header>

          <div
            className="prose prose-invert mt-10 max-w-none"
            // Server-rendered from repo markdown; front matter validated in lib/blog
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

          {related.length > 0 ? (
            <aside
              className="mt-16 border-t border-[var(--color-border)] pt-10"
              aria-labelledby="read-next-heading"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                Read next
              </p>
              <h2
                id="read-next-heading"
                className="mt-2 font-serif text-2xl font-semibold tracking-tight"
              >
                More from the blog
              </h2>
              <ul className="mt-6 grid grid-cols-1 gap-5">
                {related.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="group/related relative block overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/40 p-5 transition hover:border-cyan-400/40 hover:bg-[var(--color-card)]/55"
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent transition-opacity group-hover/related:via-cyan-400/40"
                      />
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
                        <time dateTime={p.date}>{formatBlogDate(p.date)}</time>
                      </p>
                      <h3 className="mt-1 font-serif text-lg font-semibold tracking-tight underline-offset-4 transition group-hover/related:text-cyan-300 group-hover/related:underline">
                        {p.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                        {p.description}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 font-mono text-xs text-[var(--color-muted-foreground)]">
                Browse the full{" "}
                <Link
                  href="/blog"
                  className="underline-offset-4 hover:text-cyan-300 hover:underline"
                >
                  blog
                </Link>{" "}
                or subscribe to{" "}
                <a
                  href="/feed.xml"
                  className="underline-offset-4 hover:text-cyan-300 hover:underline"
                >
                  /feed.xml
                </a>
                .
              </p>
            </aside>
          ) : null}
        </article>
      </div>
    </>
  );
}
