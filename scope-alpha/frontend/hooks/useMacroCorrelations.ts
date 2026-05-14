"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { CorrelationResponse } from "@/types/macro";

const POLL_MS = 4 * 60 * 60 * 1000; // 4h — daily bar data

export function useMacroCorrelations(): UseOptionsResult<CorrelationResponse> {
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [quantEngineConfigured, setQuantEngineConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<CorrelationResponse>(
        "/api/market/macro/correlations",
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setQuantEngineConfigured(res.quantEngineConfigured);
      setIsLoading(false);
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, isLoading, unavailable, quantEngineConfigured };
}
