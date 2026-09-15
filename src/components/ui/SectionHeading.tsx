import { SectionLink } from "@/components/ui/SectionLink";

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
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div>
        {/* A tracked capital rather than a second display size: the page
            already has one heading, and a section is a label on it. */}
        <h2 className="label text-ink-900">{title}</h2>
        {hint && <p className="mt-1.5 text-sm text-ink-500">{hint}</p>}
      </div>

      {href && linkLabel && <SectionLink href={href}>{linkLabel}</SectionLink>}
    </div>
  );
}
