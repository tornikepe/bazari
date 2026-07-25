"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { SearchIcon } from "@/components/ui/icons";

/** Debounced search box that keeps the query in the URL. */
export function AdminSearch({ basePath, initial }: { basePath: string; initial: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();

  // Re-sync with the URL (back button, cleared query) during render rather
  // than in an effect, so no extra commit happens between the two states.
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setValue(initial);
  }

  useEffect(() => {
    // Skip the navigation when the box already matches the URL — otherwise
    // every render would push an identical entry.
    if (value === initial) return;

    const timer = setTimeout(() => {
      startTransition(() => {
        router.push(value ? `${basePath}?q=${encodeURIComponent(value)}` : basePath);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, initial, basePath, router]);

  return (
    <div className="relative w-full sm:w-64">
      <SearchIcon
        size={15}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t.admin.search}
        aria-label={t.admin.search}
        className="field h-9 pl-9 text-sm"
      />
    </div>
  );
}
