/**
 * On-chain signal → health score component.
 * Returns 0..25 contribution for the Derivatives Health Composite v2.
 *
 * Scoring logic (each sub-component out of ~8-9 points):
 *  - MVRV Z-Score: extreme overvalued (z>3)=0, fair=4-5, extreme undervalued (z<0)=9
 *  - SOPR: selling at big profit (>1.05)=0, neutral=4-5, capitulation (<0.95)=9
 *  - Exchange flow trend: large inflows=0, neutral=3-4, large outflows=7
 */

import type { OnChainOverview, ExchangeFlowData } from '@/lib/onchain/types';

function scoreMVRV(z: number | null): number {
  if (z === null) return 4; // neutral default
  if (z > 5) return 0;
  if (z > 3) return 1;
  if (z > 2) return 3;
  if (z > 1) return 5;
  if (z > 0) return 7;
  if (z > -1) return 8;
  return 9;
}

function scoreSOPR(v: number | null): number {
  if (v === null) return 4;
  if (v > 1.10) return 0;
  if (v > 1.05) return 1;
  if (v > 1.02) return 3;
  if (v >= 0.98) return 5;
  if (v >= 0.95) return 7;
  if (v >= 0.90) return 8;
  return 9;
}

function scoreExchangeFlow(flows: ExchangeFlowData | null): number {
  if (!flows) return 3;
  const trend = flows.summary.trend;
  // Large distribution = coins going to exchanges = bearish
  if (trend === 'distribution') return 0;
  if (trend === 'accumulation') return 7;
  return 3;
}

/**
 * Returns 0..25 contribution for the on-chain component of the health score.
 * Higher = healthier (bullish on-chain = healthy for longs).
 */
export function scoreOnChain(
  onchain: OnChainOverview | null,
  flows: ExchangeFlowData | null = null,
): number {
  const mvrvPts = scoreMVRV(onchain?.mvrvZScore ?? null);
  const soprPts = scoreSOPR(onchain?.sopr ?? null);
  const flowPts = scoreExchangeFlow(flows);
  // scale: 9 + 9 + 7 = 25 max
  return Math.max(0, Math.min(25, mvrvPts + soprPts + flowPts));
}
