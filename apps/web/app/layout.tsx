import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Newsreader, Outfit } from "next/font/google";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/landing/site-footer";

import { ScrollChrome } from "@/components/landing/scroll-chrome";
import {
  GITHUB_URL,
  OG_IMAGE_ALT,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/site";
import { siteVerificationFields } from "@/lib/site-verification";

import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-jetbrains",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-newsreader",
});

export const metadata: Metadata = {
  title: {
    default: "LLM Workbench — model-agnostic LLM control plane",
    template: "%s · LLM Workbench",
  },
  description:
    "LLM Workbench is a model-agnostic control plane for LLM-powered products. Every run becomes a tamper-evident, human-gated, replayable bundle of trace events, artifacts, and gates.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://www.llmworkbench.io",
  ),
  manifest: "/manifest.webmanifest",
  applicationName: "LLM Control Plane",
  authors: [{ name: "LLM Workbench" }, { name: "Brightline Labs" }],
  creator: "Brightline Labs",
  publisher: "Brightline Labs",
  category: "technology",
  keywords: [
    "LLM",
    "agents",
    "AI agents",
    "observability",
    "MCP",
    "Model Context Protocol",
    "human-in-the-loop",
    "run bundles",
    "tamper evident",
    "audit trail",
    "AI governance",
    "algorithmic accountability",
    "token economics",
    "AI SDK",
    "OpenAPI",
    "agent contracts",
    "replay rights",
    "blog",
    "tracing",
    "replay",
  ],
  openGraph: {
    title: "LLM Workbench — model-agnostic LLM control plane",
    description:
      "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy.",
    type: "website",
    siteName: "LLM Workbench",
    locale: "en_US",
    url: "/",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench",
    description:
      "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  ...siteVerificationFields(),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Fall back to a Clerk-provided dev publishable key shape so `next build`
// works without a configured project (the value is harmless — it points at
// clerk.dummy.dev). Real deployments must set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
const BUILD_FALLBACK_CLERK_PK = "pk_test_Y2xlcmsuZHVtbXkuZGV2JA";

const SITE_BASE = (
  process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://www.llmworkbench.io"
).replace(/\/$/, "");

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_BASE}#organization`,
  name: SITE_NAME,
  url: SITE_BASE,
  logo: {
    "@type": "ImageObject",
    url: `${SITE_BASE}/opengraph-image`,
    width: 1200,
    height: 630,
  },
  sameAs: [GITHUB_URL],
  description: SITE_TAGLINE,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_BASE}#website`,
  name: SITE_NAME,
  url: SITE_BASE,
  inLanguage: "en-US",
  publisher: { "@id": `${SITE_BASE}#organization` },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || BUILD_FALLBACK_CLERK_PK;
  return (
    <ClerkProvider publishableKey={publishableKey} dynamic>
      <html
        lang="en"
        suppressHydrationWarning
        className={`${outfit.variable} ${jetbrainsMono.variable} ${newsreader.variable}`}
      >
        <body className="min-h-screen overflow-x-clip antialiased">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
          />
          <ScrollChrome />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-primary)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--color-primary-foreground)]"
          >
            Skip to content
          </a>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            nonce={nonce}
          >
            <TooltipProvider delayDuration={150}>
              <SiteHeader />
              <main id="main-content" className="min-h-[calc(100vh-3.5rem)]">
                {children}
              </main>
              <SiteFooter />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
