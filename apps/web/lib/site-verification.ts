import type { Metadata } from "next";

/**
 * Optional webmaster verification tokens (set in Vercel / hosting env).
 * Google uses `metadata.verification.google`; Bing uses `<meta name="msvalidate.01">`
 * via `metadata.other`; Yandex uses `metadata.verification.yandex`.
 */
export function siteVerificationFields(): Pick<Metadata, "verification" | "other"> {
  const google =
    process.env.GOOGLE_SITE_VERIFICATION?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const yandex =
    process.env.YANDEX_SITE_VERIFICATION?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim();
  const bing =
    process.env.BING_SITE_VERIFICATION?.trim() ||
    process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();

  const verification: NonNullable<Metadata["verification"]> = {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
  };

  const hasVerification = Object.keys(verification).length > 0;

  return {
    ...(hasVerification ? { verification } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}
