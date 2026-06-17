import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteNavMobile } from "@/components/site-nav-mobile";

const navBtn = "h-9 shrink-0 whitespace-nowrap px-2 text-xs md:px-3";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/75 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--color-background)]/65">
      <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:gap-4 sm:px-6">
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

        <div className="flex min-w-0 items-center justify-end gap-1 sm:hidden">
          <div className="shrink-0 [&_button]:size-8">
            <ThemeToggle />
          </div>
          <SignedIn>
            <div className="flex shrink-0">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[11px]"
            >
              <Link href="/sign-in" prefetch={false}>
                Sign in
              </Link>
            </Button>
          </SignedOut>
          <SiteNavMobile />
        </div>

        <nav
          aria-label="Primary"
          className="hidden min-w-0 flex-nowrap items-center justify-end gap-1 [&_svg]:shrink-0 md:gap-2 sm:flex"
        >
          <div className="mr-1 shrink-0 [&_button]:size-8 [&_button]:sm:size-9 md:mr-2">
            <ThemeToggle />
          </div>
          <Button asChild variant="ghost" size="sm" className={navBtn}>
            <Link href="/blog">Blog</Link>
          </Button>
          <SignedIn>
            <Button asChild variant="ghost" size="sm" className={navBtn}>
              <Link href="/playground" prefetch={false}>
                Playground
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className={navBtn}>
              <Link href="/runs" prefetch={false}>
                Runs
              </Link>
            </Button>
          </SignedIn>
          <Button asChild variant="ghost" size="sm" className={navBtn}>
            <Link href="/faq">FAQ</Link>
          </Button>
          <SignedIn>
            <div className="flex shrink-0">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <Button asChild variant="ghost" size="sm" className={navBtn}>
              <Link href="/docs/protocol">Protocol</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className={navBtn}>
              <Link href="/runs/demo">Demo</Link>
            </Button>
            <Button asChild size="sm" className={navBtn}>
              <Link href="/sign-in" prefetch={false}>
                Sign in
              </Link>
            </Button>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
