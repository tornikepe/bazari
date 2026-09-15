import { getAdapter } from "@/lib/payments";
import { applyPaymentEvent, gatewayContext } from "@/lib/payments/service";
import { isPaymentProvider } from "@/lib/payments/guards";

/**
 * Gateway callbacks.
 *
 * The body is read as raw text and handed to the adapter unparsed, because
 * signature verification has to run over the exact bytes that were signed —
 * re-serialising JSON first would change them and every signature would fail.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isPaymentProvider(provider)) {
    return Response.json({ error: "unknown provider" }, { status: 404 });
  }

  // A gateway that is switched off gets nothing: its callbacks may still
  // arrive for a while after it is, and none of them may move an order.
  const context = await gatewayContext(provider);
  if (!context) return Response.json({ error: "unknown provider" }, { status: 404 });

  const rawBody = await request.text();
  const adapter = getAdapter(provider);

  const parsed = await adapter.parseWebhook(request, rawBody, context.config);
  if (!parsed.ok) {
    // Deliberately terse: a caller that fails verification learns nothing.
    console.warn(`[payments] rejected ${provider} webhook: ${parsed.reason}`);
    return Response.json({ error: "rejected" }, { status: 400 });
  }

  const result = await applyPaymentEvent({
    provider,
    paymentId: parsed.paymentId,
    externalId: parsed.externalId,
    state: parsed.state,
    amount: parsed.amount,
    currency: parsed.currency,
    providerRef: parsed.providerRef,
    failReason: parsed.failReason,
    payload: rawBody,
  });

  if (!result.ok) {
    // 500 so the gateway retries — the event was valid, we failed to store it.
    return Response.json({ error: result.reason }, { status: 500 });
  }

  // 200 on a replay too, otherwise the gateway keeps redelivering for ever.
  return Response.json({ received: true, applied: result.applied });
}
