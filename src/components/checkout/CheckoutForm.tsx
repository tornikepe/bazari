"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { Price } from "@/components/ui/Price";
import { SpinnerIcon } from "@/components/ui/icons";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { formatPrice } from "@/lib/format";
import type { Dictionary } from "@/lib/i18n";
import { placeOrder, previewCoupon, type CouponPreview } from "@/app/actions/orders";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment";

/** Maps a rejection reason to the matching translated message. */
const COUPON_ERRORS: Record<
  Exclude<CouponPreview, { ok: true }>["reason"],
  (t: Dictionary) => string
> = {
  "not-found": (t) => t.checkout.couponNotFound,
  expired: (t) => t.checkout.couponExpired,
  "used-up": (t) => t.checkout.couponUsedUp,
  "min-total": (t) => t.checkout.couponMinTotal,
  "rate-limited": (t) => t.checkout.rateLimited,
};

type FieldErrors = Partial<Record<"customerName" | "phone" | "city" | "address", string>>;

export type CheckoutDefaults = {
  customerName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
};

export function CheckoutForm({ defaults }: { defaults: CheckoutDefaults }) {
  const { locale, t } = useI18n();
  const { items, hydrated, subtotal, shipping, total, clear } = useCart();
  const router = useRouter();

  // Prefilled from the account. Requiring people to sign in and then making
  // them retype the address they already gave us would be the worst of both.
  const [form, setForm] = useState({ ...defaults, note: "" });
  const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  /**
   * The failure, kept as a shape rather than a sentence.
   *
   * It used to be one string, which is why every cause ended up wearing the
   * same words: a cart holding a withdrawn product was told "please try
   * again", and trying again failed in exactly the same way, for ever.
   */
  const [failure, setFailure] = useState<null | {
    title: string;
    hint?: string;
    action?: { href: string; label: string };
  }>(null);
  const [submitting, setSubmitting] = useState(false);

  const discount = coupon?.ok ? coupon.discount : 0;
  // Both are tetri, so this is exact.
  const payable = total - discount;

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || checkingCoupon) return;

    setCheckingCoupon(true);
    try {
      setCoupon(await previewCoupon(code, subtotal));
    } catch {
      setCoupon({ ok: false, reason: "not-found" });
    } finally {
      setCheckingCoupon(false);
    }
  }

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    // Clear the error as soon as the shopper starts fixing the field.
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate() {
    const next: FieldErrors = {};
    if (!form.customerName.trim()) next.customerName = t.checkout.required;
    if (!form.city.trim()) next.city = t.checkout.required;
    if (!form.address.trim()) next.address = t.checkout.required;

    const digits = form.phone.replace(/\D/g, "");
    if (!form.phone.trim()) next.phone = t.checkout.required;
    else if (digits.length < 9) next.phone = t.checkout.invalidPhone;

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);

    if (items.length === 0) {
      setFailure({
        title: t.checkout.emptyCart,
        hint: t.checkout.emptyCartHint,
        action: { href: "/catalog", label: t.catalog.title },
      });
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await placeOrder({
        ...form,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        couponCode: coupon?.ok ? coupon.code : undefined,
        paymentMethod: payment,
      });

      if (!result.ok) {
        /* Each cause gets its own way out. "Unavailable" is the one that
           mattered: it used to fall through to "please try again", which was
           advice that could not work — the cart has to change first. */
        setFailure(
          result.error === "empty"
            ? {
                title: t.checkout.emptyCart,
                hint: t.checkout.emptyCartHint,
                action: { href: "/catalog", label: t.catalog.title },
              }
            : result.error === "unavailable"
              ? {
                  title: t.checkout.unavailable,
                  hint: t.checkout.unavailableHint,
                  action: { href: "/cart", label: t.checkout.openCart },
                }
              : result.error === "rate-limited"
                ? { title: t.checkout.rateLimited, hint: t.checkout.rateLimitedHint }
                : result.error === "sign-in-required"
                  ? {
                      title: t.auth.signInToOrder,
                      hint: t.checkout.signInHint,
                      action: { href: "/login?next=/checkout", label: t.auth.signIn },
                    }
                  : { title: t.checkout.failed, hint: t.checkout.failedHint },
        );
        return;
      }

      // Clear only after the order is safely persisted.
      clear();
      router.push(`/order/${result.number}`);
    } catch {
      setFailure({ title: t.checkout.failed, hint: t.checkout.failedHint });
    } finally {
      setSubmitting(false);
    }
  }

  if (hydrated && items.length === 0) {
    return (
      <div className="page-container py-16">
        <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-14 text-center">
          <h1 className="text-lg font-bold text-ink-900">{t.cart.empty}</h1>
          <p className="text-sm text-ink-500">{t.cart.emptyHint}</p>
          <Link href="/catalog" className="btn btn-primary btn-md mt-2">
            {t.cart.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container py-6 lg:py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
        {t.checkout.title}
      </h1>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start"
      >
        <div className="flex flex-col gap-4">
          {/* ---------------------------- contact --------------------------- */}
          <fieldset className="card p-5">
            <legend className="px-1 text-sm font-bold text-ink-900">{t.checkout.contact}</legend>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field
                label={t.checkout.name}
                value={form.customerName}
                onChange={(value) => update("customerName", value)}
                error={errors.customerName}
                required
                autoComplete="name"
              />
              <Field
                label={t.checkout.phone}
                value={form.phone}
                onChange={(value) => update("phone", value)}
                error={errors.phone}
                required
                type="tel"
                placeholder="+995 5XX XX XX XX"
                autoComplete="tel"
              />
              <div className="sm:col-span-2">
                <Field
                  label={t.checkout.emailOptional}
                  value={form.email}
                  onChange={(value) => update("email", value)}
                  type="email"
                  autoComplete="email"
                />
              </div>
            </div>
          </fieldset>

          {/* ---------------------------- delivery -------------------------- */}
          <fieldset className="card p-5">
            <legend className="px-1 text-sm font-bold text-ink-900">
              {t.checkout.deliveryAddress}
            </legend>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field
                label={t.checkout.city}
                value={form.city}
                onChange={(value) => update("city", value)}
                error={errors.city}
                required
                autoComplete="address-level2"
              />
              <Field
                label={t.checkout.address}
                value={form.address}
                onChange={(value) => update("address", value)}
                error={errors.address}
                required
                autoComplete="street-address"
              />

              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="note">
                  {t.checkout.noteOptional}
                </label>
                <textarea
                  id="note"
                  rows={3}
                  value={form.note}
                  onChange={(event) => update("note", event.target.value)}
                  className="field"
                />
              </div>
            </div>
          </fieldset>

          {/* ---------------------------- payment --------------------------- */}
          <fieldset className="card p-5">
            <legend className="px-1 text-sm font-bold text-ink-900">{t.checkout.payment}</legend>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-control border px-3.5 py-3 text-sm transition-colors ${
                    payment === method
                      ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                      : "border-line text-ink-700 hover:border-ink-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={payment === method}
                    onChange={() => setPayment(method)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
                  />
                  <span className="min-w-0 leading-snug">{t.payment[method]}</span>
                </label>
              ))}
            </div>

            <p className="mt-3 text-xs text-ink-500">{t.checkout.paymentNote}</p>
          </fieldset>
        </div>

        {/* ----------------------------- summary ---------------------------- */}
        <aside className="card sticky top-[var(--header-h)] p-5">
          <h2 className="text-base font-bold text-ink-900">{t.cart.summary}</h2>

          <ul className="mt-4 flex max-h-64 flex-col gap-3 overflow-y-auto">
            {items.map((item) => (
              <li key={item.productId} className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control bg-ink-50">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                  <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-pill bg-panel px-1 text-xs font-bold text-panel-fg">
                    {item.quantity}
                  </span>
                </div>

                <span className="clamp-2-xs flex-1 text-xs leading-snug text-ink-700">
                  {locale === "ka" ? item.nameKa : item.nameEn}
                </span>

                <span className="shrink-0 text-xs font-semibold text-ink-900">
                  {formatPrice(item.price * item.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>

          <div className="my-4 h-px bg-line" />

          {/* ----------------------------- coupon ---------------------------- */}
          <div>
            <label className="field-label" htmlFor="coupon">
              {t.checkout.couponLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="coupon"
                value={couponInput}
                placeholder={t.checkout.couponPlaceholder}
                autoComplete="off"
                disabled={coupon?.ok}
                onChange={(event) => {
                  setCouponInput(event.target.value.toUpperCase());
                  setCoupon(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    // The box lives inside the checkout form — don't submit it.
                    event.preventDefault();
                    void applyCoupon();
                  }
                }}
                className="field min-w-0 flex-1 font-mono tracking-wide uppercase"
              />
              <button
                type="button"
                disabled={checkingCoupon || (!coupon?.ok && !couponInput.trim())}
                onClick={() => {
                  if (coupon?.ok) {
                    setCoupon(null);
                    setCouponInput("");
                  } else {
                    void applyCoupon();
                  }
                }}
                className="btn btn-ghost btn-md shrink-0"
              >
                {checkingCoupon && <SpinnerIcon size={15} />}
                {coupon?.ok ? t.checkout.couponRemove : t.checkout.couponApply}
              </button>
            </div>

            {coupon && (
              <p
                className={`mt-1.5 text-xs leading-snug ${coupon.ok ? "text-success" : "text-danger"}`}
              >
                {coupon.ok ? t.checkout.couponApplied : COUPON_ERRORS[coupon.reason](t)}
              </p>
            )}
          </div>

          <div className="my-4 h-px bg-line" />

          <dl className="flex flex-col gap-2.5 text-sm">
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
            {discount > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">{t.cart.discount}</dt>
                <dd className="font-semibold text-success">
                  −{formatPrice(discount, locale)}
                </dd>
              </div>
            )}
            <div className="my-1 h-px bg-line" />
            <div className="flex items-center justify-between">
              <dt className="text-base font-bold text-ink-900">{t.cart.total}</dt>
              <dd>
                <Price value={payable} size="lg" />
              </dd>
            </div>
          </dl>

          {failure && (
            <ErrorNote
              className="mt-4"
              title={failure.title}
              hint={failure.hint}
              action={
                failure.action && (
                  <Link href={failure.action.href} className="btn btn-outline btn-sm">
                    {failure.action.label}
                  </Link>
                )
              }
            />
          )}

          <button type="submit" disabled={submitting} className="btn btn-primary btn-lg mt-5 w-full">
            {submitting && <SpinnerIcon size={17} />}
            {submitting ? t.checkout.placing : t.checkout.placeOrder}
          </button>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  required = false,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = `field-${label.replace(/\s+/g, "-")}`;

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`field ${error ? "border-danger focus:border-danger" : ""}`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
