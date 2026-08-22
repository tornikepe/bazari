/**
 * Placeholder cards shown while products load.
 *
 * A skeleton only earns its place if the real content lands in exactly the
 * same boxes. This one used to hardcode its own grid — two columns from zero
 * width, three at `xl` — while the catalogue renders one column below 380px
 * and the wishlist renders four at `xl`. It matched neither, so on a narrow
 * phone the page reflowed from two columns to one the moment the data
 * arrived: a layout jump introduced by the thing meant to prevent one.
 *
 * The grid classes now come from the constants below, which the real grids
 * use too, so the two cannot drift apart without someone editing a shared
 * value and seeing both call sites.
 */

/**
 * The catalogue's grid.
 *
 * `gap-px` over a line-coloured background, with a border closing the outside:
 * the cards are divided by the same one-pixel rule that runs everywhere else
 * on the site, rather than floating apart on gaps and shadows. The cards
 * themselves carry no border — the gap *is* the border, so interior rules
 * never double up.
 *
 * One column on the narrowest phones: at 320px, two columns leave about 130px
 * per card and nothing fits in that.
 */
/*
 * The cards used to sit on a `gap-px` hairline grid — separated by a single
 * line, sharing one continuous block. It was the most literal reading of the
 * ruled layout and it made the products hard to tell apart: with no space
 * around them, a photo, a name and a price ran straight into the next photo,
 * a name and a price.
 *
 * Each card now carries its own border with room around it. The grid is still
 * a grid and the rules are still rules; there is simply somewhere for the eye
 * to stop between one product and the next.
 */
export const PRODUCT_GRID =
  "grid grid-cols-1 gap-3 min-[340px]:grid-cols-2 sm:gap-4 xl:grid-cols-3";

/** The wishlist's grid, which goes one wider because it has no sidebar. */
export const PRODUCT_GRID_WIDE =
  "grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 xl:grid-cols-4";

export function ProductGridSkeleton({
  count = 12,
  className = PRODUCT_GRID,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="overflow-hidden border border-line bg-surface">
          <div className="skeleton aspect-square" />
          <div className="flex flex-col gap-2.5 p-3.5">
            <div className="h-3 w-1/3 animate-pulse bg-ink-100" />
            <div className="h-4 w-full animate-pulse bg-ink-100" />
            <div className="h-4 w-2/3 animate-pulse bg-ink-100" />
            <div className="h-6 w-1/2 animate-pulse bg-ink-100" />
            <div className="h-9 w-full animate-pulse bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
