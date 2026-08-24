"use client";

import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { SpinnerIcon } from "@/components/ui/icons";
import { watchProduct } from "@/app/actions/stock-alerts";

/**
 * Leaving an address for a product that is out of stock.
 *
 * A shop that is out of something loses the sale twice: once now, and again
 * when the box arrives and nobody knows. This is the second half of that,
 * offered where the disappointment happens rather than on a page nobody looks
 * for.
 *
 * The answer is the same whether or not the address was already on the list.
 * "You are already waiting for this" would turn the form into a way of asking
 * whether a given person wants a given product — which is nobody's business
 * but theirs, and is the sort of question a form should not be able to answer.
 *
 * It says what it will and will not do in one line, because "leave your email"
 * has meant "and we will write every Thursday for ever" often enough that it
 * is worth saying otherwise.
 */
export function WatchStock({ productId }: { productId: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p role="status" className="mt-4 text-sm font-semibold text-success">
        {t.product.watchDone}
      </p>
    );
  }

  return (
    <section className="card card-pad mt-4">
      <h2 className="text-sm font-bold text-ink-900">{t.product.watchTitle}</h2>
      <p className="mt-1 text-xs text-ink-500">{t.product.watchHint}</p>

      <form
        ref={form}
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const email = String(new FormData(event.currentTarget).get("email") ?? "");

          setError(null);
          startTransition(async () => {
            const result = await watchProduct(productId, email);

            if (!result.ok) {
              setError(
                result.error === "rate-limited" ? t.product.watchTooMany : t.product.watchInvalid,
              );
              return;
            }

            setDone(true);
          });
        }}
      >
        <label className="min-w-48 flex-1">
          <span className="sr-only">{t.product.watchEmail}</span>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            placeholder={t.product.watchEmail}
            className="field h-10 w-full px-3 text-sm"
          />
        </label>

        <button type="submit" disabled={isPending} className="btn btn-outline btn-md">
          {isPending && <SpinnerIcon size={15} />}
          {t.product.watchSubmit}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
