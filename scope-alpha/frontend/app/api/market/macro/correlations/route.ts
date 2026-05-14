/**
 * GET /api/market/macro/correlations
 *
 * Fetches BTC vs macro asset correlations from the Quant Engine.
 * The Quant Engine calls yfinance internally — this route is cache-first.
 *
 * Cache TTL: 14400s (4h) — daily bar data, no need to refresh more often.
 * Degrades gracefully when Quant Engine is unconfigured.
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { quantEngine } from '@/lib/quant-engine';
import type { CorrelationResponse } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_KEY = 'macro:correlations';
const TTL = 14400;

export async function GET() {
  const fresh = await getCached<CorrelationResponse>(CACHE_KEY);
  if (fresh) return NextResponse.json(fresh);

  if (!quantEngine.configured) {
    const stale = await getStale<CorrelationResponse>(CACHE_KEY);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      {
        error: 'Macro correlations unavailable — Quant Engine not configured',
        quant_engine_configured: false,
      },
      { status: 503 },
    );
  }

  const result = await quantEngine.macroCorrelations(120);
  if (!result) {
    const stale = await getStale<CorrelationResponse>(CACHE_KEY);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json(
      { error: 'Quant Engine returned null for correlations', quant_engine_configured: true },
      { status: 503 },
    );
  }

  const response: CorrelationResponse = {
    ...result,
    quant_engine_configured: true,
  };

  await setCached(CACHE_KEY, response, TTL);
  return NextResponse.json(response);
}
