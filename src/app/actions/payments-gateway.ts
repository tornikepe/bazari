"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { gatewayFor } from "@/lib/payments";
import { gatewayContext, startPayment } from "@/lib/payments/service";
import { sandboxLinkValid, sandboxSign, type SandboxEvent } from "@/lib/payments/sandbox";
import { requestOrigin } from "@/lib/request-origin";

export type RetryPaymentResult =
  | { ok: true; redirect: string }
  | { ok: false; error: "sign-in-required" | "not-found" | "not-card" | "paid" | "no-gateway" | "failed" };

/**
 * "Pay now", on an order that is still unpaid.
 *
 * A declined attempt, a closed tab, a gateway that was down for a minute:
 * every one leaves an order that exists and is not paid for, and the way
 * back is a new attempt against the same order — the old row keeps its
 * state, a new one is opened. Only the customer the order belongs to may
 * start one.
 */
export async function retryPayment(orderNumber: string): Promise<RetryPaymentResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return { ok: false, error: "sign-in-required" };

  const order = await prisma.order.findFirst({
    where: { number: String(orderNumber ?? ""), userId: user.id },
    select: { number: true, paymentMethod: true, paymentStatus: true, status: true },
  });
  if (!order) return { ok: false, error: "not-found" };
  if (order.paymentStatus === "paid" || order.status === "cancelled") return { ok: false, error: "paid" };

  const gateway = gatewayFor(order.paymentMethod);
  if (!gateway) return { ok: false, error: "not-card" };
  if (!(await gatewayContext(gateway))) return { ok: false, error: "no-gateway" };

  const started = await startPayment(order.number, gateway, await requestOrigin(), await getLocale());
  if (!started.ok || started.kind !== "redirect") return { ok: false, error: "failed" };
  return { ok: true, redirect: started.url };
}

/**
 * The sandbox's "pay" and "decline" buttons.
 *
 * Does what a gateway does when a shopper presses pay: tells the shop's
 * webhook, server to server, with a signed body — through the real route,
 * so the signature check, the idempotency and the amount check all run —
 * and then sends the browser back to the order. Nothing here touches the
 * database directly; if the webhook were wrong this page could not paper
 * over it.
 */
export async function sandboxDecide(formData: FormData): Promise<void> {
  const params = new URLSearchParams();
  for (const key of ["payment", "ref", "amount", "currency", "order", "return", "webhook", "locale", "sig"]) {
    const value = formData.get(key);
    if (typeof value === "string") params.set(key, value);
  }
  // A link edited by hand fails here, the way a tampered hosted page fails
  // at a real gateway: by going nowhere.
  if (!sandboxLinkValid(params)) redirect("/");

  const decision = formData.get("decision") === "captured" ? "captured" : "failed";
  const event: SandboxEvent = {
    event_id: `evt_${params.get("ref")}_${decision}`,
    payment_id: params.get("payment")!,
    status: decision,
    amount: Number(params.get("amount")),
    currency: params.get("currency") ?? "GEL",
    ref: params.get("ref")!,
  };
  const body = JSON.stringify(event);

  try {
    const response = await fetch(params.get("webhook")!, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sandbox-signature": sandboxSign(body) },
      body,
      cache: "no-store",
    });
    if (!response.ok) console.error("[sandbox] webhook answered", response.status);
  } catch (error) {
    console.error("[sandbox] webhook unreachable", error);
  }

  // Straight to the order rather than through the return route: a Server
  // Action's redirect is a client-side navigation, and one that lands on a
  // route handler shows the handler's address in the bar. A real gateway
  // arrives at the return route by a full page load and is redirected
  // properly; the sandbox has already called the webhook, so there is
  // nothing for the return route to fetch.
  redirect(`/order/${encodeURIComponent(params.get("order") ?? "")}`);
}
