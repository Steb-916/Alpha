/**
 * GET /api/search?q=…&limit=8
 *
 * Marketplace autocomplete. Two parallel queries:
 *   1. Analyst names — case-insensitive contains on displayName, prefix on slug
 *   2. Asset matches — primaryAssets array contains the uppercased query
 *
 * No caching — queries are fast and personalized.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '8', 10) || 8, 20);

  if (q.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const qLower = q.toLowerCase();
  const qUpper = q.toUpperCase();

  const [analysts, assetProfiles] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: 'analyst',
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { slug: { contains: qLower } },
        ],
      },
      include: {
        analystPerformance: true,
      },
      take: limit,
    }),
    prisma.analystProfile.findMany({
      where: {
        primaryAssets: { has: qUpper },
      },
      select: { primaryAssets: true },
      take: 50,
    }),
  ]);

  // Group asset matches: count how many analysts trade each matched asset.
  // (Currently only the exact query match is reported as one entry.)
  const assetCount = assetProfiles.length;

  const results: Array<
    | {
        type: 'analyst';
        analyst: {
          slug: string;
          displayName: string;
          avatarInitial: string;
          winRate: number;
          subscriberCount: number;
        };
      }
    | {
        type: 'asset';
        asset: { symbol: string; analystCount: number };
      }
  > = [];

  for (const a of analysts) {
    results.push({
      type: 'analyst',
      analyst: {
        slug: a.slug ?? a.id,
        displayName: a.displayName || a.name || 'Unnamed',
        avatarInitial: ((a.displayName || a.name || a.email)[0] ?? '?').toUpperCase(),
        winRate: a.analystPerformance?.winRate
          ? Math.round(Number(a.analystPerformance.winRate) * 100) / 100
          : 0,
        subscriberCount: a.analystPerformance?.subscriberCount ?? 0,
      },
    });
  }

  if (assetCount > 0) {
    results.push({
      type: 'asset',
      asset: { symbol: qUpper, analystCount: assetCount },
    });
  }

  return NextResponse.json({ results });
}
