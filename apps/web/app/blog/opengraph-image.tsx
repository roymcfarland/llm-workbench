import { ImageResponse } from "next/og";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { BLOG_INDEX_DESCRIPTION, BLOG_INDEX_OG_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const alt = BLOG_INDEX_OG_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function BlogOpenGraphImage() {
  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="index"
        headline="LLM Workbench blog"
        subhead={BLOG_INDEX_DESCRIPTION}
      />
    ),
    { ...size },
  );
}
