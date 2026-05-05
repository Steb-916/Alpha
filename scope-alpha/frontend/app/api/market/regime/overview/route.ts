/**
 * GET /api/market/regime/overview
 *
 * Multi-asset regime overview — v2 Phase 6.
 * Returns regime labels for all tracked assets.
 * BTC & ETH: reads from full regime cache (computed by /macro/regime).
 * Other assets: simplified classification from funding rate + 24h price direction.
 */

import { NextResponse } from 'next/server';
import { getCached, setCached, setStale, getStale } from '@/lib/cache/redis';
import { fetchCoinGeckoClose } from '@/lib/macro/fetchers';
import type { FundingData } from '@/lib/types';
import type { MacroRegimeResult, MacroRegimeLabel, RegimeOverview, RegimeOverviewItem } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL = 900;

const ALL_ASSETS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'ARB'];
const FULL_REGIME_ASSETS = new Set(['BTC', 'ETH']);

// Simplified regime for assets without full multi-domain data.
// Uses funding rate z-score + 24h price change direction.
function simplifiedRegime(
  priceChange24h: number | null,
  funding: FundingData | null,
): { regime: MacroRegimeLabel; score: number; confidence: number } {
  const z = funding?.zScore ?? 0;
  const pct = priceChange24h ?? 0;

  let score = 50;
  if (pct > 5 && z < 1.5) score = 72;
  else if (pct > 2) score = 64;
  else if (pct < -5 && z > 1.5) score = 26;
  else if (pct < -2) score = 36;
  else if (z > 2) score = 34;
  else if (z < -1) score = 66;

  const regime: MacroRegimeLabel =
    score >= 64 ? 'Risk-On' :
    score <= 36 ? 'Risk-Off' :
    z < -0.5    ? 'Accumulation' : 'Distribution';

  return { regime, score, confidence: Math.min(80, Math.abs(score - 50) * 2) };
}

async function get24hChange(asset: string): Promise<number | null> {
  try {
    const pts = await fetchCoinGeckoClose(asset as 'BTC' | 'ETH', 3);
    if (pts.length < 2) return null;
    const prev = pts[pts.length - 2].close;
    const curr = pts[pts.length - 1].close;
    return prev > 0 ? ((curr - prev) / prev) * 100 : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const key = 'macro:regime:overview';
  const fresh = await getCached<RegimeOverview>(key);
  if (fresh) return NextResponse.json(fresh);

  try {
    const items = await Promise.all(
      ALL_ASSETS.map(async (asset): Promise<RegimeOverviewItem> => {
        if (FULL_REGIME_ASSETS.has(asset)) {
          // Use cached full regime result
          const cached = await getCached<MacroRegimeResult>(`macro:regime:${asset}`);
          const priceChange24h = await get24hChange(asset);
          if (cached) {
            return {
              asset,
              regime: cached.regime,
              confidence: cached.confidence,
              score: cached.score,
              priceChange24h,
            };
          }
          // Fall through to simplified if cache miss
        }

        // Simplified regime for other assets
        const [funding, priceChange24h] = await Promise.all([
          getCached<FundingData>(`market:funding:${asset}`),
          get24hChange(asset),
        ]);
        const { regime, score, confidence } = simplifiedRegime(priceChange24h, funding);
        return { asset, regime, score, confidence, priceChange24h };
      }),
    );

    const result: RegimeOverview = { items, computedAt: new Date().toISOString() };
    await Promise.all([setCached(key, result, TTL), setStale(key, result)]);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[regime/overview] failed:', err);
    const stale = await getStale<RegimeOverview>(key);
    if (stale) return NextResponse.json({ ...stale, _stale: true });
    return NextResponse.json({ error: 'Regime overview unavailable' }, { status: 503 });
  }
}
