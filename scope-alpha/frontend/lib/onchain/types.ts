// ─── On-Chain Analytics Types ─────────────────────────────────────────────

export interface OnChainOverview {
  asset: string;
  timestamp: string;
  mvrvZScore: number | null;
  mvrvSignal: 'overvalued' | 'fair' | 'undervalued' | null;
  sopr: number | null;
  soprSignal: 'profit' | 'neutral' | 'loss' | null;
  nvtRatio: number | null;
  nvtSignal: 'overvalued' | 'fair' | 'undervalued' | null;
  activeAddresses: number | null;
  supplyOnExchanges: number | null; // percentage 0-100
  realizedCap: number | null;
  marketCap: number | null;
}

export interface ExchangeFlowPoint {
  timestamp: string;
  inflowNative: number;
  outflowNative: number;
  netFlowNative: number;
  inflowUsd: number | null;
  outflowUsd: number | null;
  netFlowUsd: number | null;
}

export interface ExchangeFlowData {
  asset: string;
  days: number;
  points: ExchangeFlowPoint[];
  summary: {
    totalNetFlowNative: number;
    totalNetFlowUsd: number | null;
    trend: 'accumulation' | 'distribution' | 'neutral';
  };
}

export interface SupplyPoint {
  timestamp: string;
  supplyOnExchanges: number | null;
  realizedCap: number | null;
  marketCap: number | null;
}

export interface SupplyData {
  asset: string;
  current: {
    supplyOnExchanges: number | null;
    realizedCap: number | null;
    marketCap: number | null;
    mvrvRatio: number | null;
  };
  history: SupplyPoint[];
}

export interface StablecoinFlowPoint {
  timestamp: string;
  usdtNetFlowNative: number;
  usdcNetFlowNative: number;
  combinedNetFlowUsd: number | null;
}

export interface StablecoinFlowData {
  points: StablecoinFlowPoint[];
  summary: {
    usdtNetFlow7d: number;
    usdcNetFlow7d: number;
    combinedNetFlow7d: number | null;
    trend: 'inflow' | 'outflow' | 'neutral';
  };
}

// Raw CoinMetrics API response shape (community tier)
export interface CoinMetricsTimeseriesItem {
  asset: string;
  time: string;
  [metric: string]: string | number | null;
}

export interface CoinMetricsResponse {
  data: CoinMetricsTimeseriesItem[];
  next_page_token?: string;
}
