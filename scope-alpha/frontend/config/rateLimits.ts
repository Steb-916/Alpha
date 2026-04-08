/**
 * Phase 7: per-route rate limit configuration.
 *
 * Each entry is `{ window: seconds, max: count }`. Lookups fall back to
 * `default` for any unlisted key. Identifiers are user IDs when available,
 * otherwise client IP.
 */

export const RATE_LIMITS = {
  // Auth
  'auth/signup': { window: 3600, max: 10 },
  'auth/login': { window: 300, max: 20 },
  'auth/password-reset': { window: 3600, max: 5 },
  'auth/verify-email': { window: 300, max: 3 },

  // Signals
  'signals/create': { window: 3600, max: 50 },
  'signals/resolve': { window: 3600, max: 50 },
  'signals/screenshot': { window: 3600, max: 10 },

  // Subscriptions
  'subscriptions/checkout': { window: 3600, max: 20 },
  'subscriptions/cancel': { window: 3600, max: 10 },

  // Social
  follow: { window: 3600, max: 60 },
  like: { window: 3600, max: 120 },
  bookmark: { window: 3600, max: 120 },
  'review/create': { window: 86400, max: 10 },
  'review/vote': { window: 3600, max: 20 },

  // Chat
  'chat/message': { window: 60, max: 30 },
  'chat/media': { window: 3600, max: 10 },

  // Portfolio
  'portfolio/track': { window: 3600, max: 60 },
  'portfolio/close': { window: 3600, max: 60 },

  // Global fallback for unlisted routes
  default: { window: 60, max: 60 },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;
