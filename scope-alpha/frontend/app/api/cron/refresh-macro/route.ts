/**
 * Cron-triggered macro data refresh.
 *
 * GET /api/cron/refresh-macro
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * Refreshes all 5 macro endpoints by calling them directly.
 * ETF flows are static-seeded (no network call needed, just re-cache).
 * Schedule: every 2 hours (0 *\/2 * * *) per vercel.json.
 */

import { NextResponse } from 'next/server';
import { setCached } from '@/lib/cache/redis';
import { computeCorrelationMatrix, getEtfFlowData, getTokenUnlockCalendar } from '@/lib/macro/fetchers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const results: Record<string, string> = {};

  // Correlations (most expensive — calls Yahoo + CoinGecko)
  try {
    const corr = await computeCorrelationMatrix(30);
    await setCached('macro:correlations:30d', corr, 3600);
    results.correlations = 'ok';
  } catch (err) {
    results.correlations = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // ETF flows (static — just refresh the cache)
  try {
    const etf = getEtfFlowData();
    await setCached('macro:etf-flows', etf, 3600);
    results.etfFlows = 'ok';
  } catch (err) {
    results.etfFlows = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Token unlocks (enriches prices from CoinGecko)
  try {
    const unlocks = await getTokenUnlockCalendar();
    await setCached('macro:token-unlocks', unlocks, 3600);
    results.tokenUnlocks = 'ok';
  } catch (err) {
    results.tokenUnlocks = `error: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Regime + convergence are triggered on-demand (15-min TTL); no pre-fetch needed here

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    results,
  });
}
