import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDateTime, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { PaymentPanel } from "@/components/admin/PaymentPanel";
import {
  ChevronLeftIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  TagIcon,
  UserIcon,
} from "@/components/ui/icons";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getI18n();

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      coupon: { select: { code: true } },
      events: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) notFound();

  /**
   * When this order reached the status it is in right now.
   *
   * Taken from the last event matching the current status, not from
   * `order.updatedAt`. `updatedAt` moves whenever *any* column changes, so
   * correcting a delivery address afterwards would have rewritten the moment
   * the order was confirmed — the page would have shown a time that was true
   * of nothing.
   *
   * Last rather than first, because a status can be revisited: an order sent
   * back from `shipped` to `confirmed` and shipped again should show the
   * second time, which is the one that is still true.
   */
  const currentStatusAt =
    order.events.filter((event) => event.status === order.status).at(-1)?.createdAt ?? null;

  const contact = [
    { icon: UserIcon, value: order.customerName },
    { icon: PhoneIcon, value: order.phone },
    ...(order.email ? [{ icon: MailIcon, value: order.email }] : []),
    { icon: MapPinIcon, value: `${order.city}, ${order.address}` },
  ];

  const payment = [
    { label: t.admin.paymentMethod, value: t.payment[order.paymentMethod] },
    { label: t.admin.paymentStatus, value: t.payment[order.paymentStatus] },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/dashboard/orders"
        className="mb-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-brand-600"
      >
        <ChevronLeftIcon size={14} />
        {t.admin.orders}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-extrabold tracking-tight text-ink-900">
            {order.number}
          </h1>
          <p className="mt-1 text-xs text-ink-400">
            {t.admin.placedAt}: {formatDateTime(order.createdAt)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status} t={t} />
            <OrderStatusSelect id={order.id} status={order.status} />
          </div>

          {/* When the order reached the status it is in now. Read from the
              event log rather than from `updatedAt`, which moves whenever any
              column changes — editing an address would have rewritten the
              moment the order was confirmed. */}
          {currentStatusAt && (
            <p className="text-xs text-ink-400">
              {t.admin.statusChangedAt}: {formatDateTime(currentStatusAt)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* ------------------------------- items ----------------------------- */}
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-bold text-ink-900">
            {t.admin.items}
          </h2>

          <ul className="divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control bg-ink-50">
                  <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="clamp-2-xs text-xs leading-snug font-medium text-ink-800">
                    {locale === "ka" ? item.nameKa : item.nameEn}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-400">{item.sku}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {item.quantity} × {formatPrice(item.price, locale)}
                  </p>
                </div>

                <p className="shrink-0 text-xs font-bold text-ink-900">
                  {formatPrice(item.price * item.quantity, locale)}
                </p>
              </li>
            ))}
          </ul>

          {/* The totals come from the columns snapshotted when the order was
              placed, so the invoice stays reproducible even after prices or
              the shipping rules change. */}
          <dl className="border-t border-line bg-ink-50 px-5 py-3.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">{t.admin.orderSubtotal}</dt>
              <dd className="font-semibold text-ink-800">
                {formatPrice(order.subtotal, locale)}
              </dd>
            </div>

            <div className="mt-1.5 flex items-center justify-between">
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
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <dt className="flex min-w-0 items-center gap-1.5 text-ink-500">
                  {t.admin.orderDiscount}
                  {order.coupon && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-accent-50 px-1.5 py-0.5 font-mono text-xs font-bold text-accent-800">
                      <TagIcon size={11} />
                      {order.coupon.code}
                    </span>
                  )}
                </dt>
                <dd className="shrink-0 font-semibold text-success">
                  −{formatPrice(order.discount, locale)}
                </dd>
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
              <dt className="text-sm font-bold text-ink-900">{t.cart.total}</dt>
              <dd className="text-base font-extrabold text-ink-900">
                {formatPrice(order.total, locale)}
              </dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col gap-4">
          {/* ----------------------------- customer -------------------------- */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.customer}</h2>

            <ul className="mt-3 flex flex-col gap-2.5">
              {contact.map((entry) => (
                <li key={entry.value} className="flex items-start gap-2.5 text-xs text-ink-700">
                  <entry.icon size={15} className="mt-0.5 shrink-0 text-ink-400" />
                  <span className="min-w-0 break-words">{entry.value}</span>
                </li>
              ))}
            </ul>

            {order.note && (
              <div className="mt-4 rounded-control bg-accent-50 p-3">
                <p className="text-xs font-bold text-accent-800">{t.checkout.note}</p>
                <p className="mt-1 text-xs leading-snug text-accent-900">{order.note}</p>
              </div>
            )}
          </section>

          {/* ----------------------------- payment --------------------------- */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.payment}</h2>

            <dl className="mt-3 flex flex-col gap-2.5">
              {payment.map((entry) => (
                <div key={entry.label} className="flex items-center justify-between gap-3 text-xs">
                  <dt className="text-ink-500">{entry.label}</dt>
                  <dd className="text-right font-semibold text-ink-800">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <PaymentPanel
            payments={order.payments.map((p) => ({
              id: p.id,
              provider: p.provider,
              state: p.state,
              amount: p.amount,
              refunded: p.refunded,
              createdAt: p.createdAt,
              capturedAt: p.capturedAt,
              failReason: p.failReason,
            }))}
          />

          {/* ----------------------------- timeline -------------------------- */}
          <section className="card p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.orderTimeline}</h2>

            <ol className="mt-3 flex flex-col">
              {order.events.map((event, index) => (
                <li key={event.id} className="flex gap-3">
                  {/* Dot + connecting rail; the last row has no rail below it. */}
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-pill ${
                        index === order.events.length - 1 ? "bg-brand-600" : "bg-ink-300"
                      }`}
                    />
                    {index < order.events.length - 1 && (
                      <span className="w-px flex-1 bg-line" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pb-4 last:pb-0">
                    <p className="text-xs font-semibold text-ink-800">{t.status[event.status]}</p>
                    <p className="mt-0.5 text-xs text-ink-400 tabular-nums">
                      {formatDateTime(event.createdAt)}
                    </p>
                    {/* Empty for the row the system wrote when the order was
                        placed; an address for every staff change after that. */}
                    {event.actor && (
                      <p className="truncate text-xs text-ink-400">{event.actor}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
