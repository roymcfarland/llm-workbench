export function LandingHorizon() {
  return (
    <section
      aria-label="Mission"
      className="relative overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-muted)]/15 py-20 md:py-28"
    >
      <div
        aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,_oklch(0.55_0.16_260/0.08),_transparent)]"
      />
      <blockquote className="relative mx-auto max-w-4xl px-6 text-center font-serif text-2xl font-semibold leading-snug tracking-tight text-balance md:text-4xl md:leading-tight">
        The near future isn&apos;t only prompt engineering — it&apos;s{" "}
        <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          audit trails for cognition
        </span>
        : runs you can diff, sign, and replay.
      </blockquote>
    </section>
  );
}
