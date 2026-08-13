import { getI18n } from "@/lib/locale";
import { Block, LoadingShell, TableSkeleton } from "@/components/ui/Skeleton";

/**
 * One file for the whole panel.
 *
 * Products, orders, customers and categories are the same page with different
 * columns — a title, a toolbar, a table — so they get the same standing-in
 * shape rather than four near-identical files that would drift apart. The
 * dashboard's own charts are the exception and are worth their own later; a
 * table is closer to them than a blank screen is.
 *
 * It also covers `products/[id]`, which can call `notFound()` — and a loading
 * boundary above a `notFound()` streams the response, so the 404 page arrives
 * under a 200. That is why the storefront's product and order pages
 * deliberately have no skeleton (see `storefront.spec.ts`). Here it is a fair
 * trade: the panel is behind a sign-in and marked `noindex`, so the status
 * code is read by nobody, while the tables are the slowest pages in the site.
 */
export default async function DashboardLoading() {
  const { t } = await getI18n();

  return (
    <LoadingShell label={t.common.loading} className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Block className="h-7 w-44" />
        <Block className="h-9 w-32" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Block className="h-9 w-64" />
        <Block className="h-9 w-32" />
      </div>

      <div className="mt-4">
        <TableSkeleton rows={8} />
      </div>
    </LoadingShell>
  );
}
