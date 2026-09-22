import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";

/**
 * The "view all" beside a section's heading.
 *
 * A pill with the chevron in a disc at its end: under the pointer the
 * disc fills with ink and the arrow steps to the right, so the control
 * says where it goes before it is pressed. Never wraps, and shrinks the
 * heading rather than itself.
 */
export function SectionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="section-link">
      {children}
      <span className="section-link-mark" aria-hidden="true">
        <ChevronRightIcon size={14} />
      </span>
    </Link>
  );
}
