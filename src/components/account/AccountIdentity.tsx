import Link from "next/link";
import { CheckIcon, AlertIcon, HeartIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { Dictionary } from "@/lib/i18n";

/**
 * The initials a name reduces to.
 *
 * Two letters at most, and the *first letter of each of the first two words* —
 * not the first two characters, which turns "Demo customer" into "DE". Falls
 * back to the address when there is no name, because an account created from a
 * social sign-in may not have one.
 */
export function initialsOf(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0] || "";
  const words = source.split(/[\s._-]+/).filter(Boolean).slice(0, 2);
  return words.map((word) => ([...word][0] ?? "")).join("").toUpperCase() || "?";
}

/**
 * Who is signed in, at the top of their own page.
 *
 * The page opened with "Hi, name" and nothing else — no address, no sense of
 * whether the account was confirmed, nothing that made it feel like *an
 * account* rather than a list of orders that happened to be filtered.
 *
 * The mark is initials in a square rather than an avatar: nothing here holds a
 * photo, and a grey silhouette standing in for one is a placeholder that never
 * gets filled.
 */
export function AccountIdentity({
  name,
  email,
  verified,
  t,
}: {
  name: string;
  email: string;
  verified: boolean;
  t: Dictionary;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-x-4 gap-y-3 card-pad">
      <span
        aria-hidden="true"
        className="grid h-14 w-14 shrink-0 place-items-center bg-brand-solid text-xl font-extrabold tracking-tight text-brand-on-solid"
      >
        {initialsOf(name, email)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wider text-ink-400 uppercase">{t.account.title}</p>
        <h1 className="truncate text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
          {name || email}
        </h1>
        <p className="truncate text-sm text-ink-500">{email}</p>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {/* The state, not a call to action: confirming is offered by the banner
            below, which is where the code entry lives. Saying it twice in two
            different voices reads as two different problems. */}
        <span
          className={`badge ${verified ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}
        >
          {verified ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
          {verified ? t.account.emailVerified : t.account.emailUnverified}
        </span>

        <Link
          href="/favorites"
          className="btn btn-outline btn-sm h-9 gap-1.5 whitespace-nowrap"
        >
          <HeartIcon size={14} />
          {t.account.savedItems}
          <ChevronRightIcon size={14} className="text-ink-400" />
        </Link>
      </div>
    </div>
  );
}
