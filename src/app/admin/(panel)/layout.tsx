import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * Auth gate for the whole panel. `/admin/login` deliberately sits outside this
 * route group, so it renders without the shell and can't redirect to itself.
 *
 * Every mutating action re-checks the session independently — a layout guard
 * alone wouldn't stop a direct POST to a Server Action.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    // Stacks on mobile (top bar above content), splits into a rail on desktop.
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <AdminSidebar admin={admin} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
