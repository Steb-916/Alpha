/**
 * GET /api/feed/following
 *
 * Personalized following feed. Returns events from analysts the current
 * user follows (via the Phase 6 Follow model). No cache (personalized).
 *
 * Same response shape as /api/feed.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkSubscriptionAccess } from "@/lib/subscriptions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewerId = session.user.id;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  const cursor = searchParams.get("cursor");

  // Resolve followed analyst IDs.
  const follows = await prisma.follow.findMany({
    where: { followerId: viewerId },
    select: { analystId: true },
  });

  if (follows.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  const followedIds = follows.map((f) => f.analystId);

  const where: Prisma.FeedEventWhereInput = {
    analystId: { in: followedIds },
  };

  const rows = await prisma.feedEvent.findMany({
    where,
    include: {
      actor: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  let trimmed = rows;
  if (rows.length > limit) {
    nextCursor = rows[limit - 1].id;
    trimmed = rows.slice(0, limit);
  }

  // Per-analyst access cache.
  const accessCache = new Map<string, boolean>();
  async function viewerHasAccess(targetAnalystId: string): Promise<boolean> {
    if (viewerId === targetAnalystId) return true;
    const cached = accessCache.get(targetAnalystId);
    if (cached !== undefined) return cached;
    const access = await checkSubscriptionAccess(viewerId, targetAnalystId);
    accessCache.set(targetAnalystId, access.hasAccess);
    return access.hasAccess;
  }

  const items = await Promise.all(
    trimmed.map(async (e) => {
      let isFullAccess = e.visibility === "public";
      if (e.visibility === "subscribers" && e.analystId) {
        isFullAccess = await viewerHasAccess(e.analystId);
      }

      let metadata = (e.metadata as Record<string, unknown>) ?? {};
      if (!isFullAccess && e.type === "signal_published") {
        metadata = {
          asset: metadata.asset,
          direction: metadata.direction,
          analystName: metadata.analystName,
          analystSlug: metadata.analystSlug,
        };
      }
      if (!isFullAccess && e.type === "announcement") {
        metadata = { title: metadata.title };
      }

      return {
        id: e.id,
        type: e.type,
        actor: {
          id: e.actor.id,
          slug: e.actor.slug ?? e.actor.id,
          displayName: e.actor.displayName || e.actor.name || "Unknown",
          avatarUrl: e.actor.avatarUrl,
          avatarInitial: ((e.actor.displayName ||
            e.actor.name ||
            e.actor.email)[0] ?? "?").toUpperCase(),
        },
        analystId: e.analystId,
        signalId: e.signalId,
        metadata,
        visibility: e.visibility,
        isFullAccess,
        createdAt: e.createdAt.toISOString(),
      };
    }),
  );

  return NextResponse.json({ items, nextCursor });
}
