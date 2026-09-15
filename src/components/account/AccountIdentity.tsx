import { AlertIcon, CheckIcon } from "@/components/ui/icons";
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
  const words = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  return (
    words
      .map((word) => [...word][0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}

/**
 * Who is signed in, at the top of their own page.
 *
 * The page opened with "Hi, name" and nothing else — no address, no sense of
 * whether the account was confirmed, nothing that made it feel like *an
 * account* rather than a list of orders that happened to be filtered.
 *
 * The mark is the customer's own picture when they have set one on the
 * settings page, and their initials in a square until then — never a grey
 * silhouette standing in for a photo, which is a placeholder that stays.
 */
export function AccountIdentity({
  name,
  email,
  verified,
  avatarUrl,
  t,
  children,
}: {
  name: string;
  email: string;
  verified: boolean;
  /** The customer's own picture, when they have set one; initials until then. */
  avatarUrl: string | null;
  t: Dictionary;
  /** The tab row along the foot of the card. */
  children?: React.ReactNode;
}) {
  return (
    <div className="card account-identity overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 card-pad">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={64}
            height={64}
            className="h-14 w-14 shrink-0 rounded-card object-cover ring-1 ring-line sm:h-16 sm:w-16"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-card bg-brand-solid text-lg font-extrabold tracking-tight text-brand-on-solid sm:h-16 sm:w-16 sm:text-xl"
          >
            {initialsOf(name, email)}
          </span>
        )}

        {/* `min-w-56` rather than `min-w-0`: the row wraps, and a block that
            may shrink to nothing never makes it — the badge would take the
            line and leave the name 70px to truncate in. Given a floor, the
            badge moves to a line of its own instead. */}
        <div className="min-w-56 flex-1">
          <p className="text-xs font-bold tracking-wider text-ink-400 uppercase">
            {t.account.title}
          </p>
          <h1 className="truncate text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
            {name || email}
          </h1>
          <p className="truncate text-sm text-ink-500">{email}</p>
        </div>

        {/* The state, not a call to action: confirming is offered by the
            banner below, which is where the code entry lives. Saying it twice
            in two different voices reads as two different problems. On a
            phone it takes the line under the name. */}
        <span
          className={`badge ${verified ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}
        >
          {verified ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
          {verified ? t.account.emailVerified : t.account.emailUnverified}
        </span>
      </div>

      {children}
    </div>
  );
}
