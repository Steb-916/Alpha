"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OptionsFlow } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function useOptionsFlow(
  asset: string,
  minPremium = 0,
): UseOptionsResult<OptionsFlow> {
  const [data, setData] = useState<OptionsFlow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const params = new URLSearchParams({ asset });
      if (minPremium > 0) params.set("minPremium", String(minPremium));
      const res = await fetchOptionsJSON<OptionsFlow>(
        `/api/market/options/options-flow?${params}`,
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setIsLoading(false);
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [asset, minPremium]);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
