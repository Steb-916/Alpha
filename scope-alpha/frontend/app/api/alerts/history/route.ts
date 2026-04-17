import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

    // Find the current user's alert ids first, then load history rows that
    // reference them. AlertHistory is denormalized so this is a simple two-step.
    const alerts = await prisma.alert.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const alertIds = alerts.map((a) => a.id);

    if (alertIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items = await prisma.alertHistory.findMany({
      where: { alertId: { in: alertIds } },
      orderBy: { triggeredAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({ items });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/alerts/history GET",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to load history" },
      { status: 500 },
    );
  }
}
