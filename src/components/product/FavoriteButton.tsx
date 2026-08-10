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
  className = "",
}: {
  productId: string;
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
      className={`grid h-10 w-10 place-items-center transition-colors ${
        isFavorite
          ? "bg-brand-solid text-brand-on-solid"
          : "bg-surface text-ink-500 hover:text-brand-600"
      } ${className}`}
    >
      <HeartIcon size={16} filled={isFavorite} />
    </button>
  );
}
