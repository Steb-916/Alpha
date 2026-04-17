/**
 * Health Score configuration.
 *
 * The health composite scorer in lib/market/health.ts uses these thresholds
 * to decide each component's 0..25 contribution and the regime label. Tuning
 * here is safe — no code changes required.
 */

/**
 * Regime band boundaries (composite score out of 100).
 * score < RISK_OFF → "Risk Off"
 * score < CAUTIOUS → "Cautious"
 * score < NEUTRAL  → "Neutral"
 * score < RISK_ON  → "Risk On"
 * score ≥ RISK_ON  → "Overheated"
 */
export const REGIME_THRESHOLDS = {
  RISK_OFF: 25,
  CAUTIOUS: 40,
  NEUTRAL: 60,
  RISK_ON: 80,
} as const;

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
