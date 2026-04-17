/**
 * GET /api/market/options/dex?asset=BTC
 *
 * Dealer delta exposure by strike.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { warmChainCache } from '@/lib/options/fetcher';
import type { DEXOutput } from '@/types/options';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: 'DEX data only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;
  const key = `options:dex:${currency}`;

  const fresh = await getCached<DEXOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<DEXOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log(`[options/dex] Cold cache for ${currency}, warming on demand...`);
  const warmed = await warmChainCache(currency);
  if (warmed.dex) return NextResponse.json(warmed.dex);

  const afterWait = await getCached<DEXOutput>(key);
  if (afterWait) return NextResponse.json(afterWait);

  return NextResponse.json(
    { error: 'DEX data temporarily unavailable', asset: currency },
    { status: 503 },
  );
}
