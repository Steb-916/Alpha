/**
 * Black-Scholes Greeks (analytic, European options).
 *
 * Deribit's `get_book_summary_by_currency` endpoint returns mark IV + OI +
 * volume but NOT per-instrument Greeks — those are only exposed via the
 * single-instrument ticker endpoint, which would be one REST call per
 * instrument (500+ per asset per cron run). Computing Greeks analytically
 * from the fields we already have is cheap and exact for European
 * options (which all crypto options are).
 *
 * Conventions:
 *   - sigma is decimal (e.g. 0.523 for 52.3% IV)
 *   - T is in calendar years (crypto = 24/7, so days/365)
 *   - r is the risk-free rate as a decimal; default 0 for crypto
 *   - vega is scaled per 1% IV move (output × 0.01) to match common usage
 *   - theta is scaled per calendar day (output / 365)
 */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/**
 * Standard-normal CDF via the Abramowitz & Stegun 7.1.26 approximation.
 * Max error ~1.5e-7 — more than enough for options Greeks.
 */
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absX);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

export interface BSGreeks {
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
}

export function blackScholesGreeks(params: {
  spot: number;
  strike: number;
  timeYears: number;
  sigma: number;
  optionType: 'call' | 'put';
  riskFreeRate?: number;
}): BSGreeks | null {
  const { spot, strike, timeYears, sigma, optionType } = params;
  const r = params.riskFreeRate ?? 0;

  if (
    !Number.isFinite(spot) ||
    !Number.isFinite(strike) ||
    !Number.isFinite(timeYears) ||
    !Number.isFinite(sigma) ||
    spot <= 0 ||
    strike <= 0 ||
    sigma <= 0 ||
    timeYears <= 0
  ) {
    return null;
  }

  const sqrtT = Math.sqrt(timeYears);
  const sigmaSqrtT = sigma * sqrtT;
  const d1 =
    (Math.log(spot / strike) + (r + 0.5 * sigma * sigma) * timeYears) /
    sigmaSqrtT;
  const d2 = d1 - sigmaSqrtT;

  const pdfD1 = normPdf(d1);
  const gamma = pdfD1 / (spot * sigmaSqrtT);
  const vegaRaw = spot * pdfD1 * sqrtT;
  const vega = vegaRaw * 0.01; // per 1% IV move

  const discount = Math.exp(-r * timeYears);

  if (optionType === 'call') {
    const delta = normCdf(d1);
    const thetaYear =
      -(spot * pdfD1 * sigma) / (2 * sqrtT) -
      r * strike * discount * normCdf(d2);
    return { delta, gamma, vega, theta: thetaYear / 365 };
  }

  // Put
  const delta = normCdf(d1) - 1;
  const thetaYear =
    -(spot * pdfD1 * sigma) / (2 * sqrtT) +
    r * strike * discount * normCdf(-d2);
  return { delta, gamma, vega, theta: thetaYear / 365 };
}
