import { redirect } from "next/navigation";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { StaffRoleProvider } from "@/components/admin/StaffRoleProvider";
import { PageTransition } from "@/components/layout/PageTransition";

/**
 * Staff-only gate for the whole dashboard.
 *
 * A signed-in customer is sent to their own account area rather than the
 * sign-in page — they *are* authenticated, just not staff, so bouncing them
 * to a login form would be a dead end.
 *
 * Both staff roles pass here: a `viewer` is meant to see all of this. What a
 * viewer cannot do is enforced in the Server Actions, every one of which calls
 * `getCurrentAdmin`. This layout decides who gets to look; it decides nothing
 * about who gets to change, because a layout guard cannot stop a direct POST.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaff(user.role)) redirect("/account");

  return (
    // Stacks on mobile (top bar above content), splits into a rail on desktop.
    <StaffRoleProvider role={user.role}>
      <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
        <AdminSidebar admin={user} />
        {/* The same entrance the shop's pages make: half a second of rise,
            replayed on every navigation, once. */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <PageTransition block>{children}</PageTransition>
        </main>
      </div>
    </StaffRoleProvider>
  );
}
