"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { deleteCategory, saveCategory } from "@/app/actions/admin";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { AlertIcon, CloseIcon, PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";

export type AdminCategory = {
  id: string;
  slug: string;
  nameKa: string;
  nameEn: string;
  icon: string;
  sortOrder: number;
  _count: { products: number };
};

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  // `null` = closed, `"new"` = create, otherwise the category being edited.
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const id = editing && editing !== "new" ? editing.id : null;

    startTransition(async () => {
      const result = await saveCategory(id, formData);

      if (!result.ok) {
        setError(result.error === "slug-taken" ? t.admin.slugTaken : t.admin.required);
        return;
      }

      setEditing(null);
      router.refresh();
    });
  }

  function handleDelete(category: AdminCategory) {
    if (!window.confirm(t.admin.deleteConfirm)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCategory(category.id);

      if (!result.ok) {
        setError(result.error === "has-products" ? t.admin.categoryHasProducts : t.common.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ReadOnlyNotice />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
          {t.admin.categories}
          <span className="ml-2 text-sm font-medium text-ink-400">{categories.length}</span>
        </h1>

        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="btn btn-primary btn-sm"
          >
            <PlusIcon size={15} />
            {t.admin.newCategory}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-control bg-danger-soft p-3 text-sm text-danger"
        >
          <AlertIcon size={16} className="shrink-0" />
          {error}
        </p>
      )}

      {/* ------------------------------- form ------------------------------- */}
      {canWrite && editing && (
        <form onSubmit={handleSubmit} className="card mt-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-900">
              {editing === "new" ? t.admin.newCategory : t.admin.editCategory}
            </h2>
            <button
              type="button"
              onClick={() => setEditing(null)}
              aria-label={t.admin.cancel}
              className="btn btn-ghost h-8 w-8 rounded-control p-0"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {/* Remount on target change so defaultValues refresh. */}
          <div
            key={editing === "new" ? "new" : editing.id}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="field-label" htmlFor="nameKa">
                {t.admin.nameKa}
                <span className="ml-0.5 text-brand-600">*</span>
              </label>
              <input
                id="nameKa"
                name="nameKa"
                required
                defaultValue={editing === "new" ? "" : editing.nameKa}
                className="field"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="nameEn">
                {t.admin.nameEn}
                <span className="ml-0.5 text-brand-600">*</span>
              </label>
              <input
                id="nameEn"
                name="nameEn"
                required
                defaultValue={editing === "new" ? "" : editing.nameEn}
                className="field"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="slug">
                {t.admin.slug}
              </label>
              <input
                id="slug"
                name="slug"
                defaultValue={editing === "new" ? "" : editing.slug}
                className="field"
              />
              <p className="mt-1 text-xs text-ink-400">{t.admin.slugHint}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="icon">
                  {t.admin.icon}
                </label>
                <input
                  id="icon"
                  name="icon"
                  maxLength={4}
                  placeholder="📦"
                  defaultValue={editing === "new" ? "" : editing.icon}
                  className="field text-center"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="sortOrder">
                  {t.admin.sortOrder}
                </label>
                <input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={editing === "new" ? categories.length + 1 : editing.sortOrder}
                  className="field"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="btn btn-outline btn-sm">
              {t.admin.cancel}
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
              {isPending && <SpinnerIcon size={15} />}
              {editing === "new" ? t.admin.create : t.admin.save}
            </button>
          </div>
        </form>
      )}

      {/* ------------------------------- list ------------------------------- */}
      {categories.length === 0 ? (
        <div className="card mt-5 px-6 py-16 text-center">
          <p className="text-sm text-ink-500">{t.admin.noCategories}</p>
        </div>
      ) : (
        // `min-w-0` on the rows: a grid item's default `min-width: auto`
        // refuses to shrink below its content, so the truncation on the name
        // inside never got a chance to apply and the row pushed the whole page
        // sideways at 390px in Georgian, where the names run longer.
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {categories.map((category) => (
            <li key={category.id} className="card flex min-w-0 items-center gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-ink-50 text-xl">
                {category.icon}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">
                  {locale === "ka" ? category.nameKa : category.nameEn}
                </p>
                <p className="truncate text-xs text-ink-400">
                  /{category.slug} · {category._count.products} {t.admin.productCount}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/catalog?category=${category.slug}`}
                  target="_blank"
                  className="btn btn-ghost h-8 px-2 text-xs"
                >
                  ↗
                </Link>

                {canWrite && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditing(category);
                      }}
                      aria-label={t.admin.edit}
                      className="btn btn-ghost h-8 w-8 rounded-control p-0"
                    >
                      <PencilIcon size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(category)}
                      disabled={isPending}
                      aria-label={t.admin.delete}
                      className="btn btn-ghost h-8 w-8 rounded-control p-0 text-ink-400 hover:bg-danger-soft hover:text-danger"
                    >
                      <TrashIcon size={15} />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
