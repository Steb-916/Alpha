/**
 * GET /api/market/onchain/stablecoin-flows
 *
 * Returns combined USDT + USDC exchange flow time series (30 days).
 * Positive net flow = stablecoins moving onto exchanges (potential buy pressure).
 * Negative net flow = stablecoins leaving exchanges (potential sell pressure or DeFi).
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, writeFreshAndStale } from '@/lib/cache/redis';
import { fetchStablecoinFlows } from '@/lib/onchain/coinmetrics';
import type { StablecoinFlowData } from '@/lib/onchain/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL = 90 * 60;
const CACHE_KEY = 'onchain:stablecoin-flows';

export async function GET() {
  const fresh = await getCached<StablecoinFlowData>(CACHE_KEY);
  if (fresh) return NextResponse.json(fresh);

  try {
    const data = await fetchStablecoinFlows();
    await writeFreshAndStale(CACHE_KEY, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[onchain/stablecoin-flows] fetch failed:', err);
    const stale = await getStale<StablecoinFlowData>(CACHE_KEY);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      { error: 'Stablecoin flow data unavailable — trigger the refresh-onchain cron' },
      { status: 503 },
    );
  }
}
