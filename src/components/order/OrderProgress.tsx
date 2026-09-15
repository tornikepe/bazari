"use client";

import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { useI18n } from "@/components/providers/I18nProvider";
import { formatDateTime } from "@/lib/format";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";

/** The happy path, in order. `cancelled` is not a step on it — it ends it. */
const STEPS = ORDER_STATUSES.filter((status) => status !== "cancelled");

/**
 * Where an order has got to, as a timeline rather than a word.
 *
 * "Pending" on its own is a label, not an answer: it says nothing about what
 * has already happened, what is happening now, or what the shop will do next
 * — which is the entire reason someone opens a tracking page. Four steps, the
 * ones behind you dated from the order's own history, the one you are on
 * explained, and the ones ahead named but not pretended to be scheduled.
 *
 * The step the order is on is the one thing the page is asked, so it is the
 * one thing drawn loudly: its own tinted panel, a marker with a halo, and
 * the words "it is here now". A numbered box in an outline, which is what
 * it used to get, read as one more step in the list.
 *
 * No invented dates. A step that has not happened shows no time at all, and
 * there is no "expected delivery" anywhere, because nothing in this shop
 * knows one — a guessed date is the fastest way to lose someone's trust.
 */
export function OrderProgress({
  status,
  history,
}: {
  status: OrderStatus;
  /** When each status was actually reached. Missing entries are simply unknown. */
  history: { status: OrderStatus; at: string }[];
}) {
  const { t } = useI18n();

  const reachedAt = new Map(history.map((step) => [step.status, step.at]));
  const cancelled = status === "cancelled";
  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);

  /* A cancelled order shows the steps it did reach and then the cancellation
     as the step it is on, in place of the ones it will never reach — a list
     that still promised "delivered" under a cancelled order was a list that
     had not been told. */
  const rows: { step: OrderStatus; done: boolean; current: boolean }[] = cancelled
    ? [
        ...STEPS.filter((step) => reachedAt.has(step)).map((step) => ({
          step,
          done: true,
          current: false,
        })),
        { step: "cancelled" as const, done: false, current: true },
      ]
    : STEPS.map((step, index) => ({
        step,
        /* Ticked when the order actually got here — read from the history
           rather than from the position, so "delivered" ticks its own last
           box instead of standing on it wearing a number. */
        done: reachedAt.has(step) && (index !== currentIndex || status === "delivered"),
        current: index === currentIndex,
      }));

  return (
    <section aria-label={t.track.progressTitle}>
      <h3 className="text-sm font-bold text-ink-900">{t.track.progressTitle}</h3>

      {/* A list, because that is what it is: a sequence with a position in it.
          `aria-current` marks where the order stands, which is the one thing a
          screen reader cannot infer from ticks and colours. */}
      <ol className="mt-3">
        {rows.map(({ step, done, current }, index) => {
          const at = reachedAt.get(step);
          const reached = done || current;
          const last = index === rows.length - 1;
          const isCancelRow = step === "cancelled";

          return (
            <li key={step} className="relative flex gap-3">
              {/* The rail, drawn between the markers rather than behind them,
                  so a hairline never shows through a tick. Brand-coloured up
                  to the current step and grey beyond it. */}
              {!last && (
                <span
                  aria-hidden="true"
                  className={`absolute top-8 bottom-0 left-[13px] w-0.5 ${
                    done ? "bg-ink-200" : "bg-line"
                  }`}
                />
              )}

              <span
                aria-hidden="true"
                /* Only the step it is on wears the shop's colour — the one
                   from the settings page. The steps behind it are ticked in
                   grey: they happened, and that is all they have to say. */
                className={`relative z-1 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-pill text-xs font-bold ${
                  isCancelRow
                    ? "bg-danger text-brand-on-solid ring-4 ring-danger-soft"
                    : current
                      ? "bg-brand-600 text-brand-on-solid ring-4 ring-brand-100 progress-now"
                      : done
                        ? "bg-ink-200 text-ink-700"
                        : "border-2 border-line bg-surface text-ink-400"
                }`}
              >
                {isCancelRow ? (
                  <CloseIcon size={14} strokeWidth={3} />
                ) : done ? (
                  <CheckIcon size={14} strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>

              {/* The current step gets the panel; the others a line each. */}
              <div
                className={`mb-2 min-w-0 flex-1 ${
                  current
                    ? `rounded-control px-3.5 py-3 ${isCancelRow ? "bg-danger-soft" : "bg-brand-50"}`
                    : "py-1.5"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p
                    {...(current ? { "aria-current": "step" as const } : {})}
                    className={`text-sm font-bold ${
                      isCancelRow
                        ? "text-danger"
                        : current
                          ? "text-ink-900"
                          : reached
                            ? "text-ink-600"
                            : "text-ink-400"
                    }`}
                  >
                    {t.status[step]}
                  </p>
                  {current && (
                    <span
                      className={`badge ${isCancelRow ? "bg-danger" : "bg-brand-600"} text-brand-on-solid`}
                    >
                      {t.track.now}
                    </span>
                  )}
                </div>

                {/* The meaning only where the reader is standing. On every row
                    it becomes a wall of text that says nothing about *them*. */}
                {current && (
                  <p className={`mt-1 text-sm ${isCancelRow ? "text-danger" : "text-ink-700"}`}>
                    {isCancelRow ? t.track.cancelledNote : t.track.meaning[step]}
                  </p>
                )}

                {/* No line at all rather than an empty one: a step that
                    happened without a recorded time says nothing about when. */}
                {(at || !reached) && (
                  <p className={`text-xs ${current ? "mt-1.5 text-ink-500" : "mt-0.5 text-ink-400"}`}>
                    {at ? formatDateTime(at) : t.track.notReached}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* What the shop will do next, in the shop's own voice. */}
      <p className="mt-3 border-t border-line pt-4 text-sm text-ink-600">
        <span className="mr-1.5 font-bold text-ink-900">{t.track.nextLabel}:</span>
        {t.track.next[status]}
      </p>
    </section>
  );
}
