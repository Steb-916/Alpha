"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { VannaCharmExposure } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function useVannaCharm(asset: string): UseOptionsResult<VannaCharmExposure> {
  const [data, setData] = useState<VannaCharmExposure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<VannaCharmExposure>(
        `/api/market/options/vanna-charm?asset=${asset}`,
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
