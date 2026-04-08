/**
 * GET /api/chat/[roomId]/presence
 *
 * Returns currently-online and currently-typing users in a room.
 *
 * Reads from Upstash via scanKeys('chat:presence:{roomId}:') and
 * scanKeys('chat:typing:{roomId}:'), then batch-resolves the user IDs to
 * display data via a single Prisma query.
 *
 * The current user is filtered OUT of the typing list (you don't want to
 * see "you are typing").
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanKeys } from "@/lib/cache/redis";
import { canRead } from "@/lib/chat/moderation";

export const runtime = "nodejs";

function extractUserId(key: string, prefix: string): string | null {
  if (!key.startsWith(prefix)) return null;
  return key.slice(prefix.length);
}

export async function GET(
  _request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await canRead(params.roomId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ online: [], typing: [] }, { status: 403 });
  }

  const presencePrefix = `chat:presence:${params.roomId}:`;
  const typingPrefix = `chat:typing:${params.roomId}:`;

  const [presenceKeys, typingKeys] = await Promise.all([
    scanKeys(presencePrefix),
    scanKeys(typingPrefix),
  ]);

  const onlineIds = presenceKeys
    .map((k) => extractUserId(k, presencePrefix))
    .filter((id): id is string => !!id);

  // Filter out the current user from the typing list.
  const typingIds = typingKeys
    .map((k) => extractUserId(k, typingPrefix))
    .filter((id): id is string => !!id && id !== session.user.id);

  // Batch-resolve user details for both lists in one query.
  const allIds = Array.from(new Set([...onlineIds, ...typingIds]));
  const users =
    allIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: allIds } },
          select: {
            id: true,
            displayName: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        });

  const userMap = new Map(
    users.map((u) => [
      u.id,
      {
        userId: u.id,
        displayName: u.displayName || u.name || u.email.split("@")[0] || "Unknown",
        avatarUrl: u.avatarUrl,
      },
    ]),
  );

  return NextResponse.json({
    online: onlineIds.map((id) => userMap.get(id)).filter(Boolean),
    typing: typingIds.map((id) => userMap.get(id)).filter(Boolean),
  });
}
