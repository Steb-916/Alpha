/**
 * DELETE /api/auth/sessions/[id]
 *
 * Revoke a single session by row id. Owner-only.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

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

  try {
    const row = await prisma.userSession.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.userSession.update({
      where: { id: params.id },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/auth/sessions/[id] DELETE",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to revoke session" },
      { status: 500 },
    );
  }
}
