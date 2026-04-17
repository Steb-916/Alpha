/**
 * GET /api/market/options/vol-cone?asset=BTC
 *
 * Returns the cached volatility cone from the Quant Engine.
 * On cold cache, warms the options pipeline inline.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import { warmChainCache } from '@/lib/options/fetcher';
import type { VolConeOutput } from '@/types/options';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json({ error: 'BTC/ETH only' }, { status: 400 });
  }
  const currency = asset as DeribitCurrency;
  const key = `options:vol-cone:${currency}`;

  const fresh = await getCached<VolConeOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<VolConeOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log(
    `[options/vol-cone] Cold cache for ${currency}, warming on demand...`,
  );
  const warmed = await warmChainCache(currency);
  if (warmed.volCone) return NextResponse.json(warmed.volCone);

  const afterWait = await getCached<VolConeOutput>(key);
  if (afterWait) return NextResponse.json(afterWait);

  return NextResponse.json(
    {
      error: quantEngine.configured
        ? 'Vol cone not yet computed'
        : 'Quant Engine not configured',
      quantEngineConfigured: quantEngine.configured,
    },
    { status: 503 },
  );
}
