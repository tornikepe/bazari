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

  return (
    <section aria-label={t.track.progressTitle}>
      <h3 className="text-sm font-bold text-ink-900">{t.track.progressTitle}</h3>

      {/* A list, because that is what it is: a sequence with a position in it.
          `aria-current` marks where the order stands, which is the one thing a
          screen reader cannot infer from ticks and colours. */}
      <ol className="mt-3">
        {STEPS.map((step, index) => {
          const at = reachedAt.get(step);
          const isCurrent = !cancelled && index === currentIndex;

          /* Ticked when the order actually got here — read from the history
             rather than from the position, so a cancelled order still shows
             the steps it did reach, and "delivered" ticks its own last box
             instead of standing on it wearing a number. */
          const done = reachedAt.has(step) && (!isCurrent || status === "delivered");
          const reached = done || isCurrent;

          return (
            <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
              {/* The rail, drawn between the markers rather than behind them,
                  so a hairline never shows through a tick. */}
              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-7 bottom-0 left-[11px] w-px ${
                    done ? "bg-brand-600" : "bg-line"
                  }`}
                />
              )}

              <span
                aria-hidden="true"
                className={`relative z-1 mt-0.5 grid h-6 w-6 shrink-0 place-items-center border text-xs ${
                  done
                    ? "border-brand-600 bg-brand-600 text-brand-on-solid"
                    : isCurrent
                      ? "border-brand-600 bg-surface text-brand-600"
                      : "border-line bg-surface text-ink-300"
                }`}
              >
                {done ? <CheckIcon size={13} strokeWidth={3} /> : index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  {...(isCurrent ? { "aria-current": "step" as const } : {})}
                  className={`text-sm font-bold ${reached ? "text-ink-900" : "text-ink-400"}`}
                >
                  {t.status[step]}
                </p>

                {/* The meaning only where the reader is standing. On every row
                    it becomes a wall of text that says nothing about *them*. */}
                {isCurrent && (
                  <p className="mt-0.5 text-sm text-ink-600">{t.track.meaning[step]}</p>
                )}

                {/* No line at all rather than an empty one: a step that
                    happened without a recorded time says nothing about when. */}
                {(at || !reached) && (
                  <p className="mt-0.5 text-xs text-ink-400">
                    {at ? formatDateTime(at) : t.track.notReached}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {cancelled && (
        <p className="mt-1 flex items-start gap-2 border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <CloseIcon size={15} className="mt-0.5 shrink-0" />
          {t.track.cancelledNote}
        </p>
      )}

      {/* What the shop will do next, in the shop's own voice. */}
      <p className="mt-4 border-t border-line pt-4 text-sm text-ink-600">
        <span className="mr-1.5 font-bold text-ink-900">{t.track.nextLabel}:</span>
        {t.track.next[status]}
      </p>
    </section>
  );
}
