"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { AlertIcon } from "@/components/ui/icons";
import { fill } from "@/lib/i18n";
import { getServerSnapshot, getSnapshot, subscribe } from "@/lib/withdrawn-store";

/**
 * "This was taken out of your cart, and here is why."
 *
 * The sweep in the header removes what the shop has stopped selling, because
 * an order for it could not be placed. It used to do that silently, and a
 * cart that held something a minute ago and is empty now looks like the shop
 * lost it — which is the one impression a shop cannot afford.
 *
 * The store behind it is not persisted and the sweep fills it once per page
 * load, so a reload of a cart that is already correct says nothing. It is
 * deliberately not cleared when this unmounts: React mounts an effect twice
 * in development, and a cleanup that cleared shared state wiped the news
 * between the two mounts — the notice was written and then never shown.
 */
export function WithdrawnNotice({
  list,
  className = "mb-4",
}: {
  list: "cart" | "favorites";
  className?: string;
}) {
  const { t } = useI18n();
  const withdrawn = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const count = list === "cart" ? withdrawn.cart : withdrawn.favorites;

  if (count === 0) return null;

  const words = list === "cart" ? t.cart : t.favorites;
  const text =
    count === 1 ? words.withdrawnOne : fill(words.withdrawnMany, { count });

  return (
    <p
      role="status"
      className={`${className} flex items-start gap-2 rounded-control border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-warning`}
    >
      <AlertIcon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      {text}
    </p>
  );
}
