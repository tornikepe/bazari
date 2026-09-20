import { AccountMenu } from "@/components/account/AccountMenu";
import type { SessionUser } from "@/lib/auth";
import type { Dictionary } from "@/lib/i18n";

/**
 * What every account page is: the menu at the left, the page's own card
 * at the right — the way the reference shop lays its account out. The
 * menu is a column of rows on a desktop and a strip that scrolls
 * sideways on a phone; the card is the page's business, opened with
 * `AccountCardHead`.
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
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <AccountMenu user={user} signOutLabel={t.auth.signOut} />
        <section className="account-card">{children}</section>
      </div>
    </div>
  );
}

/** The card's head: the title at the left, a control at the right, a rule under. */
export function AccountCardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="account-card-head">
      <h1 className="text-lg font-semibold text-ink-900 sm:text-2xl">{title}</h1>
      {action}
    </div>
  );
}
