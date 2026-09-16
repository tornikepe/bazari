"use client";

import { usePathname } from "next/navigation";

/**
 * Replays the page's entrance on every navigation.
 *
 * The wrapper is keyed on the pathname, so React mounts a fresh element —
 * and restarts its CSS animation — when the route changes, and leaves it
 * alone when the same page re-renders for a cart change or a search. The
 * animation itself is `.page-enter`: half a second of rise, once.
 */
export function PageTransition({
  children,
  block = false,
}: {
  children: React.ReactNode;
  /**
   * A plain block rather than a flex column. The shop's pages fill the
   * height of a flex main; the dashboard's are blocks with `mx-auto` on
   * them, and a block with auto margins inside a flex column is sized to
   * its content — the orders page came out 880px wide on a phone.
   */
  block?: boolean;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className={block ? "page-enter" : "page-enter flex flex-1 flex-col"}>
      {children}
    </div>
  );
}
