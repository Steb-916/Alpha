/**
 * GET /api/market/options/flow?asset=BTC
 *
 * Options flow anomaly scanner. Computed on demand from the current chain
 * snapshot + the previous snapshot (cached at options:chain:previous:{asset}
 * by the fetcher). No Quant Engine dependency.
 *
 * Caches the computed output briefly so repeat visitors within the TTL
 * get instant responses without re-running the anomaly pass.
 */

import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache/redis';
import { warmChainCache } from '@/lib/options/fetcher';
import { detectFlowAnomalies } from '@/lib/options/flow-scanner';
import type {
  DeribitCurrency,
  OptionsChainEntry,
} from '@/lib/exchanges/deribit-types';
import type { FlowOutput } from '@/types/options';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<DeribitCurrency>(['BTC', 'ETH']);
const FLOW_CACHE_TTL = 30 * 60; // 30 minutes — shorter than chain to keep fresh

function rehydrate(chain: OptionsChainEntry[]): OptionsChainEntry[] {
  return chain.map((c) => ({
    ...c,
    expirationDate:
      c.expirationDate instanceof Date
        ? c.expirationDate
        : new Date(c.expirationDate as unknown as string),
  }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asset = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(asset as DeribitCurrency)) {
    return NextResponse.json(
      { error: 'Options flow only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const currency = asset as DeribitCurrency;
  const cacheKey = `options:flow:${currency}`;

  const fresh = await getCached<FlowOutput>(cacheKey);
  if (fresh) return NextResponse.json(fresh);

  // Load current chain; warm if cold.
  let currentChain =
    (await getCached<OptionsChainEntry[]>(`options:chain:${currency}`)) ??
    null;
  if (!currentChain || currentChain.length === 0) {
    const warmed = await warmChainCache(currency);
    currentChain = warmed.chain.length > 0 ? warmed.chain : null;
    if (!currentChain) {
      currentChain =
        (await getCached<OptionsChainEntry[]>(
          `options:chain:${currency}`,
        )) ?? null;
    }
  }
  if (!currentChain || currentChain.length === 0) {
    return NextResponse.json(
      { error: 'Options chain temporarily unavailable', asset: currency },
      { status: 503 },
    );
  }

  const previousChain = await getCached<OptionsChainEntry[]>(
    `options:chain:previous:${currency}`,
  );

  const result = detectFlowAnomalies(
    currency,
    rehydrate(currentChain),
    previousChain ? rehydrate(previousChain) : null,
  );
  if (!result) {
    return NextResponse.json(
      { error: 'Flow anomaly detection returned no result' },
      { status: 503 },
    );
  }

  await setCached(cacheKey, result, FLOW_CACHE_TTL);
  return NextResponse.json(result);
}
