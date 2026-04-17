/**
 * GET /api/market/liquidation-heatmap?asset=BTC
 *
 * Computes estimated liquidation levels using the Gaussian leverage model.
 * On-demand compute (not cron-driven); cache TTL 60s.
 */

import { NextResponse } from 'next/server';
import { resolveAsset } from '@/config/assets';
import { withCacheAndStale, getCached } from '@/lib/cache/redis';
import {
  computeLiquidationHeatmap,
  computeRealized7dVol,
  type HeatmapResult,
} from '@/lib/analytics/liquidation-heatmap';
import { BinanceConnector } from '@/lib/exchanges/binance';
import { aggregateOI } from '@/lib/market/aggregator';
import { prisma } from '@/lib/prisma';
import type { OpenInterestData } from '@/lib/types';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 60;

const binance = new BinanceConnector();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetParam = url.searchParams.get('asset') || 'BTC';

    const cfg = resolveAsset(assetParam);
    if (!cfg) {
      return NextResponse.json(
        { error: `Unsupported asset: ${assetParam}` },
        { status: 400 },
      );
    }

    const cacheKey = `market:liq-heatmap:${cfg.symbol}`;

    const data = await withCacheAndStale<HeatmapResult>(
      cacheKey,
      TTL_SECONDS,
      async () => {
        const [tickers, oiData, lsr, dailyRows] = await Promise.all([
          binance.get24hrTicker(cfg.binance).catch(() => []),
          getCached<OpenInterestData>(`market:oi:${cfg.symbol}`).then((c) =>
            c ?? aggregateOI(cfg.symbol).catch(() => null),
          ),
          binance.getLongShortRatio(cfg.binance, '1h'),
          prisma.candleHistory
            .findMany({
              where: {
                asset: cfg.symbol,
                exchange: 'binance',
                timeframe: '1d',
              },
              orderBy: { timestamp: 'desc' },
              take: 8,
            })
            .catch(() => []),
        ]);

        const ticker = tickers.find((t) => t.symbol === cfg.binance);
        const currentPrice = ticker?.lastPrice ?? 0;
        if (currentPrice <= 0) {
          throw new Error(
            `liquidation-heatmap(${cfg.symbol}): no current price`,
          );
        }

        const totalOI = oiData?.aggregateOI ?? 0;
        const longShortRatio = lsr?.longShortRatio ?? 1;

        const dailyCloses = dailyRows
          .map((r) => r.close)
          .reverse(); // ascending
        const realizedVol = computeRealized7dVol(dailyCloses);

        return computeLiquidationHeatmap({
          asset: cfg.symbol,
          currentPrice,
          totalOI,
          longShortRatio,
          realizedVol,
        });
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    captureRouteError(error, { route: '/api/market/liquidation-heatmap' });
    return NextResponse.json(
      { error: 'Failed to compute liquidation heatmap' },
      { status: 500 },
    );
  }
}
