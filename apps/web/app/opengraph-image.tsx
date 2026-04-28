import { ImageResponse } from "next/og";

import { OgImageMarkup } from "@/lib/og-image-markup";

export const runtime = "nodejs";

export const alt =
  "LLM Workbench — model-agnostic control plane for debuggable LLM agents";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<OgImageMarkup />, { ...size });
}
