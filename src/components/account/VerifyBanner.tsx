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

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-warning/30 bg-warning-soft px-4 py-3">
      <AlertIcon size={16} className="shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-sm leading-snug text-ink-800">{t.auth.unverified}</p>

      <Link
        href={`/verify?email=${encodeURIComponent(email)}`}
        className="btn btn-primary btn-sm shrink-0"
      >
        {t.auth.verifyNow}
      </Link>
    </div>
  );
}
