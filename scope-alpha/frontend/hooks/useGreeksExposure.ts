"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { GreeksExposureOutput } from "@/types/options";

const POLL_MS = 5 * 60 * 1000;

export function useGreeksExposure(
  asset: string,
): UseOptionsResult<GreeksExposureOutput> {
  const [data, setData] = useState<GreeksExposureOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<GreeksExposureOutput>(
        `/api/market/options/greeks-exposure?asset=${asset}`,
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
