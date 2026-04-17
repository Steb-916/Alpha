/**
 * GET /api/market/options/chain?asset=BTC
 *
 * Returns the cached aggregated options chain (per-expiry summary).
 * Populated by the refresh-options cron; cold cache returns 503.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import type { ChainAggregate } from '@/lib/options/aggregate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: `Options data only available for BTC and ETH (requested: ${asset})` },
      { status: 400 },
    );
  }

  const fresh = await getCached<ChainAggregate>(`options:aggregate:${asset}`);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<ChainAggregate>(`options:aggregate:${asset}`);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  return NextResponse.json(
    { error: 'Options cache cold. Cron has not yet run.' },
    { status: 503 },
  );
}
