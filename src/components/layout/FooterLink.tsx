"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isCurrentPage } from "@/lib/current-page";

/**
 * A footer link: a row in a column, 32px tall so the whole row is the
 * target and the rows sit close, at every width.
 */
export function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const current = isCurrentPage(href, pathname, search);

  return (
    <Link
      href={href}
      // The footer is the storefront's only navigation on a wide screen, so
      // this is where "you are here" has to be said. A sighted reader gets it
      // from the darker text; `aria-current` is the same fact, said out loud.
      aria-current={current ? "page" : undefined}
      className={`flex min-h-8 items-center text-sm transition-colors hover:text-brand-600 ${
        current ? "font-semibold text-ink-900" : "text-ink-500"
      }`}
    >
      {children}
    </Link>
  );
}
