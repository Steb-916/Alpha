// ─── Normalized Market Data Types ───────────────────────────────────────────

export interface OHLCV {
  time: number;        // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  exchange: string;
  symbol: string;
  interval: string;
  isClosed: boolean;   // Whether this candle is finalized
  /**
   * Taker buy base-asset volume — the portion of `volume` attributable to
   * aggressive buyers. Present on Binance kline responses; used by CVD.
   * Optional because other sources (Bybit WS, cached legacy candles) may
   * not populate it.
   */
  takerBuyVolume?: number;
}

export interface FundingRate {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingTime: number;
  markPrice: number;
  nextFundingTime: number;
}

export interface OpenInterest {
  symbol: string;
  exchange: string;
  openInterest: number;      // In contracts
  openInterestValue: number; // In USD
  timestamp: number;
}

export interface Liquidation {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  timestamp: number;
}

export interface Ticker {
  symbol: string;
  exchange: string;
  lastPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface MarkPrice {
  symbol: string;
  exchange: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  timestamp: number;
}

// ─── Exchange Connector Interface ───────────────────────────────────────────

export interface ExchangeConnector {
  name: string;

  // REST methods
  getKlines(
    symbol: string,
    interval: string,
    limit?: number,
    startTime?: number,
    endTime?: number
  ): Promise<OHLCV[]>;

  getFundingRate(symbol: string): Promise<FundingRate>;
  getFundingRateHistory(symbol: string, limit?: number): Promise<FundingRate[]>;
  getOpenInterest(symbol: string): Promise<OpenInterest>;
  getOpenInterestHistory(
    symbol: string,
    period: string,
    limit?: number
  ): Promise<OpenInterest[]>;
  get24hrTicker(symbol?: string): Promise<Ticker[]>;

  // WebSocket methods
  subscribeKline(
    symbol: string,
    interval: string,
    callback: (data: OHLCV) => void
  ): () => void;

  subscribeMarkPrice(
    symbol: string,
    callback: (data: MarkPrice) => void
  ): () => void;

  subscribeLiquidation(
    symbol: string,
    callback: (data: Liquidation) => void
  ): () => void;

  subscribeAllTickers(
    callback: (data: Ticker[]) => void
  ): () => void;

  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
}

// ─── Interval Mapping ───────────────────────────────────────────────────────

export type StandardInterval =
  | '1m' | '3m' | '5m' | '15m' | '30m'
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h'
  | '1d' | '3d' | '1w' | '1M';

// ─── Symbol Tiers ───────────────────────────────────────────────────────────

export const TIER1_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

export const TIER2_SYMBOLS = [
  'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
];

export const ALL_TRACKED_SYMBOLS = [...TIER1_SYMBOLS, ...TIER2_SYMBOLS];

// ─── SSE Event Types ────────────────────────────────────────────────────────

export type SSEEventType =
  | 'kline'
  | 'ticker'
  | 'funding'
  | 'liquidation'
  | 'openInterest'
  | 'heartbeat';

export interface SSEEvent {
  event: SSEEventType;
  data: unknown;
}
