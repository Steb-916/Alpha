/**
 * GET /api/market/options/gex-history?asset=BTC&days=7
 *
 * Returns hourly GEX snapshots for the heatmap-over-time visualization.
 * Reads directly from the GEXSnapshot table.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { GEXHistoryOutput, GEXHistoryPoint, GEXLevel } from '@/types/options';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);
const MAX_DAYS = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const days = Math.min(
    MAX_DAYS,
    Math.max(1, Number(url.searchParams.get('days') ?? '7') | 0),
  );

  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: 'GEX history only available for BTC and ETH' },
      { status: 400 },
    );
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.gEXSnapshot
    .findMany({
      where: { asset, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    })
    .catch(() => []);

  const points: GEXHistoryPoint[] = rows.map((r) => ({
    timestamp: r.timestamp.toISOString(),
    spot_price: r.spotPrice,
    gamma_flip: r.gammaFlip,
    total_gex: r.totalGex,
    regime:
      r.regime === 'positive_gamma' ? 'positive_gamma' : 'negative_gamma',
    call_wall: r.callWall,
    put_wall: r.putWall,
    levels: (r.levelsData as unknown as GEXLevel[]) ?? [],
  }));

  const out: GEXHistoryOutput = { asset, days, points };
  return NextResponse.json(out);
}
