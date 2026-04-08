import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

// GET /api/annotations?assetSymbol=BTC&analystId=...&timeframe=4H
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const assetSymbol = searchParams.get("assetSymbol");
  const analystId = searchParams.get("analystId");
  const timeframe = searchParams.get("timeframe");

  const where: Record<string, unknown> = { isActive: true };
  if (assetSymbol) where.assetSymbol = assetSymbol;
  if (analystId) where.analystId = analystId;
  if (timeframe) where.timeframe = timeframe;

  // If requesting own annotations, include drafts
  if (analystId === session.user.id) {
    delete where.isActive;
  } else {
    where.isDraft = false;
  }

  const annotations = await prisma.annotation.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(annotations);
}

// POST /api/annotations — create new annotation (analyst only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "analyst") {
    return NextResponse.json(
      { error: "Only analysts can create annotations" },
      { status: 403 }
    );
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { assetSymbol, annotationType, data, timeframe, isDraft } = body;

    if (!assetSymbol || !annotationType || !data) {
      return NextResponse.json(
        { error: "assetSymbol, annotationType, and data are required" },
        { status: 400 }
      );
    }

    const annotation = await prisma.annotation.create({
      data: {
        analystId: session.user.id,
        assetSymbol,
        annotationType,
        data,
        timeframe: timeframe || null,
        isDraft: isDraft ?? false,
      },
    });

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    captureRouteError(error, { route: "/api/annotations POST", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to create annotation" },
      { status: 500 }
    );
  }
}
