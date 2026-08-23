import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

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

  const saved = await prisma.address.findMany({
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
      isDefault: true,
    },
  });

  /* The default address wins over the profile fields when there is one: a
     customer who has taken the trouble to save "work, and send it to the
     back door" meant it, and the three columns on `User` are the fallback
     for an account that never saved anything. */
  const preferred = saved.find((address) => address.isDefault);

  return (
    <CheckoutForm
      defaults={{
        customerName: preferred?.fullName || user.name,
        phone: preferred?.phone || user.phone,
        email: user.email,
        city: preferred?.city || user.city,
        address: preferred?.street || user.address,
        note: preferred?.note ?? "",
      }}
      saved={saved}
    />
  );
}
