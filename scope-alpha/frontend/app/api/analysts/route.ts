/**
 * GET /api/analysts
 *
 * Public listing endpoint for the marketplace. Returns analyst cards in the
 * same shape as `lib/marketplace.ts.AnalystCard` so the frontend can swap
 * between the API result and the MOCK_ANALYSTS fallback transparently.
 *
 * Query params (all optional):
 *   q             — text search across displayName / slug
 *   minWinRate    — 0..100
 *   maxWinRate    — 0..100
 *   minPnl        — totalPnl90d floor
 *   maxPnl        — totalPnl90d ceiling
 *   minPrice      — cheapest tier USD floor
 *   maxPrice      — cheapest tier USD ceiling
 *   minSignals    — totalSignals floor
 *   minSubscribers — subscriberCount floor
 *   assets        — comma-separated, matched against primaryAssets
 *   style         — exact match against tradingStyle
 *   rating        — minimum avgRating
 *   sort          — subscribers | winRate | pnl | priceAsc | rating | newest
 *   limit         — default 30, max 100
 *   offset        — default 0
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { AnalystCard, SortOption } from '@/lib/marketplace';

export const runtime = 'nodejs';

function parseNumber(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get('q')?.trim() || '';
  const minWinRate = parseNumber(searchParams.get('minWinRate'));
  const maxWinRate = parseNumber(searchParams.get('maxWinRate'));
  const minPnl = parseNumber(searchParams.get('minPnl'));
  const maxPnl = parseNumber(searchParams.get('maxPnl'));
  const minPrice = parseNumber(searchParams.get('minPrice'));
  const maxPrice = parseNumber(searchParams.get('maxPrice'));
  const minSignals = parseNumber(searchParams.get('minSignals'));
  const minSubscribers = parseNumber(searchParams.get('minSubscribers'));
  const assetsParam = searchParams.get('assets');
  const assets = assetsParam ? assetsParam.split(',').filter(Boolean) : null;
  const style = searchParams.get('style')?.trim() || null;
  const rating = parseNumber(searchParams.get('rating'));
  const sort = (searchParams.get('sort') ?? 'subscribers') as SortOption;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10) || 30, 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;

  // Build the AnalystPerformance filter (numeric ranges live there).
  const performanceFilter: Prisma.AnalystPerformanceWhereInput = {};
  if (minWinRate != null || maxWinRate != null) {
    performanceFilter.winRate = {
      ...(minWinRate != null ? { gte: minWinRate } : {}),
      ...(maxWinRate != null ? { lte: maxWinRate } : {}),
    };
  }
  if (minPnl != null || maxPnl != null) {
    performanceFilter.last90dPnlPercent = {
      ...(minPnl != null ? { gte: minPnl } : {}),
      ...(maxPnl != null ? { lte: maxPnl } : {}),
    };
  }
  if (minSignals != null) {
    performanceFilter.totalSignals = { gte: minSignals };
  }
  if (minSubscribers != null) {
    performanceFilter.subscriberCount = { gte: minSubscribers };
  }
  if (rating != null) {
    performanceFilter.avgRating = { gte: rating };
  }

  // AnalystProfile filter (assets + style live there).
  const profileFilter: Prisma.AnalystProfileWhereInput = {};
  if (assets && assets.length > 0) {
    profileFilter.primaryAssets = { hasSome: assets };
  }
  if (style) {
    profileFilter.tradingStyle = { equals: style, mode: 'insensitive' };
  }

  // Top-level User filter.
  const where: Prisma.UserWhereInput = {
    role: 'analyst',
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q.toLowerCase() } },
          ],
        }
      : {}),
    ...(Object.keys(performanceFilter).length > 0
      ? { analystPerformance: { is: performanceFilter } }
      : {}),
    ...(Object.keys(profileFilter).length > 0
      ? { analystProfile: { is: profileFilter } }
      : {}),
  };

  // Price filter requires a SubscriptionTier join. We use a `some` filter so
  // analysts with at least one tier in range qualify; the cheapest active tier
  // is used for the response card price.
  if (minPrice != null || maxPrice != null) {
    where.subscriptionTiers = {
      some: {
        isActive: true,
        ...(minPrice != null ? { priceUsd: { gte: Math.round(minPrice * 100) } } : {}),
        ...(maxPrice != null ? { priceUsd: { lte: Math.round(maxPrice * 100) } } : {}),
      },
    };
  }

  const analysts = await prisma.user.findMany({
    where,
    include: {
      analystProfile: true,
      analystPerformance: true,
      subscriptionTiers: {
        where: { isActive: true },
        orderBy: { priceUsd: 'asc' },
        take: 1,
      },
      // Pull recent resolved signals just for the sparkline.
      signals: {
        where: { status: 'resolved' },
        orderBy: { resolvedAt: 'desc' },
        take: 20,
        select: { resultPnlPercent: true, resolvedAt: true },
      },
      _count: {
        select: {
          signals: { where: { status: 'active' } },
        },
      },
    },
    take: limit,
    skip: offset,
  });

  // Map to AnalystCard shape.
  const cards: AnalystCard[] = analysts.map((u) => {
    const perf = u.analystPerformance;
    const profile = u.analystProfile;
    const cheapestTier = u.subscriptionTiers[0] ?? null;

    // Sparkline = running cumulative P&L of last 20 resolved signals (oldest → newest).
    const sortedSignals = [...u.signals]
      .filter((s) => s.resultPnlPercent != null)
      .sort((a, b) => {
        const at = a.resolvedAt ? a.resolvedAt.getTime() : 0;
        const bt = b.resolvedAt ? b.resolvedAt.getTime() : 0;
        return at - bt;
      });
    const sparkline: number[] = [];
    let running = 0;
    for (const s of sortedSignals) {
      running += s.resultPnlPercent != null ? Number(s.resultPnlPercent) : 0;
      sparkline.push(Math.round(running * 100) / 100);
    }

    return {
      id: u.id,
      slug: u.slug ?? u.id,
      displayName: u.displayName || u.name || 'Unnamed Analyst',
      avatarInitial: ((u.displayName || u.name || u.email)[0] ?? '?').toUpperCase(),
      subscriberCount: perf?.subscriberCount ?? 0,
      // SubscriptionTier.priceUsd is stored in cents → convert to dollars.
      priceUsd: cheapestTier ? cheapestTier.priceUsd / 100 : 0,
      winRate90d: perf?.last90dWinRate
        ? Math.round(Number(perf.last90dWinRate) * 100) / 100
        : perf?.winRate
          ? Math.round(Number(perf.winRate) * 100) / 100
          : 0,
      totalPnl90d: perf?.last90dPnlPercent
        ? Math.round(Number(perf.last90dPnlPercent) * 100) / 100
        : 0,
      activeSignals: u._count.signals,
      avgRating: perf?.avgRating ? Math.round(Number(perf.avgRating) * 100) / 100 : 0,
      primaryAssets: profile?.primaryAssets ?? [],
      tradingStyle: profile?.tradingStyle ?? '—',
      sparkline,
      joinedAt: u.createdAt.toISOString(),
    };
  });

  // Sort in-memory for now (matches the legacy mock sort options).
  switch (sort) {
    case 'subscribers':
      cards.sort((a, b) => b.subscriberCount - a.subscriberCount);
      break;
    case 'winRate':
      cards.sort((a, b) => b.winRate90d - a.winRate90d);
      break;
    case 'pnl':
      cards.sort((a, b) => b.totalPnl90d - a.totalPnl90d);
      break;
    case 'priceAsc':
      cards.sort((a, b) => a.priceUsd - b.priceUsd);
      break;
    case 'rating':
      cards.sort((a, b) => b.avgRating - a.avgRating);
      break;
    case 'newest':
      cards.sort(
        (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime(),
      );
      break;
  }

  return NextResponse.json({ analysts: cards, total: cards.length });
}
