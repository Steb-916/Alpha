/**
 * GET /api/market/options/greeks-exposure?asset=BTC
 *
 * Dealer vanna + charm exposure maps.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { warmChainCache } from '@/lib/options/fetcher';
import type { GreeksExposureOutput } from '@/types/options';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: 'Greeks exposure only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;
  const key = `options:greeks-exposure:${currency}`;

  const fresh = await getCached<GreeksExposureOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<GreeksExposureOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log(
    `[options/greeks-exposure] Cold cache for ${currency}, warming on demand...`,
  );
  const warmed = await warmChainCache(currency);
  if (warmed.greeksExposure) return NextResponse.json(warmed.greeksExposure);

  const afterWait = await getCached<GreeksExposureOutput>(key);
  if (afterWait) return NextResponse.json(afterWait);

  return NextResponse.json(
    { error: 'Greeks exposure temporarily unavailable', asset: currency },
    { status: 503 },
  );
}
