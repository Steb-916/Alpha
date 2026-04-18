/**
 * GET /api/market/options/gex?asset=BTC
 *
 * Returns gamma exposure by strike for all active expirations.
 * Computed from Black-Scholes greeks using mark IV from the cached chain.
 * Refreshed hourly by the refresh-options cron.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import type { GexByStrike } from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'Options data only available for BTC and ETH' },
      { status: 400 },
    );
  }

  const fresh = await getCached<GexByStrike>(`options:gex:${asset}`);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<GexByStrike>(`options:gex:${asset}`);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  return NextResponse.json(
    { error: 'GEX data not yet computed — trigger the refresh-options cron', quantEngineConfigured: true },
    { status: 503 },
  );
}
