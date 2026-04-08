/**
 * POST /api/signals/[id]/screenshot
 *
 * multipart/form-data upload. Validates type/size, uploads to R2, then
 * patches the signal's screenshotUrl.
 *
 * Returns 503 with { code: 'STORAGE_DISABLED' } when R2 isn't configured.
 * The UI handles this by showing the inert state.
 *
 * Rate limit: 10 uploads / hour / analyst.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  ALLOWED_SCREENSHOT_TYPES,
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_UPLOAD_LIMIT_PER_HOUR,
} from '@/config/signals';
import { isStorageConfigured, uploadScreenshot } from '@/lib/storage/r2';
import { ensureRateLimit } from '@/lib/rateLimit';
import { serializeSignal } from '@/lib/signals/serializer';
import { captureRouteError } from '@/lib/sentry';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Inert mode short-circuit. UI checks for this code and shows the
  // "Chart screenshots coming soon" message instead of erroring.
  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error: 'Screenshot storage not configured',
        code: 'STORAGE_DISABLED',
      },
      { status: 503 },
    );
  }

  // Verify ownership.
  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    select: { id: true, analystId: true },
  });
  if (!signal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (signal.analystId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limit (Phase 7: Upstash-backed via shared config).
  const limited = await ensureRateLimit('signals/screenshot', request, session.user.id);
  if (limited) return limited;

  // Parse multipart body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }

  // Validate.
  if (file.size > MAX_SCREENSHOT_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SCREENSHOT_BYTES / 1024 / 1024} MB)` },
      { status: 400 },
    );
  }
  if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type as never)) {
    return NextResponse.json(
      { error: `Unsupported content type: ${file.type}` },
      { status: 400 },
    );
  }

  // Upload.
  let url: string | null = null;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png';
    const key = `screenshots/${signal.id}-${Date.now()}.${ext}`;
    url = await uploadScreenshot(buffer, key, file.type);
  } catch (err) {
    captureRouteError(err, { route: '/api/signals/[id]/screenshot', userId: session.user.id });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  if (!url) {
    // Storage was probed-configured but uploadScreenshot returned null
    // (env var was unset between checks). Treat as the inert state.
    return NextResponse.json(
      { error: 'Screenshot storage not configured', code: 'STORAGE_DISABLED' },
      { status: 503 },
    );
  }

  // Persist.
  const updated = await prisma.signal.update({
    where: { id: signal.id },
    data: { screenshotUrl: url },
    include: { targets: { orderBy: { order: 'asc' } } },
  });

  return NextResponse.json({ url, signal: serializeSignal(updated) });
}
