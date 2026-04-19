/**
 * GET /api/market/regime/history?asset=BTC&days=90
 *
 * Returns the 90-day regime timeline for the heatmap. Reads persisted
 * RegimeSnapshot rows. Day-one is sparse (only back to the first cron run);
 * depth accumulates as the hourly cron runs.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { OnChainAsset } from '@/types/onchain';
import type {
  RegimeHistoryPoint,
  RegimeHistoryResponse,
  RegimeLabel,
} from '@/types/regime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set<OnChainAsset>(['BTC', 'ETH']);
const DEFAULT_DAYS = 90;
const MAX_DAYS = 180;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get('asset') || 'BTC').toUpperCase();
  if (!ALLOWED.has(raw as OnChainAsset)) {
    return NextResponse.json(
      { error: 'Regime history available only for BTC and ETH' },
      { status: 400 },
    );
  }
  const asset = raw as OnChainAsset;

  const daysParam = Number(url.searchParams.get('days') ?? DEFAULT_DAYS);
  const days = Math.min(
    Math.max(Number.isFinite(daysParam) ? daysParam : DEFAULT_DAYS, 1),
    MAX_DAYS,
  );
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.regimeSnapshot.findMany({
    where: { asset, timestamp: { gte: cutoff } },
    orderBy: { timestamp: 'asc' },
    select: {
      timestamp: true,
      rawClassification: true,
      committedRegime: true,
      confidence: true,
      regimeChanged: true,
    },
  });

  const points: RegimeHistoryPoint[] = rows.map((r) => ({
    timestamp: r.timestamp.toISOString(),
    committed_regime: r.committedRegime as RegimeLabel,
    raw_classification: r.rawClassification as RegimeLabel,
    confidence: r.confidence,
    regime_changed: r.regimeChanged,
  }));

  const payload: RegimeHistoryResponse = { asset, days, points };
  return NextResponse.json(payload);
}
