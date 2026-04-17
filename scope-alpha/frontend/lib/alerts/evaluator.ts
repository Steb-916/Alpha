/**
 * Alert condition evaluator.
 *
 * Given an Alert row + current market context, decide whether the alert
 * should fire and what actual value to record. Pure function — no DB writes.
 */

import type {
  FundingData,
  OpenInterestData,
  BasisData,
  HealthScore,
} from '@/lib/types';
import type { LiqSnapshot } from '@/lib/market/health';
import { getCached, setCached } from '@/lib/cache/redis';

export interface AlertLite {
  id: string;
  type: string;
  condition: string;
  value: number;
  asset: string;
}

export interface EvalContext {
  funding: FundingData | null;
  oi: OpenInterestData | null;
  basis: BasisData | null;
  liquidation: LiqSnapshot | null;
  health: HealthScore | null;
  ticker: { lastPrice: number } | null;
  /** Best arb yield seen for this asset (from arb-scanner cache). */
  arbYield?: number;
  /** Whether a CVD divergence is currently active for this asset. */
  cvdDivergenceActive?: boolean;
}

export interface EvalResult {
  triggered: boolean;
  actualValue: number;
}

function readActualValue(
  alert: AlertLite,
  ctx: EvalContext,
): number | null {
  switch (alert.type) {
    case 'price':
      return ctx.ticker?.lastPrice ?? null;
    case 'funding_rate':
      return ctx.funding?.currentRate ?? null;
    case 'oi_change':
      return ctx.oi?.change24h ?? null;
    case 'liquidation': {
      if (!ctx.liquidation) return null;
      return ctx.liquidation.longUsd + ctx.liquidation.shortUsd;
    }
    case 'basis':
      return ctx.basis?.currentBasis ?? null;
    case 'health_score':
      return ctx.health?.score ?? null;
    case 'arb_yield':
      return ctx.arbYield ?? null;
    case 'cvd_divergence':
      return ctx.cvdDivergenceActive ? 1 : 0;
    default:
      return null;
  }
}

const PREV_KEY = (id: string) => `alert:prev:${id}`;
const PREV_TTL = 24 * 60 * 60;

export async function evaluateAlert(
  alert: AlertLite,
  ctx: EvalContext,
): Promise<EvalResult> {
  const actualValue = readActualValue(alert, ctx);
  if (actualValue == null) {
    return { triggered: false, actualValue: 0 };
  }

  let triggered = false;

  switch (alert.condition) {
    case 'above':
      triggered = actualValue > alert.value;
      break;
    case 'below':
      triggered = actualValue < alert.value;
      break;
    case 'crosses_above': {
      const prev = await getCached<number>(PREV_KEY(alert.id));
      triggered =
        prev != null && prev <= alert.value && actualValue > alert.value;
      await setCached(PREV_KEY(alert.id), actualValue, PREV_TTL);
      break;
    }
    case 'crosses_below': {
      const prev = await getCached<number>(PREV_KEY(alert.id));
      triggered =
        prev != null && prev >= alert.value && actualValue < alert.value;
      await setCached(PREV_KEY(alert.id), actualValue, PREV_TTL);
      break;
    }
    case 'change_exceeds': {
      const prev = await getCached<number>(PREV_KEY(alert.id));
      if (prev != null) {
        const pct = prev !== 0 ? ((actualValue - prev) / prev) * 100 : 0;
        triggered = Math.abs(pct) >= alert.value;
      }
      await setCached(PREV_KEY(alert.id), actualValue, PREV_TTL);
      break;
    }
    default:
      triggered = false;
  }

  // cvd_divergence special case: fire on any divergence regardless of
  // numeric condition (the event itself is the trigger).
  if (alert.type === 'cvd_divergence' && ctx.cvdDivergenceActive) {
    triggered = true;
  }

  return { triggered, actualValue };
}
