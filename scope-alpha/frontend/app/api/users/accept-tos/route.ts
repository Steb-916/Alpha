/**
 * POST /api/users/accept-tos
 *
 * Mark the current user as having accepted the Terms of Service. The
 * client-side TosAcceptanceModal calls this then triggers a session
 * `update()` so the JWT picks up the new tosAcceptedAt.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { tosAcceptedAt: new Date() },
      select: { tosAcceptedAt: true },
    });
    return NextResponse.json({
      ok: true,
      tosAcceptedAt: updated.tosAcceptedAt?.toISOString() ?? null,
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/users/accept-tos",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to record acceptance" },
      { status: 500 },
    );
  }
}
