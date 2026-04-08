/**
 * GET /api/analysts/[slug]/followers
 *
 * Public follower count for an analyst.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const analyst = await prisma.user.findUnique({
    where: { slug: params.slug },
    select: { id: true, role: true },
  });
  if (!analyst || analyst.role !== "analyst") {
    return NextResponse.json({ error: "Analyst not found" }, { status: 404 });
  }

  const followerCount = await prisma.follow.count({
    where: { analystId: analyst.id },
  });

  return NextResponse.json({ followerCount });
}
