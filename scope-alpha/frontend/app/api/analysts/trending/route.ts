/**
 * GET /api/analysts/trending?period=7d|30d&limit=5
 *
 * Returns analysts with the most new subscriptions in the given period.
 * Cached for 30 minutes via withCacheAndStale.
 *
 * Silently returns an empty array when no recent subscriptions exist
 * (typical fresh demo state).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCacheAndStale } from '@/lib/cache/redis';

export const runtime = 'nodejs';

interface TrendingAnalyst {
  slug: string;
  displayName: string;
  avatarInitial: string;
  newSubscribers: number;
  totalSubscribers: number;
  winRate: number;
  totalPnl: number;
  lowestTierPrice: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = (searchParams.get('period') ?? '7d') === '30d' ? '30d' : '7d';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10) || 5, 20);

  const data = await withCacheAndStale(
    `analytics:trending:${period}:${limit}`,
    1800, // 30 minutes
    async () => {
      const days = period === '7d' ? 7 : 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Group new subscriptions by analyst.
      const groups = await prisma.subscription.groupBy({
        by: ['analystId'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { analystId: 'desc' } },
        take: limit,
      });

      if (groups.length === 0) {
        return { analysts: [] as TrendingAnalyst[] };
      }

      const analystIds = groups.map((g) => g.analystId);
      const users = await prisma.user.findMany({
        where: { id: { in: analystIds }, role: 'analyst' },
        include: {
          analystPerformance: true,
          subscriptionTiers: {
            where: { isActive: true },
            orderBy: { priceUsd: 'asc' },
            take: 1,
          },
        },
      });

      const userById = new Map(users.map((u) => [u.id, u]));

      const analysts: TrendingAnalyst[] = [];
      for (const g of groups) {
        const u = userById.get(g.analystId);
        if (!u) continue;
        const perf = u.analystPerformance;
        const cheapestTier = u.subscriptionTiers[0] ?? null;
        analysts.push({
          slug: u.slug ?? u.id,
          displayName: u.displayName || u.name || 'Unnamed',
          avatarInitial: ((u.displayName || u.name || u.email)[0] ?? '?').toUpperCase(),
          newSubscribers: g._count._all,
          totalSubscribers: perf?.subscriberCount ?? 0,
          winRate: perf?.winRate ? Math.round(Number(perf.winRate) * 100) / 100 : 0,
          totalPnl: perf?.totalPnlPercent
            ? Math.round(Number(perf.totalPnlPercent) * 100) / 100
            : 0,
          lowestTierPrice: cheapestTier ? cheapestTier.priceUsd / 100 : 0,
        });
      }

      return { analysts };
    },
  );

  return NextResponse.json(data);
}
