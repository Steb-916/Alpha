/**
 * GET /api/market/options/vol-surface?asset=BTC
 *
 * Returns the fitted vol surface from the Quant Engine. On cold cache,
 * warms the options pipeline inline. Returns 503 with
 * `quantEngineConfigured: false` only when the Quant Engine is truly
 * unset — not just because the cron hasn't run.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import { warmChainCache } from '@/lib/options/fetcher';
import type { VolSurfaceOutput } from '@/types/options';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: `Options data only available for BTC and ETH` },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;
  const key = `options:vol-surface:${currency}`;

  const fresh = await getCached<VolSurfaceOutput>(key);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<VolSurfaceOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log(
    `[options/vol-surface] Cold cache for ${currency}, warming on demand...`,
  );
  const warmed = await warmChainCache(currency);
  if (warmed.volSurface) return NextResponse.json(warmed.volSurface);

  // Another warmer may have populated it while we waited.
  const afterWait = await getCached<VolSurfaceOutput>(key);
  if (afterWait) return NextResponse.json(afterWait);

  return NextResponse.json(
    {
      error: quantEngine.configured
        ? 'Vol surface not yet computed'
        : 'Quant Engine not configured',
      quantEngineConfigured: quantEngine.configured,
    },
    { status: 503 },
  );
}
