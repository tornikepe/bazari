"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CheckIcon, PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";
import { deleteAddress, makeDefaultAddress, saveAddress } from "@/app/actions/addresses";
import { MAX_ADDRESSES } from "@/lib/addresses";

export type SavedAddress = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  city: string;
  street: string;
  note: string;
  isDefault: boolean;
};

/**
 * The addresses a customer has saved.
 *
 * One address on the account was enough for someone who orders to one place
 * and useless for everyone else — a present going to a parent meant retyping
 * a street every time, and getting it wrong once meant a courier at the wrong
 * door.
 *
 * The form is the same panel whether it is adding or editing: two forms with
 * six identical fields is one form with a title that changes, and it kept the
 * "which one am I editing" question in one place.
 */
export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /** `null` when closed, `"new"` when adding, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const current = addresses.find((address) => address.id === editing);
  const full = addresses.length >= MAX_ADDRESSES;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFailed(false);

    startTransition(async () => {
      const result = await saveAddress(formData);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function act(run: () => Promise<{ ok: boolean }>) {
    setFailed(false);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-ink-900">{t.account.addresses}</h2>
      <p className="mt-1 text-xs text-ink-400">{t.account.addressesHint}</p>

      {failed && <ErrorNote className="mt-3" title={t.common.error} hint={t.common.errorHint} />}

      {addresses.length === 0 && !editing && (
        <p className="mt-4 text-sm text-ink-500">{t.account.addressNone}</p>
      )}

      {addresses.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {addresses.map((address) => (
            <li key={address.id} className="border border-line p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink-900">
                    {address.label || address.city}
                    {address.isDefault && (
                      <span className="badge bg-brand-50 text-brand-700">
                        {t.account.addressDefault}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-600">
                    {address.fullName} · {address.phone}
                  </p>
                  <p className="text-sm text-ink-500">
                    {address.city}, {address.street}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(address.id)}
                    aria-label={`${t.account.addressEdit} — ${address.label || address.city}`}
                    className="btn btn-ghost h-9 w-9 rounded-control p-0"
                  >
                    <PencilIcon size={15} />
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!window.confirm(t.account.addressDeleteConfirm)) return;
                      act(() => deleteAddress(address.id));
                    }}
                    aria-label={`${t.account.addressDelete} — ${address.label || address.city}`}
                    className="btn btn-ghost h-9 w-9 rounded-control p-0 text-ink-400 hover:text-danger"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </div>

              {!address.isDefault && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => act(() => makeDefaultAddress(address.id))}
                  className="btn btn-ghost btn-sm mt-1 -ml-2 text-brand-600"
                >
                  <CheckIcon size={14} />
                  {t.account.addressMakeDefault}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        /* `key` on the form, so switching straight from editing one address to
           editing another remounts the fields. Without it React keeps the
           uncontrolled inputs and shows the first address's street under the
           second one's heading. */
        <form key={editing} onSubmit={submit} className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {current && <input type="hidden" name="id" value={current.id} />}

          {(
            [
              ["label", t.account.addressLabel, false],
              ["fullName", t.account.addressFullName, true],
              ["phone", t.account.addressPhone, true],
              ["city", t.account.addressCity, true],
              ["street", t.account.addressStreet, true],
              ["note", t.account.addressNote, false],
            ] as const
          ).map(([name, label, required]) => (
            <label key={name} className="block">
              <span className="field-label">{label}</span>
              <input
                name={name}
                required={required}
                defaultValue={current?.[name] ?? ""}
                className="field"
              />
            </label>
          ))}

          {/* Offered only when it would change something: the first address
              saved becomes the default on its own, and re-offering the choice
              on the one that already is one is a control that does nothing. */}
          {!(current?.isDefault ?? false) && addresses.length > 0 && (
            <label className="mt-1 flex items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" name="isDefault" className="h-4 w-4 accent-brand-600" />
              {t.account.addressMakeDefault}
            </label>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
              {isPending && <SpinnerIcon size={14} />}
              {t.account.addressSave}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="btn btn-outline btn-sm"
            >
              {t.account.addressCancel}
            </button>
          </div>
        </form>
      ) : full ? (
        <p className="mt-4 text-xs text-ink-400">{t.account.addressFull}</p>
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="btn btn-outline btn-sm mt-4"
        >
          <PlusIcon size={15} />
          {t.account.addressAdd}
        </button>
      )}
    </section>
  );
}
