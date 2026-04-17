/**
 * Cron-triggered screener cache warmer.
 *
 * GET /api/cron/refresh-screener
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * Thin scheduler on top of `warmScreenerCache()` — the row building, cache
 * writes, alert evaluation and health persistence all live in
 * lib/market/screener-warmer.ts, which is also called by /api/market/screener
 * on cold cache.
 */

import { NextResponse } from 'next/server';
import { warmScreenerCache } from '@/lib/market/screener-warmer';
import { ENABLED_ASSETS } from '@/config/assets';

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

  const { envelope, elapsedMs } = await warmScreenerCache({
    useLock: false,
    skipAlerts: false,
    skipPersistence: false,
  });

  const rows = envelope?.rows.length ?? 0;
  const errors = envelope?.errors.length ?? 0;
  console.log(
    `[refresh-screener] built ${rows}/${ENABLED_ASSETS.length} rows in ${elapsedMs}ms (${errors} errors)`,
  );

  return NextResponse.json({
    ok: true,
    rows,
    errors,
    elapsedMs,
  });
}
