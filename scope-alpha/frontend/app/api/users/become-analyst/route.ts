import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFeedEvent } from "@/lib/feed/events";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role === "analyst") {
      return NextResponse.json(
        { error: "You are already an analyst" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { tagline, primaryAssets, tradingStyle, experienceYears } = body;

    // Transaction: update role + create analyst profile
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { role: "analyst" },
      }),
      prisma.analystProfile.create({
        data: {
          userId: session.user.id,
          tagline: tagline ? sanitizeText(tagline) : null,
          primaryAssets: primaryAssets || [],
          tradingStyle: tradingStyle || null,
          experienceYears: experienceYears ? parseInt(experienceYears) : null,
        },
      }),
    ]);

    // Phase 6: emit a public feed event so the analyst's debut shows up.
    createFeedEvent({
      type: "new_analyst",
      actorId: updatedUser.id,
      analystId: updatedUser.id,
      metadata: { tagline: tagline || null },
      visibility: "public",
    }).catch((err) =>
      console.error("[become-analyst] feed event failed:", err),
    );

    return NextResponse.json({
      id: updatedUser.id,
      role: updatedUser.role,
      message: "Successfully upgraded to analyst",
    });
  } catch (error) {
    captureRouteError(error, { route: "/api/users/become-analyst", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to upgrade to analyst" },
      { status: 500 }
    );
  }
}
