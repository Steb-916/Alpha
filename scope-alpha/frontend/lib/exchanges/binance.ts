/**
 * Binance Futures exchange connector.
 * Implements the ExchangeConnector interface for Binance USDT-M Futures.
 */

import type {
  ExchangeConnector,
  OHLCV,
  FundingRate,
  OpenInterest,
  Liquidation,
  Ticker,
  MarkPrice,
} from './types';
import { toBinanceInterval, toBinanceSymbol } from './utils';

const REST_BASE =
  process.env.BINANCE_FUTURES_REST_URL || 'https://fapi.binance.com';
const WS_BASE =
  process.env.BINANCE_FUTURES_WS_URL || 'wss://fstream.binance.com';

// ─── REST Helpers ───────────────────────────────────────────────────────────

async function fetchJSON<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, REST_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 0 }, // no Next.js cache
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Binance REST error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Response type helpers ──────────────────────────────────────────────────

interface BinanceKline {
  0: number;  // Open time
  1: string;  // Open
  2: string;  // High
  3: string;  // Low
  4: string;  // Close
  5: string;  // Volume
  6: number;  // Close time
  7: string;  // Quote asset volume
  8: number;  // Number of trades
  9: string;  // Taker buy base volume
  10: string; // Taker buy quote volume
  11: string; // Ignore
}

interface BinancePremiumIndex {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  interestRate: string;
  time: number;
}

interface BinanceFundingRateHist {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice: string;
}

interface BinanceOI {
  symbol: string;
  openInterest: string;
  time: number;
}

interface BinanceOIHist {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

interface BinanceTicker24hr {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
  openPrice: string;
  count: number;
}

// ─── Binance Connector ──────────────────────────────────────────────────────

export class BinanceConnector implements ExchangeConnector {
  name = 'binance';
  private wsConnections: Map<string, any> = new Map();
  private _connected = false;

  // ── REST Methods ──

  async getKlines(
    symbol: string,
    interval: string,
    limit = 500,
    startTime?: number,
    endTime?: number
  ): Promise<OHLCV[]> {
    const params: Record<string, string> = {
      symbol: toBinanceSymbol(symbol),
      interval: toBinanceInterval(interval),
      limit: String(limit),
    };
    if (startTime) params.startTime = String(startTime);
    if (endTime) params.endTime = String(endTime);

    const raw = await fetchJSON<BinanceKline[]>('/fapi/v1/klines', params);

    return raw.map((k) => ({
      time: Math.floor(k[0] / 1000), // ms → seconds
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      exchange: 'binance',
      symbol: toBinanceSymbol(symbol),
      interval: toBinanceInterval(interval),
      isClosed: true, // historical klines are always closed
    }));
  }

  async getFundingRate(symbol: string): Promise<FundingRate> {
    const data = await fetchJSON<BinancePremiumIndex[]>('/fapi/v1/premiumIndex', {
      symbol: toBinanceSymbol(symbol),
    });
    const d = data[0] || data;
    const item = Array.isArray(d) ? d : d as unknown as BinancePremiumIndex;
    const pi = (Array.isArray(data) ? data[0] : data) as BinancePremiumIndex;
    return {
      symbol: toBinanceSymbol(symbol),
      exchange: 'binance',
      fundingRate: parseFloat(pi.lastFundingRate),
      fundingTime: pi.time,
      markPrice: parseFloat(pi.markPrice),
      nextFundingTime: pi.nextFundingTime,
    };
  }

  async getFundingRateHistory(symbol: string, limit = 100): Promise<FundingRate[]> {
    const raw = await fetchJSON<BinanceFundingRateHist[]>('/fapi/v1/fundingRate', {
      symbol: toBinanceSymbol(symbol),
      limit: String(limit),
    });
    return raw.map((r) => ({
      symbol: toBinanceSymbol(symbol),
      exchange: 'binance',
      fundingRate: parseFloat(r.fundingRate),
      fundingTime: r.fundingTime,
      markPrice: parseFloat(r.markPrice || '0'),
      nextFundingTime: 0,
    }));
  }

  async getOpenInterest(symbol: string): Promise<OpenInterest> {
    const data = await fetchJSON<BinanceOI>('/fapi/v1/openInterest', {
      symbol: toBinanceSymbol(symbol),
    });
    // Get mark price for USD value
    let usdValue = 0;
    try {
      const ticker = await fetchJSON<BinancePremiumIndex[]>('/fapi/v1/premiumIndex', {
        symbol: toBinanceSymbol(symbol),
      });
      const price = parseFloat((Array.isArray(ticker) ? ticker[0] : ticker as unknown as BinancePremiumIndex).markPrice);
      usdValue = parseFloat(data.openInterest) * price;
    } catch {
      usdValue = parseFloat(data.openInterest);
    }

    return {
      symbol: toBinanceSymbol(symbol),
      exchange: 'binance',
      openInterest: parseFloat(data.openInterest),
      openInterestValue: usdValue,
      timestamp: data.time || Date.now(),
    };
  }

