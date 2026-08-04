import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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

  return (
    <CheckoutForm
      defaults={{
        customerName: user.name,
        phone: user.phone,
        email: user.email,
        city: user.city,
        address: user.address,
      }}
    />
  );
}
