/**
 * Wipes everything the shop has *traded*, and keeps everything it *is*.
 *
 * Gone: orders and all that hangs off them (lines, events, payments,
 * returns), reviews and their pictures, every customer account with its
 * addresses, wishlist, cart and tokens, the stock ledger, the traffic and
 * funnel counts, the marketing spend, the audit trail, rate-limit and
 * chat-usage rows. Kept: the catalogue (categories, products, options,
 * variants, photos, stock levels), delivery zones, coupons (with their use
 * counts back at zero), staff accounts, the shop's settings, the payment
 * gateways and the info pages.
 *
 * The one moment for it is the day a shop opens for real after months of
 * sample data. Refuses to run without `--yes`, prints what it is about to
 * delete first, and expects a backup to have been taken — run
 * `npm run db:backup` before it; `npm run db:restore` puts it all back.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function counts() {
  const [orders, customers, reviews, movements, views, events, spend, audit] = await Promise.all([
    prisma.order.count(),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.review.count(),
    prisma.stockMovement.count(),
    prisma.pageView.count(),
    prisma.productEvent.count(),
    prisma.marketingSpend.count(),
    prisma.auditEntry.count(),
  ]);
  return { orders, customers, reviews, movements, views, events, spend, audit };
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This deletes every order, customer and count in the database it points at.");
    console.error("Take a backup (npm run db:backup), then run it again with --yes.");
    process.exit(1);
  }

  console.log("before:", await counts());

  await prisma.$transaction(
    [
      // Orders first: payments, lines, events and returns go with them.
      prisma.order.deleteMany(),
      prisma.review.deleteMany(),
      prisma.stockMovement.deleteMany(),
      prisma.stockAlert.deleteMany(),
      prisma.cartSnapshot.deleteMany(),
      prisma.favorite.deleteMany(),
      prisma.address.deleteMany(),
      prisma.verificationToken.deleteMany(),
      prisma.rateLimit.deleteMany(),
      prisma.chatUsage.deleteMany(),
      prisma.pageView.deleteMany(),
      prisma.dailyVisitor.deleteMany(),
      prisma.productEvent.deleteMany(),
      prisma.marketingSpend.deleteMany(),
      prisma.auditEntry.deleteMany(),
      // Then the customers themselves; staff stay.
      prisma.user.deleteMany({ where: { role: "customer" } }),
      // Figures that were counted from what is now gone.
      prisma.coupon.updateMany({ data: { usedCount: 0 } }),
      prisma.product.updateMany({ data: { ratingSum: 0, ratingCount: 0 } }),
    ],
    { timeout: 60_000 },
  );

  console.log("after: ", await counts());
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
