import { getI18n } from "@/lib/locale";
import { Block, LoadingShell } from "@/components/ui/Skeleton";

export default async function AccountLoading() {
  const { t } = await getI18n();

  return (
    <LoadingShell label={t.common.loading} className="page-container py-6 lg:py-8">
      <Block className="h-7 w-48" />

      {/* Four cards, the same four the page has — three counters and the
          wishlist link — so the row below them does not slide up. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="card flex items-center gap-3.5 p-4">
            <Block className="h-11 w-11 shrink-0 rounded-control" />
            <div className="min-w-0 flex-1">
              <Block className="h-3 w-1/2" />
              <Block className="mt-2 h-5 w-2/3" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <Block className="h-4 w-28" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: 4 }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <Block className="h-4 w-2/5" />
                  <Block className="mt-2 h-3 w-1/4" />
                </div>
                <Block className="h-6 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <Block className="h-4 w-24" />
          <Block className="mt-4 h-3.5 w-3/4" />
          <Block className="mt-2.5 h-3.5 w-2/3" />
          <Block className="mt-2.5 h-3.5 w-1/2" />
        </div>
      </div>
    </LoadingShell>
  );
}
