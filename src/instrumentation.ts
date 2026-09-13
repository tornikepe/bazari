import type { Instrumentation } from "next";
import { sentryEnabled, sentryOptions } from "@/lib/sentry-config";

/**
 * Server-side error tracking, on both runtimes, only when there is a DSN.
 *
 * `register` runs once per server instance. The SDK is imported inside the
 * branch rather than at the top, so a deployment without Sentry loads none
 * of it.
 */
export async function register() {
  if (!sentryEnabled()) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions);
}

/**
 * What Next hands us when a request fails — a server component, a route
 * handler, a server action. Forwarded with the request's path and the
 * route it matched, and nothing from its body.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!sentryEnabled()) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
};
