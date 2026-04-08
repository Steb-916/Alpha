/**
 * Health Score scoring functions.
 *
 * Composite 0–100 score derived from four components:
 *   - funding   (30%)  — z-score normalised "is funding extreme?"
 *   - oi        (25%)  — OI momentum
 *   - liquidation (25%) — long/short imbalance over 24h
 *   - basis     (20%)  — premium/discount vs spot
 *
 * The output regime label uses Scope Alpha's existing 5-band convention:
 * "Risk Off" | "Cautious" | "Neutral" | "Risk On" | "Overheated".
 *
 * Each component returns a value out of 25 (so the four sum to 100), keeping
 * the existing `HealthScore.components` shape from `lib/types.ts` happy.
 */

import type { FundingData, OpenInterestData, BasisData, HealthScore } from '@/lib/types';

export interface LiqSnapshot {
  longUsd: number;
  shortUsd: number;
  count: number;
  ts: number;
}

// ─── Component scorers (each returns 0..25) ─────────────────────────────────

/**
 * Funding score: extreme funding (|z| ≫ 0) is unhealthy. Healthy is z near 0.
 */
export function scoreFunding(funding: FundingData | null | undefined): number {
  if (!funding) return 12;
  const z = Math.abs(funding.zScore || 0);
  if (z < 0.5) return 25;
  if (z < 1.0) return 22;
  if (z < 1.5) return 17;
  if (z < 2.0) return 11;
  if (z < 3.0) return 5;
  return 1;
}

/**
 * OI score: very stable OI is healthy; large 24h moves either way are not.
 */
export function scoreOI(oi: OpenInterestData | null | undefined): number {
  if (!oi) return 12;
  const c = Math.abs(oi.change24h || 0);
  if (c < 2) return 25;
  if (c < 5) return 22;
  if (c < 10) return 17;
  if (c < 15) return 11;
  if (c < 25) return 6;
  return 2;
}

/**
 * Liquidation score: balanced long/short flow is healthy; one-sided is not.
 * Reads from a snapshot the SSE liquidation pipeline pushes into Redis.
 */
export function scoreLiquidation(snap: LiqSnapshot | null | undefined): number {
  if (!snap || (snap.longUsd === 0 && snap.shortUsd === 0)) return 15;
  const total = snap.longUsd + snap.shortUsd;
  if (total === 0) return 15;
  // 0.5 = perfectly balanced, 0 or 1 = fully one-sided.
  const longShare = snap.longUsd / total;
  const imbalance = Math.abs(longShare - 0.5) * 2; // 0..1
  // Map imbalance back to 0..25 (low imbalance = high score).
  return Math.max(0, Math.round((1 - imbalance) * 25));
}

/**
 * Basis score: basis near 0 is healthy; large premium or discount = stretched.
 */
export function scoreBasis(basis: BasisData | null | undefined): number {
  if (!basis) return 12;
  const b = Math.abs(basis.currentBasis || 0);
  if (b < 0.05) return 25;
  if (b < 0.15) return 22;
  if (b < 0.3) return 17;
  if (b < 0.6) return 11;
  if (b < 1.0) return 6;
  return 2;
}

// ─── Composite ──────────────────────────────────────────────────────────────

export function computeHealthScore(args: {
  symbol: string;
  funding: FundingData | null;
  oi: OpenInterestData | null;
  basis: BasisData | null;
  liquidation: LiqSnapshot | null;
}): HealthScore {
  const fundingScore = scoreFunding(args.funding);
  const oiScore = scoreOI(args.oi);
  const liqScore = scoreLiquidation(args.liquidation);
  const basisScore = scoreBasis(args.basis);

  const score = Math.max(
    0,
    Math.min(100, fundingScore + oiScore + liqScore + basisScore),
  );

  let regime: HealthScore['regime'];
  if (score < 25) regime = 'Risk Off';
  else if (score < 40) regime = 'Cautious';
  else if (score < 60) regime = 'Neutral';
  else if (score < 80) regime = 'Risk On';
  else regime = 'Overheated';

  return {
    symbol: args.symbol,
    score,
    regime,
    components: {
      funding: fundingScore,
      oi: oiScore,
      liquidation: liqScore,
      basis: basisScore,
    },
  };
}

export const LIQ_SNAPSHOT_KEY = (symbol: string) =>
  `market:liq-snapshot:${symbol}`;
