import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureRateLimit } from "@/lib/rateLimit";
import { sanitizeText, sanitizeUrl } from "@/lib/sanitize";
import { captureRouteError } from "@/lib/sentry";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      slug: true,
      role: true,
      avatarUrl: true,
      bio: true,
      socialLinks: true,
      createdAt: true,
      analystProfile: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await ensureRateLimit("default", request, session.user.id);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { displayName, bio, socialLinks } = body;

    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = sanitizeText(displayName);
    if (bio !== undefined) updateData.bio = sanitizeText(bio);
    if (socialLinks !== undefined && socialLinks && typeof socialLinks === "object") {
      // Each social link value must be a clean http(s) URL or null.
      const cleaned: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(socialLinks)) {
        cleaned[sanitizeText(k)] = typeof v === "string" ? sanitizeUrl(v) : null;
      }
      updateData.socialLinks = cleaned;
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        slug: true,
        role: true,
        avatarUrl: true,
        bio: true,
        socialLinks: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    captureRouteError(error, { route: "/api/users/me PATCH", userId: session.user.id });
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
