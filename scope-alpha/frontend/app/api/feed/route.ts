/**
 * GET /api/feed
 *
 * Global or per-analyst activity feed. Newest first, cursor paginated.
 *
 * Query:
 *   filter   = 'all' | 'signals' | 'milestones'  (default 'all')
 *   analystId = optional, scopes the feed to a single analyst
 *   limit    = default 20, max 50
 *   cursor   = the id of the last seen event
 *
 * For events with `visibility = 'subscribers'`, gated metadata fields
 * (conviction, timeframe) are stripped if the viewer doesn't have access via
 * checkSubscriptionAccess. Each item carries an `isFullAccess` boolean so
 * the UI can render a "Subscribe to see details" preview state.
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
  const viewerId = session?.user?.id ?? null;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "all";
  const analystId = searchParams.get("analystId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
  const cursor = searchParams.get("cursor");

  const where: Prisma.FeedEventWhereInput = {};
  if (analystId) where.analystId = analystId;
  if (filter === "signals") {
    where.type = { in: ["signal_published", "signal_resolved"] };
  } else if (filter === "milestones") {
    where.type = {
      in: [
        "milestone_signals",
        "milestone_subscribers",
        "milestone_winstreak",
      ],
    };
  }

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

  // Per-analyst access cache so we don't call checkSubscriptionAccess once
  // per event (could be 20 calls/page).
  const accessCache = new Map<string, boolean>();
  async function viewerHasAccess(targetAnalystId: string): Promise<boolean> {
    if (!viewerId) return false;
    if (viewerId === targetAnalystId) return true; // self
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

      // Strip gated metadata fields when access is not granted.
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
        metadata = {
          title: metadata.title,
        };
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
