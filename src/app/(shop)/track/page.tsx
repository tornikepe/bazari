"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AlertIcon, SearchIcon, SpinnerIcon } from "@/components/ui/icons";
import Image from "next/image";
import { formatDate, formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { OrderProgress } from "@/components/order/OrderProgress";
import { PageHeader } from "@/components/layout/PageHeader";
import { trackOrder, type TrackResult } from "@/app/actions/track";

function TrackOrderForm() {
  const { locale, t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const params = useSearchParams();

  // Someone who opened a confirmation link they can't prove is theirs is sent
  // here with the number already filled in — they just add the phone number.
  const [orderNumber, setOrderNumber] = useState(params.get("number") ?? "");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setResult(await trackOrder(orderNumber, phone));
    });
  }

  const found = result?.ok ? result : null;
  const errorKey = result && !result.ok ? result.error : null;

  return (
    <div className="page">
      <div className="mx-auto max-w-lg">
        {/* The chip with a parcel in it used to sit above a centred title.
            It was the only page that introduced itself that way, and the icon
            said nothing the word "track" did not. */}
        <PageHeader className="mb-6" title={t.track.title} lead={t.track.subtitle} />

        {found ? (
          <div className="flex flex-col gap-4">
            {/* ------------------------------ header ------------------------ */}
            <div className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="min-w-0">
                  <h2 className="text-xs font-bold tracking-wider text-ink-400 uppercase">
                    {t.track.resultTitle}
                  </h2>
                  <p className="mt-0.5 font-mono text-lg font-bold break-all text-ink-900">
                    {found.number}
                  </p>
                </div>
                <StatusBadge status={found.status} t={t} />
              </div>

              <p className="mt-3 text-xs text-ink-400">
                {t.track.placed}: {formatDate(found.createdAt)}
              </p>

              <div className="mt-5 border-t border-line pt-5">
                <OrderProgress status={found.status} history={found.history} />
              </div>
            </div>

            {/* ------------------------------- items ------------------------ */}
            <div className="card p-5 sm:p-6">
              <h3 className="text-sm font-bold text-ink-900">{t.track.itemsTitle}</h3>

              <ul className="mt-3 divide-y divide-line">
                {found.items.map((item, index) => (
                  <li key={index} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden border border-line bg-ink-50">
                      <Image src={item.image} alt="" fill sizes="44px" className="object-cover" />
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink-800">{item.name}</span>
                    <span className="shrink-0 text-xs text-ink-400">
                      {fill(t.track.quantity, { count: item.quantity })}
                    </span>
                    <span className="w-20 shrink-0 text-right text-sm font-semibold text-ink-900">
                      {formatPrice(item.price * item.quantity, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ------------------------------ payment ----------------------- */}
            <div className="card p-5 sm:p-6">
              <h3 className="text-sm font-bold text-ink-900">{t.track.paymentTitle}</h3>

              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-500">{t.track.subtotal}</dt>
                  <dd className="font-semibold text-ink-800">
                    {formatPrice(found.subtotal, locale)}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-500">{t.track.shipping}</dt>
                  <dd className="font-semibold text-ink-800">
                    {found.shipping === 0 ? t.track.free : formatPrice(found.shipping, locale)}
                  </dd>
                </div>

                {/* Only when there was one — a row of zero is noise. */}
                {found.discount > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-ink-500">{t.track.discount}</dt>
                    <dd className="font-semibold text-success">
                      −{formatPrice(found.discount, locale)}
                    </dd>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4 border-t border-line pt-2">
                  <dt className="font-bold text-ink-900">{t.cart.total}</dt>
                  <dd className="text-base font-extrabold text-ink-900">
                    {formatPrice(found.total, locale)}
                  </dd>
                </div>

                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                  <dt className="text-ink-500">{t.admin.paymentMethod}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-800">
                      {t.payment[found.paymentMethod as keyof typeof t.payment]}
                    </span>
                    <span
                      className={`badge ${
                        found.paymentStatus === "paid"
                          ? "bg-success-soft text-success"
                          : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {t.payment[found.paymentStatus as keyof typeof t.payment]}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <button
              type="button"
              onClick={() => {
                setResult(null);
                setOrderNumber("");
                setPhone("");
              }}
              className="btn btn-outline btn-md w-full"
            >
              {t.track.searchAgain}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6">
            <div className="flex flex-col gap-4">
              <div>
                <label className="field-label" htmlFor="orderNumber">
                  {t.track.orderNumber}
                </label>
                <input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  placeholder={t.track.orderNumberPlaceholder}
                  className="field font-mono"
                  required
                />
              </div>

              <div>
                <label className="field-label" htmlFor="phone">
                  {t.track.phone}
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+995 5XX XX XX XX"
                  className="field"
                  required
                />
              </div>

              {errorKey && (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-control bg-danger-soft p-3 text-xs text-danger"
                >
                  <AlertIcon size={15} className="shrink-0" />
                  {errorKey === "invalid" ? t.track.invalid : t.track.notFound}
                </p>
              )}

              <button type="submit" disabled={isPending} className="btn btn-primary btn-md w-full">
                {isPending ? <SpinnerIcon size={16} /> : <SearchIcon size={16} />}
                {isPending ? t.track.searching : t.track.submit}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-500">
          {t.track.help}{" "}
          <Link href="/contact" className="font-semibold text-brand-600 hover:underline">
            {t.footer.contactUs}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function TrackOrderPage() {
  // `useSearchParams` needs a Suspense boundary so it can't block the static
  // shell from rendering.
  return (
    <Suspense fallback={<div className="page" />}>
      <TrackOrderForm />
    </Suspense>
  );
}
