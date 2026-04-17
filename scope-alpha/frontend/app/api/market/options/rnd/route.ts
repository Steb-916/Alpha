/**
 * GET /api/market/options/rnd?asset=BTC&expiry=2026-05-01
 *
 * Returns the cached Risk-Neutral Density for a specific expiration.
 * Requires the Quant Engine to have been called with the expiration during
 * the last cron run.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import type { RNDOutput } from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const expiry = url.searchParams.get('expiry');

  if (!ALLOWED.has(asset)) {
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

  const key = `options:rnd:${asset}:${expiry}`;
  const fresh = await getCached<RNDOutput>(key);
  if (fresh) return NextResponse.json(fresh);
  const stale = await getStale<RNDOutput>(key);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

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
