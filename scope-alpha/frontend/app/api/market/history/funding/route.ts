/**
 * GET /api/market/history/funding?asset=BTC&days=30
 *
 * Historical funding rate snapshots from the FundingRateSnapshot table.
 * Returns per-exchange time series + z-score bands for overlay rendering.
 * Cache TTL 5min — historical data changes slowly.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAsset } from '@/config/assets';
import { withCacheAndStale } from '@/lib/cache/redis';
import { mean, stddev } from '@/lib/analytics/math';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 300;

interface SeriesPoint {
  time: number;
  rate: number;
}

interface HistoryResponse {
  asset: string;
  days: number;
  series: {
    binance: SeriesPoint[];
    bybit: SeriesPoint[];
  };
  zScoreBands: {
    mean: number;
    stddev: number;
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetParam = url.searchParams.get('asset') || 'BTC';
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') ?? 30)));

    const cfg = resolveAsset(assetParam);
    if (!cfg) {
      return NextResponse.json(
        { error: `Unsupported asset: ${assetParam}` },
        { status: 400 },
      );
    }

    const cacheKey = `market:history:funding:${cfg.symbol}:${days}`;

    const data = await withCacheAndStale<HistoryResponse>(
      cacheKey,
      TTL_SECONDS,
      async () => {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const rows = await prisma.fundingRateSnapshot.findMany({
          where: { asset: cfg.symbol, timestamp: { gte: since } },
          orderBy: { timestamp: 'asc' },
        });

        const binance: SeriesPoint[] = [];
        const bybit: SeriesPoint[] = [];
        for (const r of rows) {
          const point = { time: r.timestamp.getTime(), rate: r.rate };
          if (r.exchange === 'binance') binance.push(point);
          else if (r.exchange === 'bybit') bybit.push(point);
        }

        const allRates = rows.map((r) => r.rate);
        return {
          asset: cfg.symbol,
          days,
          series: { binance, bybit },
          zScoreBands: {
            mean: mean(allRates),
            stddev: stddev(allRates),
          },
        };
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    captureRouteError(error, { route: '/api/market/history/funding' });
    return NextResponse.json(
      { error: 'Failed to load funding history' },
      { status: 500 },
    );
  }
}
