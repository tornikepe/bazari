"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { Overlay } from "@/components/ui/Overlay";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";

/**
 * The pictures under a review: a strip of square thumbnails, and any of
 * them opens large over the page, with the others a step to either side.
 */
export function ReviewPhotos({ photos }: { photos: { id: string; url: string }[] }) {
  const { t } = useI18n();
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (photos.length === 0) return null;

  const current = openAt === null ? null : photos[openAt];
  const step = (by: number) =>
    setOpenAt((index) => (index === null ? null : (index + by + photos.length) % photos.length));

  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpenAt(index)}
              aria-label={t.product.reviewPhotoOpen}
              className="block h-18 w-18 overflow-hidden rounded-control border border-line bg-ink-50 transition-transform hover:scale-[1.03]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <Overlay
        open={openAt !== null}
        onClose={() => setOpenAt(null)}
        side="center"
        closeLabel={t.nav.close}
        label={t.product.reviewPhotoOpen}
        className="max-w-3xl items-center justify-center bg-panel/95 p-2"
      >
        {current && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt=""
              className="max-h-[calc(100dvh-4rem)] w-auto max-w-full rounded-control object-contain"
            />
            <button
              type="button"
              onClick={() => setOpenAt(null)}
              aria-label={t.nav.close}
              className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-pill bg-panel text-panel-fg ring-1 ring-white/20"
            >
              <CloseIcon size={18} />
            </button>
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="‹"
                  className="absolute top-1/2 left-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-pill bg-panel text-panel-fg ring-1 ring-white/20"
                >
                  <ChevronLeftIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="›"
                  className="absolute top-1/2 right-3 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-pill bg-panel text-panel-fg ring-1 ring-white/20"
                >
                  <ChevronRightIcon size={18} />
                </button>
                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-pill bg-panel px-2.5 py-1 text-xs font-semibold text-panel-fg tabular-nums">
                  {openAt! + 1} / {photos.length}
                </p>
              </>
            )}
          </>
        )}
      </Overlay>
    </>
  );
}
