import type { ReactNode } from "react";
import { AlertIcon } from "@/components/ui/icons";

/**
 * A failure, said in three parts.
 *
 * Every error in this shop was one red sentence, and most of them ended
 * "please try again" — which is advice only when trying again could work. A
 * cart holding something that has been withdrawn will fail on the second
 * press exactly as it failed on the first, and the shopper is left pressing a
 * button that cannot succeed.
 *
 * So: what happened, what to do about it, and — where there is one — the way
 * to do it. The third part is the one that was always missing.
 *
 * `role="alert"` rather than `status`: this interrupts on purpose. Something
 * the reader asked for did not happen, and they need to know before they carry
 * on pressing.
 */
export function ErrorNote({
  title,
  hint,
  action,
  className = "",
}: {
  title: string;
  /** What to do next. Omitted when the title already says it. */
  hint?: string;
  /** The way to do it — a link or a button. Omitted when there is nothing to offer. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`border border-danger/30 bg-danger-soft p-3.5 text-sm ${className}`}
    >
      <p className="flex items-start gap-2 font-bold text-danger">
        <AlertIcon size={16} className="mt-px shrink-0" />
        {title}
      </p>

      {/* Indented to the title's text, not to the icon: the two lines are one
          statement and should read as a paragraph, not as a list. */}
      {hint && <p className="mt-1 pl-6 leading-snug text-ink-700">{hint}</p>}

      {action && <div className="mt-3 pl-6">{action}</div>}
    </div>
  );
}
