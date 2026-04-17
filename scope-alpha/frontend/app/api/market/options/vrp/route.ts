/**
 * GET /api/market/options/vrp?asset=BTC
 *
 * Returns the cached volatility risk premium from the Quant Engine.
 * On cold cache, warms the options pipeline inline.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import { warmChainCache } from '@/lib/options/fetcher';
import type { VRPOutput } from '@/types/options';
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
  const key = `options:vrp:${currency}`;

  const fresh = await getCached<VRPOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<VRPOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log(`[options/vrp] Cold cache for ${currency}, warming on demand...`);
  const warmed = await warmChainCache(currency);
  if (warmed.vrp) return NextResponse.json(warmed.vrp);

  const afterWait = await getCached<VRPOutput>(key);
  if (afterWait) return NextResponse.json(afterWait);

  return NextResponse.json(
    {
      error: quantEngine.configured
        ? 'VRP not yet computed'
        : 'Quant Engine not configured',
      quantEngineConfigured: quantEngine.configured,
    },
    { status: 503 },
  );
}
