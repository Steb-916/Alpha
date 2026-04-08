/**
 * Phase 7 Sentry edge config. See sentry.client.config.ts for inert mode.
 */

if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  } catch {
    // @sentry/nextjs not installed — silent no-op.
  }
}

export {};
