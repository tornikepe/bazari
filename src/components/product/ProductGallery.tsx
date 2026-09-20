"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { altOf, type Photo } from "@/lib/product-photos";
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
  const stage = useRef<HTMLButtonElement>(null);
  const many = photos.length > 1;

  /* Under a pointer the picture grows around the point the pointer is on
     and follows it — a magnifier, in effect — so the stitching can be looked
     at without opening anything. The point is written as two custom
     properties the stylesheet reads for `transform-origin`; only a mouse
     does this, since a finger resting on the picture is a tap. */
  function follow(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || !stage.current) return;
    const box = stage.current.getBoundingClientRect();
    stage.current.style.setProperty("--zx", `${((event.clientX - box.left) / box.width) * 100}%`);
    stage.current.style.setProperty("--zy", `${((event.clientY - box.top) / box.height) * 100}%`);
  }

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
      {/* No card around the picture and no margin inside it: a photo on
          the shop's white inside a bordered white box with a white border
          of padding read as a frame around a frame, and the placeholder a
          new product starts with drew a third. The rounded corners are the
          picture's own. */}
      <div
        role="tabpanel"
        id="gallery-panel"
        aria-labelledby={`gallery-tab-${active}`}
        className="gallery-stage relative aspect-square overflow-hidden rounded-card bg-surface"
      >
        <button
          ref={stage}
          type="button"
          onClick={() => setOpen(true)}
          onPointerMove={follow}
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
            /* Twice the box on a desktop, since the box shows the picture
               at twice its size under the pointer. */
            sizes="(max-width: 1024px) 100vw, 1200px"
            quality={85}
            className="gallery-photo object-contain"
            priority={active === 0}
          />
        </button>
        {badge}
        {many && (
          <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-panel/80 px-2.5 py-1 text-[11px] font-bold text-panel-fg tabular-nums">
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
              /* The chosen one is ringed in the brand colour; the rest are
                 plain, without a border of their own or a dimming — a row
                 of small framed pictures under a large one was more frame
                 than picture. */
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-surface ring-2 ring-offset-2 ring-offset-canvas transition-[box-shadow,transform] ${
                index === active
                  ? "ring-brand-600"
                  : "ring-transparent hover:ring-ink-300"
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
