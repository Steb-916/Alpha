import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

async function loadOwned(id: string, userId: string) {
  const row = await prisma.alert.findUnique({ where: { id } });
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
    if (typeof body.asset === "string") updateData.asset = body.asset.toUpperCase();
    if (typeof body.type === "string") updateData.type = body.type;
    if (typeof body.condition === "string") updateData.condition = body.condition;
    if (typeof body.value === "number") updateData.value = body.value;
    if (typeof body.timeframe === "string" || body.timeframe === null)
      updateData.timeframe = body.timeframe;
    if (typeof body.isActive === "boolean") updateData.isActive = body.isActive;
    if (typeof body.deliveryMethod === "string")
      updateData.deliveryMethod = body.deliveryMethod;
    if (typeof body.notifyEmail === "boolean") updateData.notifyEmail = body.notifyEmail;
    if (typeof body.notifyTelegram === "boolean") updateData.notifyTelegram = body.notifyTelegram;

    const updated = await prisma.alert.update({
      where: { id: params.id },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch (error) {
    captureRouteError(error, {
      route: "/api/alerts/[id] PATCH",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to update alert" },
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
    await prisma.alert.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/alerts/[id] DELETE",
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Failed to delete alert" },
      { status: 500 },
    );
  }
}
