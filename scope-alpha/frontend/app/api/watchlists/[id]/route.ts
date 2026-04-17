import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

async function loadOwned(id: string, userId: string) {
  const row = await prisma.watchlist.findUnique({ where: { id } });
  if (!row) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (row.userId !== userId) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { row };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  const owned = await loadOwned(params.id, session.user.id);
  if (owned.error) return owned.error;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body.name === "string") updateData.name = sanitizeText(body.name);
    if (Array.isArray(body.assets)) {
      updateData.assets = body.assets.filter(
        (a: unknown): a is string => typeof a === "string",
      );
    }
    if (typeof body.sortOrder === "number") updateData.sortOrder = body.sortOrder;

    const updated = await prisma.watchlist.update({
      where: { id: params.id },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch (error) {
    captureRouteError(error, {
      route: "/api/watchlists/[id] PATCH",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to update watchlist" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  const owned = await loadOwned(params.id, session.user.id);
  if (owned.error) return owned.error;

  try {
    await prisma.watchlist.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/watchlists/[id] DELETE",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to delete watchlist" },
      { status: 500 },
    );
  }
}
