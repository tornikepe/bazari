"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CheckIcon, PlusIcon, SpinnerIcon } from "@/components/ui/icons";
import { inviteStaff, setStaffDisabled, setStaffRole } from "@/app/actions/staff";
import { INVITE_HOURS } from "@/lib/staff";
import { fill } from "@/lib/i18n";

export type StaffRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  since: string;
};

export function StaffManager({ me, staff }: { me: string; staff: StaffRow[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const message = (code: string) =>
    code === "self"
      ? t.admin.staffErrorSelf
      : code === "last-admin"
        ? t.admin.staffErrorLastAdmin
        : t.common.error;

  function act(run: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setError(message(result.error ?? "failed"));
        return;
      }
      router.refresh();
    });
  }

  function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await inviteStaff(formData);

      if (!result.ok) {
        setError(message(result.error));
        return;
      }

      /* The link is shown rather than sent, because nothing here can send it.
         It is built into an absolute URL in the browser, where the host the
         admin is actually using is known — the server's idea of its own
         address is a configuration value and is wrong as often as not. */
      setLink(new URL(("inviteUrl" in result && result.inviteUrl) || "", location.origin).href);
      setInviting(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorNote title={error} />}

      {link && (
        <div className="card border-brand-600 card-pad-tight">
          <p className="text-sm font-bold text-ink-900">{t.admin.staffLinkTitle}</p>
          <p className="mt-1 text-xs text-ink-500">
            {fill(t.admin.staffLinkHint, { hours: INVITE_HOURS })}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate border border-line bg-canvas px-3 py-2 text-xs">
              {link}
            </code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(link);
                setCopied(true);
              }}
              className="btn btn-outline btn-sm"
            >
              {copied ? <CheckIcon size={14} /> : null}
              {copied ? t.admin.staffLinkCopied : t.admin.staffLinkCopy}
            </button>
          </div>
        </div>
      )}

      {staff.length === 0 ? (
        <p className="text-sm text-ink-500">{t.admin.staffNone}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {staff.map((person) => {
            const isMe = person.id === me;

            return (
              <li key={person.id} className="card flex flex-wrap items-center gap-x-4 gap-y-3 card-pad-tight">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                    {person.name || person.email}
                    {isMe && <span className="badge bg-ink-100 text-ink-600">{t.admin.staffYou}</span>}
                    {person.disabled && (
                      <span className="badge bg-danger-soft text-danger">{t.admin.staffDisabled}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-500">{person.email}</p>
                </div>

                {canWrite && !isMe ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${person.id}`}>
                      {t.admin.staffRole}
                    </label>
                    <select
                      id={`role-${person.id}`}
                      value={person.role}
                      disabled={isPending}
                      onChange={(event) => act(() => setStaffRole(person.id, event.target.value))}
                      className="field h-9 w-40 text-xs"
                    >
                      <option value="admin">{t.admin.staffRoleAdmin}</option>
                      <option value="viewer">{t.admin.staffRoleViewer}</option>
                      {/* Not a role so much as the way out of one: it takes the
                          dashboard away and leaves the account able to shop. */}
                      <option value="customer">{t.admin.staffRemoveAccess}</option>
                    </select>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => act(() => setStaffDisabled(person.id, !person.disabled))}
                      className="btn btn-outline btn-sm"
                    >
                      {person.disabled ? t.admin.staffEnable : t.admin.staffDisable}
                    </button>
                  </div>
                ) : (
                  /* Your own row is read-only on purpose: demoting yourself is
                     one click from being unable to undo it. */
                  <span className="text-xs text-ink-400">
                    {person.role === "admin" ? t.admin.staffRoleAdmin : t.admin.staffRoleViewer}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!canWrite ? null : inviting ? (
        <form onSubmit={invite} className="card flex flex-col gap-3 card-pad">
          <p className="text-sm font-bold text-ink-900">{t.admin.staffInviteTitle}</p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-2">
              <span className="field-label">{t.admin.staffEmail}</span>
              <input name="email" type="email" required className="field" />
            </label>

            <label className="block">
              <span className="field-label">{t.admin.staffRole}</span>
              <select name="role" defaultValue="viewer" className="field">
                <option value="viewer">{t.admin.staffRoleViewer}</option>
                <option value="admin">{t.admin.staffRoleAdmin}</option>
              </select>
            </label>

            <label className="block sm:col-span-3">
              <span className="field-label">{t.admin.staffName}</span>
              <input name="name" className="field" />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
              {isPending && <SpinnerIcon size={14} />}
              {t.admin.staffInvite}
            </button>
            <button
              type="button"
              onClick={() => setInviting(false)}
              className="btn btn-outline btn-sm"
            >
              {t.admin.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setInviting(true)}
          className="btn btn-primary btn-sm w-fit"
        >
          <PlusIcon size={15} />
          {t.admin.staffInvite}
        </button>
      )}
    </div>
  );
}
