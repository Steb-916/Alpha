/**
 * Black-Scholes analytical formulas for options Greeks.
 *
 * All inputs use standard mathematical conventions:
 *   S     = underlying spot price
 *   K     = strike price
 *   T     = time to expiry in years  (daysToExpiry / 365)
 *   r     = risk-free rate           (constant 0.05)
 *   sigma = implied vol as decimal   (markIV / 100)
 *
 * Deribit's BookSummary endpoint does not return Greeks; this module derives
 * them analytically from mark IV. Results match Deribit's SVI-fitted values
 * directionally and are accurate enough for GEX / DEX positioning analysis.
 */

/** Abramowitz & Stegun rational approximation — max error < 7.5e-8. */
export function normCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x) / Math.SQRT2);
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))));
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x / 2)));
}

export function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface D1D2 {
  d1: number;
  d2: number;
}

/** Returns d1 and d2, or null when inputs produce undefined values. */
export function computeD1D2(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): D1D2 | null {
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return null;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  return { d1, d2 };
}

/** Delta: dV/dS. Call ∈ (0,1), put ∈ (-1,0). */
export function computeDelta(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: 'call' | 'put',
): number {
  const d = computeD1D2(S, K, T, r, sigma);
  if (!d) return 0;
  if (optionType === 'call') return normCDF(d.d1);
  return normCDF(d.d1) - 1;
}

/** Gamma: d²V/dS². Same for calls and puts. */
export function computeGamma(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  const d = computeD1D2(S, K, T, r, sigma);
  if (!d) return 0;
  return normPDF(d.d1) / (S * sigma * Math.sqrt(T));
}

/**
 * Vanna: d(Delta)/d(sigma) = d(Vega)/dS.
 * Measures how delta changes with implied vol — drives dealer re-hedging
 * when IV moves.
 * Formula: -normPDF(d1) * d2 / sigma
 */
export function computeVanna(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  const d = computeD1D2(S, K, T, r, sigma);
  if (!d) return 0;
  return -normPDF(d.d1) * d.d2 / sigma;
}

/**
 * Charm: d(Delta)/d(T) (time decay of delta).
 * Positive for long calls, negative for long puts.
 * Drives dealer re-hedging into expiration even without price movement.
 *
 * Call charm:  normPDF(d1) * (2rT - d2*sigma*sqrt(T)) / (2T*sigma*sqrt(T))
 * Put charm = call charm (same formula, different sign interpretation)
 */
export function computeCharm(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: 'call' | 'put',
): number {
  const d = computeD1D2(S, K, T, r, sigma);
  if (!d) return 0;
  const sqrtT = Math.sqrt(T);
  const driftTerm = (2 * r * T - d.d2 * sigma * sqrtT) / (2 * T * sigma * sqrtT);
  const base = normPDF(d.d1) * driftTerm;
  // For calls: charm is negative (delta decays toward 0 for OTM calls).
  // For puts: charm is positive (delta decays toward 0 for OTM puts).
  return optionType === 'call' ? -base : base;
}

/** Vega: dV/d(sigma). Same for calls and puts (before multiplying by notional). */
export function computeVega(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  const d = computeD1D2(S, K, T, r, sigma);
  if (!d) return 0;
  return S * normPDF(d.d1) * Math.sqrt(T);
}
