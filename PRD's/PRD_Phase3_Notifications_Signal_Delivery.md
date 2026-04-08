# PRD: Phase 3 — Notifications & Signal Delivery

**Version:** 1.0
**Date:** April 7, 2026
**Status:** Ready for Implementation (after Phase 2 complete)
**Priority:** High — signal delivery latency directly impacts subscriber retention
**Depends On:** Phase 2 (Stripe subscriptions + access gating)

---

## 1. Context

### Why This Phase Matters

A trading signal that arrives 10 minutes late is worthless. Scope Alpha's core value proposition is that analysts publish timestamped, immutable signals — but if subscribers don't see those signals in time to act, the platform fails regardless of signal quality. This phase builds the delivery infrastructure that makes signal subscriptions worth paying for.

### What Already Exists

**Signal System:**
- Analysts create signals via `POST /api/signals` with asset, direction, entry/target/stop, timeframe, conviction
- Signals are immutable after publication (timestamped, no edits)
- Signals are stored in Prisma/PostgreSQL and served via REST
- Subscribers can view signals on analyst profile pages and the terminal

**Auth & Subscriptions (after Phase 2):**
- NextAuth with JWT sessions, email/password + Google OAuth + demo mode
- Email is collected at signup but **not verified**
- Active subscriptions gate access to full signal content
- `Subscription` model links subscribers to analysts with status tracking

**Chat & Announcements:**
- Room-based chat already exists
- Analyst announcements (broadcasts to all subscribers) already exist
- Both are pull-only — subscriber has to visit the page to see them

**What Does NOT Exist:**
- No email sending infrastructure (no transactional email provider)
- No email verification on signup
- No in-app notification system (no bell icon, no notification feed)
- No push delivery of any kind — everything is pull-only
- No Telegram integration
- No notification preferences
- No batching or rate limiting on notifications

---

## 2. Goals

After this phase is complete:

1. All user emails are verified before accounts can subscribe or publish
2. The platform can send transactional emails (welcome, verification, billing, signal alerts)
3. An in-app notification system shows unread alerts with a bell icon and dropdown
4. New signal publication triggers instant delivery via in-app notification + email + Telegram (per subscriber preference)
5. Subscribers control their notification channels and frequency per analyst
6. A Telegram bot allows subscribers to receive signal alerts via DM
7. Notification batching prevents spam during high-activity periods

---

## 3. Architecture Overview

### Notification Pipeline

```
Signal Published (POST /api/signals)
        │
        ▼
Notification Dispatcher (lib/notifications/dispatcher.ts)
        │
        ├─ Find all active subscribers for this analyst
        ├─ Load each subscriber's notification preferences
        │
        ├─► In-App: Write to Notification table → client polls or SSE
        │
        ├─► Email: Queue via Resend API (if subscriber opted in)
        │
        └─► Telegram: Send via Bot API (if subscriber linked account)
```

### Delivery Channels

| Channel | Latency Target | Reliability | Gating |
|---------|---------------|-------------|--------|
| In-App | < 5s (poll) or < 1s (SSE) | Best-effort, always on | Default for all users |
| Email | < 30s | High (Resend handles retries) | Opt-in, verified email required |
| Telegram | < 5s | High (Telegram Bot API) | Opt-in, account linking required |

### Event Types

| Event | In-App | Email | Telegram | Trigger |
|-------|--------|-------|----------|---------|
| New Signal | ✅ Always | ✅ If opted in | ✅ If linked | Analyst publishes signal |
| Signal Resolved | ✅ Always | ❌ | ✅ If linked | Analyst resolves signal with result |
| New Announcement | ✅ Always | ✅ If opted in | ✅ If linked | Analyst posts announcement |
| Subscription Confirmed | ✅ Always | ✅ Always | ❌ | Stripe webhook |
| Payment Failed | ✅ Always | ✅ Always | ❌ | Stripe webhook |
| Welcome | ❌ | ✅ Always | ❌ | Signup |
| Email Verification | ❌ | ✅ Always | ❌ | Signup / resend |

---

## 4. Sub-Phase 3A — Email System

### Objective

Set up transactional email via Resend, implement email verification, and build the template library for all platform emails.

### Why Resend

- Built for developers, excellent Next.js/React integration
- React Email for templates (JSX-based, matches existing stack)
- Generous free tier (100 emails/day, 3,000/month)
- Simple API: one `POST` to send, no complex configuration
- Built-in deliverability (DKIM, SPF, bounce handling)

