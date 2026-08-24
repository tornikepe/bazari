import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "@/components/layout/Breadcrumb";

/**
 * How a page introduces itself.
 *
 * There were four shapes: a breadcrumb and a title, a title alone, a title
 * with a count beside it, and a centred icon above a centred title. Each was
 * reasonable on the day it was written and together they made the site read
 * as nine designs rather than one — a reader moving between pages could not
 * learn where the title would be, because it moved.
 *
 * One shape, then: trail, eyebrow, title, one line of purpose, and — on the
 * right, where it does not push the title around — the page's own action.
 * Everything but the title is optional; nothing is reordered.
 *
 * Two sizes, because the dashboard is a denser place than the shop and had
 * already settled on a smaller title across all ten of its pages. That is a
 * decision worth keeping — but one component should make it, rather than the
 * same ten class names being retyped and one of them drifting.
 */
const TITLE_SIZE = {
  page: "text-2xl",
  panel: "text-xl",
} as const;

export function PageHeader({
  title,
  crumbs,
  eyebrow,
  lead,
  action,
  /** A count, shown beside the title in the way the dashboard already does. */
  count,
  scale = "page",
  code = false,
  className = "",
}: {
  title: string;
  crumbs?: Crumb[];
  eyebrow?: string;
  lead?: string;
  action?: ReactNode;
  count?: number;
  /** `panel` is the dashboard's smaller title; the shop uses the default. */
  scale?: keyof typeof TITLE_SIZE;
  /** The title is an identifier — an order number — and is set like one. */
  code?: boolean;
  className?: string;
}) {
  return (
    <header className={className}>
      {crumbs && crumbs.length > 0 && <Breadcrumb items={crumbs} className="mb-2" />}

      {/* The action sits on the same row as the title on a wide screen and
          drops below it on a narrow one, rather than being squeezed beside a
          heading that then wraps to three lines in Georgian. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-bold tracking-wider text-ink-400 uppercase">{eyebrow}</p>
          )}

          <h1
            className={`${TITLE_SIZE[scale]} font-extrabold tracking-tight text-ink-900 ${
              code ? "font-mono break-all" : ""
            }`}
          >
            {title}
            {count !== undefined && (
              <span className="ml-2 text-sm font-medium text-ink-400 tabular-nums">{count}</span>
            )}
          </h1>

          {/* `max-w-prose`: a line of explanation the width of a desktop is
              unreadable, and this one is always a single sentence. */}
          {lead && <p className="mt-1 max-w-prose text-sm text-ink-500">{lead}</p>}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
