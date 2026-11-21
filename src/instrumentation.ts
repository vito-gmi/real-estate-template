import type { Instrumentation } from "next";

/**
 * Server-side observability.
 *
 * Sentry is loaded only when a DSN is configured, so a fresh clone with no
 * credentials still boots. The import lives inside `register` so the SDK is not
 * pulled into every Edge bundle by default.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Validate the environment at boot, so a missing or placeholder secret is
  // reported in the log the moment the server starts, naming the variable,
  // rather than on whichever request first needs it. Next keeps the process
  // running, but every request then fails until the setting is fixed.
  await import("@/env");

  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error) => {
  if (!process.env.SENTRY_DSN) {
    console.error("[onRequestError]", error);
    return;
  }
  const Sentry = await import("@sentry/node");
  Sentry.captureException(error);
};
