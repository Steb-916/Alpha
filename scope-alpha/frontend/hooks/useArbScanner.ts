"use client";

import { useEffect, useState } from "react";
import type { ArbOpportunity } from "@/lib/analytics/arb-scanner";

export interface ArbScannerResponse {
  opportunities: ArbOpportunity[];
  updatedAt: string;
  assetsScanned: number;
  errors: number;
}

export function useArbScanner() {
  const [data, setData] = useState<ArbScannerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/tools/arb-scanner");
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
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, isLoading };
}
