"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import {
  CheckIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/ui/icons";
import {
  deleteAddress,
  makeDefaultAddress,
  saveAddress,
} from "@/app/actions/addresses";
import { MAX_ADDRESSES } from "@/lib/addresses";
import { PhoneField } from "@/components/ui/PhoneField";

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
    /* No card and no title of its own: it sits in the account card, whose
       head already names the page. */
    <section>
      <p className="text-sm text-ink-500">{t.account.addressesHint}</p>

      {failed && (
        <ErrorNote
          className="mt-3"
          title={t.common.error}
          hint={t.common.errorHint}
        />
      )}

      {/* Nothing saved yet: the mark in its disc, the line, and the way to
          add one — in the middle, as an empty page says it. */}
      {addresses.length === 0 && !editing && (
        <div className="mt-6 flex flex-col items-center rounded-card border border-dashed border-ink-300 px-4 py-8 text-center">
          <span className="order-delivery-mark">
            <MapPinIcon size={18} />
          </span>
          <p className="mt-3 text-sm text-ink-600">{t.account.addressNone}</p>
          <button type="button" onClick={() => setEditing("new")} className="btn btn-primary btn-md mt-4">
            <PlusIcon size={15} />
            {t.account.addressAdd}
          </button>
        </div>
      )}

      {/* Tiles, two to a row from `sm` up: the pin in a disc, the name of
          the place with the "default" chip, the person and the number,
          the street — and the actions on a rule at the tile's foot. */}
      {addresses.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className={`addr-tile ${address.isDefault ? "is-default" : ""}`}>
              {/* The head row: the mark, the name of the place with its
                  chip, and edit/delete at the corner. The lines run under
                  the whole row rather than in the column beside the mark,
                  which on a phone was too narrow for a street. */}
              <div className="tile-head">
                <span className="order-delivery-mark">
                  <MapPinIcon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="tile-title">{address.label || address.city}</span>
                  {address.isDefault && (
                    <span className="badge mt-1 bg-brand-50 text-brand-700">{t.account.addressDefault}</span>
                  )}
                </span>
                <span className="tile-acts">
                  <button
                    type="button"
                    onClick={() => setEditing(address.id)}
                    aria-label={`${t.account.addressEdit} — ${address.label || address.city}`}
                    className="btn btn-ghost h-9 w-9 rounded-pill p-0"
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
                    className="btn btn-ghost h-9 w-9 rounded-pill p-0 text-ink-400 hover:text-danger"
                  >
                    <TrashIcon size={15} />
                  </button>
                </span>
              </div>
              <p className="mt-3 text-sm text-ink-700">
                {address.city}, {address.street}
              </p>
              <p className="mt-0.5 text-sm text-ink-500">
                {address.fullName} · {address.phone}
              </p>

              {/* Only on the ones that are not the default: the whole width
                  of the tile's foot, so the words never fight the icons. */}
              {!address.isDefault && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => act(() => makeDefaultAddress(address.id))}
                  className="btn btn-outline btn-sm mt-3 w-full"
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
        <form
          key={editing}
          onSubmit={submit}
          className={`grid gap-x-4 gap-y-3 sm:grid-cols-2 ${addresses.length > 0 ? "mt-6 border-t border-line pt-6" : "mt-2"}`}
        >
          {current && <input type="hidden" name="id" value={current.id} />}

          <h3 className="display-sm text-ink-900 sm:col-span-2">
            {current ? t.account.addressEdit : t.account.addressAdd}
          </h3>

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
            <div key={name}>
              <label className="field-label" htmlFor={`address-${name}`}>
                {label}
              </label>
              {name === "phone" ? (
                <PhoneField id="address-phone" name="phone" required defaultValue={current?.phone ?? ""} />
              ) : (
                <input
                  id={`address-${name}`}
                  name={name}
                  required={required}
                  defaultValue={current?.[name] ?? ""}
                  className="field"
                />
              )}
            </div>
          ))}

          {/* Offered only when it would change something: the first address
              saved becomes the default on its own, and re-offering the choice
              on the one that already is one is a control that does nothing. */}
          {!(current?.isDefault ?? false) && addresses.length > 0 && (
            <label className="mt-1 flex items-center gap-2 text-sm text-ink-600 sm:col-span-2">
              <input type="checkbox" name="isDefault" className="h-4 w-4 accent-brand-600" />
              {t.account.addressMakeDefault}
            </label>
          )}

          {/* Full width on a phone, their own width from `sm` up. */}
          <div className="mt-2 flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
              {isPending && <SpinnerIcon size={14} />}
              {t.account.addressSave}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-outline btn-md">
              {t.account.addressCancel}
            </button>
          </div>
        </form>
      ) : full ? (
        <p className="mt-4 text-xs text-ink-400">{t.account.addressFull}</p>
      ) : addresses.length > 0 ? (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="btn btn-outline btn-md mt-5 w-full sm:w-auto"
        >
          <PlusIcon size={15} />
          {t.account.addressAdd}
        </button>
      ) : null}
    </section>
  );
}
