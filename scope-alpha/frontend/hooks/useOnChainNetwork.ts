"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OnChainAsset, OnChainNetworkResponse } from "@/types/onchain";

const POLL_MS = 5 * 60 * 1000;

export function useOnChainNetwork(
  asset: OnChainAsset,
): UseOptionsResult<OnChainNetworkResponse> {
  const [data, setData] = useState<OnChainNetworkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<OnChainNetworkResponse>(
        `/api/market/onchain/network?asset=${asset}`,
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

  // Network Health never depends on the Quant Engine — always "configured"
  // from the UI perspective so UnavailableBanner language stays accurate.
  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
