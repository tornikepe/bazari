"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { deleteProduct, toggleProductActive } from "@/app/actions/admin";
import { PencilIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";

export function ProductRowActions({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onToggle() {
    startTransition(async () => {
      await toggleProductActive(id);
      router.refresh();
    });
  }

  function onDelete() {
    if (!window.confirm(t.admin.deleteConfirm)) return;

    startTransition(async () => {
      await deleteProduct(id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Active/inactive switch */}
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        role="switch"
        aria-checked={isActive}
        aria-label={t.admin.active}
        title={t.admin.active}
        className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors ${
          isActive ? "bg-success" : "bg-ink-300"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-pill bg-white transition-all ${
            isActive ? "left-[1.125rem]" : "left-0.5"
          }`}
        />
      </button>

      <Link
        href={`/dashboard/products/${id}`}
        aria-label={t.admin.edit}
        title={t.admin.edit}
        className="btn btn-ghost h-8 w-8 rounded-control p-0"
      >
        <PencilIcon size={15} />
      </Link>

      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        aria-label={t.admin.delete}
        title={t.admin.delete}
        className="btn btn-ghost h-8 w-8 rounded-control p-0 text-ink-400 hover:bg-danger-soft hover:text-danger"
      >
        {isPending ? <SpinnerIcon size={15} /> : <TrashIcon size={15} />}
      </button>
    </div>
  );
}
