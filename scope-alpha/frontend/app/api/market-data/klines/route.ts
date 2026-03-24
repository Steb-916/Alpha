/**
 * GET /api/market-data/klines
 *
 * Returns historical OHLCV candlestick data.
 * Serves from cache if available, falls back to Binance REST API.
 *
 * Query params:
 *   symbol   - e.g. "BTCUSDT" or "BTC"
 *   interval - e.g. "1m", "5m", "1h", "4h", "1d"
 *   limit    - number of candles (default 500, max 1500)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryExchange } from '@/lib/exchanges';
import { toBinanceSymbol, toBinanceInterval } from '@/lib/exchanges/utils';
import { getMarketDataCache } from '@/lib/market-data/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawSymbol = searchParams.get('symbol') || 'BTCUSDT';
    const rawInterval = searchParams.get('interval') || '1h';
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1500);

    const symbol = toBinanceSymbol(rawSymbol);
    const interval = toBinanceInterval(rawInterval);
    const cache = getMarketDataCache();

    // Check cache first
    let klines = cache.getKlines(symbol, interval);
    if (klines.length >= limit) {
      return NextResponse.json({
        symbol,
        interval,
        data: klines.slice(-limit),
      });
    }

    // Cache miss or insufficient data — fetch from exchange
    const exchange = getPrimaryExchange();
    klines = await exchange.getKlines(symbol, interval, limit);

    // Populate cache
    cache.setKlines(symbol, interval, klines);

    return NextResponse.json({
      symbol,
      interval,
      data: klines,
    });
  } catch (error) {
    console.error('[API /market-data/klines] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch kline data', message: String(error) },
      { status: 500 }
    );
  }
}
