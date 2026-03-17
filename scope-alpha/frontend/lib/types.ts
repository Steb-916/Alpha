export interface Instrument {
  id: number;
  symbol: string;
  name: string;
  slug: string;
  rank: number;
  isActive: boolean;
}

export interface MarketSnapshot {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  change7d: number;
  rank: number;
  sparkline?: number[];
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FundingRate {
  symbol: string;
  exchange: string;
  rate: number;
  time: string;
}

export interface FundingData {
  symbol: string;
  currentRate: number;
  avg8h: number;
  zScore: number;
  annualizedCarry: number;
  history: { time: number; rate: number }[];
  byExchange: { exchange: string; rate: number }[];
}

export interface OpenInterestData {
  symbol: string;
  aggregateOI: number;
  change1h: number;
  change4h: number;
  change24h: number;
  history: { time: number; value: number }[];
  byExchange: { exchange: string; value: number }[];
}

export interface LiquidationEvent {
  time: string;
  symbol: string;
  exchange: string;
  side: "long" | "short";
  amount: number;
  price: number;
}

export interface LiquidationData {
  symbol: string;
  totalLong24h: number;
  totalShort24h: number;
  events: LiquidationEvent[];
  history: { time: number; longVol: number; shortVol: number }[];
}

export interface BasisData {
  symbol: string;
  currentBasis: number;
  annualizedBasis: number;
  history: { time: number; basis: number }[];
  byExchange: { exchange: string; basis: number }[];
}

export interface HealthScore {
  symbol: string;
  score: number;
  regime: "Risk Off" | "Cautious" | "Neutral" | "Risk On" | "Overheated";
  components: {
    funding: number;
    oi: number;
    liquidation: number;
    basis: number;
  };
}

export interface ScreenerRow extends MarketSnapshot {
  fundingRate: number;
  fundingZ: number;
  oi: number;
  oiChange24h: number;
  liq24h: number;
  liqRatio: number;
  basis: number;
  healthScore: number;
  regime: string;
}

export type TimeFrame = "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W";
export type TerminalSection = "dashboard" | "funding" | "oi" | "liquidations" | "basis" | "screener";
