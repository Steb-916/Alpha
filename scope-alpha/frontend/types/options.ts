/**
 * Shared options + volatility analytics types.
 *
 * These are the shapes exchanged between the Vercel backend and the Python
 * Quant Engine, and the shapes our hooks/components consume. The Quant
 * Engine is built by the quant partner; the Python side must conform to
 * these contracts.
 */

import type { OptionsChainEntry } from '@/lib/exchanges/deribit-types';

// ─── Vol Surface ───────────────────────────────────────────────────────────

export interface VolSurfaceInput {
  asset: string;
  spot_price: number;
  options: Array<{
    strike: number;
    expiry_days: number;
    option_type: 'call' | 'put';
    mark_iv: number;
    bid_iv: number | null;
    ask_iv: number | null;
    open_interest: number;
    volume_24h: number;
  }>;
  expirations: Array<{ date: string; days_to_expiry: number }>;
}

export interface VolSurfacePoint {
  strike: number;
  delta: number;
  expiry_days: number;
  expiry_date: string;
  raw_iv: number;
  fitted_iv: number;
  residual: number;
}

export interface VolSurfaceOutput {
  asset: string;
  spot_price: number;
  surface: VolSurfacePoint[];
  fit_quality: {
    rmse: number;
    max_residual: number;
    method: string;
  };
  summary: {
    atm_iv_by_expiry: Array<{ expiry_days: number; atm_iv: number }>;
    skew_25d_by_expiry: Array<{ expiry_days: number; skew_25d: number }>;
  };
  computed_at: string;
}

// ─── RND ───────────────────────────────────────────────────────────────────

export interface RNDInput {
  asset: string;
  spot_price: number;
  expiry_date: string;
  expiry_days: number;
  risk_free_rate: number;
  options: Array<{
    strike: number;
    call_price_usd: number;
    iv: number;
    option_type: 'call' | 'put';
  }>;
}

export interface RNDOutput {
  asset: string;
  expiry_date: string;
  expiry_days: number;
  spot_price: number;
  density: Array<{ price: number; probability: number }>;
  statistics: {
    mean: number;
    median: number;
    mode: number;
    std_dev: number;
    skewness: number;
    kurtosis: number;
    prob_above_spot: number;
    prob_below_80k: number;
    prob_above_90k: number;
  };
  confidence: {
    method: string;
    n_options_used: number;
    strike_range: [number, number];
    quality: string;
  };
}

// ─── Vol Cone ──────────────────────────────────────────────────────────────

export interface VolConeInput {
  asset: string;
  daily_closes: number[];
  current_atm_iv: number;
}

export interface VolConeWindow {
  days: number;
  current_rv: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
}

export interface VolConeOutput {
  asset: string;
  windows: VolConeWindow[];
  current_atm_iv: number;
  iv_percentile_vs_rv30d: number;
  assessment: string;
}

// ─── VRP ───────────────────────────────────────────────────────────────────

export interface VRPInput {
  asset: string;
  iv_history: Array<{ date: string; atm_iv_30d: number }>;
  rv_history: Array<{ date: string; rv_30d: number }>;
}

export interface VRPOutput {
  asset: string;
  current_vrp: number;
  current_vrp_percentile: number;
  vrp_series: Array<{
    date: string;
    vrp: number;
    iv: number;
    rv: number;
  }>;
  assessment: string;
  mean_vrp: number;
  std_vrp: number;
}

// ─── Skew + Term Structure ─────────────────────────────────────────────────

export interface SkewInput {
  asset: string;
  spot_price: number;
  options: Array<{
    strike: number;
    expiry_days: number;
    option_type: 'call' | 'put';
    mark_iv: number;
    open_interest: number;
  }>;
}

export interface SkewByExpiry {
  expiry_date: string;
  expiry_days: number;
  skew_25d: number;
  skew_10d: number;
  skew_5d: number;
  put_iv_25d: number;
  call_iv_25d: number;
  atm_iv: number;
  smile: Array<{ delta: number; iv: number }>;
}

export interface SkewOutput {
  asset: string;
  by_expiry: SkewByExpiry[];
  term_structure: Array<{ expiry_days: number; atm_iv: number }>;
  term_structure_shape: 'contango' | 'backwardation' | 'flat';
}

