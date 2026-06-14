"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignedIn } from "@clerk/nextjs";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/runs/demo", label: "Demo" },
  { href: "/docs/protocol", label: "Protocol" },
  { href: "/faq", label: "FAQ" },
] as const;

const signedInLinks = [
  { href: "/playground", label: "Playground", prefetch: false },
  { href: "/runs", label: "Runs", prefetch: false },
] as const;

const linkClass =
  "block rounded-md px-3 py-2 text-sm font-medium transition hover:bg-[var(--color-accent)] hover:text-[var(--color-accent-foreground)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)]";

export function SiteNavMobile() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Open menu"
        aria-controls="mobile-site-nav"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </Button>

      {open ? (
        <nav
          id="mobile-site-nav"
          aria-label="Mobile primary"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/95 p-2 shadow-xl shadow-black/20 backdrop-blur-md"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <SignedIn>
            <div
              className="my-2 h-px bg-[var(--color-border)]"
              aria-hidden="true"
            />
            {signedInLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={link.prefetch}
                className={cn(linkClass, "font-mono text-xs")}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </SignedIn>
        </nav>
      ) : null}
    </div>
  );
}