### Implementation Steps

#### 4.1 Resend Setup

Install: `npm install resend react-email @react-email/components`

Create: `lib/email/resend.ts`

```typescript
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = 'Scope Alpha <noreply@scopealpha.com>';

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      react,
    });
    if (error) {
      console.error('Email send failed:', error);
      return { success: false, error };
    }
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err };
  }
}
```

**DNS Setup:** Add Resend's DKIM and SPF records to the `scopealpha.com` domain. Resend's dashboard walks through this — typically 3 DNS TXT records.

#### 4.2 Email Verification

**Schema change — add to User model:**

```prisma
model User {
  // ... existing fields ...
  emailVerified     DateTime?          // null = unverified, timestamp = when verified
  verificationToken String?   @unique  // Random token for email verification
  verificationExpiry DateTime?         // Token expires after 24hrs
}
```

**Route:** `POST /api/auth/send-verification`

Auth: Logged in, email not yet verified.

1. Generate a random token: `crypto.randomUUID()`
2. Save token + expiry (24hr) to user record
3. Send verification email with link: `{baseUrl}/verify-email?token={token}`
4. Return success

**Route:** `GET /api/auth/verify-email?token={token}`

No auth required (link from email).

1. Look up user by `verificationToken`
2. Check token hasn't expired
3. Set `emailVerified = new Date()`, clear token fields
4. Redirect to `/settings?verified=true` with success toast

**Enforcement:**
- Modify `POST /api/subscriptions/checkout` to reject unverified emails
- Modify `POST /api/signals` to reject analysts with unverified emails
- Show a persistent banner for unverified users: "Please verify your email to access all features"
- Auto-send verification email on signup (in the NextAuth `signIn` callback or `createUser` event)

**Resend verification:** Allow users to request a new verification email (rate limit: 1 per 5 minutes).

#### 4.3 Email Templates

Create email templates using React Email (JSX components that render to HTML):

**Directory:** `lib/email/templates/`

**`WelcomeEmail.tsx`:**
- Sent on signup
- Brief intro to the platform
- CTA: "Verify Your Email" button
- CTA: "Browse Analysts" button

**`VerificationEmail.tsx`:**
- Sent on signup and on resend
- "Verify your email address" with prominent button
- Token link expires in 24hrs
- Fallback: "Copy this link if the button doesn't work"

**`SignalAlertEmail.tsx`:**
- Sent when a subscribed analyst publishes a new signal
- Shows: analyst name, asset, direction (LONG/SHORT), conviction level
- If subscriber has access: entry, target, stop prices
- CTA: "View Signal" button linking to the signal on the platform
- Footer: "Manage notification preferences" link

**`AnnouncementEmail.tsx`:**
- Sent when a subscribed analyst posts an announcement
- Shows: analyst name, announcement title, preview text (first 200 chars)
- CTA: "Read Full Announcement" button

