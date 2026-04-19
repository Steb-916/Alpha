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
import {
  BASIS_BANDS,
  DEFAULT_COMPONENT_SCORE,
  DEFAULT_LIQUIDATION_SCORE,
  FUNDING_Z_BANDS,
  OI_CHANGE_BANDS,
  REGIME_THRESHOLDS,
  pickScore,
} from '@/config/healthScore';
import { classifyRegime } from '@/lib/analytics/regime';
import { computeTrend, type SnapshotLite } from '@/lib/analytics/trend';

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
  if (!funding) return DEFAULT_COMPONENT_SCORE;
  return pickScore(funding.zScore || 0, FUNDING_Z_BANDS);
}

/**
 * OI score: very stable OI is healthy; large 24h moves either way are not.
 */
export function scoreOI(oi: OpenInterestData | null | undefined): number {
  if (!oi) return DEFAULT_COMPONENT_SCORE;
  return pickScore(oi.change24h || 0, OI_CHANGE_BANDS);
}

/**
 * Liquidation score: balanced long/short flow is healthy; one-sided is not.
 * Reads from a snapshot the SSE liquidation pipeline pushes into Redis.
 */
export function scoreLiquidation(snap: LiqSnapshot | null | undefined): number {
  if (!snap || (snap.longUsd === 0 && snap.shortUsd === 0)) {
    return DEFAULT_LIQUIDATION_SCORE;
  }
  const total = snap.longUsd + snap.shortUsd;
  if (total === 0) return DEFAULT_LIQUIDATION_SCORE;
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
  if (!basis) return DEFAULT_COMPONENT_SCORE;
  return pickScore(basis.currentBasis || 0, BASIS_BANDS);
}

// ─── Composite ──────────────────────────────────────────────────────────────

export interface OptionsRegimeInput {
  /** Dealer gamma regime from GEX snapshot. */
  gammaRegime?: 'positive_gamma' | 'negative_gamma';
  /** 25-delta skew at 30d; negative = put-heavy. */
  skew25d?: number;
  /** IV percentile vs 30d realized-vol history (0–100). */
  ivPercentile?: number;
}

/**
 * Phase 5 Slice 3: on-chain regime inputs from the Quant Engine (MVRV) + the
 * refresh-onchain cron (flow regime). Weights are heuristic v1 — recalibrate
 * in Phase 6 against the regime classifier's labeled forward-return data.
 */
export interface OnChainRegimeInput {
  /** Exchange flow regime from /onchain/flow-regime (BTC/ETH only). */
  flowRegime?: 'accumulation' | 'distribution' | 'neutral';
  /** MVRV regime band from /onchain/mvrv (BTC/ETH only). */
  mvrvRegime?: 'deep_value' | 'fair' | 'elevated' | 'euphoria';
}

export function computeHealthScore(args: {
  symbol: string;
  funding: FundingData | null;
  oi: OpenInterestData | null;
  basis: BasisData | null;
  liquidation: LiqSnapshot | null;
  /** Phase 2: historical snapshots for this asset (last ~7d). Optional. */
  history?: SnapshotLite[];
  /** Phase 4: options-positioning context (BTC/ETH only). Optional. */
  options?: OptionsRegimeInput;
  /** Phase 5: on-chain regime context (BTC/ETH only). Optional. */
  onchain?: OnChainRegimeInput;
}): HealthScore {
  const fundingScore = scoreFunding(args.funding);
  const oiScore = scoreOI(args.oi);
  const liqScore = scoreLiquidation(args.liquidation);
  const basisScore = scoreBasis(args.basis);

  let rawScore = fundingScore + oiScore + liqScore + basisScore;

  // Phase 4: apply a small gamma-regime adjustment. Negative gamma amplifies
  // moves — nudge the score away from whatever regime it's closest to, i.e.
  // make Risk-On scores look a little more Risk-On (overheated) and Risk-Off
  // scores a little more Risk-Off (extreme fear). Deliberately small
  // (+/- 3 points) so it tilts the regime classifier without dominating it.
  if (args.options?.gammaRegime === 'negative_gamma') {
    if (rawScore >= 50) rawScore += 3;
    else rawScore -= 3;
  } else if (args.options?.gammaRegime === 'positive_gamma') {
    // Positive gamma dampens — pull score toward neutral.
    if (rawScore > 50) rawScore -= 1.5;
    else if (rawScore < 50) rawScore += 1.5;
  }

  // Phase 5 Slice 3: on-chain regime adjustment. Deliberately modest
  // magnitudes — conservative v1, heuristic, recalibrate in Phase 6 against
  // the regime classifier's labeled forward-return data.
  if (args.onchain?.flowRegime === 'accumulation') {
    rawScore += 3; // symmetric
  } else if (args.onchain?.flowRegime === 'distribution') {
    rawScore -= 3;
  }
  // Asymmetric by design: euphoria historically precedes sharper drawdowns
  // than deep_value precedes rallies. Re-evaluate in Phase 6 against
  // labeled forward-return data from the regime classifier.
  if (args.onchain?.mvrvRegime === 'deep_value') {
    rawScore += 3;
  } else if (args.onchain?.mvrvRegime === 'elevated') {
    rawScore -= 2;
  } else if (args.onchain?.mvrvRegime === 'euphoria') {
    rawScore -= 5;
  }
  // mvrvRegime === 'fair' → no adjustment.

  const score = Math.max(0, Math.min(100, rawScore));

  // Legacy 5-band label (backward compat).
  let regime: HealthScore['regime'];
  if (score < REGIME_THRESHOLDS.RISK_OFF) regime = 'Risk Off';
  else if (score < REGIME_THRESHOLDS.CAUTIOUS) regime = 'Cautious';
  else if (score < REGIME_THRESHOLDS.NEUTRAL) regime = 'Neutral';
  else if (score < REGIME_THRESHOLDS.RISK_ON) regime = 'Risk On';
  else regime = 'Overheated';

  const regimeV2 = classifyRegime(score);

  const base: HealthScore = {
    symbol: args.symbol,
    score,
    regime,
    components: {
      funding: fundingScore,
      oi: oiScore,
      liquidation: liqScore,
      basis: basisScore,
    },
    regimeV2: regimeV2.label,
    regimeColor: regimeV2.color,
  };

  // Trend + sparklines only when history is provided.
  if (args.history && args.history.length > 0) {
    const current: SnapshotLite = {
      score,
      funding: fundingScore,
      oi: oiScore,
      liquidation: liqScore,
      basis: basisScore,
      timestamp: new Date(),
    };
    const trend = computeTrend(current, args.history);
    base.trend = {
      direction: trend.direction,
      momentum: trend.momentum,
      change24h: trend.change24h,
      change7d: trend.change7d,
    };
    base.sparkline24h = trend.sparkline24h;
    base.componentSparklines = trend.componentSparklines;
  }

  return base;
}

export const LIQ_SNAPSHOT_KEY = (symbol: string) =>
  `market:liq-snapshot:${symbol}`;
