/**
 * Signal-related configuration constants.
 *
 * Centralised here so validation, UI, and the API routes all read from
 * the same source of truth.
 */

export const MAX_TARGETS = 5;
export const MIN_TARGETS = 1;

export const ALLOWED_TIMEFRAMES = ['15m', '1H', '4H', '1D', '1W'] as const;
export type Timeframe = (typeof ALLOWED_TIMEFRAMES)[number];

export const ALLOWED_CONVICTIONS = ['low', 'medium', 'high'] as const;
export type Conviction = (typeof ALLOWED_CONVICTIONS)[number];

export const ALLOWED_DIRECTIONS = ['long', 'short'] as const;
export type Direction = (typeof ALLOWED_DIRECTIONS)[number];

export const ALLOWED_STATUSES = [
  'draft',
  'active',
  'cancelled',
  'resolved',
] as const;
export type SignalStatus = (typeof ALLOWED_STATUSES)[number];

// Screenshot constraints (Step 6)
export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_SCREENSHOT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

// closePercent must sum to 100 with this tolerance (handles floating point)
export const CLOSE_PERCENT_EPSILON = 0.01;

// Rate limit on screenshot uploads per analyst per hour
export const SCREENSHOT_UPLOAD_LIMIT_PER_HOUR = 10;
