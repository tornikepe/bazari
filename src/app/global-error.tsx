"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { sentryEnabled } from "@/lib/sentry-config";

/**
 * The boundary under the root layout.
 *
 * Reached only when the root layout itself fails to render, which is why it
 * has to draw its own `<html>` and `<body>` and cannot use the providers —
 * no theme, no dictionary, no header. Two sentences in both languages and a
 * way to try again is the honest most it can offer.
 *
 * Its other job is to report: an error this far up is exactly the one worth
 * knowing about, and it is the one the route-level boundary never sees.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (sentryEnabled()) Sentry.captureException(error);
    else console.error("root error", error);
  }, [error]);

  return (
    <html lang="ka">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f4f5f7", color: "#161a23" }}>
        <main style={{ maxWidth: "28rem", margin: "6rem auto", padding: "0 1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>რაღაც არასწორად წავიდა</h1>
          <p style={{ margin: "0 0 0.25rem", color: "#4d5567" }}>Something went wrong.</p>
          <p style={{ margin: "0 0 1.5rem", color: "#4d5567", fontSize: "0.9rem" }}>
            გვერდის ჩატვირთვა ვერ მოხერხდა. სცადე ისევ. · The page could not be drawn. Try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#dc1f24",
              color: "#fff",
              border: 0,
              padding: "0.75rem 1.5rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            თავიდან · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
