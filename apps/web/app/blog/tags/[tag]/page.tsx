import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getAllTags,
  getPostsByTag,
  resolveTagDisplayName,
  tagSlug,
} from "@/lib/blog";
import {
  BLOG_INDEX_OG_ALT,
  SITE_NAME,
  siteOrigin,
} from "@/lib/site";

type PageProps = { params: Promise<{ tag: string }> };

const OG_FILE_ID = "tag";

export async function generateStaticParams() {
  return getAllTags().map((t) => ({ tag: t.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const display = resolveTagDisplayName(tag);
  if (!display) {
    return {
      title: "Topic not found",
      robots: { index: false, follow: true },
    };
  }
  const path = `/blog/tags/${tag}`;
  const title = `${display} · Topic`;
  const description = `Articles from the ${SITE_NAME} blog tagged ${display} — run bundles, gates, model-agnostic tracing, AI governance, and replayable agents.`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${display} — ${SITE_NAME} blog`,
      description,
      url: path,
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      images: [
        {
          url: `${path}/opengraph-image/${OG_FILE_ID}`,
          width: 1200,
          height: 630,
          alt: BLOG_INDEX_OG_ALT,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${display} — ${SITE_NAME} blog`,
      description,
      images: [
        {
          url: `${path}/twitter-image/${OG_FILE_ID}`,
          width: 1200,
          height: 630,
          alt: BLOG_INDEX_OG_ALT,
        },
      ],
    },
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

export default async function BlogTagPage({ params }: PageProps) {
  const { tag } = await params;
  const display = resolveTagDisplayName(tag);
  if (!display) notFound();

  const posts = getPostsByTag(tag);
  if (posts.length === 0) notFound();

  const origin = await siteOrigin();
  const url = `${origin}/blog/tags/${tag}`;

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: `${display} — ${SITE_NAME} blog`,
    description: `Articles from the ${SITE_NAME} blog tagged ${display}.`,
    url,
    inLanguage: "en-US",
    isPartOf: { "@type": "Blog", "@id": `${origin}/blog#blog` },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: posts.length,
      itemListElement: posts.map((p, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        url: `${origin}/blog/${p.slug}`,
        name: p.title,
      })),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${origin}/blog` },
      { "@type": "ListItem", position: 3, name: display, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
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
        <div className="mx-auto max-w-3xl px-6 pb-20 pt-12 md:pt-16">
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
              <li>tags</li>
              <li aria-hidden className="select-none opacity-60">
                /
              </li>
              <li className="truncate text-[var(--color-foreground)]">{tag}</li>
            </ol>
          </nav>

          <div className="mt-6 border-b border-[var(--color-border)] pb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
              Topic
            </p>
            <h1 className="mt-2 font-serif text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              <span className="aurora-shift bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                {display}
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-[var(--color-muted-foreground)]">
              {posts.length} article{posts.length === 1 ? "" : "s"} on{" "}
              <span className="text-[var(--color-foreground)]">{display}</span>{" "}
              from the {SITE_NAME} blog.
            </p>
          </div>

          <ol className="mt-10 grid list-none grid-cols-1 gap-5 p-0">
            {posts.map((post) => (
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
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-foreground)]">
                    <time dateTime={post.date}>{formatBlogDate(post.date)}</time>
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
                      {post.tags.slice(0, 4).map((t) => (
                        <li key={t}>
                          <Link
                            href={`/blog/tags/${tagSlug(t)}`}
                            className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)]/60 px-2 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)] transition hover:border-cyan-400/40 hover:text-cyan-300"
                          >
                            {t}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>

          <p className="mt-10 font-mono text-xs text-[var(--color-muted-foreground)]">
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
        </div>
      </div>
    </>
  );
}
