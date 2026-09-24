"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Price } from "@/components/ui/Price";
import { CloseIcon, MinusIcon, PlusIcon, TrashIcon, TruckIcon } from "@/components/ui/icons";
import { LineSizePicker } from "@/components/cart/LineSizePicker";
import { SwipeAway } from "@/components/cart/SwipeAway";
import { TaxNote } from "@/components/ui/TaxNote";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyCartArt } from "@/components/ui/illustrations";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { useChangeKey } from "@/components/ui/useChangeKey";
import { PageIntro } from "@/components/ui/PageIntro";
import { lineKey } from "@/lib/cart-store";

/**
 * The cart: the head in the middle, the lines in a card under it, and the
 * summary under those — beside them on a wide screen. Drawn for a phone
 * first: a line is the picture and the words, and under them the count
 * and the line's sum on one row, so nothing is squeezed beside a 80px
 * picture.
 */
export function CartView() {
  const { locale, t } = useI18n();
  const settings = useSettings();
  const { items, count, hydrated, subtotal, shipping, total, setQuantity, remove, clear } = useCart();

  // The server can't know the cart, so render a stable skeleton until the
  // client has read localStorage. The title is real rather than a grey
  // bar: it is a fixed string the server knows perfectly well.
  if (!hydrated) {
    return (
      <div className="page">
        <PageIntro eyebrow={t.nav.cart} title={t.cart.title} line="…" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
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
      <div className="page">
        {/* Nothing in it: the head and the card take the screen rather
            than leaving the footer halfway up it. */}
        <div className="empty-page">
          {/* No line under the title here: the card below says the same
              sentence, and saying it twice read as a mistake. */}
          <PageIntro eyebrow={t.nav.cart} title={t.cart.title} />

          <EmptyState
            className="card mx-auto mt-8 max-w-md"
            art={<EmptyCartArt size={96} />}
            title={t.cart.empty}
            text={t.cart.emptyHint}
            action={
              <Link href="/catalog" className="btn btn-primary btn-md">
                {t.cart.continueShopping}
              </Link>
            }
          />
        </div>

        {/* What they were just looking at, under the empty state rather than
            inside it: the card is the answer to "there is nothing here", and
            this is the answer to "so what now". Draws nothing at all for a
            first-time visitor, who has no history to offer. */}
        <RecentlyViewed take={4} />
      </div>
    );
  }

  const remaining = settings.freeShippingThreshold - subtotal;

  return (
    <div className="page">
      <PageIntro
        eyebrow={t.nav.cart}
        title={t.cart.title}
        line={`${fill(t.favorites.count, { count })} · ${t.cart.subtotal} ${formatPrice(subtotal, locale)}`}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        {/* ------------------------------- items ----------------------------- */}
        {/* `min-w-0`: grid children default to `min-width: auto`, which stops
            the rows below from shrinking and overflows narrow phones. */}
        <div className="flex min-w-0 flex-col gap-2.5 sm:gap-3">
          {items.map((item) => {
            const name = locale === "ka" ? item.nameKa : item.nameEn;
            const max = Math.max(1, item.stock);
            /* The product *and* the combination: one red medium and one blue
               medium are two lines, and keying either by the product alone
               would make them one. */
            const key = lineKey(item);

            return (
              <SwipeAway key={key} onRemove={() => remove(key)} label={t.cart.remove}>
                <article className="line-card">
                  {/* Off the list with a pointer: the cross at the corner.
                      A thumb swipes the card to the left instead. */}
                  <button
                    type="button"
                    onClick={() => remove(key)}
                    aria-label={t.cart.remove}
                    title={t.cart.remove}
                    className="line-x"
                  >
                    <CloseIcon size={14} strokeWidth={2.5} />
                  </button>

                  <Link href={`/product/${item.slug}`} className="line-pic">
                    <Image src={item.image} alt={name} fill sizes="(max-width: 640px) 104px, 96px" className="object-cover" />
                  </Link>

                  <div className="line-body">
                    <Link href={`/product/${item.slug}`} className="line-name">
                      {name}
                    </Link>

                    <p className="line-unit">
                      {formatPrice(item.price, locale)} / {t.product.unit}
                    </p>
                  </div>

                  {/* Sold in sizes: the size is chosen here, on the line,
                      in a column of its own beside the count. */}
                  {item.variantId && <LineSizePicker item={item} />}

                  {/* The count and what the line comes to, each under its
                      own small word. */}
                  <div className="line-foot">
                    <div className="line-cell is-qty">
                      <span className="line-cell-label">{t.cart.quantity}</span>
                      <span className="line-stepper">
                        {/* Stops at one: a thumb reaching for "one fewer"
                            must not delete the row. */}
                        <button
                          type="button"
                          onClick={() => setQuantity(key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="-"
                        >
                          <MinusIcon size={14} strokeWidth={2.5} />
                        </button>
                        <span aria-label={t.cart.quantity}>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(key, item.quantity + 1)}
                          disabled={item.quantity >= max}
                          aria-label="+"
                        >
                          <PlusIcon size={14} strokeWidth={2.5} />
                        </button>
                      </span>
                    </div>

                    <div className="line-cell is-sum">
                      <span className="line-cell-label">{t.cart.subtotal}</span>
                      {/* Keyed on the figure, so changing a quantity tints
                          the line total for a moment. */}
                      <LineTotal value={item.price * item.quantity} />
                    </div>
                  </div>
                </article>
              </SwipeAway>
            );
          })}
        </div>

        {/* ------------------------------ summary ---------------------------- */}
        <aside className="card summary-stick card-pad" data-lenis-prevent>
          <h2 className="display-sm text-center text-ink-900">{t.cart.summary}</h2>

          <dl className="summary-totals mt-5">
            <div>
              <dt>{t.cart.itemsTotal}</dt>
              <dd>{formatPrice(subtotal, locale)}</dd>
            </div>
            <div>
              <dt>{t.cart.shipping}</dt>
              <dd>
                {shipping === 0 ? (
                  <span className="text-success">{t.cart.freeShipping}</span>
                ) : (
                  formatPrice(shipping, locale)
                )}
              </dd>
            </div>
            <div className="summary-total">
              <dt>{t.cart.total}</dt>
              <dd>
                <TotalPrice value={total} />
              </dd>
            </div>
          </dl>

          <TaxNote total={total} rate={settings.vatRate} locale={locale} t={t} className="mt-1.5 text-center" />

          {/* One line: the van, the sum to go set in ink, the rest quiet. */}
          {remaining > 0 && (
            <p className="free-ship">
              <TruckIcon size={15} className="shrink-0" />
              <span className="truncate">
                {fill(t.cart.freeShippingHint, { amount: formatPrice(remaining, locale) })}
              </span>
            </p>
          )}

          {/* The way on, the way back, and the way to undo it — each with
              room of its own, in that order of weight. */}
          <div className="cart-actions">
            <Link href="/checkout" className="btn btn-primary btn-lg w-full">
              {t.cart.checkout}
            </Link>
            <Link href="/catalog" className="btn btn-outline btn-md w-full">
              {t.cart.continueShopping}
            </Link>
          </div>

          {/* Emptying the cart, at the foot of the summary as a quiet line:
              it undoes everything above and should not look like a step. */}
          <button type="button" onClick={clear} className="btn btn-ghost btn-md mt-4 w-full text-ink-500 hover:text-danger">
            <TrashIcon size={15} />
            {t.cart.clear}
          </button>
        </aside>
      </div>
    </div>
  );
}

/**
 * A line total that tints when it changes.
 *
 * Its own component because the flash is replayed by remounting, and a `key`
 * has to sit on something React owns — putting one on `Price` inside the map
 * would make the row's identity the price rather than the product, and every
 * price change would then remount the whole row.
 */
function LineTotal({ value }: { value: number }) {
  const changed = useChangeKey(value);

  return (
    <span key={changed} className={changed > 0 ? "animate-flash" : undefined}>
      <Price value={value} size="md" />
    </span>
  );
}

/** The same, for the figure the shopper is actually deciding on. */
function TotalPrice({ value }: { value: number }) {
  const changed = useChangeKey(value);

  return (
    <span key={changed} className={changed > 0 ? "animate-flash" : undefined}>
      <Price value={value} size="lg" />
    </span>
  );
}
