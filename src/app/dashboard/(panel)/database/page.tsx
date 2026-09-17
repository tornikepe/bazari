import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { PageHeader } from "@/components/layout/PageHeader";
import { DatabaseIcon, ArrowRightIcon } from "@/components/ui/icons";

/**
 * The database, as the owner can see it from here: what it is, where it
 * is, how many rows each table holds, and the way to the provider's own
 * console — the one place with backups, point-in-time restore and the
 * tables themselves. The console's address comes from the environment
 * (`DATABASE_CONSOLE_URL`) or is guessed from the host: Neon's for a Neon
 * database, Prisma's for a Prisma Postgres one.
 *
 * Nothing here can change anything; it is a window, and the button is a
 * door.
 */
export default async function DatabasePage() {
  const { locale, t } = await getI18n();

  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = "";
  }
  const provider = host.endsWith("neon.tech")
    ? "Neon"
    : host.endsWith("prisma.io")
      ? "Prisma Postgres"
      : host
        ? "PostgreSQL"
        : "";
  const consoleUrl =
    process.env.DATABASE_CONSOLE_URL ||
    (host.endsWith("neon.tech")
      ? "https://console.neon.tech/"
      : host.endsWith("prisma.io")
        ? "https://console.prisma.io/"
        : "");

  // Counted in one round of queries, every table the shop writes to.
  const tables: { name: string; count: Promise<number> }[] = [
    { name: "Product", count: prisma.product.count() },
    { name: "Category", count: prisma.category.count() },
    { name: "ProductImage", count: prisma.productImage.count() },
    { name: "Order", count: prisma.order.count() },
    { name: "OrderItem", count: prisma.orderItem.count() },
    { name: "Payment", count: prisma.payment.count() },
    { name: "ReturnRequest", count: prisma.returnRequest.count() },
    { name: "User", count: prisma.user.count() },
    { name: "Address", count: prisma.address.count() },
    { name: "Review", count: prisma.review.count() },
    { name: "Favorite", count: prisma.favorite.count() },
    { name: "Coupon", count: prisma.coupon.count() },
    { name: "DeliveryZone", count: prisma.deliveryZone.count() },
    { name: "StockMovement", count: prisma.stockMovement.count() },
    { name: "PageView", count: prisma.pageView.count() },
    { name: "ProductEvent", count: prisma.productEvent.count() },
    { name: "AuditEntry", count: prisma.auditEntry.count() },
    { name: "InfoPage", count: prisma.infoPage.count() },
  ];
  const counts = await Promise.all(tables.map((table) => table.count));
  const number = new Intl.NumberFormat(locale === "ka" ? "ka-GE" : "en-GB");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader scale="panel" title={t.admin.database} lead={t.admin.databaseHint} />

      {/* ------------------------------ where ------------------------------ */}
      <section className="card mt-4 flex flex-wrap items-center gap-4 card-pad">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-600">
          <DatabaseIcon size={22} />
        </span>
        <dl className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ink-500">{t.admin.databaseProvider}</dt>
          <dd className="font-semibold text-ink-900">{provider || "—"}</dd>
          <dt className="text-ink-500">{t.admin.databaseHost}</dt>
          <dd className="truncate font-mono text-xs text-ink-700">{host || "—"}</dd>
        </dl>
        {consoleUrl ? (
          <a
            href={consoleUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-primary btn-md w-full sm:w-auto"
          >
            {t.admin.databaseOpen}
            <ArrowRightIcon size={16} />
          </a>
        ) : (
          <p className="w-full text-xs text-ink-500">{t.admin.databaseNoConsole}</p>
        )}
        {consoleUrl && (
          <p className="w-full text-xs leading-relaxed text-ink-400">{t.admin.databaseOpenHint}</p>
        )}
      </section>

      {/* ------------------------------ tables ----------------------------- */}
      <section className="card mt-4 overflow-hidden">
        <h2 className="card-head text-sm font-bold text-ink-900">{t.admin.databaseTables}</h2>
        <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
          {tables.map((table, index) => (
            <li
              key={table.name}
              className="flex items-center justify-between gap-3 px-5 py-2.5 sm:border-b sm:border-line sm:odd:border-r"
            >
              <span className="font-mono text-xs text-ink-700">{table.name}</span>
              <span className="text-sm font-bold text-ink-900 tabular-nums">
                {number.format(counts[index]!)}{" "}
                <span className="text-xs font-normal text-ink-400">{t.admin.databaseRows}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------ backup ----------------------------- */}
      <section className="card mt-4 card-pad">
        <h2 className="text-sm font-bold text-ink-900">{t.admin.databaseBackup}</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">{t.admin.databaseBackupHint}</p>
      </section>
    </div>
  );
}
