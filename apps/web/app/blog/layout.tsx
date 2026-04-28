import type { ReactNode } from "react";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
      {children}
    </div>
  );
}
