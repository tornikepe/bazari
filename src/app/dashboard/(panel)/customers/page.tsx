import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDate, formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import type { Prisma } from "@/generated/prisma/client";
import type { RawSearchParams } from "@/lib/filters";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyPeopleArt, NoResultsArt } from "@/components/ui/illustrations";
import { PageHeader } from "@/components/layout/PageHeader";
import { Figures } from "@/components/ui/Figures";
import { BulkCustomers } from "@/components/admin/BulkCustomers";
import { WriteOnly } from "@/components/admin/StaffRoleProvider";
import { SavedViews } from "@/components/admin/SavedViews";
import { getSavedViews } from "@/lib/saved-views-store";

const PAGE_SIZE = 20;
const ROLES = ["customer", "admin", "viewer"] as const;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Who has an account, and what they are worth.
 *
 * Every figure on this page is counted from the database at request time —
 * order counts and lifetime spend are aggregated per user rather than stored
 * on the row, so they cannot drift away from the orders they describe.
 *
 * Lifetime spend deliberately excludes cancelled orders. A cancelled order is
 * money that never arrived, and counting it would flatter every customer who
 * ever changed their mind.
 */
const SORTS = ["newest", "name", "orders-desc"] as const;

/**
 * Sorting by *lifetime spend* is deliberately not offered.
 *
 * Spend is aggregated per page with one grouped query, not stored on the user
 * row, so the database cannot order by it without summing every order for
 * every customer first. Offering the control and then sorting only the twenty
 * rows already fetched would look like it worked and be wrong on page two —
 * the worst of the three options.
 */