  async getOpenInterestHistory(
    symbol: string,
    period = '1h',
    limit = 30
  ): Promise<OpenInterest[]> {
    const raw = await fetchJSON<BinanceOIHist[]>('/futures/data/openInterestHist', {
      symbol: toBinanceSymbol(symbol),
      period,
      limit: String(limit),
    });
    return raw.map((r) => ({
      symbol: toBinanceSymbol(symbol),
      exchange: 'binance',
      openInterest: parseFloat(r.sumOpenInterest),
      openInterestValue: parseFloat(r.sumOpenInterestValue),
      timestamp: r.timestamp,
    }));
  }

  async get24hrTicker(symbol?: string): Promise<Ticker[]> {
    const params: Record<string, string> = {};
    if (symbol) params.symbol = toBinanceSymbol(symbol);

    const raw = await fetchJSON<BinanceTicker24hr | BinanceTicker24hr[]>(
      '/fapi/v1/ticker/24hr',
      params
    );

    const items = Array.isArray(raw) ? raw : [raw];
    return items
      .filter((t) => t.symbol.endsWith('USDT'))
      .map((t) => ({
        symbol: t.symbol,
        exchange: 'binance',
        lastPrice: parseFloat(t.lastPrice),
        priceChange24h: parseFloat(t.priceChange),
        priceChangePercent24h: parseFloat(t.priceChangePercent),
        volume24h: parseFloat(t.quoteVolume),
        high24h: parseFloat(t.highPrice),
        low24h: parseFloat(t.lowPrice),
        timestamp: Date.now(),
      }));
  }

  // ── WebSocket Methods ──

  subscribeKline(
    symbol: string,
    interval: string,
    callback: (data: OHLCV) => void
  ): () => void {
    const sym = toBinanceSymbol(symbol).toLowerCase();
    const intv = toBinanceInterval(interval);
    const stream = `${sym}@kline_${intv}`;
    return this._subscribe(stream, (msg: any) => {
      const k = msg.k;
      if (!k) return;
      callback({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        exchange: 'binance',
        symbol: toBinanceSymbol(symbol),
        interval: intv,
        isClosed: k.x,
      });
    });
  }

  subscribeMarkPrice(
    symbol: string,
    callback: (data: MarkPrice) => void
  ): () => void {
    const sym = toBinanceSymbol(symbol).toLowerCase();
    const stream = `${sym}@markPrice@1s`;
    return this._subscribe(stream, (msg: any) => {
      callback({
        symbol: toBinanceSymbol(symbol),
        exchange: 'binance',
        markPrice: parseFloat(msg.p),
        indexPrice: parseFloat(msg.i),
        fundingRate: parseFloat(msg.r),
        nextFundingTime: msg.T,
        timestamp: msg.E,
      });
    });
  }

  subscribeLiquidation(
    symbol: string,
    callback: (data: Liquidation) => void
  ): () => void {
    const sym = toBinanceSymbol(symbol).toLowerCase();
    const stream = `${sym}@forceOrder`;
    return this._subscribe(stream, (msg: any) => {
      const o = msg.o;
      if (!o) return;
      callback({
        symbol: toBinanceSymbol(symbol),
        exchange: 'binance',
        side: o.S === 'BUY' ? 'short' : 'long', // Buy = short liquidated
        price: parseFloat(o.p),
        quantity: parseFloat(o.q),
        timestamp: o.T,
      });
    });
  }

  subscribeAllTickers(callback: (data: Ticker[]) => void): () => void {
    const stream = '!ticker@arr';
    return this._subscribe(stream, (msg: any) => {
      if (!Array.isArray(msg)) return;
      const tickers = msg
        .filter((t: any) => t.s?.endsWith('USDT'))
        .map((t: any) => ({
          symbol: t.s,
          exchange: 'binance',
          lastPrice: parseFloat(t.c),
          priceChange24h: parseFloat(t.p),
          priceChangePercent24h: parseFloat(t.P),
          volume24h: parseFloat(t.q),
          high24h: parseFloat(t.h),
          low24h: parseFloat(t.l),
          timestamp: t.E,
        }));
      callback(tickers);
    });
  }

  // ── Connection Management ──

  async connect(): Promise<void> {
    this._connected = true;
  }

  disconnect(): void {
    this._connected = false;
    for (const [key, ws] of this.wsConnections) {
      try { ws.close(); } catch { /* ignore */ }
    }
    this.wsConnections.clear();
  }

  isConnected(): boolean {
    return this._connected;
  }

  // ── Private WS helper ──

  private _subscribe(stream: string, handler: (msg: any) => void): () => void {
    // This is used by the WS Manager at the server level.
    // The manager creates its own WebSocket; this method provides
    // the stream name and message parser.
    // For direct use, create a WS connection:
    const wsUrl = `${WS_BASE}/ws/${stream}`;

    let ws: any = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        // Use the 'ws' package on server-side
        const WS = typeof WebSocket !== 'undefined'
          ? WebSocket
          : require('ws');
        ws = new WS(wsUrl);

        ws!.onmessage = (event: any) => {
          try {
            const data = JSON.parse(
              typeof event.data === 'string' ? event.data : event.data.toString()
            );
            handler(data);
          } catch { /* skip malformed */ }
        };

        ws!.onclose = () => {
          if (!closed) {
            setTimeout(connect, 2000);
          }
        };

        ws!.onerror = () => {
          try { ws?.close(); } catch { /* ignore */ }
        };
      } catch (err) {
        if (!closed) {
          setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      closed = true;
      try { ws?.close(); } catch { /* ignore */ }
    };
  }
}
