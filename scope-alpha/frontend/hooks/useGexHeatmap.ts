"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { GexHeatmapData } from "@/types/options";

const POLL_MS = 60 * 60 * 1000; // 1 hour — heatmap data changes hourly

export function useGexHeatmap(
  asset: string,
  lookback: "7d" | "14d" | "30d",
): UseOptionsResult<GexHeatmapData> {
  const [data, setData] = useState<GexHeatmapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<GexHeatmapData>(
        `/api/market/options/gex-heatmap?asset=${asset}&lookback=${lookback}`,
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setIsLoading(false);
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [asset, lookback]);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
