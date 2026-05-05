import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { getAllTags, getPostsByTag, resolveTagDisplayName } from "@/lib/blog";
import { BLOG_INDEX_OG_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export async function generateStaticParams() {
  return getAllTags().map((t) => ({ tag: t.slug }));
}

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const display = resolveTagDisplayName(tag);
  return [
    {
      id: "tag",
      alt: display
        ? `${display} — LLM Workbench blog topic`
        : BLOG_INDEX_OG_ALT,
      size,
      contentType: "image/png",
    },
  ];
}

export default async function BlogTagTwitterImage({
  params,
  id,
}: {
  params: Promise<{ tag: string }>;
  id: Promise<string | number>;
}) {
  await id;
  const { tag } = await params;
  const display = resolveTagDisplayName(tag);
  if (!display) notFound();
  const count = getPostsByTag(tag).length;

  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="index"
        headline={`Topic · ${display}`}
        subhead={`${count} article${count === 1 ? "" : "s"} on ${display} — run bundles, gates, model-agnostic tracing, and AI governance.`}
      />
    ),
    { ...size },
  );
}
