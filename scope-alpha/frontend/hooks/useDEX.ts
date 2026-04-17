"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { DEXOutput } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function useDEX(asset: string): UseOptionsResult<DEXOutput> {
  const [data, setData] = useState<DEXOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<DEXOutput>(
        `/api/market/options/dex?asset=${asset}`,
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
