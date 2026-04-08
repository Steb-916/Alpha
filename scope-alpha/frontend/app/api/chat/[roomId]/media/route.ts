/**
 * POST /api/chat/[roomId]/media
 *
 * Multipart upload of an image to be embedded in a chat message.
 * Reuses the Phase 4 R2 storage helper. Inert when R2 isn't configured →
 * returns 503 with code 'STORAGE_DISABLED'.
 *
 * Validates:
 *   - User can post in this room (canPost — checks mute/ban)
 *   - File type is png/jpeg/webp
 *   - File size ≤ 2MB
 *
 * Returns: { url, type }
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canPost } from "@/lib/chat/moderation";
import { isStorageConfigured, uploadScreenshot } from "@/lib/storage/r2";
import { ensureRateLimit } from "@/lib/rateLimit";
import { captureRouteError } from "@/lib/sentry";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Inert mode short-circuit. UI checks for this code and disables the
  // paperclip button.
  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error: "Media sharing not configured",
        code: "STORAGE_DISABLED",
      },
      { status: 503 },
    );
  }

  // Mute/ban gate.
  const access = await canPost(params.roomId, session.user.id);
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: access.reason === "BANNED" ? "You are banned" : "You are muted",
        code: access.reason,
      },
      { status: 403 },
    );
  }

  // Rate limit (Phase 7: Upstash-backed via shared config).
  const limited = await ensureRateLimit("chat/media", request, session.user.id);
  if (limited) return limited;

  // Parse multipart body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: `Unsupported content type: ${file.type}` },
      { status: 400 },
    );
  }

  let url: string | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext =
      file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
    const key = `chat-media/${params.roomId}/${session.user.id}-${Date.now()}.${ext}`;
    url = await uploadScreenshot(buffer, key, file.type);
  } catch (err) {
    captureRouteError(err, { route: "/api/chat/[roomId]/media", userId: session.user.id });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  if (!url) {
    return NextResponse.json(
      { error: "Media sharing not configured", code: "STORAGE_DISABLED" },
      { status: 503 },
    );
  }

  return NextResponse.json({ url, type: file.type });
}
