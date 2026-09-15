import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDateTime } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { ReviewsManager } from "@/components/admin/ReviewsManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";
import { PageHeader } from "@/components/layout/PageHeader";
import type { RawSearchParams } from "@/lib/filters";

/**
 * What customers wrote, newest first, and the one thing the shop may do
 * about each: hide it, or show it again.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  const hiddenOnly = view === "hidden";

  const reviews = await prisma.review.findMany({
    where: hiddenOnly ? { isPublished: false } : {},
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      user: { select: { name: true, email: true } },
      product: { select: { id: true, slug: true, nameKa: true, nameEn: true } },
      order: { select: { number: true } },
      photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const filters = [
    { key: "all", label: t.admin.reviewFilterAll, href: "/dashboard/reviews?view=all", active: !hiddenOnly },
    { key: "hidden", label: t.admin.reviewFilterHidden, href: "/dashboard/reviews?view=hidden", active: hiddenOnly },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.reviews}
        count={reviews.length}
        lead={t.admin.reviewsHint}
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

      {reviews.length === 0 ? (
        <EmptyState
          className="card mt-4"
          art={<EmptyOrdersArt size={88} />}
          title={t.admin.reviewsNone}
          text={t.admin.reviewsNoneHint}
          titleAs="p"
        />
      ) : (
        <div className="mt-4">
          <ReviewsManager
            reviews={reviews.map((review) => ({
              id: review.id,
              rating: review.rating,
              photos: review.photos.map((photo) => ({
                id: photo.id,
                url: `/api/reviews/photos/${photo.id}`,
              })),
              title: review.title,
              body: review.body,
              isPublished: review.isPublished,
              createdAtLabel: formatDateTime(review.createdAt),
              customer: review.user.name || review.user.email,
              product: {
                id: review.product.id,
                slug: review.product.slug,
                name: locale === "ka" ? review.product.nameKa : review.product.nameEn,
              },
              orderNumber: review.order.number,
            }))}
          />
        </div>
      )}
    </div>
  );
}
