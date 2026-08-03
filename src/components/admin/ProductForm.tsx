"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { saveProduct } from "@/app/actions/admin";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";

const DEFAULT_IMAGE = "/products/placeholder.svg";

export type ProductFormValues = {
  id?: string;
  slug: string;
  sku: string;
  costPrice: number;
  lowStockAt: number;
  nameKa: string;
  nameEn: string;
  descriptionKa: string;
  descriptionEn: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  image: string;
  brand: string;
  shippingDays: number;
  isFeatured: boolean;
  isActive: boolean;
  categoryId: string;
};

export function ProductForm({
  product,
  categories,
}: {
  product?: ProductFormValues;
  categories: { id: string; nameKa: string; nameEn: string; icon: string }[];
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Only for the live preview — the value submitted is the input's own.
  const [image, setImage] = useState(product?.image ?? DEFAULT_IMAGE);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveProduct(product?.id ?? null, formData);

      if (!result.ok) {
        setError(
          result.error === "slug-taken"
            ? t.admin.slugTaken
            : result.error === "sku-taken"
              ? t.admin.skuTaken
              : result.error === "invalid"
                ? t.admin.required
                : t.common.error,
        );
        return;
      }

      router.push("/dashboard/products");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
          {product ? t.admin.editProduct : t.admin.newProduct}
        </h1>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/products" className="btn btn-outline btn-sm">
            {t.admin.cancel}
          </Link>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
            {isPending && <SpinnerIcon size={15} />}
            {isPending ? t.admin.saving : product ? t.admin.save : t.admin.create}
          </button>
        </div>
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="flex flex-col gap-4">
          {/* ------------------------------ basics --------------------------- */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.product.description}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Text name="nameKa" label={t.admin.nameKa} defaultValue={product?.nameKa} required />
              <Text name="nameEn" label={t.admin.nameEn} defaultValue={product?.nameEn} required />

              <Text
                name="slug"
                label={t.admin.slug}
                defaultValue={product?.slug}
                hint={t.admin.slugHint}
              />
              <Text name="sku" label={t.admin.skuField} defaultValue={product?.sku} />

              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="descriptionKa">
                  {t.admin.descriptionKa}
                </label>
                <textarea
                  id="descriptionKa"
                  name="descriptionKa"
                  rows={3}
                  defaultValue={product?.descriptionKa}
                  className="field"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="descriptionEn">
                  {t.admin.descriptionEn}
                </label>
                <textarea
                  id="descriptionEn"
                  name="descriptionEn"
                  rows={3}
                  defaultValue={product?.descriptionEn}
                  className="field"
                />
              </div>
            </div>
          </section>

          {/* ------------------------- price and stock ----------------------- */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.price}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Text
                name="price"
                label={t.admin.price}
                type="number"
                step="0.01"
                min="0"
                defaultValue={product ? product.price / 100 : ""}
                required
              />
              <Text
                name="oldPrice"
                label={t.admin.oldPrice}
                type="number"
                step="0.01"
                min="0"
                defaultValue={product?.oldPrice != null ? product.oldPrice / 100 : ""}
                hint={t.admin.oldPriceHint}
              />
              <Text
                name="stock"
                label={t.admin.stock}
                type="number"
                min="0"
                defaultValue={product?.stock ?? 0}
              />
              <Text
                name="costPrice"
                label={t.admin.costPriceField}
                type="number"
                step="0.01"
                min="0"
                defaultValue={product ? product.costPrice / 100 : 0}
              />
              <Text
                name="lowStockAt"
                label={t.admin.lowStockAtField}
                type="number"
                min="0"
                defaultValue={product?.lowStockAt ?? 10}
              />
            </div>
          </section>

          {/* ------------------------------ meta ----------------------------- */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.overview}</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Text name="brand" label={t.admin.brandField} defaultValue={product?.brand} />
              <Text
                name="shippingDays"
                label={t.admin.shippingDaysField}
                type="number"
                min="1"
                defaultValue={product?.shippingDays ?? 14}
              />
            </div>
          </section>
        </div>

        {/* ------------------------------ sidebar --------------------------- */}
        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.image}</h2>

            <div className="relative mt-3 aspect-square overflow-hidden rounded-control bg-ink-50">
              <Image
                src={image || DEFAULT_IMAGE}
                alt=""
                fill
                sizes="240px"
                className="object-cover"
                // A typo'd URL shouldn't blank the preview permanently.
                onError={() => setImage(DEFAULT_IMAGE)}
              />
            </div>

            <div className="mt-3">
              <input
                name="image"
                defaultValue={product?.image ?? DEFAULT_IMAGE}
                onChange={(event) => setImage(event.target.value.trim() || DEFAULT_IMAGE)}
                placeholder={DEFAULT_IMAGE}
                aria-label={t.admin.image}
                className="field text-xs"
              />
              <p className="mt-1 text-xs text-ink-400">{t.admin.imageHint}</p>
            </div>
          </section>

          <section className="card p-5">
            <label className="field-label" htmlFor="categoryId">
              {t.admin.categoryField}
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.categoryId ?? categories[0]?.id}
              required
              className="field"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {locale === "ka" ? category.nameKa : category.nameEn}
                </option>
              ))}
            </select>

            <div className="mt-4 flex flex-col gap-3">
              <Switch
                name="isActive"
                label={t.admin.active}
                defaultChecked={product?.isActive ?? true}
              />
              <Switch
                name="isFeatured"
                label={t.admin.featured}
                defaultChecked={product?.isFeatured ?? false}
              />
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function Text({
  name,
  label,
  hint,
  required = false,
  type = "text",
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      <input id={name} name={name} type={type} required={required} className="field" {...rest} />
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

function Switch({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-xs font-medium text-ink-700">{label}</span>

      {/* The real checkbox stays in the form so FormData picks it up. */}
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors ${
          checked ? "bg-success" : "bg-ink-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-pill bg-white transition-all ${
            checked ? "left-[1.125rem]" : "left-0.5"
          }`}
        />
      </span>
    </label>
  );
}
