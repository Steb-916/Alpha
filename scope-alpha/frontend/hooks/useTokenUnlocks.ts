"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { TokenUnlockResponse } from "@/types/macro";

export function useTokenUnlocks(): UseOptionsResult<TokenUnlockResponse> {
  const [data, setData] = useState<TokenUnlockResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<TokenUnlockResponse>(
        "/api/market/macro/token-unlocks",
      );
      if (cancelled) return;
      setData(res.data);
      setUnavailable(res.unavailable);
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { data, isLoading, unavailable, quantEngineConfigured: true };
}
