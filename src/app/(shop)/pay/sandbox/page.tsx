import { redirect } from "next/navigation";
import { getI18n } from "@/lib/locale";
import { formatPrice } from "@/lib/format";
import { sandboxEnabled, sandboxLinkValid } from "@/lib/payments/sandbox";
import { sandboxDecide } from "@/app/actions/payments-gateway";
import { AlertIcon } from "@/components/ui/icons";
import type { RawSearchParams } from "@/lib/filters";

/**
 * The sandbox gateway's hosted page.
 *
 * What a real gateway shows between the checkout and the receipt, minus the
 * card form: the amount, the order, and a choice. It says what it is in
 * both languages and in the page title, because a page that looks like a
 * bank and is not one is the one thing this must never be mistaken for.
 *
 * Notice template: one centred card, no page furniture.
 */
export default async function SandboxGatewayPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  if (!sandboxEnabled()) redirect("/");

  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  if (!sandboxLinkValid(params)) redirect("/");

  const { locale, t } = await getI18n();
  const amount = Number(params.get("amount"));
  const order = params.get("order") ?? "";

  return (
    <div className="page-notice">
      <div className="card card-pad-notice mx-auto flex max-w-md flex-col items-center text-center">
        <span className="badge bg-warning-soft text-warning">{t.sandbox.badge}</span>
        <p className="mt-4 text-lg font-bold text-ink-900">{t.sandbox.title}</p>
        <p className="mt-2 text-sm text-ink-500">{t.sandbox.text}</p>

        <dl className="mt-6 grid w-full grid-cols-2 gap-y-2 border-y border-line py-4 text-sm">
          <dt className="text-left text-ink-500">{t.orderDone.orderNumber}</dt>
          <dd className="text-right font-mono font-bold text-ink-900">{order}</dd>
          <dt className="text-left text-ink-500">{t.cart.total}</dt>
          <dd className="text-right text-base font-extrabold text-ink-900">
            {formatPrice(amount, locale)}
          </dd>
        </dl>

        <form action={sandboxDecide} className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
          {[...params.entries()].map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <button type="submit" name="decision" value="captured" className="btn btn-primary btn-lg w-full">
            {t.sandbox.pay}
          </button>
          <button type="submit" name="decision" value="failed" className="btn btn-outline btn-lg w-full">
            {t.sandbox.decline}
          </button>
        </form>

        <p className="mt-5 flex items-start gap-2 text-left text-xs text-ink-400">
          <AlertIcon size={14} className="mt-px shrink-0" />
          {t.sandbox.note}
        </p>
      </div>
    </div>
  );
}
