/**
 * GET /api/market/screener
 *
 * **READ-ONLY** — returns the cached `market:screener` array assembled by
 * the cron warmer (`/api/cron/refresh-screener`). This route never calls
 * exchanges directly; it only reads Redis.
 *
 * DEV COLD-START NOTE
 * -------------------
 * In local development the cron does not run automatically. The first time
 * you load the screener page after `npm run dev`, the cache will be empty
 * and this route returns 503. To warm it manually:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        http://localhost:3000/api/cron/refresh-screener
 *
 * In production, Vercel Cron hits the warm route every minute so this is
 * never an issue.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale } from '@/lib/cache/redis';
import { generateScreenerData } from '@/lib/mockData';
import type { ScreenerRow } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SCREENER_KEY = 'market:screener';

export async function GET() {
  if (process.env.NEXT_PUBLIC_LIVE_DATA_ENABLED === 'false') {
    return NextResponse.json({ rows: generateScreenerData() });
  }

  // Try fresh
  const fresh = await getCached<{ rows: ScreenerRow[]; _cachedAt?: number }>(
    SCREENER_KEY,
  );
  if (fresh) {
    return NextResponse.json(fresh);
  }

  // Try stale
  const stale = await getStale<{ rows: ScreenerRow[]; _cachedAt?: number }>(
    SCREENER_KEY,
  );
  if (stale) {
    return NextResponse.json({ ...stale, _stale: true });
  }

  // Cold cache.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[/api/market/screener] Cold cache. Run:\n' +
        '  curl -H "Authorization: Bearer $CRON_SECRET" ' +
        'http://localhost:3000/api/cron/refresh-screener\n' +
        'Returning mock data so the UI does not blank.',
    );
    return NextResponse.json(
      { rows: generateScreenerData(), _stale: true, _mock: true },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { error: 'Screener cache cold. Cron has not yet run.' },
    { status: 503 },
  );
}
