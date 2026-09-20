/**
 * The Bazari mark: a bag.
 *
 * A black rounded field carrying a white shopping bag with its handle, and
 * one dot of the brand's red on the bag where a label would be. It says
 * what the site is for at a glance — a shop — where the module grid it
 * replaced said only "a brand". Drawn as paths rather than set as a letter
 * on purpose: the mark also ships as the browser tab icon, where an SVG
 * `<text>` would depend on the viewer's machine having a Georgian font.
 *
 * The field stays black in both themes. It is the constant the rest of the
 * palette moves around, and a mark that inverts with the theme is a
 * different mark twice rather than one brand.
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`logo-mark shrink-0 ${className}`}
    >
      <rect width="64" height="64" rx="16" fill="#101216" />
      {/* The handle, then the bag, then the label. */}
      <path
        d="M23 27v-4.5a9 9 0 0 1 18 0V27"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M17.5 26.5h29a2 2 0 0 1 2 2.2l-2 20.4a4 4 0 0 1-4 3.6H21.5a4 4 0 0 1-4-3.6l-2-20.4a2 2 0 0 1 2-2.2z"
        fill="#ffffff"
      />
      <circle cx="39.5" cy="38" r="4.5" fill="#dc1f24" />
    </svg>
  );
}

/**
 * The shop's name, set in one weight and one colour.
 *
 * It used to be `Ba` in ink and `zari` in brand red, which looked deliberate
 * and was: it was designed around a specific six-letter word. The moment the
 * name became something its owner sets, a two-tone split had nowhere sensible
 * to fall — "Tornike's Shop" has no natural seam, and picking one by character
 * count produces a different accident for every name.
 *
 * The brand colour still appears, in the mark beside it. That is the part of
 * the lockup that can carry it without knowing what the word says.
 */
export function Wordmark({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`leading-none font-extrabold tracking-tight text-ink-900 ${className}`}>
      {name}
    </span>
  );
}

/** Mark plus wordmark. `compact` drops the word, for narrow bars. */
export function Logo({
  name,
  size = 36,
  compact = false,
  className = "",
}: {
  name: string;
  size?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex shrink-0 items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {!compact && <Wordmark name={name} className="text-lg" />}
    </span>
  );
}
