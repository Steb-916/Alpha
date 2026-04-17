"use client";

import { useEffect, useState } from "react";
import type { ChainAggregate } from "@/lib/options/aggregate";

export interface UseOptionsResult<T> {
  data: T | null;
  isLoading: boolean;
  unavailable: boolean;
  quantEngineConfigured: boolean;
}

/**
 * Shared fetcher used by all options hooks. Returns:
 *   - data: the JSON payload on 2xx
 *   - unavailable: true when the route returned 503
 *   - quantEngineConfigured: parsed from the 503 body when available
 */
export async function fetchOptionsJSON<T>(url: string): Promise<{
  data: T | null;
  unavailable: boolean;
  quantEngineConfigured: boolean;
}> {
  try {
    const res = await fetch(url);
    if (res.status === 503) {
      const body = await res.json().catch(() => ({}));
      return {
        data: null,
        unavailable: true,
        quantEngineConfigured: Boolean(body.quantEngineConfigured),
      };
    }
    if (!res.ok) {
      return { data: null, unavailable: true, quantEngineConfigured: false };
    }
    return {
      data: (await res.json()) as T,
      unavailable: false,
      quantEngineConfigured: true,
    };
  } catch {
    return { data: null, unavailable: true, quantEngineConfigured: false };
  }
}

const POLL_MS = 5 * 60 * 1000; // 5 minutes

export function useOptionsChain(asset: string): UseOptionsResult<ChainAggregate> {
  const [data, setData] = useState<ChainAggregate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<ChainAggregate>(
        `/api/market/options/chain?asset=${asset}`,
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setIsLoading(false);
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset]);

  return {
    data,
    isLoading,
    unavailable,
    quantEngineConfigured: true, // chain doesn't depend on quant engine
  };
}
