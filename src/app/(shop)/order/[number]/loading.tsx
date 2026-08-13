import { getI18n } from "@/lib/locale";
import { Block, LoadingShell } from "@/components/ui/Skeleton";

/** The page a shopper stares at straight after paying, so it should not be blank. */
export default async function OrderLoading() {
  const { t } = await getI18n();

  return (
    <LoadingShell label={t.common.loading} className="page-container py-10 lg:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="card flex flex-col items-center px-6 py-10 text-center">
          <Block className="h-16 w-16 rounded-pill" />
          <Block className="mt-4 h-7 w-56" />
          <Block className="mt-3 h-4 w-72" />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Block className="h-16 w-40 rounded-control" />
            <Block className="h-16 w-40 rounded-control" />
          </div>
        </div>

        <div className="card mt-4 divide-y divide-line">
          {Array.from({ length: 3 }, (_, row) => (
            <div key={row} className="flex items-center gap-3 p-4">
              <Block className="h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <Block className="h-4 w-3/5" />
                <Block className="mt-2 h-3 w-1/4" />
              </div>
              <Block className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </LoadingShell>
  );
}
