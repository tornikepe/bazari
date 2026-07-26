import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";

/**
 * Customer-only area. Staff are bounced to their own dashboard rather than
 * shown a second, weaker version of it.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect(homeFor(user.role));

  return <>{children}</>;
}
