/**
 * GET /api/analysts/compare?ids=slug1,slug2,slug3
 *
 * Side-by-side comparison data for 2-3 analysts. Cached 5 minutes via the
 * sorted slug list as cache key.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCacheAndStale } from '@/lib/cache/redis';
import { winRate, totalPnl, isResolved } from '@/lib/analytics/metrics';

export const runtime = 'nodejs';

interface AnalystComparison {
  slug: string;
  displayName: string;
  avatarInitial: string;
  tagline: string | null;
  primaryAssets: string[];
  tradingStyle: string | null;
  experienceYears: number | null;
  performance: {
    totalSignals: number;
    winRate: number;
    avgPnl: number;
    totalPnl: number;
    profitFactor: number;
    maxDrawdownPct: number | null;
    subscriberCount: number;
    averageRating: number | null;
    ratingCount: number;
  };
  tiers: Array<{
    name: string;
    price: number;
    features: string[];
  }>;
  recentPerformance: {
    '30d': { winRate: number; totalPnl: number; signalCount: number };
    '90d': { winRate: number; totalPnl: number; signalCount: number };
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length < 2 || ids.length > 3) {
    return NextResponse.json(
      { error: 'Provide 2 or 3 analyst slugs in `ids`' },
      { status: 400 },
    );
  }

  // Sort slugs for a stable cache key.
  const sortedIds = [...ids].sort();

  const data = await withCacheAndStale(
    `analytics:compare:${sortedIds.join(',')}`,
    300,
    async () => {
      const users = await prisma.user.findMany({
        where: { slug: { in: ids }, role: 'analyst' },
        include: {
          analystProfile: true,
          analystPerformance: true,
          subscriptionTiers: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          // Recent resolved signals for the 30d/90d windows.
          signals: {
            where: { status: 'resolved' },
            select: {
              resultPnlPercent: true,
              resolvedAt: true,
            },
            orderBy: { resolvedAt: 'desc' },
            take: 200,
          },
          _count: {
            select: { reviewsReceived: true },
          },
        },
      });

      // Maintain the requested order in the response (not the DB order).
      const usersBySlug = new Map(users.map((u) => [u.slug ?? u.id, u]));
      const now = Date.now();

      const analysts: AnalystComparison[] = [];
      for (const slug of ids) {
        const u = usersBySlug.get(slug);
        if (!u) continue;
        const perf = u.analystPerformance;
        const profile = u.analystProfile;

        const normalized = u.signals
          .filter((s) => s.resultPnlPercent != null)
          .map((s) => ({
            resultPnlPercent: Number(s.resultPnlPercent),
            resolvedAt: s.resolvedAt,
          }));

        const last30 = normalized.filter(
          (s) => s.resolvedAt && s.resolvedAt.getTime() >= now - 30 * DAY_MS,
        );
        const last90 = normalized.filter(
          (s) => s.resolvedAt && s.resolvedAt.getTime() >= now - 90 * DAY_MS,
        );

        analysts.push({
          slug: u.slug ?? u.id,
          displayName: u.displayName || u.name || 'Unnamed',
          avatarInitial: ((u.displayName || u.name || u.email)[0] ?? '?').toUpperCase(),
          tagline: profile?.tagline ?? null,
          primaryAssets: profile?.primaryAssets ?? [],
          tradingStyle: profile?.tradingStyle ?? null,
          experienceYears: profile?.experienceYears ?? null,
          performance: {
            totalSignals: perf?.totalSignals ?? 0,
            winRate: perf?.winRate ? Number(perf.winRate) : 0,
            avgPnl: perf?.avgPnlPercent ? Number(perf.avgPnlPercent) : 0,
            totalPnl: perf?.totalPnlPercent ? Number(perf.totalPnlPercent) : 0,
            profitFactor: perf?.profitFactor ? Number(perf.profitFactor) : 0,
            maxDrawdownPct: perf?.maxDrawdownPct ?? null,
            subscriberCount: perf?.subscriberCount ?? 0,
            averageRating: perf?.avgRating ? Number(perf.avgRating) : null,
            ratingCount: u._count.reviewsReceived,
          },
          tiers: u.subscriptionTiers.map((t) => ({
            name: t.name,
            price: t.priceUsd / 100,
            features: t.features,
          })),
          recentPerformance: {
            '30d': {
              winRate: winRate(last30),
              totalPnl: totalPnl(last30),
              signalCount: last30.filter(isResolved).length,
            },
            '90d': {
              winRate: winRate(last90),
              totalPnl: totalPnl(last90),
              signalCount: last90.filter(isResolved).length,
            },
          },
        });
      }

      return { analysts };
    },
  );

  return NextResponse.json(data);
}
