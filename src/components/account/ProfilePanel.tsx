"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { AccountCardHead } from "@/components/account/AccountShell";
import { ProfileCard, type Profile } from "@/components/account/ProfileCard";
import { AvatarForm } from "@/components/account/AvatarForm";

/** The account page's card: the title, the picture, and the details under it. */
export function ProfilePanel({
  profile,
  avatarUrl,
  saved,
}: {
  profile: Profile;
  avatarUrl: string | null;
  saved: string | null;
}) {
  const { t } = useI18n();

  return (
    <>
      <AccountCardHead title={t.account.menuProfile} />
      <div className="account-card-body">
        <AvatarForm name={profile.name} email={profile.email} avatarUrl={avatarUrl} />
        <ProfileCard profile={profile} saved={saved} />
      </div>
    </>
  );
}
