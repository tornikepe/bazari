"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { saveProduct } from "@/app/actions/admin";
import { MAX_GALLERY } from "@/lib/image-upload";
import { AlertIcon, CloseIcon, PlusIcon, SpinnerIcon, UploadIcon } from "@/components/ui/icons";

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
  images: string[];
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
  const [gallery, setGallery] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /**
   * Sends the chosen file and puts the URL it comes back with into the field.
   *
   * The server decides what the file is by reading its bytes, so the messages
   * below are translations of its refusal rather than a second opinion formed
   * here — a client-side check would only be a courtesy, and one that disagreed
   * with the server would be worse than none.
   */
  async function upload(event: React.ChangeEvent<HTMLInputElement>, into: "main" | "gallery") {
    const file = event.target.files?.[0];
    // Cleared straight away so choosing the same file twice fires `change`
    // again — otherwise a retry after a failure does nothing at all.
    event.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/images", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        setUploadError(
          data.error === "too-large"
            ? t.admin.imageTooLarge
            : data.error === "not-an-image"
              ? t.admin.imageNotAnImage
              : t.admin.imageFailed,
        );
        return;
      }

      if (into === "main") setImage(data.url);
      else setGallery((current) => (current.includes(data.url!) ? current : [...current, data.url!]));
    } catch {
      setUploadError(t.admin.imageFailed);
    } finally {
      setUploading(false);
    }
  }

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
              {/* Blank is the normal case for a new product — the server
                  generates one. The hint says so, so the field does not read
                  as something the shop owner is expected to invent. */}
              <Text
                name="sku"
                label={t.admin.skuField}
                defaultValue={product?.sku}
                hint={product ? undefined : t.admin.skuHint}
                placeholder={product ? undefined : "TEL-K7M2Q"}
              />

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

            <div className="mt-3 flex flex-col gap-2">
              {/* Pick a file. The upload happens on choosing it rather than on
                  saving the product, so the preview above is the real stored
                  photo and not a local object URL that disappears on reload —
                  and so a failed upload is reported while the reader is still
                  looking at the field, not after they press save. */}
              <label className="btn btn-outline btn-sm w-full cursor-pointer">
                {uploading ? <SpinnerIcon size={15} /> : <UploadIcon size={15} />}
                {uploading ? t.admin.imageUploading : t.admin.imageChoose}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={uploading}
                  onChange={(event) => upload(event, "main")}
                  className="sr-only"
                />
              </label>

              {uploadError && (
                <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
                  <AlertIcon size={13} className="shrink-0" />
                  {uploadError}
                </p>
              )}

              {/* The URL is still here and still the field that is saved. An
                  upload writes into it; a link pasted by hand works exactly as
                  it did before. */}
              <input
                name="image"
                value={image}
                onChange={(event) => setImage(event.target.value.trim() || DEFAULT_IMAGE)}
                placeholder={DEFAULT_IMAGE}
                aria-label={t.admin.imageOrUrl}
                className="field text-xs"
              />
              <p className="text-xs text-ink-400">{t.admin.imageHint}</p>
            </div>

            {/* ------------------------- more photos ------------------------ */}
            <h3 className="mt-5 border-t border-line pt-4 text-sm font-bold text-ink-900">
              {t.admin.gallery}
            </h3>
            <p className="mt-1 text-xs text-ink-400">{t.admin.galleryHint}</p>

            {gallery.length > 0 && (
              <ul className="mt-3 grid grid-cols-4 gap-2">
                {gallery.map((url, index) => (
                  <li key={url} className="relative">
                    <div className="relative aspect-square overflow-hidden border border-line bg-ink-50">
                      <Image src={url} alt="" fill sizes="64px" className="object-cover" />
                    </div>

                    {/* Named by position, because "remove" seven times over is
                        the same button seven times to a screen reader. */}
                    <button
                      type="button"
                      onClick={() => setGallery((current) => current.filter((item) => item !== url))}
                      aria-label={fill(t.admin.galleryRemove, { index: index + 1 })}
                      className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center border border-line bg-surface text-ink-500 hover:text-danger"
                    >
                      <CloseIcon size={14} />
                    </button>

                    {/* The value that is actually posted. */}
                    <input type="hidden" name="images" value={url} />
                  </li>
                ))}
              </ul>
            )}

            {gallery.length < MAX_GALLERY && (
              <label className="btn btn-outline btn-sm mt-3 w-full cursor-pointer">
                {uploading ? <SpinnerIcon size={15} /> : <PlusIcon size={15} />}
                {t.admin.galleryAdd}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={uploading}
                  onChange={(event) => upload(event, "gallery")}
                  className="sr-only"
                />
              </label>
            )}
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
