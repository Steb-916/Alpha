import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canPost, canRead, getMemberState } from "@/lib/chat/moderation";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeRichText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

// GET /api/chat/[roomId] — get messages for a room
//
// Phase 6 envelope shape:
//   { messages, readReceipts, moderation }
//
// - messages: array of chat messages (excludes hard `isDeleted` rows;
//   moderation soft-deletes via `deletedAt` are still returned with content
//   replaced client-side)
// - readReceipts: array of { userId, lastReadMessageId } for the room
// - moderation: the current viewer's role/mute/ban state
//
// Banned users get 403.
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Phase 6: banned users cannot read the room.
  const access = await canRead(params.roomId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: "You are banned from this room",
        code: "BANNED",
        moderation: {
          role: access.state.role,
          mutedUntil: access.state.mutedUntil?.toISOString() ?? null,
          bannedAt: access.state.bannedAt?.toISOString() ?? null,
        },
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {
    roomId: params.roomId,
    isDeleted: false,
  };
  if (before) {
    where.createdAt = { lt: new Date(before) };
  }

  const messages = await prisma.chatMessage.findMany({
    where,
    include: {
      author: {
        select: { id: true, displayName: true, name: true },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          author: { select: { displayName: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  // Return in chronological order with Phase 6 fields.
  const serialized = messages.reverse().map((m) => ({
    id: m.id,
    roomId: m.roomId,
    authorId: m.authorId,
    authorName: m.author.displayName || m.author.name || "Unknown",
    content: m.deletedAt ? "[Message deleted by analyst]" : m.content,
    replyToId: m.replyToId,
    replyToContent: m.replyTo?.content.slice(0, 80) || null,
    replyToAuthor:
      m.replyTo?.author.displayName || m.replyTo?.author.name || null,
    isPinned: m.isPinned,
    isDeleted: m.isDeleted,
    createdAt: m.createdAt.toISOString(),
    // Phase 6
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    deletedBy: m.deletedBy,
    messageType: m.messageType,
  }));

  // Read receipts for the room (cap at 50 most recent for safety).
  const readReceipts = await prisma.chatReadReceipt.findMany({
    where: { roomId: params.roomId },
    select: { userId: true, lastReadMessageId: true },
    orderBy: { lastReadAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    messages: serialized,
    readReceipts,
    moderation: {
      role: access.state.role,
      mutedUntil: access.state.mutedUntil?.toISOString() ?? null,
      bannedAt: access.state.bannedAt?.toISOString() ?? null,
    },
  });
}

// POST /api/chat/[roomId] — send a message
//
// Phase 6: gates on canPost (mute/ban). Accepts optional mediaUrl + mediaType.
export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("chat/message", request, session.user.id);
  if (limited) return limited;

  // Phase 6: enforce mute/ban.
  const access = await canPost(params.roomId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json(
      {
        error:
          access.reason === "BANNED"
            ? "You are banned from this room"
            : "You are muted in this room",
        code: access.reason,
        mutedUntil: access.state?.mutedUntil?.toISOString() ?? null,
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { content, replyToId, mediaUrl, mediaType } = body;

    if (!content || content.trim().length === 0) {
      // Allow empty content if media is attached, otherwise reject.
      if (!mediaUrl) {
        return NextResponse.json(
          { error: "Message content or media is required" },
          { status: 400 },
        );
      }
    }

    const sanitized = content ? sanitizeRichText(content) : "";

    const message = await prisma.chatMessage.create({
      data: {
        roomId: params.roomId,
        authorId: session.user.id,
        content: sanitized,
        replyToId: replyToId || null,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    captureRouteError(error, { route: "/api/chat/[roomId] POST", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
