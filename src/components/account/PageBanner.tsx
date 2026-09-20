import type { ReactNode } from "react";

/**
 * The card the account, the wishlist and the cart open with: the band
 * across the top, a mark on its lower edge, an eyebrow, the title in the
 * serif, a line under it, and whatever belongs at the end of the row —
 * chips, or buttons. The three pages that are *yours* open the same way.
 */
export function PageBanner({
  eyebrow,
  title,
  line,
  mark,
  aside,
  children,
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  line?: ReactNode;
  /** What stands on the band's edge: a picture, initials, an icon. */
  mark: ReactNode;
  aside?: ReactNode;
  /** Rows along the foot of the card — tabs, a note. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card shine-once overflow-hidden ${className}`}>
      <div className="identity-band" aria-hidden="true" />
      <div className="identity-body">
        <span className="avatar-ring shrink-0 ring-4 ring-surface">{mark}</span>
        <div className="min-w-0 flex-1 pb-0.5">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display-md mt-1 truncate text-ink-900">{title}</h1>
          {line && <div className="mt-1 text-sm text-ink-500">{line}</div>}
        </div>
        {aside && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:self-center">{aside}</div>
        )}
      </div>
      {children}
    </div>
  );
}
