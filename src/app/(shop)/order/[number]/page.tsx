import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { getCurrentUser } from "@/lib/auth";
import { readReceipts } from "@/lib/order-access";
import { formatPrice } from "@/lib/format";
import { LineDetails } from "@/components/cart/LineDetails";
import { Price } from "@/components/ui/Price";
import {
  CheckIcon,
  ClockIcon,
  CloseIcon,
  FileIcon,
  MapPinIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { STATUS_STYLES } from "@/components/ui/StatusBadge";
import { OrderProgress } from "@/components/order/OrderProgress";
import { OrderBeacon } from "@/components/order/OrderBeacon";
import { orderHistory } from "@/lib/order-status";
import { getSettings } from "@/lib/settings";
import { InvoiceHead } from "@/components/order/InvoiceHead";
import { PrintButton } from "@/components/order/PrintButton";
import { TaxNote } from "@/components/ui/TaxNote";
import { ReturnPanel } from "@/components/order/ReturnPanel";
import { PayNowButton } from "@/components/order/PayNowButton";
import { gatewayFor } from "@/lib/payments";
import { gatewayContext } from "@/lib/payments/service";
import { Parcel } from "@/components/order/Parcel";
import { mayRequestReturn } from "@/lib/returns";
import { formatDate } from "@/lib/format";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const { locale, t } = await getI18n();

  const order = await prisma.order.findUnique({
    where: { number: decodeURIComponent(number) },
    include: {
      items: true,
      coupon: { select: { code: true } },
      // The timeline: when each status was reached, for the progress below.
      events: {
        select: { status: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      returns: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              orderItem: {
                select: { nameKa: true, nameEn: true, variantLabel: true },
              },
            },
          },
        },
      },
    },
  });

  if (!order) notFound();

  // The URL alone must not reveal a stranger's name, phone and address —
  // anyone else is sent to /track, which asks for the phone number.
  const [user, receipts, settings] = await Promise.all([
    getCurrentUser(),
    readReceipts(),
    getSettings(),
  ]);
  const mayView =
    user?.role === "admin" ||
    (order.userId !== null && order.userId === user?.id) ||
    receipts.includes(order.number);

  if (!mayView) redirect(`/track?number=${encodeURIComponent(order.number)}`);

  // Only the owner may ask for a return. An admin reading the page, or a
  // browser holding the receipt cookie, sees what was asked and not the form.
  const owner =
    user !== null && order.userId === user.id && user.role === "customer";

  /* A card order that is not paid, with somewhere to pay it: the attempt was
     declined, or the tab closed, or the gateway blinked. The order exists
     either way, and this is the way back to paying for it. Only the owner
     is offered it; only when a gateway is configured. */
  const gateway = gatewayFor(order.paymentMethod);
  const awaitingCard =
    owner &&
    gateway !== null &&
    order.paymentStatus === "unpaid" &&
    order.status !== "cancelled" &&
    (await gatewayContext(gateway)) !== null;
  const returnAllowed = owner
    ? mayRequestReturn(order, order.returns, settings.returnWindowDays)
    : ({ ok: false, reason: "off" } as const);

  const sticker = {
    pending: { icon: ClockIcon, className: "bg-warning-soft text-warning" },
    confirmed: { icon: CheckIcon, className: "bg-info-soft text-info" },
    shipped: { icon: TruckIcon, className: "bg-info-soft text-info" },
    delivered: { icon: CheckIcon, className: "bg-success-soft text-success" },
    cancelled: { icon: CloseIcon, className: "bg-danger-soft text-danger" },
  }[order.status];

  return (
    <div className="page">
      <div className="mx-auto max-w-2xl">
        {/* The owner following their order, counted for the funnel. Not a
            member of staff reading it — that is the shop looking at itself. */}
        {owner && (
          <OrderBeacon
            productIds={order.items.flatMap((item) => (item.productId ? [item.productId] : []))}
          />
        )}
        <InvoiceHead
          number={order.number}
          createdAt={order.createdAt}
          customer={{
            name: order.customerName,
            phone: order.phone,
            email: order.email,
            city: order.city,
            address: order.address,
          }}
        />

        <div className="card card-pad-notice flex flex-col items-center text-center">
          {/* The order as a thing, with its state stuck on its corner like a
              sticker: the parcel says what it is, the sticker where it has
              got to — a clock while it waits, a tick once confirmed, a truck
              on the way, a green tick delivered, a cross cancelled. Both are
              decoration; the heading below is the statement, and it says the
              same thing in words. */}
          <div className="relative -my-4">
            <Parcel />
            <span
              className={`absolute top-8 right-6 grid h-9 w-9 place-items-center rounded-pill ring-4 ring-surface ${sticker.className}`}
            >
              <sticker.icon size={18} strokeWidth={3} />
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink-900">
            {t.orderDone.byStatus[order.status].title}
          </h1>

          {/* Three facts as three tiles, each set in the middle of its
              own: where the order stands, its number, its sum. What the
              money is doing is not one of them — the shop is paid through
              a bank's gateway or by transfer, and "waiting for a
              transfer" is the timeline's business, not a headline. */}
          <dl className="order-facts">
            <div>
              <dt>{t.admin.status}</dt>
              <dd className={STATUS_STYLES[order.status]?.split(" ").pop() ?? "text-ink-700"}>
                <span aria-hidden="true" className="order-facts-dot" />
                {/* The word in a box of its own, so a long one — and
                    "დასამუშავებელი" is the longest — wraps inside the tile
                    instead of shouldering the dot onto a line above it. */}
                <span className="order-facts-word">{t.status[order.status]}</span>
              </dd>
            </div>
            <div>
              <dt>{t.orderDone.orderNumber}</dt>
              <dd className="font-mono text-ink-900">{order.number}</dd>
            </div>
            <div>
              <dt>{t.orderDone.total}</dt>
              <dd className="text-ink-900">{formatPrice(order.total, locale)}</dd>
            </div>
          </dl>

          {awaitingCard && (
            <div className="mt-6 w-full max-w-sm rounded-control border border-warning/40 bg-warning-soft p-4 text-center">
              <p className="text-sm font-bold text-warning">
                {t.orderDone.unpaidCard}
              </p>
              <p className="mt-1 text-xs text-ink-600">
                {t.orderDone.unpaidCardHint}
              </p>
              <div className="mt-3">
                <PayNowButton orderNumber={order.number} />
              </div>
            </div>
          )}

        </div>

        {/* Where it has got to, step by step, dated from its own history. */}
        <div className="card mt-4 card-pad">
          <OrderProgress status={order.status} history={orderHistory(order)} />
        </div>

        {/* items */}
        <div className="card mt-4 card-pad">
          <h2 className="display-sm text-center text-ink-900">{t.admin.items}</h2>

          {/* The same three columns as the checkout's summary, ruled: the
              picture, the name with its size and count under it, the
              line's sum at the right. */}
          {/* Every line of it, with the page doing the scrolling. The box
              used to stop at a fifth of the way down the fifth row and
              scroll inside itself, which on a nine-line order meant four
              of the things bought could not be seen at all — `max-h-none`
              was a utility set against a plain rule and never applied. */}
          <ul className="summary-lines is-open mt-5">
            {order.items.map((item) => (
              <li key={item.id}>
                <span className="summary-line-pic">
                  <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                </span>

                <span className="summary-line-body">
                  <span className="summary-line-name">
                    {locale === "ka" ? item.nameKa : item.nameEn}
                  </span>
                  <span className="summary-line-meta">
                    {item.variantLabel && <LineDetails label={item.variantLabel} />}
                    <span className="tabular-nums">
                      {item.quantity} × {formatPrice(item.price, locale)}
                    </span>
                  </span>
                </span>

                <span className="summary-line-sum">
                  {formatPrice(item.price * item.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>

          {/* Breakdown from the snapshotted columns, so a shopper can see
              exactly how the total was reached. */}
          <dl className="summary-totals mt-5 border-t border-line pt-5">
            <div>
              <dt>{t.cart.itemsTotal}</dt>
              <dd>{formatPrice(order.subtotal, locale)}</dd>
            </div>

            <div>
              <dt>{t.cart.shipping}</dt>
              <dd>
                {order.shipping <= 0 ? (
                  <span className="text-success">{t.cart.freeShipping}</span>
                ) : (
                  formatPrice(order.shipping, locale)
                )}
              </dd>
            </div>

            {order.discount > 0 && (
              <div>
                <dt className="flex min-w-0 items-center gap-1.5">
                  {t.cart.discount}
                  {order.coupon && (
                    <span className="shrink-0 rounded-pill bg-accent-50 px-1.5 py-0.5 font-mono text-xs font-bold text-accent-800">
                      {order.coupon.code}
                    </span>
                  )}
                </dt>
                <dd className="text-success">−{formatPrice(order.discount, locale)}</dd>
              </div>
            )}

            <div className="summary-total">
              <dt>{t.cart.total}</dt>
              <dd>
                <Price value={order.total} size="lg" />
              </dd>
            </div>
          </dl>

          {/* The figure and the rate as they were recorded, not today's. */}
          <TaxNote
            total={order.total}
            rate={order.taxRate}
            amount={order.tax}
            locale={locale}
            t={t}
            className="mt-1.5 text-center"
          />

          {/* Where it is going, or where it is waiting. The zone is the
              snapshotted name, so it reads the same however the shop's list
              changes later. */}
          {/* Where it is going, or where it is waiting, as a block of its
              own: the mark in a disc, the way it travels as the title, and
              each fact on a line of its own. The zone is the snapshotted
              name, so it reads the same however the shop's list changes
              later. */}
          <div className="order-delivery">
            <span className="order-delivery-mark">
              {order.deliveryMethod === "pickup" ? <MapPinIcon size={18} /> : <TruckIcon size={18} />}
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{t.checkout.delivery}</p>
              <p className="mt-1 text-sm font-bold text-ink-900">
                {order.deliveryMethod === "pickup"
                  ? `${t.checkout.deliveryPickup} · ${t.checkout.deliveryPickupFrom}`
                  : [t.checkout.deliveryCourier, locale === "ka" ? order.deliveryZoneKa : order.deliveryZoneEn]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
              <p className="mt-1.5 text-sm text-ink-700">
                {order.deliveryMethod === "pickup"
                  ? settings.pickupAddress || settings.contactAddress || settings.name
                  : `${order.city}, ${order.address}`}
              </p>
              <p className="mt-0.5 text-sm text-ink-500">
                {order.customerName} · {order.phone}
              </p>
            </div>
          </div>
        </div>

        <ReturnPanel
          orderNumber={order.number}
          windowDays={settings.returnWindowDays}
          allowed={returnAllowed}
          lines={order.items.map((item) => ({
            orderItemId: item.id,
            nameKa: item.nameKa,
            nameEn: item.nameEn,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
          }))}
          requests={order.returns.map((request) => ({
            id: request.id,
            status: request.status,
            reason: request.reason,
            note: request.note,
            staffNote: request.staffNote,
            createdAtLabel: formatDate(request.createdAt),
            items: request.items.map((line) => ({
              nameKa: line.orderItem.nameKa,
              nameEn: line.orderItem.nameEn,
              variantLabel: line.orderItem.variantLabel,
              quantity: line.quantity,
            })),
          }))}
        />

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {/* First, because a receipt is the thing most people want off this
              page and the rest is somewhere to go afterwards. */}
          <PrintButton size="md" />
          {/* The same document as a file: the route draws it from the
              order's own columns, so it is the receipt however it is kept. */}
          <a
            href={`/api/orders/${encodeURIComponent(order.number)}/invoice`}
            download={`${order.number}.pdf`}
            className="btn btn-outline btn-md"
          >
            <FileIcon size={15} />
            {t.orderDone.downloadPdf}
          </a>
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
