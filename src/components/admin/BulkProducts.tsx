"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CheckIcon, CloseIcon, EyeIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";
import { bulkProducts, type BulkAction } from "@/app/actions/admin";
import { fill } from "@/lib/i18n";

/**
 * Acting on several products at once.
 *
 * The selection lives here rather than in each row, because "how many are
 * selected" is a question about the whole table and no row can answer it. The
 * rows themselves stay server-rendered: this wraps them and listens for the
 * checkboxes changing, which is one client component instead of one per row.
 *
 * `publish` and `unpublish` are separate buttons rather than a toggle. Toggling
 * a mixed selection means a different outcome per row and the reader has to
 * work out which — exactly what choosing twelve things at once is meant to
 * avoid.
 */
export function BulkProducts({
  ids,
  children,
}: {
  /** Every product id on the page, in the order they are drawn. */
  ids: string[];
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  const box = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(0);

  /* A viewer can read this table and change nothing in it, so there is nothing
     to select. The gate is on the server too — this only stops the offer. */
  if (!canWrite) return <>{children}</>;

  const all = ids.length > 0 && ids.every((id) => selected.has(id));

  /**
   * Puts the checkboxes back in step with the selection.
   *
   * The rows are server-rendered, so their checkboxes are uncontrolled: React
   * has no say in whether they are ticked, and clearing the selection in state
   * would leave twenty boxes still visibly ticked. Reaching into the DOM is
   * the honest way to do that — the alternative is making every row a client
   * component to control one input.
   */
  function syncBoxes(on: boolean) {
    for (const input of box.current?.querySelectorAll<HTMLInputElement>(
      'input[name="product-id"]',
    ) ?? []) {
      input.checked = on;
    }
  }

  function toggle(id: string, on: boolean) {
    setDone(0);
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function run(action: BulkAction) {
    const chosen = [...selected];

    if (action === "delete") {
      // The one destructive action, and the only one that asks. `confirm` is
      // the browser's, which means it cannot be missed, cannot be styled into
      // something that looks like a hint, and works before hydration finishes.
      const sure = window.confirm(fill(t.admin.bulkConfirmDelete, { count: chosen.length }));
      if (!sure) return;
    }

    setFailed(false);
    startTransition(async () => {
      const result = await bulkProducts(action, chosen);

      if (!result.ok) {
        setFailed(true);
        return;
      }

      setSelected(new Set());
      syncBoxes(false);
      setDone(result.count ?? chosen.length);
      router.refresh();
    });
  }

  return (
    <div
      ref={box}
      /* One listener for the whole table rather than a prop threaded into
         every row: the checkboxes are server-rendered and their changes
         bubble. */
      onChange={(event) => {
        const target = event.target as HTMLInputElement;
        if (target.name === "product-id") toggle(target.value, target.checked);
      }}
    >
      {/* The bar sits above the table and takes no room until it has something
          to say — a permanently visible toolbar of disabled buttons is noise on
          every visit for a feature used occasionally. */}
      {selected.size > 0 && (
        <div className="card sticky top-[calc(var(--header-h)+0.5rem)] z-20 mt-3 flex flex-wrap items-center gap-2 p-3">
          <p aria-live="polite" className="mr-auto text-sm font-bold text-ink-900">
            {fill(t.admin.bulkSelected, { count: selected.size })}
          </p>

          <button
            type="button"
            onClick={() => run("publish")}
            disabled={isPending}
            className="btn btn-outline btn-sm"
          >
            {isPending ? <SpinnerIcon size={14} /> : <CheckIcon size={14} />}
            {t.admin.bulkPublish}
          </button>

          <button
            type="button"
            onClick={() => run("unpublish")}
            disabled={isPending}
            className="btn btn-outline btn-sm"
          >
            <EyeIcon size={14} />
            {t.admin.bulkUnpublish}
          </button>

          <button
            type="button"
            onClick={() => run("delete")}
            disabled={isPending}
            className="btn btn-outline btn-sm text-danger hover:bg-danger-soft"
          >
            <TrashIcon size={14} />
            {t.admin.bulkDelete}
          </button>

          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              syncBoxes(false);
            }}
            aria-label={t.admin.bulkClear}
            className="btn btn-ghost h-9 w-9 rounded-control p-0"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {failed && <ErrorNote className="mt-3" title={t.common.error} hint={t.common.errorHint} />}

      {/* What happened, once. `status` rather than `alert`: it confirms
          something the reader asked for and must not interrupt them. */}
      {done > 0 && (
        <p role="status" className="mt-3 text-sm font-semibold text-success">
          {fill(t.admin.bulkDone, { count: done })}
        </p>
      )}

      {/* Select-all is offered beside the table rather than in the header row:
          the mobile layout has no header row, and a control that exists at one
          width and not another is a control people stop trusting. */}
      <label className="mt-3 flex w-fit items-center gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={all}
          onChange={(event) => {
            setDone(0);
            setSelected(event.target.checked ? new Set(ids) : new Set());
            syncBoxes(event.target.checked);
          }}
          className="h-4 w-4 accent-brand-600"
        />
        {t.admin.bulkSelectAll}
      </label>

      {children}
    </div>
  );
}
