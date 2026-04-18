"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { CascadeRiskOverlay } from "@/types/options";

const POLL_MS = 60 * 1000; // 1 minute — cascade risk refreshes every 60s

export function useCascadeRisk(asset: string): UseOptionsResult<CascadeRiskOverlay> {
  const [data, setData] = useState<CascadeRiskOverlay | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<CascadeRiskOverlay>(
        `/api/market/options/cascade-risk?asset=${asset}`,
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setIsLoading(false);
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [asset]);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
