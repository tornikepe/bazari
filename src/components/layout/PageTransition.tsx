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
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter flex flex-1 flex-col">
      {children}
    </div>
  );
}
