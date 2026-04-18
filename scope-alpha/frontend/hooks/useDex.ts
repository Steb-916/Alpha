"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { DexByStrike } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function useDex(asset: string): UseOptionsResult<DexByStrike> {
  const [data, setData] = useState<DexByStrike | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<DexByStrike>(
        `/api/market/options/dex?asset=${asset}`,
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
