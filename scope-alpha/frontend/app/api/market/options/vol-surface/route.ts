/**
 * GET /api/market/options/vol-surface?asset=BTC
 *
 * Returns the fitted vol surface from the Quant Engine. Returns 503 with
 * `quantEngineConfigured: false` when the Quant Engine is in inert mode.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import type { VolSurfaceOutput } from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: `Options data only available for BTC and ETH` },
      { status: 400 },
    );
  }

  const fresh = await getCached<VolSurfaceOutput>(
    `options:vol-surface:${asset}`,
  );
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<VolSurfaceOutput>(
    `options:vol-surface:${asset}`,
  );
  if (stale) return NextResponse.json({ ...stale, _stale: true });

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
