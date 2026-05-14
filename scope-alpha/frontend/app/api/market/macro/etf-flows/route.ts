/**
 * GET /api/market/macro/etf-flows
 *
 * Bitcoin spot ETF flow data via SoSoValue public API.
 * Falls back gracefully when the external API is unavailable.
 *
 * Cache TTL: 14400s (4h) — ETF flows are reported once daily.
 */

import { NextResponse } from 'next/server';
import { withCacheAndStale } from '@/lib/cache/redis';
import type { ETFFlowResponse, ETFFlowPoint, ETFSummary } from '@/types/macro';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CACHE_KEY = 'macro:etf-flows';
const TTL = 14400;

// SoSoValue Bitcoin ETF aggregate flow endpoint (public, no auth required)
const SOSOVALUE_URL =
  'https://sosovalue.com/api/etf/us-btc-spot/chart?range=3m';

interface SoSoValueDataPoint {
  date: string;
  totalNetInflow: number;
  cumulativeInflow: number;
}

interface SoSoValueResponse {
  data?: SoSoValueDataPoint[];
  list?: SoSoValueDataPoint[];
}

const ETF_METADATA: ETFSummary[] = [
  { ticker: 'IBIT', name: 'iShares Bitcoin Trust', total_aum_usd: null, latest_flow_usd: null },
  { ticker: 'FBTC', name: 'Fidelity Wise Origin Bitcoin Fund', total_aum_usd: null, latest_flow_usd: null },
  { ticker: 'ARKB', name: 'ARK 21Shares Bitcoin ETF', total_aum_usd: null, latest_flow_usd: null },
  { ticker: 'BITB', name: 'Bitwise Bitcoin ETF', total_aum_usd: null, latest_flow_usd: null },
];

async function fetchETFFlows(): Promise<ETFFlowResponse> {
  const res = await fetch(SOSOVALUE_URL, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'ScopeAlpha/1.0' },
  });

  if (!res.ok) throw new Error(`SoSoValue responded ${res.status}`);

  const json = (await res.json()) as SoSoValueResponse;
  const raw = json.data ?? json.list ?? [];

  const flows: ETFFlowPoint[] = raw.map((p) => ({
    date: p.date,
    inflow: Math.max(0, p.totalNetInflow),
    outflow: Math.abs(Math.min(0, p.totalNetInflow)),
    net: p.totalNetInflow,
    cumulative: p.cumulativeInflow,
  }));

  return {
    flows,
    etfs: ETF_METADATA,
    computed_at: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const data = await withCacheAndStale(CACHE_KEY, TTL, fetchETFFlows);
    return NextResponse.json(data);
  } catch (err) {
    console.warn('[/api/market/macro/etf-flows] external API unavailable:', err);
    return NextResponse.json(
      {
        flows: [],
        etfs: ETF_METADATA,
        computed_at: new Date().toISOString(),
        unavailable: true,
      } satisfies ETFFlowResponse,
    );
  }
}
