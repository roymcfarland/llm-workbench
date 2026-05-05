import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Not found",
  description: "That page does not exist on LLM Workbench.",
  robots: { index: false, follow: true },
};

export default function NotFoundPage() {
  return (
    <div className="relative isolate">
      <div
        aria-hidden="true"
        className="landing-mesh pointer-events-none absolute inset-x-0 top-0 -z-10 h-[24rem] opacity-60 mix-blend-screen"
      />
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-xl flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
          404 · Not found
        </p>
        <h1 className="font-serif text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          The page you are looking for{" "}
          <span className="aurora-shift bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            never ran
          </span>
          .
        </h1>
        <p className="text-balance text-[var(--color-muted-foreground)]">
          The URL might be stale, or the page is gated behind a sign-in.
          Try the blog, the protocol docs, or open the demo run.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/blog">Blog</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/docs/protocol">Protocol</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/runs/demo">Demo run</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
