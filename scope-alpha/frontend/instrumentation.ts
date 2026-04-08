/**
 * Next.js instrumentation hook (Phase 7).
 *
 * Imports the per-runtime Sentry config files. Each file is a no-op when
 * SENTRY_DSN is missing or @sentry/nextjs is not installed, so this is safe
 * to ship even in dev/inert environments.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
