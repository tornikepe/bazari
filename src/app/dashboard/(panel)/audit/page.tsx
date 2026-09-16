import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDateTime, formatPrice } from "@/lib/format";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";
import type { RawSearchParams } from "@/lib/filters";
import type { Dictionary } from "@/lib/i18n";
import type { AuditAction, AuditChanges } from "@/lib/audit-diff";

const PAGE_SIZE = 50;

/** The entities the filter offers, in the order the sidebar lists their pages. */
const ENTITIES = [
  "product",
  "category",
  "order",
  "return",
  "coupon",
  "zone",
  "settings",
  "page",
  "staff",
  "customer",
  "review",
  "payment",
  "spend",
] as const;

/** Columns that hold tetri, so the log shows lari like everything else. */
const MONEY = new Set([
  "price",
  "oldPrice",
  "costPrice",
  "amountOff",
  "minOrderTotal",
  "fee",
  "freeAbove",
  "freeShippingThreshold",
  "shippingFee",
  "amount",
  "refunded",
]);

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Where a row's subject lives, when it still has a page. */
function hrefFor(entity: string, id: string): string | null {
  if (!id) return null;
  switch (entity) {
    case "product":
      return `/dashboard/products/${id}`;
    case "order":
      return `/dashboard/orders/${id}`;
    case "customer":
      return `/dashboard/customers/${id}`;
    case "return":
      return "/dashboard/returns?view=all";
    case "coupon":
      return "/dashboard/coupons";
    case "zone":
    case "settings":
      return "/dashboard/settings";
    case "page":
      return "/dashboard/pages";
    case "staff":
      return "/dashboard/staff";
    case "category":
      return "/dashboard/categories";
    case "review":
      return "/dashboard/reviews?view=all";
    default:
      return null;
  }
}

/** One side of a change, as a person reads it. */
function show(field: string, value: unknown, locale: "ka" | "en", t: Dictionary): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t.common.yes : t.common.no;
  if (typeof value === "number" && MONEY.has(field)) return formatPrice(value, locale);
  if (typeof value === "string" && field === "status" && value in t.status) {
    return t.status[value as keyof Dictionary["status"]];
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatDateTime(value);
  }
  return String(value);
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const entityRaw = one(params.entity);
  const entity = (ENTITIES as readonly string[]).includes(entityRaw) ? entityRaw : "";
  const pageRaw = Number(one(params.page));
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const where = entity ? { entity } : {};
  const total = await prisma.auditEntry.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const entries = await prisma.auditEntry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const filters = [
    { value: "", label: t.admin.auditFilterAll },
    ...ENTITIES.map((value) => ({ value, label: t.admin.auditEntity[value] })),
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader scale="panel" title={t.admin.audit} count={total} lead={t.admin.auditHint} />

      {/* Plain links, one per entity: the log is read far more than it is
          searched, and a row of links is a filter that works without a
          script and survives a reload. */}
      <nav aria-label={t.admin.auditWhat} className="mt-4 flex flex-wrap gap-1.5">
        {filters.map((filter) => {
          const active = filter.value === entity;
          return (
            <Link
              key={filter.value || "all"}
              href={filter.value ? `/dashboard/audit?entity=${filter.value}` : "/dashboard/audit"}
              aria-current={active ? "page" : undefined}
              className={`btn btn-sm ${active ? "btn-primary" : "btn-outline"}`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {entries.length === 0 ? (
        <EmptyState
          className="card mt-4"
          art={<EmptyOrdersArt size={88} />}
          title={t.admin.auditNone}
          text={t.admin.auditNoneHint}
          titleAs="p"
        />
      ) : (
        <>
          {/* Cards, not a table: a change is a sentence with a list under it,
              and a list does not sit in a cell. Newest first, because the
              question is nearly always "what just happened". */}
          <ol className="mt-4 flex flex-col gap-2">
            {entries.map((entry) => {
              const action = entry.action as AuditAction;
              const changes = (entry.changes ?? {}) as AuditChanges;
              const fields = Object.entries(changes);
              const href = hrefFor(entry.entity, entry.entityId);
              const entityLabel =
                t.admin.auditEntity[entry.entity as keyof typeof t.admin.auditEntity] ??
                entry.entity;

              return (
                <li key={entry.id} className="card card-pad-tight">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 text-sm text-ink-800">
                      <span className="font-semibold text-ink-900">{entry.actor}</span>{" "}
                      {t.admin.auditAction[action] ?? entry.action}
                      {entry.label && (
                        <>
                          {" — "}
                          {href ? (
                            <Link href={href} className="font-semibold text-brand-600 hover:underline">
                              {entry.label}
                            </Link>
                          ) : (
                            <span className="font-semibold">{entry.label}</span>
                          )}
                        </>
                      )}
                    </p>
                    <p className="shrink-0 text-xs text-ink-400 tabular-nums">
                      <span className="badge mr-2 bg-ink-100 text-ink-600">{entityLabel}</span>
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>

                  {fields.length > 0 && (
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
                      {fields.map(([field, [from, to]]) => (
                        <div key={field} className="contents">
                          <dt className="font-mono text-ink-500">{field}</dt>
                          <dd className="min-w-0 text-ink-700">
                            {from === null && to === null ? (
                              t.admin.auditFieldChanged
                            ) : (
                              <>
                                <span className="text-ink-400 line-through decoration-ink-300">
                                  {show(field, from, locale, t)}
                                </span>
                                <span className="mx-1.5 text-ink-400" aria-hidden="true">
                                  →
                                </span>
                                <span className="font-semibold text-ink-900">
                                  {show(field, to, locale, t)}
                                </span>
                              </>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ol>

          <AdminPagination
            basePath="/dashboard/audit"
            params={{ entity }}
            page={page}
            pageCount={pageCount}
            labels={{ previous: t.common.previous, next: t.common.next, page: t.common.page }}
          />
        </>
      )}
    </div>
  );
}
