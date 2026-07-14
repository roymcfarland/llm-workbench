import { ImageResponse } from "next/og";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { GETTING_STARTED_OG_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const alt = GETTING_STARTED_OG_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function GettingStartedOpenGraphImage() {
  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="index"
        headline="LLM Workbench getting started"
        subhead="Install the runtime, start a human-gated run, record artifacts, and track model telemetry."
      />
    ),
    { ...size },
  );
}
