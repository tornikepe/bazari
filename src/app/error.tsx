"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { RefreshIcon } from "@/components/ui/icons";
import { ErrorArt } from "@/components/ui/illustrations";

/**
 * Route-level error boundary.
 *
 * Must be a Client Component — `reset()` re-runs the failed render. The real
 * cause is deliberately not shown: an error message can carry a query, a path
 * or a stack, and this page is visible to customers.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Until Sentry lands (C1), the server log is the only record.
    console.error("route error", error);
  }, [error]);

  return (
    <div className="page-container py-20">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <ErrorArt size={96} />

        <h1 className="mt-5 text-xl font-bold tracking-tight text-ink-900">{t.common.errorTitle}</h1>
        <p className="mt-2 text-sm text-ink-500">{t.common.errorText}</p>

        {/* Lets support match a report to a log line without exposing a stack. */}
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-400">{error.digest}</p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary btn-md">
            <RefreshIcon size={16} />
            {t.common.tryAgain}
          </button>
          <Link href="/" className="btn btn-outline btn-md">
            {t.common.goHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
