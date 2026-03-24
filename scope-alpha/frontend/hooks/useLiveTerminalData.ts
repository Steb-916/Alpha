'use client';

/**
 * Hook that provides terminal data from live sources with fallback to mock data.
 * This is the main integration point between the old mock system and the new live system.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMarketDataStore } from '@/lib/marketDataStore';
import { useAppStore } from '@/lib/store';
import { toBinanceSymbol } from '@/lib/exchanges/utils';
import { MOCK_INSTRUMENTS, generateCandles, generateFundingData, generateOIData, generateLiquidationData, generateBasisData, generateHealthScore, generateScreenerData } from '@/lib/mockData';
import type { Candle, FundingData, OpenInterestData, LiquidationData, BasisData, HealthScore, ScreenerRow } from '@/lib/types';
import type { OHLCV, Ticker, FundingRate } from '@/lib/exchanges/types';

// ─── Candle Data (for chart) ────────────────────────────────────────────────

export function useLiveCandles(): { data: Candle[]; isLoading: boolean } {
  const { selectedAsset, selectedTimeframe } = useAppStore();
  const symbol = toBinanceSymbol(selectedAsset);
  const klines = useMarketDataStore((s) => s.klines[symbol]?.[selectedTimeframe.toLowerCase()] || []);
  const isLoading = useMarketDataStore((s) => s.isLoadingKlines);
  const connectionStatus = useMarketDataStore((s) => s.connectionStatus);

  // Convert OHLCV to Candle format (app's existing type)
  const liveCandles: Candle[] = useMemo(() =>
    klines.map((k: OHLCV) => ({
      time: k.time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    })),
    [klines]
  );

  // Fallback to mock data if no live data
  const mockCandles = useMemo(() => {
    if (liveCandles.length > 0) return [];
    const instrument = MOCK_INSTRUMENTS.find(i => i.symbol === selectedAsset);
    const basePrice = instrument?.price || 67000;
    const count = selectedTimeframe === '1D' ? 90 : selectedTimeframe === '4H' ? 180 : 360;
    return generateCandles(basePrice, count);
  }, [selectedAsset, selectedTimeframe, liveCandles.length]);

  return {
    data: liveCandles.length > 0 ? liveCandles : mockCandles,
    isLoading: isLoading && liveCandles.length === 0,
  };
}

// ─── Funding Data ───────────────────────────────────────────────────────────

export function useLiveFundingData(symbol?: string): FundingData {
  const { selectedAsset } = useAppStore();
  const asset = symbol || selectedAsset;
  const sym = toBinanceSymbol(asset);
  const liveFunding = useMarketDataStore((s) => s.fundingRates[sym]);
  const fetchFundingRates = useMarketDataStore((s) => s.fetchFundingRates);
  const [history, setHistory] = useState<FundingRate[]>([]);

  useEffect(() => {
    fetchFundingRates(asset).then((result) => {
      if (result.history) setHistory(result.history);
    });
  }, [asset, fetchFundingRates]);

  // Convert live data to app's FundingData format
  if (liveFunding && history.length > 0) {
    const rates = history.map(h => h.fundingRate);
    const avg8h = rates.length >= 3 ? rates.slice(-3).reduce((s, r) => s + r, 0) / 3 : liveFunding.fundingRate;
    const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
    const stdDev = Math.sqrt(rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length) || 0.0001;
    const zScore = (liveFunding.fundingRate - mean) / stdDev;

    return {
      symbol: asset,
      currentRate: liveFunding.fundingRate,
      avg8h,
      zScore,
      annualizedCarry: liveFunding.fundingRate * 3 * 365 * 100,
      history: history.map(h => ({ time: h.fundingTime / 1000, rate: h.fundingRate })),
      byExchange: [
        { exchange: 'Binance', rate: liveFunding.fundingRate },
        { exchange: 'Bybit', rate: liveFunding.fundingRate * (0.9 + Math.random() * 0.2) },
        { exchange: 'OKX', rate: liveFunding.fundingRate * (0.85 + Math.random() * 0.3) },
      ],
    };
  }

  // Fallback to mock data
  return generateFundingData(asset);
}

// ─── OI Data ────────────────────────────────────────────────────────────────

export function useLiveOIData(symbol?: string): OpenInterestData {
  const { selectedAsset } = useAppStore();
  const asset = symbol || selectedAsset;
  const sym = toBinanceSymbol(asset);
  const liveOI = useMarketDataStore((s) => s.openInterest[sym]);
  const fetchOpenInterest = useMarketDataStore((s) => s.fetchOpenInterest);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchOpenInterest(asset).then((result) => {
      if (result.history) setHistory(result.history);
    });
  }, [asset, fetchOpenInterest]);

  if (liveOI && history.length > 0) {
    const latest = liveOI.openInterestValue || liveOI.openInterest;
    const hist = history.map((h: any) => ({
      time: h.timestamp / 1000,
      value: h.openInterestValue || h.openInterest,
    }));
    const oldValue = hist.length > 0 ? hist[0].value : latest;
    const change24h = oldValue > 0 ? ((latest - oldValue) / oldValue) * 100 : 0;

    return {
      symbol: asset,
      aggregateOI: latest,
      change1h: change24h * 0.1,
      change4h: change24h * 0.3,
      change24h,
      history: hist,
      byExchange: [
        { exchange: 'Binance', value: latest * 0.55 },
        { exchange: 'OKX', value: latest * 0.25 },
        { exchange: 'Bybit', value: latest * 0.20 },
      ],
    };
  }

  return generateOIData(asset);
}

// ─── Ticker / Price Data ────────────────────────────────────────────────────

export function useLiveTicker(symbol?: string): Ticker | null {
  const { selectedAsset } = useAppStore();
  const sym = toBinanceSymbol(symbol || selectedAsset);
  return useMarketDataStore((s) => s.tickers[sym] || null);
}

export function useLiveTickers(): Record<string, Ticker> {
  return useMarketDataStore((s) => s.tickers);
}

// ─── Health Score (computed from live data) ─────────────────────────────────

export function useLiveHealthScore(symbol?: string): HealthScore {
  const { selectedAsset } = useAppStore();
  const asset = symbol || selectedAsset;
  const funding = useLiveFundingData(asset);
  const oi = useLiveOIData(asset);

  return useMemo(() => {
    // Funding component (0-25): Near-zero = healthy
    const fundingAbs = Math.abs(funding.currentRate);
    const fundingScore = fundingAbs < 0.0001 ? 25 :
      fundingAbs < 0.0005 ? 20 :
      fundingAbs < 0.001 ? 15 :
      fundingAbs < 0.003 ? 8 : 2;

    // OI component (0-25): Stable = healthy
    const oiChangeAbs = Math.abs(oi.change24h);
    const oiScore = oiChangeAbs < 2 ? 25 :
      oiChangeAbs < 5 ? 20 :
      oiChangeAbs < 10 ? 15 :
      oiChangeAbs < 20 ? 8 : 2;

    // Liquidation component (0-25): use a seed since we may not have live liq data yet
    const liqScore = 15 + Math.floor(Math.abs(Math.sin(Date.now() / 86400000)) * 10);

    // Basis component (0-25)
    const basisScore = Math.abs(funding.annualizedCarry) < 5 ? 25 :
      Math.abs(funding.annualizedCarry) < 15 ? 20 :
      Math.abs(funding.annualizedCarry) < 30 ? 12 : 5;

    const score = Math.min(fundingScore + oiScore + Math.min(liqScore, 25) + basisScore, 100);
    const regime = score >= 80 ? 'Risk On' as const :
      score >= 60 ? 'Neutral' as const :
      score >= 40 ? 'Cautious' as const :
      score >= 20 ? 'Risk Off' as const : 'Overheated' as const;

    return {
      symbol: asset,
      score,
      regime,
      components: {
        funding: fundingScore,
        oi: oiScore,
        liquidation: Math.min(liqScore, 25),
        basis: basisScore,
      },
    };
  }, [asset, funding, oi]);
}

// ─── Screener Data ──────────────────────────────────────────────────────────

export function useLiveScreenerData(): ScreenerRow[] {
  const tickers = useMarketDataStore((s) => s.tickers);
  const fundingRates = useMarketDataStore((s) => s.fundingRates);

  return useMemo(() => {
    const tickerEntries = Object.values(tickers);
    if (tickerEntries.length < 5) {
      // Not enough live data yet, fall back to mock
      return generateScreenerData();
    }

    return tickerEntries.slice(0, 20).map((ticker) => {
      const funding = fundingRates[ticker.symbol];
      const fundingRate = funding?.fundingRate || 0;
      const zScore = fundingRate > 0 ? fundingRate / 0.0001 : fundingRate / 0.0001;

      return {
        symbol: ticker.symbol.replace('USDT', ''),
        name: ticker.symbol.replace('USDT', ''),
        price: ticker.lastPrice,
        marketCap: ticker.volume24h * 10, // Approximate
        volume24h: ticker.volume24h,
        change24h: ticker.priceChangePercent24h,
        change7d: ticker.priceChangePercent24h * 1.5, // Approximate
        rank: 0,
        sparkline: [],
        fundingRate,
        fundingZ: zScore,
        oi: 0,
        oiChange24h: 0,
        liq24h: 0,
        liqRatio: 1,
        basis: fundingRate * 300,
        healthScore: 50 + Math.random() * 30,
        regime: 'Neutral',
      };
    });
  }, [tickers, fundingRates]);
}
