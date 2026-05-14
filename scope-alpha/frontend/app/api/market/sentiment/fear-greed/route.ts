/**
 * GET /api/market/sentiment/fear-greed
 *
 * Fetches the Crypto Fear & Greed Index from Alternative.me (free, no key).
 * Returns current value + 30-day history.
 *
 * Cache TTL: 3600s — the index updates once per day.
 */

import { NextResponse } from 'next/server';
import { withCacheAndStale } from '@/lib/cache/redis';
import type { FearGreedResponse, FearGreedClassification } from '@/types/sentiment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_KEY = 'sentiment:fear-greed';
const TTL = 3600;
const API_URL = 'https://api.alternative.me/fng/?limit=30&format=json';

interface AlternativeMePoint {
  value: string;
  value_classification: string;
  timestamp: string;
}

interface AlternativeMeResponse {
  data: AlternativeMePoint[];
}

function normalizeClassification(raw: string): FearGreedClassification {
  const map: Record<string, FearGreedClassification> = {
    'Extreme Fear': 'Extreme Fear',
    'Fear': 'Fear',
    'Neutral': 'Neutral',
    'Greed': 'Greed',
    'Extreme Greed': 'Extreme Greed',
  };
  return map[raw] ?? 'Neutral';
}

async function fetchFearGreed(): Promise<FearGreedResponse> {
  const res = await fetch(API_URL, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Alternative.me responded ${res.status}`);

  const json = (await res.json()) as AlternativeMeResponse;
  const points = (json.data ?? []).map((p) => ({
    value: parseInt(p.value, 10),
    classification: normalizeClassification(p.value_classification),
    timestamp: new Date(parseInt(p.timestamp, 10) * 1000).toISOString(),
  }));

  if (points.length === 0) throw new Error('Alternative.me returned empty data');

  return {
    current: points[0],
    history: points,
    computed_at: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const data = await withCacheAndStale(CACHE_KEY, TTL, fetchFearGreed);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/market/sentiment/fear-greed] failed:', err);
    return NextResponse.json(
      { error: 'Fear & Greed data unavailable' },
      { status: 503 },
    );
  }
}
