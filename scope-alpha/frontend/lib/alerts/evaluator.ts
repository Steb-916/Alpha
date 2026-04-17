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
  /** Phase 3: ATM 30d IV (only populated for BTC/ETH). */
  iv30d?: number;
  /** Phase 3: 25-delta skew at 30d (only populated for BTC/ETH). */
  skew25d?: number;
  /** Phase 3: Current VRP (IV − RV) in % (only populated for BTC/ETH). */
  vrp?: number;
  /** Phase 4: gamma flip price level from the latest GEX snapshot. */
  gammaFlip?: number;
  /** Phase 4: dealer gamma regime from the latest GEX snapshot. */
  gammaRegime?: 'positive_gamma' | 'negative_gamma';
  /** Phase 4: highest single-event anomaly score (0=none, 1=high, 0.5=medium). */
  flowAnomalyScore?: number;
  /** Phase 4: highest pin probability across active expirations (0–1). */
  pinRiskMax?: number;
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
    case 'iv_above':
    case 'iv_below':
      return ctx.iv30d ?? null;
    case 'skew_extreme':
      return ctx.skew25d ?? null;
    case 'vrp_extreme':
      return ctx.vrp ?? null;
    // Phase 4 — options microstructure
    case 'gamma_flip_crossed':
      // Used with crosses_above / crosses_below conditions against the
      // gamma-flip level. The comparable stream here is the live price —
      // alert.value is ignored and the stored previous-value logic uses
      // price vs gammaFlip.
      return ctx.ticker?.lastPrice ?? null;
    case 'gex_regime_change':
      // Binary: 1 = positive_gamma, 0 = negative_gamma, null if unknown.
      if (ctx.gammaRegime == null) return null;
      return ctx.gammaRegime === 'positive_gamma' ? 1 : 0;
    case 'flow_anomaly':
      return ctx.flowAnomalyScore ?? null;
    case 'pin_risk_high':
      return ctx.pinRiskMax ?? null;
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

  // Phase 4: gamma_flip_crossed compares live price against the gamma flip
  // level (from the GEX snapshot), not against alert.value. The condition
  // field picks direction: crosses_above means price rose above the flip,
  // crosses_below means price fell below it.
  if (alert.type === 'gamma_flip_crossed' && ctx.gammaFlip != null) {
    const prev = await getCached<number>(PREV_KEY(alert.id));
    if (prev != null) {
      if (alert.condition === 'crosses_above') {
        triggered = prev <= ctx.gammaFlip && actualValue > ctx.gammaFlip;
      } else if (alert.condition === 'crosses_below') {
        triggered = prev >= ctx.gammaFlip && actualValue < ctx.gammaFlip;
      }
    }
    await setCached(PREV_KEY(alert.id), actualValue, PREV_TTL);
  }

  // Phase 4: gex_regime_change fires when the regime flips sign. The
  // stored "previous" value is the last regime read (0 or 1); any change
  // triggers the alert.
  if (alert.type === 'gex_regime_change') {
    const prev = await getCached<number>(PREV_KEY(alert.id));
    if (prev != null && prev !== actualValue) {
      triggered = true;
    }
    await setCached(PREV_KEY(alert.id), actualValue, PREV_TTL);
  }

  // Phase 4: flow_anomaly — trigger when the latest scanner pass has an
  // anomaly with score >= alert.value (high=1, medium=0.5).
  if (alert.type === 'flow_anomaly' && actualValue >= alert.value) {
    triggered = true;
  }

  // skew_extreme / vrp_extreme: fire when absolute magnitude exceeds
  // `alert.value`. Directional interpretation (is skew putskew or callskew?)
  // is left to the user — they can create separate alerts for each sign if
  // they care, or use this single-shot magnitude alert.
  if (
    (alert.type === 'skew_extreme' || alert.type === 'vrp_extreme') &&
    Math.abs(actualValue) > alert.value
  ) {
    triggered = true;
  }

  return { triggered, actualValue };
}
