import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton";

export default function CatalogLoading() {
  return (
    <div className="page-container py-6 lg:py-8">
      <div className="h-4 w-40 animate-pulse bg-ink-100" />
      <div className="mt-3 h-8 w-56 animate-pulse bg-ink-100" />

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="card h-[32rem] animate-pulse bg-ink-50" />
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-4 h-9 w-full animate-pulse bg-ink-100" />
          <ProductGridSkeleton />
        </section>
      </div>
    </div>
  );
}
