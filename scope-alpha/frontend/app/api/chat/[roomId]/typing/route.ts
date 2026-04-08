/**
 * POST /api/chat/[roomId]/typing
 *
 * Sets a short-lived Upstash key (5 second TTL) signaling the current user
 * is actively typing in the room. The key auto-expires when the user stops.
 *
 * Called by ChatInput debounced ~every 3 seconds while typing.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setCached } from "@/lib/cache/redis";
import { canPost } from "@/lib/chat/moderation";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Don't show typing indicators for muted/banned users — they can't post
  // anyway, so showing "X is typing" is misleading.
  const access = await canPost(params.roomId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json({ ok: false, code: access.reason }, { status: 403 });
  }

  await setCached(`chat:typing:${params.roomId}:${session.user.id}`, true, 5);
  return NextResponse.json({ ok: true });
}
