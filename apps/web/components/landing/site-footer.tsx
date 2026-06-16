import Link from "next/link";

import { PlaygroundMarketingLink } from "@/components/playground-marketing-link";
import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import {
  BRIGHTLINE_LABS_NAME,
  BRIGHTLINE_LABS_URL,
  COMMERCIAL_URL,
  LICENSE_NAME,
  LICENSE_URL,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-background)]/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          <h2 className="text-sm font-semibold tracking-tight">{SITE_NAME}</h2>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
            {SITE_TAGLINE}
          </p>
          <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
            <strong className="font-medium text-[var(--color-foreground)]">
              Licensing.
            </strong>{" "}
            Proprietary. All rights reserved. Use, modification, and operation
            are limited to Authorized Users (Roy McFarland personally and
            entities controlled by Roy McFarland, including{" "}
            <a
              href={BRIGHTLINE_LABS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {BRIGHTLINE_LABS_NAME}
            </a>
            ) except by separate written agreement. See the{" "}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {LICENSE_NAME} license
            </a>
            {" "}or{" "}
            <a
              href={COMMERCIAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              contact for licensing inquiries
            </a>
            .
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            protocol v{WORKBENCH_PROTOCOL_VERSION} · {LICENSE_NAME}
          </p>
        </section>

        <nav aria-label="For humans">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            For humans
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <Link href="/blog" className="hover:underline">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:underline">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/docs/protocol" className="hover:underline">
                Docs · protocol
              </Link>
            </li>
            <li>
              <PlaygroundMarketingLink className="hover:underline" />
            </li>
          </ul>
        </nav>

        <nav aria-label="For agents">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            For agents
          </h3>
          <ul className="mt-3 flex flex-col gap-2 font-mono text-xs">
            <li>
              <a href="/llms.txt" className="hover:underline">
                /llms.txt
              </a>
            </li>
            <li>
              <a href="/llms-full.txt" className="hover:underline">
                /llms-full.txt
              </a>
            </li>
            <li>
              <a href="/agents.md" className="hover:underline">
                /agents.md
              </a>
            </li>
            <li>
              <a href="/.well-known/mcp.json" className="hover:underline">
                /.well-known/mcp.json
              </a>
            </li>
            <li>
              <a href="/api/openapi.json" className="hover:underline">
                /api/openapi.json
              </a>
            </li>
            <li>
              <Link href="/runs/demo" className="hover:underline">
                /runs/demo (public)
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-[var(--color-border)] px-6 py-5">
        <p className="text-center text-xs text-[var(--color-muted-foreground)]">
          <span className="text-[var(--color-foreground)]">Attribution: </span>
          <a
            href={BRIGHTLINE_LABS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--color-foreground)] underline-offset-4 hover:underline"
          >
            {BRIGHTLINE_LABS_NAME}
          </a>
          — product and reference deployment.
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
