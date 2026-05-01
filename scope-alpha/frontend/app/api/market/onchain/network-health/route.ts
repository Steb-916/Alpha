/**
 * GET /api/market/onchain/network-health?asset=BTC
 *
 * Returns hash rate (BTC) or TX count + fee data (ETH) for network health.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchNetworkHealth } from '@/lib/onchain/coinmetrics';
import type { NetworkHealthData } from '@/lib/onchain/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);
const CACHE_TTL = 60 * 60; // 1 hour

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();

  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'Network health data available for BTC and ETH only' },
      { status: 400 },
    );
  }

  const cacheKey = `onchain:network-health:${asset}`;

  const fresh = await getCached<NetworkHealthData>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  try {
    const data = await fetchNetworkHealth(asset);
    await writeFreshAndStale(cacheKey, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch (err) {
    console.error(`[onchain/network-health] ${asset} fetch failed:`, err);
    const stale = await getStale<NetworkHealthData>(cacheKey);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      { error: 'Network health data unavailable' },
      { status: 503 },
    );
  }
}
