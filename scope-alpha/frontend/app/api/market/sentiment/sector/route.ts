/**
 * GET /api/market/sentiment/sector
 *
 * Derives sector sentiment from existing funding rate data.
 * Groups assets into L1 / DeFi / Meme sectors and computes:
 *   - avg funding rate per sector
 *   - a normalized sentiment score (−1 … +1)
 *   - a bias label
 *
 * Cache TTL: 300s (same as funding data).
 */

import { NextResponse } from 'next/server';
import { withCacheAndStale } from '@/lib/cache/redis';
import { aggregateFunding } from '@/lib/market/aggregator';
import type { SectorSentimentResponse, SectorGroup, SentimentBias } from '@/types/sentiment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_KEY = 'sentiment:sector';
const TTL = 300;

const SECTORS: Array<{ name: string; symbols: string[] }> = [
  { name: 'L1', symbols: ['BTC', 'ETH', 'SOL', 'AVAX'] },
  { name: 'DeFi', symbols: ['LINK', 'ARB'] },
  { name: 'Meme', symbols: ['DOGE'] },
];

function fundingToBias(avgFunding: number): SentimentBias {
  if (avgFunding > 0.05) return 'bullish';
  if (avgFunding > 0.01) return 'slightly_bullish';
  if (avgFunding < -0.05) return 'bearish';
  if (avgFunding < -0.01) return 'slightly_bearish';
  return 'neutral';
}

function fundingToScore(avgFunding: number): number {
  // Clamp to ±0.1% range and normalize to −1…+1
  const clamped = Math.max(-0.1, Math.min(0.1, avgFunding));
  return Math.round((clamped / 0.1) * 100) / 100;
}

async function fetchSectorSentiment(): Promise<SectorSentimentResponse> {
  const groups: SectorGroup[] = [];

  for (const sector of SECTORS) {
    const results = await Promise.allSettled(
      sector.symbols.map((sym) => aggregateFunding(sym)),
    );

    const rates: Array<{ symbol: string; funding_rate: number }> = [];
    for (let i = 0; i < sector.symbols.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        rates.push({ symbol: sector.symbols[i], funding_rate: r.value.currentRate });
      }
    }

    const avgFunding =
      rates.length > 0
        ? rates.reduce((s, a) => s + a.funding_rate, 0) / rates.length
        : 0;

    groups.push({
      name: sector.name,
      assets: rates,
      avg_funding: avgFunding,
      score: fundingToScore(avgFunding),
      bias: fundingToBias(avgFunding),
    });
  }

  return { sectors: groups, computed_at: new Date().toISOString() };
}

export async function GET() {
  try {
    const data = await withCacheAndStale(CACHE_KEY, TTL, fetchSectorSentiment);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/market/sentiment/sector] failed:', err);
    return NextResponse.json(
      { error: 'Sector sentiment unavailable' },
      { status: 503 },
    );
  }
}
