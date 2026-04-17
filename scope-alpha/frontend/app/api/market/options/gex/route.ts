/**
 * GET /api/market/options/gex?asset=BTC
 *
 * Dealer gamma exposure by strike — computed in TypeScript from the
 * Deribit Greeks. On cold cache, warms the options pipeline inline
 * (which triggers the GEX compute in the fetcher).
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { warmChainCache } from '@/lib/options/fetcher';
import type { GEXOutput } from '@/types/options';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: 'GEX data only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;
  const key = `options:gex:${currency}`;

  const fresh = await getCached<GEXOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<GEXOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log(`[options/gex] Cold cache for ${currency}, warming on demand...`);
  const warmed = await warmChainCache(currency);
  if (warmed.gex) return NextResponse.json(warmed.gex);

  const afterWait = await getCached<GEXOutput>(key);
  if (afterWait) return NextResponse.json(afterWait);

  return NextResponse.json(
    { error: 'GEX data temporarily unavailable', asset: currency },
    { status: 503 },
  );
}
