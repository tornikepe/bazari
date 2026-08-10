import Link from "next/link";

export type Crumb = {
  label: string;
  /** Omitted on the last crumb — the page you are already on is not a link. */
  href?: string;
};

/**
 * The trail above a page heading.
 *
 * Four pages had their own copy of this — same markup, same classes, four
 * chances to fix a thing in three places. The reason to collapse them now is
 * the tap target: the links are 12px text in an 18px box, and that number
 * should live in one file rather than be edited four times and missed once.
 *
 * `-my-2 py-2` is the whole trick. The padding grows the hit area from 18px to
 * 34px; the negative margin pulls the layout box back to what it was, so
 * nothing on the page moves. It stays inside the nav's own bottom margin, so
 * the enlarged area never reaches over the heading below and starts eating
 * clicks meant for it.
 *
 * Not 44px, deliberately. Reaching that here would need 13px of padding a side,
 * which does overlap the heading, and these links already pass WCAG 2.2 — SC
 * 2.5.8's spacing exception covers them. Doubling the target for free is worth
 * doing; stealing clicks from a heading to reach a number is not.
 */
export function Breadcrumb({ items, className = "mb-3" }: { items: Crumb[]; className?: string }) {
  return (
    <nav
      aria-label="breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-xs text-ink-400 ${className}`}
    >
      {items.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden>/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="-my-2 py-2 transition-colors hover:text-brand-600">
              {crumb.label}
            </Link>
          ) : (
            // `aria-current` is what tells a screen reader which crumb is the
            // page itself; visually it is the darker one.
            <span aria-current="page" className="truncate text-ink-600">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