**`SubscriptionConfirmedEmail.tsx`:**
- Sent on successful subscription (supplement to Stripe's receipt)
- Shows: analyst name, tier name, price, what's included
- CTA: "View Analyst" button

**`PaymentFailedEmail.tsx`:**
- Sent on invoice.payment_failed (supplement to Stripe's notification)
- Shows: analyst name, amount, what happens next (grace period details)
- CTA: "Update Payment Method" → Stripe Billing Portal

**Template design principles:**
- Match Scope Alpha's glass-morphism dark theme as closely as email HTML allows
- Dark background (#0a0a1a), white text, accent border colors
- Responsive — must look good on mobile email clients
- All templates include unsubscribe/preference link in footer
- Keep templates under 50KB for deliverability

#### 4.4 Email Preference Model

Add notification preferences to the schema:

```prisma
model NotificationPreferences {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  analystId     String?  // null = global default, non-null = per-analyst override

  emailSignals       Boolean @default(true)
  emailAnnouncements Boolean @default(true)
  emailMarketing     Boolean @default(false)

  // Unique per user + analyst (or user + null for global)
  @@unique([userId, analystId])
}
```

**Route:** `GET /api/notifications/preferences`

Returns the user's global preferences + any per-analyst overrides.

**Route:** `PUT /api/notifications/preferences`

Body: `{ analystId?: string, emailSignals?: boolean, emailAnnouncements?: boolean }`

Updates or creates the preference record.

**Unsubscribe link:** Each email includes a signed unsubscribe URL:
```
{baseUrl}/api/notifications/unsubscribe?userId={id}&analystId={id}&channel=email&type=signals&sig={hmac}
```
The HMAC prevents anyone from unsubscribing another user. Clicking it sets `emailSignals = false` for that analyst and shows a confirmation page.

---

## 5. Sub-Phase 3B — In-App Notifications & Signal Alerts

### Objective

Build the in-app notification system (bell icon, notification feed, unread count) and wire signal publication to trigger multi-channel delivery.

### Implementation Steps

#### 5.1 Notification Model

```prisma
model Notification {
  id          String    @id @default(cuid())
  userId      String                          // Recipient
  user        User      @relation(fields: [userId], references: [id])
  type        String                          // 'new_signal' | 'signal_resolved' | 'announcement' | 'subscription_confirmed' | 'payment_failed'
  title       String                          // Short headline
  body        String                          // Detail text
  metadata    Json?                           // { signalId, analystId, analystSlug, asset, direction, etc. }
  read        Boolean   @default(false)
  readAt      DateTime?
  createdAt   DateTime  @default(now())

  @@index([userId, read, createdAt])          // Fast query for unread notifications
}
```

#### 5.2 Notification API Routes

**`GET /api/notifications`**

Auth: Logged in.

Query params: `?unreadOnly=true&limit=20&cursor={id}`

Returns paginated notification list, newest first:
```typescript
interface NotificationResponse {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    metadata: Record<string, any>;
    read: boolean;
    createdAt: string;
  }>;
  unreadCount: number;
  nextCursor: string | null;
}
```

**`POST /api/notifications/read`**

Auth: Logged in.

Body: `{ notificationIds: string[] }` or `{ all: true }`

Marks notifications as read, sets `readAt`.

**`GET /api/notifications/unread-count`**

Auth: Logged in.

Returns: `{ count: number }`

Lightweight endpoint the client polls frequently (every 30s) or receives via SSE.

#### 5.3 Notification Dispatcher

Create: `lib/notifications/dispatcher.ts`

The central function that handles multi-channel delivery:

```typescript
interface NotificationPayload {
  type: 'new_signal' | 'signal_resolved' | 'announcement' | 'subscription_confirmed' | 'payment_failed';
  recipientIds: string[];  // List of user IDs to notify
  title: string;
  body: string;
  metadata: Record<string, any>;
  emailTemplate?: React.ReactElement;  // Pre-rendered email template
  telegramMessage?: string;            // Pre-formatted Telegram message
}

export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  const { type, recipientIds, title, body, metadata, emailTemplate, telegramMessage } = payload;

  // 1. Batch-create in-app notifications for all recipients
  await prisma.notification.createMany({
    data: recipientIds.map(userId => ({
      userId,
      type,
      title,
      body,
      metadata,
    })),
  });

  // 2. For each recipient, check preferences and dispatch to additional channels
  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    include: {
      notificationPreferences: true,
      telegramLink: true,
    },
  });

  const emailPromises: Promise<any>[] = [];
  const telegramPromises: Promise<any>[] = [];

  for (const user of recipients) {
    const prefs = getEffectivePreferences(user, metadata.analystId);

    // Email
    if (emailTemplate && user.emailVerified && shouldSendEmail(type, prefs)) {
      emailPromises.push(
        sendEmail({ to: user.email, subject: title, react: emailTemplate })
      );
    }

    // Telegram
    if (telegramMessage && user.telegramLink?.chatId && shouldSendTelegram(type, prefs)) {
      telegramPromises.push(
        sendTelegramMessage(user.telegramLink.chatId, telegramMessage)
      );
    }
  }

  // Fire all external sends in parallel, don't block on them
  await Promise.allSettled([...emailPromises, ...telegramPromises]);
}
```

**Important:** The dispatcher runs inside the signal creation API route but the external sends (email, Telegram) should not block the response. Use `Promise.allSettled` and don't await the outer call if latency is a concern. For a more robust approach at scale, push to a queue (but overkill for alpha).

#### 5.4 Wiring Signal Publication to Notifications

Modify: `POST /api/signals` (after the signal is created and saved)

```typescript
// After signal is created...
const signal = await prisma.signal.create({ data: signalData });

// Find all active subscribers for this analyst
const subscribers = await prisma.subscription.findMany({
  where: {
    analystId: signal.analystId,
    status: { in: ['active', 'past_due'] },
  },
  select: { subscriberId: true },
});

const recipientIds = subscribers.map(s => s.subscriberId);

if (recipientIds.length > 0) {
  // Don't await — fire and forget so the signal creation response isn't delayed
  dispatchNotification({
    type: 'new_signal',
    recipientIds,
    title: `${analyst.displayName}: New ${signal.direction.toUpperCase()} signal on ${signal.asset}`,
    body: `${signal.conviction} conviction ${signal.direction} on ${signal.asset} (${signal.timeframe})`,
    metadata: {
      signalId: signal.id,
      analystId: signal.analystId,
      analystSlug: analyst.slug,
      asset: signal.asset,
      direction: signal.direction,
      conviction: signal.conviction,
      timeframe: signal.timeframe,
    },
    emailTemplate: SignalAlertEmail({ signal, analyst }),
    telegramMessage: formatSignalTelegram(signal, analyst),
  }).catch(err => console.error('Notification dispatch failed:', err));
}
```

Similarly wire:
- **Signal resolution** (`PUT /api/signals/[id]` when result is set) → `signal_resolved` notification
- **Announcement creation** (`POST /api/announcements`) → `announcement` notification
- **Subscription confirmed** (Stripe webhook `checkout.session.completed`) → `subscription_confirmed` notification
- **Payment failed** (Stripe webhook `invoice.payment_failed`) → `payment_failed` notification

#### 5.5 Notification Batching

For high-activity analysts who publish multiple signals in quick succession, batch notifications to avoid spamming:

Create: `lib/notifications/batcher.ts`

```typescript
const BATCH_WINDOW_MS = 60_000; // 1 minute
const BATCH_THRESHOLD = 3;      // If 3+ signals from same analyst within window, batch

// In-memory map: analystId → { signals: Signal[], timer: NodeJS.Timeout }
const pendingBatches = new Map<string, PendingBatch>();

export function enqueueSignalNotification(signal: Signal, analyst: Analyst, recipientIds: string[]) {
  const existing = pendingBatches.get(analyst.id);

  if (existing) {
    existing.signals.push(signal);
    // Reset the timer — wait for activity to settle
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => flushBatch(analyst.id), BATCH_WINDOW_MS);
    return;
  }

  // First signal — start a timer, but also send immediately (first one is never batched)
  dispatchNotification({ /* single signal notification */ });

  pendingBatches.set(analyst.id, {
    signals: [],
    recipientIds,
    timer: setTimeout(() => flushBatch(analyst.id), BATCH_WINDOW_MS),
  });
}

function flushBatch(analystId: string) {
  const batch = pendingBatches.get(analystId);
  if (!batch || batch.signals.length === 0) {
    pendingBatches.delete(analystId);
    return;
  }

  // Send a single batched notification: "Analyst X published 3 new signals"
  dispatchNotification({
    type: 'new_signal',
    recipientIds: batch.recipientIds,
    title: `${analyst.displayName} published ${batch.signals.length} new signals`,
    body: batch.signals.map(s => `${s.direction.toUpperCase()} ${s.asset}`).join(', '),
    metadata: { analystId, signalIds: batch.signals.map(s => s.id) },
    emailTemplate: BatchedSignalAlertEmail({ signals: batch.signals, analyst }),
    telegramMessage: formatBatchedSignalTelegram(batch.signals, analyst),
  });

  pendingBatches.delete(analystId);
}
```

**Note:** In-memory batching won't survive serverless cold starts on Vercel. For alpha this is acceptable — worst case, a batch gets flushed early and the subscriber gets 2 notifications instead of 1. A production upgrade would use Upstash Redis with a sorted set and a cron-based flusher, but that's premature for the current user base.

#### 5.6 Frontend — Bell Icon & Notification Dropdown

**Component:** `components/notifications/NotificationBell.tsx`

- Bell icon in the top nav bar (next to user avatar)
- Badge showing unread count (red circle with number, hidden when 0)
- Click opens a dropdown panel (not a full page)
- Dropdown shows the 10 most recent notifications
- Each notification is clickable — navigates to the relevant page (signal, analyst profile, billing)
- "Mark all as read" button at top
- "View all" link at bottom → `/notifications` page (full paginated list)

**Polling strategy:**
- Poll `GET /api/notifications/unread-count` every 30 seconds
- On dropdown open, fetch `GET /api/notifications?limit=10`
- Mark visible notifications as read when the dropdown closes (debounced)

**Zustand slice:** Add a `notificationStore` with `unreadCount`, `notifications[]`, `fetchUnreadCount()`, `fetchNotifications()`, `markAsRead()`.

**Alternative — SSE for instant delivery:**
If the existing SSE infrastructure (from Phase 1 market data) supports custom event types, piggyback notification pushes onto the same SSE connection. When the dispatcher creates an in-app notification, also publish to a per-user SSE channel. The client receives it instantly without polling. This is a stretch goal — polling at 30s is fine for launch.

#### 5.7 Notifications Page

**Page:** `app/notifications/page.tsx`

Full-page notification list with:
- Infinite scroll or "Load more" pagination
- Filter by type: All, Signals, Announcements, Billing
- Each notification shows: icon (per type), title, body, timestamp, read/unread indicator
- Click navigates to the relevant content
- "Mark all as read" button

---

## 6. Sub-Phase 3C — Telegram Bot Integration

### Objective

Allow subscribers to link their Telegram account and receive signal alerts via DM from a Scope Alpha bot.

### Implementation Steps

#### 6.1 Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Set bot name: `@ScopeAlphaBot` (or available variant)
3. Set bot description and about text
4. Save the bot token as `TELEGRAM_BOT_TOKEN` env var
5. Set up a webhook so Telegram sends incoming messages to the platform:
   ```
   POST https://api.telegram.org/bot{token}/setWebhook
   Body: { url: "https://scopealpha.com/api/telegram/webhook" }
   ```

#### 6.2 Account Linking Model

```prisma
model TelegramLink {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id])
  chatId      String   @unique    // Telegram chat ID for sending DMs
  username    String?              // Telegram @username (optional, for display)
  linkedAt    DateTime @default(now())
  isActive    Boolean  @default(true)
}
```

#### 6.3 Account Linking Flow

The subscriber links their Telegram account by sending a one-time code to the bot:

**Step 1 — Generate link code:**

**Route:** `POST /api/telegram/link`

Auth: Logged in.

1. Generate a random 6-character alphanumeric code
2. Store in Upstash with key `telegram:link:{code}` → `{ userId }`, TTL 10 minutes
3. Return: `{ code: "ABC123", botUrl: "https://t.me/ScopeAlphaBot" }`

**Step 2 — User sends code to bot:**

The user opens Telegram, finds @ScopeAlphaBot, and sends: `/start ABC123`

**Step 3 — Bot webhook receives the message:**

**Route:** `POST /api/telegram/webhook`

Webhook secret verification via `X-Telegram-Bot-Api-Secret-Token` header.

1. Parse incoming message: extract `chatId`, `text`
2. If text starts with `/start `:
   - Extract the code
   - Look up `telegram:link:{code}` in Upstash
   - If found: create `TelegramLink` record with `userId` and `chatId`
   - Delete the Upstash key (one-time use)
   - Reply: "✅ Account linked! You'll now receive signal alerts here."
   - If not found or expired: Reply: "❌ Invalid or expired code. Generate a new one at scopealpha.com/settings."
3. If text is `/unlink`:
   - Look up TelegramLink by chatId
   - Set `isActive = false`
   - Reply: "✅ Notifications disabled. You can re-link anytime."
4. If text is `/status`:
   - Look up TelegramLink by chatId
   - Reply with linked status, which analysts they're subscribed to, and active preferences
5. If text is `/recent`:
   - Look up user by chatId
   - Fetch their 5 most recent signal notifications
   - Reply with formatted signal summaries

#### 6.4 Sending Telegram Notifications

Create: `lib/notifications/telegram.ts`

```typescript
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram send failed:', result.description);
      // If user blocked the bot, deactivate their link
      if (result.error_code === 403) {
        await prisma.telegramLink.updateMany({
          where: { chatId },
          data: { isActive: false },
        });
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error('Telegram send error:', err);
    return false;
  }
}
```

#### 6.5 Signal Message Formatting

Create: `lib/notifications/formatters.ts`

```typescript
export function formatSignalTelegram(signal: Signal, analyst: { displayName: string; slug: string }): string {
  const arrow = signal.direction === 'long' ? '🟢' : '🔴';
  const dir = signal.direction.toUpperCase();

  return [
    `${arrow} <b>New Signal from ${analyst.displayName}</b>`,
    ``,
    `<b>Asset:</b> ${signal.asset}`,
    `<b>Direction:</b> ${dir}`,
    `<b>Entry:</b> $${signal.entryPrice.toLocaleString()}`,
    `<b>Target:</b> $${signal.targetPrice.toLocaleString()}`,
    `<b>Stop:</b> $${signal.stopLoss.toLocaleString()}`,
    `<b>Timeframe:</b> ${signal.timeframe}`,
    `<b>Conviction:</b> ${signal.conviction}`,
    ``,
    `🔗 <a href="https://scopealpha.com/analyst/${analyst.slug}">View on Scope Alpha</a>`,
  ].join('\n');
}

export function formatSignalResolvedTelegram(
  signal: Signal,
  analyst: { displayName: string },
  resultPnl: number
): string {
  const emoji = resultPnl >= 0 ? '✅' : '❌';
  const pnl = resultPnl >= 0 ? `+${resultPnl.toFixed(2)}%` : `${resultPnl.toFixed(2)}%`;

  return [
    `${emoji} <b>Signal Resolved — ${analyst.displayName}</b>`,
    ``,
    `<b>Asset:</b> ${signal.asset} ${signal.direction.toUpperCase()}`,
    `<b>Result:</b> ${pnl}`,
  ].join('\n');
}

export function formatBatchedSignalTelegram(
  signals: Signal[],
  analyst: { displayName: string; slug: string }
): string {
  const lines = signals.map(s => {
    const arrow = s.direction === 'long' ? '🟢' : '🔴';
    return `${arrow} ${s.asset} ${s.direction.toUpperCase()} @ $${s.entryPrice.toLocaleString()}`;
  });

  return [
    `📊 <b>${analyst.displayName} published ${signals.length} new signals</b>`,
    ``,
    ...lines,
    ``,
    `🔗 <a href="https://scopealpha.com/analyst/${analyst.slug}">View all on Scope Alpha</a>`,
  ].join('\n');
}
```

#### 6.6 Telegram Notification Preferences

Extend the `NotificationPreferences` model:

```prisma
model NotificationPreferences {
  // ... existing fields from 3A ...
  telegramSignals       Boolean @default(true)
  telegramAnnouncements Boolean @default(true)
}
```

Subscribers can toggle Telegram notifications per-analyst in their settings, same as email.

#### 6.7 Frontend — Telegram Linking UI

**Page section:** `app/settings/notifications/page.tsx` (or a section within settings)

- "Link Telegram" card:
  - If not linked: "Connect your Telegram to receive instant signal alerts" + "Generate Link Code" button
  - On click: call `POST /api/telegram/link`, display the code and instructions ("Send `/start ABC123` to @ScopeAlphaBot on Telegram")
  - Show a QR code or deep link: `https://t.me/ScopeAlphaBot?start=ABC123`
  - Poll for link status (check if `TelegramLink` record was created) every 3 seconds for up to 2 minutes
  - On success: show "✅ Telegram linked" with the @username
- If already linked: show status, "Unlink" button

---

## 7. Notification Preferences UI

**Page:** `app/settings/notifications/page.tsx`

Two sections:

**Global Defaults:**
- Toggle: Email signal alerts (on/off)
- Toggle: Email announcements (on/off)
- Toggle: Telegram signal alerts (on/off) — only shown if Telegram linked
- Toggle: Telegram announcements (on/off) — only shown if Telegram linked

**Per-Analyst Overrides:**
- List of currently subscribed analysts
- Each shows toggles that override the global defaults
- "Reset to default" link per analyst

All toggles call `PUT /api/notifications/preferences` on change (debounced).

---

## 8. New Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `resend` | Transactional email API | `npm install resend` |
| `react-email` | Email template framework | `npm install react-email` |
| `@react-email/components` | Pre-built email components (Button, Section, etc.) | `npm install @react-email/components` |

SWR already installed from Phase 1. No Telegram SDK needed — use raw `fetch` against the Bot API.

---

## 9. Environment Variables

```env
# Resend (Email)
RESEND_API_KEY=                     # From Resend dashboard

# Telegram Bot
TELEGRAM_BOT_TOKEN=                 # From @BotFather
TELEGRAM_WEBHOOK_SECRET=            # Random string, set when registering webhook

# Email verification signing
EMAIL_UNSUBSCRIBE_SECRET=           # HMAC key for signed unsubscribe links
```

---

## 10. Prisma Schema Changes (Summary)

```prisma
// Additions to User
model User {
  emailVerified          DateTime?
  verificationToken      String?    @unique
  verificationExpiry     DateTime?
  notifications          Notification[]
  notificationPreferences NotificationPreferences[]
  telegramLink           TelegramLink?
}

// New models
model Notification {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  type      String
  title     String
  body      String
  metadata  Json?
  read      Boolean   @default(false)
  readAt    DateTime?
  createdAt DateTime  @default(now())
  @@index([userId, read, createdAt])
}

model NotificationPreferences {
  id                     String   @id @default(cuid())
  userId                 String
  user                   User     @relation(fields: [userId], references: [id])
  analystId              String?
  emailSignals           Boolean  @default(true)
  emailAnnouncements     Boolean  @default(true)
  emailMarketing         Boolean  @default(false)
  telegramSignals        Boolean  @default(true)
  telegramAnnouncements  Boolean  @default(true)
  @@unique([userId, analystId])
}

model TelegramLink {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  chatId    String   @unique
  username  String?
  linkedAt  DateTime @default(now())
  isActive  Boolean  @default(true)
}
```

---

## 11. File Structure

**New files:**

```
config/
  notifications.ts                         # Batch window, polling intervals, rate limits

lib/
  email/
    resend.ts                              # Resend SDK singleton + sendEmail helper
    templates/
      WelcomeEmail.tsx                     # Welcome + verify CTA
      VerificationEmail.tsx                # Email verification link
      SignalAlertEmail.tsx                  # New signal notification
      BatchedSignalAlertEmail.tsx           # Batched signals notification
      AnnouncementEmail.tsx                # Analyst announcement
      SubscriptionConfirmedEmail.tsx        # Subscription confirmed
      PaymentFailedEmail.tsx               # Payment failed warning
      layout.tsx                           # Shared email layout (dark theme, footer)
  notifications/
    dispatcher.ts                          # Central multi-channel dispatch
    batcher.ts                             # Signal batching logic
    telegram.ts                            # Telegram Bot API send helper
    formatters.ts                          # Telegram message formatters
    preferences.ts                         # Preference resolution (global + per-analyst)

app/api/
  auth/
    send-verification/route.ts             # POST — send/resend verification email
    verify-email/route.ts                  # GET — verify email via token
  notifications/
    route.ts                               # GET — paginated notification list
    read/route.ts                          # POST — mark as read
    unread-count/route.ts                  # GET — lightweight count endpoint
    preferences/route.ts                   # GET/PUT — notification preferences
    unsubscribe/route.ts                   # GET — signed email unsubscribe handler
  telegram/
    link/route.ts                          # POST — generate linking code
    webhook/route.ts                       # POST — Telegram incoming messages

app/
  notifications/page.tsx                   # Full notification list page
  settings/notifications/page.tsx          # Notification preferences + Telegram linking
  verify-email/page.tsx                    # Email verification landing (redirect target)

components/
  notifications/
    NotificationBell.tsx                   # Bell icon + dropdown in nav
    NotificationItem.tsx                   # Single notification row
    NotificationList.tsx                   # Scrollable notification list
  settings/
    TelegramLinkCard.tsx                   # Telegram account linking UI
    NotificationPreferencesForm.tsx        # Global + per-analyst toggles

stores/
  notificationStore.ts                     # Zustand: unreadCount, notifications, actions
```

**Existing files to modify:**

```
prisma/schema.prisma                       # Add Notification, NotificationPreferences, TelegramLink models + User fields
app/api/signals/route.ts                   # Add notification dispatch after signal creation
app/api/signals/[id]/route.ts              # Add notification dispatch on signal resolution
app/api/announcements/route.ts             # Add notification dispatch after announcement creation
app/api/stripe/webhooks/route.ts           # Add notification dispatch for subscription_confirmed + payment_failed
app/layout.tsx or nav component            # Add NotificationBell to the navigation bar
app/api/auth/[...nextauth]/route.ts        # Add auto-send verification email on signup
```

**Files to leave alone:**

```
# All Phase 1 market data infrastructure
# All Phase 2 Stripe/subscription infrastructure (except wiring notifications into webhooks)
# Chart components, signals CRUD (except adding dispatch calls), annotations
```

---

## 12. Testing & Validation

### Manual Verification Checklist

**Email Verification:**
- [ ] New signup receives verification email within 30s
- [ ] Clicking verification link sets `emailVerified` and shows success toast
- [ ] Expired token (>24hr) shows error with "Resend" option
- [ ] Unverified user cannot subscribe (error shown)
- [ ] Unverified analyst cannot publish signals (error shown)
- [ ] Resend verification is rate limited (1 per 5 min)

**Signal Notifications — In-App:**
- [ ] Analyst publishes signal → subscriber sees unread badge on bell icon within 30s
- [ ] Clicking bell shows the notification with correct signal details
- [ ] Clicking the notification navigates to the signal/analyst page
- [ ] "Mark all as read" clears the badge
- [ ] Notifications page shows full history with pagination
- [ ] Filter by type works (Signals, Announcements, Billing)

**Signal Notifications — Email:**
- [ ] Analyst publishes signal → subscriber receives email within 30s
- [ ] Email shows correct signal details (asset, direction, conviction)
- [ ] "View Signal" CTA links to the correct page
- [ ] Unsubscribe link in footer disables email for that analyst
- [ ] Subscriber who opted out of email signals does NOT receive email
- [ ] Subscriber with unverified email does NOT receive signal emails

**Signal Notifications — Telegram:**
- [ ] Subscriber generates link code → sends to bot → receives "Account linked" confirmation
- [ ] Analyst publishes signal → subscriber receives Telegram DM within 5s
- [ ] Message is properly formatted with HTML (bold, links)
- [ ] `/status` command returns correct linked status
- [ ] `/recent` command returns 5 most recent signal notifications
- [ ] `/unlink` command disables notifications
- [ ] Subscriber who blocked the bot → `isActive` set to false, no errors

**Batching:**
- [ ] Analyst publishes 1 signal → subscriber gets 1 notification immediately
- [ ] Analyst publishes 4 signals within 1 minute → subscriber gets 1st immediately, then 1 batch notification for the remaining 3

**Notification Preferences:**
- [ ] Global toggles apply to all analysts by default
- [ ] Per-analyst override works (e.g., email off for Analyst A, on for Analyst B)
- [ ] "Reset to default" clears the per-analyst override

**Stripe Webhook Notifications:**
- [ ] Subscription confirmed → in-app notification + email
- [ ] Payment failed → in-app notification + email with "Update Payment" CTA

### Email Deliverability

- [ ] Emails arrive in inbox (not spam) for Gmail, Outlook, Yahoo
- [ ] DKIM and SPF records pass (check via email headers)
- [ ] Unsubscribe header present (required by Gmail for bulk senders)
- [ ] Emails render correctly on mobile (iOS Mail, Gmail app)

---

## 13. Rollout Plan

1. **Prisma migration** — add Notification, NotificationPreferences, TelegramLink models + User verification fields
2. **Resend setup** — SDK, DNS records, send helper
3. **Email templates** — build and preview all templates with React Email dev server (`npx react-email dev`)
4. **Email verification** (4.2) — routes, enforcement, banner
5. **In-app notification system** (5.1–5.2) — model, API routes, bell component
6. **Notification dispatcher** (5.3) — central dispatch function
7. **Wire signal publication** (5.4) — dispatch calls in signal/announcement/webhook routes
8. **Notification preferences** (4.4 + 7) — model, API, settings UI
9. **Batching** (5.5) — batcher with 1-minute window
10. **Telegram bot** (6.1–6.4) — bot setup, webhook route, linking flow, message sending
11. **Telegram UI** (6.7) — linking card in settings
12. **End-to-end test** — publish a signal, verify delivery on all 3 channels
13. **Deploy to staging** — test webhook delivery, email deliverability
14. **Deploy to production** — register Telegram webhook for production URL, monitor delivery rates

---

## 14. Out of Scope

The following are explicitly NOT part of this phase:

- Push notifications (browser/PWA push — Phase 8)
- SMS alerts (not planned, Telegram covers mobile)
- Webhook API for programmatic signal consumption (Phase 8B)
- Discord integration (could be added later, similar pattern to Telegram)
- Email marketing campaigns (only transactional emails in this phase)
- Advanced analytics on notification delivery rates (monitor via Resend dashboard for now)
- In-app notification via WebSocket/SSE (polling is fine for launch; SSE upgrade is a stretch goal)
- Any changes to market data, charting, or the derivatives terminal
- Any changes to Stripe payment flow (except wiring notification dispatch into existing webhooks)
