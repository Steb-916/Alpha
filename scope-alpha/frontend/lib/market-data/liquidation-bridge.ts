/**
 * Liquidation → Redis bridge.
 *
 * The 3/24 SSE pipeline streams individual liquidation events to browsers.
 * The new stateless `/api/market/health` route needs an *aggregated* 24h
 * snapshot per symbol so it can compute the liquidation health component.
 *
 * This module sits between the two halves:
 *   1. `recordLiquidation()` is called from the WS manager every time a
 *      Binance forceOrder event arrives. It updates an in-memory rolling
 *      24h window per symbol.
 *   2. A throttled writer flushes the latest snapshot to Redis under
 *      `market:liq-snapshot:{binanceSymbol}` (TTL 5min) at most once every
 *      5 seconds per symbol — keeps us well under Upstash request budget
 *      while still being fresh enough for the health score.
 *
 * Memory bound: each symbol holds at most ~10k liquidation events trimmed
 * to the last 24h. At realistic event rates that's a few hundred KB total.
 */

import type { Liquidation } from '@/lib/exchanges/types';
import { setCached } from '@/lib/cache/redis';
import { LIQ_SNAPSHOT_KEY, type LiqSnapshot } from '@/lib/market/health';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const FLUSH_THROTTLE_MS = 5_000;
const SNAPSHOT_TTL_S = 300;
const MAX_EVENTS_PER_SYMBOL = 10_000;

interface PerSymbolState {
  events: Liquidation[];
  lastFlushTs: number;
  flushPending: ReturnType<typeof setTimeout> | null;
}

const state = new Map<string, PerSymbolState>();

function notionalUsd(liq: Liquidation): number {
  // Binance liquidation events give quantity in base currency and price in
  // USDT — multiply for an approximate USD notional.
  const qty = Number.isFinite(liq.quantity) ? liq.quantity : 0;
  const price = Number.isFinite(liq.price) ? liq.price : 0;
  return qty * price;
}

function buildSnapshot(events: Liquidation[]): LiqSnapshot {
  let longUsd = 0;
  let shortUsd = 0;
  for (const e of events) {
    const usd = notionalUsd(e);
    if (e.side === 'long') longUsd += usd;
    else shortUsd += usd;
  }
  return { longUsd, shortUsd, count: events.length, ts: Date.now() };
}

async function flush(symbol: string): Promise<void> {
  const s = state.get(symbol);
  if (!s) return;
  s.flushPending = null;
  s.lastFlushTs = Date.now();
  const snap = buildSnapshot(s.events);
  try {
    await setCached(LIQ_SNAPSHOT_KEY(symbol), snap, SNAPSHOT_TTL_S);
  } catch (err) {
    // Cache write failures are non-fatal — the in-memory window is the
    // source of truth, the Redis copy is just a courtesy for stateless routes.
    console.warn(
      `[liquidation-bridge] flush(${symbol}) failed:`,
      (err as Error).message,
    );
  }
}

/**
 * Record one Binance liquidation event. Called from `ws-manager.subscribeLiquidation`.
 */
export function recordLiquidation(liq: Liquidation): void {
  const symbol = liq.symbol;
  let s = state.get(symbol);
  if (!s) {
    s = { events: [], lastFlushTs: 0, flushPending: null };
    state.set(symbol, s);
  }
  s.events.push(liq);

  // Trim by both time window AND count.
  const cutoff = Date.now() - WINDOW_MS;
  if (s.events.length > MAX_EVENTS_PER_SYMBOL || s.events[0].timestamp < cutoff) {
    s.events = s.events.filter((e) => e.timestamp >= cutoff);
    if (s.events.length > MAX_EVENTS_PER_SYMBOL) {
      s.events = s.events.slice(-MAX_EVENTS_PER_SYMBOL);
    }
  }

  // Throttled flush. If a flush already happened recently, schedule one
  // for the remaining time.
  const sinceLast = Date.now() - s.lastFlushTs;
  if (sinceLast >= FLUSH_THROTTLE_MS && !s.flushPending) {
    void flush(symbol);
  } else if (!s.flushPending) {
    const wait = FLUSH_THROTTLE_MS - sinceLast;
    s.flushPending = setTimeout(() => {
      void flush(symbol);
    }, Math.max(wait, 100));
  }
}
