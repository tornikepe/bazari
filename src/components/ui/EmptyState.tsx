import type { ReactNode } from "react";

/**
 * One shape for every page with nothing on it.
 *
 * There were seven of these, hand-written, and they had drifted: two icon
 * sizes, two paddings, three different heading levels, and one that was a
 * bare line of grey text with no way out of it. An empty state is not a
 * failure message — it is the page a new customer sees first, and the only
 * one where a shop gets to say what should be here and how to put it there.
 *
 * So the shape is fixed: a drawing, what is missing, why, and exactly one
 * action. Anything with two equal actions has none.
 */
export function EmptyState({
  art,
  title,
  text,
  action,
  titleAs: Title = "h2",
  className = "",
}: {
  /** One of the drawings from `illustrations.tsx`, already sized. */
  art: ReactNode;
  title: string;
  text?: string;
  /** The one way out. Optional only where the page itself is the way out. */
  action?: ReactNode;
  /**
   * The heading level, which is the caller's business and not this
   * component's: the cart's empty state *is* the page's `h1`, the one on the
   * account page sits under one, and the dashboard's is not a heading at all.
   * Guessing here is how a page ends up with two `h1`s or a skipped level,
   * both of which `document-structure.spec.ts` fails on.
   */
  titleAs?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center px-6 py-14 text-center ${className}`}
    >
      {art}

      <Title className="mt-5 text-lg font-bold tracking-tight text-ink-900">{title}</Title>

      {/* `max-w-sm`, because a centred paragraph the width of a dashboard
          table is unreadable — the eye loses the start of the next line. */}
      {text && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">{text}</p>}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
