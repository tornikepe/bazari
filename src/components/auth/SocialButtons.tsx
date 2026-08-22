import { PROVIDER_ORDER, isProviderConfigured, providerLabel } from "@/lib/oauth";
import { getI18n } from "@/lib/locale";
import { GoogleIcon, FacebookIcon } from "@/components/ui/icons";

const ICONS = { google: GoogleIcon, facebook: FacebookIcon };

/**
 * Sign in with Google or Facebook.
 *
 * Both are always drawn, and the one that has no credentials is drawn as a
 * disabled control with a line saying so. The earlier rule — render nothing
 * unless configured — kept the page honest but told the reader nothing: a
 * shop that plainly *has* no Google button is indistinguishable from one whose
 * button is broken, and the owner could not see what they were missing.
 *
 * What is never done is offering a live button that fails after a round trip
 * to Google. A disabled control that says why is a worse look and a better
 * experience.
 *
 * A server component, because whether a provider is configured is read from
 * environment variables — the client has no business knowing which ones this
 * deployment holds. Only the boolean crosses over.
 */
export async function SocialButtons({ next = "" }: { next?: string }) {
  const { t } = await getI18n();
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  const providers = PROVIDER_ORDER.map((id) => ({
    id,
    label: providerLabel(id),
    ready: isProviderConfigured(id),
    Icon: ICONS[id],
  }));

  const anyOff = providers.some((provider) => !provider.ready);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        {providers.map(({ id, label, ready, Icon }) =>
          ready ? (
            // A link, not a form: this is a redirect to a third party, and it
            // changes nothing here until the visitor comes back.
            <a
              key={id}
              href={`/api/auth/${id}${query}`}
              className="btn btn-outline relative min-h-11 w-full justify-center px-12 text-sm font-semibold"
            >
              {/* Pinned left, label centred: the marks are different widths and
                  a flex row would leave the two labels at different offsets. */}
              <Icon size={18} className="absolute left-4" />
              {t.auth.continueWith.replace("{provider}", label)}
            </a>
          ) : (
            <button
              key={id}
              type="button"
              disabled
              /* `aria-describedby`, so the reason is read out with the button
                 rather than sitting on the page as an unattached sentence. */
              aria-describedby="social-unavailable"
              className="btn btn-outline relative min-h-11 w-full cursor-not-allowed justify-center px-12 text-sm font-semibold opacity-55"
            >
              <Icon size={18} className="absolute left-4" />
              {t.auth.continueWith.replace("{provider}", label)}
            </button>
          ),
        )}
      </div>

      {anyOff && (
        <p id="social-unavailable" className="-mt-1 text-center text-xs text-ink-400">
          {t.auth.socialUnavailable}
        </p>
      )}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-400">{t.auth.or}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
