/**
 * Phase 7 Sentry client config (inert when SENTRY_DSN missing or
 * @sentry/nextjs not installed).
 *
 * The config files exist as no-ops so Next.js's instrumentation hook can
 * import them safely. Real init only happens when both prerequisites are
 * satisfied.
 */

if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line no-eval
    const req = eval('require') as NodeJS.Require;
    const Sentry = req('@sentry/nextjs');
    Sentry.init({
      dsn:
        process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
  } catch {
    // @sentry/nextjs not installed — silent no-op.
  }
}

export {};
