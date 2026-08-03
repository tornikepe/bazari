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
      className={`grid h-8 w-8 place-items-center rounded-pill backdrop-blur-sm transition-colors ${
        isFavorite
          ? "bg-brand-solid text-brand-on-solid"
          : "bg-surface/85 text-ink-500 hover:bg-surface hover:text-brand-600"
      } ${className}`}
    >
      <HeartIcon size={16} filled={isFavorite} />
    </button>
  );
}
