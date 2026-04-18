/**
 * GET /api/market/options/gex-heatmap?asset=BTC&lookback=30d
 *
 * Returns historical GEX snapshots for the 2D heatmap view.
 * Reads from GreeksExposureSnapshot DB table.
 * Lookback: 7d | 14d | 30d (default 30d).
 *
 * Response is cached for 1 hour since new snapshots arrive hourly.
 */

import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import type { GexHeatmapData, GexStrike } from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);
const VALID_LOOKBACKS = new Set(['7d', '14d', '30d']);
const LOOKBACK_DAYS: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30 };
const CACHE_TTL = 60 * 60; // 1 hour

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const lookback = VALID_LOOKBACKS.has(url.searchParams.get('lookback') || '')
    ? (url.searchParams.get('lookback') as string)
    : '30d';

  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'Options data only available for BTC and ETH' },
      { status: 400 },
    );
  }

  const cacheKey = `options:gex-heatmap:${asset}:${lookback}`;
  const cached = await getCached<GexHeatmapData>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const days = LOOKBACK_DAYS[lookback];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.greeksExposureSnapshot
    .findMany({
      where: { asset, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true, gexData: true },
    })
    .catch(() => []);

  const result: GexHeatmapData = {
    asset,
    lookback,
    dataPoints: rows.length,
    snapshots: rows.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      strikes: r.gexData as GexStrike[],
    })),
  };

  if (rows.length >= 3) {
    await setCached(cacheKey, result, CACHE_TTL);
  }

  return NextResponse.json(result);
}
