/**
 * The pieces a loading state is built from.
 *
 * A skeleton only earns its place if the real content lands in the same boxes
 * — the same lesson `ProductGridSkeleton` learned the hard way, where a grid
 * that did not match reflowed the page the moment the data arrived and
 * introduced the jump it existed to prevent. So these are deliberately small:
 * a block, a run of lines, a table. The page-shaped assembly lives next to the
 * page it stands in for, where it can be compared to the real thing.
 *
 * Every one is `aria-hidden` and the container is a `role="status"` with the
 * loading word in it, so a screen reader hears "loading" once instead of
 * hearing a description of forty grey rectangles.
 */

/** One grey block. Sizes come from the caller, because only it knows them. */
export function Block({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-ink-100 ${className}`} />;
}

/**
 * A paragraph's worth of lines, the last one short.
 *
 * The short last line is the whole trick: equal-length bars read as a table,
 * ragged ones read as prose, and the eye knows which is coming before the text
 * arrives.
 */
export function Lines({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <Block
          key={index}
          className={`h-3.5 ${index === count - 1 ? "w-2/5" : index % 2 ? "w-11/12" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/**
 * The dashboard's tables, which are all the same shape: a head rule and then
 * rows divided by hairlines.
 *
 * `cols` widths rather than a count — a table of six equal columns is not what
 * any of these look like, and a skeleton that lies about the shape is worse
 * than none.
 */
export function TableSkeleton({
  rows = 8,
  cols = ["w-2/5", "w-1/6", "w-1/6", "w-1/12"],
}: {
  rows?: number;
  cols?: string[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-line px-4 py-3">
        {cols.map((width, index) => (
          <Block key={index} className={`h-3 ${width}`} />
        ))}
      </div>

      <div className="divide-y divide-line">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-3.5">
            {cols.map((width, index) => (
              <Block key={index} className={`h-4 ${width}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The wrapper every `loading.tsx` uses.
 *
 * One live region for the whole page. Without it the reader is told nothing at
 * all while a page loads — the old behaviour — and with a region per block
 * they would be told forty times.
 */
export function LoadingShell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
