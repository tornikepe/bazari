import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { formatDate } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { StaffManager } from "@/components/admin/StaffManager";

/**
 * Who works here.
 *
 * Roles could only be changed in Prisma Studio, which is not something to ask
 * a shop owner to open. Everything on this page is scoped to staff: customers
 * are managed on their own page, and the only way one appears here is by being
 * invited into a role.
 */
export default async function AdminStaffPage() {
  const { t } = await getI18n();
  const me = await getCurrentUser();

  const staff = await prisma.user.findMany({
    where: { role: { in: ["admin", "viewer"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabledAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <ReadOnlyNotice />

      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
          {t.admin.staff}
          <span className="ml-2 text-sm font-medium text-ink-400">{staff.length}</span>
        </h1>
        <p className="mt-0.5 text-sm text-ink-500">{t.admin.staffHint}</p>
      </div>

      <div className="mt-4">
        <StaffManager
          me={me?.id ?? ""}
          staff={staff.map((person) => ({
            id: person.id,
            email: person.email,
            name: person.name,
            role: person.role,
            disabled: person.disabledAt !== null,
            since: formatDate(person.createdAt),
          }))}
        />
      </div>
    </div>
  );
}
