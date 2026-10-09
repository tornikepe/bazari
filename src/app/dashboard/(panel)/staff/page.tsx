import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { formatDate } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { StaffManager } from "@/components/admin/StaffManager";
import { PasswordRotate } from "@/components/admin/PasswordRotate";
import { RecoveryCodes } from "@/components/admin/RecoveryCodes";
import { countRecoveryCodes } from "@/lib/recovery";
import { staffTwoStep } from "@/lib/mail";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * Who works here.
 *
 * Roles could only be changed in Prisma Studio, which is not something to ask
 * a shop owner to open. Everything on this page is scoped to staff: customers
 * are managed on their own page, and the only way one appears here is by being
 * invited into a role.
 */
export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ recovered?: string }>;
}) {
  const [{ t }, me, params] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);

  /* When this reader last made themselves a password. The audit log already
     records it, so nothing has to be stored twice — and a password nobody
     has changed since the shop was seeded is worth saying out loud rather
     than leaving in a document somebody has to remember to read. */
  const [lastRotation, codesLeft] = me
    ? await Promise.all([
        prisma.auditEntry.findFirst({
          where: { action: "staff.password", entityId: me.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        countRecoveryCodes(me.id),
      ])
    : [null, 0];

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
      lastSignInAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.staff}
        count={staff.length}
        lead={t.admin.staffHint}
      />

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
            lastSeen: person.lastSignInAt ? formatDate(person.lastSignInAt) : "",
          }))}
        />
      </div>

      {/* Everything below is about the reader rather than about the team:
          the password they sign in with, and the way back when it is gone. */}
      {params.recovered === "1" && (
        <p
          role="status"
          className="mt-4 rounded-card border border-warning/40 bg-warning-soft px-4 py-3 text-sm leading-snug font-semibold text-ink-900"
        >
          {t.admin.recoveredNotice}
        </p>
      )}

      <PasswordRotate
        twoStep={staffTwoStep()}
        lastChanged={lastRotation ? formatDate(lastRotation.createdAt) : null}
      />

      <RecoveryCodes left={codesLeft} />
    </div>
  );
}
