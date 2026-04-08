/**
 * GET /api/follow/status?analystId=...
 *
 * Returns { isFollowing, isSubscribed } for the current user vs the given
 * analyst. Used by the FollowButton to render its three states.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Not signed in: report neither state. UI shows the Follow button as
    // disabled / "Sign in to follow".
    return NextResponse.json({ isFollowing: false, isSubscribed: false });
  }

  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get("analystId");
  if (!analystId) {
    return NextResponse.json({ error: "analystId is required" }, { status: 400 });
  }

  const [follow, subscription] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        followerId_analystId: {
          followerId: session.user.id,
          analystId,
        },
      },
      select: { id: true },
    }),
    prisma.subscription.findFirst({
      where: {
        subscriberId: session.user.id,
        analystId,
        status: { in: ["active", "cancelled"] },
      },
      select: { id: true, status: true, currentPeriodEnd: true },
    }),
  ]);

  // Active subscription OR cancelled-but-still-in-period.
  const isSubscribed = subscription
    ? subscription.status === "active" ||
      (subscription.status === "cancelled" &&
        subscription.currentPeriodEnd > new Date())
    : false;

  return NextResponse.json({
    isFollowing: !!follow,
    isSubscribed,
  });
}
