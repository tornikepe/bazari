"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { AccountCardHead } from "@/components/account/AccountShell";
import { ProfileCard, type Profile } from "@/components/account/ProfileCard";

/** The account page's card: reading by default, editing on the head's button. */
export function ProfilePanel({ profile, justSaved }: { profile: Profile; justSaved: boolean }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <AccountCardHead
        title={t.account.menuProfile}
        action={
          !editing && (
            <button type="button" onClick={() => setEditing(true)} className="btn btn-primary btn-md">
              {t.account.edit}
            </button>
          )
        }
      />
      <div className="account-card-body">
        <ProfileCard
          profile={profile}
          editing={editing}
          onCancel={() => setEditing(false)}
          justSaved={justSaved && !editing}
        />
      </div>
    </>
  );
}
