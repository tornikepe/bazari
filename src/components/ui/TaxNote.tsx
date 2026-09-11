import { fill, type Dictionary } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { vatIncluded } from "@/lib/tax";

/**
 * "Including VAT 18%: ₾3.49" — the one line under a total that says how much
 * of it is tax.
 *
 * A note rather than a row of the breakdown, and deliberately so: the rows
 * above it add up to the total, and a tax row among them would read as one
 * more thing being charged. It is not. Georgian prices carry the tax inside
 * them, so this is a statement about the total, set in the small type the
 * receipt uses for facts that do not change the figure.
 *
 * Takes the amount when the caller already has it snapshotted — an order —
 * and works it out otherwise — a cart, which has no order yet. Renders nothing
 * for a shop with no rate, so a shop that is not registered never shows a
 * line about a tax it does not collect.
 *
 * No hooks, so it serves the server-rendered order pages and the client-side
 * cart from one file.
 */
export function TaxNote({
  total,
  rate,
  amount,
  locale,
  t,
  className = "",
}: {
  total: number;
  rate: number;
  /** The recorded figure, when there is one; otherwise it is derived. */
  amount?: number;
  locale: Locale;
  t: Dictionary;
  className?: string;
}) {
  if (rate <= 0) return null;
  const tax = amount ?? vatIncluded(total, rate);

  return (
    <p className={`flex items-center justify-between text-xs text-ink-400 ${className}`}>
      <span>{fill(t.cart.taxIncluded, { rate })}</span>
      <span className="tabular-nums">{formatPrice(tax, locale)}</span>
    </p>
  );
}
