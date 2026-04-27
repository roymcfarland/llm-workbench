import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/landing/site-footer";

import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: {
    default: "LLM Workbench — model-agnostic LLM control plane",
    template: "%s · LLM Workbench",
  },
  description:
    "LLM Workbench is a model-agnostic control plane for LLM-powered products. Every run becomes a tamper-evident, human-gated, replayable bundle of trace events, artifacts, and gates.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://workbench.example.com"),
  applicationName: "LLM Workbench",
  authors: [{ name: "LLM Workbench" }],
  openGraph: {
    title: "LLM Workbench — model-agnostic LLM control plane",
    description:
      "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy.",
    type: "website",
    siteName: "LLM Workbench",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Workbench",
    description:
      "Tamper-evident, human-gated, replayable run bundles for the LLM agents you actually deploy.",
  },
};

// Fall back to a Clerk-provided dev publishable key shape so `next build`
// works without a configured project (the value is harmless — it points at
// clerk.dummy.dev). Real deployments must set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
const BUILD_FALLBACK_CLERK_PK = "pk_test_Y2xlcmsuZHVtbXkuZGV2JA";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || BUILD_FALLBACK_CLERK_PK;
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en" suppressHydrationWarning className={newsreader.variable}>
        <body className="min-h-screen antialiased">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-primary)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--color-primary-foreground)]"
          >
            Skip to content
          </a>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
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
