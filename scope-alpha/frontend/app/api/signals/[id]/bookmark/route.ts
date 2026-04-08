/**
 * POST /api/signals/[id]/bookmark
 *
 * Toggles a bookmark on a signal.
 * Returns: { bookmarked: boolean }
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

  const limited = await ensureRateLimit("bookmark", request, session.user.id);
  if (limited) return limited;

  try {

  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  const existing = await prisma.signalBookmark.findUnique({
    where: {
      userId_signalId: {
        userId: session.user.id,
        signalId: signal.id,
      },
    },
  });

  if (existing) {
    await prisma.signalBookmark.delete({ where: { id: existing.id } });
    return NextResponse.json({ bookmarked: false });
  }

  await prisma.signalBookmark.create({
    data: { userId: session.user.id, signalId: signal.id },
  });
  return NextResponse.json({ bookmarked: true });
  } catch (error) {
    captureRouteError(error, { route: "/api/signals/[id]/bookmark", userId: session.user.id });
    return NextResponse.json({ error: "Failed to toggle bookmark" }, { status: 500 });
  }
}
