import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { HeaderBar } from "@/components/layout/HeaderBar";

async function HeaderContent() {
  const [categories, user] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
      select: { slug: true, nameKa: true, nameEn: true, icon: true },
    }),
    getCurrentUser(),
  ]);

  return (
    <HeaderBar
      categories={categories}
      user={user ? { name: user.name, email: user.email, role: user.role } : null}
    />
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
