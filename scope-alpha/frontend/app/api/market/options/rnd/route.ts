/**
 * GET /api/market/options/rnd?asset=BTC&expiry=2026-05-01
 *
 * Returns the cached Risk-Neutral Density for a specific expiration.
 * On cold cache, warms the full options pipeline inline (computes RND for
 * the nearest 4 expirations); returns the requested expiry if present.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import { warmChainCache } from '@/lib/options/fetcher';
import type { RNDOutput } from '@/types/options';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const expiry = url.searchParams.get('expiry');

  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: `Options data only available for BTC and ETH` },
      { status: 400 },
    );
  }
  if (!expiry || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    return NextResponse.json(
      { error: 'Missing or malformed ?expiry=YYYY-MM-DD' },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;
  const key = `options:rnd:${currency}:${expiry}`;

  const fresh = await getCached<RNDOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<RNDOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log(
    `[options/rnd] Cold cache for ${currency}@${expiry}, warming on demand...`,
  );
  const warmed = await warmChainCache(currency);
  const rndForExpiry = warmed.rnd[expiry];
  if (rndForExpiry) return NextResponse.json(rndForExpiry);

  // Another warmer may have computed it while we waited.
  const afterWait = await getCached<RNDOutput>(key);
  if (afterWait) return NextResponse.json(afterWait);

  return NextResponse.json(
    {
      error: quantEngine.configured
        ? 'RND not yet computed for this expiration'
        : 'Quant Engine not configured',
      quantEngineConfigured: quantEngine.configured,
    },
    { status: 503 },
  );
}
