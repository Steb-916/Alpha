/**
 * On-chain analytics types — Phase 5.
 *
 * Contracts shared between the provider layer (lib/onchain/providers/*),
 * the Quant Engine (derived z-scores, regime labels), and the UI hooks.
 *
 * Convention: Quant Engine IO uses snake_case to mirror Python/Pydantic
 * field names (matches types/options.ts). Provider-internal types use
 * camelCase — they don't cross the Python boundary.
 *
 * v1 scope: BTC + ETH, free-tier CoinMetrics community as primary provider.
 * SOPR + per-exchange flow breakdown ship in Slice 2 with a public-chain
 * provider. NVT is derived from available CoinMetrics data.
 */

export type OnChainAsset = 'BTC' | 'ETH';

// ─── Provider primitives (camelCase — TS-internal) ──────────────────────────

/** Single daily observation of the on-chain supply primitives. */
export interface SupplyObservation {
  timestamp: string;
  mvrv: number | null;
  marketCapUsd: number | null;
  supplyNative: number | null;
  priceUsd: number | null;
}

export interface SupplyMetrics {
  asset: OnChainAsset;
  series: SupplyObservation[];
}

/** Daily netflow observation. v1 exposes aggregate only (exchange == 'aggregate'). */
export interface FlowObservation {
  timestamp: string;
  exchange: string;
  inflowUsd: number;
  outflowUsd: number;
  netFlowUsd: number;
}

export interface ExchangeFlowSeries {
  asset: OnChainAsset;
  series: FlowObservation[];
}

export interface NetworkObservation {
  timestamp: string;
  activeAddresses: number | null;
  txCount: number | null;
  /** BTC only on CoinMetrics community (FeeTotNtv * PriceUSD). Null for ETH. */
  feesUsd: number | null;
  /** Available for BTC + ETH via CoinMetrics IssTotUSD (daily issuance in USD). */
  issuanceUsd: number | null;
  /** BTC only on community tier. Null for ETH. */
  hashRate: number | null;
}

export interface NetworkMetrics {
  asset: OnChainAsset;
  series: NetworkObservation[];
}

export interface StablecoinAggregate {
  timestamp: string;
  totalSupplyUsd: number;
  usdtSupplyUsd: number;
  usdcSupplyUsd: number;
  daiSupplyUsd: number;
  /** Supply snapshot deltas from DefiLlama's prev-period fields. */
  supply7dAgoUsd: number | null;
  supply30dAgoUsd: number | null;
  /**
   * Exchange-balance fields are not available from DefiLlama's free API.
   * Kept on the type as optional so an upgraded provider can populate them
   * later; UI hides the card when absent.
   */
  exchangeBalanceUsd: number | null;
  exchangeBalancePct: number | null;
}

/** Historical aggregate stablecoin supply series. */
export interface StablecoinChartPoint {
  timestamp: string;
  totalSupplyUsd: number;
}

/** Response shape for GET /api/market/onchain/stablecoins. */
export interface OnChainStablecoinsResponse {
  aggregate: StablecoinAggregate;
  chart: StablecoinChartPoint[];
  staleness: 'fresh' | 'stale';
  provider_configured: boolean;
}

export type TransferClassification =
  | 'to_exchange'
  | 'from_exchange'
  | 'wallet_to_wallet';

export interface WhaleTransactionRecord {
  asset: OnChainAsset;
  valueUsd: number;
  fromAddress: string;
  toAddress: string;
  fromLabel: string | null;
  toLabel: string | null;
  classification: TransferClassification;
  txHash: string;
  timestamp: string;
}

// ─── Quant Engine contracts (snake_case — matches Pydantic) ────────────────

export type MVRVRegime = 'deep_value' | 'fair' | 'elevated' | 'euphoria';
export type SOPRState = 'profit_taking' | 'neutral' | 'capitulation' | 'recovery';
export type NVTRegime = 'cheap' | 'fair' | 'overvalued';
export type FlowRegime = 'accumulation' | 'distribution' | 'neutral';

export interface MVRVSeriesPoint {
  timestamp: string;
  mvrv: number;
  z_score: number;
  regime: MVRVRegime;
}

export interface MVRVForwardReturns {
  median_90d: number;
  p25_90d: number;
  p75_90d: number;
}

export interface MVRVCurrent {
  mvrv: number;
  z_score: number;
  regime: MVRVRegime;
  historical_percentile: number;
  interpretation: string;
  forward_return_distribution: MVRVForwardReturns | null;
}

export interface MVRVOutput {
  asset: OnChainAsset;
  computed_at: string;
  lookback_days: number;
  current: MVRVCurrent;
  series: MVRVSeriesPoint[];
}

export interface SOPRCurrent {
  sopr: number;
  ema_7d: number;
  state: SOPRState;
  crossed_one_days_ago: number | null;
  interpretation: string;
}

export interface SOPRSeriesPoint {
  timestamp: string;
  sopr: number;
  ema_7d: number;
  state: SOPRState;
}

export interface SOPROutput {
  asset: OnChainAsset;
  computed_at: string;
  current: SOPRCurrent;
  series: SOPRSeriesPoint[];
}

export interface NVTCurrent {
  nvt: number;
  nvt_signal_90d: number;
  historical_percentile: number;
  regime: NVTRegime;
  interpretation: string;
}

export interface NVTOutput {
  asset: OnChainAsset;
  computed_at: string;
  current: NVTCurrent;
  series: Array<{ timestamp: string; nvt: number; nvt_signal_90d: number }>;
}

export interface FlowRegimeOutput {
  asset: OnChainAsset;
  computed_at: string;
  regime: FlowRegime;
  regime_confidence: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  baseline_net_flow_90d_usd: number;
  interpretation: string;
  historical_regime_distribution: Record<FlowRegime, number>;
}

// ─── API route response shapes ─────────────────────────────────────────────

/**
 * Response from GET /api/market/onchain/supply.
 * Slice 1 ships MVRV live; SOPR is null (deferred — not on free tier).
 */
export interface OnChainSupplyResponse {
  asset: OnChainAsset;
  mvrv: MVRVOutput | null;
  sopr: SOPROutput | null;
  staleness: 'fresh' | 'stale';
  /** Populated when the route is 503-able but still wants to hint at why. */
  provider_configured: boolean;
  quant_engine_configured: boolean;
}

/** Response from GET /api/market/onchain/flows. */
export interface OnChainFlowsResponse {
  asset: OnChainAsset;
  series: FlowObservation[];
  regime: FlowRegimeOutput | null;
  staleness: 'fresh' | 'stale';
  provider_configured: boolean;
  quant_engine_configured: boolean;
}

/**
 * Response from GET /api/market/onchain/network.
 * No Quant Engine dependency in Slice 2 — pure CoinMetrics pass-through.
 */
export interface OnChainNetworkResponse {
  asset: OnChainAsset;
  series: NetworkObservation[];
  /** Latest daily snapshot for convenience card rendering. */
  current: {
    activeAddresses: number | null;
    txCount: number | null;
    feesUsd: number | null;
    issuanceUsd: number | null;
  };
  staleness: 'fresh' | 'stale';
  provider_configured: boolean;
}

/** Response from GET /api/market/onchain/whales. */
export interface OnChainWhalesResponse {
  asset: OnChainAsset;
  recent: WhaleTransactionRecord[];
  summary24h: {
    total: number;
    toExchangeUsd: number;
    fromExchangeUsd: number;
    walletToWalletUsd: number;
  };
  provider_configured: boolean;
  seedListVersion: string;
}
