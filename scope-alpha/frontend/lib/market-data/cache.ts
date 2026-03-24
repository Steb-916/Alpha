/**
 * In-memory market data cache.
 *
 * Stores recent OHLCV, ticker, funding, OI, and liquidation data.
 * Designed to be swapped to Redis later by implementing the same interface.
 */

import type { OHLCV, Ticker, FundingRate, OpenInterest, Liquidation } from '../exchanges/types';

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_KLINES_PER_PAIR = parseInt(process.env.CACHE_MAX_KLINES_PER_PAIR || '1000', 10);
const TICKER_TTL_MS = parseInt(process.env.CACHE_TICKER_TTL_MS || '10000', 10);
const MAX_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES || '50000', 10);
const MAX_LIQUIDATIONS = 200;

// ─── Cache Interface ────────────────────────────────────────────────────────

export interface MarketDataCache {
  // OHLCV
  getKlines(symbol: string, interval: string): OHLCV[];
  setKlines(symbol: string, interval: string, data: OHLCV[]): void;
  appendKline(symbol: string, interval: string, candle: OHLCV): void;

  // Tickers
  getLatestTicker(symbol: string): Ticker | null;
  setLatestTicker(symbol: string, data: Ticker): void;
  getAllTickers(): Map<string, Ticker>;

  // Funding
  getFundingRate(symbol: string): FundingRate | null;
  setFundingRate(symbol: string, data: FundingRate): void;

  // Open Interest
  getOpenInterest(symbol: string): OpenInterest | null;
  setOpenInterest(symbol: string, data: OpenInterest): void;

  // Liquidations
  getLiquidations(symbol?: string): Liquidation[];
  addLiquidation(data: Liquidation): void;

  // Management
  clear(): void;
  getStats(): { keys: number; memoryEstimate: number };
}

// ─── In-Memory Implementation ───────────────────────────────────────────────

interface TimestampedEntry<T> {
  data: T;
  updatedAt: number;
  accessedAt: number;
}

class InMemoryCache implements MarketDataCache {
  private klines: Map<string, OHLCV[]> = new Map();
  private tickers: Map<string, TimestampedEntry<Ticker>> = new Map();
  private fundingRates: Map<string, TimestampedEntry<FundingRate>> = new Map();
  private openInterests: Map<string, TimestampedEntry<OpenInterest>> = new Map();
  private liquidations: Liquidation[] = [];

  private totalEntries = 0;

  // ── Klines ──

  private klineKey(symbol: string, interval: string): string {
    return `${symbol.toUpperCase()}:${interval}`;
  }

  getKlines(symbol: string, interval: string): OHLCV[] {
    const key = this.klineKey(symbol, interval);
    return this.klines.get(key) || [];
  }

  setKlines(symbol: string, interval: string, data: OHLCV[]): void {
    const key = this.klineKey(symbol, interval);
    const trimmed = data.slice(-MAX_KLINES_PER_PAIR);
    const oldCount = this.klines.get(key)?.length || 0;
    this.klines.set(key, trimmed);
    this.totalEntries += trimmed.length - oldCount;
    this._checkMemory();
  }

  appendKline(symbol: string, interval: string, candle: OHLCV): void {
    const key = this.klineKey(symbol, interval);
    let arr = this.klines.get(key);
    if (!arr) {
      arr = [];
      this.klines.set(key, arr);
    }

    if (arr.length > 0) {
      const last = arr[arr.length - 1];
      if (last.time === candle.time) {
        // Update in-place (current candle still forming)
        arr[arr.length - 1] = candle;
        return;
      }
    }

    // Append new candle
    arr.push(candle);
    this.totalEntries++;

    // Evict oldest if over limit
    if (arr.length > MAX_KLINES_PER_PAIR) {
      arr.shift();
      this.totalEntries--;
    }
  }

  // ── Tickers ──

  getLatestTicker(symbol: string): Ticker | null {
    const entry = this.tickers.get(symbol.toUpperCase());
    if (!entry) return null;
    // Check TTL
    if (Date.now() - entry.updatedAt > TICKER_TTL_MS) {
      return { ...entry.data }; // Return stale but don't delete
    }
    entry.accessedAt = Date.now();
    return entry.data;
  }

