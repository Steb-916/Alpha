"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OnChainAsset, OnChainFlowsResponse } from "@/types/onchain";

const POLL_MS = 5 * 60 * 1000;

export function useOnChainFlows(
  asset: OnChainAsset,
): UseOptionsResult<OnChainFlowsResponse> {
  const [data, setData] = useState<OnChainFlowsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [quantEngineConfigured, setQuantEngineConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<OnChainFlowsResponse>(
        `/api/market/onchain/flows?asset=${asset}`,
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
