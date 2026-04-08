/**
 * GET /api/analysts/[slug]/performance/rolling
 *
 * Returns 7d / 30d / 90d / all-time rolling window metrics with deltas
 * vs the preceding period of equal length. Cached 5 min.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rollingWindowMetrics } from '@/lib/analytics/rolling';
import { withCacheAndStale } from '@/lib/cache/redis';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const analyst = await prisma.user.findUnique({
    where: { slug: params.slug },
    select: { id: true, role: true },
  });
  if (!analyst || analyst.role !== 'analyst') {
    return NextResponse.json({ error: 'Analyst not found' }, { status: 404 });
  }

  const data = await withCacheAndStale(
    `analytics:rolling:${params.slug}`,
    300,
    async () => {
      const signals = await prisma.signal.findMany({
        where: { analystId: analyst.id, status: 'resolved' },
        select: {
          resultPnlPercent: true,
          resolvedAt: true,
        },
      });
      const normalized = signals.map((s) => ({
        resultPnlPercent: s.resultPnlPercent != null ? Number(s.resultPnlPercent) : null,
        resolvedAt: s.resolvedAt,
      }));
      return rollingWindowMetrics(normalized);
    },
  );

  return NextResponse.json(data);
}
