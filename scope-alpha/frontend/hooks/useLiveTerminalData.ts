'use client';

/**
 * Hook layer that exposes live market data to terminal pages.
 *
 * Two halves coexist here:
 *
 *   1. Real-time path (UNCHANGED from the 3/24 build)
 *      useLiveCandles, useLiveTicker, useLiveTickers all read from
 *      `useMarketDataStore` which is fed by the in-process WebSocket → SSE
 *      pipeline. They give sub-second updates for the chart and watchlist.
 *
 *   2. Slow-metric path (NEW — Phase 1 hybrid plan)
 *      useLiveFundingData, useLiveOIData, useLiveBasisData,
 *      useLiveHealthScore, useLiveScreenerData are powered by SWR against
 *      the new /api/market/* routes. Those routes hit Binance + Bybit REST,
 *      cache in Upstash with stale fallback, and return shapes that match
 *      the existing internal types in `lib/types.ts` 1:1 (so consumers
 *      don't need to change a single field path).
 *
 * The mock generators are still used as a hard fallback for the moments
 * before SWR has populated, and when LIVE_DATA_ENABLED=false.
 */

import useSWR from 'swr';
import { useMemo } from 'react';
import { useMarketDataStore } from '@/lib/marketDataStore';
import { useAppStore } from '@/lib/store';
import { toBinanceSymbol } from '@/lib/exchanges/utils';
import {
  MOCK_INSTRUMENTS,
  generateCandles,
  generateFundingData,
  generateOIData,
  generateBasisData,
  generateHealthScore,
  generateScreenerData,
} from '@/lib/mockData';
import type {
  Candle,
  FundingData,
  OpenInterestData,
  BasisData,
  HealthScore,
  ScreenerRow,
} from '@/lib/types';
import type { OHLCV, Ticker } from '@/lib/exchanges/types';

