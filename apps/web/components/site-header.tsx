import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/70 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" aria-hidden />
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
            <Button asChild size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
}
