"use client";

import { useEffect, useState } from "react";

interface SeriesPoint {
  time: number;
  oi: number;
  oiUsd: number;
  price: number;
}

export interface HistoricalOIData {
  asset: string;
  days: number;
  series: {
    binance: SeriesPoint[];
    bybit: SeriesPoint[];
  };
}

export function useHistoricalOI(asset: string, days = 7) {
  const [data, setData] = useState<HistoricalOIData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/market/history/oi?asset=${asset}&days=${days}`,
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
