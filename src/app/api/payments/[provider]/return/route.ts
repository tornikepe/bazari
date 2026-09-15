import { redirect } from "next/navigation";
import { finalizeReturn } from "@/lib/payments/service";
import { isPaymentProvider } from "@/lib/payments/guards";

/**
 * Where a gateway sends the shopper back to.
 *
 * Every attempt's return URL points here rather than at the order page, so
 * the gateway can be asked what happened before the page is shown: a
 * PayPal order is captured on this request, a bank's status is fetched.
 * By the time the browser lands on the order, the order already knows.
 *
 * The payment id in the query is not trusted for anything but the lookup:
 * what is recorded comes from the gateway, over our own authenticated
 * call, and a payment that is not this provider's goes nowhere.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const paymentId = new URL(request.url).searchParams.get("payment") ?? "";
  if (!isPaymentProvider(provider) || !paymentId) redirect("/");

  const number = await finalizeReturn(provider, paymentId, request);
  redirect(number ? `/order/${encodeURIComponent(number)}` : "/");
}
