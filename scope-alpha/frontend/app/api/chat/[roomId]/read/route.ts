/**
 * POST /api/chat/[roomId]/read
 *
 * Upserts the read receipt for the current user in this room.
 * Body: { lastMessageId }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRead } from "@/lib/chat/moderation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canRead(params.roomId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ ok: false, code: "BANNED" }, { status: 403 });
  }

  let body: { lastMessageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.lastMessageId || typeof body.lastMessageId !== "string") {
    return NextResponse.json(
      { error: "lastMessageId is required" },
      { status: 400 },
    );
  }

  await prisma.chatReadReceipt.upsert({
    where: {
      roomId_userId: {
        roomId: params.roomId,
        userId: session.user.id,
      },
    },
    create: {
      roomId: params.roomId,
      userId: session.user.id,
      lastReadMessageId: body.lastMessageId,
    },
    update: {
      lastReadMessageId: body.lastMessageId,
      lastReadAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
