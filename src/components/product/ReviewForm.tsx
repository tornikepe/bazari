"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { SpinnerIcon, StarIcon } from "@/components/ui/icons";
import { fill } from "@/lib/i18n";
import { submitReview } from "@/app/actions/reviews";
import { BODY_MAX, TITLE_MAX } from "@/lib/review-rules";

/**
 * Where a customer who received the product says what they thought.
 *
 * Only rendered when the server has decided they may — it never asks the
 * question itself — and prefilled with what they wrote before, because a
 * second review of the same product replaces the first.
 *
 * The stars are radio buttons in a group, not five separate buttons: one
 * question, one answer, arrow keys between the options.
 */
export function ReviewForm({
  slug,
  existing,
}: {
  slug: string;
  existing: { rating: number; title: string; body: string } | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [error, setError] = useState<{ title: string; hint?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitReview({ slug, rating, title, body });
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

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm">
          {existing ? t.product.reviewEdit : t.product.reviewWrite}
        </button>
        {saved && (
          <p role="status" className="text-sm text-success">
            {t.product.reviewSaved}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 card-pad">
      <fieldset>
        <legend className="field-label">{t.product.reviewRating}</legend>
        <div role="radiogroup" aria-label={t.product.reviewRating} className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const lit = star <= (hover || rating);
            return (
              <label
                key={star}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className="cursor-pointer p-0.5"
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
                  size={26}
                  filled={lit}
                  className={`transition-colors ${lit ? "text-accent-500" : "text-ink-300"}`}
                />
              </label>
            );
          })}
        </div>
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
          className="field"
        />
      </div>

      {error && <ErrorNote title={error.title} hint={error.hint} />}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
          {isPending && <SpinnerIcon size={15} />}
          {isPending ? t.product.reviewSubmitting : t.product.reviewSubmit}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-outline btn-md">
          {t.admin.cancel}
        </button>
      </div>
    </form>
  );
}
