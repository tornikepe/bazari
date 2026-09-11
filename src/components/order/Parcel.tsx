/**
 * The order, as a thing: a parcel in three dimensions.
 *
 * Same construction as the hero cube — six faces placed with
 * `preserve-3d`, no canvas, no library, no script — but shaped like a box
 * that has been packed rather than a cube that stands for a brand: wider
 * than it is tall, a strip of tape across the lid, and the mark on the
 * front where a label would be. The confirmation page used to open on a
 * green tick, which says "done"; this says what was done.
 *
 * It lands once, from a little above, and then sits. Under reduced motion
 * it is simply there. `aria-hidden`: the heading beside it says everything
 * it does.
 */
export function Parcel({ className = "" }: { className?: string }) {
  const faces = ["front", "back", "right", "left", "top", "bottom"] as const;

  return (
    <div className={`parcel-stage ${className}`} aria-hidden="true">
      <div className="parcel">
        {faces.map((face) => (
          <div key={face} className="parcel-face" data-face={face}>
            {/* One strip of tape over the lid and down the front, the way a
                box is actually sealed. */}
            {(face === "top" || face === "front") && <span className="parcel-tape" />}
            {face === "front" && (
              <span className="parcel-label">
                <span className="parcel-module parcel-module--brand" />
                <span className="parcel-module" />
                <span className="parcel-module" />
                <span className="parcel-module" />
              </span>
            )}
          </div>
        ))}
      </div>
      {/* The shadow it lands on — a flat ellipse under the box, which is
          what tells the eye the box has a floor. */}
      <span className="parcel-shadow" />
    </div>
  );
}
