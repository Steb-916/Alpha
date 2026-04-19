"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OnChainAsset, OnChainSupplyResponse } from "@/types/onchain";

const POLL_MS = 5 * 60 * 1000; // Supply refreshes at daily cadence — 5 min poll is ample.

export function useOnChainSupply(
  asset: OnChainAsset,
): UseOptionsResult<OnChainSupplyResponse> {
  const [data, setData] = useState<OnChainSupplyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [quantEngineConfigured, setQuantEngineConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<OnChainSupplyResponse>(
        `/api/market/onchain/supply?asset=${asset}`,
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setQuantEngineConfigured(res.quantEngineConfigured);
      setIsLoading(false);
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset]);

  return { data, isLoading, unavailable, quantEngineConfigured };
}
