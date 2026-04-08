/**
 * Phase 7 rate limiter.
 *
 * Upstash-backed (with in-memory fallback) sliding-window counter keyed by
 * route + identifier. Identifier is the authenticated user ID when present,
 * otherwise the client IP from x-forwarded-for.
 *
 * Usage in a route handler:
 *
 *   const limited = await ensureRateLimit('signals/create', request, session?.user?.id);
 *   if (limited) return limited;
 *
 * `ensureRateLimit` returns a 429 `Response` when the limit is exceeded,
 * otherwise null. Headers `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and
 * `Retry-After` are attached to the 429 response.
 *
 * Failures of the underlying Redis call fail OPEN — Redis outages must not
 * lock real users out.
 */

import { incrementWithExpiry } from '@/lib/cache/redis';
import { RATE_LIMITS, type RateLimitKey } from '@/config/rateLimits';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix seconds
}

/** Best-effort client IP from forwarding headers. */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

/** Lower-level: check the limit. Used by `ensureRateLimit`. */
export async function checkRateLimit(
  key: RateLimitKey | string,
  identifier: string,
): Promise<RateLimitResult> {
  const config =
    (RATE_LIMITS as Record<string, { window: number; max: number }>)[key] ??
    RATE_LIMITS.default;
  const redisKey = `ratelimit:${key}:${identifier}`;

  const { count, ttl } = await incrementWithExpiry(redisKey, config.window);

  return {
    allowed: count <= config.max,
    remaining: Math.max(0, config.max - count),
    resetAt: Math.floor(Date.now() / 1000) + ttl,
  };
}

/**
 * Build a 429 Response from a RateLimitResult. The headers expose the
 * standard rate-limit fields plus a Retry-After hint.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(0, result.resetAt - Math.floor(Date.now() / 1000));
  return new Response(
    JSON.stringify({ error: 'Too many requests', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
        'Retry-After': String(retryAfter),
      },
    },
  );
}

/**
 * One-shot guard for route handlers. Returns a 429 response if the limit
 * was exceeded, otherwise null. Drop two lines into a route immediately
 * after the auth check:
 *
 *   const limited = await ensureRateLimit('signals/create', request, session?.user?.id);
 *   if (limited) return limited;
 */
export async function ensureRateLimit(
  key: RateLimitKey | string,
  request: Request,
  userId?: string | null,
): Promise<Response | null> {
  const identifier = userId && userId.length > 0 ? userId : getClientIp(request);
  const result = await checkRateLimit(key, identifier);
  if (result.allowed) return null;
  return rateLimitResponse(result);
}
