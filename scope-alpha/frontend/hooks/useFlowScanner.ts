"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { FlowOutput } from "@/types/options";

const POLL_MS = 2 * 60 * 1000; // 2min — shorter than other hooks for freshness

export function useFlowScanner(asset: string): UseOptionsResult<FlowOutput> {
  const [data, setData] = useState<FlowOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<FlowOutput>(
        `/api/market/options/flow?asset=${asset}`,
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

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
