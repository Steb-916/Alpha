/**
 * TS live feature builder — Phase 6 Slice 1.
 *
 * Mirrors quant-engine/app/core/feature_builder.py. Both implementations
 * consume the same cache-snapshot dict and must produce identical feature
 * vectors. A shared fixture + parallel Python/TS tests guard against drift.
 *
 * Design split:
 *   - `buildFeatureVectorFromSnapshot(snap)` — pure function. What the
 *     parity test calls. What the Python backfill mirrors.
 *   - `assembleCacheSnapshot(asset)` — async Redis + Prisma reads to
 *     build the snapshot dict. Used by the hourly cron.
 *   - `buildFeatureVector(asset)` — the live-path convenience wrapper.
 *
 * Any feature-formula change updates this file, the Python file, the
 * fixture JSON, and both test files in the same commit.
 */

import type {
  OnChainFlowsResponse,
  OnChainSupplyResponse,
} from '@/types/onchain';
import type {
  RegimeFeatureVector,
  RegimeLabel,
} from '@/types/regime';
import {
  computeHealthScore,
  type LiqSnapshot,
  type OnChainRegimeInput,
  type OptionsRegimeInput,
} from '@/lib/market/health';

// ─── Cache snapshot shape (the intermediate dict) ──────────────────────────

export interface CacheSnapshot {
  asset: string;
  timestamp: string;
  funding?: {
    currentRate?: number;
    zScore?: number;
    change24h?: number;
  } | null;
  oi?: {
    aggregateOI?: number;
    aggregateOIUsd?: number;
    change24h?: number;
    change7d?: number;
  } | null;
  basis?: {
    currentBasis?: number;
  } | null;
  liqSnapshot?: {
    longUsd: number;
    shortUsd: number;
    count: number;
    ts: number;
  } | null;
  onchainSupply?: OnChainSupplyResponse | null;
  onchainFlows?: OnChainFlowsResponse | null;
  gex?: { regime?: 'positive_gamma' | 'negative_gamma' | null } | null;
  iv_percentile_30d?: number | null;
  skew_25d?: number | null;
  vrp_sign?: 'positive' | 'negative' | null;

