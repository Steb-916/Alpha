/**
 * GET /api/market/compare?asset=BTC
 *
 * Cross-exchange comparison (Binance vs Bybit) — side-by-side metrics plus
 * spread/differential analysis and a z-score of the current funding spread
 * against the 30-day historical distribution.
 *
 * Cache TTL 30s.
 */

import { NextResponse } from 'next/server';
import { resolveAsset } from '@/config/assets';
import { withCacheAndStale } from '@/lib/cache/redis';
import {
  aggregateBasis,
  aggregateFunding,
  aggregateOI,
} from '@/lib/market/aggregator';
import { BinanceConnector } from '@/lib/exchanges/binance';
import { BybitConnector } from '@/lib/exchanges/bybit';
import { prisma } from '@/lib/prisma';
import { mean, stddev } from '@/lib/analytics/math';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 30;

const binance = new BinanceConnector();
const bybit = new BybitConnector();

interface CompareResponse {
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

function findByExchange<T extends { exchange: string }>(
  arr: T[],
  name: string,
): T | undefined {
  return arr.find((x) => x.exchange.toLowerCase() === name.toLowerCase());
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetParam = url.searchParams.get('asset') || 'BTC';
    const cfg = resolveAsset(assetParam);
    if (!cfg) {
      return NextResponse.json(
        { error: `Unsupported asset: ${assetParam}` },
        { status: 400 },
      );
    }

    const cacheKey = `market:compare:${cfg.symbol}`;

    const data = await withCacheAndStale<CompareResponse>(
      cacheKey,
      TTL_SECONDS,
      async () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [funding, oi, basis, binanceTicker, bybitTicker, historicalFunding, liqs24h] =
          await Promise.all([
            aggregateFunding(cfg.symbol).catch(() => null),
            aggregateOI(cfg.symbol).catch(() => null),
            aggregateBasis(cfg.symbol).catch(() => null),
            binance.get24hrTicker(cfg.binance).catch(() => []),
            bybit.get24hrTicker(cfg.bybit).catch(() => []),
            prisma.fundingRateSnapshot
              .findMany({
                where: { asset: cfg.symbol, timestamp: { gte: thirtyDaysAgo } },
                orderBy: { timestamp: 'asc' },
              })
              .catch(() => []),
            prisma.liquidationEvent
              .groupBy({
                by: ['exchange', 'side'],
                where: {
                  asset: cfg.symbol,
                  timestamp: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  },
                },
                _sum: { usdValue: true },
              })
              .catch(() => []),
          ]);

        const fbBin = funding ? findByExchange(funding.byExchange, 'Binance') : undefined;
        const fbByb = funding ? findByExchange(funding.byExchange, 'Bybit') : undefined;
        const binanceRate = fbBin?.rate ?? 0;
        const bybitRate = fbByb?.rate ?? 0;

        const oiBin = oi ? findByExchange(oi.byExchange, 'Binance') : undefined;
        const oiByb = oi ? findByExchange(oi.byExchange, 'Bybit') : undefined;
        const binanceOIv = oiBin?.value ?? 0;
        const bybitOIv = oiByb?.value ?? 0;
        const totalOI = binanceOIv + bybitOIv;

        const bBin = basis ? findByExchange(basis.byExchange, 'Binance') : undefined;
        const bByb = basis ? findByExchange(basis.byExchange, 'Bybit') : undefined;
        const binanceBasis = bBin?.basis ?? 0;
        const bybitBasis = bByb?.basis ?? 0;

        const binancePrice = binanceTicker.find((t) => t.symbol === cfg.binance)?.lastPrice ?? 0;
        const bybitPrice = bybitTicker.find((t) => t.symbol === cfg.bybit)?.lastPrice ?? 0;

        // 30d spread z-score: history rows grouped by timestamp, compute
        // per-timestamp spread where both exchanges present.
        const byTs = new Map<number, { binance?: number; bybit?: number }>();
        for (const r of historicalFunding) {
          const key = r.timestamp.getTime();
          const slot = byTs.get(key) ?? {};
          if (r.exchange === 'binance') slot.binance = r.rate;
          else if (r.exchange === 'bybit') slot.bybit = r.rate;
          byTs.set(key, slot);
        }
        const spreadHistory: number[] = [];
        for (const slot of byTs.values()) {
          if (slot.binance != null && slot.bybit != null) {
            spreadHistory.push(slot.binance - slot.bybit);
          }
        }
        const currentSpread = binanceRate - bybitRate;
        const spreadMean = mean(spreadHistory);
        const spreadSd = stddev(spreadHistory);
        const differentialZScore =
          spreadSd > 0 ? (currentSpread - spreadMean) / spreadSd : 0;

        // Liquidation per exchange/side aggregates
        const lqMap: Record<string, { long: number; short: number }> = {
          binance: { long: 0, short: 0 },
          bybit: { long: 0, short: 0 },
        };
        for (const row of liqs24h) {
          const bucket = lqMap[row.exchange] ?? { long: 0, short: 0 };
          const val = row._sum.usdValue ?? 0;
          if (row.side === 'long') bucket.long += val;
          else if (row.side === 'short') bucket.short += val;
          lqMap[row.exchange] = bucket;
        }

        return {
          asset: cfg.symbol,
          funding: {
            binance: { rate: binanceRate, annualized: binanceRate * 3 * 365 * 100 },
            bybit: { rate: bybitRate, annualized: bybitRate * 3 * 365 * 100 },
            differential: currentSpread,
            differentialAnnualized: currentSpread * 3 * 365 * 100,
            differentialZScore,
            arbitrageYield: Math.abs(currentSpread) * 3 * 365 * 100,
          },
          openInterest: {
            binance: { oi: binanceOIv },
            bybit: { oi: bybitOIv },
            binanceShare: totalOI > 0 ? (binanceOIv / totalOI) * 100 : 0,
            bybitShare: totalOI > 0 ? (bybitOIv / totalOI) * 100 : 0,
          },
          liquidations24h: {
            binance: lqMap.binance,
            bybit: lqMap.bybit,
          },
          basis: {
            binance: { basisPct: binanceBasis, annualized: binanceBasis * 365 },
            bybit: { basisPct: bybitBasis, annualized: bybitBasis * 365 },
            differential: binanceBasis - bybitBasis,
            differentialAnnualized: (binanceBasis - bybitBasis) * 365,
          },
          price: {
            binance: binancePrice,
            bybit: bybitPrice,
            spread: binancePrice - bybitPrice,
            spreadPct:
              bybitPrice > 0
                ? ((binancePrice - bybitPrice) / bybitPrice) * 100
                : 0,
          },
        };
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    captureRouteError(error, { route: '/api/market/compare' });
    return NextResponse.json(
      { error: 'Failed to compare exchanges' },
      { status: 500 },
    );
  }
}
