"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { AccountCardHead } from "@/components/account/AccountShell";
import { ProfileCard, type Profile } from "@/components/account/ProfileCard";

/** The account page's card: the title and the details under it. The
    picture is changed at the head of the menu beside it. */
export function ProfilePanel({ profile, saved }: { profile: Profile; saved: string | null }) {
  const { t } = useI18n();

  return (
    <>
      <AccountCardHead title={t.account.menuProfile} />
      <div className="account-card-body">
        <ProfileCard profile={profile} saved={saved} />
      </div>
    </>
  );
}
