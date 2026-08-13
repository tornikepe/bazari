import { getI18n } from "@/lib/locale";
import { Block, Lines, LoadingShell } from "@/components/ui/Skeleton";

/**
 * The product page is the slowest in the shop — it fetches the product, its
 * category and four related items — and it was also the one that jumped most,
 * because the image is a square that arrives after the text around it.
 */
export default async function ProductLoading() {
  const { t } = await getI18n();

  return (
    <LoadingShell label={t.common.loading} className="page-container py-6 lg:py-8">
      <Block className="mb-4 h-3.5 w-64" />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* The same square the photo lands in, so nothing moves when it does. */}
        <div className="card aspect-square lg:self-start">
          <div className="skeleton h-full w-full" />
        </div>

        <div>
          <Block className="h-3 w-24" />
          <Block className="mt-2 h-7 w-4/5" />
          <Block className="mt-5 h-8 w-32" />
          <Block className="mt-3 h-6 w-28" />

          <Lines className="mt-5" count={3} />

          <Block className="mt-6 h-11 w-full" />

          <div className="mt-6 flex flex-col gap-2.5 rounded-card border border-line p-4">
            <Block className="h-3 w-3/5" />
            <Block className="h-3 w-2/5" />
            <Block className="h-3 w-1/2" />
          </div>
        </div>
      </div>
    </LoadingShell>
  );
}
