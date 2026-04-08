/**
 * GET /api/analysts/[slug]/performance/breakdown?groupBy=asset|timeframe|direction
 *
 * Returns per-group performance metrics. Cached in Upstash for 5 minutes.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { breakdownBy, type GroupBy } from '@/lib/analytics/breakdown';
import { withCacheAndStale } from '@/lib/cache/redis';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const analyst = await prisma.user.findUnique({
    where: { slug: params.slug },
    select: { id: true, role: true },
  });
  if (!analyst || analyst.role !== 'analyst') {
    return NextResponse.json({ error: 'Analyst not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rawGroupBy = searchParams.get('groupBy') ?? 'asset';
  const groupBy: GroupBy = ['asset', 'timeframe', 'direction'].includes(rawGroupBy)
    ? (rawGroupBy as GroupBy)
    : 'asset';

  const data = await withCacheAndStale(
    `analytics:breakdown:${params.slug}:${groupBy}`,
    300,
    async () => {
      const signals = await prisma.signal.findMany({
        where: { analystId: analyst.id, status: 'resolved' },
        select: {
          assetSymbol: true,
          direction: true,
          timeframe: true,
          resultPnlPercent: true,
          resolvedAt: true,
        },
      });
      const normalized = signals.map((s) => ({
        ...s,
        resultPnlPercent: s.resultPnlPercent != null ? Number(s.resultPnlPercent) : null,
      }));
      return { rows: breakdownBy(normalized, groupBy), groupBy };
    },
  );

  return NextResponse.json(data);
}
