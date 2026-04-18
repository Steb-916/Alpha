/**
 * GET /api/market/options/dex?asset=BTC
 *
 * Returns delta exposure by strike, showing directional hedging pressure.
 * Computed from Black-Scholes delta using mark IV from the cached chain.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import type { DexByStrike } from '@/types/options';

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

  const fresh = await getCached<DexByStrike>(`options:dex:${asset}`);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<DexByStrike>(`options:dex:${asset}`);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  return NextResponse.json(
    { error: 'DEX data not yet computed — trigger the refresh-options cron', quantEngineConfigured: true },
    { status: 503 },
  );
}
