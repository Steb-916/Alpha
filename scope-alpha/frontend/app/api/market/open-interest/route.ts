/**
 * GET /api/market/open-interest?symbol=BTC
 *
 * Returns multi-exchange OI data in the app's internal `OpenInterestData`
 * shape. Cached for 30s with stale fallback.
 */

import { NextResponse } from 'next/server';
import { aggregateOI } from '@/lib/market/aggregator';
import { withCacheAndStale } from '@/lib/cache/redis';
import { generateOIData } from '@/lib/mockData';
import { resolveAsset } from '@/config/assets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get('symbol') || 'BTC';
  const cfg = resolveAsset(symbolParam);
  if (!cfg) {
    return NextResponse.json(
      { error: `Unsupported symbol: ${symbolParam}` },
      { status: 400 },
    );
  }

  if (process.env.NEXT_PUBLIC_LIVE_DATA_ENABLED === 'false') {
    return NextResponse.json(generateOIData(cfg.symbol));
  }

  try {
    const data = await withCacheAndStale(
      `market:oi:${cfg.symbol}`,
      TTL_SECONDS,
      () => aggregateOI(cfg.symbol),
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[/api/market/open-interest] ${cfg.symbol} failed:`, err);
    return NextResponse.json(
      { ...generateOIData(cfg.symbol), _stale: true, _mock: true },
      { status: 200 },
    );
  }
}
