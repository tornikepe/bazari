"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PencilIcon, PlusIcon, SpinnerIcon } from "@/components/ui/icons";
import { saveCoupon, setCouponActive } from "@/app/actions/coupons";

export type CouponRow = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  /** Money is formatted on the server, where the locale and the currency live. */
  amountLabel: string | null;
  minOrderTotal: number;
  minOrderLabel: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  /** `yyyy-mm-dd`, for the date input. */
  expiresValue: string;
  isActive: boolean;
};

export function CouponManager({ coupons }: { coupons: CouponRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  /** `null` closed, `"new"` adding, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = coupons.find((coupon) => coupon.id === editing);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await saveCoupon(formData);

      if (!result.ok) {
        setError(result.error === "taken" ? t.admin.couponTaken : t.admin.couponInvalid);
        return;
      }

      setEditing(null);
      router.refresh();
    });
  }

  function toggle(coupon: CouponRow) {
    setError(null);
    startTransition(async () => {
      const result = await setCouponActive(coupon.id, !coupon.isActive);
      if (!result.ok) {
        setError(t.common.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorNote title={error} hint={t.common.errorHint} />}

      {coupons.length > 0 && (
        <ul className="flex flex-col gap-2">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink-900">{coupon.code}</span>
                  <span
                    className={`badge ${
                      coupon.isActive ? "bg-success-soft text-success" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {coupon.isActive ? t.admin.couponActive : t.admin.couponPaused}
                  </span>
                </p>

                <p className="mt-1 text-xs text-ink-500">
                  {coupon.percentOff !== null ? `−${coupon.percentOff}%` : `−${coupon.amountLabel}`}
                  {coupon.minOrderLabel && ` · ${t.admin.couponMinOrder}: ${coupon.minOrderLabel}`}
                  {" · "}
                  {t.admin.couponUsed}: {coupon.usedCount}
                  {coupon.maxUses === null ? ` / ${t.admin.couponUnlimited}` : ` / ${coupon.maxUses}`}
                  {" · "}
                  {coupon.expiresAt ?? t.admin.couponNoExpiry}
                </p>
              </div>

              {canWrite && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(coupon.id)}
                    className="btn btn-ghost h-9 w-9 rounded-control p-0"
                    aria-label={`${t.admin.edit} — ${coupon.code}`}
                  >
                    <PencilIcon size={15} />
                  </button>

                  {/* Turned off, never deleted: orders point at the coupon they
                      were placed with, and removing the row would leave a
                      discount in a total with nothing left to explain it. */}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => toggle(coupon)}
                    className="btn btn-outline btn-sm"
                  >
                    {coupon.isActive ? t.admin.couponPause : t.admin.couponResume}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!canWrite ? null : editing ? (
        <form key={editing} onSubmit={submit} className="card flex flex-col gap-4 p-5">
          {current && <input type="hidden" name="id" value={current.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">{t.admin.couponCode}</span>
              <input
                name="code"
                required
                defaultValue={current?.code ?? ""}
                placeholder="WELCOME10"
                /* Upper-cased on the way in as well as on the server, so the
                   field shows what will actually be stored. */
                className="field font-mono uppercase"
              />
            </label>

            <label className="block">
              <span className="field-label">{t.admin.couponKind}</span>
              <select
                name="kind"
                defaultValue={current?.amountOff !== null && current ? "amount" : "percent"}
                className="field"
              >
                <option value="percent">{t.admin.couponPercent}</option>
                <option value="amount">{t.admin.couponAmount}</option>
              </select>
            </label>

            <label className="block">
              <span className="field-label">{t.admin.couponValue}</span>
              <input
                name="value"
                type="number"
                min={1}
                required
                defaultValue={
                  current?.percentOff ??
                  (current?.amountOff !== null && current?.amountOff !== undefined
                    ? current.amountOff / 100
                    : "")
                }
                className="field"
              />
            </label>

            <label className="block">
              <span className="field-label">{t.admin.couponMinOrder}</span>
              <input
                name="minOrderTotal"
                type="number"
                min={0}
                defaultValue={current ? current.minOrderTotal / 100 : 0}
                className="field"
              />
            </label>

            <label className="block">
              <span className="field-label">{t.admin.couponMaxUses}</span>
              <input
                name="maxUses"
                type="number"
                min={1}
                defaultValue={current?.maxUses ?? ""}
                className="field"
              />
              <span className="mt-1 block text-xs text-ink-400">{t.admin.couponMaxUsesHint}</span>
            </label>

            <label className="block">
              <span className="field-label">{t.admin.couponExpires}</span>
              <input
                name="expiresAt"
                type="date"
                defaultValue={current?.expiresValue ?? ""}
                className="field"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={current?.isActive ?? true}
              className="h-4 w-4 accent-brand-600"
            />
            {t.admin.couponActive}
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
              {isPending && <SpinnerIcon size={14} />}
              {t.admin.save}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-outline btn-sm">
              {t.admin.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="btn btn-primary btn-sm w-fit">
          <PlusIcon size={15} />
          {t.admin.couponNew}
        </button>
      )}
    </div>
  );
}
