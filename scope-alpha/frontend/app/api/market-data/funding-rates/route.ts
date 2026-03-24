/**
 * GET /api/market-data/funding-rates
 *
 * Returns current and historical funding rates for a symbol.
 *
 * Query params:
 *   symbol - e.g. "BTCUSDT" or "BTC"
 *   limit  - number of historical entries (default 100)
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    const symbol = toBinanceSymbol(rawSymbol);
    const cache = getMarketDataCache();
    const exchange = getPrimaryExchange();

    // Get current funding rate
    let current = cache.getFundingRate(symbol);
    if (!current) {
      current = await exchange.getFundingRate(symbol);
      cache.setFundingRate(symbol, current);
    }

    // Get historical funding rates
    const history = await exchange.getFundingRateHistory(symbol, limit);

    return NextResponse.json({
      symbol,
      current,
      history,
    });
  } catch (error) {
    console.error('[API /market-data/funding-rates] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch funding rate data', message: String(error) },
      { status: 500 }
    );
  }
}
