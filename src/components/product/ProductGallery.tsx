"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { altOf, type Photo } from "@/lib/product-photos";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Lightbox } from "@/components/product/Lightbox";

/**
 * The product's photos, laid out the way the reference shop lays them.
 *
 * On a desktop: a column of thumbnails at the left and the picture beside
 * it, 3:4, with an arrow at either side of the picture. On a phone: the
 * photos edge to edge in a strip that swipes and snaps, with a dot for
 * each under it — no thumbnails, the way every shop's phone page does it.
 * A tap on the picture opens the lightbox on either.
 *
 * The thumbnails are tabs rather than a row of buttons, for the tab
 * order: seven photos as seven buttons is seven stops between the price
 * and the buy button. The tabs pattern gives one stop for the strip and
 * arrow keys inside it.
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
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLButtonElement>(null);
  const many = photos.length > 1;
  const last = photos.length - 1;

  /* Under a pointer the picture grows around the point the pointer is on
     and follows it — a magnifier, in effect. Only a mouse does this. */
  function follow(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || !stage.current) return;
    const box = stage.current.getBoundingClientRect();
    stage.current.style.setProperty("--zx", `${((event.clientX - box.left) / box.width) * 100}%`);
    stage.current.style.setProperty("--zy", `${((event.clientY - box.top) / box.height) * 100}%`);
  }

  /* The phone strip: which photo is in view, read from the scroll, so the
     dots follow a swipe; and a dot pressed scrolls the strip. */
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const read = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", read, { passive: true });
    return () => el.removeEventListener("scroll", read);
  }, []);

  function go(index: number) {
    const next = (index + photos.length) % photos.length;
    setActive(next);
    track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: "smooth" });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
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
    event.preventDefault();
    setActive(next);
    strip.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div className="gallery min-w-0 lg:self-start">
      {/* ------------------------------ phone ------------------------------ */}
      <div className="gallery-phone lg:hidden">
        <div ref={track} className="gallery-track" data-lenis-prevent>
          {photos.map((photo, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setActive(index);
                setOpen(true);
              }}
              aria-label={t.product.zoomIn}
              className="gallery-slide"
            >
              <Image
                src={photo.url}
                alt={altOf(photo, locale, name)}
                fill
                sizes="100vw"
                quality={85}
                priority={index === 0}
                className="object-contain"
              />
            </button>
          ))}
        </div>
        {badge && <div className="absolute top-3 left-3">{badge}</div>}
        {many && (
          <div className="gallery-dots" role="tablist" aria-label={t.product.photos}>
            {photos.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-label={fill(t.product.photoNumber, { index: index + 1, total: photos.length })}
                onClick={() => go(index)}
                className={index === active ? "is-on" : ""}
              />
            ))}
          </div>
        )}
      </div>

      {/* ----------------------------- desktop ----------------------------- */}
      <div className="hidden gap-3 lg:flex">
        {many && (
          <div
            ref={strip}
            role="tablist"
            aria-label={t.product.photos}
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            className="gallery-thumbs"
            data-lenis-prevent
          >
            {photos.map((photo, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                id={`gallery-tab-${index}`}
                aria-selected={index === active}
                aria-controls="gallery-panel"
                tabIndex={index === active ? 0 : -1}
                onClick={() => setActive(index)}
                aria-label={fill(t.product.photoNumber, { index: index + 1, total: photos.length })}
                className={`gallery-thumb ${index === active ? "is-on" : ""}`}
              >
                <Image src={photo.url} alt="" fill sizes="88px" className="object-cover" />
              </button>
            ))}
          </div>
        )}

        <div
          role="tabpanel"
          id="gallery-panel"
          aria-labelledby={`gallery-tab-${active}`}
          className="gallery-stage relative min-w-0 flex-1"
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
              alt={altOf(photos[active], locale, name)}
              fill
              sizes="(max-width: 1280px) 45vw, 620px"
              quality={85}
              className="gallery-photo object-contain"
              priority={active === 0}
            />
          </button>
          {badge}
          {many && (
            <>
              <button
                type="button"
                onClick={() => setActive(active === 0 ? last : active - 1)}
                aria-label={t.product.previousPhoto}
                className="gallery-arrow left-3"
              >
                <ChevronLeftIcon size={20} />
              </button>
              <button
                type="button"
                onClick={() => setActive(active === last ? 0 : active + 1)}
                aria-label={t.product.nextPhoto}
                className="gallery-arrow right-3"
              >
                <ChevronRightIcon size={20} />
              </button>
            </>
          )}
        </div>
      </div>

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
