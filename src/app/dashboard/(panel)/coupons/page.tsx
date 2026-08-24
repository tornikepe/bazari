import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDate, formatPrice } from "@/lib/format";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { CouponManager } from "@/components/admin/CouponManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * Discount codes.
 *
 * The `Coupon` table, the validation and the checkout field have all worked
 * since the beginning; the only way to create one was Prisma Studio. This is
 * the page that was missing, and nothing about how a coupon is *applied*
 * lives here — `checkCoupon` remains the one place that decides.
 */
export default async function AdminCouponsPage() {
  const { locale, t } = await getI18n();

  const coupons = await prisma.coupon.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-4xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.coupons}
        count={coupons.length}
        lead={t.admin.couponsHint}
      />

      {coupons.length === 0 ? (
        <>
          <EmptyState
            className="card mt-4"
            art={<EmptyOrdersArt size={88} />}
            title={t.admin.couponNone}
            text={t.admin.couponNoneHint}
            titleAs="p"
          />
          <div className="mt-4">
            <CouponManager coupons={[]} />
          </div>
        </>
      ) : (
        <div className="mt-4">
          <CouponManager
            coupons={coupons.map((coupon) => ({
              id: coupon.id,
              code: coupon.code,
              percentOff: coupon.percentOff,
              amountOff: coupon.amountOff,
              amountLabel:
                coupon.amountOff !== null ? formatPrice(coupon.amountOff, locale) : null,
              minOrderTotal: coupon.minOrderTotal,
              minOrderLabel:
                coupon.minOrderTotal > 0 ? formatPrice(coupon.minOrderTotal, locale) : null,
              maxUses: coupon.maxUses,
              usedCount: coupon.usedCount,
              expiresAt: coupon.expiresAt ? formatDate(coupon.expiresAt) : null,
              expiresValue: coupon.expiresAt
                ? coupon.expiresAt.toISOString().slice(0, 10)
                : "",
              isActive: coupon.isActive,
            }))}
          />
        </div>
      )}
    </div>
  );
}
