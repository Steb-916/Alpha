/**
 * POST /api/reviews/[id]/vote
 *
 * Body: { helpful: boolean }
 *
 * Upserts the vote, then recomputes the denormalized helpful/unhelpful
 * counts on the Review row.
 *
 * Forbidden:
 *   - voting on your own review (review.authorId === session.user.id)
 *   - voting on a review of yourself (review.analystId === session.user.id)
 *
 * Rate limited: 20 votes per hour per user.
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

  const limited = await ensureRateLimit("review/vote", request, session.user.id);
  if (limited) return limited;

  try {

  let body: { helpful?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.helpful !== "boolean") {
    return NextResponse.json(
      { error: "helpful must be a boolean" },
      { status: 400 },
    );
  }

  const review = await prisma.review.findUnique({
    where: { id: params.id },
    select: { id: true, authorId: true, analystId: true },
  });
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (review.authorId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot vote on your own review" },
      { status: 403 },
    );
  }
  if (review.analystId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot vote on a review of yourself" },
      { status: 403 },
    );
  }

  // Upsert the vote.
  await prisma.reviewVote.upsert({
    where: {
      reviewId_userId: {
        reviewId: review.id,
        userId: session.user.id,
      },
    },
    create: {
      reviewId: review.id,
      userId: session.user.id,
      helpful: body.helpful,
    },
    update: { helpful: body.helpful },
  });

  // Recompute denormalized counts.
  const [helpfulCount, unhelpfulCount] = await Promise.all([
    prisma.reviewVote.count({
      where: { reviewId: review.id, helpful: true },
    }),
    prisma.reviewVote.count({
      where: { reviewId: review.id, helpful: false },
    }),
  ]);

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: { helpfulCount, unhelpfulCount },
    select: { helpfulCount: true, unhelpfulCount: true },
  });

  return NextResponse.json({ ok: true, ...updated });
  } catch (error) {
    captureRouteError(error, { route: "/api/reviews/[id]/vote", userId: session.user.id });
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
  }
}
