import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatPrice } from "@/lib/format";
import { Price } from "@/components/ui/Price";
import { CheckIcon, TruckIcon } from "@/components/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.orderDone.orderNumber };
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const { locale, t } = await getI18n();

  const order = await prisma.order.findUnique({
    where: { number: decodeURIComponent(number) },
    include: { items: true },
  });

  if (!order) notFound();

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
                  <p className="line-clamp-2 text-sm leading-snug font-medium text-ink-800">
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
