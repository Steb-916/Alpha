import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

// GET /api/subscriptions — list user's active subscriptions
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await prisma.subscription.findMany({
    where: {
      subscriberId: session.user.id,
      status: { in: ["active", "cancelled"] },
    },
    include: {
      tier: true,
      analyst: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(subscriptions);
}

// POST /api/subscriptions — create subscription (mock Stripe)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("subscriptions/checkout", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { tierId } = body;

    if (!tierId) {
      return NextResponse.json(
        { error: "tierId is required" },
        { status: 400 }
      );
    }

    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
    });

    if (!tier || !tier.isActive) {
      return NextResponse.json(
        { error: "Subscription tier not found or inactive" },
        { status: 404 }
      );
    }

    // Can't subscribe to yourself
    if (tier.analystId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot subscribe to yourself" },
        { status: 400 }
      );
    }

    // Check for existing active subscription
    const existing = await prisma.subscription.findUnique({
      where: {
        subscriberId_analystId: {
          subscriberId: session.user.id,
          analystId: tier.analystId,
        },
      },
    });

    if (existing && (existing.status === "active" || existing.status === "cancelled")) {
      return NextResponse.json(
        { error: "Already subscribed to this analyst" },
        { status: 409 }
      );
    }

    // Mock: Create subscription immediately (in production, Stripe webhook would do this)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = existing
      ? await prisma.subscription.update({
          where: { id: existing.id },
          data: {
            tierId,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelledAt: null,
            stripeSubscriptionId: `mock_sub_${Date.now()}`,
          },
        })
      : await prisma.subscription.create({
          data: {
            subscriberId: session.user.id,
            analystId: tier.analystId,
            tierId,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            stripeSubscriptionId: `mock_sub_${Date.now()}`,
          },
        });

    // Phase 6: subscribing implies following. Idempotent — if a Follow row
    // already exists (P2002), silently ignore.
    try {
      await prisma.follow.create({
        data: {
          followerId: session.user.id,
          analystId: tier.analystId,
        },
      });
    } catch {
      /* already following — fine */
    }

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    captureRouteError(error, { route: "/api/subscriptions POST", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}
