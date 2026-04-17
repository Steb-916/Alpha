/**
 * Cron-triggered Deribit options data refresh.
 *
 * GET /api/cron/refresh-options
 * Headers: Authorization: Bearer ${CRON_SECRET}
 *
 * Thin scheduler on top of `fetchAndCacheOptionsData` — the actual fetch,
 * parse, cache, Quant Engine dispatch, and snapshot persistence all live in
 * lib/options/fetcher.ts, which is also called by the options API routes
 * on cache miss for on-demand warming.
 *
 * Schedule: hourly (0 * * * *) per vercel.json. Hobby-compatible.
 * At 02:00 UTC additionally runs the daily retention cleanup.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchAndCacheOptionsData } from '@/lib/options/fetcher';
import { quantEngine } from '@/lib/quant-engine';
import type { DeribitCurrency } from '@/lib/exchanges/deribit-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ASSETS: DeribitCurrency[] = ['BTC', 'ETH'];

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

interface AssetResult {
  asset: string;
  instruments: number;
  persisted: number;
  quantCalls: Record<string, boolean>;
  error?: string;
}

async function runRetention(): Promise<{ deleted: number }> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deletedHourly = await prisma.$executeRaw`
      DELETE FROM "OptionsChainSnapshot"
      WHERE "timestamp" < ${thirtyDaysAgo}
      AND EXTRACT(HOUR FROM "timestamp") != 12
    `;
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const deletedOld = await prisma.$executeRaw`
      DELETE FROM "OptionsChainSnapshot"
      WHERE "timestamp" < ${yearAgo}
    `;
    return { deleted: Number(deletedHourly) + Number(deletedOld) };
  } catch (err) {
    console.warn('[refresh-options] retention failed:', (err as Error).message);
    return { deleted: 0 };
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTs = Date.now();
  const results: AssetResult[] = [];
  for (const asset of ASSETS) {
    const r = await fetchAndCacheOptionsData(asset, {
      skipQuantEngine: false,
      skipPersistence: false,
    });
    results.push({
      asset: r.asset,
      instruments: r.metrics.instruments,
      persisted: r.metrics.persisted,
      quantCalls: r.metrics.quantCalls,
      ...(r.metrics.error != null ? { error: r.metrics.error } : {}),
    });
  }

  let retention: { deleted: number } | null = null;
  if (new Date().getUTCHours() === 2) {
    retention = await runRetention();
  }

  const elapsedMs = Date.now() - startTs;
  return NextResponse.json({
    ok: true,
    assets: results,
    quantEngineConfigured: quantEngine.configured,
    retention,
    elapsedMs,
  });
}
