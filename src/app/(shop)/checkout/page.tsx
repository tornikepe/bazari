import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getActiveZones } from "@/lib/delivery";
import { getSettings } from "@/lib/settings";
import { cardGateway } from "@/lib/payments";
import { enabledGateways } from "@/lib/payments/gateways";
import type { PaymentMethod } from "@/lib/payment";

/**
 * Checkout requires an account.
 *
 * Guest checkout used to be allowed, and it left orders with no owner: nobody
 * could look one up later without the emailed receipt link, "my orders" was
 * empty for the person who placed them, and a refund or a delivery question
 * had no verified party on the other end.
 *
 * The gate is here *and* in `placeOrder`. This one is so the shopper is asked
 * before filling in a form rather than after; that one is the one that holds,
 * because a Server Action is reachable by direct POST.
 *
 * Staff go to the storefront rather than through a bounce to sign-in: they are
 * signed in already, just not as somebody who shops here.
 */
export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fcheckout");
  if (user.role !== "customer") redirect("/cart");

  const [saved, zones, gateways, settings, prefs] = await Promise.all([
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        fullName: true,
        phone: true,
        city: true,
        street: true,
        note: true,
        lat: true,
        lng: true,
        isDefault: true,
      },
    }),
    // The same list `placeOrder` reads, so the form cannot offer a zone the
    // action will then refuse.
    getActiveZones(),
    // Likewise the gateways: only the ones switched on and filled in.
    enabledGateways(),
    getSettings(),
    // What the customer chose on their payment page, to have ready.
    prisma.user.findUnique({ where: { id: user.id }, select: { preferredPayment: true } }),
  ]);

  /* The ways to pay, in the order they are offered: the online gateways the
     dashboard switched on, then a plain card when the sandbox stands in for
     one, then the two that need no gateway. Decided here, once, so the form
     cannot offer a method the action will refuse. */
  const methods: PaymentMethod[] = [
    ...gateways.map((gateway) => gateway.provider),
    ...(cardGateway() ? (["card"] as const) : []),
    "bank_transfer",
    ...(settings.codEnabled ? (["cash_on_delivery"] as const) : []),
  ];

  /* The default address wins over the profile fields when there is one: a
     customer who has taken the trouble to save "work, and send it to the
     back door" meant it, and the three columns on `User` are the fallback
     for an account that never saved anything. */
  const preferred = saved.find((address) => address.isDefault);

  return (
    <CheckoutForm
      methods={methods}
      preferred={prefs?.preferredPayment ?? null}
      defaults={{
        customerName: preferred?.fullName || user.name,
        phone: preferred?.phone || user.phone,
        email: user.email,
        city: preferred?.city || user.city,
        address: preferred?.street || user.address,
        note: preferred?.note ?? "",
      }}
      saved={saved}
      zones={zones}
    />
  );
}
