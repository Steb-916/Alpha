/**
 * GET /api/market/onchain/whale-feed?asset=BTC&minValue=1000000
 *
 * Returns recent large transactions (>$1M by default).
 * Falls back to mock data when WHALE_ALERT_API_KEY is not set.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchWhaleTransactions } from '@/lib/onchain/whale-alert';
import type { WhaleFeedData } from '@/lib/onchain/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL = 5 * 60; // 5 minutes

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetParam = url.searchParams.get('asset');
  const asset = assetParam ? assetParam.toUpperCase() : null;
  const minValue = parseInt(url.searchParams.get('minValue') ?? '1000000', 10);

  const cacheKey = `onchain:whale-feed:${asset ?? 'all'}:${minValue}`;

  const fresh = await getCached<WhaleFeedData>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  try {
    const data = await fetchWhaleTransactions(asset, minValue, 20);
    await writeFreshAndStale(cacheKey, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[onchain/whale-feed] fetch failed:', err);
    const stale = await getStale<WhaleFeedData>(cacheKey);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      { error: 'Whale feed unavailable' },
      { status: 503 },
    );
  }
}
