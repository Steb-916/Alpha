"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { FearGreedResponse } from "@/types/sentiment";

const POLL_MS = 60 * 60 * 1000; // 1h — index updates daily

export function useFearGreed(): UseOptionsResult<FearGreedResponse> {
  const [data, setData] = useState<FearGreedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<FearGreedResponse>(
        "/api/market/sentiment/fear-greed",
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
