"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { altOf, type Photo } from "@/lib/product-photos";
import { ZoomIcon } from "@/components/ui/icons";
import { Lightbox } from "@/components/product/Lightbox";

/**
 * The product's photos.
 *
 * The big picture is shown whole — `object-contain` on the shop's white —
 * rather than cropped to the square: a photo of a shoe taken tall lost its
 * sole and its collar to the crop, and the one image on the site people
 * look at closely is not the one to trim. A tap on it opens the lightbox,
 * where it fills the screen and can be brought to twice its size.
 *
 * The thumbnails are tabs rather than a row of buttons, and the reason is
 * the tab order: seven photos as seven buttons is seven stops between the
 * price and the buy button, on the one page where the buy button matters
 * most. The tabs pattern gives one stop for the whole strip and arrow keys
 * inside it — which is also how a keyboard reader expects a gallery to
 * behave.
 *
 * There is no fade or slide between photos. A cross-fade on a product photo
 * reads as the image loading rather than as the reader choosing.
 */
export function ProductGallery({
  photos,
  name,
  badge,
}: {
  /** Main photo first. */
  photos: Photo[];
  name: string;
  /** The discount flag, which belongs over the photo and not beside it. */
  badge?: React.ReactNode;
}) {
  const { locale, t } = useI18n();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const many = photos.length > 1;

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
    <div className="flex min-w-0 flex-col gap-3 lg:self-start">
      {/* One panel that changes its photo, rather than one panel per photo:
          seven `<Image fill>` boxes stacked with six hidden is seven downloads
          for a page most people never scroll. */}
      <div
        role="tabpanel"
        id="gallery-panel"
        aria-labelledby={`gallery-tab-${active}`}
        className="gallery-stage card relative aspect-square overflow-hidden bg-surface"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.product.zoomIn}
          className="group absolute inset-0 cursor-zoom-in"
        >
          <Image
            key={active}
            src={photos[active]!.url}
            /* What the photo shows, when somebody has said. "Photo 3 of 7" is a
               position rather than a description, and a listener who hears it
               has been told nothing about the picture — so the fallback is the
               product's name, not its index. */
            alt={altOf(photos[active], locale, name)}
            fill
            sizes="(max-width: 1024px) 100vw, 600px"
            className="gallery-photo object-contain p-4 sm:p-6"
            priority={active === 0}
          />
          {/* The hint sits in the corner and says what a tap does; it steps
              forward under the pointer, so on a desktop the picture reads as
              something that opens. */}
          <span className="gallery-zoom pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-card backdrop-blur">
            <ZoomIcon size={14} />
            <span className="hidden sm:inline">{t.product.zoomHint}</span>
          </span>
        </button>
        {badge}
        {many && (
          <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-[11px] font-bold text-white tabular-nums">
            {active + 1} / {photos.length}
          </span>
        )}
      </div>

      {many && (
        <div
          ref={strip}
          role="tablist"
          aria-label={t.product.photos}
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="gallery-strip flex gap-2 overflow-x-auto pb-1"
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
              className={`relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-control border-2 bg-surface transition-all ${
                index === active
                  ? "border-brand-600 shadow-card"
                  : "border-line opacity-80 hover:border-ink-300 hover:opacity-100"
              }`}
            >
              {/* Decorative: the button around it is already labelled, and a
                  screen reader announcing the description twice per thumbnail
                  would read the whole strip as one long sentence. */}
              <Image src={photo.url} alt="" fill sizes="72px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        photos={photos}
        index={active}
        name={name}
        open={open}
        onClose={() => setOpen(false)}
        onIndexChange={setActive}
      />
    </div>
  );
}
