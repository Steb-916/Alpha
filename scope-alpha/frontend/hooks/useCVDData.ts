"use client";

import { useEffect, useState } from "react";
import type { CVDPoint, Divergence } from "@/lib/analytics/cvd";

export interface CVDData {
  asset: string;
  timeframe: string;
  series: CVDPoint[];
  divergences: Divergence[];
}

export function useCVDData(asset: string, timeframe = "1h", limit = 200) {
  const [data, setData] = useState<CVDData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/market/cvd?asset=${asset}&timeframe=${timeframe}&limit=${limit}`,
        );
        if (res.ok && !cancelled) {
          setData(await res.json());
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset, timeframe, limit]);

  return { data, isLoading };
}
