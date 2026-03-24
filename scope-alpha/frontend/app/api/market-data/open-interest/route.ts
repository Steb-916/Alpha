/**
 * GET /api/market-data/open-interest
 *
 * Returns current and historical open interest for a symbol.
 *
 * Query params:
 *   symbol - e.g. "BTCUSDT" or "BTC"
 *   period - e.g. "5m", "15m", "30m", "1h", "2h", "4h", "1d" (default "1h")
 *   limit  - number of historical entries (default 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryExchange } from '@/lib/exchanges';
import { toBinanceSymbol } from '@/lib/exchanges/utils';
import { getMarketDataCache } from '@/lib/market-data/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const rawSymbol = searchParams.get('symbol') || 'BTCUSDT';
    const period = searchParams.get('period') || '1h';
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 500);

    const symbol = toBinanceSymbol(rawSymbol);
    const cache = getMarketDataCache();
    const exchange = getPrimaryExchange();

    // Get current OI
    let current = cache.getOpenInterest(symbol);
    if (!current) {
      current = await exchange.getOpenInterest(symbol);
      cache.setOpenInterest(symbol, current);
    }

    // Get historical OI
    const history = await exchange.getOpenInterestHistory(symbol, period, limit);

    return NextResponse.json({
      symbol,
      current,
      history,
    });
  } catch (error) {
    console.error('[API /market-data/open-interest] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch open interest data', message: String(error) },
      { status: 500 }
    );
  }
}
