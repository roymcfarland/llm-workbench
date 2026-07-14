import { ImageResponse } from "next/og";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { ARCHITECTURE_OG_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const alt = ARCHITECTURE_OG_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function ArchitectureOpenGraphImage() {
  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="index"
        headline="LLM Workbench architecture"
        subhead="The headless runtime, React layer, integration adapters, and hosted reference app."
      />
    ),
    { ...size },
  );
}
