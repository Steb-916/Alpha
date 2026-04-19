/**
 * GET /api/market/onchain/stablecoins
 *
 * Aggregate USDT + USDC + DAI supply via DefiLlama (free, no key).
 * Cache-first. Miss → fetch current aggregate + 3,000+ point chart series.
 * No asset query param — this tab is aggregate-only in v1.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { getStablecoinProvider } from '@/lib/onchain';
import type { OnChainStablecoinsResponse } from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL = 3_600;
const CACHE_KEY = 'onchain:stablecoins';

export async function GET() {
  const fresh = await getCached<OnChainStablecoinsResponse>(CACHE_KEY);
  if (fresh) return NextResponse.json(fresh);

  const provider = getStablecoinProvider();
  const [aggregate, chart] = await Promise.all([
    provider.fetchStablecoinAggregate(),
    provider.fetchStablecoinChart(),
  ]);

  if (!aggregate) {
    const stale = await getStale<OnChainStablecoinsResponse>(CACHE_KEY);
    if (stale) return NextResponse.json({ ...stale, staleness: 'stale' as const });
    return NextResponse.json(
      { error: 'Stablecoin aggregate unavailable', provider_configured: true },
      { status: 503 },
    );
  }

  const overlay: OnChainStablecoinsResponse = {
    aggregate,
    chart: chart ?? [],
    staleness: 'fresh',
    provider_configured: true,
  };
  await setCached(CACHE_KEY, overlay, CACHE_TTL);
  return NextResponse.json(overlay);
}
