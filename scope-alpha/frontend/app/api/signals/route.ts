import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/signals?analystId=...&status=active&assetSymbol=BTC
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get("analystId");
  const status = searchParams.get("status");
  const assetSymbol = searchParams.get("assetSymbol");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (analystId) where.analystId = analystId;
  if (status) where.status = status;
  if (assetSymbol) where.assetSymbol = assetSymbol;

  const signals = await prisma.signal.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: Math.min(limit, 100),
  });

  // Convert Decimals to numbers for JSON serialization
  const serialized = signals.map((s) => ({
    ...s,
    entryPrice: Number(s.entryPrice),
    targetPrice: Number(s.targetPrice),
    stopLossPrice: Number(s.stopLossPrice),
    resolvedPrice: s.resolvedPrice ? Number(s.resolvedPrice) : null,
    resultPnlPercent: s.resultPnlPercent ? Number(s.resultPnlPercent) : null,
  }));

  return NextResponse.json(serialized);
}

// POST /api/signals — create new signal (analyst only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "analyst") {
    return NextResponse.json(
      { error: "Only analysts can create signals" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const {
      assetSymbol,
      direction,
      entryPrice,
      targetPrice,
      stopLossPrice,
      timeframe,
      conviction,
      notes,
    } = body;

    // Validate required fields
    if (!assetSymbol || !direction || !entryPrice || !targetPrice || !stopLossPrice || !timeframe) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate direction
    if (!["long", "short"].includes(direction)) {
      return NextResponse.json(
        { error: "Direction must be 'long' or 'short'" },
        { status: 400 }
      );
    }

    // Validate price logic
    if (direction === "long") {
      if (targetPrice <= entryPrice) {
        return NextResponse.json(
          { error: "Target must be above entry for long signals" },
          { status: 400 }
        );
      }
      if (stopLossPrice >= entryPrice) {
        return NextResponse.json(
          { error: "Stop loss must be below entry for long signals" },
          { status: 400 }
        );
      }
    } else {
      if (targetPrice >= entryPrice) {
        return NextResponse.json(
          { error: "Target must be below entry for short signals" },
          { status: 400 }
        );
      }
      if (stopLossPrice <= entryPrice) {
        return NextResponse.json(
          { error: "Stop loss must be above entry for short signals" },
          { status: 400 }
        );
      }
    }

    const signal = await prisma.signal.create({
      data: {
        analystId: session.user.id,
        assetSymbol,
        direction,
        entryPrice,
        targetPrice,
        stopLossPrice,
        timeframe,
        conviction: conviction || "medium",
        notes: notes || null,
      },
    });

    return NextResponse.json(
      {
        ...signal,
        entryPrice: Number(signal.entryPrice),
        targetPrice: Number(signal.targetPrice),
        stopLossPrice: Number(signal.stopLossPrice),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create signal error:", error);
    return NextResponse.json(
      { error: "Failed to create signal" },
      { status: 500 }
    );
  }
}
