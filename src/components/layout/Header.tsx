import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { FavoritesSync } from "@/components/product/FavoritesSync";
import { CartSync } from "@/components/cart/CartSync";
import { StaleItemSweep } from "@/components/layout/StaleItemSweep";
import { SocialButtons } from "@/components/auth/SocialButtons";

/**
 * The shelves in the bar, or none of them.
 *
 * This sits in the layout, so a throw here does not lose a menu — it loses
 * every page on the site at once. A bar with no category list is a small
 * loss; a shop with no pages is the whole thing. Whatever is wrong is
 * written to the log and the bar draws without the list.
 */
async function readBarCategories() {
  try {
    return await prisma.category.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      select: { slug: true, nameKa: true, nameEn: true, icon: true },
    });
  } catch (error) {
    console.error("[header] the categories could not be read", error);
    return [];
  }
}

async function HeaderContent() {
  const [categories, user] = await Promise.all([readBarCategories(), getCurrentUser()]);

  return (
    <>
      <HeaderBar
        categories={categories}
        /* Rendered here, on the server, and handed down: which providers
           this deployment holds is read from the environment. Only for a
           visitor who is not signed in — the panel is the sign-in then. */
        social={user ? null : <SocialButtons compact />}
        user={
          user
            ? { name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }
            : null
        }
      />
      {/* Everyone, signed in or not: a guest's cart goes stale the same way
          a customer's does. */}
      <StaleItemSweep />

      {/* Here rather than in the layout, because this is where the session is
          already read: the sync is only mounted for a shopper, and mounting it
          for a guest would be a call the action refuses on every page. */}
      {user?.role === "customer" && (
        <>
          <FavoritesSync />
          <CartSync />
        </>
      )}
    </>
  );
}

export function Header() {
  return (
    // `HeaderBar` reads `useSearchParams`, which needs a Suspense boundary so
    // it never blocks static rendering of the pages below it.
    <Suspense fallback={<div className="h-16 bg-surface shadow-[0_1px_0_var(--color-line)] lg:h-[7.75rem]" />}>
      <HeaderContent />
    </Suspense>
  );
}
