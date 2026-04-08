/**
 * Phase 7 SSE / market-data freshness check.
 *
 * Reads the Phase 1 BTC 1h candle cache key and reports how recent the
 * cached value is. Used by external uptime monitors to detect when the
 * background market data poller has fallen over.
 *
 * Returns:
 *   - 200 { status: 'ok',     lastUpdate, staleSinceMs: 0 }    fresh
 *   - 200 { status: 'unknown' }                                no cache present (dev)
 *   - 503 { status: 'stale',  lastUpdate, staleSinceMs: <n> }  >2 minutes old
 */

import { NextResponse } from "next/server";
import { getCached } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

interface CachedCandles {
  _cachedAt?: number;
}

export async function GET() {
  const cached = await getCached<CachedCandles>("market:candles:BTCUSDT:1h");

  if (!cached || !cached._cachedAt) {
    // No cache present — dev environment with no SSE poller running.
    // Return 200 unknown to avoid false alerts.
    return NextResponse.json(
      { status: "unknown", lastUpdate: null, staleSinceMs: 0 },
      { status: 200 },
    );
  }

  const ageMs = Date.now() - cached._cachedAt;
  const stale = ageMs > STALE_THRESHOLD_MS;

  return NextResponse.json(
    {
      status: stale ? "stale" : "ok",
      lastUpdate: new Date(cached._cachedAt).toISOString(),
      staleSinceMs: stale ? ageMs : 0,
    },
    { status: stale ? 503 : 200 },
  );
}
