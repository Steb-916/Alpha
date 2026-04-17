"use client";

import { useEffect, useState } from "react";
import type { HeatmapResult } from "@/lib/analytics/liquidation-heatmap";

export function useLiquidationHeatmap(asset: string, enabled: boolean) {
  const [data, setData] = useState<HeatmapResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/market/liquidation-heatmap?asset=${asset}`);
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
  }, [asset, enabled]);

  return { data, isLoading };
}
