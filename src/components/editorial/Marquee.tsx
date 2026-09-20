/**
 * A line of items moving across the page.
 *
 * The list is drawn twice, end to end, and the stylesheet slides the pair
 * by exactly one copy — so the loop has no seam and the speed is the
 * same however many items there are. `aria-hidden` on the second copy:
 * a screen reader hears the list once.
 */
export function Marquee({
  items,
  className = "",
  speed = 40,
}: {
  items: React.ReactNode[];
  className?: string;
  /** Seconds for one full loop. */
  speed?: number;
}) {
  const row = (hidden: boolean) => (
    <span aria-hidden={hidden || undefined} className="inline-flex shrink-0 items-center gap-12">
      {items.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-12">
          <span>{item}</span>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-solid" />
        </span>
      ))}
    </span>
  );
  return (
    <div className={`marquee ${className}`}>
      <div className="marquee-track" style={{ "--marquee-speed": `${speed}s` } as React.CSSProperties}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
