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

// ─── Re-exports for convenience ────────────────────────────────────────────

export type { OptionsChainEntry };
export type { ChainAggregate, ExpirationSummary } from '@/lib/options/aggregate';

// ─── Phase 4: Options Microstructure ──────────────────────────────────────

export interface GexStrike {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
}

export interface GexByStrike {
  asset: string;
  timestamp: string;
  spot: number;
  gammaFlip: number | null;
  netGammaRegime: 'positive' | 'negative';
  totalNetGex: number;
  strikes: GexStrike[];
}

export interface DexStrike {
  strike: number;
  netDex: number;
  callDex: number;
  putDex: number;
}

export interface DexByStrike {
  asset: string;
  timestamp: string;
  spot: number;
  totalNetDex: number;
  deltaRegime: 'call-heavy' | 'put-heavy' | 'balanced';
  strikes: DexStrike[];
}

export interface VannaCharmStrike {
  strike: number;
  expiration: string;
  daysToExpiry: number;
  vanna: number;
  charm: number;
}

export interface VannaCharmExposure {
  asset: string;
  timestamp: string;
  spot: number;
  strikes: VannaCharmStrike[];
  vannaNet: number;
  charmNet: number;
}

export interface MaxPainExpiration {
  expiration: string;
  daysToExpiry: number;
  maxPain: number | null;
  highestOiStrike: number | null;
  highestOiValue: number;
  spotDistancePct: number | null;
  pinRiskScore: number;
}

export interface MaxPainPinRisk {
  asset: string;
  timestamp: string;
  spot: number;
  expirations: MaxPainExpiration[];
}

export interface OptionsFlowEvent {
  id: string;
  timestamp: string;
  asset: string;
  expiration: string;
  strike: number;
  optionType: 'call' | 'put';
  side: 'buy' | 'sell' | 'unknown';
  size: number;
  premiumUsd: number;
  unusualScore: number;
  instrumentName: string;
}

export interface OptionsFlow {
  asset: string;
  window: string;
  generatedAt: string;
  events: OptionsFlowEvent[];
  netCallPremium: number;
  netPutPremium: number;
  netPremiumFlow: number;
}

export interface CascadeRiskZone {
  priceLevel: number;
  gexContribution: number;
  liqIntensity: number;
  cascadeRisk: 'critical' | 'elevated' | 'moderate' | 'low';
  side: 'long' | 'short';
}

export interface CascadeRiskOverlay {
  asset: string;
  timestamp: string;
  spot: number;
  gammaFlip: number | null;
  zones: CascadeRiskZone[];
  overallRisk: 'critical' | 'elevated' | 'moderate' | 'low';
  narrative: string;
}

export interface GreeksExposureInput {
  asset: string;
  spot: number;
  chain: Array<{
    strike: number;
    daysToExpiry: number;
    optionType: 'call' | 'put';
    markIV: number;
    openInterest: number;
  }>;
}

export interface GexHeatmapSnapshot {
  timestamp: string;
  strikes: GexStrike[];
}

export interface GexHeatmapData {
  asset: string;
  lookback: string;
  dataPoints: number;
  snapshots: GexHeatmapSnapshot[];
}
