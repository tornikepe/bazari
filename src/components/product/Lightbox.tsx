"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { useOverlay } from "@/lib/use-overlay";
import { altOf, type Photo } from "@/lib/product-photos";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";

/**
 * A product photo the size of the screen.
 *
 * Tapping the picture on the product page opens it here, over everything,
 * on a dark ground so nothing competes with it. Arrows and a swipe move
 * along the strip; a tap on the picture itself brings it to twice its size
 * around the point tapped and a second tap puts it back — the one thing
 * somebody enlarging a photo of a shoe actually wants to do, which is look
 * at the stitching.
 *
 * Portalled to the body and mounted only while open, so the page behind
 * carries none of it. Escape closes; focus is kept inside while it is up.
 */
export function Lightbox({
  photos,
  index,
  name,
  open,
  onClose,
  onIndexChange,
}: {
  photos: Photo[];
  index: number;
  name: string;
  open: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const { locale, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  /* Zoomed in, and where — the origin is the point tapped, as a fraction of
     the picture, so the place under the finger is the place that grows.
     Cleared on every way out, so the box never reopens mid-zoom. */
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const close = () => {
    setZoom(null);
    onClose();
  };

  const { mounted, state } = useOverlay(open, {
    duration: 260,
    lockScroll: true,
    onEscape: close,
    trapFocusIn: containerRef,
  });

  const last = photos.length - 1;
  const go = (next: number) => {
    setZoom(null);
    onIndexChange(next < 0 ? last : next > last ? 0 : next);
  };

  // Arrow keys work wherever focus is inside the box.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(index + 1);
      else if (event.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `go` is recreated each render; the listener only needs the current index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  if (!mounted) return null;

  const photo = photos[index]!;

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={fill(t.product.photoNumber, { index: index + 1, total: photos.length })}
      data-state={state}
      className="lightbox fixed inset-0 z-[80] flex flex-col text-white"
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3 sm:px-5">
        <span className="text-sm font-semibold text-white/80 tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={close}
          aria-label={t.product.closePhoto}
          className="grid h-11 w-11 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10"
        >
          <CloseIcon size={22} />
        </button>
      </div>

      {/* The picture. Its box is the space left between the bar above and
          the strip below; the photo sits inside it whole, never cropped. */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        onTouchStart={(event) => {
          const point = event.touches[0];
          touch.current = point ? { x: point.clientX, y: point.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          const end = event.changedTouches[0];
          touch.current = null;
          if (!start || !end || zoom) return;
          const dx = end.clientX - start.x;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(end.clientY - start.y)) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            if (zoom) return setZoom(null);
            const box = event.currentTarget.getBoundingClientRect();
            setZoom({
              x: ((event.clientX - box.left) / box.width) * 100,
              y: ((event.clientY - box.top) / box.height) * 100,
            });
          }}
          aria-pressed={zoom !== null}
          aria-label={t.product.zoomIn}
          className={`lightbox-stage absolute inset-0 ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
          style={
            zoom
              ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
              : { transform: "scale(1)", transformOrigin: "50% 50%" }
          }
        >
          <Image
            key={photo.url}
            src={photo.url}
            alt={altOf(photo, locale, name)}
            fill
            /* Twice the screen on a phone, because the picture is brought to
               twice its size with a tap and the file that fitted the screen
               went soft the moment it was. `sizes` is what the optimiser
               reads to choose a width; the screen's own width was too small
               for the one thing this box is for. */
            sizes="(max-width: 640px) 200vw, 1800px"
            quality={88}
            className="object-contain"
            priority
          />
        </button>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t.product.previousPhoto}
              className="lightbox-arrow left-2 sm:left-4"
            >
              <ChevronLeftIcon size={24} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t.product.nextPhoto}
              className="lightbox-arrow right-2 sm:right-4"
            >
              <ChevronRightIcon size={24} />
            </button>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-3">
          {photos.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={fill(t.product.photoNumber, { index: i + 1, total: photos.length })}
              aria-current={i === index ? "true" : undefined}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-control bg-white transition-all ${
                i === index ? "ring-2 ring-white ring-offset-2 ring-offset-black" : "opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={item.url} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
