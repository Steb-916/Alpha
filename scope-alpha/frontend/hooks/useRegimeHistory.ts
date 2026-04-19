"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OnChainAsset } from "@/types/onchain";
import type { RegimeHistoryResponse } from "@/types/regime";

const POLL_MS = 10 * 60 * 1000; // 10 min — timeline updates hourly at most

export function useRegimeHistory(
  asset: OnChainAsset,
  days: number = 90,
): UseOptionsResult<RegimeHistoryResponse> {
  const [data, setData] = useState<RegimeHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<RegimeHistoryResponse>(
        `/api/market/regime/history?asset=${asset}&days=${days}`,
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setIsLoading(false);
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [asset, days]);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
