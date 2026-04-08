/**
 * POST   /api/follow                — body { analystId } → create follow
 * DELETE /api/follow?analystId=...  → remove follow
 *
 * Free follow mechanic. Subscribing to an analyst auto-creates a follow row
 * (handled in app/api/subscriptions/route.ts POST). Unsubscribing does NOT
 * auto-remove the follow.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("follow", request, session.user.id);
  if (limited) return limited;

  let body: { analystId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.analystId || typeof body.analystId !== "string") {
    return NextResponse.json({ error: "analystId is required" }, { status: 400 });
  }

  if (body.analystId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 },
    );
  }

  // Verify the target is an analyst.
  const target = await prisma.user.findUnique({
    where: { id: body.analystId },
    select: { id: true, role: true },
  });
  if (!target || target.role !== "analyst") {
    return NextResponse.json(
      { error: "Analyst not found" },
      { status: 404 },
    );
  }

  try {
    await prisma.follow.create({
      data: {
        followerId: session.user.id,
        analystId: body.analystId,
      },
    });
    return NextResponse.json({ ok: true, isFollowing: true }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { ok: true, isFollowing: true, alreadyFollowing: true },
        { status: 200 },
      );
    }
    captureRouteError(err, { route: "/api/follow POST", userId: session.user.id });
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("follow", request, session.user.id);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get("analystId");
  if (!analystId) {
    return NextResponse.json({ error: "analystId is required" }, { status: 400 });
  }

  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, analystId },
  });

  return NextResponse.json({ ok: true, isFollowing: false });
}
