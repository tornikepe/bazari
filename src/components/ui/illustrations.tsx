/**
 * Drawings for the pages with nothing on them.
 *
 * Every empty state in the shop used the same grey circle with an icon in it,
 * at two different sizes and in seven places. A grey circle says "this is a
 * placeholder"; it is the visual equivalent of "no data". These say what is
 * missing — an unfilled cart, a shelf with nothing on it, a page of orders
 * that were never placed.
 *
 * One family rather than six pictures. They share a 96×96 grid, a hairline
 * weight, square ends, and exactly one element in the brand colour — which is
 * always the thing that is absent, drawn dashed. That is what makes six
 * separate drawings read as one set, and it is the same rule the rest of the
 * site is drawn to: a grid, rules, no shadows, no rounded corners.
 *
 * Purely decorative: the heading beside them carries the meaning, so every one
 * is `aria-hidden`. A screen reader that announced "empty box illustration"
 * before "your cart is empty" would be saying it twice.
 */
import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number | string };

/**
 * The shared frame: a faint square, and the drawing inside it.
 *
 * `vector-effect` keeps the hairline at one device pixel however the drawing
 * is scaled — without it a 96-unit drawing rendered at 64px thins its own
 * lines to 0.67px and the whole set turns grey at small sizes.
 */
function Plate({ size = 96, children, ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      vectorEffect="non-scaling-stroke"
      aria-hidden="true"
      {...props}
    >
      {/* The plate itself, a shade lighter than the drawing. */}
      <rect x="0.75" y="0.75" width="94.5" height="94.5" className="text-ink-200" opacity="0.7" />
      {children}
    </svg>
  );
}

/** Nothing on the shelf: the catalogue with no products, or a filter with no hits. */
export const EmptyShelfArt = (p: Props) => (
  <Plate {...p}>
    <g className="text-ink-300">
      {/* Three shelves. */}
      <path d="M16 34h64M16 58h64M16 78h64" />
      {/* Two boxes that are there. */}
      <rect x="22" y="18" width="18" height="16" />
      <rect x="48" y="20" width="14" height="14" />
      <rect x="22" y="44" width="14" height="14" />
    </g>
    {/* The gap, in brand colour: the thing that is not there. */}
    <g className="text-brand-600">
      <rect x="44" y="42" width="20" height="16" strokeDasharray="3 3" />
      <path d="M48 50h12" strokeDasharray="3 3" />
    </g>
  </Plate>
);

/** An unfilled cart. */
export const EmptyCartArt = (p: Props) => (
  <Plate {...p}>
    <g className="text-ink-300">
      {/* The basket, square-sided rather than the usual trapezoid — this shop
          does not draw curves anywhere else. */}
      <path d="M26 34h48l-6 30H32z" />
      <path d="M14 22h8l4 12" />
      <circle cx="36" cy="76" r="4" />
      <circle cx="66" cy="76" r="4" />
    </g>
    <g className="text-brand-600">
      {/* What would have been in it. */}
      <rect x="40" y="42" width="20" height="14" strokeDasharray="3 3" />
    </g>
  </Plate>
);

/** Nothing saved. */
export const EmptyHeartArt = (p: Props) => (
  <Plate {...p}>
    <g className="text-ink-300">
      {/* Two products, as they sit on a card. */}
      <rect x="22" y="14" width="22" height="20" />
      <rect x="52" y="14" width="22" height="20" />
    </g>
    <g className="text-brand-600">
      {/* The heart, drawn the way the rest of the site is: two square
          shoulders and a point, no curve anywhere. Below the products rather
          than across them — laid over the top it read as a smudge. */}
      <path d="M48 74 30 56v-8l6-6 12 8 12-8 6 6v8z" strokeDasharray="3 3" />
    </g>
  </Plate>
);

/** No orders yet — a receipt with nothing on it. */
export const EmptyOrdersArt = (p: Props) => (
  <Plate {...p}>
    <g className="text-ink-300">
      <path d="M28 16h40v64l-8-6-6 6-6-6-6 6-6-6-8 6z" />
      <path d="M36 32h24M36 42h24M36 52h16" />
    </g>
    <g className="text-brand-600">
      <path d="M36 64h24" strokeDasharray="3 3" />
    </g>
  </Plate>
);

/** No customers, no people in a list. */
export const EmptyPeopleArt = (p: Props) => (
  <Plate {...p}>
    <g className="text-ink-300">
      {/* Square head, straight shoulders — the arc that was here first was
          the only curve in the whole set and it showed. */}
      <rect x="20" y="26" width="14" height="14" />
      <path d="M15 66v-4l5-6h14l5 6v4" />
      <path d="M52 34h30M52 46h30M52 58h20" />
    </g>
    <g className="text-brand-600">
      <path d="M52 70h30" strokeDasharray="3 3" />
    </g>
  </Plate>
);

/** Searched, found nothing. */
export const NoResultsArt = (p: Props) => (
  <Plate {...p}>
    <g className="text-ink-300">
      {/* The grid being searched. */}
      <rect x="14" y="14" width="18" height="18" />
      <rect x="38" y="14" width="18" height="18" />
      <rect x="14" y="38" width="18" height="18" />
    </g>
    <g className="text-brand-600">
      {/* Clear of the grid on both sides — overlapping it, the glass read as
          a fourth tile with a line through it. */}
      <circle cx="62" cy="62" r="14" />
      <path d="m72 72 11 11" />
      {/* Nothing under the glass. */}
      <path d="M55 62h14" strokeDasharray="3 3" />
    </g>
  </Plate>
);

/** Something went wrong — the only one of the set that is not about absence. */
export const ErrorArt = (p: Props) => (
  <Plate {...p}>
    <g className="text-ink-300">
      <path d="M16 74h64" />
      <rect x="24" y="26" width="48" height="36" />
    </g>
    <g className="text-danger">
      {/* The break, drawn through the panel rather than beside it. */}
      <path d="M24 44h16l6-8 8 16 6-8h12" />
      <path d="M48 68v6" />
    </g>
  </Plate>
);
