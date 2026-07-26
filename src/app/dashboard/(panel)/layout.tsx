import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Staff-only gate for the whole dashboard.
 *
 * A signed-in customer is sent to their own account area rather than the
 * sign-in page — they *are* authenticated, just not staff, so bouncing them
 * to a login form would be a dead end.
 *
 * Every mutating action re-checks the session independently; a layout guard
 * alone wouldn't stop a direct POST to a Server Action.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/account");

  return (
    // Stacks on mobile (top bar above content), splits into a rail on desktop.
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <AdminSidebar admin={user} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
