"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { Price } from "@/components/ui/Price";
import { AlertIcon, ShieldIcon, SpinnerIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import { placeOrder } from "@/app/actions/orders";

type FieldErrors = Partial<Record<"customerName" | "phone" | "city" | "address", string>>;

export default function CheckoutPage() {
  const { locale, t } = useI18n();
  const { items, hydrated, subtotal, shipping, total, clear } = useCart();
  const router = useRouter();

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    note: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    setFormError("");

    if (items.length === 0) {
      setFormError(t.checkout.emptyCart);
      return;
    }
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await placeOrder({
        ...form,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      });

      if (!result.ok) {
        setFormError(result.error === "empty" ? t.checkout.emptyCart : t.checkout.failed);
        return;
      }

      // Clear only after the order is safely persisted.
      clear();
      router.push(`/order/${result.number}`);
    } catch {
      setFormError(t.checkout.failed);
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

          <p className="flex items-center gap-2 text-xs text-ink-500">
            <ShieldIcon size={16} className="shrink-0 text-success" />
            {t.checkout.paymentNote}
          </p>
        </div>

        {/* ----------------------------- summary ---------------------------- */}
        <aside className="card sticky top-[7.75rem] p-5">
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
                  <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-pill bg-ink-900 px-1 text-xs font-bold text-white">
                    {item.quantity}
                  </span>
                </div>

                <span className="line-clamp-2 flex-1 text-xs leading-snug text-ink-700">
                  {locale === "ka" ? item.nameKa : item.nameEn}
                </span>

                <span className="shrink-0 text-xs font-semibold text-ink-900">
                  {formatPrice(item.price * item.quantity, locale)}
                </span>
              </li>
            ))}
          </ul>

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
            <div className="my-1 h-px bg-line" />
            <div className="flex items-center justify-between">
              <dt className="text-base font-bold text-ink-900">{t.cart.total}</dt>
              <dd>
                <Price value={total} size="lg" />
              </dd>
            </div>
          </dl>

          {formError && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-control bg-danger-soft p-3 text-xs leading-snug text-danger"
            >
              <AlertIcon size={15} className="mt-px shrink-0" />
              {formError}
            </p>
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
