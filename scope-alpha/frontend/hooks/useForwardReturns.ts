"use client";

import { useEffect, useState } from "react";
import { fetchOptionsJSON, type UseOptionsResult } from "./useOptionsChain";
import type { OnChainAsset } from "@/types/onchain";
import type {
  RegimeForwardReturnsResponse,
  RegimeLabel,
} from "@/types/regime";

const POLL_MS = 60 * 60 * 1000; // 1h — distribution recomputes daily at most

export function useForwardReturns(
  asset: OnChainAsset,
  regime: RegimeLabel | null,
): UseOptionsResult<RegimeForwardReturnsResponse> {
  const [data, setData] = useState<RegimeForwardReturnsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [quantEngineConfigured, setQuantEngineConfigured] = useState(true);

  useEffect(() => {
    if (!regime) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      const res = await fetchOptionsJSON<RegimeForwardReturnsResponse>(
        `/api/market/regime/forward-returns?asset=${asset}&regime=${regime}`,
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
  }, [asset, regime]);

  return { data, isLoading, unavailable, quantEngineConfigured };
}
