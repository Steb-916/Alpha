/**
 * GET /api/market/options/max-pain-pin-risk?asset=BTC
 *
 * Returns max pain and pin risk score per expiration.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import type { MaxPainPinRisk } from '@/types/options';

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

  const fresh = await getCached<MaxPainPinRisk>(`options:max-pain-pin-risk:${asset}`);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<MaxPainPinRisk>(`options:max-pain-pin-risk:${asset}`);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  return NextResponse.json(
    { error: 'Max pain data not yet computed — trigger the refresh-options cron', quantEngineConfigured: true },
    { status: 503 },
  );
}
