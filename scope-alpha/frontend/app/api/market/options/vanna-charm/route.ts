/**
 * GET /api/market/options/vanna-charm?asset=BTC
 *
 * Returns vanna and charm exposure by strike and expiration.
 * Vanna: how IV changes force delta-hedging. Charm: how time decay forces hedging.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import type { VannaCharmExposure } from '@/types/options';

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

  const fresh = await getCached<VannaCharmExposure>(`options:vanna-charm:${asset}`);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<VannaCharmExposure>(`options:vanna-charm:${asset}`);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  return NextResponse.json(
    { error: 'Vanna/Charm data not yet computed — trigger the refresh-options cron', quantEngineConfigured: true },
    { status: 503 },
  );
}
