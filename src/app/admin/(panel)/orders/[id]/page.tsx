import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDateTime, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { ChevronLeftIcon, MailIcon, MapPinIcon, PhoneIcon, UserIcon } from "@/components/ui/icons";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getI18n();

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) notFound();

  const itemsTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = order.total - itemsTotal;

  const contact = [
    { icon: UserIcon, value: order.customerName },
    { icon: PhoneIcon, value: order.phone },
    ...(order.email ? [{ icon: MailIcon, value: order.email }] : []),
    { icon: MapPinIcon, value: `${order.city}, ${order.address}` },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/orders"
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
          <p className="mt-1 text-xs text-ink-400">{formatDateTime(order.createdAt)}</p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} t={t} />
          <OrderStatusSelect id={order.id} status={order.status} />
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
                  <p className="line-clamp-2 text-xs leading-snug font-medium text-ink-800">
                    {locale === "ka" ? item.nameKa : item.nameEn}
                  </p>
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

          <dl className="border-t border-line bg-ink-50 px-5 py-3.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">{t.cart.itemsTotal}</dt>
              <dd className="font-semibold text-ink-800">{formatPrice(itemsTotal, locale)}</dd>
            </div>

            <div className="mt-1.5 flex items-center justify-between">
              <dt className="text-ink-500">{t.cart.shipping}</dt>
              <dd className="font-semibold text-ink-800">
                {shipping <= 0 ? (
                  <span className="text-success">{t.cart.freeShipping}</span>
                ) : (
                  formatPrice(shipping, locale)
                )}
              </dd>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
              <dt className="text-sm font-bold text-ink-900">{t.cart.total}</dt>
              <dd className="text-base font-extrabold text-ink-900">
                {formatPrice(order.total, locale)}
              </dd>
            </div>
          </dl>
        </section>

        {/* ------------------------------ customer --------------------------- */}
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
      </div>
    </div>
  );
}
