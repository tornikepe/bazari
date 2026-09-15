import { AccountIdentity } from "@/components/account/AccountIdentity";
import { AccountNav } from "@/components/account/AccountNav";
import { VerifyBanner } from "@/components/account/VerifyBanner";
import type { SessionUser } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";

/**
 * What every account page opens with: who this is, the note if their
 * address is unconfirmed, and the three tabs. The page's own content
 * follows.
 */
export function AccountShell({
  user,
  t,
  children,
}: {
  user: SessionUser;
  t: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <div className="page">
      <AccountIdentity
        name={user.name}
        email={user.email}
        verified={user.emailVerified}
        avatarUrl={user.avatarUrl}
        t={t}
      />
      {!user.emailVerified && <VerifyBanner email={user.email} />}
      <AccountNav />
      {children}
    </div>
  );
}
