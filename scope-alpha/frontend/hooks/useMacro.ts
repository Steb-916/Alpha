'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  CorrelationMatrix,
  EtfFlowData,
  MacroRegimeResult,
  MacroConvergenceScore,
  TokenUnlockCalendar,
} from '@/types/macro';

const REFRESH_5M = 5 * 60 * 1000;
const REFRESH_15M = 15 * 60 * 1000;
const REFRESH_1H = 60 * 60 * 1000;

function useAutoRefresh<T>(
  url: string | null,
  refreshInterval = REFRESH_5M,
): { data: T | null; isLoading: boolean; error: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setIsLoading(true);
    setData(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!url) return;
    const id = setInterval(load, refreshInterval);
    return () => clearInterval(id);
  }, [load, url, refreshInterval]);

  return { data, isLoading, error, refresh: load };
}

export function useCorrelations(window = 30) {
  return useAutoRefresh<CorrelationMatrix>(
    `/api/market/macro/correlations?window=${window}`,
    REFRESH_1H,
  );
}

export function useEtfFlows() {
  return useAutoRefresh<EtfFlowData>('/api/market/macro/etf-flows', REFRESH_1H);
}

export function useMacroRegime(asset = 'BTC') {
  return useAutoRefresh<MacroRegimeResult>(
    `/api/market/macro/regime?asset=${asset}`,
    REFRESH_15M,
  );
}

export function useMacroConvergence(asset = 'BTC') {
  return useAutoRefresh<MacroConvergenceScore>(
    `/api/market/macro/convergence?asset=${asset}`,
    REFRESH_15M,
  );
}

export function useTokenUnlocks() {
  return useAutoRefresh<TokenUnlockCalendar>('/api/market/macro/token-unlocks', REFRESH_1H);
}
