import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFeedEvent } from "@/lib/feed/events";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText, sanitizeRichText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

// GET /api/announcements?analystId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get("analystId");

  if (!analystId) {
    return NextResponse.json({ error: "analystId required" }, { status: 400 });
  }

  const announcements = await prisma.announcement.findMany({
    where: { analystId },
    include: {
      analyst: {
        select: { displayName: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    announcements.map((a) => ({
      id: a.id,
      analystId: a.analystId,
      analystName: a.analyst.displayName || a.analyst.name,
      title: a.title,
      content: a.content,
      isPinned: a.isPinned,
      createdAt: a.createdAt.toISOString(),
    }))
  );
}

// POST /api/announcements — create announcement (analyst only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "analyst") {
    return NextResponse.json(
      { error: "Only analysts can create announcements" },
      { status: 403 }
    );
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const title = sanitizeText(body.title);
    const content = sanitizeRichText(body.content);

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    // Phase 6: announcement is created atomically alongside a chat-message
    // bridge entry so the announcement appears inline in the analyst's chat
    // room with the special `messageType='announcement'` styling.
    //
    // Room id convention: roomId === analystId (the analyst's user id).
    const truncated =
      content.length > 500 ? content.slice(0, 500).trimEnd() + "…" : content;

    const [announcement] = await prisma.$transaction([
      prisma.announcement.create({
        data: {
          analystId: session.user.id,
          title,
          content,
        },
      }),
      prisma.chatMessage.create({
        data: {
          roomId: session.user.id,
          authorId: session.user.id,
          content: `${title}\n\n${truncated}`,
          isPinned: true,
          messageType: "announcement",
        },
      }),
    ]);

    // Phase 6: emit a feed event (subscribers visibility).
    createFeedEvent({
      type: "announcement",
      actorId: session.user.id,
      analystId: session.user.id,
      metadata: { title, preview: truncated.slice(0, 200) },
      visibility: "subscribers",
    }).catch((err) => console.error("[announcements] feed event failed:", err));

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    captureRouteError(error, { route: "/api/announcements POST", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    );
  }
}
