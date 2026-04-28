import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

/** Shared nav chip styles: compact on phones so SignedIn chrome fits without crushing. */
const navBtn =
  "h-8 shrink-0 whitespace-nowrap px-2 text-[11px] leading-none sm:h-9 sm:px-3 sm:text-xs";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/75 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--color-background)]/65">
      <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="group flex min-w-0 max-w-[12rem] items-center gap-1.5 overflow-hidden font-semibold tracking-tight sm:max-w-none sm:gap-2"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/15 via-violet-500/10 to-fuchsia-500/15 shadow-inner shadow-cyan-500/10 transition group-hover:border-cyan-400/35">
            <Sparkles
              className="relative z-10 h-4 w-4 text-cyan-300 dark:text-cyan-200"
              aria-hidden
            />
          </span>
          <span className="truncate text-sm sm:text-base">LLM Workbench</span>
          <span className="hidden whitespace-nowrap text-xs font-normal text-[var(--color-muted-foreground)] lg:inline">
            reference
          </span>
        </Link>

        {/* Scroll on narrow widths so Playground · Runs · theme · avatar never overlap the brand */}
        <nav
          aria-label="Primary"
          className="scrollbar-none flex min-w-0 flex-nowrap items-center justify-end gap-0.5 overflow-x-auto overflow-y-visible py-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:justify-end sm:gap-2 sm:overflow-visible sm:py-0 [&::-webkit-scrollbar]:hidden [&_svg]:shrink-0"
        >
          <Button asChild variant="ghost" size="sm" className={navBtn}>
            <Link href="/blog">Blog</Link>
          </Button>
          <SignedIn>
            <Button asChild variant="ghost" size="sm" className={navBtn}>
              <Link href="/playground">Playground</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className={navBtn}>
              <Link href="/runs">Runs</Link>
            </Button>
          </SignedIn>
          <div className="shrink-0 [&_button]:size-8 [&_button]:sm:size-9">
            <ThemeToggle />
          </div>
          <SignedIn>
            <div className="flex shrink-0">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <Button asChild variant="ghost" size="sm" className={`${navBtn} hidden sm:inline-flex`}>
              <Link href="/docs/protocol">Protocol</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className={`${navBtn} hidden sm:inline-flex`}>
              <Link href="/runs/demo">Demo</Link>
            </Button>
            <Button asChild size="sm" className={navBtn}>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
