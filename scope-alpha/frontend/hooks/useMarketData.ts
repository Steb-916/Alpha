'use client';

/**
 * Hook to connect the MarketDataStore to SSE stream.
 * Handles connection lifecycle based on the selected asset and timeframe.
 */

import { useEffect, useRef } from 'react';
import { useMarketDataStore } from '@/lib/marketDataStore';
import { useAppStore } from '@/lib/store';
import { toBinanceSymbol, toBinanceInterval } from '@/lib/exchanges/utils';
import { TIER1_SYMBOLS, ALL_TRACKED_SYMBOLS } from '@/lib/exchanges/types';

const DEFAULT_CHANNELS = ['kline', 'ticker', 'funding', 'liquidation', 'openInterest'];

/**
 * Connects to the SSE stream and manages subscriptions.
 * Call this once in the terminal layout or top-level component.
 */
export function useMarketData() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const selectedTimeframe = useAppStore((s) => s.selectedTimeframe);
  const connect = useMarketDataStore((s) => s.connect);
  const disconnect = useMarketDataStore((s) => s.disconnect);
  const fetchKlines = useMarketDataStore((s) => s.fetchKlines);
  const fetchTickers = useMarketDataStore((s) => s.fetchTickers);
  const connectionStatus = useMarketDataStore((s) => s.connectionStatus);
  const prevRef = useRef({ asset: '', timeframe: '' });

  // Feature flag check
  const isLiveEnabled = typeof window !== 'undefined'
    ? !window.location.search.includes('mock=true')
    : true;

  // Initial connection
  useEffect(() => {
    if (!isLiveEnabled) return;

    const symbol = toBinanceSymbol(selectedAsset);
    const interval = toBinanceInterval(selectedTimeframe);

    // Build symbols list: Tier 1 always + current selected
    const symbols = [...new Set([...TIER1_SYMBOLS, symbol])];

    connect(symbols, [interval, '1m'], DEFAULT_CHANNELS);

    // Fetch initial REST data for charts
    fetchKlines(selectedAsset, selectedTimeframe, 500);
    fetchTickers();

    return () => {
      disconnect();
    };
    // Only reconnect on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveEnabled]);

  // Handle asset/timeframe changes
  useEffect(() => {
    if (!isLiveEnabled) return;
    const prev = prevRef.current;
    const asset = selectedAsset;
    const tf = selectedTimeframe;

    if (prev.asset === asset && prev.timeframe === tf) return;
    prevRef.current = { asset, timeframe: tf };

    const symbol = toBinanceSymbol(asset);
    const interval = toBinanceInterval(tf);

    // Fetch klines for new selection
    fetchKlines(asset, tf, 500);

    // If switching to a non-Tier1 symbol, update subscriptions
    if (!TIER1_SYMBOLS.includes(symbol)) {
      const symbols = [...new Set([...TIER1_SYMBOLS, symbol])];
      const { updateSubscriptions } = useMarketDataStore.getState();
      updateSubscriptions(symbols, [interval, '1m'], DEFAULT_CHANNELS);
    }
  }, [selectedAsset, selectedTimeframe, isLiveEnabled, fetchKlines]);

  return {
    connectionStatus,
    isLiveEnabled,
  };
}
