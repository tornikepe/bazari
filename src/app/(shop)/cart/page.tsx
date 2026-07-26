"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { FREE_SHIPPING_THRESHOLD } from "@/components/providers/CartProvider";
import { Price } from "@/components/ui/Price";
import { CartIcon, MinusIcon, PlusIcon, TrashIcon, TruckIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";

export default function CartPage() {
  const { locale, t } = useI18n();
  const { items, hydrated, subtotal, shipping, total, setQuantity, remove, clear } = useCart();

  // The server can't know the cart, so render a stable skeleton until the
  // client has read localStorage.
  if (!hydrated) {
    return (
      <div className="page-container py-10">
        <div className="h-8 w-48 animate-pulse rounded-control bg-ink-100" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-28 animate-pulse rounded-card bg-ink-100" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-card bg-ink-100" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page-container py-16">
        <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-pill bg-ink-100 text-ink-400">
            <CartIcon size={30} />
          </span>
          <h1 className="text-lg font-bold text-ink-900">{t.cart.empty}</h1>
          <p className="text-sm text-ink-500">{t.cart.emptyHint}</p>
          <Link href="/catalog" className="btn btn-primary btn-md mt-2">
            {t.cart.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  const remaining = FREE_SHIPPING_THRESHOLD - subtotal;

  return (
    <div className="page-container py-6 lg:py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
        {t.cart.title}
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
        {/* ------------------------------- items ----------------------------- */}
        {/* `min-w-0`: grid children default to `min-width: auto`, which stops
            the rows below from shrinking and overflows narrow phones. */}
        <div className="flex min-w-0 flex-col gap-3">
          {items.map((item) => {
            const name = locale === "ka" ? item.nameKa : item.nameEn;
            const max = Math.max(1, item.stock);

            return (
              <article key={item.productId} className="card flex gap-3 p-3 sm:gap-4 sm:p-4">
                <Link
                  href={`/product/${item.slug}`}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-control bg-ink-50 sm:h-28 sm:w-28"
                >
                  <Image src={item.image} alt={name} fill sizes="112px" className="object-cover" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link
                    href={`/product/${item.slug}`}
                    className="line-clamp-2 text-sm leading-snug font-semibold text-ink-800 transition-colors hover:text-brand-600"
                  >
                    {name}
                  </Link>

                  <div className="mt-1">
                    <Price value={item.price} size="sm" />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                    <div className="flex items-center rounded-control border border-line">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        aria-label="-"
                        className="btn btn-ghost h-8 w-8 rounded-none rounded-l-control p-0"
                      >
                        <MinusIcon size={13} />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        min={1}
                        max={max}
                        onChange={(event) =>
                          setQuantity(item.productId, Number(event.target.value) || 1)
                        }
                        aria-label={t.cart.quantity}
                        className="h-8 w-11 border-x border-line bg-transparent text-center text-sm font-semibold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= max}
                        aria-label="+"
                        className="btn btn-ghost h-8 w-8 rounded-none rounded-r-control p-0"
                      >
                        <PlusIcon size={13} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <Price value={item.price * item.quantity} size="md" />
                      <button
                        type="button"
                        onClick={() => remove(item.productId)}
                        aria-label={t.cart.remove}
                        className="btn btn-ghost h-8 w-8 rounded-control p-0 text-ink-400 hover:text-danger"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Wraps rather than overflowing — both labels are long in Georgian. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/catalog" className="btn btn-ghost btn-sm">
              {t.cart.continueShopping}
            </Link>
            <button type="button" onClick={clear} className="btn btn-ghost btn-sm hover:text-danger">
              <TrashIcon size={15} />
              {t.cart.clear}
            </button>
          </div>
        </div>

        {/* ------------------------------ summary ---------------------------- */}
        <aside className="card sticky top-[var(--header-h)] p-5">
          <h2 className="text-base font-bold text-ink-900">{t.cart.summary}</h2>

          <dl className="mt-4 flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">{t.cart.itemsTotal}</dt>
              <dd className="font-semibold text-ink-800">{formatPrice(subtotal, locale)}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-ink-500">{t.cart.shipping}</dt>
              <dd className="font-semibold text-ink-800">
                {shipping === 0 ? (
                  <span className="text-success">{t.cart.freeShipping}</span>
                ) : (
                  formatPrice(shipping, locale)
                )}
              </dd>
            </div>

            <div className="my-1 h-px bg-line" />

            <div className="flex items-center justify-between">
              <dt className="text-base font-bold text-ink-900">{t.cart.total}</dt>
              <dd>
                <Price value={total} size="lg" />
              </dd>
            </div>
          </dl>

          {remaining > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-control bg-accent-50 p-3 text-xs leading-snug text-accent-800">
              <TruckIcon size={15} className="mt-px shrink-0" />
              <span>
                {fill(t.cart.freeShippingHint, { amount: formatPrice(remaining, locale) })}
              </span>
            </div>
          )}

          <Link href="/checkout" className="btn btn-primary btn-lg mt-5 w-full">
            {t.cart.checkout}
          </Link>
        </aside>
      </div>
    </div>
  );
}
