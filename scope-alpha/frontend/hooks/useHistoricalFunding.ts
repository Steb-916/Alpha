"use client";

import { useEffect, useState } from "react";

interface SeriesPoint {
  time: number;
  rate: number;
}

export interface HistoricalFundingData {
  asset: string;
  days: number;
  series: {
    binance: SeriesPoint[];
    bybit: SeriesPoint[];
  };
  zScoreBands: {
    mean: number;
    stddev: number;
  };
}

export function useHistoricalFunding(asset: string, days = 30) {
  const [data, setData] = useState<HistoricalFundingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/market/history/funding?asset=${asset}&days=${days}`,
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
    const interval = setInterval(load, 5 * 60 * 1000); // 5min re-fetch
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset, days]);

  return { data, isLoading };
}
