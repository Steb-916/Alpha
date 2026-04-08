/**
 * GET /api/reviews?analystId=...
 *
 * Phase 5 additions:
 *   - sort=newest|highest|lowest|mostHelpful
 *   - verified=true → only verifiedSubscriber rows
 *   - tier=<name> → only reviews where the reviewer was on this tier
 *   - response includes helpfulCount, unhelpfulCount, verifiedSubscriber, subscriptionTier
 *
 * POST /api/reviews
 *
 * Phase 5 addition: stamp `verifiedSubscriber` and `subscriptionTier`
 * from the existing `checkSubscriptionAccess` stub at write time.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkSubscriptionAccess } from "@/lib/subscriptions";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeRichText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get("analystId");
  const sortParam = searchParams.get("sort") ?? "newest";
  const verified = searchParams.get("verified") === "true";
  const tier = searchParams.get("tier");

  if (!analystId) {
    return NextResponse.json({ error: "analystId required" }, { status: 400 });
  }

  const where: Prisma.ReviewWhereInput = { analystId };
  if (verified) where.verifiedSubscriber = true;
  if (tier) where.subscriptionTier = tier;

  let orderBy: Prisma.ReviewOrderByWithRelationInput[];
  switch (sortParam) {
    case "highest":
      orderBy = [{ rating: "desc" }, { createdAt: "desc" }];
      break;
    case "lowest":
      orderBy = [{ rating: "asc" }, { createdAt: "desc" }];
      break;
    case "mostHelpful":
      orderBy = [{ helpfulCount: "desc" }, { createdAt: "desc" }];
      break;
    case "newest":
    default:
      orderBy = [{ createdAt: "desc" }];
      break;
  }

  const reviews = await prisma.review.findMany({
    where,
    include: {
      author: {
        select: { id: true, displayName: true, name: true },
      },
    },
    orderBy,
    take: 50,
  });

  return NextResponse.json(
    reviews.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      authorName: r.author.displayName || r.author.name || "Anonymous",
      analystId: r.analystId,
      rating: r.rating,
      content: r.content,
      analystResponse: r.analystResponse,
      subscriptionMonths: r.subscriptionMonths,
      // Phase 5
      helpfulCount: r.helpfulCount,
      unhelpfulCount: r.unhelpfulCount,
      verifiedSubscriber: r.verifiedSubscriber,
      subscriptionTier: r.subscriptionTier,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

// POST /api/reviews — create review (subscriber only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("review/create", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { analystId, rating } = body;
    const content = sanitizeRichText(body.content);

    if (!analystId || !rating || !content) {
      return NextResponse.json(
        { error: "analystId, rating, and content are required" },
        { status: 400 },
      );
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }
    if (analystId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot review yourself" },
        { status: 400 },
      );
    }

    const existing = await prisma.review.findUnique({
      where: {
        authorId_analystId: {
          authorId: session.user.id,
          analystId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this analyst" },
        { status: 409 },
      );
    }

    // Phase 5: stamp verified-subscriber status from checkSubscriptionAccess.
    const access = await checkSubscriptionAccess(session.user.id, analystId);
    const verifiedSubscriber = access.hasAccess;
    const subscriptionTier = access.tier?.name ?? null;

    const review = await prisma.review.create({
      data: {
        authorId: session.user.id,
        analystId,
        rating,
        content,
        verifiedSubscriber,
        subscriptionTier,
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    captureRouteError(error, { route: "/api/reviews POST", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 },
    );
  }
}
