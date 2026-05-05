// ─── Cross-Asset Correlations ─────────────────────────────────────────────────

export type CorrelationAsset = 'BTC' | 'ETH' | 'SPX' | 'GOLD' | 'DXY' | 'NASDAQ';

export interface CorrelationMatrix {
  assets: CorrelationAsset[];
  matrix: number[][];
  rollingBtcSpx: { timestamp: string; correlation: number | null }[];
  computedAt: string;
  windowDays: number;
  _stale?: boolean;
}

// ─── ETF Flows ────────────────────────────────────────────────────────────────

export type EtfTicker = 'IBIT' | 'FBTC' | 'ARKB' | 'BITB' | 'HODL';

export interface EtfFlowDay {
  date: string;
  flows: Record<EtfTicker, number | null>;
  totalFlow: number;
}

export interface EtfFlowData {
  dailyFlows: EtfFlowDay[];
  cumulative: { date: string; totalCumulative: number }[];
  latestDay: EtfFlowDay;
  summary: {
    totalFlowMtd: number;
    totalFlowAllTime: number;
    trend: 'inflow' | 'outflow' | 'mixed';
  };
  seedDate: string;
  isSeeded: boolean;
  _stale?: boolean;
}

// ─── Market Regime ────────────────────────────────────────────────────────────

/**
 * 6-type regime classification per v2 roadmap Phase 6.
 * Risk-On / Risk-Off: directional trending.
 * Accumulation / Distribution: range-bound with valuation bias.
 * Volatile: elevated realized vol, unstable.
 * Compressed: historically low vol, pre-breakout tension.
 */
export type MacroRegimeLabel =
  | 'Risk-On'
  | 'Risk-Off'
  | 'Accumulation'
  | 'Distribution'
  | 'Volatile'
  | 'Compressed';

export interface RegimeFactor {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  weight: number;
  description: string;
}

export interface MacroRegimeResult {
  regime: MacroRegimeLabel;
  confidence: number;
  score: number;
  volState: 'high' | 'normal' | 'compressed';
  factors: {
    btcTrend: RegimeFactor;
    fundingRate: RegimeFactor;
    mvrv: RegimeFactor;
    fearGreed: RegimeFactor;
  };
  history: { timestamp: string; regime: MacroRegimeLabel; score: number }[];
  /** Typical 30-day forward return context for this regime type (seeded). */
  historicalContext: {
    medianReturn30d: number;
    winRate: number;
    avgMaxDrawdown: number;
    sampleCount: number;
  };
  /** Which metrics are most predictive in the current regime. */
  contextualEmphasis: string[];
  computedAt: string;
  _stale?: boolean;
}

// ─── Why Is Price Moving ───────────────────────────────────────────────────────

export interface WhyMovingSignal {
  domain: string;
  observation: string;
  severity: 'high' | 'medium' | 'low';
}

export interface WhyMovingResult {
  asset: string;
  priceChange24h: number;
  isMoving: boolean;
  primaryDriver: WhyMovingSignal | null;
  secondaryDrivers: WhyMovingSignal[];
  narrative: string;
  computedAt: string;
  _stale?: boolean;
}

// ─── Multi-Asset Regime Overview ───────────────────────────────────────────────

export interface RegimeOverviewItem {
  asset: string;
  regime: MacroRegimeLabel;
  confidence: number;
  score: number;
  priceChange24h: number | null;
}

export interface RegimeOverview {
  items: RegimeOverviewItem[];
  computedAt: string;
  _stale?: boolean;
}

// ─── Macro Convergence ────────────────────────────────────────────────────────

export interface MacroSignalDomain {
  name: string;
  score: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  weight: number;
  keyFactor: string;
}

export interface MacroConvergenceScore {
  totalScore: number;
  direction: 'bullish' | 'bearish' | 'mixed';
  confidence: 'high' | 'medium' | 'low';
  domains: {
    derivatives: MacroSignalDomain;
    onchain: MacroSignalDomain;
    macro: MacroSignalDomain;
  };
  agreementCount: number;
  narrative: string;
  computedAt: string;
  _stale?: boolean;
}

// ─── Token Unlocks ────────────────────────────────────────────────────────────

export type UnlockCategory = 'vesting' | 'ecosystem' | 'team' | 'investor' | 'treasury';

export interface TokenUnlockEvent {
  id: string;
  token: string;
  tokenName: string;
  date: string;
  amountNative: number;
  percentOfSupply: number;
  estimatedUsdValue: number | null;
  category: UnlockCategory;
  description: string;
  isConfirmed: boolean;
}

export interface TokenUnlockCalendar {
  events: TokenUnlockEvent[];
  nextUnlock: TokenUnlockEvent | null;
  upcomingCount: number;
  totalValueNext30d: number | null;
  generatedAt: string;
  _stale?: boolean;
}
