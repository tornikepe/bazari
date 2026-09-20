import Link from "next/link";
import { AlertIcon } from "@/components/ui/icons";
import { getI18n } from "@/lib/locale";

/**
 * Shown to signed-in customers who never confirmed their address.
 *
 * The verify page takes the address as a query parameter and issues a fresh
 * code from there, so this only has to be a link.
 */
export async function VerifyBanner({ email }: { email: string }) {
  const { t } = await getI18n();

  /* A line, not a box: it sits along the foot of the identity card, in
     the brand's tint, small — a reminder rather than a warning. The
     verify page issues the code, so this is only a link. */
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-line bg-brand-50/60 px-5 py-2 text-xs">
      <p className="flex min-w-0 items-center gap-2 text-ink-700">
        <AlertIcon size={13} className="shrink-0 text-brand-600" />
        {t.auth.unverified}
      </p>
      <Link
        href={`/verify?email=${encodeURIComponent(email)}`}
        className="font-bold text-brand-600 underline-offset-4 hover:underline"
      >
        {t.auth.verifyNow} →
      </Link>
    </div>
  );
}
