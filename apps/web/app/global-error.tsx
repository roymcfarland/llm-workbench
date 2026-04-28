"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Root error boundary — must render its own document shell (html + body).
 * Keeps production responses generic; surfaces details only in development.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 480 }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        {process.env.NODE_ENV === "development" ? (
          <pre
            style={{
              marginTop: "1rem",
              whiteSpace: "pre-wrap",
              fontSize: "0.875rem",
              opacity: 0.85,
            }}
          >
            {error.message}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
