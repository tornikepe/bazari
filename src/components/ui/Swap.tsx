import type { ReactNode } from "react";

/**
 * A label that changes without changing size.
 *
 * A button that says "pause" and then "resume", or "save" and then "saving…",
 * is a button that gets wider or narrower each time it is pressed — and in a
 * row of controls, the ones beside it move to make room. Every string the
 * control can show is laid out here in the same grid cell, the ones not
 * showing invisible, so the control is always as wide and as tall as its
 * longest label and pressing it moves nothing.
 *
 * The strings are given up front rather than discovered, because the width
 * has to be right on the first render: a label measured after it appeared
 * has already moved its neighbours once.
 */
export function Swap({
  show,
  of,
  className = "",
}: {
  /** The label showing now. */
  show: ReactNode;
  /** Every label the control can show, `show` included. */
  of: readonly ReactNode[];
  className?: string;
}) {
  return (
    <span className={`grid ${className}`}>
      {of.map((label, index) => (
        <span
          key={index}
          aria-hidden
          className="invisible col-start-1 row-start-1"
        >
          {label}
        </span>
      ))}
      <span className="col-start-1 row-start-1">{show}</span>
    </span>
  );
}

/**
 * What a control shows while it is working: the word for it, in place of
 * the idle label. Used as the `show` of a `Swap` whose `of` holds the idle
 * labels, so the control keeps its idle size.
 *
 * It used to be a turning ring. A ring inside a button is a second thing
 * happening in a place that should only be saying one — and on a fast
 * connection it appears and goes in the same blink, which reads as a
 * flicker rather than as progress. The word, with the button dimmed and
 * unpressable beneath it, says the same thing quietly.
 */
export function Busy({ label }: { label: string }) {
  return <span className="flex justify-center">{label}</span>;
}
