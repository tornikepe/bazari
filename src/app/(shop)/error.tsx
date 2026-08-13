"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { RefreshIcon } from "@/components/ui/icons";
import { ErrorArt } from "@/components/ui/illustrations";

/**
 * Storefront error boundary. Without it, a failed database call renders the
 * framework's default error screen with no header, no footer and no way back.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <div className="page-container py-20">
      <div className="card mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center">
        <ErrorArt size={96} />

        <h1 className="mt-5 text-lg font-bold tracking-tight text-ink-900">{t.common.error}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{t.common.notFoundText}</p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-400">#{error.digest}</p>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary btn-md">
            <RefreshIcon size={16} />
            {t.common.retry}
          </button>
          <Link href="/" className="btn btn-outline btn-md">
            {t.common.goHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
