"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { saveProduct } from "@/app/actions/admin";
import { MAX_SPECS, parseSpecs, type Spec } from "@/lib/product-specs";
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PageHeader } from "@/components/layout/PageHeader";
import { movePhoto, parsePhotos, MAX_PHOTOS, type Photo } from "@/lib/product-photos";


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
  photos: unknown;
  specs: unknown;
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
  /* A title and, when the failure is one the reader can do nothing specific
     about, the one thing they were never told: whether anything was saved. */
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);

  /* One ordered list, and the first entry is the main photo. There used to be
     a "main photo" field and a separate gallery beside it, which meant the
     shop could not promote a photo it already had without deleting and
     re-uploading it. */
  const [photos, setPhotos] = useState<Photo[]>(() => parsePhotos(product?.photos));
  const [linkDraft, setLinkDraft] = useState("");

  /* Rows are keyed by a number that never changes, not by their index:
     removing the second of four re-indexes the rest, and React would then
     reuse the wrong inputs and move the text the reader typed. */
  const [specs, setSpecs] = useState<{ key: number; spec: Spec }[]>(() =>
    parseSpecs(product?.specs).map((spec, index) => ({ key: index, spec })),
  );
  const nextKey = useRef(specs.length);
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
  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
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

      setPhotos((current) =>
        current.some((photo) => photo.url === data.url)
          ? current
          : [...current, { url: data.url!, altKa: "", altEn: "" }].slice(0, MAX_PHOTOS),
      );
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
            ? { title: t.admin.slugTaken }
            : result.error === "sku-taken"
              ? { title: t.admin.skuTaken }
              : result.error === "invalid"
                ? { title: t.admin.required }
                : { title: t.common.error, hint: t.common.errorHint },
        );
        return;
      }

      router.push("/dashboard/products");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl">
      <PageHeader
        scale="panel"
        title={product ? t.admin.editProduct : t.admin.newProduct}
        action={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/products" className="btn btn-outline btn-sm">
              {t.admin.cancel}
            </Link>
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
              {isPending && <SpinnerIcon size={15} />}
              {isPending ? t.admin.saving : product ? t.admin.save : t.admin.create}
            </button>
          </div>
        }
      />

      {error && <ErrorNote className="mt-4" title={error.title} hint={error.hint} />}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="flex flex-col gap-4">
          {/* ------------------------------ basics --------------------------- */}
          <section className="card card-pad">
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

          {/* ------------------------- specifications ------------------------ */}
          <section className="card card-pad">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.specs}</h2>
            <p className="mt-1 text-xs text-ink-400">{t.admin.specsHint}</p>

            {specs.length > 0 && (
              <ul className="mt-4 flex flex-col gap-3">
                {specs.map(({ key, spec }, index) => (
                  <li key={key} className="border border-line p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        [
                          ["labelKa", `${t.admin.specLabel} (ka)`],
                          ["labelEn", `${t.admin.specLabel} (en)`],
                          ["valueKa", `${t.admin.specValue} (ka)`],
                          ["valueEn", `${t.admin.specValue} (en)`],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field} className="block">
                          <span className="sr-only">{`${label} — ${index + 1}`}</span>
                          <input
                            name={`spec_${field}`}
                            value={spec[field]}
                            onChange={(event) =>
                              setSpecs((rows) =>
                                rows.map((row) =>
                                  row.key === key
                                    ? { ...row, spec: { ...row.spec, [field]: event.target.value } }
                                    : row,
                                ),
                              )
                            }
                            placeholder={label}
                            className="field h-10 text-sm"
                          />
                        </label>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSpecs((rows) => rows.filter((row) => row.key !== key))}
                      className="btn btn-ghost btn-sm mt-2 text-ink-500 hover:text-danger"
                    >
                      <TrashIcon size={14} />
                      {fill(t.admin.specRemove, { index: index + 1 })}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {specs.length < MAX_SPECS && (
              <button
                type="button"
                onClick={() =>
                  setSpecs((rows) => [
                    ...rows,
                    {
                      key: nextKey.current++,
                      spec: { labelKa: "", labelEn: "", valueKa: "", valueEn: "" },
                    },
                  ])
                }
                className="btn btn-outline btn-sm mt-3"
              >
                <PlusIcon size={15} />
                {t.admin.specAdd}
              </button>
            )}
          </section>

          {/* ------------------------- price and stock ----------------------- */}
          <section className="card card-pad">
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
          <section className="card card-pad">
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
          <section className="card card-pad">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.photosTitle}</h2>
            <p className="mt-1 text-xs text-ink-400">{t.admin.photosHint}</p>

            {/* One row per photo: what it looks like, what it shows, and where
                it sits. The order is the list's, so moving a photo to the top
                is what makes it the main one — no second control for that. */}
            <ul className="mt-3 flex flex-col gap-3">
              {photos.map((photo, index) => (
                <li key={photo.url} className="flex gap-3 border-t border-line pt-3 first:border-t-0 first:pt-0">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-line bg-ink-50">
                    <Image src={photo.url} alt="" fill sizes="80px" className="object-cover" />
                    {index === 0 && (
                      <span className="absolute inset-x-0 bottom-0 bg-ink-900/80 py-0.5 text-center text-[0.625rem] font-bold text-white">
                        {t.admin.photoMain}
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <input
                      value={photo.altKa}
                      placeholder={t.admin.photoAltKa}
                      aria-label={`${t.admin.photoAltKa} — ${index + 1}`}
                      maxLength={200}
                      onChange={(event) =>
                        setPhotos((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, altKa: event.target.value } : row,
                          ),
                        )
                      }
                      className="field h-8 px-2 text-xs"
                    />
                    <input
                      value={photo.altEn}
                      placeholder={t.admin.photoAltEn}
                      aria-label={`${t.admin.photoAltEn} — ${index + 1}`}
                      maxLength={200}
                      onChange={(event) =>
                        setPhotos((current) =>
                          current.map((row, i) =>
                            i === index ? { ...row, altEn: event.target.value } : row,
                          ),
                        )
                      }
                      className="field h-8 px-2 text-xs"
                    />
                  </div>

                  {/* Buttons rather than dragging. A drag is unusable with a
                      keyboard and awkward on a phone, and two arrows say the
                      same thing to everybody. */}
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => setPhotos((current) => movePhoto(current, index, -1))}
                      aria-label={fill(t.admin.photoUp, { index: index + 1 })}
                      className="btn btn-ghost h-7 w-7 rounded-control p-0 disabled:opacity-30"
                    >
                      <ChevronUpIcon size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === photos.length - 1}
                      onClick={() => setPhotos((current) => movePhoto(current, index, 1))}
                      aria-label={fill(t.admin.photoDown, { index: index + 1 })}
                      className="btn btn-ghost h-7 w-7 rounded-control p-0 disabled:opacity-30"
                    >
                      <ChevronDownIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                      aria-label={fill(t.admin.photoRemove, { index: index + 1 })}
                      className="btn btn-ghost h-7 w-7 rounded-control p-0 text-ink-400 hover:text-danger"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </div>

                  {/* What is actually posted, read positionally on the server. */}
                  <input type="hidden" name="photoUrl" value={photo.url} />
                  <input type="hidden" name="photoAltKa" value={photo.altKa} />
                  <input type="hidden" name="photoAltEn" value={photo.altEn} />
                </li>
              ))}
            </ul>

            <p className="mt-2 text-xs text-ink-400">{t.admin.photoAltHint}</p>

            {photos.length < MAX_PHOTOS && (
              <>
                {/* The upload happens on choosing the file rather than on
                    saving the product, so the thumbnail above is the real
                    stored photo and a failed upload is reported while the
                    reader is still looking at the control. */}
                <label className="btn btn-outline btn-sm mt-3 w-full cursor-pointer">
                  {uploading ? <SpinnerIcon size={15} /> : <UploadIcon size={15} />}
                  {uploading ? t.admin.imageUploading : t.admin.photoAdd}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={uploading}
                    onChange={upload}
                    className="sr-only"
                  />
                </label>

                {/* A link pasted by hand still works, exactly as it did. */}
                <div className="mt-2 flex gap-2">
                  <input
                    value={linkDraft}
                    onChange={(event) => setLinkDraft(event.target.value)}
                    placeholder={t.admin.photoUrl}
                    aria-label={t.admin.photoUrl}
                    className="field h-8 flex-1 px-2 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!linkDraft.trim()}
                    onClick={() => {
                      const url = linkDraft.trim();
                      setLinkDraft("");
                      setPhotos((current) =>
                        current.some((photo) => photo.url === url)
                          ? current
                          : [...current, { url, altKa: "", altEn: "" }].slice(0, MAX_PHOTOS),
                      );
                    }}
                    className="btn btn-outline btn-sm h-8"
                  >
                    {t.admin.photoUrlAdd}
                  </button>
                </div>
              </>
            )}

            {uploadError && (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                <AlertIcon size={13} className="shrink-0" />
                {uploadError}
              </p>
            )}
          </section>

          <section className="card card-pad">
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
