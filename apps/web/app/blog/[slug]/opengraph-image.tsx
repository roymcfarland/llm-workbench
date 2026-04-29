import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { getPostBySlug, getPostSlugs } from "@/lib/blog";
import { metaLineForOg } from "@/lib/blog-og-share";
import { blogPostOgImageAlt } from "@/lib/site";

export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  return [
    {
      id: "article",
      alt: post ? blogPostOgImageAlt(post.title) : "Blog article — LLM Workbench",
      size,
      contentType: "image/png",
    },
  ];
}

export default async function BlogPostOpenGraphImage({
  params,
  id,
}: {
  params: Promise<{ slug: string }>;
  id: Promise<string | number>;
}) {
  await id;
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="post"
        title={post.title}
        description={post.description}
        metaLine={metaLineForOg(post)}
      />
    ),
    { ...size },
  );
}
