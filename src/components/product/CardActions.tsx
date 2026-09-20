"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { lineKey } from "@/lib/cart-store";
import { isComplete, labelFor, priceOf, variantFor, type Option, type Variant } from "@/lib/variants";
import { CartIcon, CheckIcon, CloseIcon, SpinnerIcon, ZapIcon } from "@/components/ui/icons";

type Line = Omit<CartItem, "quantity">;
type Loaded = { price: number; options: Option[]; variants: Variant[] };

/* Fetched once per product per page load — twelve cards of the same shoe
   in three colours would otherwise ask twelve times. */
const loaded = new Map<string, Promise<Loaded>>();

async function loadVariants(productId: string, locale: "ka" | "en"): Promise<Loaded> {
  const key = `${productId}:${locale}`;
  let pending = loaded.get(key);
  if (!pending) {
    pending = fetch(`/api/products/${productId}/variants`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(
        (data: {
          price: number;
          options: { id: string; nameKa: string; nameEn: string; values: { id: string; valueKa: string; valueEn: string }[] }[];
          variants: Variant[];
        }) => ({
          price: data.price,
          options: data.options.map((option) => ({
            id: option.id,
            name: locale === "ka" ? option.nameKa : option.nameEn,
            values: option.values.map((value) => ({
              id: value.id,
              label: locale === "ka" ? value.valueKa : value.valueEn,
            })),
          })),
          variants: data.variants,
        }),
      );
    loaded.set(key, pending);
    pending.catch(() => loaded.delete(key));
  }
  return pending;
}

/**
 * The two buttons at the foot of a card: into the cart, or straight to
 * the checkout with it.
 *
 * A product sold in sizes used to offer a third thing here — "choose a
 * variant", a link to the page. Now the same two buttons open the choice
 * on the card itself: a sheet slides up over the picture with the sizes,
 * a size is tapped, and the press finishes as it would have for a product
 * with one form. The sizes are fetched when first asked for, not shipped
 * with every card.
 */
export function CardActions({ product, needsChoice }: { product: Line; needsChoice: boolean }) {
  const { t, locale } = useI18n();
  const { items, hydrated, add, remove } = useCart();
  const router = useRouter();

  const [intent, setIntent] = useState<"cart" | "buy" | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<Record<string, string | undefined>>({});
  const sheetRef = useRef<HTMLDivElement>(null);

  const soldOut = product.stock <= 0;
  const key = lineKey(product);
  const inCart = !needsChoice && hydrated && items.some((entry) => lineKey(entry) === key);

  function finish(line: Line, how: "cart" | "buy") {
    if (how === "cart") {
      if (inCart) remove(key);
      else add(line, 1);
    } else {
      if (!items.some((entry) => lineKey(entry) === lineKey(line))) add(line, 1);
      router.push("/checkout");
    }
  }

  function press(how: "cart" | "buy") {
    if (soldOut) return;
    if (!needsChoice) return finish(product, how);
    setIntent(how);
    setFailed(false);
    if (!data) {
      loadVariants(product.productId, locale)
        .then(setData)
        .catch(() => setFailed(true));
    }
  }

  /* A value tapped. The choice is made the moment it is complete — one
     size, one tap; two options, two taps — and the press that opened the
     sheet finishes as it would have for a product with one form. */
  function pick(optionId: string, valueId: string) {
    if (!data || !intent) return;
    const next = { ...chosen, [optionId]: valueId };
    if (!isComplete(data.options, next)) {
      setChosen(next);
      return;
    }
    const variant = variantFor(data.variants, next);
    if (!variant || !variant.isActive || variant.stock <= 0) {
      setChosen(next);
      return;
    }
    finish(
      {
        ...product,
        price: priceOf(data.price, variant),
        stock: variant.stock,
        variantId: variant.id,
        variantLabel: labelFor(data.options, variant),
      },
      intent,
    );
    setIntent(null);
    setChosen({});
  }

  useEffect(() => {
    if (!intent) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIntent(null);
    }
    function onPointer(event: PointerEvent) {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) setIntent(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [intent]);

  function reachable(optionId: string, valueId: string): boolean {
    if (!data) return false;
    const attempt = { ...chosen, [optionId]: valueId };
    const picked = Object.values(attempt).filter((id): id is string => Boolean(id));
    return data.variants.some(
      (candidate) =>
        candidate.isActive &&
        candidate.stock > 0 &&
        picked.every((id) => candidate.valueIds.includes(id)),
    );
  }

  return (
    <>
      {/* Side by side from `sm`; one above the other on a phone, where two
          cards share the width and each button had room for one letter. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => press("cart")}
          disabled={soldOut}
          aria-pressed={inCart}
          className={`btn btn-sm min-w-0 px-2 ${inCart ? "btn-secondary" : "btn-outline"}`}
        >
          {inCart ? <CheckIcon size={15} className="shrink-0" /> : <CartIcon size={15} className="shrink-0" />}
          <span className="truncate">{inCart ? t.product.inCart : t.product.addToCartShort}</span>
        </button>
        <button
          type="button"
          onClick={() => press("buy")}
          disabled={soldOut}
          className="btn btn-primary btn-sm min-w-0 px-2"
        >
          <ZapIcon size={15} className="shrink-0" />
          <span className="truncate">{soldOut ? t.product.outOfStock : t.product.buyShort}</span>
        </button>
      </div>

      {intent && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-label={data?.options[0]?.name ?? t.product.variantChoose}
          className="card-sheet"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider text-ink-500 uppercase">
              {data?.options.map((option) => option.name).join(" · ") || t.product.variantChoose}
            </span>
            <button
              type="button"
              onClick={() => setIntent(null)}
              aria-label={t.nav.close}
              className="btn btn-ghost h-8 w-8 rounded-control p-0"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {failed ? (
            <p className="mt-2 text-sm text-danger">{t.common.error}</p>
          ) : !data ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-500">
              <SpinnerIcon size={16} /> {t.common.loading}
            </p>
          ) : (
            data.options.map((option) => (
              <div key={option.id} className="mt-2 flex flex-wrap gap-1.5">
                {option.values.map((value) => {
                  const picked = chosen[option.id] === value.id;
                  const possible = reachable(option.id, value.id);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={picked}
                      disabled={!possible}
                      onClick={() => pick(option.id, value.id)}
                      className={`min-h-9 rounded-control border px-2.5 text-xs font-semibold transition-colors ${
                        picked
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : possible
                            ? "border-line bg-surface text-ink-700 hover:border-brand-400 hover:text-brand-600"
                            : "border-line text-ink-300 line-through"
                      }`}
                    >
                      {value.label}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
