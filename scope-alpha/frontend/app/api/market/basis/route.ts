/**
 * GET /api/market/basis?symbol=BTC
 *
 * Returns multi-exchange perpetual basis data in the app's internal
 * `BasisData` shape (currentBasis = (mark-index)/index × 100). Cached 30s.
 */

import { NextResponse } from 'next/server';
import { aggregateBasis } from '@/lib/market/aggregator';
import { withCacheAndStale } from '@/lib/cache/redis';
import { generateBasisData } from '@/lib/mockData';
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
    return NextResponse.json(generateBasisData(cfg.symbol));
  }

  try {
    const data = await withCacheAndStale(
      `market:basis:${cfg.symbol}`,
      TTL_SECONDS,
      () => aggregateBasis(cfg.symbol),
    );
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[/api/market/basis] ${cfg.symbol} failed:`, err);
    return NextResponse.json(
      { ...generateBasisData(cfg.symbol), _stale: true, _mock: true },
      { status: 200 },
    );
  }
}
