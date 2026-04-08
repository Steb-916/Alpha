/**
 * Cloudflare R2 / S3-compatible storage wrapper.
 *
 * INERT MODE
 * ----------
 * Phase 4 ships this helper as a stub when R2 environment variables aren't
 * set. The screenshot upload route returns 503 in that case so the UI can
 * render a "Chart screenshots coming soon" message instead of crashing.
 *
 * To enable: set R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, and
 * R2_PUBLIC_URL in the environment. The next request will lazy-init the
 * S3Client and start uploading for real.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let _client: S3Client | null = null;
let _initTried = false;

function getClient(): S3Client | null {
  if (_initTried) return _client;
  _initTried = true;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY;
  const secretAccessKey = process.env.R2_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[storage/r2] R2 env vars not set; screenshot uploads are disabled. ' +
          'Set R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_URL to enable.',
      );
    }
    return null;
  }

  try {
    _client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  } catch (err) {
    console.error('[storage/r2] Failed to init S3 client:', err);
    _client = null;
  }
  return _client;
}

/**
 * Upload a screenshot buffer. Returns the public URL on success or `null`
 * if R2 is not configured. Throws on actual upload failure (so the route
 * can return a 5xx).
 */
export async function uploadScreenshot(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    console.warn('[storage/r2] R2_BUCKET or R2_PUBLIC_URL missing; cannot upload.');
    return null;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  // Strip any trailing slash from the public URL prefix.
  const base = publicUrl.replace(/\/+$/, '');
  return `${base}/${key}`;
}

/** Cheap, no-side-effects probe used by the UI to render the inert state. */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY &&
      process.env.R2_SECRET_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL,
  );
}
