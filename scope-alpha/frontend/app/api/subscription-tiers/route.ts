import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/subscription-tiers?analystId=... — list tiers for an analyst
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get("analystId");

  if (!analystId) {
    return NextResponse.json({ error: "analystId required" }, { status: 400 });
  }

  const tiers = await prisma.subscriptionTier.findMany({
    where: { analystId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(tiers);
}

// POST /api/subscription-tiers — create tier (analyst only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "analyst") {
    return NextResponse.json(
      { error: "Only analysts can create tiers" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, description, priceUsd, features } = body;

    if (!name || !priceUsd) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    // Max 3 tiers
    const existingCount = await prisma.subscriptionTier.count({
      where: { analystId: session.user.id, isActive: true },
    });

    if (existingCount >= 3) {
      return NextResponse.json(
        { error: "Maximum 3 active tiers allowed" },
        { status: 400 }
      );
    }

    const tier = await prisma.subscriptionTier.create({
      data: {
        analystId: session.user.id,
        name,
        description: description || null,
        priceUsd: Math.round(priceUsd * 100), // store in cents
        features: features || [],
        sortOrder: existingCount,
      },
    });

    return NextResponse.json(tier, { status: 201 });
  } catch (error) {
    console.error("Create tier error:", error);
    return NextResponse.json(
      { error: "Failed to create tier" },
      { status: 500 }
    );
  }
}
