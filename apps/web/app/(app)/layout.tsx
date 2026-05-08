import type { Metadata } from "next";

// The Clerk middleware (see `middleware.ts`) already gates this group, so
// the layout itself stays a static boundary that Cache Components can
// prerender. Per-route data fetches handle their own auth + Suspense.
//
// Do not index authenticated app surfaces (runs, playground)—defense in depth
// beside `robots.txt` when HTML is ever served with a session.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>;
}
