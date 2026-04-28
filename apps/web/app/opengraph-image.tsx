import { ImageResponse } from "next/og";

import { OgImageMarkup } from "@/lib/og-image-markup";
import { OG_IMAGE_ALT } from "@/lib/site";

export const runtime = "nodejs";

export const alt = OG_IMAGE_ALT;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<OgImageMarkup />, { ...size });
}
