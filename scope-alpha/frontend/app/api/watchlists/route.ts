import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await prisma.watchlist.findMany({
      where: { userId: session.user.id },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/watchlists GET",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to load watchlists" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const name = sanitizeText(body.name || "Default");
    const assets = Array.isArray(body.assets)
      ? body.assets.filter((a: unknown): a is string => typeof a === "string")
      : [];

    const count = await prisma.watchlist.count({
      where: { userId: session.user.id },
    });

    const created = await prisma.watchlist.create({
      data: {
        userId: session.user.id,
        name,
        assets,
        sortOrder: count,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/watchlists POST",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to create watchlist" },
      { status: 500 },
    );
  }
}
