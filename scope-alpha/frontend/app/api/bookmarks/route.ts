/**
 * GET /api/bookmarks
 *
 * Returns the current user's bookmarked signals (newest first), paginated.
 * Each entry uses serializeSignal so the frontend gets the uniform multi-
 * target shape.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeSignal } from "@/lib/signals/serializer";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10) || 30, 100);
  const cursor = searchParams.get("cursor");

  const rows = await prisma.signalBookmark.findMany({
    where: { userId: session.user.id },
    include: {
      signal: { include: { targets: { orderBy: { order: "asc" } } } },
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

  return NextResponse.json({
    items: trimmed.map((b) => ({
      bookmarkedAt: b.createdAt.toISOString(),
      signal: serializeSignal(b.signal),
    })),
    nextCursor,
  });
}
