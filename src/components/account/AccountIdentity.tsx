import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import { PageBanner } from "@/components/account/PageBanner";
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
 * A banner in the brand's tint across the top of the card, the picture
 * sitting on its lower edge, the name and the address under it, and the
 * three tabs along the foot as a row of pills. The same card heads the
 * wishlist, with a heart where the picture goes — the two pages that are
 * *yours* open the same way.
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
  aside,
  children,
}: {
  name: string;
  email: string;
  verified: boolean;
  /** The customer's own picture, when they have set one; initials until then. */
  avatarUrl: string | null;
  t: Dictionary;
  /** Chips at the right of the name — "with us since", a count. */
  aside?: React.ReactNode;
  /** The tab row along the foot of the card. */
  children?: React.ReactNode;
}) {
  return (
    <PageBanner
      className="account-identity"
      eyebrow={t.account.title}
      title={name || email}
      line={
        /* The address, with its state as a small mark beside it — a dot
           and three words in 11px. The state, not a call to action:
           confirming is offered by the note along the foot of the card. */
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate">{email}</span>
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${
              verified ? "text-success" : "text-warning"
            }`}
          >
            {verified ? <CheckIcon size={11} /> : <AlertIcon size={11} />}
            {verified ? t.account.emailVerified : t.account.emailUnverified}
          </span>
        </p>
      }
      mark={
        avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={80}
            height={80}
            className="h-18 w-18 rounded-[calc(var(--radius-card)-3px)] object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-18 w-18 place-items-center rounded-[calc(var(--radius-card)-3px)] bg-brand-solid text-xl font-extrabold tracking-tight text-brand-on-solid sm:h-20 sm:w-20 sm:text-2xl"
          >
            {initialsOf(name, email)}
          </span>
        )
      }
      aside={aside}
    >
      {children}
    </PageBanner>
  );
}
