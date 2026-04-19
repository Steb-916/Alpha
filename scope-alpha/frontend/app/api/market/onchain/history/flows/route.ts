/**
 * GET /api/market/onchain/history/flows?asset=BTC&days=180
 *
 * Reads persisted ExchangeFlowSnapshot rows. Returns at most `days` trailing
 * days (default 90, max 365). Ordered ascending by timestamp for chart
 * consumption.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { FlowObservation, OnChainAsset } from '@/types/onchain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(raw as OnChainAsset)) {
    return NextResponse.json(
      { error: 'On-chain data only available for BTC and ETH' },
      { status: 400 },
    );
  }
  const asset = raw as OnChainAsset;

  const daysParam = Number(url.searchParams.get('days') ?? '90');
  const days = Math.min(Math.max(Number.isFinite(daysParam) ? daysParam : 90, 1), 365);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.exchangeFlowSnapshot.findMany({
    where: { asset, timestamp: { gte: cutoff } },
    orderBy: { timestamp: 'asc' },
  });

  const series: FlowObservation[] = rows.map((r) => ({
    timestamp: r.timestamp.toISOString(),
    exchange: r.exchange,
    inflowUsd: r.inflowUsd,
    outflowUsd: r.outflowUsd,
    netFlowUsd: r.netFlowUsd,
  }));

  return NextResponse.json({ asset, days, series });
}
