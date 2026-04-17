import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let prefs = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });
    if (!prefs) {
      prefs = await prisma.userPreferences.create({
        data: { userId: session.user.id },
      });
    }
    return NextResponse.json(prefs);
  } catch (error) {
    captureRouteError(error, {
      route: "/api/users/preferences GET",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to load preferences" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (typeof body.defaultAsset === "string")
      updateData.defaultAsset = body.defaultAsset;
    if (typeof body.defaultTimeframe === "string")
      updateData.defaultTimeframe = body.defaultTimeframe;
    if (typeof body.theme === "string") updateData.theme = body.theme;
    if (body.savedLayouts !== undefined)
      updateData.savedLayouts = body.savedLayouts;

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...updateData },
      update: updateData,
    });

    return NextResponse.json(prefs);
  } catch (error) {
    captureRouteError(error, {
      route: "/api/users/preferences PATCH",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}
