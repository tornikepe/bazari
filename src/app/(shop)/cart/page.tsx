import { getCurrentUser } from "@/lib/auth";
import { CartView } from "@/components/cart/CartView";

/**
 * The cart itself is client-side (it lives in localStorage), but whether the
 * shopper has an account is a server question — so the page asks, and the view
 * can warn about the sign-in step before they press checkout rather than after
 * being bounced to a form they did not ask for.
 */
export default async function CartPage() {
  const user = await getCurrentUser();
  return <CartView signedIn={user?.role === "customer"} />;
}
