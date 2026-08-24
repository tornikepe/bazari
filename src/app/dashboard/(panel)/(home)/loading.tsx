import { getI18n } from "@/lib/locale";
import { Block, LoadingShell, TableSkeleton } from "@/components/ui/Skeleton";

/**
 * The dashboard's own page, and only it.
 *
 * The `(home)` group exists for this file. A `loading.tsx` covers its folder
 * *and* everything under it, so one placed beside the panel layout would also
 * stand in for the tables, the settings form and `products/[id]` — and it was
 * written that way first, which broke two things at once. Saving anything in
 * the panel lost its "Saved" confirmation, and `notFound()` under a streamed
 * response returns the 404 page with a 200. The group scopes the skeleton to
 * the one page that is genuinely slow — six aggregates and a chart — and that
 * has neither a form nor a way to 404.
 */
export default async function DashboardHomeLoading() {
  const { t } = await getI18n();

  return (
    <LoadingShell label={t.common.loading} className="mx-auto max-w-6xl">
      <Block className="h-7 w-52" />
      <Block className="mt-2 h-4 w-72" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card card-pad-tight">
            <Block className="h-3 w-1/2" />
            <Block className="mt-3 h-7 w-2/3" />
          </div>
        ))}
      </div>

      {/* The chart, which is the slow part: it reads every order in the range. */}
      <div className="card mt-4 card-pad">
        <div className="flex items-center justify-between">
          <Block className="h-4 w-32" />
          <Block className="h-8 w-44" />
        </div>
        <Block className="mt-4 h-56 w-full" />
      </div>

      <div className="mt-4">
        <TableSkeleton rows={5} cols={["w-1/4", "w-1/3", "w-1/6", "w-1/12"]} />
      </div>
    </LoadingShell>
  );
}
