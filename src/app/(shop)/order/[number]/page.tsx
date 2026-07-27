import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { getCurrentUser } from "@/lib/auth";
import { readReceipts } from "@/lib/order-access";
import { formatPrice } from "@/lib/format";
import { Price } from "@/components/ui/Price";
import { CheckIcon, TruckIcon } from "@/components/ui/icons";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const { locale, t } = await getI18n();

  const order = await prisma.order.findUnique({
    where: { number: decodeURIComponent(number) },
    include: { items: true, coupon: { select: { code: true } } },
  });

  if (!order) notFound();

  // The URL alone must not reveal a stranger's name, phone and address —
  // anyone else is sent to /track, which asks for the phone number.
  const [user, receipts] = await Promise.all([getCurrentUser(), readReceipts()]);
  const mayView =
    user?.role === "admin" ||
    (order.userId !== null && order.userId === user?.id) ||
    receipts.includes(order.number);

  if (!mayView) redirect(`/track?number=${encodeURIComponent(order.number)}`);

  return (
    <div className="page-container py-10 lg:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="card flex flex-col items-center px-6 py-10 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-pill bg-success-soft text-success">
            <CheckIcon size={32} strokeWidth={3} />
          </span>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900">
            {t.orderDone.title}
          </h1>
          <p className="mt-2 max-w-md text-sm text-ink-500">{t.orderDone.subtitle}</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <div className="rounded-control border border-line bg-ink-50 px-4 py-2.5">
              <p className="text-xs text-ink-400">{t.orderDone.orderNumber}</p>
              <p className="font-mono text-base font-bold text-ink-900">{order.number}</p>
            </div>

            <div className="rounded-control border border-line bg-ink-50 px-4 py-2.5">
              <p className="text-xs text-ink-400">{t.orderDone.total}</p>
              <p className="text-base font-bold text-ink-900">
                {formatPrice(order.total, locale)}
              </p>
            </div>
          </div>
        </div>

        {/* items */}
        <div className="card mt-4 p-5">
          <h2 className="text-sm font-bold text-ink-900">{t.admin.items}</h2>

          <ul className="mt-3 flex flex-col gap-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-control bg-ink-50">
                  <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="clamp-2 text-sm leading-snug font-medium text-ink-800">
                    {locale === "ka" ? item.nameKa : item.nameEn}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {item.quantity} × {formatPrice(item.price, locale)}
                  </p>
                </div>

                <Price value={item.price * item.quantity} size="sm" />
              </li>
            ))}
          </ul>

          {/* Breakdown from the snapshotted columns, so a shopper can see
              exactly how the total was reached. */}
          <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">{t.cart.itemsTotal}</dt>
              <dd className="font-semibold text-ink-800">{formatPrice(order.subtotal, locale)}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-ink-500">{t.cart.shipping}</dt>
              <dd className="font-semibold text-ink-800">
                {order.shipping <= 0 ? (
                  <span className="text-success">{t.cart.freeShipping}</span>
                ) : (
                  formatPrice(order.shipping, locale)
                )}
              </dd>
            </div>

            {order.discount > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="flex min-w-0 items-center gap-1.5 text-ink-500">
                  {t.cart.discount}
                  {order.coupon && (
                    <span className="shrink-0 rounded-pill bg-accent-50 px-1.5 py-0.5 font-mono text-xs font-bold text-accent-800">
                      {order.coupon.code}
                    </span>
                  )}
                </dt>
                <dd className="shrink-0 font-semibold text-success">
                  −{formatPrice(order.discount, locale)}
                </dd>
              </div>
            )}

            <div className="mt-1 flex items-center justify-between border-t border-line pt-3">
              <dt className="text-base font-bold text-ink-900">{t.cart.total}</dt>
              <dd>
                <Price value={order.total} size="lg" />
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-start gap-2 rounded-control bg-ink-50 p-3 text-xs leading-snug text-ink-600">
            <TruckIcon size={15} className="mt-px shrink-0 text-brand-600" />
            <span>
              {order.customerName} · {order.phone} · {order.city}, {order.address}
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-outline btn-md">
            {t.orderDone.backHome}
          </Link>
          <Link href="/track" className="btn btn-outline btn-md">
            {t.orderDone.trackHint}
          </Link>
          <Link href="/catalog" className="btn btn-primary btn-md">
            {t.cart.continueShopping}
          </Link>
        </div>
      </div>
    </div>
  );
}