function buildOrderBy(sort: string): Prisma.UserOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: "asc" }, { id: "asc" }];
    case "orders-desc":
      return [{ orders: { _count: "desc" } }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const query = one(params.q);
  const sortRaw = one(params.sort);
  const sort = (SORTS as readonly string[]).includes(sortRaw) ? sortRaw : "newest";
  const roleRaw = one(params.role);
  const role = (ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as (typeof ROLES)[number])
    : null;
  const pageRaw = Number(one(params.page));
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const and: Prisma.UserWhereInput[] = [];
  if (role) and.push({ role });
  if (query) {
    const contains = { contains: query, mode: "insensitive" } as const;
    and.push({ OR: [{ name: contains }, { email: contains }, { phone: contains }, { city: contains }] });
  }
  const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [total, allCount, newThisMonth, withOrders] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { orders: { some: {} } } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const users = await prisma.user.findMany({
    where,
    orderBy: buildOrderBy(sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      role: true,
      emailVerified: true,
      disabledAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  // One grouped query for the whole page rather than a spend query per row.
  const spend = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((user) => user.id) }, status: { not: "cancelled" } },
    _sum: { total: true },
    _max: { createdAt: true },
  });
  const spendByUser = new Map(
    spend.map((row) => [row.userId, { total: row._sum.total ?? 0, last: row._max.createdAt }]),
  );

  const stats = [
    { label: t.admin.totalCustomers, value: allCount },
    { label: t.admin.newThisMonth, value: newThisMonth },
    { label: t.admin.withOrders, value: withOrders },
  ];

  const views = await getSavedViews("customers");

  return (
    <div className="mx-auto max-w-6xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.customers}
        count={allCount}
        lead={t.admin.customersHint}
      />

      <Figures className="mt-5" items={stats} columns={3} />

      <div className="mt-4">
        <SavedViews className="mb-3" page="customers" views={views} />

        <AdminToolbar
          basePath="/dashboard/customers"
          search={query}
          searchPlaceholder={t.admin.searchCustomers}
          filters={[
            {
              name: "role",
              label: t.admin.role,
              value: role ?? "",
              options: [
                { value: "", label: t.admin.all },
                { value: "customer", label: t.admin.roleCustomer },
                { value: "admin", label: t.admin.roleAdmin },
                { value: "viewer", label: t.admin.roleViewer },
              ],
            },
            {
              name: "sort",
              label: t.admin.sortBy,
              value: sort === "newest" ? "" : sort,
              options: [
                { value: "", label: t.admin.sortNewest },
                { value: "name", label: t.admin.sortName },
                { value: "orders-desc", label: t.admin.sortOrdersDesc },
              ],
            },
          ]}
          hasActive={Boolean(query || role || sort !== "newest")}
        />
      </div>

      {users.length === 0 ? (
        <EmptyState
          className="card mt-4"
          art={query || role ? <NoResultsArt size={88} /> : <EmptyPeopleArt size={88} />}
          title={query || role ? t.admin.noMatches : t.admin.noCustomers}
          text={query || role ? t.admin.noMatchesHint : t.admin.noCustomersHint}
          titleAs="p"
          action={
            (query || role) && (
              <Link href="/dashboard/customers" className="btn btn-outline btn-md">
                {t.admin.resetFilters}
              </Link>
            )
          }
        />
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-400">
            {fill(t.admin.showingCount, {
              from: (page - 1) * PAGE_SIZE + 1,
              to: (page - 1) * PAGE_SIZE + users.length,
              total,
            })}
          </p>

          <BulkCustomers
            ids={users.filter((user) => user.role === "customer").map((user) => user.id)}
          >
          {/* Cards below lg — six columns do not fit a phone. */}
          <ul className="mt-3 flex flex-col gap-2 lg:hidden">
            {users.map((user) => {
              const money = spendByUser.get(user.id);
              return (
                <li key={user.id} className="card card-pad-tight">
                  <div className="flex items-start justify-between gap-3">
                    {user.role === "customer" && (
                      <WriteOnly>
                        <label className="flex shrink-0 items-start pt-0.5">
                          <span className="sr-only">
                            {fill(t.admin.bulkSelectRow, { name: user.name || user.email })}
                          </span>
                          <input
                            type="checkbox"
                            name="customer-id"
                            value={user.id}
                            className="h-4 w-4 accent-brand-600"
                          />
                        </label>
                      </WriteOnly>
                    )}

                  {/* `min-w-0`: a flex child defaults to `min-width: auto`, so without
                        it the two truncating lines below refuse to shrink and the
                        card runs 162px off a 320px screen. */}
                  <Link href={`/dashboard/customers/${user.id}`} className="block min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-900">
                          {user.name || user.email}
                        </p>
                        <p className="truncate text-xs text-ink-500">{user.email}</p>
                      </div>
                      <RoleBadge role={user.role} t={t} />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                      <span className="text-ink-500">
                        {user._count.orders} {t.admin.customerOrders}
                        {user.disabledAt && ` · ${t.admin.customerDisabled}`}
                      </span>
                      <span className="font-bold text-ink-900">
                        {formatPrice(money?.total ?? 0, locale)}
                      </span>
                    </div>
                  </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="card mt-3 hidden overflow-hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  {/* No header checkbox: select-all lives above the table so it
                      exists at every width. */}
                  <WriteOnly>
                    <th className="w-10">
                      <span className="sr-only">{t.admin.bulkSelectAll}</span>
                    </th>
                  </WriteOnly>
                  <th>{t.admin.customer}</th>
                  <th>{t.admin.contactDetails}</th>
                  <th>{t.admin.role}</th>
                  <th>{t.admin.customerSince}</th>
                  <th className="figures">{t.admin.customerOrders}</th>
                  <th className="figures">{t.admin.customerSpend}</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => {
                  const money = spendByUser.get(user.id);
                  return (
                    <tr key={user.id}>
                      {/* Staff have no box: their account is managed on the
                          staff page, which knows about the last-admin rule.
                          The cell stays so the columns still line up. */}
                      <WriteOnly>
                        <td>
                          {user.role === "customer" && (
                            <label className="flex items-center">
                              <span className="sr-only">
                                {fill(t.admin.bulkSelectRow, { name: user.name || user.email })}
                              </span>
                              <input
                                type="checkbox"
                                name="customer-id"
                                value={user.id}
                                className="h-4 w-4 accent-brand-600"
                              />
                            </label>
                          )}
                        </td>
                      </WriteOnly>

                      <td>
                        <Link
                          href={`/dashboard/customers/${user.id}`}
                          className="text-sm font-semibold text-ink-900 hover:text-brand-600"
                        >
                          {user.name || "—"}
                        </Link>
                        <p className="text-xs text-ink-400">
                          {user.disabledAt
                            ? t.admin.customerDisabled
                            : user.emailVerified
                              ? t.admin.verified
                              : t.admin.unverified}
                        </p>
                      </td>

                      <td>
                        <p className="text-xs text-ink-600">{user.email}</p>
                        <p className="text-xs text-ink-400">
                          {[user.phone, user.city].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>

                      <td>
                        <RoleBadge role={user.role} t={t} />
                      </td>

                      <td className="text-xs text-ink-500">
                        {formatDate(user.createdAt)}
                      </td>

                      <td className="figures text-sm text-ink-800">
                        {user._count.orders}
                      </td>

                      <td className="figures text-sm font-bold text-ink-900">
                        {formatPrice(money?.total ?? 0, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </BulkCustomers>

          <AdminPagination
            basePath="/dashboard/customers"
            params={{ q: query, role: role ?? "" }}
            page={page}
            pageCount={pageCount}
            labels={{ previous: t.common.previous, next: t.common.next, page: t.common.page }}
          />
        </>
      )}
    </div>
  );
}
