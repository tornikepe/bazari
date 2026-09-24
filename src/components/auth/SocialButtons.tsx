import { PROVIDER_ORDER, isProviderConfigured, providerLabel } from "@/lib/oauth";
import { getI18n } from "@/lib/locale";
import { GoogleIcon, FacebookIcon } from "@/components/ui/icons";

const ICONS = { google: GoogleIcon, facebook: FacebookIcon };

/**
 * Sign in with Google or Facebook — whichever of the two has credentials.
 *
 * A provider without them is not drawn. For a while both were always drawn,
 * the unconfigured one greyed out with a line saying so, on the theory that
 * the owner should be able to see what was missing. That made sense while
 * the site was a demo; on a live shop a greyed-out Facebook button under a
 * working Google one reads as "something here is broken", and the owner has
 * the plan for what is missing. When neither is configured the whole block,
 * divider included, is gone and the page is an email form.
 *
 * A server component, because whether a provider is configured is read from
 * environment variables — the client has no business knowing which ones this
 * deployment holds.
 */
export async function SocialButtons({
  next = "",
  compact = false,
}: {
  next?: string;
  /** In the header's panel: no divider under it, and a shorter button. */
  compact?: boolean;
}) {
  const { t } = await getI18n();
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  const providers = PROVIDER_ORDER.filter((id) => isProviderConfigured(id)).map((id) => ({
    id,
    label: providerLabel(id),
    Icon: ICONS[id],
  }));

  if (providers.length === 0) return null;

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-4"}`}>
      <div className="grid gap-2">
        {providers.map(({ id, label, Icon }) => (
          // A link, not a form: this is a redirect to a third party, and it
          // changes nothing here until the visitor comes back.
          <a key={id} href={`/api/auth/${id}${query}`} className={`social-btn ${compact ? "is-compact" : ""}`}>
            {/* The mark at the size Google publishes it, and the words
                beside it as one centred group. */}
            <Icon size={18} />
            <span className="truncate">{t.auth.continueWith.replace("{provider}", label)}</span>
          </a>
        ))}
      </div>

      {!compact && (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs text-ink-400">{t.auth.or}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
    </div>
  );
}
