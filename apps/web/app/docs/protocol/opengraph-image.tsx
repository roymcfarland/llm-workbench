import { ImageResponse } from "next/og";

import { BlogOgImageMarkup } from "@/lib/blog-og-image-markup";
import { PROTOCOL_OG_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const alt = PROTOCOL_OG_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function ProtocolOpenGraphImage() {
  return new ImageResponse(
    (
      <BlogOgImageMarkup
        variant="index"
        headline="LLM Workbench protocol"
        subhead="Run bundles, live persistence wire format, integrity hashing, gates, telemetry, OTel bridge, integrations."
      />
    ),
    { ...size },
  );
}
