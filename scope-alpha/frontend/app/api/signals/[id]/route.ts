import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/signals/[id] — update signal (limited fields: notes, status=cancelled)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
  });

  if (!signal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (signal.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { notes, status } = body;

    const updateData: Record<string, unknown> = {};

    // Notes can always be updated
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Status can only be set to 'cancelled' by the analyst
    if (status === "cancelled" && signal.status === "active") {
      updateData.status = "cancelled";
    }

    // IMMUTABILITY: entryPrice, targetPrice, stopLossPrice, direction, publishedAt
    // cannot be modified — reject any attempt
    if (body.entryPrice !== undefined || body.targetPrice !== undefined ||
        body.stopLossPrice !== undefined || body.direction !== undefined ||
        body.publishedAt !== undefined) {
      return NextResponse.json(
        { error: "Cannot modify immutable signal fields (entry, target, stop, direction, publishedAt)" },
        { status: 400 }
      );
    }

    const updated = await prisma.signal.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      entryPrice: Number(updated.entryPrice),
      targetPrice: Number(updated.targetPrice),
      stopLossPrice: Number(updated.stopLossPrice),
      resolvedPrice: updated.resolvedPrice ? Number(updated.resolvedPrice) : null,
      resultPnlPercent: updated.resultPnlPercent ? Number(updated.resultPnlPercent) : null,
    });
  } catch (error) {
    console.error("Update signal error:", error);
    return NextResponse.json(
      { error: "Failed to update signal" },
      { status: 500 }
    );
  }
}
