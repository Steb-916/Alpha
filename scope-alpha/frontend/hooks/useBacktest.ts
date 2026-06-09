"use client";

import { useState, useCallback } from "react";
import type { BacktestResult, BacktestCondition } from "@/lib/analytics/backtest-engine";

export interface BacktestRequest {
  asset: string;
  from: string;
  to: string;
  direction: "long" | "short";
  entry: BacktestCondition[];
  exit: BacktestCondition[];
  stopLossPct?: number;
  takeProfitPct?: number;
  initialCapital: number;
}

export function useBacktest() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (req: BacktestRequest) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tools/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Backtest failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { result, isLoading, error, run };
}
