# PRD: Phase 7 — Platform Hardening

**Version:** 1.0
**Date:** April 7, 2026
**Status:** Ready for Implementation (critical: 7A + 7D must land before public launch)
**Priority:** Critical — this phase is the gate between "alpha demo" and "product people pay for"
**Depends On:** Phases 1–6 (all features built), but 7A and 7D can begin in parallel with later phases

---

## 1. Context

### Why This Phase Matters

Everything built in Phases 1–6 assumes a friendly testing environment. Before real users sign up, pay money, and publish signals with legal implications, the platform needs:

- **Security** that actually withstands abuse (rate limiting, input sanitization, session control, password reset)
- **Performance** that holds under real load (query optimization, caching, code splitting)
- **Observability** so you know when something breaks before users report it (error tracking, logging, monitoring)
- **Legal scaffolding** that protects the platform from liability (ToS, disclaimers, data rights, analyst agreements)

The roadmap explicitly calls out **7A (security) and 7D (legal) as pre-launch blockers**. 7B (performance) and 7C (monitoring) are important but can ship incrementally after initial launch.

### Current State

**Security:**
- Auth via NextAuth (email/password with bcrypt, Google OAuth, demo mode)
- JWT sessions with 30-day expiration
- Role-based access control on API routes (subscriber vs. analyst)
- `lib/rateLimit.ts` exists but is only applied to a few routes (screenshot upload, review voting)
- No CSRF protection on mutations
- No input sanitization audit
- No password reset flow
- No session management (can't view/revoke active sessions)
- No forced logout capability

**Performance:**
- Prisma queries largely un-optimized (no composite indexes beyond schema defaults)
- Phase 1 market data caching in Upstash helps, but analytics routes (breakdown, rolling, journal) query raw and compute on every request
- No lazy loading or code splitting audit
- No image optimization pipeline (avatars are placeholder URLs)
- No Lighthouse audit

**Monitoring:**
- `console.error` in catch blocks is the only error handling
- No structured logging
- No error tracking service
- No uptime monitoring
- No alerting

**Legal:**
- No Terms of Service page
- No Privacy Policy page
- No signal disclaimer anywhere
- No analyst agreement for publishing terms
- No data export or account deletion capability
- Legal risk discussion from March explored these gaps but nothing was implemented

---

## 2. Goals

After this phase is complete:

1. Every API mutation endpoint is rate-limited (per-user and global)
2. All user inputs are sanitized against XSS and injection
3. Users can reset their password via email
4. Users can view and revoke active sessions
5. Database queries have proper indexes for all common access patterns
6. Expensive queries are cached with appropriate TTLs
7. Frontend loads are optimized (code splitting, lazy loading, image optimization)
8. All errors are tracked in Sentry with structured context
9. API routes emit structured logs for debugging and audit
10. Uptime and key metric monitoring are in place
11. Terms of Service and Privacy Policy are published
12. Every signal view includes a "not financial advice" disclaimer
13. Analysts must accept a publishing agreement before creating signals
14. Users can export their data and delete their account

---

## 3. Sub-Phase 7A — Security & Auth Hardening

### Objective

Close all security gaps before real users and real money flow through the platform.

### 3.1 Rate Limiting on All API Endpoints

The existing `lib/rateLimit.ts` provides basic per-key rate limiting. Extend it to cover every mutation endpoint and apply sensible defaults.

**Create:** `config/rateLimits.ts`

```typescript
export const RATE_LIMITS = {
  // Auth
  'auth/signup':            { window: 3600, max: 10 },     // 10 signups/hr per IP
  'auth/login':             { window: 300,  max: 20 },     // 20 attempts/5min per IP
  'auth/password-reset':    { window: 3600, max: 5 },      // 5 resets/hr per email
  'auth/verify-email':      { window: 300,  max: 3 },      // 3 resends/5min per user

  // Signals
  'signals/create':         { window: 3600, max: 50 },     // 50 signals/hr per analyst
  'signals/resolve':        { window: 3600, max: 50 },     // 50 resolutions/hr per analyst
  'signals/screenshot':     { window: 3600, max: 10 },     // 10 uploads/hr per analyst

  // Subscriptions
  'subscriptions/checkout': { window: 3600, max: 20 },     // 20 checkout attempts/hr per user
  'subscriptions/cancel':   { window: 3600, max: 10 },     // 10 cancellations/hr per user

  // Social
  'follow':                 { window: 3600, max: 60 },     // 60 follows/hr per user
  'like':                   { window: 3600, max: 120 },    // 120 likes/hr per user
  'bookmark':               { window: 3600, max: 120 },    // 120 bookmarks/hr per user
  'review/create':          { window: 86400, max: 10 },    // 10 reviews/day per user
  'review/vote':            { window: 3600, max: 20 },     // 20 votes/hr per user

  // Chat
  'chat/message':           { window: 60,   max: 30 },     // 30 messages/min per user
  'chat/media':             { window: 3600, max: 10 },     // 10 uploads/hr per user

  // Portfolio
  'portfolio/track':        { window: 3600, max: 60 },     // 60 tracks/hr per user
  'portfolio/close':        { window: 3600, max: 60 },     // 60 closes/hr per user

  // Global fallback
  'default':                { window: 60,   max: 60 },     // 60 req/min per user for unlisted routes
} as const;
```

**Modify:** `lib/rateLimit.ts`

Upgrade the existing implementation:
```typescript
import { Redis } from '@upstash/redis';
import { RATE_LIMITS } from '@/config/rateLimits';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;         // Unix timestamp
}

export async function checkRateLimit(
  key: string,             // e.g., "signals/create"
  identifier: string       // userId or IP address
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[key] ?? RATE_LIMITS['default'];
  const redisKey = `ratelimit:${key}:${identifier}`;

  const current = await redis.incr(redisKey);
  if (current === 1) {
    await redis.expire(redisKey, config.window);
  }

  const ttl = await redis.ttl(redisKey);

  return {
    allowed: current <= config.max,
    remaining: Math.max(0, config.max - current),
    resetAt: Math.floor(Date.now() / 1000) + ttl,
  };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: 'Too many requests', retryAfter: result.resetAt - Math.floor(Date.now() / 1000) },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
        'Retry-After': String(result.resetAt - Math.floor(Date.now() / 1000)),
      },
    }
  );
}
```

**Create:** `lib/middleware/withRateLimit.ts`

A reusable wrapper for route handlers:
```typescript
export function withRateLimit(key: string, handler: RouteHandler): RouteHandler {
  return async (request: Request, context: any) => {
    const session = await getServerSession(authOptions);
    const identifier = session?.user?.id ?? getClientIP(request);

    const result = await checkRateLimit(key, identifier);
    if (!result.allowed) return rateLimitResponse(result);

    return handler(request, context);
  };
}
```

**Apply to all mutation routes:** Wrap every POST/PUT/PATCH/DELETE handler with `withRateLimit`. For GET endpoints that are expensive (screener, feed, search), apply a lighter limit to prevent scraping.

### 3.2 Input Sanitization

**Create:** `lib/sanitize.ts`

```typescript
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Strip all HTML tags — for fields that should be plain text
export function sanitizeText(input: string): string {
  return purify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
}

// Allow basic formatting — for fields like reviews or notes
export function sanitizeRichText(input: string): string {
  return purify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
    ALLOWED_ATTR: ['href'],
  }).trim();
}

// Validate and sanitize URL inputs
export function sanitizeUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Generic object sanitizer — recursively sanitize all string values
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sanitizeObject(value);
    }
  }
  return result;
}
```

**Audit and apply:**

Go through every API route that accepts user input and apply sanitization:

| Input Type | Sanitizer | Examples |
|-----------|-----------|---------|
| Display names, slugs, bios | `sanitizeText` | User profile, analyst profile |
| Signal notes, review text, chat messages, announcements | `sanitizeRichText` | Signal creation, reviews, chat |
| URLs (social links, avatar URLs) | `sanitizeUrl` | User profile social links |
| Numeric inputs | Existing validation (parseFloat + range check) | Prices, percentages |
| JSON fields (metadata, template targets) | `sanitizeObject` | Signal templates, feed event metadata |

**SQL injection:** Prisma's parameterized queries already prevent SQL injection. Verify no route uses `prisma.$queryRaw` with string interpolation — if any exist, convert to parameterized queries.

### 3.3 Password Reset Flow

**Schema change:**

```prisma
model User {
  // ... existing fields ...
  passwordResetToken   String?   @unique
  passwordResetExpiry  DateTime?
}
```

**Route:** `POST /api/auth/forgot-password`

No auth required. Body: `{ email }`.

1. Rate limit: `auth/password-reset` (5/hr per email)
2. Look up user by email. If not found, return success anyway (don't reveal whether the email exists)
3. Generate token: `crypto.randomUUID()`
4. Save token + expiry (1 hour) to user record
5. Send password reset email via Resend (Phase 3 infrastructure) with link: `{baseUrl}/reset-password?token={token}`
6. Return `{ success: true }`

**Route:** `POST /api/auth/reset-password`

No auth required. Body: `{ token, newPassword }`.

1. Look up user by `passwordResetToken`
2. Verify token hasn't expired
3. Validate password strength (minimum 8 chars, at least one number)
4. Hash new password with bcrypt
5. Update user: `passwordHash = hash`, clear token fields
6. Invalidate all existing sessions for this user (see 3.4)
7. Return `{ success: true }`

**Frontend:**

Create: `app/forgot-password/page.tsx` — email input form
Create: `app/reset-password/page.tsx` — new password form (reads token from URL)

Create: `lib/email/templates/PasswordResetEmail.tsx` — email template with reset link and 1-hour expiry notice

Add "Forgot password?" link on the login page.

### 3.4 Session Management

**Schema change:**

```prisma
model Session {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token       String   @unique         // JWT jti claim
  userAgent   String?                  // Browser/device info
  ipAddress   String?
  lastActive  DateTime @default(now())
  createdAt   DateTime @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?                // null = active, set = revoked

  @@index([userId])
  @@index([token])
}
```

**How it works with NextAuth JWT strategy:**

NextAuth with JWT doesn't track sessions server-side by default. To add session management:

1. **On login:** Create a `Session` record with a unique `jti` (JWT ID) embedded in the JWT token
2. **On every authenticated request:** The auth middleware checks that the `Session` record exists and `revokedAt` is null
3. **On revoke:** Set `revokedAt` on the Session record — the next request using that JWT will fail auth
4. **On password reset:** Revoke all sessions for the user

**Modify NextAuth configuration:**

```typescript
// In authOptions JWT callbacks
callbacks: {
  jwt: async ({ token, user }) => {
    if (user) {
      // Login — create session record
      const session = await prisma.session.create({
        data: {
          userId: user.id,
          token: crypto.randomUUID(), // jti
          userAgent: /* from request headers */,
          ipAddress: /* from request headers */,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      });
      token.jti = session.token;
    }
    return token;
  },
  session: async ({ session, token }) => {
    // Verify session is still valid
    const dbSession = await prisma.session.findUnique({
      where: { token: token.jti },
    });
    if (!dbSession || dbSession.revokedAt) {
      throw new Error('Session revoked');
    }
    // Update lastActive
    await prisma.session.update({
      where: { token: token.jti },
      data: { lastActive: new Date() },
    });
    return session;
  },
}
```

**API routes:**

`GET /api/auth/sessions` — list active sessions for current user:
```typescript
interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;    // Is this the session making the request?
}
```

`DELETE /api/auth/sessions/[id]` — revoke a specific session (set `revokedAt`).

`DELETE /api/auth/sessions` — revoke all sessions except the current one (forced logout everywhere else).

**Frontend:**

Create: `app/settings/sessions/page.tsx`

- List of active sessions showing device/browser info, IP, last active time
- "This device" badge on the current session
- "Revoke" button per session
- "Log out everywhere else" button

### 3.5 CSRF Protection

Next.js App Router with server actions handles CSRF implicitly for server actions. For REST API routes:

**Approach — Origin/Referer header validation:**

Create: `lib/middleware/withCsrf.ts`

```typescript
export function withCsrf(handler: RouteHandler): RouteHandler {
  return async (request: Request, context: any) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      const host = request.headers.get('host');

      const allowedOrigins = [
        `https://${host}`,
        `http://localhost:3000`, // dev
        process.env.NEXTAUTH_URL,
      ].filter(Boolean);

      const requestOrigin = origin || (referer ? new URL(referer).origin : null);

      if (!requestOrigin || !allowedOrigins.some(o => requestOrigin.startsWith(o!))) {
        return Response.json({ error: 'CSRF validation failed' }, { status: 403 });
      }
    }

    return handler(request, context);
  };
}
```

**Exempt from CSRF:** Stripe webhook endpoint (uses its own signature verification), Telegram webhook (uses its own secret token).

---

## 4. Sub-Phase 7B — Performance & Scalability

### Objective

Optimize database queries, caching, and frontend loading for production-level performance.

### 4.1 Database Index Audit

Review all Prisma queries across the codebase and add composite indexes for common access patterns:

```prisma
// Signals — queried by analyst + status + date constantly
model Signal {
  @@index([analystId, status, publishedAt])    // Already exists from Phase 4
  @@index([analystId, status, resolvedAt])     // For journal queries
  @@index([assetSymbol, status])               // For screener / asset-based queries
}

