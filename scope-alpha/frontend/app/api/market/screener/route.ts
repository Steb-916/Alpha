/**
 * GET /api/market/screener
 *
 * Returns the cached multi-asset screener envelope assembled by
 * `warmScreenerCache()`. Read-first: fresh → stale → on-demand warm → 503.
 *
 * Cold-cache warming takes 10–15s for a typical ENABLED_ASSETS list.
 * Subsequent visitors within the 25h TTL get instant cached responses. The
 * scheduled cron continues to keep the cache warm proactively.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { generateScreenerData } from '@/lib/mockData';
import {
  warmScreenerCache,
  SCREENER_KEY,
  type ScreenerEnvelope,
} from '@/lib/market/screener-warmer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// User-facing on-demand warm can take 10–15s for the full asset list.
export const maxDuration = 60;

export async function GET() {
  if (process.env.NEXT_PUBLIC_LIVE_DATA_ENABLED === 'false') {
    return NextResponse.json({ rows: generateScreenerData() });
  }

  const fresh = await getCached<ScreenerEnvelope>(SCREENER_KEY);
  if (fresh) return NextResponse.json(fresh);

  const stale = await getStale<ScreenerEnvelope>(SCREENER_KEY);
  if (stale) return NextResponse.json({ ...stale, _stale: true });

  console.log('[/api/market/screener] Cold cache, warming on demand...');
  const { envelope, lockSkipped } = await warmScreenerCache({
    useLock: true,
    // Cheap operations during a user-triggered warm — avoid blocking on DB
    // writes or alert evaluation. The cron handles persistence.
    skipAlerts: true,
    skipPersistence: true,
  });

  if (envelope && envelope.rows.length > 0) {
    return NextResponse.json(envelope);
  }

  if (lockSkipped) {
    // Another request held the lock — it may have populated the cache.
    const afterWait = await getCached<ScreenerEnvelope>(SCREENER_KEY);
    if (afterWait) return NextResponse.json(afterWait);
    const staleAfter = await getStale<ScreenerEnvelope>(SCREENER_KEY);
    if (staleAfter) return NextResponse.json({ ...staleAfter, _stale: true });
  }

  // Warming failed (or returned zero rows) — last-ditch fallback so the UI
  // doesn't render an empty state. In dev we surface mock data; in prod we
  // 503 so monitoring catches the failure.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json(
      { rows: generateScreenerData(), _stale: true, _mock: true },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { error: 'Screener data temporarily unavailable' },
    { status: 503 },
  );
}
