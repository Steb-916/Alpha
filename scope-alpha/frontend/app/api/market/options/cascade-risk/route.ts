/**
 * GET /api/market/options/cascade-risk?asset=BTC
 *
 * Combines GEX zones with liquidation cluster estimates to identify
 * "Cascade Risk Zones" where negative gamma overlaps with high
 * liquidation density.
 *
 * Cascade risk logic:
 *   1. Fetch GEX by strike from Redis cache.
 *   2. Compute a liquidation heatmap using cached OI and market data.
 *   3. For each GEX strike, find the nearest heatmap level.
 *   4. Flag levels where |netGex| is in the top 20% AND intensity > 0.5.
 *
 * Cache TTL: 60 seconds (matches liquidation heatmap frequency).
 */

import { NextResponse } from 'next/server';
import { getCached, getStale, setCached } from '@/lib/cache/redis';
import { prisma } from '@/lib/prisma';
import { BinanceClient } from '@/lib/exchanges/binance';
import {
  computeLiquidationHeatmap,
  computeRealized7dVol,
} from '@/lib/analytics/liquidation-heatmap';
import type { GexByStrike, CascadeRiskOverlay, CascadeRiskZone } from '@/types/options';

const binance = new BinanceClient();

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['BTC', 'ETH']);
const CACHE_TTL = 60;
const TOP_GEX_PERCENTILE = 0.8; // flag top 20% absolute GEX

function riskLabel(
  netGex: number,
  intensity: number,
): CascadeRiskZone['cascadeRisk'] {
  const isNegativeGamma = netGex < 0;
  const isHighLiq = intensity > 0.6;
  if (isNegativeGamma && isHighLiq && intensity > 0.8) return 'critical';
  if (isNegativeGamma && isHighLiq) return 'elevated';
  if (isNegativeGamma || intensity > 0.5) return 'moderate';
  return 'low';
}

function overallRiskFromZones(
  zones: CascadeRiskZone[],
): CascadeRiskOverlay['overallRisk'] {
  if (zones.some((z) => z.cascadeRisk === 'critical')) return 'critical';
  if (zones.some((z) => z.cascadeRisk === 'elevated')) return 'elevated';
  if (zones.some((z) => z.cascadeRisk === 'moderate')) return 'moderate';
  return 'low';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset)) {
    return NextResponse.json(
      { error: 'Options data only available for BTC and ETH' },
      { status: 400 },
    );
  }

  const cacheKey = `options:cascade-risk:${asset}`;
  const cached = await getCached<CascadeRiskOverlay>(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Fetch GEX from cache
  const gex =
    (await getCached<GexByStrike>(`options:gex:${asset}`)) ||
    (await getStale<GexByStrike>(`options:gex:${asset}`));

  if (!gex) {
    return NextResponse.json(
      {
        error: 'GEX data not yet computed — trigger the refresh-options cron',
        quantEngineConfigured: true,
      },
      { status: 503 },
    );
  }

  // Fetch OI + candles for liquidation heatmap inputs
  const binanceSymbol = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
  const [oiRows, candleRows, lsr] = await Promise.all([
    prisma.oISnapshot
      .findFirst({
        where: { asset, exchange: 'binance' },
        orderBy: { timestamp: 'desc' },
      })
      .catch(() => null),
    prisma.candleHistory
      .findMany({
        where: { asset, exchange: 'binance', timeframe: '1d' },
        orderBy: { timestamp: 'desc' },
        take: 10,
      })
      .catch(() => []),
    binance.getLongShortRatio(binanceSymbol, '1h').catch(() => null),
  ]);

  const totalOI = oiRows?.oiUsd ?? gex.spot * 1_000_000;
  const longShortRatio = lsr?.longShortRatio ?? 1;
  const dailyCloses = candleRows.map((c) => c.close).reverse();
  const realizedVol = computeRealized7dVol(dailyCloses);

  const heatmap = computeLiquidationHeatmap({
    asset,
    currentPrice: gex.spot,
    totalOI,
    longShortRatio,
    realizedVol,
  });

  // Build a price → intensity lookup from the liquidation heatmap
  const liqByPrice = new Map<number, { intensity: number; side: 'long' | 'short' }>(
    heatmap.levels.map((l) => [l.price, { intensity: l.intensity, side: l.side }]),
  );
  const sortedLiqPrices = heatmap.levels.map((l) => l.price).sort((a, b) => a - b);

  function nearestLiqLevel(price: number) {
    let best = sortedLiqPrices[0];
    let bestDist = Math.abs(price - best);
    for (const p of sortedLiqPrices) {
      const d = Math.abs(price - p);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return liqByPrice.get(best) ?? { intensity: 0, side: 'long' as const };
  }

  // Determine GEX threshold for top-20% absolute values
  const absGexValues = gex.strikes.map((s) => Math.abs(s.netGex)).sort((a, b) => a - b);
  const gexThreshold = absGexValues[Math.floor(absGexValues.length * TOP_GEX_PERCENTILE)] ?? 0;

  const zones: CascadeRiskZone[] = gex.strikes
    .filter((s) => Math.abs(s.netGex) >= gexThreshold && s.netGex < 0)
    .map((s) => {
      const liq = nearestLiqLevel(s.strike);
      return {
        priceLevel: s.strike,
        gexContribution: s.netGex,
        liqIntensity: liq.intensity,
        cascadeRisk: riskLabel(s.netGex, liq.intensity),
        side: liq.side,
      };
    })
    .sort((a, b) => b.liqIntensity - a.liqIntensity);

  const overallRisk = overallRiskFromZones(zones);

  const narrativeMap: Record<CascadeRiskOverlay['overallRisk'], string> = {
    critical:
      'Dealers appear net short gamma near dense liquidation clusters. If price enters these zones, amplified moves and cascading liquidations may occur.',
    elevated:
      'Negative gamma overlaps with significant liquidation density. Market structure may amplify moves in these areas.',
    moderate:
      'Some overlap between negative gamma zones and liquidation clusters. Monitor for increased volatility near flagged levels.',
    low:
      'No significant overlap between negative gamma and liquidation clusters detected at this time.',
  };

  const result: CascadeRiskOverlay = {
    asset,
    timestamp: new Date().toISOString(),
    spot: gex.spot,
    gammaFlip: gex.gammaFlip,
    zones,
    overallRisk,
    narrative: narrativeMap[overallRisk],
  };

  await setCached(cacheKey, result, CACHE_TTL);
  return NextResponse.json(result);
}
