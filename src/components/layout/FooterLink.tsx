"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isCurrentPage } from "@/lib/current-page";

/**
 * A footer link that fills its row.
 *
 * The text is 19px tall and the rows were 34px apart, so half of every row was
 * dead space a thumb could land in and nothing would happen. `min-h-11` is 44px
 * — what Apple and Google both ask for — and the list's `gap` is removed to pay
 * for it, so the rows keep roughly the spacing they had while the target more
 * than doubles.
 *
 * Worth being precise about what this does and does not fix: these links were
 * never a WCAG failure. SC 2.5.8 lets an undersized target pass when a 24px
 * circle on its centre touches no other target's, and at 34px apart these
 * cleared that comfortably. This is an ergonomic improvement, not a conformance
 * one, and the roadmap said otherwise until it was measured properly.
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
      className={`flex min-h-11 items-center text-sm transition-colors hover:text-brand-600 ${
        current ? "font-semibold text-ink-900" : "text-ink-500"
      }`}
    >
      {children}
    </Link>
  );
}
