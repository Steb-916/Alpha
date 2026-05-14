/**
 * GET /api/market/macro/token-unlocks
 *
 * Returns curated upcoming token unlock events (static data).
 * Sorted by date ascending. Events in the past are filtered out.
 */

import { NextResponse } from 'next/server';
import { TOKEN_UNLOCK_EVENTS } from '@/lib/macro/token-unlocks-data';
import type { TokenUnlockResponse } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const now = new Date();
  const upcoming = TOKEN_UNLOCK_EVENTS
    .filter((e) => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({ events: upcoming } satisfies TokenUnlockResponse);
}
