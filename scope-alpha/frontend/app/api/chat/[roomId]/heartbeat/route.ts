/**
 * POST /api/chat/[roomId]/heartbeat
 *
 * Refreshes the user's presence in the room. Sets two keys:
 *   chat:presence:{roomId}:{userId}  — TTL 60s, used by /presence enumeration
 *   chat:presence:user:{userId}      — TTL 60s, used for global "is online" check
 *
 * Called by the chat store every 10 seconds while a room is open.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setCached } from "@/lib/cache/redis";
import { canRead } from "@/lib/chat/moderation";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Banned users don't get presence — they can't see the room.
  const access = await canRead(params.roomId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ ok: false, code: "BANNED" }, { status: 403 });
  }

  await Promise.all([
    setCached(`chat:presence:${params.roomId}:${session.user.id}`, true, 60),
    setCached(
      `chat:presence:user:${session.user.id}`,
      { roomId: params.roomId, lastSeen: Date.now() },
      60,
    ),
  ]);

  return NextResponse.json({ ok: true });
}
