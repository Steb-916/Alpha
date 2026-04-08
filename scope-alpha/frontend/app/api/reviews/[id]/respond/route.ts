import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeRichText } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

// POST /api/reviews/[id]/respond — analyst responds to a review
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  const review = await prisma.review.findUnique({
    where: { id: params.id },
  });

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Only the reviewed analyst can respond
  if (review.analystId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const response = sanitizeRichText(body.response);

    if (!response || response.length === 0) {
      return NextResponse.json(
        { error: "Response content is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.review.update({
      where: { id: params.id },
      data: { analystResponse: response },
    });

    return NextResponse.json(updated);
  } catch (error) {
    captureRouteError(error, { route: "/api/reviews/[id]/respond", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to respond to review" },
      { status: 500 }
    );
  }
}
