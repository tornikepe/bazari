import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDateTime } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { ReturnsManager } from "@/components/admin/ReturnsManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";
import { PageHeader } from "@/components/layout/PageHeader";
import type { RawSearchParams } from "@/lib/filters";

/**
 * Return requests.
 *
 * Open ones first by default, because that is the list somebody comes here to
 * work through; "all" is for finding what was said about a parcel last month.
 */
export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { t } = await getI18n();
  const params = await searchParams;
  const showAll = (Array.isArray(params.view) ? params.view[0] : params.view) === "all";

  const requests = await prisma.returnRequest.findMany({
    where: showAll ? {} : { status: { in: ["requested", "approved", "received"] } },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      order: { select: { id: true, number: true, customerName: true, phone: true } },
      items: {
        include: { orderItem: { select: { nameKa: true, nameEn: true, variantLabel: true } } },
      },
    },
  });

  const filters = [
    { key: "open", label: t.admin.returnFilterOpen, href: "/dashboard/returns", active: !showAll },
    { key: "all", label: t.admin.returnFilterAll, href: "/dashboard/returns?view=all", active: showAll },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.returns}
        count={requests.length}
        lead={t.admin.returnsHint}
        action={
          <div className="flex gap-1">
            {filters.map((filter) => (
              <Link
                key={filter.key}
                href={filter.href}
                aria-current={filter.active ? "page" : undefined}
                className={`btn btn-sm ${filter.active ? "btn-primary" : "btn-ghost"}`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          className="card mt-4"
          art={<EmptyOrdersArt size={88} />}
          title={t.admin.returnsNone}
          text={t.admin.returnsNoneHint}
          titleAs="p"
        />
      ) : (
        <div className="mt-4">
          <ReturnsManager
            requests={requests.map((request) => ({
              id: request.id,
              status: request.status,
              reason: request.reason,
              note: request.note,
              staffNote: request.staffNote,
              actor: request.actor,
              createdAtLabel: formatDateTime(request.createdAt),
              order: request.order,
              items: request.items.map((line) => ({
                nameKa: line.orderItem.nameKa,
                nameEn: line.orderItem.nameEn,
                variantLabel: line.orderItem.variantLabel,
                quantity: line.quantity,
              })),
            }))}
          />
        </div>
      )}
    </div>
  );
}
