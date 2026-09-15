"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { lineKey } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { CartIcon, CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";

/** How many lines the panel shows before it says "and N more". */
const SHOWN = 4;

/**
 * The cart, under the cart icon.
 *
 * Enough to act on without leaving the page: the first few lines with their
 * pictures, a stepper and a way to take a line out, the subtotal, and the
 * two places to go next. Everything here is the same store the cart page
 * reads, so a change made here is already made there.
 */
export function MiniCart() {
  const { t, locale } = useI18n();
  const { items, count, subtotal, setQuantity, remove } = useCart();

  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-pill bg-ink-100 text-ink-400">
          <CartIcon size={22} />
        </span>
        <p className="mt-3 text-sm font-bold text-ink-900">{t.cart.empty}</p>
        <p className="mt-1 text-xs text-ink-500">{t.cart.emptyHint}</p>
        <Link href="/catalog" className="btn btn-outline btn-sm mt-4">
          {t.cart.continueShopping}
        </Link>
      </div>
    );
  }

  const shown = items.slice(0, SHOWN);
  const more = items.length - shown.length;

  return (
    <>
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-bold text-ink-900">{t.nav.cart}</p>
        <p className="text-xs text-ink-500 tabular-nums">
          {fill(t.favorites.count, { count })}
        </p>
      </div>

      <ul className="divide-y divide-line">
        {shown.map((item) => {
          const key = lineKey(item);
          const name = locale === "ka" ? item.nameKa : item.nameEn;
          const max = Math.max(1, item.stock);

          return (
            <li key={key} className="flex gap-3 px-4 py-3">
              <Link
                href={`/product/${item.slug}`}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-control border border-line bg-ink-50"
              >
                <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.slug}`}
                  className="clamp-2-xs text-xs leading-snug font-semibold text-ink-900 hover:text-brand-600"
                >
                  {name}
                </Link>
                {item.variantLabel && (
                  <p className="mt-0.5 truncate text-xs text-ink-500">{item.variantLabel}</p>
                )}

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {/* A small stepper, the cart page's in miniature. */}
                  <span className="flex items-center rounded-control border border-line">
                    <button
                      type="button"
                      onClick={() => setQuantity(key, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label="-"
                      className="btn btn-ghost h-7 w-7 min-h-0 rounded-none rounded-l-control p-0"
                    >
                      <MinusIcon size={12} />
                    </button>
                    <span className="w-7 text-center text-xs font-bold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(key, item.quantity + 1)}
                      disabled={item.quantity >= max}
                      aria-label="+"
                      className="btn btn-ghost h-7 w-7 min-h-0 rounded-none rounded-r-control p-0"
                    >
                      <PlusIcon size={12} />
                    </button>
                  </span>

                  <span className="text-sm font-bold whitespace-nowrap text-ink-900 tabular-nums">
                    {formatPrice(item.price * item.quantity, locale)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => remove(key)}
                aria-label={`${t.cart.remove} — ${name}`}
                className="btn btn-ghost -mr-1.5 h-7 w-7 min-h-0 shrink-0 self-start rounded-control p-0 text-ink-400 hover:text-danger"
              >
                <CloseIcon size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      {more > 0 && (
        <Link
          href="/cart"
          className="block border-t border-line px-4 py-2 text-center text-xs font-semibold text-brand-600 hover:underline"
        >
          {fill(t.cart.moreItems, { count: more })}
        </Link>
      )}

      <div className="border-t border-line bg-canvas px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-ink-500">{t.cart.subtotal}</span>
          <span className="text-base font-extrabold text-ink-900 tabular-nums">
            {formatPrice(subtotal, locale)}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          <Link href="/cart" className="btn btn-outline btn-sm">
            {t.nav.cart}
          </Link>
          <Link href="/checkout" className="btn btn-primary btn-sm">
            {t.cart.checkout}
          </Link>
        </div>
      </div>
    </>
  );
}
