import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/75 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--color-background)]/65">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-fuchsia-500/15 shadow-inner shadow-cyan-500/10 transition group-hover:border-cyan-400/35">
            <Sparkles
              className="relative z-10 h-4 w-4 text-cyan-300 dark:text-cyan-200"
              aria-hidden
            />
          </span>
          <span>LLM Workbench</span>
          <span className="text-xs font-normal text-[var(--color-muted-foreground)]">
            reference
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <SignedIn>
            <Button asChild variant="ghost" size="sm">
              <Link href="/playground">Playground</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/runs">Runs</Link>
            </Button>
          </SignedIn>
          <ThemeToggle />
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/docs/protocol">Protocol</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/runs/demo">Demo</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
