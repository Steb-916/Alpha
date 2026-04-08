/**
 * POST /api/signals/[id]/like
 *
 * Toggles a like on a signal. Updates the denormalized `likeCount` on the
 * Signal row so the marketplace can sort by popularity without a join.
 *
 * Returns: { liked: boolean, likeCount: number }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("like", request, session.user.id);
  if (limited) return limited;

  try {

  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  // Toggle: do we already have a row?
  const existing = await prisma.signalLike.findUnique({
    where: {
      userId_signalId: {
        userId: session.user.id,
        signalId: signal.id,
      },
    },
  });

  let liked: boolean;
  let likeCount: number;

  if (existing) {
    // Unlike.
    await prisma.$transaction([
      prisma.signalLike.delete({ where: { id: existing.id } }),
      prisma.signal.update({
        where: { id: signal.id },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
    const updated = await prisma.signal.findUnique({
      where: { id: signal.id },
      select: { likeCount: true },
    });
    liked = false;
    likeCount = Math.max(0, updated?.likeCount ?? 0);
  } else {
    // Like.
    await prisma.$transaction([
      prisma.signalLike.create({
        data: { userId: session.user.id, signalId: signal.id },
      }),
      prisma.signal.update({
        where: { id: signal.id },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    const updated = await prisma.signal.findUnique({
      where: { id: signal.id },
      select: { likeCount: true },
    });
    liked = true;
    likeCount = updated?.likeCount ?? 1;
  }

  return NextResponse.json({ liked, likeCount });
  } catch (error) {
    captureRouteError(error, { route: "/api/signals/[id]/like", userId: session.user.id });
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
