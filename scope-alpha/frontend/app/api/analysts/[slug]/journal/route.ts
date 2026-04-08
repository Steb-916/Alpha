/**
 * GET /api/analysts/[slug]/journal
 *
 * Trade journal — paginated, filterable list of an analyst's signals.
 *
 * Query params:
 *   asset, direction, timeframe — exact-match filters
 *   from, to                     — ISO date range on publishedAt
 *   result                       — 'win' | 'loss' | 'breakeven' | 'active' | 'all'
 *   sort                         — 'publishedAt' (default) | 'resultPnlPercent'
 *   order                        — 'asc' | 'desc' (default desc)
 *   limit                        — default 20, max 100
 *   cursor                       — last id from previous page
 *
 * Access:
 *   - The owning analyst always sees their own data.
 *   - Other users must have an active subscription per `checkSubscriptionAccess`.
 *   - Non-subscribers get 403 with code SUBSCRIPTION_REQUIRED.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { checkSubscriptionAccess } from '@/lib/subscriptions';
import { serializeSignal, type SerializedSignal } from '@/lib/signals/serializer';
import { avgPnl, isLoss, isWin, totalPnl } from '@/lib/analytics/metrics';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  const analyst = await prisma.user.findUnique({
    where: { slug: params.slug },
    select: { id: true, role: true },
  });
  if (!analyst || analyst.role !== 'analyst') {
    return NextResponse.json({ error: 'Analyst not found' }, { status: 404 });
  }

  // Access check.
  if (viewerId !== analyst.id) {
    if (!viewerId) {
      return NextResponse.json(
        { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
        { status: 403 },
      );
    }
    const access = await checkSubscriptionAccess(viewerId, analyst.id);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
        { status: 403 },
      );
    }
  }

  // Parse query.
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get('asset');
  const direction = searchParams.get('direction');
  const timeframe = searchParams.get('timeframe');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const result = searchParams.get('result') ?? 'all';
  const sort = searchParams.get('sort') ?? 'publishedAt';
  const order = (searchParams.get('order') ?? 'desc') === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
  const cursor = searchParams.get('cursor');

  const where: Prisma.SignalWhereInput = {
    analystId: analyst.id,
    status: { not: 'draft' },
  };
  if (asset) where.assetSymbol = asset;
  if (direction) where.direction = direction;
  if (timeframe) where.timeframe = timeframe;
  if (from || to) {
    where.publishedAt = {};
    if (from) (where.publishedAt as Record<string, Date>).gte = new Date(from);
    if (to) (where.publishedAt as Record<string, Date>).lte = new Date(to);
  }

  // Result filter applied client-side after fetching since it depends on
  // resultPnlPercent sign + status combination.
  const orderBy: Prisma.SignalOrderByWithRelationInput =
    sort === 'resultPnlPercent'
      ? { resultPnlPercent: order }
      : { publishedAt: order };

  const rows = await prisma.signal.findMany({
    where,
    include: { targets: { orderBy: { order: 'asc' } } },
    orderBy,
    take: limit + 1, // +1 to peek for nextCursor
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let entries = rows.map(serializeSignal);

  // Result filter
  if (result !== 'all') {
    entries = entries.filter((s) => {
      const r = mapResult(s);
      return r === result;
    });
  }

  // Pagination
  let nextCursor: string | null = null;
  if (entries.length > limit) {
    nextCursor = entries[limit - 1].id;
    entries = entries.slice(0, limit);
  }

  // Summary over the filtered set.
  const wins = entries.filter((s) =>
    isWin({ resultPnlPercent: s.resultPnlPercent }),
  ).length;
  const losses = entries.filter((s) =>
    isLoss({ resultPnlPercent: s.resultPnlPercent }),
  ).length;
  const summary = {
    totalShown: entries.length,
    wins,
    losses,
    avgPnl: avgPnl(entries.map((e) => ({ resultPnlPercent: e.resultPnlPercent }))),
    totalPnl: totalPnl(entries.map((e) => ({ resultPnlPercent: e.resultPnlPercent }))),
  };

  return NextResponse.json({ entries, summary, nextCursor });
}

function mapResult(
  s: SerializedSignal,
): 'win' | 'loss' | 'breakeven' | 'active' {
  if (s.resultPnlPercent == null) return 'active';
  if (s.resultPnlPercent > 0) return 'win';
  if (s.resultPnlPercent < 0) return 'loss';
  return 'breakeven';
}
