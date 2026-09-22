"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { TaxNote } from "@/components/ui/TaxNote";
import { useI18n } from "@/components/providers/I18nProvider";
import { Price } from "@/components/ui/Price";
import { MapPinIcon, SpinnerIcon, ShieldIcon } from "@/components/ui/icons";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { shippingFor, type DeliveryChoice } from "@/lib/cart-rules";
import type { Dictionary } from "@/lib/i18n";
import { placeOrder, previewCoupon, type CouponPreview } from "@/app/actions/orders";
import { lineKey } from "@/lib/cart-store";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment";
import { PaymentMark } from "@/components/checkout/PaymentMark";
import { PhoneField } from "@/components/ui/PhoneField";
import { SuggestField } from "@/components/ui/SuggestField";
import { suggestCities } from "@/lib/georgian-cities";
import { localDigits } from "@/lib/phone";
import { Busy, Swap } from "@/components/ui/Swap";

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

type FieldErrors = Partial<
  Record<"customerName" | "phone" | "city" | "address" | "zone", string>
>;

export type CheckoutDefaults = {
  customerName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  note: string;
};

/** One saved address, as the picker needs it. */
export type CheckoutAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  city: string;
  street: string;
  note: string;
  isDefault: boolean;
};

/** A courier zone, as the picker shows it. */
export type CheckoutZone = {
  id: string;
  nameKa: string;
  nameEn: string;
  fee: number;
  freeAbove: number | null;
};

