"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { RefreshIcon } from "@/components/ui/icons";
import { fill } from "@/lib/i18n";
import { requestReturn } from "@/app/actions/returns";
import { RETURN_REASONS, type ReturnReason, type ReturnStatus } from "@/lib/returns";
import { Busy, Swap } from "@/components/ui/Swap";

export type ReturnLine = {
  orderItemId: string;
  nameKa: string;
  nameEn: string;
  variantLabel: string;
  quantity: number;
};

export type ReturnRecord = {
  id: string;
  status: ReturnStatus;
  reason: ReturnReason;
  note: string;
  staffNote: string;
  /** Formatted on the server, where the time zone lives. */
  createdAtLabel: string;
  items: { nameKa: string; nameEn: string; variantLabel: string; quantity: number }[];
};

const STATUS_STYLES: Record<ReturnStatus, string> = {
  requested: "bg-warning-soft text-warning",
  approved: "bg-info-soft text-info",
  rejected: "bg-ink-100 text-ink-500",
  received: "bg-brand-100 text-brand-700",
  refunded: "bg-success-soft text-success",
};

/**
 * The returns process, on the order it belongs to.
 *
 * Two halves. What has been asked already, with the shop's answer beside each
 * — so nobody has to phone to find out where a parcel stands. And, when the
 * rules allow, the form to ask again: which lines, how many, and why.
 *
 * `allowed` is decided on the server from the delivery date, the window and
 * what is already in flight; this component only draws the reason it was
 * given. The action checks the same rule again before writing anything.
 */
