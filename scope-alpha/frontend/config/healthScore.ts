/**
 * Health Score configuration.
 *
 * The health composite scorer in lib/market/health.ts uses these thresholds
 * to decide each component's 0..25 contribution and the regime label. Tuning
 * here is safe — no code changes required.
 */

/**
 * Legacy 5-band regime thresholds (Phase 1).
 * Kept for backward compat; v2 uses REGIME_V2_BANDS below.
 */
export const REGIME_THRESHOLDS = {
  RISK_OFF: 25,
  CAUTIOUS: 40,
  NEUTRAL: 60,
  RISK_ON: 80,
} as const;

/**
 * Phase 2: 7-band regime classification per PRD §4.6.
 * score < min → (we return "extreme_fear"), score >= max → "euphoria".
 */
export type RegimeV2 =
  | 'extreme_fear'
  | 'bearish'
  | 'cautious'
  | 'neutral'
  | 'optimistic'
  | 'bullish'
  | 'euphoria';

export interface RegimeBand {
  label: RegimeV2;
  /** Upper bound (exclusive), except for the last band. */
  max: number;
  /** Tailwind-compatible hex color used by RegimeBadge. */
  color: string;
  /** Human-readable description. */
  description: string;
}

export const REGIME_V2_BANDS: RegimeBand[] = [
  { label: 'extreme_fear', max: 15,  color: '#7f1d1d', description: 'Capitulation — heavy liquidations, negative funding' },
  { label: 'bearish',      max: 30,  color: '#dc2626', description: 'Sustained selling pressure' },
  { label: 'cautious',     max: 45,  color: '#f97316', description: 'Mixed signals, slight bearish lean' },
  { label: 'neutral',      max: 55,  color: '#9ca3af', description: 'No clear directional bias' },
  { label: 'optimistic',   max: 70,  color: '#86efac', description: 'Positive bias, moderate long positioning' },
  { label: 'bullish',      max: 85,  color: '#22c55e', description: 'Strong long bias, positive funding, rising OI' },
  { label: 'euphoria',     max: 101, color: '#eab308', description: 'Extreme long bias, potential overheating' },
];

/**
 * Trend direction labels derived from change24h/change7d deltas.
 */
export type TrendDirection =
  | 'rapidly_improving'
  | 'improving'
  | 'stable'
  | 'deteriorating'
  | 'rapidly_deteriorating';

export type TrendMomentum = 'accelerating' | 'steady' | 'decelerating';

/**
 * Score-delta bands for trend direction classification.
 * Applied to change24h (primary).
 */
export const TREND_BANDS: Array<{ min: number; label: TrendDirection }> = [
  { min: 15,  label: 'rapidly_improving' },
  { min: 5,   label: 'improving' },
  { min: -5,  label: 'stable' },
  { min: -15, label: 'deteriorating' },
  { min: -Infinity, label: 'rapidly_deteriorating' },
];

/**
 * Funding z-score → component score (out of 25).
 * Extreme |z| ≫ 0 means funding is stretched, unhealthy. z near 0 is healthy.
 */
export const FUNDING_Z_BANDS: Array<{ max: number; score: number }> = [
  { max: 0.5, score: 25 },
  { max: 1.0, score: 22 },
  { max: 1.5, score: 17 },
  { max: 2.0, score: 11 },
  { max: 3.0, score: 5 },
  { max: Infinity, score: 1 },
];

/**
 * 24h OI percentage move → component score. Small moves = stable = healthy.
 */
export const OI_CHANGE_BANDS: Array<{ max: number; score: number }> = [
  { max: 2, score: 25 },
  { max: 5, score: 22 },
  { max: 10, score: 17 },
  { max: 15, score: 11 },
  { max: 25, score: 6 },
  { max: Infinity, score: 2 },
];

/**
 * Basis percentage magnitude → component score.
 */
export const BASIS_BANDS: Array<{ max: number; score: number }> = [
  { max: 0.05, score: 25 },
  { max: 0.15, score: 22 },
  { max: 0.3, score: 17 },
  { max: 0.6, score: 11 },
  { max: 1.0, score: 6 },
  { max: Infinity, score: 2 },
];

/** Default score when a component can't be computed (missing data). */
export const DEFAULT_COMPONENT_SCORE = 12;

/** Special default for liquidation when snapshot is empty/null. */
export const DEFAULT_LIQUIDATION_SCORE = 15;

/** Component weights when on-chain data is NOT available (must sum to 1.0). */
export const COMPONENT_WEIGHTS = {
  funding: 0.3,
  oi: 0.25,
  liquidation: 0.25,
  basis: 0.2,
} as const;

/** Component weights when on-chain data IS available (v2, must sum to 1.0). */
export const COMPONENT_WEIGHTS_V2 = {
  funding: 0.225,  // 30% × 0.75
  oi: 0.1875,      // 25% × 0.75
  liquidation: 0.1875,
  basis: 0.15,
  onchain: 0.25,
} as const;

export function pickScore(
  value: number,
  bands: Array<{ max: number; score: number }>,
): number {
  const abs = Math.abs(value);
  for (const band of bands) {
    if (abs < band.max) return band.score;
  }
  return bands[bands.length - 1].score;
}
