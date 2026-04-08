import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

// PATCH /api/annotations/[id] — update annotation
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  const annotation = await prisma.annotation.findUnique({
    where: { id: params.id },
  });

  if (!annotation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (annotation.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { data, isActive, isDraft } = body;

    const updateData: Record<string, unknown> = {};
    if (data !== undefined) updateData.data = data;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isDraft !== undefined) updateData.isDraft = isDraft;

    const updated = await prisma.annotation.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    captureRouteError(error, { route: "/api/annotations/[id] PATCH", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to update annotation" },
      { status: 500 }
    );
  }
}

// DELETE /api/annotations/[id] — delete annotation
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  const annotation = await prisma.annotation.findUnique({
    where: { id: params.id },
  });

  if (!annotation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (annotation.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.annotation.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