  setLatestTicker(symbol: string, data: Ticker): void {
    const key = symbol.toUpperCase();
    const existing = this.tickers.has(key);
    this.tickers.set(key, {
      data,
      updatedAt: Date.now(),
      accessedAt: Date.now(),
    });
    if (!existing) this.totalEntries++;
  }

  getAllTickers(): Map<string, Ticker> {
    const result = new Map<string, Ticker>();
    for (const [key, entry] of this.tickers) {
      result.set(key, entry.data);
    }
    return result;
  }

  // ── Funding Rates ──

  getFundingRate(symbol: string): FundingRate | null {
    const entry = this.fundingRates.get(symbol.toUpperCase());
    if (!entry) return null;
    entry.accessedAt = Date.now();
    return entry.data;
  }

  setFundingRate(symbol: string, data: FundingRate): void {
    const key = symbol.toUpperCase();
    const existing = this.fundingRates.has(key);
    this.fundingRates.set(key, {
      data,
      updatedAt: Date.now(),
      accessedAt: Date.now(),
    });
    if (!existing) this.totalEntries++;
  }

  // ── Open Interest ──

  getOpenInterest(symbol: string): OpenInterest | null {
    const entry = this.openInterests.get(symbol.toUpperCase());
    if (!entry) return null;
    entry.accessedAt = Date.now();
    return entry.data;
  }

  setOpenInterest(symbol: string, data: OpenInterest): void {
    const key = symbol.toUpperCase();
    const existing = this.openInterests.has(key);
    this.openInterests.set(key, {
      data,
      updatedAt: Date.now(),
      accessedAt: Date.now(),
    });
    if (!existing) this.totalEntries++;
  }

  // ── Liquidations ──

  getLiquidations(symbol?: string): Liquidation[] {
    if (symbol) {
      return this.liquidations.filter(
        (l) => l.symbol.toUpperCase() === symbol.toUpperCase()
      );
    }
    return [...this.liquidations];
  }

  addLiquidation(data: Liquidation): void {
    this.liquidations.push(data);
    if (this.liquidations.length > MAX_LIQUIDATIONS) {
      this.liquidations.shift();
    }
  }

  // ── Management ──

  clear(): void {
    this.klines.clear();
    this.tickers.clear();
    this.fundingRates.clear();
    this.openInterests.clear();
    this.liquidations = [];
    this.totalEntries = 0;
  }

  getStats(): { keys: number; memoryEstimate: number } {
    let klineCount = 0;
    for (const arr of this.klines.values()) klineCount += arr.length;
    const keys =
      klineCount +
      this.tickers.size +
      this.fundingRates.size +
      this.openInterests.size +
      this.liquidations.length;
    // Rough estimate: ~200 bytes per entry
    return { keys, memoryEstimate: keys * 200 };
  }

  // ── Internal ──

  private _checkMemory(): void {
    const stats = this.getStats();
    if (stats.keys > MAX_ENTRIES * 0.8) {
      console.warn(
        `[MarketDataCache] Warning: ${stats.keys} entries (${MAX_ENTRIES * 0.8} threshold)`
      );
    }
    if (stats.keys > MAX_ENTRIES) {
      this._evictLeastAccessed();
    }
  }

  private _evictLeastAccessed(): void {
    // Evict ticker entries that haven't been accessed recently
    const now = Date.now();
    const staleThreshold = 60_000; // 1 minute

    for (const [key, entry] of this.tickers) {
      if (now - entry.accessedAt > staleThreshold) {
        this.tickers.delete(key);
        this.totalEntries--;
      }
    }

    // If still over limit, evict oldest kline sets
    if (this.getStats().keys > MAX_ENTRIES) {
      const klineEntries = Array.from(this.klines.entries());
      // Sort by oldest data
      klineEntries.sort(
        (a, b) => (a[1][0]?.time || 0) - (b[1][0]?.time || 0)
      );
      // Remove oldest sets until under limit
      for (const [key] of klineEntries) {
        const count = this.klines.get(key)?.length || 0;
        this.klines.delete(key);
        this.totalEntries -= count;
        if (this.getStats().keys <= MAX_ENTRIES * 0.7) break;
      }
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _cache: MarketDataCache | null = null;

export function getMarketDataCache(): MarketDataCache {
  if (!_cache) {
    _cache = new InMemoryCache();
  }
  return _cache;
}
