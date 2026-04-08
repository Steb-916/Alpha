/**
 * Phase 7 Sentry edge config. See sentry.client.config.ts for inert mode.
 */

if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line no-eval
    const req = eval('require') as NodeJS.Require;
    const Sentry = req('@sentry/nextjs');
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
