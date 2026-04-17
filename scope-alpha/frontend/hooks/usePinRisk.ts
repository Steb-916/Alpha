"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { PinRiskOutput } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function usePinRisk(
  asset: string,
  expiry?: string | null,
): UseOptionsResult<PinRiskOutput> {
  const [data, setData] = useState<PinRiskOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const query = expiry ? `?asset=${asset}&expiry=${expiry}` : `?asset=${asset}`;
      const res = await fetchOptionsJSON<PinRiskOutput>(
        `/api/market/options/pin-risk${query}`,
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
  }, [asset, expiry]);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
