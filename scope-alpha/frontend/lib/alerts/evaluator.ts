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
import type {
  OnChainFlowsResponse,
  OnChainSupplyResponse,
  WhaleTransactionRecord,
} from '@/types/onchain';
import type { RegimeCurrentResponse } from '@/types/regime';
import { getCached, setCached } from '@/lib/cache/redis';

export interface AlertLite {
  id: string;
  type: string;
  condition: string;
  value: number;
  asset: string;
  /**
   * Phase 5 Slice 3: durable per-alert state surviving Redis eviction.
   * - *_regime_change alerts: last-observed regime string (fire iff different).
   * - whale_large_transfer alerts: last-fired whale txHash (skip if seen).
   * - Null for all other alert types.
   */
  lastObservedState: string | null;
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
  /** Phase 5: latest on-chain supply response (BTC/ETH only); carries MVRV regime. */
  onchainSupply?: OnChainSupplyResponse | null;
  /** Phase 5: latest on-chain flows response (BTC/ETH only); carries flow regime. */
  onchainFlows?: OnChainFlowsResponse | null;
  /** Phase 5: recent whale transfers from the poll-whales Redis buffer. */
  recentWhaleTransfers?: WhaleTransactionRecord[];
  /** Phase 6: current regime envelope (BTC/ETH only). Null when classifier inert. */
  currentRegime?: RegimeCurrentResponse | null;
}

export interface EvalResult {
  triggered: boolean;
  actualValue: number;
  /**
   * Phase 5 Slice 3: when the evaluator decides the alert's durable state
   * should advance, it returns the new value here and the runner persists it
   * to Alert.lastObservedState. Undefined = no state change (don't touch the
   * column). Null = explicit clear (rare).
   */
  nextObservedState?: string | null;
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
    // Phase 5 Slice 3 — on-chain alerts. actualValue for regime alerts is a
    // sentinel (0/1) since the real "did it change?" logic is state-based
    // below; whale_large_transfer returns the highest *unseen* transfer USD
    // value (0 if nothing qualifies).
    case 'onchain_flow_regime_change': {
      const regime = ctx.onchainFlows?.regime?.regime;
      return regime == null ? null : 0; // sentinel — state logic handles trigger
    }
    case 'mvrv_regime_change': {
      const regime = ctx.onchainSupply?.mvrv?.current.regime;
      return regime == null ? null : 0;
    }
    case 'whale_large_transfer': {
      const transfers = ctx.recentWhaleTransfers ?? [];
      const seenHash = alert.lastObservedState;
      const unseen = transfers.filter((t) => t.txHash !== seenHash);
      if (unseen.length === 0) return 0;
      return Math.max(...unseen.map((t) => t.valueUsd));
    }
    case 'regime_change': {
      // Sentinel — state logic handled in the post-switch block.
      return ctx.currentRegime?.classification != null ? 0 : null;
    }
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

  // ─── Phase 5 Slice 3 — on-chain alerts ────────────────────────────────────
  //
  // These use durable state on Alert.lastObservedState (not Redis) so that
  // regime transitions during long-dormant periods don't produce false fires
  // after 24h Redis TTL eviction. The runner persists the returned
  // nextObservedState.

  let nextObservedState: string | null | undefined = undefined;

  if (alert.type === 'onchain_flow_regime_change') {
    const current = ctx.onchainFlows?.regime?.regime ?? null;
    if (current != null) {
      if (alert.lastObservedState == null) {
        // First observation — seed state, do NOT fire.
        nextObservedState = current;
        triggered = false;
      } else if (alert.lastObservedState !== current) {
        // Regime transition — fire and record new regime.
        nextObservedState = current;
        triggered = true;
      }
      // Else same regime as stored → no state change, no fire.
    }
  }

  if (alert.type === 'mvrv_regime_change') {
    const current = ctx.onchainSupply?.mvrv?.current.regime ?? null;
    if (current != null) {
      if (alert.lastObservedState == null) {
        nextObservedState = current;
        triggered = false;
      } else if (alert.lastObservedState !== current) {
        nextObservedState = current;
        triggered = true;
      }
    }
  }

  if (alert.type === 'whale_large_transfer') {
    const transfers = (ctx.recentWhaleTransfers ?? []).filter(
      (t) => t.txHash !== alert.lastObservedState && t.valueUsd >= alert.value,
    );
    if (transfers.length > 0) {
      // Highest-value unseen qualifying transfer triggers the alert.
      // Dedupe on txHash — re-observation of the same hash never re-fires.
      const top = transfers.reduce(
        (max, t) => (t.valueUsd > max.valueUsd ? t : max),
        transfers[0],
      );
      nextObservedState = top.txHash;
      triggered = true;
    }
    // Note: we do NOT seed lastObservedState when no qualifying transfer is
    // present. An empty buffer / all-below-threshold means no state advance —
    // the next whale ≥ threshold will be the first-observed from our POV.
  }

  // Phase 6 Slice 1 — regime_change alert. Uses the same Alert.lastObservedState
  // durable-state pattern as the Phase 5 Slice 3 regime-change alerts. The
  // classifier's persistence filter already suppresses flicker, so a fired
  // regime_change alert reflects a genuinely committed transition.
  if (alert.type === 'regime_change') {
    const current = ctx.currentRegime?.classification?.committed_regime ?? null;
    if (current != null) {
      if (alert.lastObservedState == null) {
        // First observation — seed state, do NOT fire.
        nextObservedState = current;
        triggered = false;
      } else if (alert.lastObservedState !== current) {
        // Regime transitioned — fire and record the new regime.
        nextObservedState = current;
        triggered = true;
      }
      // Else same regime as stored → no state change, no fire.
    }
  }

  return { triggered, actualValue, nextObservedState };
}