// ─── Phase 4 — Options Microstructure ──────────────────────────────────────
//
// GEX, DEX, vanna, and charm exposure maps. Computed in TypeScript directly
// from the Deribit chain (Deribit provides delta/gamma/vega/theta per
// instrument, so no Black-Scholes re-derivation is needed — we aggregate).
//
// Dealer-positioning assumption (crypto, not equity): dealers are assumed
// to be net short ~40% of call OI and short ~60% of put OI. This is a
// simplified heuristic documented in the Phase 4 PRD §1; a taker-flow
// reconstruction would be more precise but needs per-trade data we don't
// yet persist.

export type GammaRegime = 'positive_gamma' | 'negative_gamma';
export type DirectionalBias = 'long' | 'short' | 'slightly_long' | 'slightly_short' | 'neutral';
export type Significance = 'low' | 'medium' | 'high';
export type AnomalyType = 'volume_spike' | 'oi_surge' | 'large_premium' | 'unusual_ratio';
export type AnomalySentiment = 'bullish' | 'bearish' | 'neutral';

export interface GEXLevel {
  strike: number;
  gex_usd: number;
  side: 'positive' | 'negative';
}

export interface GEXOutput {
  asset: string;
  spot_price: number;
  levels: GEXLevel[];
  gamma_flip: number;
  total_gex: number;
  regime: GammaRegime;
  regime_description: string;
  call_wall: number;
  put_wall: number;
  interpretation: {
    above_spot: string;
    below_spot: string;
    regime_implications: string;
  };
  computed_at: string;
}

export interface DEXLevel {
  strike: number;
  dex_usd: number;
  direction: 'long' | 'short';
}

export interface DEXOutput {
  asset: string;
  spot_price: number;
  levels: DEXLevel[];
  net_dex: number;
  directional_bias: DirectionalBias;
  interpretation: string;
  computed_at: string;
}

export interface VannaLevel {
  strike: number;
  vanna_exposure: number;
  iv_sensitivity: 'positive' | 'negative';
}

export interface CharmLevel {
  strike: number;
  charm_exposure: number;
}

export interface GreeksExposureOutput {
  asset: string;
  spot_price: number;
  vanna: {
    levels: VannaLevel[];
    net_vanna: number;
    interpretation: string;
  };
  charm: {
    levels: CharmLevel[];
    net_charm: number;
    time_decay_bias: 'bullish' | 'bearish' | 'neutral';
    interpretation: string;
  };
  computed_at: string;
}

export interface PinRiskOutput {
  asset: string;
  expiry_date: string;
  days_to_expiry: number;
  spot_price: number;
  max_pain_strike: number;
  current_distance_pct: number;
  pin_probability: number;
  oi_concentration: number;
  risk_level: 'low' | 'moderate' | 'high';
  assessment: string;
  computed_at: string;
}

export interface FlowAnomaly {
  instrument: string;
  asset: string;
  strike: number;
  option_type: 'call' | 'put';
  expiry_date: string;
  days_to_expiry: number;

  anomaly_type: AnomalyType;

  volume_24h: number;
  open_interest: number;
  oi_change: number;
  oi_change_pct: number;

  volume_ratio: number;
  premium_usd: number;

  sentiment: AnomalySentiment;
  significance: Significance;
  description: string;
}

export interface FlowOutput {
  asset: string;
  spot_price: number;
  anomalies: FlowAnomaly[];
  summary: {
    call_premium_usd: number;
    put_premium_usd: number;
    call_put_ratio: number;
    bias: 'bullish' | 'bearish' | 'neutral';
  };
  computed_at: string;
}

export interface GEXHistoryPoint {
  timestamp: string;
  spot_price: number;
  gamma_flip: number;
  total_gex: number;
  regime: GammaRegime;
  call_wall: number;
  put_wall: number;
  levels: GEXLevel[];
}

export interface GEXHistoryOutput {
  asset: string;
  days: number;
  points: GEXHistoryPoint[];
}

// ─── Re-exports for convenience ────────────────────────────────────────────

export type { OptionsChainEntry };
export type { ChainAggregate, ExpirationSummary } from '@/lib/options/aggregate';
