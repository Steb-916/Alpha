"use client";

import { useEffect, useState } from "react";

export interface LiquidationDayBucket {
  date: string;
  longUsd: number;
  shortUsd: number;
  total: number;
}

export interface HistoricalLiquidationsData {
  asset: string;
  days: number;
  buckets: LiquidationDayBucket[];
}

export function useHistoricalLiquidations(asset: string, days = 30) {
  const [data, setData] = useState<HistoricalLiquidationsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/market/history/liquidations?asset=${asset}&days=${days}`,
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
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset, days]);

  return { data, isLoading };
}
