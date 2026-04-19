"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OnChainAsset } from "@/types/onchain";
import type { RegimeCurrentResponse } from "@/types/regime";

const POLL_MS = 5 * 60 * 1000;

export function useRegime(
  asset: OnChainAsset,
): UseOptionsResult<RegimeCurrentResponse> {
  const [data, setData] = useState<RegimeCurrentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [quantEngineConfigured, setQuantEngineConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<RegimeCurrentResponse>(
        `/api/market/regime/current?asset=${asset}`,
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
  }, [asset]);

  return { data, isLoading, unavailable, quantEngineConfigured };
}
