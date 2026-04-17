"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { GEXHistoryOutput } from "@/types/options";

const POLL_MS = 10 * 60 * 1000;

export function useGEXHistory(
  asset: string,
  days: number = 7,
): UseOptionsResult<GEXHistoryOutput> {
  const [data, setData] = useState<GEXHistoryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<GEXHistoryOutput>(
        `/api/market/options/gex-history?asset=${asset}&days=${days}`,
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
  }, [asset, days]);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