// Subscriptions — queried on every gated request
model Subscription {
  @@index([subscriberId, analystId, status])   // For checkSubscriptionAccess
  @@index([analystId, status])                 // For subscriber count / list
}

// Feed events — chronological feed queries
model FeedEvent {
  @@index([createdAt, id])                     // Cursor pagination
  @@index([analystId, createdAt, id])          // Per-analyst feed
}

// Chat messages — room-based pagination
model ChatMessage {
  @@index([roomId, createdAt, id])             // Cursor pagination in room
}

// Tracked signals — portfolio queries
model TrackedSignal {
  @@index([subscriberId, status, takenAt])     // Portfolio listing
}

// Notifications — unread count
model Notification {
  @@index([userId, read, createdAt])           // Already exists from Phase 3
}
```

Run `EXPLAIN ANALYZE` on the top 10 most frequent queries (from structured logs in 7C) and add any missing indexes.

### 4.2 API Response Caching Audit

Review all API routes and ensure expensive computations are cached:

| Route | Current Cache | Target Cache | TTL |
|-------|-------------|-------------|-----|
| `/api/market/screener` | ✅ 30s (Phase 1) | No change | 30s |
| `/api/market/funding` | ✅ 60s (Phase 1) | No change | 60s |
| `/api/analysts/trending` | ✅ 30min (Phase 5) | No change | 30min |
| `/api/analysts/compare` | ✅ 5min (Phase 5) | No change | 5min |
| `/api/analysts` (marketplace listing) | ❌ None | Add 60s cache | 60s |
| `/api/feed` (global) | ✅ 60s (Phase 6) | No change | 60s |
| `/api/analysts/[slug]` (profile) | ❌ None | Add 5min cache | 5min |
| `/api/analysts/[slug]/performance/breakdown` | ✅ 5min (Phase 4) | No change | 5min |
| `/api/analysts/[slug]/performance/rolling` | ✅ 5min (Phase 4) | No change | 5min |

Add caching to the two missing routes using the existing `withCacheAndStale` pattern.

### 4.3 Image/Avatar Upload

Currently avatars are placeholder URLs or null. Add real avatar upload:

**Route:** `POST /api/users/avatar`

Auth: Logged in.

1. Accept `multipart/form-data` with image file
2. Validate: max 1MB, PNG/JPEG/WebP, minimum 100x100px
3. Resize to 256x256 using sharp (or accept as-is if exact tooling is too heavy)
4. Upload to R2 via existing `lib/storage/r2.ts` with key: `avatars/{userId}.{ext}`
5. Update `user.avatarUrl`
6. Return `{ url }`

Install: `npm install sharp` (if resizing is needed; otherwise skip and accept any size ≤ 1MB)

**Frontend:** Add avatar upload to the profile settings page (click on current avatar → file picker → crop/preview → upload).

### 4.4 Frontend Performance Audit

**Lazy loading:**
- Audit all page-level imports for heavy components (charting, analytics, chat)
- Wrap non-critical components with `dynamic(() => import(...), { ssr: false })`:
  - `PriceChart` (Lightweight Charts is heavy — lazy load on terminal pages only)
  - `DrawdownChart`, `BreakdownBarChart`, `PortfolioEquityCurve` (SVG charts)
  - `ChatRoom` (only needed when drawer is open)
  - `SignalCreationOverlay` (only needed in creation mode)

**Code splitting:**
- Verify Next.js automatic code splitting is working (each page gets its own bundle)
- Check for large shared dependencies pulled into the main bundle unnecessarily
- Move analytics-only code (`lib/analytics/*`) behind dynamic imports since it's only used on analyst pages

**Image optimization:**
- Use Next.js `<Image>` component for all avatar and screenshot rendering (automatic optimization, lazy loading, WebP conversion)
- Set explicit `width`/`height` on all images to prevent layout shift

**Bundle analysis:**
```bash
npm install --save-dev @next/bundle-analyzer
ANALYZE=true npm run build
```
Review the bundle visualization and address any dependency that's unexpectedly large.

### 4.5 Lighthouse Audit

Run Lighthouse on:
- `/` (landing/homepage)
- `/marketplace` (analyst listing)
- `/terminal` (main trading dashboard)
- `/analyst/[slug]` (analyst profile)
- `/portfolio` (subscriber dashboard)

Target scores:
- Performance: ≥ 80
- Accessibility: ≥ 90
- Best Practices: ≥ 90
- SEO: ≥ 90

Common fixes:
- Add missing `alt` text on images
- Ensure color contrast ratios meet WCAG AA
- Add proper heading hierarchy (h1 → h2 → h3)
- Compress/optimize any unoptimized images
- Ensure fonts have `font-display: swap`

---

## 5. Sub-Phase 7C — Monitoring & Error Handling

### Objective

Add observability so you know what's happening in production before users report issues.

### 5.1 Sentry Integration

Install: `npm install @sentry/nextjs`

Run: `npx @sentry/wizard@latest -i nextjs`

This scaffolds:
- `sentry.client.config.ts` — client-side error tracking
- `sentry.server.config.ts` — server-side error tracking
- `sentry.edge.config.ts` — edge runtime tracking
- `instrumentation.ts` — Next.js instrumentation hook
- Updated `next.config.js` with Sentry webpack plugin

**Configuration:**
```typescript
// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,        // 10% of transactions for performance monitoring
  profilesSampleRate: 0.1,       // 10% for profiling
  beforeSend(event) {
    // Scrub sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    return event;
  },
});
```

**Add context to errors:**

Create: `lib/sentry.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

export function captureRouteError(error: unknown, context: {
  route: string;
  userId?: string;
  params?: Record<string, any>;
}) {
  Sentry.withScope((scope) => {
    scope.setTag('route', context.route);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.params) scope.setContext('params', context.params);
    Sentry.captureException(error);
  });
}
```

**Apply to all API routes:** Replace bare `console.error` catch blocks with `captureRouteError`. Keep console.error for local dev visibility but add Sentry capture alongside.

### 5.2 Structured Logging

Create: `lib/logger.ts`

```typescript
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  route?: string;
  userId?: string;
  duration?: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export function log(level: LogLevel, message: string, meta?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) {
  const entry: LogEntry = {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  };

  // In production, output JSON for log aggregation
  if (process.env.NODE_ENV === 'production') {
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
  } else {
    // In dev, pretty-print
    console[level === 'error' ? 'error' : 'log'](`[${level.toUpperCase()}] ${message}`, meta || '');
  }
}
```

**Apply to API routes:**

Create: `lib/middleware/withLogging.ts`

```typescript
export function withLogging(route: string, handler: RouteHandler): RouteHandler {
  return async (request: Request, context: any) => {
    const start = Date.now();
    try {
      const response = await handler(request, context);
      log('info', `${request.method} ${route}`, {
        route,
        duration: Date.now() - start,
        metadata: { status: response.status },
      });
      return response;
    } catch (error) {
      log('error', `${request.method} ${route} failed`, {
        route,
        duration: Date.now() - start,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  };
}
```

### 5.3 Uptime Monitoring

**External monitoring:**

Set up a monitoring service (UptimeRobot free tier, or Better Uptime) to ping:

| Endpoint | Interval | Alert Threshold |
|----------|----------|----------------|
| `GET /api/health` (new) | 1 min | 2 consecutive failures |
| `GET /api/market/screener` | 5 min | 3 consecutive failures |
| `https://scopealpha.com` (homepage) | 1 min | 2 consecutive failures |

**Create:** `app/api/health/route.ts`

```typescript
export async function GET() {
  const checks: Record<string, boolean> = {};

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Upstash Redis
  try {
    await redis.ping();
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  const healthy = Object.values(checks).every(Boolean);

  return Response.json(
    { status: healthy ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
```

### 5.4 WebSocket / SSE Health Monitoring

The Phase 1 SSE pipeline (market data) is critical infrastructure. Add a health indicator:

**Create:** `app/api/health/sse/route.ts`

Checks the freshness of market data cache keys:
```typescript
const btcCandles = await getCached('market:candles:BTCUSDT:1h');
const lastUpdate = btcCandles?._cachedAt;
const stale = !lastUpdate || (Date.now() - new Date(lastUpdate).getTime() > 120_000); // 2min threshold

return Response.json({
  status: stale ? 'stale' : 'ok',
  lastUpdate,
  staleSinceMs: stale ? Date.now() - new Date(lastUpdate).getTime() : 0,
});
```

Add this to the external monitoring ping list.

### 5.5 Database Connection Pool Monitoring

Neon PostgreSQL on Vercel uses connection pooling. Monitor pool usage:

**In the health check route:** Add a pool status check by querying `SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()`.

**Alert:** If active connections exceed 80% of the pool limit (typically 20–50 on Neon), log a warning to Sentry.

---

## 6. Sub-Phase 7D — Legal & Compliance Scaffolding

### Objective

Add the legal pages, disclaimers, agreements, and data rights capabilities that protect both the platform and its users.

### 6.1 Terms of Service Page

**Create:** `app/legal/terms/page.tsx`

Server-rendered page with the platform's Terms of Service. Content should be reviewed by a lawyer but the PRD provides the structural outline:

**Key sections:**
1. **Acceptance of Terms** — by using the platform, users agree
2. **Description of Service** — what Scope Alpha is and isn't
3. **Not Financial Advice** — signals, analytics, and commentary are for informational purposes only; not investment advice; not a registered investment adviser or CTA
4. **User Accounts** — account responsibilities, accuracy of information, prohibited uses
5. **Analyst Responsibilities** — signal immutability, prohibition on manipulative practices, disclosure requirements
6. **Subscriber Responsibilities** — own investment decisions, no recourse for losses
7. **Subscription & Payments** — billing terms, refund policy (no refunds for partial months), cancellation
8. **Intellectual Property** — platform IP, user content license
9. **Limitation of Liability** — platform not liable for trading losses, data accuracy, service interruptions
10. **Indemnification** — users indemnify platform against claims
11. **Dispute Resolution** — governing law, arbitration clause
12. **Modification of Terms** — platform can modify with notice
13. **Termination** — platform can terminate accounts for violation

**Content delivery:** Store the ToS as a markdown file in the repo (`content/legal/terms.md`) and render it via `@next/mdx` or a simple markdown-to-HTML pipeline. This makes it easy to update and track changes via git.

**Acceptance gate:** Add a `tosAcceptedAt` field to the User model. On first login after ToS is published (or after any ToS update), show a modal requiring acceptance before proceeding.

### 6.2 Privacy Policy Page

**Create:** `app/legal/privacy/page.tsx`

**Key sections:**
1. **Information We Collect** — account data, trading signals, usage data, cookies
2. **How We Use Information** — service delivery, analytics, communication
3. **Information Sharing** — with Stripe for payments, with Resend for email, no selling of data
4. **Data Retention** — how long data is kept
5. **Your Rights** — access, correction, deletion (see 6.5), data export (see 6.5)
6. **Cookies** — what cookies are used (NextAuth session, Zustand localStorage)
7. **Security** — how data is protected (encryption in transit, bcrypt passwords, Neon encrypted at rest)
8. **Children's Privacy** — service not intended for users under 18
9. **Changes to Policy** — notification process
10. **Contact** — how to reach the platform for privacy inquiries

### 6.3 Signal Disclaimer

**Every signal view must include a disclaimer.** Inject it at the component level:

**Create:** `components/legal/SignalDisclaimer.tsx`

```typescript
export function SignalDisclaimer() {
  return (
    <p className="text-xs text-gray-500 mt-2">
      This signal is for informational purposes only and does not constitute financial advice.
      Past performance does not guarantee future results. Trade at your own risk.
    </p>
  );
}
```

**Inject into:**
- `components/terminal/SignalCard.tsx` — below every signal card
- `app/signal/[id]/page.tsx` — below the signal detail view
- Signal alert emails (`SignalAlertEmail.tsx`) — in the footer
- Telegram signal messages — appended to every message

**The disclaimer is not optional or dismissible.** It renders on every signal view, every time.

### 6.4 Analyst Publishing Agreement

Before an analyst can publish their first signal, they must accept a publishing agreement.

**Schema change:**

```prisma
model User {
  // ... existing fields ...
  analystAgreementAcceptedAt  DateTime?
}
```

**Enforcement:**

Modify `POST /api/signals` and `POST /api/signals/[id]/publish`:
- If `user.analystAgreementAcceptedAt` is null, return 403 with `{ error: 'Publishing agreement not accepted', code: 'AGREEMENT_REQUIRED' }`
- Frontend shows the agreement modal and submits acceptance before retrying

**Agreement content (outline):**
1. Signals are timestamped and immutable — you cannot edit or delete published signals
2. You will not engage in front-running, wash trading, or market manipulation
3. You are responsible for the accuracy of your signals and performance claims
4. You grant Scope Alpha a license to display and distribute your signals to subscribers
5. Scope Alpha may suspend or terminate your analyst account for violation of these terms
6. You are solely responsible for any tax obligations on income earned through the platform
7. Signal publication does not create a fiduciary relationship with subscribers

**Route:** `POST /api/users/accept-analyst-agreement`

Auth: Analyst. Sets `analystAgreementAcceptedAt = new Date()`.

**Frontend:**

Create: `components/legal/AnalystAgreementModal.tsx`

- Modal that blocks signal creation until accepted
- Full text of the agreement with a scrollable area
- "I have read and agree to the Analyst Publishing Agreement" checkbox
- "Accept" button (disabled until checkbox is checked)

### 6.5 Data Export & Account Deletion

**GDPR-style data rights.** Users can export their data and delete their account.

**Route:** `POST /api/users/export-data`

Auth: Logged in. Rate limited: 1 per day.

1. Collect all user data: profile, signals, subscriptions, tracked signals, reviews, chat messages, notifications, preferences
2. Format as JSON
3. Upload to R2 as a temporary file (1-week TTL)
4. Send email with download link
5. Return `{ success: true, message: 'Export will be emailed to you within a few minutes' }`

**Route:** `DELETE /api/users/account`

Auth: Logged in. Body: `{ confirmPassword, confirmText: 'DELETE MY ACCOUNT' }`.

1. Verify password (bcrypt compare)
2. Verify confirmation text matches exactly
3. Soft-delete approach:
   - Set `user.deletedAt = new Date()`
   - Set `user.email = 'deleted_{id}@deleted.scopealpha.com'` (free up the email)
   - Revoke all sessions
   - Cancel active subscriptions (via Stripe API when Phase 2 is live, or mark as canceled in DB)
   - Do NOT hard-delete signals (they're part of the analyst's public record and other users' portfolios reference them)
   - Do NOT hard-delete reviews (they're part of the analyst's public profile)
   - Hard-delete: notifications, chat messages (author), tracked signals, bookmarks, likes, follows, preferences
4. Return `{ success: true }`

**30-day recovery window:** The soft-deleted user account can be recovered within 30 days by contacting support. After 30 days, a scheduled cleanup job can hard-delete remaining data.

**Frontend:**

Add to `app/settings/page.tsx`:
- "Export My Data" button → calls export route → shows success message
- "Delete Account" section at the bottom (red zone) → confirmation flow with password + text input

---

## 7. New Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `@sentry/nextjs` | Error tracking and performance monitoring | `npm install @sentry/nextjs` |
| `dompurify` | HTML sanitization (server-side) | `npm install dompurify` |
| `jsdom` | DOM environment for DOMPurify on the server | `npm install jsdom` |
| `sharp` | Image resizing for avatars (optional) | `npm install sharp` |

---

## 8. Environment Variables

```env
# Sentry
SENTRY_DSN=                         # From Sentry project settings
SENTRY_AUTH_TOKEN=                   # For source map upload (build-time only)

# Uptime monitoring (configured externally, not env vars)
# UptimeRobot or Better Uptime configured via their dashboard
```

---

## 9. Prisma Schema Changes (Summary)

```prisma
// New models
model Session {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  token       String    @unique
  userAgent   String?
  ipAddress   String?
  lastActive  DateTime  @default(now())
  createdAt   DateTime  @default(now())
  expiresAt   DateTime
  revokedAt   DateTime?
  @@index([userId])
  @@index([token])
}

// Changes to existing models
model User {
  // Add:
  passwordResetToken           String?    @unique
  passwordResetExpiry          DateTime?
  tosAcceptedAt                DateTime?
  analystAgreementAcceptedAt   DateTime?
  deletedAt                    DateTime?
  sessions                     Session[]
}

// Index additions across existing models (see 4.1)
```

---

## 10. File Structure

**New files:**

```
config/
  rateLimits.ts                                  # Per-route rate limit configuration

lib/
  sanitize.ts                                    # Input sanitization utilities
  logger.ts                                      # Structured logging
  sentry.ts                                      # Sentry context helpers
  middleware/
    withRateLimit.ts                              # Rate limit wrapper
    withCsrf.ts                                   # CSRF origin validation
    withLogging.ts                                # Request/response logging wrapper

app/api/
  health/route.ts                                # Health check (DB + Redis)
  health/sse/route.ts                            # SSE/market data freshness check
  auth/
    forgot-password/route.ts                     # POST — send password reset email
    reset-password/route.ts                      # POST — reset password with token
    sessions/route.ts                            # GET (list), DELETE (revoke all)
    sessions/[id]/route.ts                       # DELETE (revoke one)
  users/
    avatar/route.ts                              # POST — upload avatar
    export-data/route.ts                         # POST — export all user data
    account/route.ts                             # DELETE — delete account
    accept-analyst-agreement/route.ts            # POST — accept publishing agreement

app/
  legal/
    terms/page.tsx                               # Terms of Service
    privacy/page.tsx                              # Privacy Policy
  forgot-password/page.tsx                       # Forgot password form
  reset-password/page.tsx                        # Reset password form
  settings/sessions/page.tsx                     # Active sessions management

content/legal/
  terms.md                                       # ToS content (markdown, git-tracked)
  privacy.md                                     # Privacy Policy content
  analyst-agreement.md                           # Analyst publishing agreement content

components/legal/
  SignalDisclaimer.tsx                            # "Not financial advice" text
  AnalystAgreementModal.tsx                      # Agreement acceptance modal
  TosAcceptanceModal.tsx                         # ToS acceptance modal (on login if not accepted)

lib/email/templates/
  PasswordResetEmail.tsx                         # Password reset link email
  DataExportEmail.tsx                            # Data export download link email

sentry.client.config.ts                          # Sentry client config (auto-generated)
sentry.server.config.ts                          # Sentry server config
sentry.edge.config.ts                            # Sentry edge config
instrumentation.ts                               # Next.js instrumentation
```

**Existing files to modify:**

```
prisma/schema.prisma                             # Session model, User fields, index additions
lib/rateLimit.ts                                 # Upgrade to Upstash-backed with config-driven limits
next.config.js                                   # Sentry webpack plugin
app/api/auth/[...nextauth]/route.ts              # JWT callback for session tracking
app/api/signals/route.ts                         # Add sanitization, rate limiting, agreement check
app/api/signals/[id]/publish/route.ts            # Agreement check
components/terminal/SignalCard.tsx                # Add SignalDisclaimer
app/signal/[id]/page.tsx                         # Add SignalDisclaimer
lib/email/templates/SignalAlertEmail.tsx          # Add disclaimer to footer
lib/notifications/formatters.ts                  # Add disclaimer to Telegram messages
app/(auth)/login/page.tsx                        # Add "Forgot password?" link
app/settings/page.tsx                            # Add data export + account deletion section

# All POST/PUT/PATCH/DELETE API routes — wrap with withRateLimit + withCsrf + withLogging
```

**Files to leave alone:**

```
# All Phase 1–6 feature logic (only adding middleware wrappers, not changing behavior)
# Market data infrastructure
# Chart components
# Stripe stubs / notification stubs (except adding disclaimer to templates)
```

---

## 11. Testing & Validation

### Manual Verification Checklist

**Rate Limiting:**
- [ ] Send 21 login attempts in 5 minutes → 21st returns 429 with Retry-After header
- [ ] Send 31 chat messages in 1 minute → 31st returns 429
- [ ] Rate limit resets after the window expires
- [ ] Rate limit headers present in responses (X-RateLimit-Remaining, X-RateLimit-Reset)

**Input Sanitization:**
- [ ] Submit a signal note with `<script>alert('xss')</script>` → saved as plain text, no script execution
- [ ] Submit a review with `<b>bold</b>` → rendered as bold (allowed tag)
- [ ] Submit a profile URL with `javascript:alert(1)` → rejected
- [ ] Submit a display name with HTML tags → tags stripped

**Password Reset:**
- [ ] Click "Forgot password" → enter email → receive reset email within 30s
- [ ] Click reset link → enter new password → password changed
- [ ] Try to use expired reset token (>1hr) → error shown
- [ ] After reset, all existing sessions are revoked (forced logout)
- [ ] Request reset for non-existent email → same success response (no email enumeration)

**Session Management:**
- [ ] Settings → Sessions → shows current and other active sessions
- [ ] "This device" badge on current session
- [ ] Revoke a specific session → that device's next request fails auth
- [ ] "Log out everywhere else" → only current session remains active

**CSRF:**
- [ ] Mutation request from same origin → succeeds
- [ ] Mutation request from different origin → 403 "CSRF validation failed"
- [ ] Stripe webhook (no origin header, has signature) → still succeeds

**Health Check:**
- [ ] `GET /api/health` returns 200 with all checks passing
- [ ] Kill Redis → health check returns 503 with `redis: false`

**Sentry:**
- [ ] Trigger an unhandled error in an API route → error appears in Sentry dashboard within 30s
- [ ] Error includes route name, user ID, and request params as context

**Structured Logging:**
- [ ] API request → JSON log line in production format
- [ ] Log includes route, duration, status code, user ID

**Signal Disclaimer:**
- [ ] Disclaimer visible below every signal card
- [ ] Disclaimer present in signal alert emails
- [ ] Disclaimer appended to Telegram signal messages
- [ ] Disclaimer visible on signal detail page

**Analyst Agreement:**
- [ ] New analyst tries to publish signal → blocked with agreement modal
- [ ] Accept agreement → can publish
- [ ] Agreement acceptance persists (no re-prompt)

**ToS & Privacy:**
- [ ] `/legal/terms` renders full ToS
- [ ] `/legal/privacy` renders full privacy policy
- [ ] First login after ToS published → acceptance modal shown
- [ ] Can't proceed without accepting

**Data Export:**
- [ ] Click "Export My Data" → receive email with JSON download link within 5 minutes
- [ ] JSON contains: profile, signals, subscriptions, reviews, tracked signals, preferences

**Account Deletion:**
- [ ] Enter wrong password → rejected
- [ ] Enter wrong confirmation text → rejected
- [ ] Correct password + "DELETE MY ACCOUNT" → account soft-deleted, sessions revoked, redirected to homepage
- [ ] Try to log in with deleted account → fails
- [ ] Deleted user's signals still visible on analyst profiles (not hard-deleted)

**Performance:**
- [ ] Lighthouse scores ≥ 80 on Performance for all audited pages
- [ ] Lighthouse scores ≥ 90 on Accessibility, Best Practices, SEO
- [ ] Bundle analyzer shows no unexpected large dependencies in main bundle

---

## 12. Rollout Plan

**Pre-launch critical path (do first):**

1. **Rate limiting** (3.1) — config + middleware + apply to all routes
2. **Input sanitization** (3.2) — sanitize library + audit all routes
3. **CSRF protection** (3.5) — middleware + apply to all mutations
4. **Signal disclaimer** (6.3) — inject into all signal views
5. **Analyst agreement** (6.4) — schema + enforcement + modal
6. **Terms of Service** (6.1) — content + page + acceptance gate
7. **Privacy Policy** (6.2) — content + page
8. **Sentry integration** (5.1) — error tracking live before users arrive
9. **Health check** (5.3) — endpoint + external monitoring setup

**Post-launch (can ship incrementally):**

10. **Password reset** (3.3) — schema + routes + email template + pages
11. **Session management** (3.4) — schema + auth callback changes + settings page
12. **Structured logging** (5.2) — logger + middleware wrapper
13. **Database index audit** (4.1) — add indexes, verify with EXPLAIN
14. **Caching audit** (4.2) — add missing caches
15. **Avatar upload** (4.3) — route + settings UI
16. **Frontend performance** (4.4) — lazy loading, code splitting, bundle audit
17. **Lighthouse audit** (4.5) — run and fix
18. **Data export** (6.5) — export route + email
19. **Account deletion** (6.5) — delete route + settings UI
20. **SSE health monitoring** (5.4) — freshness check endpoint
21. **DB connection monitoring** (5.5) — pool check in health endpoint

---

## 13. Out of Scope

The following are explicitly NOT part of this phase:

- WAF (Web Application Firewall) — use Vercel's built-in or Cloudflare if needed later
- DDoS protection — rely on Vercel's infrastructure
- Penetration testing — hire externally after launch
- SOC 2 compliance — premature for alpha/early product
- GDPR cookie consent banner — only using session cookies, no tracking cookies
- Two-factor authentication (2FA) — can be added later
- IP-based geo-blocking — not needed
- Content Security Policy (CSP) headers — add later as hardening
- HSTS preload — Vercel handles HTTPS, manual preload submission later
- Automated vulnerability scanning — set up Dependabot on the repo manually
- Legal content writing — the ToS and Privacy Policy content in this PRD is structural only; a lawyer must review before publishing
- Any new features — this phase only hardens existing functionality
