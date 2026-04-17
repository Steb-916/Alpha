/**
 * GET /api/market/history/oi?asset=BTC&days=7
 *
 * Historical open interest snapshots from OISnapshot table.
 * Cache TTL 5min.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAsset } from '@/config/assets';
import { withCacheAndStale } from '@/lib/cache/redis';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 300;

interface SeriesPoint {
  time: number;
  oi: number;
  oiUsd: number;
  price: number;
}

interface HistoryResponse {
  asset: string;
  days: number;
  series: {
    binance: SeriesPoint[];
    bybit: SeriesPoint[];
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetParam = url.searchParams.get('asset') || 'BTC';
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get('days') ?? 7)));

    const cfg = resolveAsset(assetParam);
    if (!cfg) {
      return NextResponse.json(
        { error: `Unsupported asset: ${assetParam}` },
        { status: 400 },
      );
    }

    const cacheKey = `market:history:oi:${cfg.symbol}:${days}`;

    const data = await withCacheAndStale<HistoryResponse>(
      cacheKey,
      TTL_SECONDS,
      async () => {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const rows = await prisma.oISnapshot.findMany({
          where: { asset: cfg.symbol, timestamp: { gte: since } },
          orderBy: { timestamp: 'asc' },
        });

        const binance: SeriesPoint[] = [];
        const bybit: SeriesPoint[] = [];
        for (const r of rows) {
          const point = {
            time: r.timestamp.getTime(),
            oi: r.oi,
            oiUsd: r.oiUsd,
            price: r.price,
          };
          if (r.exchange === 'binance') binance.push(point);
          else if (r.exchange === 'bybit') bybit.push(point);
        }

        return {
          asset: cfg.symbol,
          days,
          series: { binance, bybit },
        };
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    captureRouteError(error, { route: '/api/market/history/oi' });
    return NextResponse.json(
      { error: 'Failed to load OI history' },
      { status: 500 },
    );
  }
}
