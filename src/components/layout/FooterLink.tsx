"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isCurrentPage } from "@/lib/current-page";

/**
 * A footer link: a small pill on a phone, a row in a column from `sm` up.
 *
 * The pill is 32px tall with its own edge, so a row of them reads as a set
 * of buttons rather than a paragraph of words — and each is a target a
 * thumb can find. The rows are 32px too, with the list's `gap` at zero, so
 * the whole row is the target and the rows sit close.
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
      className={`footer-pill flex min-h-7 items-center text-xs transition-colors hover:text-brand-600 sm:min-h-8 sm:text-sm ${
        current ? "font-semibold text-ink-900" : "text-ink-500"
      }`}
    >
      {children}
    </Link>
  );
}
