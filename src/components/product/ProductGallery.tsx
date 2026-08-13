"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";

/**
 * The product's photos.
 *
 * Built as tabs rather than as a row of buttons, and the reason is the tab
 * order: seven photos as seven buttons is seven stops between the price and
 * the buy button, on the one page where the buy button matters most. The tabs
 * pattern gives one stop for the whole strip and arrow keys inside it — which
 * is also how a keyboard reader expects a gallery to behave.
 *
 * There is no fade or slide between photos. A cross-fade on a product photo
 * reads as the image loading rather than as the reader choosing, and this is
 * the one image on the site people look at closely.
 */
export function ProductGallery({
  photos,
  name,
  badge,
}: {
  /** Main photo first. The caller guarantees at least two — one is not a gallery. */
  photos: string[];
  name: string;
  /** The discount flag, which belongs over the photo and not beside it. */
  badge?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const strip = useRef<HTMLDivElement>(null);

  /**
   * Arrow keys move the selection *and* the focus, because in this pattern the
   * two are the same thing: a reader arrowing along a strip of photos is
   * asking to see each one, not to land on it and press a key.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const last = photos.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? active === last
          ? 0
          : active + 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? active === 0
            ? last
            : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;

    if (next < 0) return;

    // Only now — an unhandled key must keep its default, or Home stops
    // scrolling the page while the strip happens to hold focus.
    event.preventDefault();
    setActive(next);
    strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:self-start">
      {/* One panel that changes its photo, rather than one panel per photo:
          seven `<Image fill>` boxes stacked with six hidden is seven downloads
          for a page most people never scroll. */}
      <div
        role="tabpanel"
        id="gallery-panel"
        aria-labelledby={`gallery-tab-${active}`}
        tabIndex={0}
        className="card relative aspect-square overflow-hidden bg-ink-50"
      >
        <Image
          key={active}
          src={photos[active]!}
          alt={photos.length > 1 ? fill(t.product.photoOf, { index: active + 1, name }) : name}
          fill
          sizes="(max-width: 1024px) 100vw, 560px"
          className="object-cover"
          priority={active === 0}
        />
        {badge}
      </div>

      <div
        ref={strip}
        role="tablist"
        aria-label={t.product.photos}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2"
      >
        {photos.map((photo, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            id={`gallery-tab-${index}`}
            aria-selected={index === active}
            aria-controls="gallery-panel"
            // One stop for the strip: the unselected thumbnails are reached
            // with the arrow keys, not with Tab.
            tabIndex={index === active ? 0 : -1}
            onClick={() => setActive(index)}
            aria-label={fill(t.product.photoNumber, { index: index + 1, total: photos.length })}
            className={`relative h-16 w-16 shrink-0 overflow-hidden border bg-ink-50 transition-colors ${
              index === active ? "border-brand-600" : "border-line hover:border-ink-300"
            }`}
          >
            <Image src={photo} alt="" fill sizes="64px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