  // Precomputed rolling percentiles (cron writes these into the snapshot)
  funding_percentile_30d: number;
  basis_percentile: number;
  liquidation_intensity_24h: number;
  whale_intensity_24h?: number | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function coerceFloat(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeGexRegime(
  raw: 'positive_gamma' | 'negative_gamma' | null | undefined,
): 'positive' | 'negative' | null {
  if (raw === 'positive_gamma') return 'positive';
  if (raw === 'negative_gamma') return 'negative';
  return null;
}

// ─── Pure function — parity-tested ──────────────────────────────────────────

/**
 * Core feature-vector builder. Pure dict → vector. Both Python backfill
 * and TS live path call this; parity tests pin the expected output.
 */
export function buildFeatureVectorFromSnapshot(
  snap: CacheSnapshot,
): RegimeFeatureVector {
  // Tier 1 pre-computed rolling scalars — caller's responsibility
  const fundingPercentile = snap.funding_percentile_30d;
  const basisPercentile = snap.basis_percentile;
  const liquidationIntensity = snap.liquidation_intensity_24h;

  // OI change: snapshot stores as percentage (e.g. 6.2 for +6.2%); feature
  // is a fraction (0.062). Normalize.
  const oi = snap.oi ?? {};
  const oiChange7dPct = coerceFloat(oi.change7d) ?? 0;
  const oiChange7d = oiChange7dPct / 100;

  // Health score: recompute from raw inputs every time — never read persisted
  // HealthScoreSnapshot rows (they reflect evolving formula versions).
  const funding = snap.funding ?? {};
  const basis = snap.basis ?? {};
  const liqRaw = snap.liqSnapshot ?? null;

  const liqSnapForHealth: LiqSnapshot | null = liqRaw
    ? {
        longUsd: liqRaw.longUsd,
        shortUsd: liqRaw.shortUsd,
        count: liqRaw.count,
        ts: liqRaw.ts,
      }
    : null;

  const gexRaw = snap.gex?.regime ?? null;
  const optionsInput: OptionsRegimeInput = {
    gammaRegime:
      gexRaw === 'positive_gamma' || gexRaw === 'negative_gamma'
        ? gexRaw
        : undefined,
    skew25d: coerceFloat(snap.skew_25d) ?? undefined,
    ivPercentile: coerceFloat(snap.iv_percentile_30d) ?? undefined,
  };

  const mvrvBlock = snap.onchainSupply?.mvrv?.current;
  const mvrvRegime = mvrvBlock?.regime ?? null;
  const mvrvZ = coerceFloat(mvrvBlock?.z_score) ?? null;

  const flowRegimeBlock = snap.onchainFlows?.regime ?? null;
  const flowRegime = flowRegimeBlock?.regime ?? null;

  const onchainInput: OnChainRegimeInput = {
    flowRegime:
      flowRegime === 'accumulation' ||
      flowRegime === 'distribution' ||
      flowRegime === 'neutral'
        ? flowRegime
        : undefined,
    mvrvRegime:
      mvrvRegime === 'deep_value' ||
      mvrvRegime === 'fair' ||
      mvrvRegime === 'elevated' ||
      mvrvRegime === 'euphoria'
        ? mvrvRegime
        : undefined,
  };

  // Compose a minimal FundingData / OpenInterestData / BasisData for the
  // existing computeHealthScore signature (it accepts the full types; we
  // only need the fields it actually reads — zScore, change24h, currentBasis).
  const health = computeHealthScore({
    symbol: snap.asset,
    funding: funding.zScore != null
      ? ({ zScore: funding.zScore } as unknown as Parameters<typeof computeHealthScore>[0]['funding'])
      : null,
    oi: oi.change24h != null
      ? ({ change24h: oi.change24h } as unknown as Parameters<typeof computeHealthScore>[0]['oi'])
      : null,
    basis: basis.currentBasis != null
      ? ({ currentBasis: basis.currentBasis } as unknown as Parameters<typeof computeHealthScore>[0]['basis'])
      : null,
    liquidation: liqSnapForHealth,
    options: optionsInput,
    onchain: onchainInput,
  });

  return {
    asset: snap.asset,
    timestamp: snap.timestamp,
    funding_percentile_30d: fundingPercentile,
    oi_change_7d: oiChange7d,
    liquidation_intensity_24h: liquidationIntensity,
    basis_percentile: basisPercentile,
    health_score: health.score,
    mvrv_regime: onchainInput.mvrvRegime ?? null,
    mvrv_z_score: mvrvZ,
    iv_percentile: coerceFloat(snap.iv_percentile_30d),
    skew_25d: coerceFloat(snap.skew_25d),
    vrp_sign: snap.vrp_sign ?? null,
    gex_regime: normalizeGexRegime(gexRaw),
    flow_regime: onchainInput.flowRegime ?? null,
    whale_intensity_24h: coerceFloat(snap.whale_intensity_24h),
  };
}

// ─── Cache-assembly helper (async live path) ───────────────────────────────

import { getCached } from '@/lib/cache/redis';
import type { OnChainAsset } from '@/types/onchain';

/**
 * Assemble the cache-snapshot dict from Redis keys. Rolling percentiles
 * degrade to 0.5 (neutral) when the pre-computed field isn't cached —
 * the cron is responsible for keeping them fresh; on cold-cache we
 * prefer a neutral contribution over a classification failure.
 */
export async function assembleCacheSnapshot(
  asset: OnChainAsset,
  timestamp: string,
): Promise<CacheSnapshot> {
  type FundingData = { zScore?: number; currentRate?: number; change24h?: number };
  type OIData = { change24h?: number; change7d?: number; aggregateOIUsd?: number };
  type BasisData = { currentBasis?: number };

  const [funding, oi, basis, liq, onchainSupply, onchainFlows, gex, rolling] =
    await Promise.all([
      getCached<FundingData>(`market:funding:${asset}`),
      getCached<OIData>(`market:oi:${asset}`),
      getCached<BasisData>(`market:basis:${asset}`),
      getCached<CacheSnapshot['liqSnapshot']>(`market:liq-snapshot:${asset}`),
      getCached<OnChainSupplyResponse>(`onchain:supply:${asset}`),
      getCached<OnChainFlowsResponse>(`onchain:flows:${asset}`),
      getCached<{ regime?: 'positive_gamma' | 'negative_gamma' }>(`options:gex:${asset}`),
      getCached<{
        funding_percentile_30d?: number;
        basis_percentile?: number;
        liquidation_intensity_24h?: number;
      }>(`regime:rolling:${asset}`),
    ]);

  // Options IV / skew / VRP summary from Phase 3 cache
  const ivSnap = await getCached<{ iv30d?: number; skew25d30d?: number }>(
    `options:ivsnap:${asset}`,
  );
  const vrpCache = await getCached<{ current_vrp?: number }>(
    `options:vrp:${asset}`,
  );
  const vrpSign: 'positive' | 'negative' | null =
    vrpCache?.current_vrp != null
      ? vrpCache.current_vrp > 0
        ? 'positive'
        : 'negative'
      : null;

  return {
    asset,
    timestamp,
    funding: funding ?? null,
    oi: oi ?? null,
    basis: basis ?? null,
    liqSnapshot: liq ?? null,
    onchainSupply: onchainSupply ?? null,
    onchainFlows: onchainFlows ?? null,
    gex: gex ?? null,
    iv_percentile_30d: ivSnap?.iv30d ?? null,
    skew_25d: ivSnap?.skew25d30d ?? null,
    vrp_sign: vrpSign,
    funding_percentile_30d: rolling?.funding_percentile_30d ?? 0.5,
    basis_percentile: rolling?.basis_percentile ?? 0.5,
    liquidation_intensity_24h: rolling?.liquidation_intensity_24h ?? 0,
    whale_intensity_24h: null, // reserved for future shallow-history input
  };
}

export async function buildFeatureVector(
  asset: OnChainAsset,
  timestamp: string,
): Promise<RegimeFeatureVector> {
  const snap = await assembleCacheSnapshot(asset, timestamp);
  return buildFeatureVectorFromSnapshot(snap);
}

// Re-export the literal union for convenience
export type { RegimeLabel } from '@/types/regime';
