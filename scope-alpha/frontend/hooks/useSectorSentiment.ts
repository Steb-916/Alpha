"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { SectorSentimentResponse } from "@/types/sentiment";

const POLL_MS = 5 * 60 * 1000; // 5m — same as funding rate data

export function useSectorSentiment(): UseOptionsResult<SectorSentimentResponse> {
  const [data, setData] = useState<SectorSentimentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<SectorSentimentResponse>(
        "/api/market/sentiment/sector",
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setIsLoading(false);
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
