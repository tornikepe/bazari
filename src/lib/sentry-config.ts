/**
 * The one decision every Sentry entry point shares: whether there is a DSN.
 *
 * Importable from the browser and the server alike — it reads nothing but
 * two public strings. Without a DSN nothing is initialised on either side,
 * and the site behaves exactly as it did before Sentry existed: the SDK is
 * in the bundle and asleep. With one, errors from the browser, the server
 * and the edge all go to the same project, and a release name ties them to
 * the commit they came from.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export const sentryEnabled = () => SENTRY_DSN.length > 0;

/** Shared options: sampled traces off — this is error tracking, not APM. */
export const sentryOptions = {
  dsn: SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
  tracesSampleRate: 0,
  // What is sent is an error and its stack. Never a request body, never a
  // cookie: the SDK's defaults already strip those, and this says so.
  sendDefaultPii: false,
} as const;
