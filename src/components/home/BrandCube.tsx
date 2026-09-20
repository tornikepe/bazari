import { CubeTilt } from "@/components/home/CubeTilt";

/**
 * The mark, turned in three dimensions.
 *
 * A cube whose every face is the Bazari mark — a 2×2 module grid with one cell
 * in brand red — rotating slowly on two axes. The mark is already the site's
 * design language reduced to its smallest statement, so the hero object is that
 * statement given depth rather than a decoration bolted on beside it.
 *
 * ## Why CSS and not WebGL
 *
 * A canvas would mean a library, a shader, a device-pixel-ratio dance and a
 * fallback for when the context is refused — a few hundred kilobytes and a
 * second render path, for six squares. `transform-style: preserve-3d` is real
 * 3D: a perspective projection, six faces placed in space, composited on the
 * GPU. It also costs nothing this page was not already paying, needs no
 * JavaScript at all, and therefore renders on the server and is correct before
 * hydration rather than after it.
 *
 * ## What it is not allowed to do
 *
 * Take attention from the words. It turns once every 28 seconds — slow enough
 * to read as "alive" rather than "moving" — and stops dead for anyone who has
 * asked for reduced motion.
 *
 * It is drawn at full opacity, which took a look to get right: fading the whole
 * stage to 62% turned the near-black field grey and the brand red pink the
 * moment the light theme was behind it. Subordinate is a matter of size and
 * placement here, not of transparency. And it is `aria-hidden`:
 * it says nothing the heading does not.
 */
export function BrandCube() {
  // Six faces, each transformed onto one side of a cube whose half-edge is
  // `--cube-half`. Named rather than indexed so the transform reads as the
  // geometry it is.
  const faces = ["front", "back", "right", "left", "top", "bottom"] as const;

  return (
    <div className="cube-stage" aria-hidden="true">
      <CubeTilt>
        <div className="cube">
          {faces.map((face) => (
            <div key={face} className="cube-face" data-face={face}>
              {/* The mark: the bag, on every side. */}
              <svg viewBox="0 0 64 64" className="cube-mark" aria-hidden="true">
                <path
                  d="M23 27v-4.5a9 9 0 0 1 18 0V27"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M17.5 26.5h29a2 2 0 0 1 2 2.2l-2 20.4a4 4 0 0 1-4 3.6H21.5a4 4 0 0 1-4-3.6l-2-20.4a2 2 0 0 1 2-2.2z"
                  fill="currentColor"
                />
                <circle cx="39.5" cy="38" r="4.5" className="cube-mark-dot" />
              </svg>
            </div>
          ))}
        </div>
      </CubeTilt>
    </div>
  );
}
