import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  try {
    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.create({
      data: {
        analystId: session.user.id,
        title,
        content,
      },
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    console.error("Create announcement error:", error);
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    );
  }
}
