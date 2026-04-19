"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OnChainStablecoinsResponse } from "@/types/onchain";

const POLL_MS = 15 * 60 * 1000; // 15 min — DefiLlama updates are slow-cadence.

export function useStablecoins(): UseOptionsResult<OnChainStablecoinsResponse> {
  const [data, setData] = useState<OnChainStablecoinsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<OnChainStablecoinsResponse>(
        `/api/market/onchain/stablecoins`,
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
  }, []);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
