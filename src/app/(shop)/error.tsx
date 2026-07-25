"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { AlertIcon, RefreshIcon } from "@/components/ui/icons";

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
      <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-pill bg-danger-soft text-danger">
          <AlertIcon size={30} />
        </span>

        <h1 className="text-lg font-bold text-ink-900">{t.common.error}</h1>
        <p className="text-sm text-ink-500">{t.common.notFoundText}</p>

        {error.digest && (
          <p className="font-mono text-xs text-ink-400">#{error.digest}</p>
        )}

        <div className="mt-2 flex flex-wrap justify-center gap-3">
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
