"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AlertIcon, PackageIcon, SearchIcon, SpinnerIcon } from "@/components/ui/icons";
import { formatDate, formatPrice } from "@/lib/format";
import { trackOrder, type TrackResult } from "@/app/actions/track";

export default function TrackOrderPage() {
  const { locale, t } = useI18n();
  const [isPending, startTransition] = useTransition();

  const [orderNumber, setOrderNumber] = useState("");
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
    <div className="page-container py-10 lg:py-14">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-pill bg-brand-50 text-brand-600">
            <PackageIcon size={26} />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{t.track.title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">{t.track.subtitle}</p>
        </div>

        {found ? (
          <div className="card p-6">
            <h2 className="text-sm font-bold text-ink-900">{t.track.resultTitle}</h2>

            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-bold text-ink-900">{found.number}</span>
              <StatusBadge status={found.status} t={t} />
            </div>

            <dl className="mt-4 flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">{t.track.placed}</dt>
                <dd className="font-semibold text-ink-800">{formatDate(found.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">{t.track.items}</dt>
                <dd className="font-semibold text-ink-800">{found.itemCount}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-2.5">
                <dt className="font-bold text-ink-900">{t.cart.total}</dt>
                <dd className="text-base font-extrabold text-ink-900">
                  {formatPrice(found.total, locale)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => {
                setResult(null);
                setOrderNumber("");
                setPhone("");
              }}
              className="btn btn-outline btn-md mt-5 w-full"
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

        <p className="mt-5 text-center text-sm text-ink-500">
          <Link href="/contact" className="font-semibold text-brand-600 hover:underline">
            {t.footer.contactUs}
          </Link>
        </p>
      </div>
    </div>
  );
}
