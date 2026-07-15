import Link from "next/link";

import { PlaygroundMarketingLink } from "@/components/playground-marketing-link";
import { WORKBENCH_PROTOCOL_VERSION } from "@llm-workbench/runtime";

import {
  BRIGHTLINE_LABS_NAME,
  BRIGHTLINE_LABS_URL,
  GITHUB_URL,
  LICENSE_NAME,
  LICENSE_URL,
  NPM_ORG_URL,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/lib/site";

const socialIconLink =
  "inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]";

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
              Open source.
            </strong>{" "}
            Released under the{" "}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {LICENSE_NAME} license
            </a>{" "}
            — free to use, modify, and distribute. Built and maintained by Roy
            McFarland at{" "}
            <a
              href={BRIGHTLINE_LABS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {BRIGHTLINE_LABS_NAME}
            </a>
            .
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            protocol v{WORKBENCH_PROTOCOL_VERSION} · {LICENSE_NAME}
          </p>
          <div className="mt-3 flex items-center gap-1">
            <a
              href={GITHUB_URL}
              aria-label="GitHub"
              target="_blank"
              rel="noopener noreferrer"
              className={socialIconLink}
            >
              <svg
                className="h-5 w-5"
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.66.79.55C20.71 21.4 24 17.09 24 12c0-6.27-5.23-11.5-12-11.5Z" />
              </svg>
            </a>
            <a
              href={NPM_ORG_URL}
              aria-label="npm"
              target="_blank"
              rel="noopener noreferrer"
              className={socialIconLink}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
                className="h-5 w-5"
              >
                <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" />
              </svg>
            </a>
          </div>
        </section>

        <nav aria-label="For humans">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            For humans
          </h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            <li>
              <a href={GITHUB_URL} className="hover:underline">
                GitHub
              </a>
            </li>
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
            <li>
              <a
                href={`${GITHUB_URL}/blob/main/SECURITY.md`}
                className="hover:underline"
              >
                Security
              </a>
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
          <span className="text-[var(--color-foreground)]">From </span>
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
