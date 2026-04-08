/**
 * Phase 7 input sanitization.
 *
 * Wraps `isomorphic-dompurify` (works in both server and edge runtimes
 * without needing jsdom). If the dependency is missing for any reason
 * (build pipeline issues, lockfile drift), all helpers fall back to a
 * regex-based tag strip so the build never crashes.
 *
 * Use these on every user-supplied string before persisting or rendering:
 *   - sanitizeText      → fully strip all HTML tags (display names, slugs, bios)
 *   - sanitizeRichText  → allow basic formatting (b/i/em/strong/a/br)
 *   - sanitizeUrl       → only http(s); reject javascript:, data:, file:
 *   - sanitizeObject    → recursive sanitizeText on every string value
 */

type Purify = {
  sanitize: (input: string, opts?: Record<string, unknown>) => string;
};

let _purify: Purify | null = null;
let _initTried = false;

function getPurify(): Purify | null {
  if (_initTried) return _purify;
  _initTried = true;
  try {
    // `eval('require')` prevents the Next.js bundler from statically
    // resolving `isomorphic-dompurify` at build time. The lookup happens
    // only at runtime; if the package isn't installed, this throws and we
    // fall through to the regex-strip fallback.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-eval
    const req = eval('require') as NodeJS.Require;
    const mod = req('isomorphic-dompurify');
    _purify = (mod && (mod.default || mod)) as Purify;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[sanitize] isomorphic-dompurify not available; falling back to regex strip.',
        (err as Error).message,
      );
    }
    _purify = null;
  }
  return _purify;
}

function regexStrip(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/** Strip ALL HTML tags. Use for plain-text fields (names, slugs, bios). */
export function sanitizeText(input: string | null | undefined): string {
  if (input == null) return '';
  const str = String(input);
  const p = getPurify();
  if (!p) return regexStrip(str).trim();
  try {
    return p.sanitize(str, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
  } catch {
    return regexStrip(str).trim();
  }
}

/** Allow a small set of formatting tags. Use for review/notes/announcement bodies. */
export function sanitizeRichText(input: string | null | undefined): string {
  if (input == null) return '';
  const str = String(input);
  const p = getPurify();
  if (!p) return regexStrip(str).trim();
  try {
    return p
      .sanitize(str, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'title', 'rel', 'target'],
      })
      .trim();
  } catch {
    return regexStrip(str).trim();
  }
}

/**
 * Validate and normalize a URL string. Returns the canonical href, or null
 * if the input isn't a valid http(s) URL. Rejects `javascript:`, `data:`,
 * `file:`, etc.
 */
export function sanitizeUrl(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Recursively sanitize all string values in a plain object. Returns a new object. */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((v) =>
        typeof v === 'string'
          ? sanitizeText(v)
          : v && typeof v === 'object'
            ? sanitizeObject(v as Record<string, unknown>)
            : v,
      );
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
