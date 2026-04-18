/**
 * GET /api/market/options/options-flow?asset=BTC&minPremium=100000
 *
 * Returns options flow events derived from hourly volume deltas.
 * Filters by minPremium (USD) — applied server-side before returning.
 *
 * Note: flow events represent volume spikes between consecutive hourly
 * cron snapshots. Flow direction (buy/sell) is not available from
 * BookSummary data and is marked "unknown".
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import type { OptionsFlow } from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  const minPremium = parseFloat(url.searchParams.get('minPremium') || '0');

  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'Options data only available for BTC and ETH' },
      { status: 400 },
    );
  }

  const raw =
    (await getCached<OptionsFlow>(`options:flow:${asset}`)) ||
    (await getStale<OptionsFlow>(`options:flow:${asset}`));

  if (!raw) {
    return NextResponse.json(
      {
        error: 'Options flow data not yet computed — trigger the refresh-options cron',
        quantEngineConfigured: true,
      },
      { status: 503 },
    );
  }

  const filtered: OptionsFlow = {
    ...raw,
    events: minPremium > 0
      ? raw.events.filter((e) => e.premiumUsd >= minPremium)
      : raw.events,
    _stale: (raw as OptionsFlow & { _stale?: boolean })._stale,
  } as OptionsFlow;

  return NextResponse.json(filtered);
}
