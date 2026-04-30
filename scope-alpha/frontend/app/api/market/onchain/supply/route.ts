/**
 * GET /api/market/onchain/supply?asset=BTC
 *
 * Returns supply dynamics: realized cap vs market cap (90-day history),
 * MVRV ratio, and exchange supply percentage.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchSupplyMetrics } from '@/lib/onchain/coinmetrics';
import type { SupplyData } from '@/lib/onchain/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);
const CACHE_TTL = 90 * 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();

  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'On-chain data available for BTC and ETH only' },
      { status: 400 },
    );
  }

  const cacheKey = `onchain:supply:${asset}`;

  const fresh = await getCached<SupplyData>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  try {
    const data = await fetchSupplyMetrics(asset);
    await writeFreshAndStale(cacheKey, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[onchain/supply] ${asset} fetch failed:`, err);
    const stale = await getStale<SupplyData>(cacheKey);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      { error: 'Supply data unavailable — trigger the refresh-onchain cron' },
      { status: 503 },
    );
  }
}
