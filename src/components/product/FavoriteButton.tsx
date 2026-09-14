"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { HeartIcon } from "@/components/ui/icons";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  toggleFavorite,
} from "@/lib/favorites-store";

export function useFavorites() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function FavoriteButton({
  productId,
  size = "chip",
  className = "",
}: {
  productId: string;
  /**
   * `chip` sits on a card's photo; `control` stands in a row of buttons on
   * the product page and takes their height, so the row has one bottom edge.
   */
  size?: "chip" | "control";
  className?: string;
}) {
  const { t } = useI18n();
  const favorites = useFavorites();
  const isFavorite = favorites.includes(productId);

  return (
    <button
      type="button"
      onClick={(event) => {
        // The button sits inside the card's image link.
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(productId);
      }}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? t.favorites.remove : t.favorites.add}
      title={isFavorite ? t.favorites.remove : t.favorites.add}
      // 40px rather than 32. The obvious trick — keep the chip small and grow
      // only the touch area with an `::after` ring — was tried and does not
      // work here: this sits inside the card's image link, and both that link
      // and the card have `overflow: hidden`, so the ring is clipped away on
      // the sides that matter. It looked correct in the CSS and caught nothing.
      //
      // So the chip itself grows. Not to 44: this is a secondary action sitting
      // on top of the card's own link, and at 44 it starts covering the product
      // photo it is meant to sit quietly on top of.
      className={`grid place-items-center transition-colors ${
        size === "chip" ? "h-10 w-10 rounded-control" : "min-h-[3.25rem] w-full rounded-control border border-line sm:w-[3.25rem] sm:shrink-0"
      } ${
        isFavorite
          ? "bg-brand-solid text-brand-on-solid"
          : "bg-surface text-ink-500 hover:text-brand-600"
      } ${className}`}
    >
      <HeartIcon size={size === "chip" ? 16 : 18} filled={isFavorite} />
    </button>
  );
}
