"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { formatPrice } from "@/lib/format";

export type Suggestion = {
  slug: string;
  nameKa: string;
  nameEn: string;
  price: number;
  image: string;
  brand: string;
};

/** One shared empty list, so "no results" is a stable reference. */
const EMPTY: Suggestion[] = [];

/** Long enough that a fast typist does not fire a request per letter. */
const DEBOUNCE_MS = 180;
const MIN_LENGTH = 2;

/**
 * What the search field found, under the search field.
 *
 * Fetched from `/api/search`, which shares its matching predicate with the
 * catalogue — so a product offered here is a product the results page will also
 * show. The alternative, two definitions of "matches", fails silently and in
 * the most annoying possible way.
 *
 * ## Keyboard
 *
 * This is a combobox, and a combobox that only works with a mouse is a
 * decoration. Arrow keys move through the list, Enter opens the highlighted
 * product, Escape closes without losing what was typed, and with nothing
 * highlighted Enter submits the form as it always did. `aria-activedescendant`
 * carries the highlight rather than focus, so the caret never leaves the input
 * and typing continues to work mid-list.
 */
export function SearchSuggestions({
  query,
  inputRef,
  onNavigate,
}: {
  query: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Called when a suggestion is taken, so the header can close its sheet. */
  onNavigate: () => void;
}) {
  const { t, locale } = useI18n();
  const listId = useId();

  /**
   * The results *and* the text they answer, together.
   *
   * Keeping the query alongside the list is what makes "is this list stale"
   * answerable during render, so there is no effect resetting state when the
   * box is emptied — and no window where the previous query's products are
   * shown under a different word.
   */
  const [result, setResult] = useState<{ query: string; items: Suggestion[] }>({
    query: "",
    items: [],
  });
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();
  // Memoised so the empty case is a stable reference. Without it the fallback
  // `[]` is a new array on every render, and the keydown effect below — which
  // depends on the list — would unbind and rebind its listener on every keystroke
  // for no reason.
  const items = useMemo(
    () => (result.query === trimmed ? result.items : EMPTY),
    [result, trimmed],
  );
  const open = !dismissed && trimmed.length >= MIN_LENGTH && items.length > 0;

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) return;

    // Debounced, and every in-flight request is abandoned when the next
    // keystroke arrives — without that, answers race and the list can settle on
    // the results for a prefix of what is now in the box.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = (await response.json()) as { products: Suggestion[] };
        setResult({ query: trimmed, items: data.products });
        setDismissed(false);
        setActive(-1);
      } catch {
        // An aborted or failed request leaves the last good list alone. The
        // form still submits; suggestions are a shortcut, not the search.
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  // Keydown is bound to the input rather than to the list, because focus stays
  // in the input the whole time — that is the point of `aria-activedescendant`.
  //
  // Re-bound whenever the list or the highlight changes rather than read
  // through refs: mirroring state into a ref during render is a write in the
  // render phase, and one cheap `removeEventListener`/`addEventListener` pair
  // per keystroke costs less than the class of bug that pattern invites.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (items.length === 0) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setDismissed(false);
        const step = event.key === "ArrowDown" ? 1 : -1;
        // Wraps, and −1 is a real position: it is "nothing highlighted", which
        // is what lets Enter fall through to the ordinary search.
        setActive((current) => {
          const next = current + step;
          if (next < -1) return items.length - 1;
          if (next >= items.length) return -1;
          return next;
        });
        return;
      }

      if (event.key === "Escape") {
        // Closed, not cleared. `<input type="search">` clears itself on Escape
        // in Chrome, which would throw away the word along with the list, so
        // the default is taken over *while the list is open* — and only then.
        // With nothing open this handler returns early above and the browser's
        // own behaviour survives, so a second Escape still clears the field.
        // That is the order the ARIA combobox pattern asks for.
        event.preventDefault();
        setDismissed(true);
        setActive(-1);
        return;
      }

      if (event.key === "Enter" && active >= 0) {
        const chosen = items[active];
        if (chosen) {
          event.preventDefault();
          setDismissed(true);
          onNavigate();
          window.location.assign(`/product/${chosen.slug}`);
        }
      }
    };

    input.addEventListener("keydown", onKeyDown);
    return () => input.removeEventListener("keydown", onKeyDown);
  }, [inputRef, onNavigate, items, active]);

  // The combobox wiring has to live on the input, which this component does not
  // own, so it is applied to the node directly.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const showing = open;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", String(showing));
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-autocomplete", "list");

    if (showing && active >= 0) input.setAttribute("aria-activedescendant", `${listId}-${active}`);
    else input.removeAttribute("aria-activedescendant");
  }, [open, items.length, active, inputRef, listId]);

  if (!open) return null;

  const name = (item: Suggestion) => (locale === "ka" ? item.nameKa : item.nameEn);

  return (
    <>
      {/* Closes on a click anywhere else without stealing the click — a
          `pointerdown` listener would fire before the link's own activation. */}
      <button
        type="button"
        aria-label={t.nav.close}
        tabIndex={-1}
        onClick={() => setDismissed(true)}
        className="fixed inset-0 z-40 cursor-default"
      />

      <ul
        id={listId}
        role="listbox"
        aria-label={t.nav.search}
        className="absolute top-[calc(100%+0.375rem)] right-0 left-0 z-50 max-h-[22rem] overflow-y-auto border border-line bg-surface shadow-pop"
      >
        {items.map((item, index) => (
          <li key={item.slug} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
            <Link
              href={`/product/${item.slug}`}
              onClick={() => {
                setDismissed(true);
                onNavigate();
              }}
              // Highlight follows the keyboard as well as the pointer, so the
              // two never disagree about which row is current.
              onMouseEnter={() => setActive(index)}
              className={`flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 ${
                index === active ? "bg-brand-50" : "bg-surface"
              }`}
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden bg-ink-50">
                <Image src={item.image} alt="" fill sizes="44px" className="object-cover" />
              </span>

              <span className="min-w-0 flex-1">
                {item.brand && <span className="block truncate text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">{item.brand}</span>}
                <span className="block truncate text-sm text-ink-900">{name(item)}</span>
              </span>

              <span className="shrink-0 text-sm font-bold text-ink-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatPrice(item.price, locale)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
