/**
 * GET /api/market/liquidations?asset=BTC&period=24h
 *
 * Aggregated liquidation data for a single asset over a rolling window.
 * Reads from:
 *   - `LiquidationEvent` table (PostgreSQL) — durable historical events, used
 *     for per-exchange totals and the recent-events list.
 *   - `market:liq-snapshot:{binanceSymbol}` Redis key — populated in real time
 *     by liquidation-bridge from WS streams, used as a corroborating source.
 *
 * Cache TTL: 30s on `market:liquidations:{asset}:{period}`.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveAsset } from '@/config/assets';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { LIQ_SNAPSHOT_KEY, type LiqSnapshot } from '@/lib/market/health';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_TTL = 30;

interface ExchangeLiqAgg {
  long: number;
  short: number;
}

interface LiquidationResponse {
  asset: string;
  period: string;
  longLiquidationVolume: number;
  shortLiquidationVolume: number;
  totalLiquidationVolume: number;
  longShortRatio: number;
  byExchange: Record<string, ExchangeLiqAgg>;
  recentEvents: Array<{
    timestamp: string;
    exchange: string;
    side: string;
    price: number;
    usdValue: number;
  }>;
  _cachedAt?: number;
  _stale?: boolean;
}

function periodToMs(period: string): number {
  switch (period) {
    case '1h':
      return 60 * 60 * 1000;
    case '4h':
      return 4 * 60 * 60 * 1000;
    case '12h':
      return 12 * 60 * 60 * 1000;
    case '24h':
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetParam = url.searchParams.get('asset') || 'BTC';
    const period = url.searchParams.get('period') || '24h';

    const cfg = resolveAsset(assetParam);
    if (!cfg) {
      return NextResponse.json(
        { error: `Unsupported asset: ${assetParam}` },
        { status: 400 },
      );
    }

    const cacheKey = `market:liquidations:${cfg.symbol}:${period}`;

    const fresh = await getCached<LiquidationResponse>(cacheKey);
    if (fresh) {
      return NextResponse.json(fresh);
    }

    const since = new Date(Date.now() - periodToMs(period));

    const [grouped, recent, liqSnap] = await Promise.all([
      prisma.liquidationEvent.groupBy({
        by: ['exchange', 'side'],
        where: { asset: cfg.symbol, timestamp: { gte: since } },
        _sum: { usdValue: true },
      }),
      prisma.liquidationEvent.findMany({
        where: { asset: cfg.symbol, timestamp: { gte: since } },
        orderBy: { timestamp: 'desc' },
        take: 50,
      }),
      getCached<LiqSnapshot>(LIQ_SNAPSHOT_KEY(cfg.binance)),
    ]);

    const byExchange: Record<string, ExchangeLiqAgg> = {};
    let longTotal = 0;
    let shortTotal = 0;
    for (const row of grouped) {
      const slot = byExchange[row.exchange] ?? { long: 0, short: 0 };
      const value = row._sum.usdValue ?? 0;
      if (row.side === 'long') {
        slot.long += value;
        longTotal += value;
      } else if (row.side === 'short') {
        slot.short += value;
        shortTotal += value;
      }
      byExchange[row.exchange] = slot;
    }

    // Corroborate with the WS-fed Redis snapshot if the DB hasn't caught up
    // (e.g., fresh deploys before the first persistence batch).
    if (
      grouped.length === 0 &&
      liqSnap &&
      (liqSnap.longUsd > 0 || liqSnap.shortUsd > 0)
    ) {
      longTotal = liqSnap.longUsd;
      shortTotal = liqSnap.shortUsd;
      byExchange.binance = {
        long: liqSnap.longUsd,
        short: liqSnap.shortUsd,
      };
    }

    const totalLiquidationVolume = longTotal + shortTotal;
    const longShortRatio =
      shortTotal > 0 ? longTotal / shortTotal : longTotal > 0 ? Infinity : 0;

    const response: LiquidationResponse = {
      asset: cfg.symbol,
      period,
      longLiquidationVolume: longTotal,
      shortLiquidationVolume: shortTotal,
      totalLiquidationVolume,
      longShortRatio: Number.isFinite(longShortRatio) ? longShortRatio : 0,
      byExchange,
      recentEvents: recent.map((e) => ({
        timestamp: e.timestamp.toISOString(),
        exchange: e.exchange,
        side: e.side,
        price: e.price,
        usdValue: e.usdValue,
      })),
      _cachedAt: Date.now(),
    };

    await setCached(cacheKey, response, CACHE_TTL);

    return NextResponse.json(response);
  } catch (error) {
    captureRouteError(error, { route: '/api/market/liquidations' });
    // Fall back to stale cache if available.
    const url = new URL(request.url);
    const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
    const period = url.searchParams.get('period') || '24h';
    const stale = await getStale<LiquidationResponse>(
      `market:liquidations:${asset}:${period}`,
    );
    if (stale) {
      return NextResponse.json({ ...stale, _stale: true });
    }
    return NextResponse.json(
      { error: 'Failed to load liquidations' },
      { status: 500 },
    );
  }
}
