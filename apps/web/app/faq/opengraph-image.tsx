import { ImageResponse } from "next/og";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { FAQ_OG_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const alt = FAQ_OG_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function FaqOpenGraphImage() {
  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="index"
        headline="FAQ · LLM Workbench"
        subhead="Answers about tamper-evident run bundles, human approval gates, replay, privacy, and trying LLM Workbench."
      />
    ),
    { ...size },
  );
}
