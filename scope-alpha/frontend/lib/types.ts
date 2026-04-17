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
  /** Phase 1 legacy label kept for backward compat. */
  regime: "Risk Off" | "Cautious" | "Neutral" | "Risk On" | "Overheated";
  components: {
    funding: number;
    oi: number;
    liquidation: number;
    basis: number;
  };
  /** Phase 2: 7-band regime label (optional for backward compat). */
  regimeV2?:
    | "extreme_fear"
    | "bearish"
    | "cautious"
    | "neutral"
    | "optimistic"
    | "bullish"
    | "euphoria";
  regimeColor?: string;
  trend?: {
    direction:
      | "rapidly_improving"
      | "improving"
      | "stable"
      | "deteriorating"
      | "rapidly_deteriorating";
    change24h: number;
    change7d: number;
    momentum: "accelerating" | "steady" | "decelerating";
  };
  sparkline24h?: number[];
  componentSparklines?: {
    funding: number[];
    oi: number[];
    liquidation: number[];
    basis: number[];
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
  /** Phase 2 additions */
  regimeV2?: string;
  cvdTrend?: "bullish" | "bearish" | "neutral";
  arbYield?: number;
}

export type TimeFrame = "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W";
export type TerminalSection = "dashboard" | "funding" | "oi" | "liquidations" | "basis" | "screener";

// User types
export type UserRole = "subscriber" | "analyst" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  slug: string | null;
  role: UserRole;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: Record<string, string>;
  createdAt: string;
}

export interface AnalystProfileData {
  tagline: string | null;
  primaryAssets: string[];
  tradingStyle: string | null;
  experienceYears: number | null;
  isAcceptingSubscribers: boolean;
}
