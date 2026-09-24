"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { lineKey } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { CartIcon, CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";

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

  /* The panel is one height whatever the cart holds — `.mini-list` is a
     box of four rows that scrolls when there are more and stays that tall
     when there are fewer, so taking a line out does not pull the buttons
     under it up by a row, and every line can be reached. The empty state
     fills the same box. */
  const empty = items.length === 0;

  return (
    <>
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-bold text-ink-900">{t.nav.cart}</p>
        <p className="text-xs text-ink-500 tabular-nums">
          {fill(t.favorites.count, { count })}
        </p>
      </div>

      {empty ? (
        /* The same head, box and foot as a cart with something in it, so
           the panel is one size empty or full — it used to lose its head
           and foot when empty and come up a third shorter. */
        <div className="mini-list grid place-items-center px-5 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-pill bg-ink-100 text-ink-400">
              <CartIcon size={22} />
            </span>
            <p className="mt-3 text-sm font-bold text-ink-900">{t.cart.empty}</p>
            <p className="mt-1 text-xs text-ink-500">{t.cart.emptyHint}</p>
          </div>
        </div>
      ) : (
      <ul className="mini-list divide-y divide-line" data-lenis-prevent>
        {items.map((item) => {
          const key = lineKey(item);
          const name = locale === "ka" ? item.nameKa : item.nameEn;
          const max = Math.max(1, item.stock);

          return (
            <li key={key} className="mini-line">
              <Link href={`/product/${item.slug}`} className="mini-pic">
                <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
              </Link>

              <div className="min-w-0">
                {/* The name and what the line costs, one under the other
                    with nothing between them: they are the two halves of
                    one statement and were a line and a half apart. */}
                <Link href={`/product/${item.slug}`} className="mini-name">
                  {name}
                </Link>
                <p className="mini-sum">{formatPrice(item.price * item.quantity, locale)}</p>
              </div>

              {/* What there is to say about this line — the size it is and
                  how many — stacked in its own column, ending where the
                  cross begins. It used to sit in the middle under the
                  name, a long way from anything it belonged to. */}
              <div className="mini-meta">
                {item.variantLabel && <span className="line-chip">{item.variantLabel}</span>}
                {/* A small stepper: a pill with the number centred between
                    two round marks, the cart page's in miniature. */}
                <span className="mini-stepper">
                  <button
                    type="button"
                    onClick={() => setQuantity(key, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    aria-label="-"
                  >
                    <MinusIcon size={12} strokeWidth={2.5} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(key, item.quantity + 1)}
                    disabled={item.quantity >= max}
                    aria-label="+"
                  >
                    <PlusIcon size={12} strokeWidth={2.5} />
                  </button>
                </span>
              </div>

              <button
                type="button"
                onClick={() => remove(key)}
                aria-label={`${t.cart.remove} — ${name}`}
                className="mini-x"
              >
                <CloseIcon size={14} />
              </button>
            </li>
          );
        })}
      </ul>
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
          {empty ? (
            <Link href="/catalog" className="btn btn-primary btn-sm">
              {t.cart.continueShopping}
            </Link>
          ) : (
            <Link href="/checkout" className="btn btn-primary btn-sm">
              {t.cart.checkout}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
