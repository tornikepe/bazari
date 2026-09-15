import type { Dictionary } from "@/lib/i18n";
import { isGatewayMethod, type PaymentMethod, type PaymentStatus } from "@/lib/payment";

/**
 * What an order's money is doing, in one badge.
 *
 * "Unpaid" was stamped on every order that had not been paid online — which
 * is most of them, since most are paid at the door. It read as a warning
 * about something the customer had failed to do. The badge now says what is
 * actually the case: the money is collected by the courier, or the shop is
 * waiting for a transfer, or the card payment did not go through — and
 * when it *was* paid, through what.
 */
export function paymentWording(
  method: PaymentMethod,
  status: PaymentStatus,
  orderStatus: string,
  t: Dictionary,
): { label: string; tone: string } {
  const via = t.payment[method];

  if (status === "paid") {
    return { label: `${t.orderDone.paidBadge} · ${via}`, tone: "bg-success-soft text-success" };
  }
  if (status === "refunded") {
    return { label: t.orderDone.refundedBadge, tone: "bg-ink-100 text-ink-600" };
  }
  // Unpaid and never will be: nothing was taken, so there is nothing to warn about.
  if (orderStatus === "cancelled") {
    return { label: t.orderDone.notCharged, tone: "bg-ink-100 text-ink-600" };
  }
  if (method === "cash_on_delivery") {
    return { label: t.orderDone.payOnDelivery, tone: "bg-info-soft text-info" };
  }
  if (method === "bank_transfer") {
    return { label: t.orderDone.awaitingTransfer, tone: "bg-warning-soft text-warning" };
  }
  // A card or gateway order that is not paid: the payment did not complete.
  return {
    label: `${t.orderDone.unpaidBadge} · ${isGatewayMethod(method) ? via : t.payment.card}`,
    tone: "bg-warning-soft text-warning",
  };
}

export function PaymentBadge({
  method,
  status,
  orderStatus,
  t,
}: {
  method: PaymentMethod;
  status: PaymentStatus;
  orderStatus: string;
  t: Dictionary;
}) {
  const { label, tone } = paymentWording(method, status, orderStatus, t);
  return <span className={`badge whitespace-nowrap ${tone}`}>{label}</span>;
}
