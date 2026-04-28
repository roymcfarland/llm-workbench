// The Clerk proxy (see `proxy.ts`) already gates this group, so
// the layout itself stays a static boundary that Cache Components can
// prerender. Per-route data fetches handle their own auth + Suspense.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>;
}
