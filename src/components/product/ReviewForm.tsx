"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { Overlay } from "@/components/ui/Overlay";
import { Busy, Swap } from "@/components/ui/Swap";
import { CameraIcon, CloseIcon, StarIcon } from "@/components/ui/icons";
import { fill } from "@/lib/i18n";
import { submitReview } from "@/app/actions/reviews";
import { shrinkImage } from "@/lib/shrink-image";
import { BODY_MAX, PHOTOS_MAX, TITLE_MAX } from "@/lib/review-rules";

/** A picture already on the review, or one just chosen and not yet sent. */
type Picture =
  | { kind: "kept"; id: string; url: string }
  | { kind: "new"; id: string; url: string; file: File };

/**
 * Where a customer who received the product says what they thought — in a
 * card over the page, with the stars, two fields and the pictures they
 * want to attach.
 *
 * Only rendered when the server has decided they may — it never asks the
 * question itself — and prefilled with what they wrote before, because a
 * second review of the same product replaces the first.
 *
 * The stars are radio buttons in a group, not five separate buttons: one
 * question, one answer, arrow keys between the options. Pictures are
 * shrunk in the browser as they are chosen, so a phone's photo goes up as
 * a hundred kilobytes rather than eight megabytes.
 */
export function ReviewForm({
  slug,
  existing,
}: {
  slug: string;
  existing: {
    rating: number;
    title: string;
    body: string;
    photos: { id: string; url: string }[];
  } | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [pictures, setPictures] = useState<Picture[]>(
    () => existing?.photos.map((photo) => ({ kind: "kept", ...photo })) ?? [],
  );
  const [shrinking, setShrinking] = useState(false);
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // The preview addresses of pictures not yet sent are object URLs, and an
  // object URL is memory until it is revoked.
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const current = urls.current;
    return () => current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function choose(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = PHOTOS_MAX - pictures.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (chosen.length === 0) return;
    setShrinking(true);
    try {
      const shrunk = await Promise.all(
        chosen.map((file) => shrinkImage(file, { side: 1200 })),
      );
      const next: Picture[] = shrunk.map((file, index) => {
        const url = URL.createObjectURL(file);
        urls.current.push(url);
        return { kind: "new", id: `new-${Date.now()}-${index}`, url, file };
      });
      setPictures((current) => [...current, ...next].slice(0, PHOTOS_MAX));
    } finally {
      setShrinking(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("rating", String(rating));
    formData.set("title", title);
    formData.set("body", body);
    for (const picture of pictures) {
      if (picture.kind === "kept") formData.append("keep", picture.id);
      else formData.append("photo", picture.file);
    }
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof submitReview>>;
      try {
        result = await submitReview(formData);
      } catch {
        result = { ok: false, error: "failed" };
      }
      if (!result.ok) {
        setError(
          result.error === "not-delivered"
            ? { title: t.product.reviewNotDelivered }
            : result.error === "not-bought"
              ? { title: t.product.reviewNotBought }
              : result.error === "sign-in-required"
                ? { title: t.product.reviewSignIn }
                : result.error === "rate-limited"
                  ? { title: t.checkout.rateLimited }
                  : { title: t.product.reviewFailed, hint: t.product.reviewFailedHint },
        );
        return;
      }
      setSaved(true);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-md">
          <StarIcon size={16} filled />
          {existing ? t.product.reviewEdit : t.product.reviewWrite}
        </button>
        {saved && (
          <p role="status" className="text-sm font-semibold text-success">
            {t.product.reviewSaved}
          </p>
        )}
      </div>

      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        side="center"
        closeLabel={t.nav.close}
        label={existing ? t.product.reviewEdit : t.product.reviewWrite}
        className="max-w-lg overflow-y-auto bg-surface shadow-pop"
      >
        {/* `text-left`: the card is rendered where the button is, and the
            button sits in a cell aligned to the right on a wide screen. */}
        <form onSubmit={submit} className="flex flex-col text-left">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-base font-bold text-ink-900">
              {existing ? t.product.reviewEdit : t.product.reviewWrite}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.nav.close}
              className="btn btn-ghost -mr-2 h-9 w-9 rounded-control p-0"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-5 px-5 py-5">
            {/* The stars first and large: the rating is the review, and the
                words are what goes with it. */}
            <fieldset className="text-center">
              <legend className="field-label mx-auto">{t.product.reviewRating}</legend>
              <div
                role="radiogroup"
                aria-label={t.product.reviewRating}
                className="mt-1 flex items-center justify-center gap-1"
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const lit = star <= (hover || rating);
                  return (
                    <label
                      key={star}
                      onMouseEnter={() => setHover(star)}
                      onMouseLeave={() => setHover(0)}
                      className="cursor-pointer p-1"
                    >
                      <input
                        type="radio"
                        name="rating"
                        value={star}
                        checked={rating === star}
                        onChange={() => setRating(star)}
                        className="sr-only"
                        aria-label={fill(t.product.reviewStars, { count: star })}
                      />
                      <StarIcon
                        size={34}
                        filled={lit}
                        className={`transition-transform duration-150 ${
                          lit ? "text-accent-500" : "text-ink-300"
                        } ${hover === star ? "scale-110" : ""}`}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-ink-500">
                {fill(t.product.reviewStars, { count: hover || rating })}
              </p>
            </fieldset>

            <div>
              <label className="field-label" htmlFor="review-title">
                {t.product.reviewTitle}
              </label>
              <input
                id="review-title"
                value={title}
                maxLength={TITLE_MAX}
                onChange={(event) => setTitle(event.target.value)}
                className="field"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="review-body">
                {t.product.reviewBody}
              </label>
              <textarea
                id="review-body"
                rows={4}
                maxLength={BODY_MAX}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="field h-auto py-2.5"
              />
            </div>

            {/* The pictures: the ones attached as tiles with a way off, and
                one dashed tile that opens the picker while there is room. */}
            <div>
              <p className="field-label">
                {t.product.reviewPhotos}{" "}
                <span className="font-normal text-ink-400">
                  {pictures.length}/{PHOTOS_MAX}
                </span>
              </p>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void choose(event.target.files);
                  event.target.value = "";
                }}
              />
              <ul className="grid grid-cols-4 gap-2">
                {pictures.map((picture) => (
                  <li key={picture.id} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={picture.url}
                      alt=""
                      className="h-full w-full rounded-control border border-line object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPictures((current) => current.filter((item) => item.id !== picture.id))
                      }
                      aria-label={t.product.reviewPhotoRemove}
                      className="absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-pill bg-panel text-panel-fg shadow-card"
                    >
                      <CloseIcon size={12} strokeWidth={3} />
                    </button>
                  </li>
                ))}
                {pictures.length < PHOTOS_MAX && (
                  <li className="aspect-square">
                    <button
                      type="button"
                      disabled={shrinking}
                      onClick={() => input.current?.click()}
                      className="grid h-full w-full place-items-center rounded-control border-2 border-dashed border-line text-ink-400 transition-colors hover:border-brand-400 hover:text-brand-600 disabled:opacity-60"
                    >
                      <span className="flex flex-col items-center gap-1 text-[11px] font-semibold">
                        <CameraIcon size={20} />
                        {shrinking ? "…" : t.product.reviewPhotoAdd}
                      </span>
                    </button>
                  </li>
                )}
              </ul>
              <p className="mt-1.5 text-xs text-ink-400">{t.product.reviewPhotosHint}</p>
            </div>

            {error && <ErrorNote title={error.title} hint={error.hint} />}
          </div>

          <div className="flex gap-2 border-t border-line bg-canvas px-5 py-4">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-md">
              {t.admin.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending || shrinking}
              className="btn btn-primary btn-md flex-1"
            >
              <Swap
                show={isPending ? <Busy label={t.product.reviewSubmit} /> : t.product.reviewSubmit}
                of={[t.product.reviewSubmit]}
              />
            </button>
          </div>
        </form>
      </Overlay>
    </>
  );
}
