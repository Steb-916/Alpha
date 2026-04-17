"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { RNDOutput } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function useRND(
  asset: string,
  expiry: string | null,
): UseOptionsResult<RNDOutput> {
  const [data, setData] = useState<RNDOutput | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(expiry));
  const [unavailable, setUnavailable] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    if (!expiry) {
      setData(null);
      setIsLoading(false);
      setUnavailable(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<RNDOutput>(
        `/api/market/options/rnd?asset=${asset}&expiry=${expiry}`,
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setConfigured(res.quantEngineConfigured);
      setIsLoading(false);
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset, expiry]);

  return { data, isLoading, unavailable, quantEngineConfigured: configured };
}
