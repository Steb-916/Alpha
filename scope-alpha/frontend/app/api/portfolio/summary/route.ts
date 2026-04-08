/**
 * GET /api/portfolio/summary
 *
 * Standalone summary endpoint for components that only need the aggregate
 * stats (e.g. the portfolio summary cards) without paginating positions.
 *
 * Always returns the summary computed over ALL of the subscriber's tracked
 * positions (no filtering).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  computePortfolioSummary,
  type PortfolioPosition,
} from '@/lib/portfolio/summary';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.trackedSignal.findMany({
    where: { subscriberId: session.user.id },
    select: {
      id: true,
      signalId: true,
      analystId: true,
      status: true,
      takenAt: true,
      closedAt: true,
      personalPnl: true,
      signal: { select: { assetSymbol: true, direction: true } },
      analyst: {
        select: {
          slug: true,
          displayName: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const positions: PortfolioPosition[] = rows.map((r) => ({
    id: r.id,
    signalId: r.signalId,
    analystId: r.analystId,
    status: r.status,
    takenAt: r.takenAt.toISOString(),
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    personalPnl: r.personalPnl != null ? Number(r.personalPnl) : null,
    signal: {
      assetSymbol: r.signal.assetSymbol,
      direction: r.signal.direction,
    },
    analyst: {
      slug: r.analyst.slug ?? r.analystId,
      displayName: r.analyst.displayName || r.analyst.name || 'Unnamed',
      avatarInitial:
        ((r.analyst.displayName || r.analyst.name || r.analyst.email)[0] ?? '?').toUpperCase(),
    },
  }));

  const summary = computePortfolioSummary(positions);
  return NextResponse.json(summary);
}
