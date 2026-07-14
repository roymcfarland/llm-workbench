import { ImageResponse } from "next/og";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { API_REFERENCE_OG_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const alt = API_REFERENCE_OG_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function ApiReferenceOpenGraphImage() {
  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="index"
        headline="LLM Workbench API reference"
        subhead="Generated from the public JSDoc for the runtime, UI, adapters, AI SDK, and MCP packages."
      />
    ),
    { ...size },
  );
}
