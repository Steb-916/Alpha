/**
 * GET /api/market/cvd?asset=BTC&timeframe=1h&limit=200
 *
 * Returns a CVD series + detected divergences for a single asset. Data source
 * is Binance klines (takerBuyBaseAssetVolume per candle). Cache TTL 60s.
 */

import { NextResponse } from 'next/server';
import { resolveAsset } from '@/config/assets';
import { withCacheAndStale } from '@/lib/cache/redis';
import { BinanceConnector } from '@/lib/exchanges/binance';
import {
  computeCVD,
  detectDivergences,
  type CVDPoint,
  type Divergence,
} from '@/lib/analytics/cvd';
import { captureRouteError } from '@/lib/sentry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_SECONDS = 60;
const ALLOWED_TIMEFRAMES = new Set(['5m', '15m', '1h', '4h', '1d']);

interface CVDResponse {
  asset: string;
  timeframe: string;
  series: CVDPoint[];
  divergences: Divergence[];
}

const binance = new BinanceConnector();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const assetParam = url.searchParams.get('asset') || 'BTC';
    const timeframe = url.searchParams.get('timeframe') || '1h';
    const limit = Math.min(
      500,
      Math.max(50, Number(url.searchParams.get('limit') ?? 200)),
    );

    const cfg = resolveAsset(assetParam);
    if (!cfg) {
      return NextResponse.json(
        { error: `Unsupported asset: ${assetParam}` },
        { status: 400 },
      );
    }
    if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
      return NextResponse.json(
        { error: `Unsupported timeframe: ${timeframe}` },
        { status: 400 },
      );
    }

    const cacheKey = `market:cvd:${cfg.symbol}:${timeframe}:${limit}`;

    const data = await withCacheAndStale<CVDResponse>(
      cacheKey,
      TTL_SECONDS,
      async () => {
        const candles = await binance.getKlines(
          cfg.binance,
          timeframe,
          limit,
        );
        const series = computeCVD(candles);
        const divergences = detectDivergences(series);
        return {
          asset: cfg.symbol,
          timeframe,
          series,
          divergences,
        };
      },
    );

    return NextResponse.json(data);
  } catch (error) {
    captureRouteError(error, { route: '/api/market/cvd' });
    return NextResponse.json(
      { error: 'Failed to compute CVD' },
      { status: 500 },
    );
  }
}