export function CheckoutForm({
  defaults,
  saved = [],
  zones = [],
  methods: offered,
  preferred = null,
}: {
  defaults: CheckoutDefaults;
  saved?: CheckoutAddress[];
  zones?: CheckoutZone[];
  /** The ways to pay the page decided on — gateways first. */
  methods?: PaymentMethod[];
  /** The customer's default from their payment page, when it is offered. */
  preferred?: PaymentMethod | null;
}) {
  const { locale, t } = useI18n();
  const { items, hydrated, subtotal, clear } = useCart();
  const settings = useSettings();
  const router = useRouter();

  /* How it leaves the shop. `pickup` is only offered when the settings say
     so; a zone only when the shop has drawn some. With neither, this is the
     one courier and the one fee the cart already showed. */
  const [method, setMethod] = useState<"courier" | "pickup">("courier");
  const [zoneId, setZoneId] = useState<string>(zones.length === 1 ? zones[0]!.id : "");
  const zone = zones.find((candidate) => candidate.id === zoneId) ?? null;

  const delivery: DeliveryChoice =
    method === "pickup" && settings.pickupEnabled
      ? { method: "pickup" }
      : { method: "courier", zone };

  /* Worked out here rather than taken from the cart: the cart quotes the
     shop-wide fee because it does not yet know where the parcel is going.
     This is the figure the action will charge, from the same function. */
  const shipping = shippingFor(subtotal, items.length, settings, delivery);
  const total = subtotal + shipping;

  // Prefilled from the account. Requiring people to sign in and then making
  // them retype the address they already gave us would be the worst of both.
  const [form, setForm] = useState({ ...defaults });
  // What the shop offers, as the page decided: the gateways it switched on
  // and the two that need none. Cash on delivery is a switch in the
  // settings, and a switch nothing reads is a lie in the dashboard — the
  // action refuses it too, so hiding it here is the courtesy and not the
  // enforcement.
  const methods: PaymentMethod[] =
    offered ??
    PAYMENT_METHODS.filter((method) => method === "card" || method === "bank_transfer");
  const [payment, setPayment] = useState<PaymentMethod>(
    preferred && methods.includes(preferred) ? preferred : (methods[0] ?? "bank_transfer"),
  );
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
    // A courier needs an address; somebody collecting does not.
    if (delivery.method === "courier") {
      if (!form.city.trim()) next.city = t.checkout.required;
      if (!form.address.trim()) next.address = t.checkout.required;
      if (zones.length > 0 && !zone) next.zone = t.checkout.deliveryZoneRequired;
    }

    if (!form.phone.trim()) next.phone = t.checkout.required;
    else if (!localDigits(form.phone)) next.phone = t.checkout.invalidPhone;

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
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        couponCode: coupon?.ok ? coupon.code : undefined,
        paymentMethod: payment,
        deliveryMethod: delivery.method,
        deliveryZoneId: delivery.method === "courier" ? (zone?.id ?? undefined) : undefined,
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
      // A card order with a gateway goes there to be paid; the gateway sends
      // the browser back to the order. Everything else goes to the order now.
      if (result.redirect) {
        window.location.assign(result.redirect);
        return;
      }
      router.push(`/order/${result.number}`);
    } catch {
      setFailure({ title: t.checkout.failed, hint: t.checkout.failedHint });
    } finally {
      setSubmitting(false);
    }
  }

  if (hydrated && items.length === 0) {
    return (
      <div className="page-notice">
        <div className="card card-pad-notice mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <h1 className="text-lg font-bold text-ink-900">{t.cart.empty}</h1>
          <p className="text-sm text-ink-500">{t.cart.emptyHint}</p>
          <Link href="/catalog" className="btn btn-primary btn-md mt-2">
            {t.cart.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  /* The three sections, numbered, so the page reads as three steps and
     not as a form that goes on. */
  let step = 0;
  const legend = (title: string) => {
    step += 1;
    return (
      <legend className="flex items-center gap-3 px-1 text-base font-bold text-ink-900">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-solid text-xs font-extrabold text-brand-on-solid tabular-nums"
        >
          {step}
        </span>
        {title}
      </legend>
    );
  };

  return (
    <div className="page">
      {/* Narrower than the catalogue and centred: a form is read down the
          middle, and stretched across the width of a product grid it read
          as two unrelated columns. */}
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t.checkout.title} className="checkout-head" />

        {/* Where this is in the buying: the cart is behind, the order page
            ahead. Three stops, the middle one lit. */}
        <ol className="checkout-steps mx-auto mt-2 flex max-w-md items-center justify-center gap-2 text-xs font-semibold">
          <li className="is-done"><span>1</span>{t.checkout.stepCart}</li>
          <li aria-hidden="true" className="rule" />
          <li className="is-current" aria-current="step"><span>2</span>{t.checkout.stepDetails}</li>
          <li aria-hidden="true" className="rule" />
          <li><span>3</span>{t.checkout.stepDone}</li>
        </ol>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start"
      >
        <div className="flex flex-col gap-5">
          {/* -------------------------- saved addresses ---------------------- */}
          {/* Only when there is a choice to make. One saved address has already
              been used to fill the fields below, and a picker offering the
              thing that is already selected is a control with no purpose. */}
          {saved.length > 1 && (
            <fieldset className="card card-pad">
              <legend className="px-1 text-sm font-bold text-ink-900">{t.account.addressPick}</legend>

              <div className="mt-3 flex flex-col gap-2">
                {saved.map((address) => {
                  /* Chosen by what is in the fields, not by a separate
                     "selected" state: a customer who picks an address and then
                     edits the street is no longer using that address, and a
                     radio still lit against it would be lying. */
                  const inUse =
                    form.customerName === address.fullName &&
                    form.phone === address.phone &&
                    form.city === address.city &&
                    form.address === address.street;

                  return (
                    <label
                      key={address.id}
                      className={`flex cursor-pointer items-start gap-3 border p-3 text-sm transition-colors ${
                        inUse ? "border-brand-600 bg-brand-50" : "border-line hover:bg-ink-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={inUse}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            customerName: address.fullName,
                            phone: address.phone,
                            city: address.city,
                            address: address.street,
                            note: address.note || current.note,
                          }))
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
                      />

                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-900">
                          {address.label || address.city}
                          {address.isDefault && (
                            <span className="badge ml-2 bg-brand-50 text-brand-700">
                              {t.account.addressDefault}
                            </span>
                          )}
                        </span>
                        <span className="block text-ink-600">
                          {address.fullName} · {address.phone}
                        </span>
                        <span className="block text-ink-500">
                          {address.city}, {address.street}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* ---------------------------- contact --------------------------- */}
          <fieldset className="card card-pad">
            {legend(t.checkout.contact)}

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field
                label={t.checkout.name}
                value={form.customerName}
                onChange={(value) => update("customerName", value)}
                error={errors.customerName}
                required
                autoComplete="name"
              />
              <div>
                <label className="field-label" htmlFor="checkout-phone">
                  {t.checkout.phone}
                  <span className="ml-0.5 text-brand-600">*</span>
                </label>
                <PhoneField
                  id="checkout-phone"
                  value={form.phone}
                  onChange={(value) => update("phone", value)}
                  invalid={Boolean(errors.phone)}
                  describedBy={errors.phone ? "checkout-phone-error" : undefined}
                />
                {errors.phone && (
                  <p id="checkout-phone-error" className="mt-1 text-xs text-danger">
                    {errors.phone}
                  </p>
                )}
              </div>
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
          <fieldset className="card card-pad">
            {legend(
              settings.pickupEnabled || zones.length > 0
                ? t.checkout.delivery
                : t.checkout.deliveryAddress,
            )}

            {/* Courier or collection — only when there is a choice to make. */}
            {settings.pickupEnabled && (
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {(["courier", "pickup"] as const).map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-control border px-3.5 py-3 text-sm transition-colors ${
                      method === option
                        ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                        : "border-line text-ink-700 hover:border-ink-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value={option}
                      checked={method === option}
                      onChange={() => setMethod(option)}
                      className="h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
                    />
                    <span className="min-w-0 leading-snug">
                      {option === "courier" ? t.checkout.deliveryCourier : t.checkout.deliveryPickup}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {delivery.method === "pickup" ? (
              <div className="mt-4 flex items-start gap-2 rounded-control bg-ink-50 p-3 text-xs leading-snug text-ink-600">
                <MapPinIcon size={15} className="mt-px shrink-0 text-brand-600" />
                <span>
                  <span className="block font-semibold text-ink-800">
                    {t.checkout.deliveryPickupFrom}
                  </span>
                  {settings.pickupAddress || settings.contactAddress || settings.name}
                  <span className="mt-1 block text-ink-500">{t.checkout.deliveryPickupHint}</span>
                </span>
              </div>
            ) : null}

            <div className={`mt-3 grid gap-4 sm:grid-cols-2 ${delivery.method === "pickup" ? "hidden" : ""}`}>
              {/* Which zone the courier goes to; the fee follows from it. */}
              {zones.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="field-label" htmlFor="zone">
                    {t.checkout.deliveryZone}
                    <span className="ml-0.5 text-brand-600">*</span>
                  </label>
                  <select
                    id="zone"
                    value={zoneId}
                    aria-invalid={Boolean(errors.zone)}
                    aria-describedby={errors.zone ? "zone-error" : undefined}
                    onChange={(event) => {
                      setZoneId(event.target.value);
                      setErrors((current) => ({ ...current, zone: undefined }));
                    }}
                    className={`field ${errors.zone ? "border-danger focus:border-danger" : ""}`}
                  >
                    <option value="">{t.checkout.deliveryZonePick}</option>
                    {zones.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {locale === "ka" ? candidate.nameKa : candidate.nameEn} ·{" "}
                        {formatPrice(candidate.fee, locale)}
                        {candidate.freeAbove !== null
                          ? ` (${fill(t.checkout.deliveryZoneFreeAbove, { amount: formatPrice(candidate.freeAbove, locale) })})`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {errors.zone && (
                    <p id="zone-error" className="mt-1 text-xs text-danger">
                      {errors.zone}
                    </p>
                  )}
                </div>
              )}

              {/* The city, offered as it is typed: "თ" brings Tbilisi,
                  Telavi, Tkibuli. */}
              <div>
                <label className="field-label" htmlFor="checkout-city">
                  {t.checkout.city}
                  <span className="ml-0.5 text-brand-600">*</span>
                </label>
                <SuggestField
                  id="checkout-city"
                  value={form.city}
                  onChange={(value) => update("city", value)}
                  suggestions={suggestCities(form.city, locale).map((city) => ({
                    key: city.en,
                    label: locale === "ka" ? city.ka : city.en,
                    hint: locale === "ka" ? city.en : city.ka,
                  }))}
                  autoComplete="address-level2"
                  invalid={Boolean(errors.city)}
                  describedBy={errors.city ? "checkout-city-error" : undefined}
                />
                {errors.city && (
                  <p id="checkout-city-error" className="mt-1 text-xs text-danger">
                    {errors.city}
                  </p>
                )}
              </div>

              {/* The street, with the addresses already saved offered as
                  it is typed. */}
              <div>
                <label className="field-label" htmlFor="checkout-address">
                  {t.checkout.address}
                  <span className="ml-0.5 text-brand-600">*</span>
                </label>
                <SuggestField
                  id="checkout-address"
                  value={form.address}
                  onChange={(value) => update("address", value)}
                  suggestions={saved
                    .filter(
                      (address) =>
                        address.street !== form.address &&
                        address.street.toLowerCase().includes(form.address.trim().toLowerCase()),
                    )
                    .slice(0, 5)
                    .map((address) => ({
                      key: address.id,
                      label: address.street,
                      hint: address.city,
                    }))}
                  autoComplete="street-address"
                  invalid={Boolean(errors.address)}
                  describedBy={errors.address ? "checkout-address-error" : undefined}
                />
                {errors.address && (
                  <p id="checkout-address-error" className="mt-1 text-xs text-danger">
                    {errors.address}
                  </p>
                )}
              </div>
            </div>

            {/* Outside the address grid: a note is as useful to somebody
                collecting as to somebody waiting at home. */}
            <div className="mt-4">
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
          </fieldset>

          {/* ---------------------------- payment --------------------------- */}
          <fieldset className="card card-pad">
            {legend(t.checkout.payment)}

            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {methods.map((method) => (
                <label
                  key={method}
                  className={`flex cursor-pointer items-center gap-3 rounded-control border px-3.5 py-3 text-sm transition-colors ${
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
                  <PaymentMark method={method} />
                  <span className="min-w-0 leading-snug">{t.payment[method]}</span>
                </label>
              ))}
            </div>

          </fieldset>
        </div>

        {/* ----------------------------- summary ---------------------------- */}
        <aside className="card lg:sticky lg:top-[calc(var(--header-h)+1rem)] card-pad">
          {/* The head centred, as the page's own title is: the serif, and
              the count under it as the small line. */}
          <div className="text-center">
            <h2 className="display-sm text-ink-900">{t.cart.summary}</h2>
            <p className="eyebrow mt-1.5">
              {fill(t.favorites.count, { count: items.reduce((sum, item) => sum + item.quantity, 0) })}
            </p>
          </div>

          {/* Keyed by the product *and* the combination: two sizes of one
              shirt are two lines, and keying on the product alone made React
              fold them onto one another. */}
          {/* Each line its own ruled row: the picture, then the name with
              the size and the count under it, then the line's sum at the
              right — the three columns line up down the list rather than
              each row arranging itself. */}
          <ul className="summary-lines mt-5">
            {items.map((item) => (
              <li key={lineKey(item)}>
                <span className="summary-line-pic">
                  <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                </span>

                <span className="min-w-0">
                  <span className="line-clamp-2 text-xs leading-snug font-semibold text-ink-900">
                    {locale === "ka" ? item.nameKa : item.nameEn}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {item.variantLabel && <span className="line-chip">{item.variantLabel}</span>}
                    <span className="text-xs text-ink-500 tabular-nums">
                      {item.quantity} × {formatPrice(item.price, locale)}
                    </span>
                  </span>
                </span>

                <span className="text-sm font-bold whitespace-nowrap text-ink-900 tabular-nums">
                  {formatPrice(item.price * item.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>

          <div className="my-4 h-px bg-line" />

          {/* ----------------------------- coupon ---------------------------- */}
          {/* A dashed box, the label centred over the row, and a button
              that looks like one: the ghost button beside the box read as a
              word that did nothing. */}
          <div className="coupon-box">
            <label className="field-label block text-center" htmlFor="coupon">
              {t.checkout.couponLabel}
            </label>
            {/* The box over the button rather than beside it: side by side
                the box was too narrow for its own placeholder. */}
            <div className="flex flex-col gap-2">
              <input
                id="coupon"
                value={couponInput}
                placeholder={t.checkout.couponPlaceholder}
                autoComplete="off"
                disabled={coupon?.ok}
                /* A code the shop does not know turns the box's edge red
                   and says nothing else — see `.field[aria-invalid]`. The
                   reasons worth words (expired, used up, under the minimum)
                   keep theirs below. */
                aria-invalid={coupon !== null && !coupon.ok}
                data-ok={coupon?.ok ? "true" : undefined}
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
                className="field w-full text-center font-mono tracking-wide uppercase"
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
                className={`btn btn-md w-full ${coupon?.ok ? "btn-outline" : "btn-primary"}`}
              >
                {/* Pinned to its widest label: the input beside it is what
                    would otherwise shrink when "apply" became "remove". */}
                <Swap
                  show={
                    checkingCoupon ? (
                      <Busy label={t.checkout.couponApply} />
                    ) : coupon?.ok ? (
                      t.checkout.couponRemove
                    ) : (
                      t.checkout.couponApply
                    )
                  }
                  of={[t.checkout.couponRemove, t.checkout.couponApply]}
                />
              </button>
            </div>

            {/* Nothing is said in words about a code that worked — the box
                turns green and the figures below change, which is the
                answer. A code that did not is red, and only the reasons
                worth a sentence get one. */}
            {coupon && !coupon.ok && coupon.reason !== "not-found" && (
              <p className="mt-2 text-center text-xs leading-snug text-danger">
                {COUPON_ERRORS[coupon.reason](t)}
              </p>
            )}
          </div>

          <div className="my-4 h-px bg-line" />

          <dl className="summary-totals">
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
            {discount > 0 && (
              <div>
                <dt>{t.cart.discount}</dt>
                <dd className="text-success">−{formatPrice(discount, locale)}</dd>
              </div>
            )}
            <div className="summary-total">
              <dt>{t.cart.total}</dt>
              <dd>
                <Price value={payable} size="lg" />
              </dd>
            </div>
          </dl>

          <TaxNote total={payable} rate={settings.vatRate} locale={locale} t={t} className="mt-1.5 text-center" />

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

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-400">
            <ShieldIcon size={13} className="shrink-0" />
            {fill(t.checkout.secureNote, { days: settings.returnWindowDays })}
          </p>
        </aside>

        {/* On a phone the summary is below the form and the button with it,
            out of sight while the fields are being filled. This bar sits at
            the foot of the screen with the total and the same button. */}
        <div className="checkout-bar">
          {/* The label on one line, whatever its length: with the button
              beside it, "სულ გადასახდელი" broke over two lines and pushed
              the figure under the button's foot. */}
          <div className="min-w-0 shrink-0">
            <span className="block text-[11px] font-semibold whitespace-nowrap text-ink-500">{t.cart.total}</span>
            <Price value={payable} size="md" />
          </div>
          <button type="submit" disabled={submitting} className="btn btn-primary btn-md shrink-0 whitespace-nowrap">
            {submitting && <SpinnerIcon size={16} />}
            {submitting ? t.checkout.placing : t.checkout.placeOrderShort}
          </button>
        </div>
      </form>
      </div>
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
