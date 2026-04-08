/**
 * POST /api/users/accept-analyst-agreement
 *
 * Mark the current analyst as having accepted the Publishing Agreement.
 * Required before /api/signals POST or /api/signals/[id]/publish will succeed.
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

  if (session.user.role !== "analyst") {
    return NextResponse.json(
      { error: "Only analysts can accept the publishing agreement" },
      { status: 403 },
    );
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { analystAgreementAcceptedAt: new Date() },
      select: { analystAgreementAcceptedAt: true },
    });
    return NextResponse.json({
      ok: true,
      analystAgreementAcceptedAt:
        updated.analystAgreementAcceptedAt?.toISOString() ?? null,
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/users/accept-analyst-agreement",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to record acceptance" },
      { status: 500 },
    );
  }
}
