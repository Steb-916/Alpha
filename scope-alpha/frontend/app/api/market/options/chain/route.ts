/**
 * GET /api/market/options/chain?asset=BTC
 *
 * Returns the cached aggregated options chain (per-expiry summary).
 * Populated by the refresh-options cron proactively. On cold cache, warms
 * inline so the first visitor after a deploy doesn't see an empty state.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { warmChainCache } from '@/lib/options/fetcher';
import type { ChainAggregate } from '@/lib/options/aggregate';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: `Options data only available for BTC and ETH (requested: ${asset})` },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;
  const key = `options:aggregate:${currency}`;

  const fresh = await getCached<ChainAggregate>(key);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<ChainAggregate>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  // Cold cache — warm on demand.
  console.log(`[options/chain] Cold cache for ${currency}, warming on demand...`);
  const warmed = await warmChainCache(currency);
  if (warmed.aggregate) return NextResponse.json(warmed.aggregate);

  // Another warmer held the lock — re-read what they wrote.
  const afterWait = await getCached<ChainAggregate>(key);
  if (afterWait) return NextResponse.json(afterWait);
  const staleAfter = await getStale<ChainAggregate>(key);
  if (staleAfter) return NextResponse.json({ ...staleAfter, _stale: true });

  return NextResponse.json(
    { error: 'Options data temporarily unavailable', asset: currency },
    { status: 503 },
  );
}
