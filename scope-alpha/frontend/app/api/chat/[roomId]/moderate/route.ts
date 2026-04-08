/**
 * POST /api/chat/[roomId]/moderate
 *
 * Analyst-only moderation actions for a room.
 *
 * Body:
 *   {
 *     action: 'mute' | 'unmute' | 'ban' | 'unban' | 'delete_message',
 *     targetUserId?: string,    // for mute/unmute/ban/unban
 *     messageId?: string,       // for delete_message
 *     duration?: number,        // mute duration in hours; null = permanent
 *     reason?: string
 *   }
 *
 * Auth: only the room owner (where roomId === session.user.id) can moderate.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRoomOwner } from "@/lib/chat/moderation";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

type Action = "mute" | "unmute" | "ban" | "unban" | "delete_message";

interface ModerateBody {
  action?: Action;
  targetUserId?: string;
  messageId?: string;
  duration?: number | null;
  reason?: string;
}

const VALID_ACTIONS: Action[] = [
  "mute",
  "unmute",
  "ban",
  "unban",
  "delete_message",
];

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isRoomOwner(params.roomId, session.user.id)) {
    return NextResponse.json(
      { error: "Only the room owner can moderate" },
      { status: 403 },
    );
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  let body: ModerateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action || !VALID_ACTIONS.includes(body.action)) {
    return NextResponse.json(
      { error: `action must be one of ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  // ─── delete_message ─────────────────────────────────────────────────────
  if (body.action === "delete_message") {
    if (!body.messageId) {
      return NextResponse.json(
        { error: "messageId is required for delete_message" },
        { status: 400 },
      );
    }
    const msg = await prisma.chatMessage.findUnique({
      where: { id: body.messageId },
      select: { id: true, roomId: true },
    });
    if (!msg || msg.roomId !== params.roomId) {
      return NextResponse.json(
        { error: "Message not found in this room" },
        { status: 404 },
      );
    }
    await prisma.chatMessage.update({
      where: { id: msg.id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
      },
    });
    return NextResponse.json({ ok: true });
  }

  // ─── mute / unmute / ban / unban ────────────────────────────────────────
  if (!body.targetUserId) {
    return NextResponse.json(
      { error: "targetUserId is required" },
      { status: 400 },
    );
  }

  // Owners cannot moderate themselves.
  if (body.targetUserId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot moderate yourself" },
      { status: 400 },
    );
  }

  if (body.action === "mute") {
    const mutedUntil =
      body.duration && Number.isFinite(body.duration)
        ? new Date(Date.now() + body.duration * 60 * 60 * 1000)
        : null;
    await prisma.chatRoomMember.upsert({
      where: {
        roomId_userId: { roomId: params.roomId, userId: body.targetUserId },
      },
      create: {
        roomId: params.roomId,
        userId: body.targetUserId,
        role: "muted",
        mutedAt: new Date(),
        mutedUntil,
        reason: body.reason ? sanitizeText(body.reason) : null,
      },
      update: {
        role: "muted",
        mutedAt: new Date(),
        mutedUntil,
        reason: body.reason ? sanitizeText(body.reason) : null,
        bannedAt: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unmute") {
    await prisma.chatRoomMember.upsert({
      where: {
        roomId_userId: { roomId: params.roomId, userId: body.targetUserId },
      },
      create: {
        roomId: params.roomId,
        userId: body.targetUserId,
        role: "member",
      },
      update: {
        role: "member",
        mutedAt: null,
        mutedUntil: null,
        reason: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "ban") {
    await prisma.chatRoomMember.upsert({
      where: {
        roomId_userId: { roomId: params.roomId, userId: body.targetUserId },
      },
      create: {
        roomId: params.roomId,
        userId: body.targetUserId,
        role: "banned",
        bannedAt: new Date(),
        reason: body.reason ? sanitizeText(body.reason) : null,
      },
      update: {
        role: "banned",
        bannedAt: new Date(),
        reason: body.reason ? sanitizeText(body.reason) : null,
        mutedAt: null,
        mutedUntil: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unban") {
    await prisma.chatRoomMember.upsert({
      where: {
        roomId_userId: { roomId: params.roomId, userId: body.targetUserId },
      },
      create: {
        roomId: params.roomId,
        userId: body.targetUserId,
        role: "member",
      },
      update: {
        role: "member",
        bannedAt: null,
        reason: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
