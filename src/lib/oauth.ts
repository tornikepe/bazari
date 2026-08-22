import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/site";

/**
 * Sign-in with Google and Facebook.
 *
 * Written against the raw OAuth 2.0 authorization-code flow rather than an
 * auth library. The whole surface is two providers and about a hundred lines;
 * a framework here would be more configuration than code, and the security
 * decisions below are ones worth being able to read.
 *
 * A provider is only offered when both its id and secret are configured, the
 * same way the chat assistant is. An unconfigured deployment renders no button
 * rather than one that fails after a round trip to Google.
 *
 * ## The parts that are not optional
 *
 * **state** — a random value stored in a short-lived, http-only cookie and
 * echoed through the provider. Without it, anyone can send a victim a crafted
 * callback URL carrying the attacker's authorization code and silently link
 * the attacker's identity to the victim's session. It is checked on return and
 * the cookie is deleted whether or not it matched.
 *
 * **PKCE** — a random verifier kept server-side; only its SHA-256 goes to the
 * provider. It means an intercepted authorization code cannot be redeemed by
 * anyone who does not also hold the verifier. Google supports it; Facebook
 * does too, and both get it.
 *
 * **A verified email** — the account is matched to an existing one by email
 * address, so an unverified email from a provider would be an account
 * takeover: register `someone@gmail.com` at a sloppy provider, sign in here,
 * and inherit their orders. Google states `email_verified` explicitly and it
 * is required to be true. Facebook only returns an email at all once it has
 * confirmed it, and omits the field otherwise — so a missing email is refused
 * rather than worked around.
 */

export type ProviderId = "google" | "facebook";

type ProviderConfig = {
  id: ProviderId;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  /** Normalises the provider's profile shape into what this app stores. */
  readProfile: (raw: Record<string, unknown>) => { email: string; name: string } | null;
};

const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  google: {
    id: "google",
    label: "Google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    readProfile(raw) {
      // `email_verified` is the whole reason this is safe to match on email.
      if (raw.email_verified !== true) return null;
      const email = typeof raw.email === "string" ? raw.email : "";
      if (!email) return null;
      return { email, name: typeof raw.name === "string" ? raw.name : "" };
    },
  },

  facebook: {
    id: "facebook",
    label: "Facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/v21.0/me?fields=id,name,email",
    scope: "email public_profile",
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    readProfile(raw) {
      // Facebook returns no `email` field at all unless it has confirmed the
      // address, so its absence is the refusal — there is nothing to check.
      const email = typeof raw.email === "string" ? raw.email : "";
      if (!email) return null;
      return { email, name: typeof raw.name === "string" ? raw.name : "" };
    },
  },
};

export function isProviderId(value: string): value is ProviderId {
  return value === "google" || value === "facebook";
}

export function getProvider(id: ProviderId) {
  const provider = PROVIDERS[id];
  return provider.clientId && provider.clientSecret ? provider : null;
}

/**
 * The order the buttons are drawn in, which is deliberate rather than whatever
 * `Object.keys` returns: Google first because it is the one nearly everyone
 * has, and a list whose order moved with the environment would be worse.
 */
export const PROVIDER_ORDER: readonly ProviderId[] = ["google", "facebook"];

/** Whether this deployment can actually complete a round trip to the provider. */
export function isProviderConfigured(id: ProviderId): boolean {
  return getProvider(id) !== null;
}

export function providerLabel(id: ProviderId): string {
  return PROVIDERS[id].label;
}

/** Which buttons can be *used*. Empty when nothing is configured. */
export function configuredProviders() {
  return PROVIDER_ORDER.map((id) => getProvider(id))
    .filter((provider): provider is ProviderConfig => provider !== null)
    .map((provider) => ({ id: provider.id, label: provider.label }));
}

export function redirectUri(id: ProviderId) {
  return `${SITE_URL}/api/auth/${id}/callback`;
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

/** S256, the only PKCE method worth using — `plain` protects against nothing. */
export function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authorizeUrl(
  provider: ProviderConfig,
  { state, verifier }: { state: string; verifier: string },
) {
  const params = new URLSearchParams({
    client_id: provider.clientId!,
    redirect_uri: redirectUri(provider.id),
    response_type: "code",
    scope: provider.scope,
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
  });

  return `${provider.authorizeUrl}?${params}`;
}

/** Exchanges the authorization code, then reads the profile behind it. */
export async function exchangeCode(
  provider: ProviderConfig,
  { code, verifier }: { code: string; verifier: string },
) {
  const tokenResponse = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: provider.clientId!,
      client_secret: provider.clientSecret!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(provider.id),
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) return null;

  const token = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof token.access_token !== "string") return null;

  const profileResponse = await fetch(provider.profileUrl, {
    headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" },
  });
  if (!profileResponse.ok) return null;

  const raw = (await profileResponse.json()) as Record<string, unknown>;
  return provider.readProfile(raw);
}
