"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { PrinterIcon } from "@/components/ui/icons";

/**
 * Prints the page it is on.
 *
 * A button rather than a link to a separate `/invoice` route, because there is
 * nothing on that route that is not already here: the items, the totals and
 * the customer are on the page, and the print stylesheet takes away the parts
 * that are not a document. A second route would be a second copy of the same
 * markup, drifting from this one the first time a column is added.
 *
 * It never prints itself — the stylesheet drops every `button` — which is the
 * whole reason it can sit next to the thing it prints.
 */
export function PrintButton({ size = "sm" }: { size?: "sm" | "md" }) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => window.print()}
      /* A named size rather than a `className` the caller appends: `btn-sm`
         and `btn-md` are both component classes, so which one won would be
         decided by their order in the stylesheet rather than by the caller. */
      className={`btn btn-outline btn-${size}`}
    >
      <PrinterIcon size={15} />
      {t.common.print}
    </button>
  );
}
