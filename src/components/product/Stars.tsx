import { StarIcon } from "@/components/ui/icons";
import { averageRating } from "@/lib/review-rules";
import { countText, fill, type Dictionary } from "@/lib/i18n";

/**
 * Five stars, some of them lit.
 *
 * Drawn from the product's own two integers, so a card costs no query, and
 * drawn nowhere at all until somebody real has written something — a row of
 * empty stars under every product is a shop asking to be rated by people who
 * have not bought anything.
 *
 * The count is the accessible name; the stars themselves are decoration and
 * say so. A half star is not drawn: 4.6 lights five and prints "4.6", which
 * is both honest and legible at sixteen pixels.
 */
export function Stars({
  sum,
  count,
  t,
  size = "sm",
  href,
}: {
  sum: number;
  count: number;
  t: Dictionary;
  /** `sm` on a card, `md` beside the product's own title. */
  size?: "sm" | "md";
  /** When set, the whole thing is a link — to the reviews further down. */
  href?: string;
}) {
  if (count <= 0) return null;

  const average = averageRating(sum, count);
  const lit = Math.round(average);
  const label = `${average} · ${countText(t.product.reviewsCountOne, t.product.reviewsCount, count)}`;
  const px = size === "sm" ? 13 : 16;

  const inner = (
    <>
      <span aria-hidden="true" className="flex items-center gap-px text-accent-500">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon key={star} size={px} filled={star <= lit} className={star <= lit ? "" : "text-ink-300"} />
        ))}
      </span>
      <span className={`font-semibold text-ink-800 tabular-nums ${size === "sm" ? "text-xs" : "text-sm"}`}>
        {average}
      </span>
      <span className={`text-ink-400 ${size === "sm" ? "text-xs" : "text-sm"}`}>
        ({count})
      </span>
    </>
  );

  const className = "inline-flex items-center gap-1.5";
  return href ? (
    <a href={href} aria-label={fill(t.product.reviewStars, { count: average }) + ", " + label} className={`${className} hover:underline`}>
      {inner}
    </a>
  ) : (
    // `role="img"`: a span may not carry a label, and to a screen reader this
    // is one thing — "4.6, 12 reviews" — not five icons and two numbers.
    <span role="img" aria-label={label} className={className}>
      {inner}
    </span>
  );
}
