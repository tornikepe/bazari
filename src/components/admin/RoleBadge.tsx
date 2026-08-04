import type { Dictionary } from "@/lib/i18n";
import type { Role } from "@/lib/auth-roles";

/**
 * Role, as a badge.
 *
 * Colour carries meaning rather than decoration: red for the account that can
 * change the shop, blue for the one that can only read it, plain grey for a
 * shopper. All three pairs clear 4.5:1 against their own background — the
 * `-soft` tokens exist as a matched pair for exactly this.
 */
const TONE: Record<Role, string> = {
  admin: "bg-danger-soft text-danger",
  viewer: "bg-info-soft text-info",
  customer: "bg-ink-100 text-ink-600",
};

export function RoleBadge({ role, t }: { role: Role; t: Dictionary }) {
  const label: Record<Role, string> = {
    admin: t.admin.roleAdmin,
    viewer: t.admin.roleViewer,
    customer: t.admin.roleCustomer,
  };

  return <span className={`badge shrink-0 ${TONE[role]}`}>{label[role]}</span>;
}
