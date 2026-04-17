"use client";

import { useEffect, useState } from "react";

export interface CrossExchangeData {
  asset: string;
  funding: {
    binance: { rate: number; annualized: number };
    bybit: { rate: number; annualized: number };
    differential: number;
    differentialAnnualized: number;
    differentialZScore: number;
    arbitrageYield: number;
  };
  openInterest: {
    binance: { oi: number };
    bybit: { oi: number };
    binanceShare: number;
    bybitShare: number;
  };
  liquidations24h: {
    binance: { long: number; short: number };
    bybit: { long: number; short: number };
  };
  basis: {
    binance: { basisPct: number; annualized: number };
    bybit: { basisPct: number; annualized: number };
    differential: number;
    differentialAnnualized: number;
  };
  price: {
    binance: number;
    bybit: number;
    spread: number;
    spreadPct: number;
  };
}

export function useCrossExchange(asset: string) {
  const [data, setData] = useState<CrossExchangeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/market/compare?asset=${asset}`);
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
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [asset]);

  return { data, isLoading };
}
