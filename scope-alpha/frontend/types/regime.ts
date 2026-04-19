/**
 * Regime classifier types — Phase 6 Slice 1.
 *
 * TS mirrors of the Pydantic contracts in quant-engine/app/models/outputs.py.
 * snake_case matches the existing phase convention (types/options.ts,
 * types/onchain.ts). Live cache payloads, API route responses, and
 * Prisma RegimeSnapshot rows all use these types.
 */

import type { OnChainAsset } from './onchain';

export type RegimeLabel =
  | 'trending_bull'
  | 'trending_bear'
  | 'range_bound'
  | 'volatility_expansion'
  | 'capitulation';

export type RegimeForwardSource = 'backfill' | 'live' | 'mixed';

/** Must match the dataclass in quant-engine/app/core/regime.py. */
export interface RegimeFeatureVector {
  asset: string;
  timestamp: string;

  // Tier 1 — deep history, primary weight
  funding_percentile_30d: number;
  oi_change_7d: number;
  liquidation_intensity_24h: number;
  basis_percentile: number;
  health_score: number;
  mvrv_regime: 'deep_value' | 'fair' | 'elevated' | 'euphoria' | null;
  mvrv_z_score: number | null;

  // Tier 2 — medium history
  iv_percentile: number | null;
  skew_25d: number | null;
  vrp_sign: 'positive' | 'negative' | null;

  // Tier 3 — shallow history, modifier only
  gex_regime: 'positive' | 'negative' | null;
  flow_regime: 'accumulation' | 'distribution' | 'neutral' | null;
  whale_intensity_24h: number | null;
}

export interface FeatureSupport {
  supporting: string[];
  neutral: string[];
  conflicting: string[];
}

export interface RegimeClassification {
  asset: string;
  raw_classification: RegimeLabel;
  committed_regime: RegimeLabel;
  regime_changed: boolean;
  confidence: number;
  feature_support: FeatureSupport;
  reasoning: string;
}

export interface HorizonStat {
  horizon: string; // "7d" | "30d" | "90d"
  median_return: number;
  p25_return: number;
  p75_return: number;
  sample_count: number;
}

export interface ForwardReturnDistribution {
  asset: string;
  regime: RegimeLabel;
  lookback_years: number;
  horizons: HorizonStat[];
  total_observations: number;
  source: RegimeForwardSource;
  observation_window_start: string | null;
  observation_window_end: string | null;
}

// ─── Quant Engine request shapes (match Pydantic inputs) ───────────────────

export interface RegimeClassifyInput {
  asset: string;
  feature_vector: RegimeFeatureVector;
  prev_regime: RegimeLabel | null;
  prev_raw_classification: RegimeLabel | null;
}

export interface ForwardReturnsObservation {
  timestamp: string;
  price: number;
  source: 'backfill' | 'live';
}

export interface ForwardReturnsInput {
  asset: string;
  regime: RegimeLabel;
  observations: ForwardReturnsObservation[];
  full_price_series: Array<{ timestamp: string; price: number }>;
  lookback_years: number;
}

// ─── API route response shapes ─────────────────────────────────────────────

/** GET /api/market/regime/current — live classification + feature breakdown. */
export interface RegimeCurrentResponse {
  asset: OnChainAsset;
  classification: RegimeClassification | null;
  feature_vector: RegimeFeatureVector | null;
  days_in_regime: number | null;
  computed_at: string | null;
  staleness: 'fresh' | 'stale';
  quant_engine_configured: boolean;
}

/** GET /api/market/regime/history — timeline heatmap feed. */
export interface RegimeHistoryPoint {
  timestamp: string;
  committed_regime: RegimeLabel;
  raw_classification: RegimeLabel;
  confidence: number;
  regime_changed: boolean;
}

export interface RegimeHistoryResponse {
  asset: OnChainAsset;
  days: number;
  points: RegimeHistoryPoint[];
}

/** GET /api/market/regime/forward-returns — per-regime historical distribution. */
export interface RegimeForwardReturnsResponse {
  asset: OnChainAsset;
  regime: RegimeLabel;
  distribution: ForwardReturnDistribution | null;
  quant_engine_configured: boolean;
}

/** Persisted Prisma row shape (subset used by API routes). */
export interface RegimeSnapshot {
  id: string;
  asset: string;
  timestamp: string;
  rawClassification: RegimeLabel;
  committedRegime: RegimeLabel;
  regimeChanged: boolean;
  prevRegime: RegimeLabel | null;
  confidence: number;
  featureVector: RegimeFeatureVector;
  featureSupport: FeatureSupport;
}
