import { logout } from "@/app/actions/auth";
import { LogoutIcon } from "@/components/ui/icons";

/** A form rather than a link — signing out is a mutation, not navigation. */
export function SignOutButton({ label }: { label: string }) {
  return (
    <form action={logout}>
      <button type="submit" className="btn btn-outline btn-sm">
        <LogoutIcon size={15} />
        {label}
      </button>
    </form>
  );
}
