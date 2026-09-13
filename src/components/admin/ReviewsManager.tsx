"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { SpinnerIcon, StarIcon } from "@/components/ui/icons";
import { setReviewPublished } from "@/app/actions/reviews";

export type ReviewRow = {
  id: string;
  rating: number;
  title: string;
  body: string;
  isPublished: boolean;
  /** Formatted on the server, where the time zone lives. */
  createdAtLabel: string;
  customer: string;
  product: { id: string; slug: string; name: string };
  orderNumber: string;
};

/**
 * The shop reading what its customers wrote.
 *
 * One control per row, hide or show, and no edit box anywhere: a sentence
 * the shop can rewrite is the shop's sentence. The order number is on every
 * row because it is what makes the review real — it is the delivered order
 * that earned it.
 */
export function ReviewsManager({ reviews }: { reviews: ReviewRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(review: ReviewRow) {
    setError(null);
    setBusy(review.id);
    startTransition(async () => {
      const result = await setReviewPublished(review.id, !review.isPublished);
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

      {reviews.map((review) => (
        <article key={review.id} className="card card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/product/${review.product.slug}#reviews`}
                  className="text-sm font-bold text-ink-900 hover:text-brand-600"
                >
                  {review.product.name}
                </Link>
                <span
                  className={`badge ${
                    review.isPublished ? "bg-success-soft text-success" : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {review.isPublished ? t.admin.reviewPublishedBadge : t.admin.reviewHiddenBadge}
                </span>
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {review.customer} · {review.orderNumber} · {review.createdAtLabel}
              </p>
            </div>

            {/* An image with a name, not a span with a label: `aria-label`
                is only permitted on an element with a role. */}
            <span role="img" aria-label={`${review.rating}/5`} className="flex items-center gap-px text-accent-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarIcon
                  key={star}
                  size={14}
                  filled={star <= review.rating}
                  className={star <= review.rating ? "" : "text-ink-300"}
                />
              ))}
            </span>
          </div>

          {review.title && <p className="mt-3 text-sm font-bold text-ink-900">{review.title}</p>}
          {review.body && (
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-700">{review.body}</p>
          )}

          {canWrite && (
            <div className="mt-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => toggle(review)}
                className="btn btn-outline btn-sm"
              >
                {isPending && busy === review.id && <SpinnerIcon size={14} />}
                {review.isPublished ? t.admin.reviewHide : t.admin.reviewShow}
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
