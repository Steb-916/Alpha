'use client';

/**
 * Hook to wire Lightweight Charts to the MarketDataStore.
 *
 * Returns OHLCV data for the selected symbol/timeframe,
 * and the latest candle for real-time updates.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useMarketDataStore } from '@/lib/marketDataStore';
import { useAppStore } from '@/lib/store';
import { toBinanceSymbol, toBinanceInterval } from '@/lib/exchanges/utils';
import type { OHLCV } from '@/lib/exchanges/types';
import type { ISeriesApi, IChartApi } from 'lightweight-charts';

interface UseLiveChartOptions {
  /** Ref to the Lightweight Charts candlestick series */
  seriesRef: React.MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  /** Ref to the chart instance */
  chartRef?: React.MutableRefObject<IChartApi | null>;
  /** Optional volume series for synced volume updates */
  volumeSeriesRef?: React.MutableRefObject<ISeriesApi<'Histogram'> | null>;
}

/**
 * Subscribes to kline data from the store and pushes updates
 * directly to the Lightweight Charts series.
 */
export function useLiveChart({ seriesRef, chartRef, volumeSeriesRef }: UseLiveChartOptions) {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const selectedTimeframe = useAppStore((s) => s.selectedTimeframe);
  const isLoading = useMarketDataStore((s) => s.isLoadingKlines);

  const symbol = toBinanceSymbol(selectedAsset);
  const interval = toBinanceInterval(selectedTimeframe);

  // Track which klines we've already applied
  const lastAppliedTimeRef = useRef<number>(0);
  const initialDataSetRef = useRef(false);

  // Get klines from store
  const klines = useMarketDataStore((s) => s.klines[symbol]?.[interval] || []);

  // Convert OHLCV to Lightweight Charts format
  const chartData = useMemo(() => {
    return klines.map((k) => ({
      time: k.time as any, // UTCTimestamp
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }));
  }, [klines]);

  const volumeData = useMemo(() => {
    return klines.map((k) => ({
      time: k.time as any,
      value: k.volume,
      color: k.close >= k.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    }));
  }, [klines]);

  // Set initial data when klines are first loaded or symbol/timeframe changes
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || chartData.length === 0) return;

    // Full reset on symbol/timeframe change
    try {
      series.setData(chartData);
      if (volumeSeriesRef?.current && volumeData.length > 0) {
        volumeSeriesRef.current.setData(volumeData);
      }
      initialDataSetRef.current = true;
      lastAppliedTimeRef.current = chartData[chartData.length - 1]?.time || 0;
    } catch (err) {
      console.error('[useLiveChart] Error setting data:', err);
    }
  }, [symbol, interval, chartData.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time updates: apply the latest candle
  useEffect(() => {
    if (!initialDataSetRef.current) return;
    const series = seriesRef.current;
    if (!series || klines.length === 0) return;

    const lastCandle = klines[klines.length - 1];
    if (!lastCandle) return;

    try {
      // update() handles both "update last bar" and "add new bar" cases
      series.update({
        time: lastCandle.time as any,
        open: lastCandle.open,
        high: lastCandle.high,
        low: lastCandle.low,
        close: lastCandle.close,
      });

      if (volumeSeriesRef?.current) {
        volumeSeriesRef.current.update({
          time: lastCandle.time as any,
          value: lastCandle.volume,
          color: lastCandle.close >= lastCandle.open
            ? 'rgba(16, 185, 129, 0.3)'
            : 'rgba(239, 68, 68, 0.3)',
        });
      }
    } catch {
      // Ignore update errors (can happen during chart destruction)
    }
  }, [klines, seriesRef, volumeSeriesRef]);

  return {
    chartData,
    volumeData,
    isLoading,
    klineCount: klines.length,
  };
}

/**
 * Simple hook that just returns the current kline data for a symbol/interval.
 * Useful for components that don't have a chart reference.
 */
export function useKlineData(symbol?: string, interval?: string) {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const selectedTimeframe = useAppStore((s) => s.selectedTimeframe);

  const sym = toBinanceSymbol(symbol || selectedAsset);
  const intv = toBinanceInterval(interval || selectedTimeframe);

  return useMarketDataStore((s) => s.klines[sym]?.[intv] || []);
}
