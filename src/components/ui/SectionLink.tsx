import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";

/**
 * The "view all" beside a section's heading.
 *
 * A small pill with a chevron rather than an underlined word in 12px: the
 * word was a target eleven pixels tall on a phone, and where the heading
 * was long enough to crowd it, a thumb's width of text that broke into two
 * lines. The pill is 32px tall, never wraps, and shrinks the heading
 * rather than itself.
 */
export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-line bg-surface pr-2 pl-3 text-xs font-bold text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-600"
    >
      {children}
      <ChevronRightIcon size={14} aria-hidden="true" />
    </Link>
  );
}
