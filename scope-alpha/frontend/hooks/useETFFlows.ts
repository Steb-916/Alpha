"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { ETFFlowResponse } from "@/types/macro";

const POLL_MS = 4 * 60 * 60 * 1000; // 4h — daily data

export function useETFFlows(): UseOptionsResult<ETFFlowResponse> {
  const [data, setData] = useState<ETFFlowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<ETFFlowResponse>(
        "/api/market/macro/etf-flows",
      );
      if (cancelled) return;
      setData(res.data);
      // etf-flows never returns 503 — it serves empty array on failure
      setUnavailable(res.data?.unavailable === true);
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
