import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/reviews?analystId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const analystId = searchParams.get("analystId");

  if (!analystId) {
    return NextResponse.json({ error: "analystId required" }, { status: 400 });
  }

  const reviews = await prisma.review.findMany({
    where: { analystId },
    include: {
      author: {
        select: { id: true, displayName: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    reviews.map((r) => ({
      id: r.id,
      authorId: r.authorId,
      authorName: r.author.displayName || r.author.name || "Anonymous",
      analystId: r.analystId,
      rating: r.rating,
      content: r.content,
      analystResponse: r.analystResponse,
      subscriptionMonths: r.subscriptionMonths,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}

// POST /api/reviews — create review (subscriber only)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { analystId, rating, content } = body;

    if (!analystId || !rating || !content) {
      return NextResponse.json(
        { error: "analystId, rating, and content are required" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Can't review yourself
    if (analystId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot review yourself" },
        { status: 400 }
      );
    }

    // Check for existing review
    const existing = await prisma.review.findUnique({
      where: {
        authorId_analystId: {
          authorId: session.user.id,
          analystId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this analyst" },
        { status: 409 }
      );
    }

    const review = await prisma.review.create({
      data: {
        authorId: session.user.id,
        analystId,
        rating,
        content,
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json(
      { error: "Failed to create review" },
      { status: 500 }
    );
  }
}
