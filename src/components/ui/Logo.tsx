/**
 * The Bazari mark.
 *
 * A black field carrying a 2×2 grid with one cell in brand red — the same
 * module grid the rest of the site is built on, reduced to its smallest
 * statement. Drawn as rectangles rather than set as a letter on purpose: the
 * mark also ships as the browser tab icon, where an SVG `<text>` would depend
 * on the viewer's machine having a Georgian font installed and would fall back
 * to a blank square on the ones that don't.
 *
 * The field stays black in both themes. It is the constant the rest of the
 * palette moves around, and a mark that inverts with the theme is a different
 * mark twice rather than one brand.
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect width="64" height="64" fill="#101216" />
      <rect x="12" y="12" width="18" height="18" fill="#dc1f24" />
      <rect x="34" y="12" width="18" height="18" fill="#ffffff" />
      <rect x="12" y="34" width="18" height="18" fill="#ffffff" />
      <rect x="34" y="34" width="18" height="18" fill="#ffffff" />
    </svg>
  );
}

/** Mark plus wordmark. `compact` drops the word, for narrow bars. */
export function Logo({
  size = 36,
  compact = false,
  className = "",
}: {
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex shrink-0 items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {!compact && (
        <span className="text-lg leading-none font-extrabold tracking-tight text-ink-900">
          Ba<span className="text-brand-600">zari</span>
        </span>
      )}
    </span>
  );
}
