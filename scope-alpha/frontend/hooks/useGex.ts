"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { GexByStrike } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function useGex(asset: string): UseOptionsResult<GexByStrike> {
  const [data, setData] = useState<GexByStrike | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<GexByStrike>(
        `/api/market/options/gex?asset=${asset}`,
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
