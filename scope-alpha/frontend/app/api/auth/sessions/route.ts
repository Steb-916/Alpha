/**
 * Phase 7 session management.
 *
 * GET    /api/auth/sessions          — list current user's active sessions
 * DELETE /api/auth/sessions          — revoke all sessions except the current one
 *
 * The "current" session is identified by the JWT `jti` claim. We pull it via
 * `getToken({ req })` rather than `getServerSession` so we can compare directly.
 */

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read the current jti so we can flag the row that's making the request.
  const token = await getToken({
    req: request as unknown as Parameters<typeof getToken>[0]["req"],
  });
  const currentJti = (token?.jti as string | undefined) ?? null;

  const rows = await prisma.userSession.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { lastActive: "desc" },
  });

  return NextResponse.json({
    sessions: rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      ipAddress: r.ipAddress,
      lastActive: r.lastActive.toISOString(),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      isCurrent: !!currentJti && r.token === currentJti,
    })),
  });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const token = await getToken({
      req: request as unknown as Parameters<typeof getToken>[0]["req"],
    });
    const currentJti = (token?.jti as string | undefined) ?? null;

    // Revoke all sessions for this user EXCEPT the one making the request.
    await prisma.userSession.updateMany({
      where: {
        userId: session.user.id,
        revokedAt: null,
        ...(currentJti ? { token: { not: currentJti } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/auth/sessions DELETE",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to revoke sessions" },
      { status: 500 },
    );
  }
}
