"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { SpinnerIcon } from "@/components/ui/icons";
import { moveReturn } from "@/app/actions/returns";
import { RETURN_TRANSITIONS, type ReturnReason, type ReturnStatus } from "@/lib/returns";

export type ReturnRow = {
  id: string;
  status: ReturnStatus;
  reason: ReturnReason;
  note: string;
  staffNote: string;
  actor: string;
  /** Formatted on the server, where the time zone lives. */
  createdAtLabel: string;
  order: { id: string; number: string; customerName: string; phone: string };
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
 * The shop's side of a return.
 *
 * One card per request: who, what, why, and the buttons that move it on. The
 * buttons are exactly the transitions `RETURN_TRANSITIONS` allows from where
 * the request is, so a finished one shows none — the rule lives in one place
 * and this component only draws it.
 *
 * The reply is typed once and sent with whichever button is pressed: "we
 * approved it, and here is the address" and "we rejected it, and here is
 * why" are the same gesture.
 */
export function ReturnsManager({ requests }: { requests: ReturnRow[] }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = (row: { nameKa: string; nameEn: string }) =>
    locale === "ka" ? row.nameKa : row.nameEn;

  const LABELS: Record<ReturnStatus, string> = {
    requested: t.returnStatus.requested,
    approved: t.admin.returnApprove,
    rejected: t.admin.returnReject,
    received: t.admin.returnReceived,
    refunded: t.admin.returnRefunded,
  };

  function move(request: ReturnRow, status: ReturnStatus) {
    setError(null);
    setBusy(request.id);
    startTransition(async () => {
      const result = await moveReturn(request.id, status, notes[request.id] ?? request.staffNote);
      setBusy(null);
      if (!result.ok) {
        setError(t.common.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorNote title={error} hint={t.common.errorHint} />}

      {requests.map((request) => {
        const next = RETURN_TRANSITIONS[request.status];
        return (
          <article key={request.id} className="card card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/orders/${request.order.id}`}
                    className="font-mono text-sm font-bold text-ink-900 hover:text-brand-600"
                  >
                    {request.order.number}
                  </Link>
                  <span className={`badge ${STATUS_STYLES[request.status]}`}>
                    {t.returnStatus[request.status]}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {request.order.customerName} · {request.order.phone} · {request.createdAtLabel}
                </p>
              </div>

              <dl className="text-xs">
                <dt className="text-ink-400">{t.admin.returnReason}</dt>
                <dd className="font-semibold text-ink-800">{t.returnReason[request.reason]}</dd>
              </dl>
            </div>

            {request.note && (
              <p className="mt-3 rounded-control bg-accent-50 p-2.5 text-xs leading-snug text-accent-900">
                <span className="font-bold text-accent-800">{t.admin.returnNote}: </span>
                {request.note}
              </p>
            )}

            <ul className="mt-3 flex flex-col gap-0.5 text-xs text-ink-700">
              {request.items.map((item, index) => (
                <li key={index}>
                  {item.quantity} × {name(item)}
                  {item.variantLabel && <span className="text-ink-400"> · {item.variantLabel}</span>}
                </li>
              ))}
            </ul>

            {canWrite && next.length > 0 ? (
              <div className="mt-4 border-t border-line pt-4">
                <label className="field-label" htmlFor={`note-${request.id}`}>
                  {t.admin.returnStaffNote}
                </label>
                <textarea
                  id={`note-${request.id}`}
                  rows={2}
                  maxLength={1000}
                  value={notes[request.id] ?? request.staffNote}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [request.id]: event.target.value }))
                  }
                  className="field"
                />
                <p className="mt-1 text-xs text-ink-400">{t.admin.returnStaffNoteHint}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {next.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={isPending}
                      onClick={() => move(request, status)}
                      className={`btn btn-sm ${
                        status === "rejected" ? "btn-outline" : "btn-primary"
                      }`}
                      title={status === "received" ? t.admin.returnReceivedHint : undefined}
                    >
                      {isPending && busy === request.id && <SpinnerIcon size={14} />}
                      {LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            ) : request.staffNote ? (
              <div className="mt-3 rounded-control bg-ink-50 p-2.5 text-xs leading-snug text-ink-700">
                <p className="font-semibold text-ink-800">
                  {t.admin.returnStaffNote}
                  {request.actor && <span className="font-normal text-ink-400"> · {request.actor}</span>}
                </p>
                <p className="mt-0.5 whitespace-pre-line">{request.staffNote}</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
