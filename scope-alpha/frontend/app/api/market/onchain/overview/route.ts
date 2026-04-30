/**
 * GET /api/market/onchain/overview?asset=BTC
 *
 * Returns MVRV z-score, SOPR, NVT ratio, active addresses,
 * and supply metrics for the given asset.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchOnChainOverview } from '@/lib/onchain/coinmetrics';
import type { OnChainOverview } from '@/lib/onchain/types';

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

  const cacheKey = `onchain:overview:${asset}`;

  const fresh = await getCached<OnChainOverview>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  try {
    const data = await fetchOnChainOverview(asset);
    await writeFreshAndStale(cacheKey, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[onchain/overview] ${asset} fetch failed:`, err);
    const stale = await getStale<OnChainOverview>(cacheKey);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      { error: 'On-chain data unavailable — trigger the refresh-onchain cron' },
      { status: 503 },
    );
  }
}
