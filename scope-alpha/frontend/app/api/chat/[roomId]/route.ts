import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/chat/[roomId] — get messages for a room
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before"); // cursor for pagination
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

  // Return in chronological order
  const serialized = messages.reverse().map((m) => ({
    id: m.id,
    roomId: m.roomId,
    authorId: m.authorId,
    authorName: m.author.displayName || m.author.name || "Unknown",
    content: m.content,
    replyToId: m.replyToId,
    replyToContent: m.replyTo?.content.slice(0, 80) || null,
    replyToAuthor:
      m.replyTo?.author.displayName || m.replyTo?.author.name || null,
    isPinned: m.isPinned,
    isDeleted: m.isDeleted,
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json(serialized);
}

// POST /api/chat/[roomId] — send a message
export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { content, replyToId } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId: params.roomId,
        authorId: session.user.id,
        content: content.trim(),
        replyToId: replyToId || null,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
