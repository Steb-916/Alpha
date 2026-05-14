export type CorrelationWindow = '30d' | '90d';

export interface AssetCorrelation {
  spx: number | null;
  dxy: number | null;
  gold: number | null;
  tnx: number | null;
}

export interface CorrelationMatrixRow {
  asset: string;
  label: string;
  correlations_30d: AssetCorrelation;
  correlations_90d: AssetCorrelation;
}

export interface CorrelationResponse {
  matrix: CorrelationMatrixRow[];
  computed_at: string;
  quant_engine_configured: boolean;
}

export interface ETFFlowPoint {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
}

export interface ETFSummary {
  ticker: string;
  name: string;
  total_aum_usd: number | null;
  latest_flow_usd: number | null;
}

export interface ETFFlowResponse {
  flows: ETFFlowPoint[];
  etfs: ETFSummary[];
  computed_at: string;
  unavailable?: boolean;
}

export interface TokenUnlockEvent {
  asset: string;
  name: string;
  date: string;
  amount: number;
  amount_unit: string;
  usd_value_estimate: number | null;
  type: 'cliff' | 'linear' | 'one_time';
  description: string;
}

export interface TokenUnlockResponse {
  events: TokenUnlockEvent[];
}