// ─── Shared SWR fetcher ─────────────────────────────────────────────────────

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url}`);
  }
  return (await res.json()) as T;
};

// SWR responses from withCacheAndStale carry these meta fields.
type CachedEnvelope<T> = T & {
  _cachedAt?: number;
  _stale?: boolean;
  _mock?: boolean;
};

// ─── Candle Data (UNCHANGED — SSE pipeline) ─────────────────────────────────

export function useLiveCandles(): { data: Candle[]; isLoading: boolean } {
  const { selectedAsset, selectedTimeframe } = useAppStore();
  const symbol = toBinanceSymbol(selectedAsset);
  const klines = useMarketDataStore(
    (s) => s.klines[symbol]?.[selectedTimeframe.toLowerCase()] || [],
  );
  const isLoading = useMarketDataStore((s) => s.isLoadingKlines);

  const liveCandles: Candle[] = useMemo(
    () =>
      klines.map((k: OHLCV) => ({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      })),
    [klines],
  );

  const mockCandles = useMemo(() => {
    if (liveCandles.length > 0) return [];
    const instrument = MOCK_INSTRUMENTS.find((i) => i.symbol === selectedAsset);
    const basePrice = instrument?.price || 67000;
    const count =
      selectedTimeframe === '1D'
        ? 90
        : selectedTimeframe === '4H'
          ? 180
          : 360;
    return generateCandles(basePrice, count);
  }, [selectedAsset, selectedTimeframe, liveCandles.length]);

  return {
    data: liveCandles.length > 0 ? liveCandles : mockCandles,
    isLoading: isLoading && liveCandles.length === 0,
  };
}

// ─── Ticker / Price Data (UNCHANGED — SSE pipeline) ─────────────────────────

export function useLiveTicker(symbol?: string): Ticker | null {
  const { selectedAsset } = useAppStore();
  const sym = toBinanceSymbol(symbol || selectedAsset);
  return useMarketDataStore((s) => s.tickers[sym] || null);
}

export function useLiveTickers(): Record<string, Ticker> {
  return useMarketDataStore((s) => s.tickers);
}

// ─── Funding Data (NEW — SWR backed) ────────────────────────────────────────

export function useLiveFundingData(symbol?: string): FundingData {
  const { selectedAsset } = useAppStore();
  const asset = symbol || selectedAsset;

  const { data } = useSWR<CachedEnvelope<FundingData>>(
    `/api/market/funding?symbol=${encodeURIComponent(asset)}`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  // Mock fallback while SWR is warming up or if everything fails.
  if (!data) return generateFundingData(asset);
  return data;
}

// ─── Open Interest Data (NEW — SWR backed) ──────────────────────────────────

export function useLiveOIData(symbol?: string): OpenInterestData {
  const { selectedAsset } = useAppStore();
  const asset = symbol || selectedAsset;

  const { data } = useSWR<CachedEnvelope<OpenInterestData>>(
    `/api/market/open-interest?symbol=${encodeURIComponent(asset)}`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  if (!data) return generateOIData(asset);
  return data;
}

// ─── Basis Data (NEW — SWR backed) ──────────────────────────────────────────

export function useLiveBasisData(symbol?: string): BasisData {
  const { selectedAsset } = useAppStore();
  const asset = symbol || selectedAsset;

  const { data } = useSWR<CachedEnvelope<BasisData>>(
    `/api/market/basis?symbol=${encodeURIComponent(asset)}`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  if (!data) return generateBasisData(asset);

  // The basis route doesn't yet build a history array (perp basis history
  // would require accumulating snapshots over time). If history is empty,
  // splice in the mock history shape so any consumer iterating
  // `basis.history.map(h => h.basis)` doesn't blank out.
  if (!data.history || data.history.length === 0) {
    return { ...data, history: generateBasisData(asset).history };
  }
  return data;
}

// ─── Health Score (NEW — SWR backed) ────────────────────────────────────────

export function useLiveHealthScore(symbol?: string): HealthScore {
  const { selectedAsset } = useAppStore();
  const asset = symbol || selectedAsset;

  const { data } = useSWR<CachedEnvelope<HealthScore>>(
    `/api/market/health?symbol=${encodeURIComponent(asset)}`,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  if (!data) return generateHealthScore(asset);
  return data;
}

// ─── Screener (NEW — SWR backed) ────────────────────────────────────────────

interface ScreenerEnvelope {
  rows: ScreenerRow[];
  _cachedAt?: number;
  _stale?: boolean;
  _mock?: boolean;
  count?: number;
}

export function useLiveScreenerData(): ScreenerRow[] {
  const { data } = useSWR<ScreenerEnvelope>('/api/market/screener', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  // Live ticker fallback so the screener page never blanks while the cron
  // warms the cache for the first time.
  const liveTickers = useMarketDataStore((s) => s.tickers);

  return useMemo(() => {
    if (data?.rows && data.rows.length >= 5) {
      return data.rows;
    }

    // Tier-1 fallback: build a quick row list from live tickers if SSE has
    // populated them.
    const tickerEntries = Object.values(liveTickers);
    if (tickerEntries.length >= 5) {
      return tickerEntries.slice(0, 20).map((ticker) => ({
        symbol: ticker.symbol.replace('USDT', ''),
        name: ticker.symbol.replace('USDT', ''),
        price: ticker.lastPrice,
        marketCap: 0,
        volume24h: ticker.volume24h,
        change24h: ticker.priceChangePercent24h,
        change7d: 0,
        rank: 0,
        sparkline: [],
        fundingRate: 0,
        fundingZ: 0,
        oi: 0,
        oiChange24h: 0,
        liq24h: 0,
        liqRatio: 0,
        basis: 0,
        healthScore: 50,
        regime: 'Neutral',
      }));
    }

    // Last-resort: full mock data.
    return generateScreenerData();
  }, [data, liveTickers]);
}

// ─── Stale-status helper for ConnectionStatus indicator ─────────────────────

/**
 * Returns true if any of the most recently fetched slow-metric SWR responses
 * are flagged as stale. Reads directly from SWR's cache to avoid having to
 * thread state through every consumer.
 *
 * NOTE: This is a best-effort indicator — it won't catch in-flight requests
 * that haven't yet returned, but it does flag whenever the cache wrapper
 * had to fall back to the stale copy.
 */
export function useStaleStatus(): boolean {
  const { selectedAsset } = useAppStore();

  const funding = useSWR<CachedEnvelope<FundingData>>(
    `/api/market/funding?symbol=${encodeURIComponent(selectedAsset)}`,
    null,
    { revalidateIfStale: false, revalidateOnMount: false, revalidateOnFocus: false },
  );
  const oi = useSWR<CachedEnvelope<OpenInterestData>>(
    `/api/market/open-interest?symbol=${encodeURIComponent(selectedAsset)}`,
    null,
    { revalidateIfStale: false, revalidateOnMount: false, revalidateOnFocus: false },
  );
  const basis = useSWR<CachedEnvelope<BasisData>>(
    `/api/market/basis?symbol=${encodeURIComponent(selectedAsset)}`,
    null,
    { revalidateIfStale: false, revalidateOnMount: false, revalidateOnFocus: false },
  );

  return Boolean(funding.data?._stale || oi.data?._stale || basis.data?._stale);
}
