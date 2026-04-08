/**
 * Phase 7 Sentry helper.
 *
 * Inert mode: when SENTRY_DSN is not set OR @sentry/nextjs is not installed,
 * captureRouteError just logs to the structured logger and returns. This
 * means routes can call it unconditionally without breaking dev or builds.
 *
 * When Sentry IS configured, the helper enriches the event with route name,
 * user id, and request params before dispatching.
 */

import { log } from '@/lib/logger';

export interface RouteErrorContext {
  route: string;
  userId?: string | null;
  params?: Record<string, unknown>;
}

let _sentry: typeof import('@sentry/nextjs') | null = null;
let _sentryInitTried = false;

function getSentry(): typeof import('@sentry/nextjs') | null {
  if (_sentryInitTried) return _sentry;
  _sentryInitTried = true;
  if (!process.env.SENTRY_DSN) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _sentry = require('@sentry/nextjs');
  } catch {
    _sentry = null;
  }
  return _sentry;
}

/**
 * Drop into a route catch block:
 *
 *   } catch (error) {
 *     captureRouteError(error, { route: '/api/signals', userId: session?.user?.id });
 *     return NextResponse.json({ error: 'Failed' }, { status: 500 });
 *   }
 */
export function captureRouteError(
  error: unknown,
  context: RouteErrorContext,
): void {
  const message =
    error instanceof Error ? error.message : String(error);

  log('error', `${context.route} failed: ${message}`, {
    route: context.route,
    userId: context.userId ?? undefined,
    metadata: { params: context.params },
  });

  const Sentry = getSentry();
  if (!Sentry) return;
  try {
    Sentry.withScope((scope) => {
      scope.setTag('route', context.route);
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.params) scope.setContext('params', context.params);
      Sentry.captureException(error);
    });
  } catch {
    // Best-effort — never let Sentry crash a request handler.
  }
}
