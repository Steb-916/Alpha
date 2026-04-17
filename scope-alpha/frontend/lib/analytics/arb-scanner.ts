/**
 * Funding + basis arbitrage opportunity finder.
 *
 * For each enabled asset, compares Binance and Bybit rates and derives:
 *   - net yield of the funding differential (annualized)
 *   - net yield of the basis differential (annualized)
 *   - spread stability: fraction of 30d snapshots where the spread sign
 *     matched the current sign (higher = more persistent)
 *   - risk score: low | medium | high based on stability
 *   - estimated fees: 0.15% baseline assumption (round-trip × 2 exchanges)
 *
 * Returns ordered opportunities. Deliberately self-contained — no UI
 * coupling and no Prisma-model shapes leak out.
 */

import type { FundingData, BasisData } from '@/lib/types';

export type ArbType = 'funding' | 'basis';
export type ArbRisk = 'low' | 'medium' | 'high';

export interface ArbOpportunity {
  asset: string;
  type: ArbType;
  longExchange: 'binance' | 'bybit';
  shortExchange: 'binance' | 'bybit';
  longRate?: number;
  shortRate?: number;
  netRate?: number; // funding only
  basisDiff?: number; // basis only
  annualizedYield: number;
  riskScore: ArbRisk;
  spreadZScore: number;
  spreadStability: number;
  estimatedFees: number;
  netYieldAfterFees: number;
}

export interface SpreadSample {
  asset: string;
  /** Sign-preserved sample: binance − bybit (funding rate or basis %). */
  spread: number;
}

const BASE_FEE_PCT = 0.15;
const MIN_FUNDING_DIFF = 0.00002;
const MIN_BASIS_DIFF = 0.005; // 0.5 bps

function classifyRisk(stability: number): ArbRisk {
  if (stability > 0.7) return 'low';
  if (stability > 0.5) return 'medium';
  return 'high';
}

function zScore(value: number, series: number[]): number {
  if (series.length < 2) return 0;
  const m = series.reduce((s, x) => s + x, 0) / series.length;
  let v = 0;
  for (const x of series) v += (x - m) ** 2;
  const sd = Math.sqrt(v / (series.length - 1));
  return sd > 0 ? (value - m) / sd : 0;
}

function fundingFromData(
  funding: FundingData,
): { binance?: number; bybit?: number } {
  const byEx: { binance?: number; bybit?: number } = {};
  for (const e of funding.byExchange) {
    if (e.exchange.toLowerCase() === 'binance') byEx.binance = e.rate;
    else if (e.exchange.toLowerCase() === 'bybit') byEx.bybit = e.rate;
  }
  return byEx;
}

function basisFromData(
  basis: BasisData,
): { binance?: number; bybit?: number } {
  const byEx: { binance?: number; bybit?: number } = {};
  for (const e of basis.byExchange) {
    if (e.exchange.toLowerCase() === 'binance') byEx.binance = e.basis;
    else if (e.exchange.toLowerCase() === 'bybit') byEx.bybit = e.basis;
  }
  return byEx;
}

/**
 * Given a history of spreads, compute how often the spread sign matches the
 * current sign. Returns a value in [0, 1] (0.5 = random, 1.0 = always same side).
 */
export function spreadStabilityFromHistory(
  history: number[],
  currentSpread: number,
): number {
  if (history.length === 0) return 0.5;
  const sign = Math.sign(currentSpread) || 1;
  const matching = history.filter((s) => Math.sign(s) === sign).length;
  return matching / history.length;
}

/**
 * Build a single funding-arb opportunity from per-exchange rates + history.
 * Returns null if the spread is below the minimum threshold.
 */
export function buildFundingOpportunity(args: {
  asset: string;
  binanceRate: number;
  bybitRate: number;
  history: number[];
}): ArbOpportunity | null {
  const { asset, binanceRate, bybitRate, history } = args;
  const diff = Math.abs(binanceRate - bybitRate);
  if (diff < MIN_FUNDING_DIFF) return null;

  const longExchange: 'binance' | 'bybit' =
    binanceRate < bybitRate ? 'binance' : 'bybit';
  const shortExchange: 'binance' | 'bybit' =
    longExchange === 'binance' ? 'bybit' : 'binance';

  const currentSpread = binanceRate - bybitRate;
  const stability = spreadStabilityFromHistory(history, currentSpread);
  const z = zScore(currentSpread, history);

  const annualized = diff * 3 * 365 * 100;

  return {
    asset,
    type: 'funding',
    longExchange,
    shortExchange,
    longRate: binanceRate < bybitRate ? binanceRate : bybitRate,
    shortRate: binanceRate < bybitRate ? bybitRate : binanceRate,
    netRate: diff,
    annualizedYield: annualized,
    riskScore: classifyRisk(stability),
    spreadZScore: z,
    spreadStability: stability,
    estimatedFees: BASE_FEE_PCT,
    netYieldAfterFees: annualized - BASE_FEE_PCT,
  };
}

/**
 * Build a basis-arb opportunity. Uses the basis differential × 365 as the
 * annualized yield. No z-score (basis spread history not persisted yet).
 */
export function buildBasisOpportunity(args: {
  asset: string;
  binanceBasis: number;
  bybitBasis: number;
}): ArbOpportunity | null {
  const { asset, binanceBasis, bybitBasis } = args;
  const diff = Math.abs(binanceBasis - bybitBasis);
  if (diff < MIN_BASIS_DIFF) return null;

  const longExchange: 'binance' | 'bybit' =
    binanceBasis < bybitBasis ? 'binance' : 'bybit';
  const shortExchange: 'binance' | 'bybit' =
    longExchange === 'binance' ? 'bybit' : 'binance';

  const annualized = diff * 365;
  // No historical basis spread data yet → neutral stability.
  const stability = 0.5;

  return {
    asset,
    type: 'basis',
    longExchange,
    shortExchange,
    basisDiff: diff,
    annualizedYield: annualized,
    riskScore: classifyRisk(stability),
    spreadZScore: 0,
    spreadStability: stability,
    estimatedFees: BASE_FEE_PCT,
    netYieldAfterFees: annualized - BASE_FEE_PCT,
  };
}

export function sortOpportunities(
  ops: ArbOpportunity[],
): ArbOpportunity[] {
  return [...ops].sort((a, b) => b.netYieldAfterFees - a.netYieldAfterFees);
}

/** Re-export helpers for route + table usage. */
export { fundingFromData, basisFromData };
