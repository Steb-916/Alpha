/**
 * Shared math utilities used across Phase 2 analytics modules.
 *
 * These are intentionally small and dependency-free so they can be used in
 * route handlers, cron jobs, and client-side computations alike.
 */

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  return Math.sqrt(v / (xs.length - 1));
}

/**
 * Z-score of a single value against a reference series.
 * Returns 0 when the series has <2 points or zero variance.
 */
export function zScore(value: number, series: number[]): number {
  if (series.length < 2) return 0;
  const m = mean(series);
  const sd = stddev(series);
  if (sd === 0) return 0;
  return (value - m) / sd;
}

/**
 * Gaussian (normal) probability density function.
 * Used by the liquidation heatmap to estimate position-entry distributions.
 */
export function gaussianPDF(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  const coef = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const exp = -0.5 * ((x - mu) / sigma) ** 2;
  return coef * Math.exp(exp);
}

/**
 * Running cumulative sum. Returns a new array the same length as input.
 */
export function cumulativeSum(xs: number[]): number[] {
  const out: number[] = new Array(xs.length);
  let acc = 0;
  for (let i = 0; i < xs.length; i++) {
    acc += xs[i];
    out[i] = acc;
  }
  return out;
}

export type Severity = 'mild' | 'moderate' | 'severe';

/**
 * Classify divergence severity from price and CVD magnitudes.
 * Thresholds are conservative to keep false-positive rate low.
 */
export function classifySeverity(
  priceChangeAbs: number,
  cvdChangeAbs: number,
): Severity {
  // priceChangeAbs is a fraction (0.02 = 2%). cvdChangeAbs is raw CVD units.
  if (priceChangeAbs > 0.03 && cvdChangeAbs > 1000) return 'severe';
  if (priceChangeAbs > 0.015 && cvdChangeAbs > 500) return 'moderate';
  return 'mild';
}

/**
 * Clamp a number to [min, max].
 */
export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
