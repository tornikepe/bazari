import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

export function SectionHeading({
  title,
  hint,
  href,
  linkLabel,
}: {
  title: string;
  hint?: string;
  href?: string;
  linkLabel?: string;
}) {
  // Wraps rather than spilling: the Georgian heading plus the "view all" link
  // together are wider than a 320px screen.
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink-900">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
      </div>

      {href && linkLabel && (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
        >
          {linkLabel}
          <ArrowRightIcon
            size={15}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  );
}
