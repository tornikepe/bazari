"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { CloseIcon, SearchIcon, SpinnerIcon } from "@/components/ui/icons";

export type SelectFilter = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

/**
 * Search box plus a row of dropdown filters, all driven through the URL so the
 * admin's current view is shareable and survives a refresh.
 */
export function AdminToolbar({
  basePath,
  search,
  searchPlaceholder,
  filters,
  hasActive,
}: {
  basePath: string;
  search: string;
  searchPlaceholder?: string;
  filters: SelectFilter[];
  hasActive: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [term, setTerm] = useState(search);

  // Re-sync when the URL changes elsewhere (reset button, back navigation).
  const [lastSearch, setLastSearch] = useState(search);
  if (lastSearch !== search) {
    setLastSearch(search);
    setTerm(search);
  }

  /** Builds the next URL from the current filters plus one override. */
  function urlWith(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    for (const filter of filters) {
      if (filter.value) params.set(filter.name, filter.value);
    }
    if (search) params.set("q", search);

    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  // Debounced search — one navigation per pause, not per keystroke.
  useEffect(() => {
    if (term === search) return;

    const timer = setTimeout(() => {
      startTransition(() => router.push(urlWith({ q: term })));
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, search]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs">
        {isPending ? (
          <SpinnerIcon
            size={15}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
          />
        ) : (
          <SearchIcon
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
          />
        )}
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={searchPlaceholder ?? t.admin.search}
          aria-label={t.admin.search}
          className="field h-9 pl-9 text-sm"
        />
      </div>

      {filters.map((filter) => (
        <select
          key={filter.name}
          value={filter.value}
          aria-label={filter.label}
          onChange={(event) =>
            startTransition(() => router.push(urlWith({ [filter.name]: event.target.value })))
          }
          className="field h-9 w-full min-w-0 text-sm sm:w-44"
        >
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}

      {hasActive && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push(basePath))}
          className="btn btn-ghost btn-sm"
        >
          <CloseIcon size={14} />
          {t.admin.resetFilters}
        </button>
      )}
    </div>
  );
}
