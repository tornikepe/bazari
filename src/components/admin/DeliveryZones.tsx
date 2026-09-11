"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";
import { deleteDeliveryZone, saveDeliveryZone } from "@/app/actions/delivery";

export type DeliveryZoneItem = {
  id: string;
  nameKa: string;
  nameEn: string;
  /** Tetri. */
  fee: number;
  freeAbove: number | null;
  /** Formatted on the server, where the locale and the currency live. */
  feeLabel: string;
  freeAboveLabel: string | null;
  sortOrder: number;
  isActive: boolean;
};

/**
 * The courier's map: each place it goes, and what it costs to send it there.
 *
 * The same shape as the coupon list — rows with an edit button, one form at a
 * time — because it is the same job. A zone is deleted rather than paused:
 * orders keep the zone's name in their own columns, so nothing an old order
 * says about where it went is lost when the row goes.
 */
export function DeliveryZones({ zones }: { zones: DeliveryZoneItem[] }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  /** `null` closed, `"new"` adding, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = zones.find((zone) => zone.id === editing);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await saveDeliveryZone(formData);
      if (!result.ok) {
        setError(result.error === "invalid" ? t.admin.deliveryZoneInvalid : t.common.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(zone: DeliveryZoneItem) {
    if (!window.confirm(t.admin.deliveryZoneDeleteConfirm)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteDeliveryZone(zone.id);
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

      {zones.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="card flex flex-wrap items-center gap-x-4 gap-y-2 card-pad-tight"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-ink-900">
                    {locale === "ka" ? zone.nameKa : zone.nameEn}
                  </span>
                  <span
                    className={`badge ${
                      zone.isActive ? "bg-success-soft text-success" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {zone.isActive ? t.admin.deliveryZoneActive : t.admin.deliveryZoneInactive}
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {zone.feeLabel}
                  {zone.freeAboveLabel && ` · ${t.admin.deliveryZoneFreeAbove}: ${zone.freeAboveLabel}`}
                </p>
              </div>

              {canWrite && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(zone.id)}
                    className="btn btn-ghost h-9 w-9 rounded-control p-0"
                    aria-label={`${t.admin.edit} — ${locale === "ka" ? zone.nameKa : zone.nameEn}`}
                  >
                    <PencilIcon size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => remove(zone)}
                    className="btn btn-ghost h-9 w-9 rounded-control p-0 text-danger"
                    aria-label={`${t.admin.deliveryZoneDelete} — ${locale === "ka" ? zone.nameKa : zone.nameEn}`}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">
          <span className="font-semibold text-ink-700">{t.admin.deliveryZoneNone}.</span>{" "}
          {t.admin.deliveryZoneNoneHint}
        </p>
      )}

      {!canWrite ? null : editing ? (
        <form key={editing} onSubmit={submit} className="card flex flex-col gap-4 card-pad">
          {current && <input type="hidden" name="id" value={current.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">{t.admin.deliveryZoneNameKa}</span>
              <input
                name="nameKa"
                required
                defaultValue={current?.nameKa ?? ""}
                placeholder="თბილისი"
                className="field"
              />
            </label>

            <label className="block">
              <span className="field-label">{t.admin.deliveryZoneNameEn}</span>
              <input
                name="nameEn"
                required
                defaultValue={current?.nameEn ?? ""}
                placeholder="Tbilisi"
                className="field"
              />
            </label>

            <label className="block">
              <span className="field-label">{t.admin.deliveryZoneFee}</span>
              <input
                name="fee"
                type="number"
                min={0}
                step="0.01"
                required
                // Lari, not tetri. The action multiplies by 100.
                defaultValue={current ? (current.fee / 100).toFixed(2) : ""}
                className="field"
              />
            </label>

            <label className="block">
              <span className="field-label">{t.admin.deliveryZoneFreeAbove}</span>
              <input
                name="freeAbove"
                type="number"
                min={0}
                step="0.01"
                defaultValue={
                  current?.freeAbove !== null && current?.freeAbove !== undefined
                    ? (current.freeAbove / 100).toFixed(2)
                    : ""
                }
                className="field"
              />
              <span className="mt-1 block text-xs text-ink-400">
                {t.admin.deliveryZoneFreeAboveHint}
              </span>
            </label>

            <label className="block">
              <span className="field-label">{t.admin.deliveryZoneOrder}</span>
              <input
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={current?.sortOrder ?? zones.length}
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
            {t.admin.deliveryZoneActive}
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
          {t.admin.deliveryZoneNew}
        </button>
      )}
    </div>
  );
}
