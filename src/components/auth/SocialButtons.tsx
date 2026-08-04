import { configuredProviders } from "@/lib/oauth";
import { getI18n } from "@/lib/locale";
import { GoogleIcon, FacebookIcon } from "@/components/ui/icons";

const ICONS = { google: GoogleIcon, facebook: FacebookIcon };

/**
 * Sign in with Google or Facebook.
 *
 * Renders nothing at all when neither provider is configured, so a deployment
 * without credentials shows a plain email form rather than buttons that fail
 * after a round trip to Google. Same rule the chat launcher follows.
 *
 * A server component, because `configuredProviders` reads environment
 * variables — the client has no business knowing which ones are set.
 */
export async function SocialButtons({ next = "" }: { next?: string }) {
  const providers = configuredProviders();
  if (providers.length === 0) return null;

  const { t } = await getI18n();
  const query = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {providers.map((provider) => {
          const Icon = ICONS[provider.id];
          return (
            // A link, not a form: this is a redirect to a third party, and it
            // changes nothing here until the visitor comes back.
            <a
              key={provider.id}
              href={`/api/auth/${provider.id}${query}`}
              className="btn btn-outline btn-md w-full"
            >
              <Icon size={17} />
              {t.auth.continueWith.replace("{provider}", provider.label)}
            </a>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-400">{t.auth.or}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
