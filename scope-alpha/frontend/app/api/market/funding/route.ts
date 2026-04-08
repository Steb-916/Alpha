/**
 * GET /api/market/funding?symbol=BTC
 *
 * Returns multi-exchange funding rate data in the app's internal `FundingData`
 * shape (matches `lib/types.ts`). Backed by Upstash cache + stale fallback.
 */

import { NextResponse } from 'next/server';
import { aggregateFunding } from '@/lib/market/aggregator';
import { withCacheAndStale } from '@/lib/cache/redis';
import { generateFundingData } from '@/lib/mockData';
import { resolveAsset } from '@/config/assets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 60;

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

  // Feature flag — bypass live data entirely.
  if (process.env.NEXT_PUBLIC_LIVE_DATA_ENABLED === 'false') {
    return NextResponse.json(generateFundingData(cfg.symbol));
  }

  try {
    const data = await withCacheAndStale(
      `market:funding:${cfg.symbol}`,
      TTL_SECONDS,
      () => aggregateFunding(cfg.symbol),
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[/api/market/funding] ${cfg.symbol} failed:`, err);
    // Last-resort: synthesize a mock so the UI never blanks.
    return NextResponse.json(
      { ...generateFundingData(cfg.symbol), _stale: true, _mock: true },
      { status: 200 },
    );
  }
}
