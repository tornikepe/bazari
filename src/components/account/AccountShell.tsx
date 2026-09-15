import { AccountIdentity } from "@/components/account/AccountIdentity";
import { AccountNav } from "@/components/account/AccountNav";
import { VerifyBanner } from "@/components/account/VerifyBanner";
import type { SessionUser } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";

/**
 * What every account page opens with: who this is, the three tabs along
 * the foot of that card, and the note if their address is unconfirmed.
 * The page's own content follows.
 *
 * Held to `max-w-4xl` and centred, on every one of the three pages. Left to
 * the full container the settings sat in the left half of a wide screen
 * with the right half empty, while the payment page centred its form under
 * a header that did not — three pages, three widths.
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
      <div className="mx-auto w-full max-w-4xl">
        <AccountIdentity
          name={user.name}
          email={user.email}
          verified={user.emailVerified}
          avatarUrl={user.avatarUrl}
          t={t}
        >
          <AccountNav />
        </AccountIdentity>
        {!user.emailVerified && <VerifyBanner email={user.email} />}
        {children}
      </div>
    </div>
  );
}
