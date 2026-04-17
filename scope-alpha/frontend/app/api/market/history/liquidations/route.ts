/**
 * GET /api/market/history/liquidations?asset=BTC&days=30
 *
 * Daily stacked-bar aggregates of long vs short liquidation USD volume,
 * computed from LiquidationEvent rows. Cache TTL 5min.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAsset } from '@/config/assets';
import { withCacheAndStale } from '@/lib/cache/redis';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 300;

interface DayBucket {
  date: string; // YYYY-MM-DD (UTC)
  longUsd: number;
  shortUsd: number;
  total: number;
}

interface HistoryResponse {
  asset: string;
  days: number;
  buckets: DayBucket[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
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

    const cacheKey = `market:history:liq:${cfg.symbol}:${days}`;

    const data = await withCacheAndStale<HistoryResponse>(
      cacheKey,
      TTL_SECONDS,
      async () => {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const rows = await prisma.liquidationEvent.findMany({
          where: { asset: cfg.symbol, timestamp: { gte: since } },
          orderBy: { timestamp: 'asc' },
        });

        // Pre-fill buckets so days with zero events still appear on the chart.
        const bucketMap = new Map<string, DayBucket>();
        for (let i = 0; i < days; i++) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const key = dayKey(d);
          bucketMap.set(key, { date: key, longUsd: 0, shortUsd: 0, total: 0 });
        }

        for (const r of rows) {
          const key = dayKey(r.timestamp);
          const b = bucketMap.get(key);
          if (!b) continue;
          if (r.side === 'long') b.longUsd += r.usdValue;
          else if (r.side === 'short') b.shortUsd += r.usdValue;
          b.total = b.longUsd + b.shortUsd;
        }

        const buckets = Array.from(bucketMap.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        );

        return {
          asset: cfg.symbol,
          days,
          buckets,
        };
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    captureRouteError(error, { route: '/api/market/history/liquidations' });
    return NextResponse.json(
      { error: 'Failed to load liquidation history' },
      { status: 500 },
    );
  }
}
