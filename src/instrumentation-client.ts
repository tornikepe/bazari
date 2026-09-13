import * as Sentry from "@sentry/nextjs";
import { sentryEnabled, sentryOptions } from "@/lib/sentry-config";

/**
 * Browser-side error tracking, only when there is a DSN.
 *
 * Runs before the app is interactive. Session replay and performance
 * tracing are deliberately not switched on: this is a record of what broke,
 * not a recording of what people did.
 */
if (sentryEnabled()) {
  Sentry.init(sentryOptions);
}

/** Lets the SDK name a navigation, when it is on. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
