/**
 * Phase 7 structured logger.
 *
 * In production: emits one JSON line per call so platform log aggregators
 * (Vercel Logs, Datadog, etc.) can index by route/userId/duration/status.
 *
 * In development: pretty-prints with the level prefix for human reading.
 *
 * Use directly:
 *   log('info', 'GET /api/feed', { route: '/api/feed', duration: 42, userId });
 *
 * Or via the higher-level captureRouteError() in lib/sentry.ts which logs
 * AND dispatches to Sentry when configured.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  route?: string;
  userId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export function log(
  level: LogLevel,
  message: string,
  meta?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>,
): void {
  const entry: LogEntry = {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  };

  const console_method =
    level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

  if (process.env.NODE_ENV === 'production') {
    console[console_method](JSON.stringify(entry));
  } else {
    // Pretty dev output
    const tag = `[${level.toUpperCase()}]`;
    const extra =
      meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    console[console_method](`${tag} ${message}${extra}`);
  }
}
