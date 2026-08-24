"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PackageIcon, SpinnerIcon } from "@/components/ui/icons";
import { restockProduct } from "@/app/actions/admin";
import { fill } from "@/lib/i18n";

/**
 * Recording a delivery.
 *
 * The number in the table can already be typed over, and for fixing a miscount
 * that is the right control. This one is for the other thing that happens to
 * stock — a box arriving — and it exists because those are different sentences
 * in the ledger. "Stock is now 40" does not answer "where did these come
 * from?"; "twelve arrived, invoice 4471" does.
 *
 * It adds rather than sets, which is also what makes it safe to use while the
 * shop is open: a sale landing between opening this panel and pressing the
 * button changes what the total should be, and an increment does not care.
 */
export function RestockPanel({ productId }: { productId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  const form = useRef<HTMLFormElement>(null);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<{ count: number; balance: number } | null>(null);

  // Read-only staff can see the ledger and add nothing to it.
  if (!canWrite) return null;

  return (
    <section className="card card-pad mt-4">
      <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
        <PackageIcon size={16} className="text-ink-400" />
        {t.admin.restock}
      </h2>
      <p className="mt-1 text-xs text-ink-500">{t.admin.restockHint}</p>

      <form
        ref={form}
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();

          const data = new FormData(event.currentTarget);
          const quantity = Number(data.get("quantity"));
          const note = String(data.get("note") ?? "");

          setFailed(false);
          setDone(null);

          startTransition(async () => {
            const result = await restockProduct(productId, quantity, note);

            if (!result.ok) {
              setFailed(true);
              return;
            }

            setDone({ count: Math.floor(quantity), balance: result.balance ?? 0 });
            form.current?.reset();
            router.refresh();
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="field-label">{t.admin.restockQuantity}</span>
          <input
            name="quantity"
            type="number"
            min={1}
            step={1}
            required
            defaultValue=""
            className="field h-9 w-32 px-2.5 text-sm tabular-nums"
          />
        </label>

        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="field-label">{t.admin.restockNote}</span>
          <input name="note" type="text" maxLength={200} className="field h-9 px-2.5 text-sm" />
        </label>

        <button type="submit" disabled={isPending} className="btn btn-outline btn-sm h-9">
          {isPending && <SpinnerIcon size={14} />}
          {t.admin.restock}
        </button>
      </form>

      {failed && <ErrorNote className="mt-3" title={t.common.error} hint={t.common.errorHint} />}

      {/* `status` rather than `alert`: it confirms something that was asked
          for, and must not interrupt the reader typing the next one in. */}
      {done && (
        <p role="status" className="mt-3 text-sm font-semibold text-success">
          {fill(t.admin.restockDone, { count: done.count, balance: done.balance })}
        </p>
      )}
    </section>
  );
}
