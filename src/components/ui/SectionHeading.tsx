import Link from "next/link";

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
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div>
        {/* A tracked capital rather than a second display size: the page
            already has one heading, and a section is a label on it. */}
        <h2 className="label text-ink-900">{title}</h2>
        {hint && <p className="mt-1.5 text-sm text-ink-500">{hint}</p>}
      </div>

      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 text-xs font-bold text-brand-600 underline underline-offset-4 hover:text-brand-700"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
