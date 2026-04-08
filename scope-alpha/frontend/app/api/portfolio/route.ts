/**
 * GET /api/portfolio
 *
 * Returns the current subscriber's tracked positions, optionally filtered
 * and paginated. Each position includes the serialized signal and the
 * analyst's basic profile.
 *
 * Query params:
 *   status      — 'active' | 'closed' | 'all' (default 'all')
 *   analystId   — filter to one analyst
 *   asset       — filter to one asset symbol
 *   sort        — 'takenAt' | 'closedAt' (default 'takenAt')
 *   order       — 'asc' | 'desc' (default 'desc')
 *   limit       — default 50, max 100
 *   cursor      — last id from previous page
 *
 * Note: NO unrealizedPnl is computed here. The client computes it from
 * live tickers in marketDataStore (per the Phase 5 plan).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { serializeSignal } from '@/lib/signals/serializer';
import {
  computePortfolioSummary,
  type PortfolioPosition,
} from '@/lib/portfolio/summary';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'all';
  const analystId = searchParams.get('analystId');
  const asset = searchParams.get('asset');
  const sort = (searchParams.get('sort') ?? 'takenAt') === 'closedAt' ? 'closedAt' : 'takenAt';
  const order = (searchParams.get('order') ?? 'desc') === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100);
  const cursor = searchParams.get('cursor');

  const where: Prisma.TrackedSignalWhereInput = {
    subscriberId: session.user.id,
  };
  if (status === 'active' || status === 'closed') {
    where.status = status;
  }
  if (analystId) where.analystId = analystId;
  if (asset) where.signal = { assetSymbol: asset };

  const orderBy: Prisma.TrackedSignalOrderByWithRelationInput =
    sort === 'closedAt' ? { closedAt: order } : { takenAt: order };

  const rows = await prisma.trackedSignal.findMany({
    where,
    include: {
      signal: { include: { targets: { orderBy: { order: 'asc' } } } },
      analyst: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  let trimmed = rows;
  if (rows.length > limit) {
    nextCursor = rows[limit - 1].id;
    trimmed = rows.slice(0, limit);
  }

  const positions = trimmed.map((row) => ({
    id: row.id,
    signalId: row.signalId,
    analystId: row.analystId,
    takenAt: row.takenAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    personalEntry: row.personalEntry != null ? Number(row.personalEntry) : null,
    personalStop: row.personalStop != null ? Number(row.personalStop) : null,
    positionSize: row.positionSize != null ? Number(row.positionSize) : null,
    closePrice: row.closePrice != null ? Number(row.closePrice) : null,
    personalPnl: row.personalPnl != null ? Number(row.personalPnl) : null,
    status: row.status,
    notes: row.notes,
    signal: serializeSignal(row.signal),
    analyst: {
      id: row.analyst.id,
      slug: row.analyst.slug ?? row.analyst.id,
      displayName: row.analyst.displayName || row.analyst.name || 'Unnamed',
      avatarInitial:
        ((row.analyst.displayName || row.analyst.name || row.analyst.email)[0] ?? '?').toUpperCase(),
    },
  }));

  // Compute summary over the filtered set (this matches the embedded
  // /summary route behavior; the dedicated route hits this same shape).
  const summaryInput: PortfolioPosition[] = positions.map((p) => ({
    id: p.id,
    signalId: p.signalId,
    analystId: p.analystId,
    status: p.status,
    takenAt: p.takenAt,
    closedAt: p.closedAt,
    personalPnl: p.personalPnl,
    signal: { assetSymbol: p.signal.assetSymbol, direction: p.signal.direction },
    analyst: {
      slug: p.analyst.slug,
      displayName: p.analyst.displayName,
      avatarInitial: p.analyst.avatarInitial,
    },
  }));
  const summary = computePortfolioSummary(summaryInput);

  return NextResponse.json({ positions, summary, nextCursor });
}