export function ReturnPanel({
  orderNumber,
  lines,
  requests,
  allowed,
  windowDays,
}: {
  orderNumber: string;
  lines: ReturnLine[];
  requests: ReturnRecord[];
  allowed:
    | { ok: true }
    | { ok: false; reason: "not-delivered" | "window-closed" | "already-open" | "off" };
  windowDays: number;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReturnReason>("damaged");
  const [note, setNote] = useState("");
  const [chosen, setChosen] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((line) => [line.orderItemId, line.quantity])),
  );
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);
  const [sent, setSent] = useState(false);

  const name = (row: { nameKa: string; nameEn: string }) =>
    locale === "ka" ? row.nameKa : row.nameEn;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const items = Object.entries(chosen)
      .filter(([, quantity]) => quantity > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) {
      setError({ title: t.returns.nothingChosen });
      return;
    }

    startTransition(async () => {
      const result = await requestReturn({ orderNumber, reason, note, items });
      if (!result.ok) {
        const title =
          result.error === "window-closed"
            ? t.returns.windowClosed
            : result.error === "not-delivered"
              ? t.returns.notDelivered
              : result.error === "already-open"
                ? t.returns.alreadyOpen
                : result.error === "off"
                  ? t.returns.off
                  : result.error === "rate-limited"
                    ? t.checkout.rateLimited
                    : t.returns.failed;
        setError({ title, hint: result.error === "failed" ? t.returns.failedHint : undefined });
        return;
      }
      setSent(true);
      setOpen(false);
      router.refresh();
    });
  }

  // Nothing to say: no requests, and no way to make one because the shop
  // does not take them. A panel explaining that would be a panel about
  // nothing on every order.
  if (requests.length === 0 && !allowed.ok && allowed.reason === "off") return null;

  return (
    <section className="returns-panel card mt-4 card-pad">
      <div className="flex items-center gap-3">
        <span className="order-delivery-mark">
          <RefreshIcon size={18} />
        </span>
        <div>
          <h2 className="text-sm font-bold text-ink-900">{t.returns.title}</h2>
          {/* What the window is, said once under the title rather than as a
              footnote under a rule. */}
          {allowed.ok || allowed.reason === "not-delivered" ? (
            <p className="mt-0.5 text-xs text-ink-500">{fill(t.returns.windowHint, { days: windowDays })}</p>
          ) : null}
        </div>
      </div>

      {requests.length > 0 && (
        <ol className="mt-3 flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id} className="rounded-control border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`badge ${STATUS_STYLES[request.status]}`}>
                  {t.returnStatus[request.status]}
                </span>
                <span className="text-xs text-ink-400">
                  {t.returns.requestedOn} {request.createdAtLabel}
                </span>
              </div>

              <p className="mt-2 text-xs text-ink-600">{t.returns.statusHint[request.status]}</p>

              <p className="mt-2 text-xs text-ink-500">
                <span className="font-semibold text-ink-700">{t.returns.reason}:</span>{" "}
                {t.returnReason[request.reason]}
                {request.note && ` — ${request.note}`}
              </p>

              <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink-600">
                {request.items.map((item, index) => (
                  <li key={index}>
                    {item.quantity} × {name(item)}
                    {item.variantLabel && ` · ${item.variantLabel}`}
                  </li>
                ))}
              </ul>

              {request.staffNote && (
                <div className="mt-3 rounded-control bg-ink-50 p-2.5 text-xs leading-snug text-ink-700">
                  <p className="font-semibold text-ink-800">{t.returns.shopReply}</p>
                  <p className="mt-0.5 whitespace-pre-line">{request.staffNote}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {sent && (
        <p role="status" className="mt-3 text-sm text-success">
          {t.returns.sent}
        </p>
      )}

      {allowed.ok ? (
        open ? (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
            <p className="text-xs text-ink-500">{t.returns.requestHint}</p>

            <fieldset>
              <legend className="field-label">{t.returns.items}</legend>
              <ul className="flex flex-col gap-2">
                {lines.map((line) => {
                  const quantity = chosen[line.orderItemId] ?? 0;
                  return (
                    <li key={line.orderItemId} className="flex items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        id={`ret-${line.orderItemId}`}
                        checked={quantity > 0}
                        onChange={(event) =>
                          setChosen((current) => ({
                            ...current,
                            [line.orderItemId]: event.target.checked ? line.quantity : 0,
                          }))
                        }
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <label htmlFor={`ret-${line.orderItemId}`} className="min-w-0 flex-1 text-ink-800">
                        {name(line)}
                        {line.variantLabel && (
                          <span className="text-ink-400"> · {line.variantLabel}</span>
                        )}
                      </label>
                      {line.quantity > 1 && (
                        <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-500">
                          {t.returns.quantity}
                          <input
                            type="number"
                            min={1}
                            max={line.quantity}
                            value={Math.max(1, quantity)}
                            disabled={quantity === 0}
                            onChange={(event) =>
                              setChosen((current) => ({
                                ...current,
                                [line.orderItemId]: Math.min(
                                  line.quantity,
                                  Math.max(1, Math.floor(Number(event.target.value)) || 1),
                                ),
                              }))
                            }
                            className="field w-16"
                          />
                        </label>
                      )}
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <div>
              <label className="field-label" htmlFor="return-reason">
                {t.returns.reason}
              </label>
              <select
                id="return-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as ReturnReason)}
                className="field"
              >
                {RETURN_REASONS.map((option) => (
                  <option key={option} value={option}>
                    {t.returnReason[option]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="return-note">
                {t.returns.noteOptional}
              </label>
              <textarea
                id="return-note"
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="field"
              />
            </div>

            {error && <ErrorNote title={error.title} hint={error.hint} />}

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
                <Swap
                  show={isPending ? <Busy label={t.returns.submitting} /> : t.returns.submit}
                  of={[t.returns.submit, t.returns.submitting]}
                />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-md">
                {t.admin.cancel}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 border-t border-line pt-4">
            <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-md">
              <RefreshIcon size={15} />
              {t.returns.request}
            </button>
          </div>
        )
      ) : allowed.reason === "not-delivered" ? null : (
        <p className="mt-4 border-t border-line pt-4 text-xs text-ink-500">
          {allowed.reason === "window-closed"
            ? t.returns.windowClosed
            : allowed.reason === "already-open"
              ? t.returns.alreadyOpen
              : t.returns.off}
        </p>
      )}
    </section>
  );
}
