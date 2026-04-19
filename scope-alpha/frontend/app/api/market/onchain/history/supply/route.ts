/**
 * GET /api/market/onchain/history/supply?asset=BTC&days=365
 *
 * Reads persisted OnChainSnapshot rows for historical MVRV series. On day
 * one, depth mirrors the provider's initial fetch depth; longer history
 * accrues as the refresh-onchain cron writes snapshots.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { OnChainAsset } from '@/types/onchain';

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

  const daysParam = Number(url.searchParams.get('days') ?? '365');
  const days = Math.min(Math.max(Number.isFinite(daysParam) ? daysParam : 365, 1), 1825);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.onChainSnapshot.findMany({
    where: { asset, timestamp: { gte: cutoff } },
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
      mvrv: true,
      mvrvZScore: true,
      mvrvRegime: true,
      marketCapUsd: true,
    },
  });

  return NextResponse.json({
    asset,
    days,
    series: rows.map((r) => ({
      timestamp: r.timestamp.toISOString(),
      mvrv: r.mvrv,
      mvrvZScore: r.mvrvZScore,
      mvrvRegime: r.mvrvRegime,
      marketCapUsd: r.marketCapUsd,
    })),
  });
}
