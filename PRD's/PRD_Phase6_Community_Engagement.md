# PRD: Phase 6 — Community & Engagement

**Version:** 1.0
**Date:** April 7, 2026
**Status:** Ready for Implementation (after Phase 5 complete)
**Priority:** Medium — engagement features that turn the platform from a tool into a destination
**Depends On:** Phase 5 (subscriber experience), Phase 3 stub (notifications), Phase 2 stub (subscriptions)

---

## 1. Context

### Why This Phase Matters

Scope Alpha is currently transactional — analysts publish, subscribers consume. There's no community layer that makes users want to open the app when they don't have a specific task. Phase 6 adds the social connective tissue that creates habit loops: a chat room where subscribers discuss signals in real time, a feed that surfaces platform activity, the ability to follow analysts for free before committing to a subscription, and bookmarks/likes that give subscribers a personal content library.

### What Already Exists

**Chat System:**

| Feature | Status |
|---------|--------|
| Room-based messaging (one room per analyst) | ✅ Works |
| Reply threads (self-referencing ChatMessage) | ✅ Works |
| Message pinning | ✅ Works |
| Cursor pagination | ✅ Works |
| Subscription-gated access (Phase 2 stub) | ✅ Works |

| Missing | Impact |
|---------|--------|
| No typing indicators | Chat feels static |
| No read receipts / "seen by" | No engagement signal |
| No online status | Can't tell if anyone's active |
| No media sharing (images, screenshots) | Text-only limits discussion |
| No moderation tools (mute, ban, delete) | Analyst can't manage their community |
| No announcement integration in chat | Announcements and chat are disconnected |

**Social Features:**

Nothing exists. No activity feed, no follow mechanic, no likes, no bookmarks, no external sharing.

---

## 2. Goals

After this phase is complete:

1. Chat rooms have typing indicators, read receipts, and online presence
2. Subscribers and analysts can share images and chart screenshots in chat
3. Analysts have moderation tools: mute users, ban users, delete messages
4. Announcements surface inline in chat as special message types
5. An activity feed shows platform-wide and per-analyst activity (signals, resolutions, milestones)
6. Users can follow analysts without subscribing (free-tier engagement)
7. Users can like and bookmark signals for personal reference
8. Signals have Open Graph metadata for sharing to Twitter/X with rich card previews

---

## 3. Sub-Phase 6A — Chat System V2

### Objective

Upgrade the existing chat system from basic messaging to a real-time community experience with presence, media, and moderation.

### 3.1 Typing Indicators

**Approach — Lightweight polling (not WebSocket):**

The existing chat system is REST-based with polling. Adding full WebSocket support for typing indicators alone isn't worth the infrastructure change. Instead, use a short-lived Upstash key:

**When a user starts typing:**
- Client calls `POST /api/chat/[roomId]/typing` (debounced, fire once every 3 seconds while actively typing)
- Route sets an Upstash key: `chat:typing:{roomId}:{userId}` with a 5-second TTL
- The key auto-expires when the user stops typing

**When the chat UI polls for messages (existing polling interval):**
- Also fetch `GET /api/chat/[roomId]/presence` which returns currently typing users
- Route scans Upstash keys matching `chat:typing:{roomId}:*` (use `KEYS` or maintain a sorted set)
- Return: `{ typing: [{ userId, displayName }] }`

**Alternative — SSE piggyback:**
If the Phase 1 SSE infrastructure can be extended with custom events, publish typing events through SSE for near-instant delivery. Start with polling and upgrade if typing feels laggy.

**Frontend:**

Create: `components/chat/TypingIndicator.tsx`

- Shows below the message list: "{Name} is typing..." or "{Name1} and {Name2} are typing..."
- Animates with the classic three-dot bounce
- Disappears when the key expires (5 seconds of no typing activity)

### 3.2 Read Receipts

Track the last message each user has read in a room:

**Schema:**

```prisma
model ChatReadReceipt {
  id          String   @id @default(cuid())
  roomId      String
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  lastReadMessageId String
  lastReadAt  DateTime @default(now())

  @@unique([roomId, userId])
  @@index([roomId])
}
```

**When a user opens a chat room or scrolls to new messages:**
- Client calls `POST /api/chat/[roomId]/read` with `{ lastMessageId }`
- Route upserts the `ChatReadReceipt` record

**When messages are displayed:**
- `GET /api/chat/[roomId]` response includes a `readBy` summary per message:
  - For efficiency, don't return per-message read-by lists. Instead return the room's read receipt state: `{ readReceipts: { userId: lastReadMessageId }[] }`
  - The client computes which messages are "seen" by comparing message IDs

**Frontend display:**
- Below each message, show small avatar bubbles of users who have read up to that message
- Only show for the most recent few messages (last 5) to avoid visual clutter
- Show "Seen by X" count for older messages on hover

### 3.3 Online Presence

Track which users are currently active in a chat room:

**When a user has a chat room open:**
- Client pings `POST /api/chat/[roomId]/heartbeat` every 30 seconds
- Route sets Upstash key: `chat:presence:{roomId}:{userId}` with 60-second TTL
- Also stores: `chat:presence:user:{userId}` → `{ roomId, lastSeen }` with 60-second TTL (global "is online" check)

**Presence API:**
`GET /api/chat/[roomId]/presence`

Returns both typing and online users:
```typescript
interface PresenceData {
  online: Array<{ userId: string; displayName: string; avatar: string | null }>;
  typing: Array<{ userId: string; displayName: string }>;
}
```

**Frontend:**

Create: `components/chat/OnlineUsers.tsx`

- Sidebar panel (or header bar) in the chat room showing online users
- Green dot indicator next to online user avatars
- Count badge: "X online"

On analyst profile pages, show a small "Online" or "Last seen X ago" status near the analyst's name (read from `chat:presence:user:{userId}` or `chat:presence:user:{analystUserId}`).

### 3.4 Media Sharing in Chat

Allow users to share images and chart screenshots in chat messages.

**Schema change:**

```prisma
model ChatMessage {
  // ... existing fields ...
  mediaUrl    String?              // URL to shared image
  mediaType   String?              // "image/png" | "image/jpeg" | "image/webp"
}
```

**Upload route:**

`POST /api/chat/[roomId]/media`

Auth: Subscription-gated (same as posting messages).

1. Accept `multipart/form-data` with image file
2. Validate: max 2MB, PNG/JPEG/WebP only
3. Upload to R2/S3 via the existing `lib/storage/r2.ts` (inert mode returns null → reject with "Media sharing not configured")
4. Return `{ url, type }`

**Sending a message with media:**

Modify `POST /api/chat/[roomId]`:
- Accept optional `mediaUrl` and `mediaType` fields
- If present, the message renders with the image embedded

**Frontend:**

Modify: `components/chat/ChatInput.tsx`

- Add a paperclip / image icon button next to the send button
- Click opens a file picker (or the chart screenshot capture from Phase 4 if available)
- Selected image shows as a preview thumbnail above the input
- On send: upload to `/api/chat/[roomId]/media` first, then post the message with the returned URL

Modify: `components/chat/ChatMessage.tsx`

- If `mediaUrl` is present, render the image inline (max width constrained, click to expand)
- Lightbox or modal for full-size viewing on click

### 3.5 Moderation Tools

Give analysts control over their chat rooms.

**Schema:**

```prisma
model ChatRoomMember {
  id        String   @id @default(cuid())
  roomId    String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  role      String   @default("member")    // "member" | "muted" | "banned"
  mutedAt   DateTime?
  mutedUntil DateTime?                      // null = permanent mute
  bannedAt  DateTime?
  reason    String?

  @@unique([roomId, userId])
  @@index([roomId])
}
```

**Moderation API routes:**

`POST /api/chat/[roomId]/moderate`

Auth: Analyst who owns the room only.

Body:
```typescript
{
  action: 'mute' | 'unmute' | 'ban' | 'unban' | 'delete_message';
  targetUserId?: string;      // For mute/unmute/ban/unban
  messageId?: string;         // For delete_message
  duration?: number;          // Mute duration in hours (null = permanent)
  reason?: string;
}
```

Actions:
- **mute:** Set `ChatRoomMember.role = 'muted'`, `mutedUntil = now + duration`. Muted users can read but not post.
- **unmute:** Set `role = 'member'`, clear mute fields.
- **ban:** Set `role = 'banned'`, `bannedAt = now`. Banned users can't see the room at all.
- **unban:** Set `role = 'member'`, clear ban fields.
- **delete_message:** Soft-delete a message by setting a `deletedAt` timestamp (don't hard delete — keep for audit trail). Show "[Message deleted by analyst]" in the UI.

**Enforce in message posting:**
- Modify `POST /api/chat/[roomId]` to check `ChatRoomMember` role:
  - `muted` → 403 with "You are muted in this room" (check `mutedUntil` for auto-unmute)
  - `banned` → 403 with "You are banned from this room"
- Modify `GET /api/chat/[roomId]` to return 403 for banned users

**Schema change to ChatMessage:**

```prisma
model ChatMessage {
  // ... existing fields ...
  deletedAt   DateTime?     // Soft delete for moderation
  deletedBy   String?       // User ID who deleted it
}
```

**Frontend:**

Create: `components/chat/ModerationMenu.tsx`

- Context menu (right-click or three-dot menu) on each message, visible only to the room owner (analyst)
- Options: "Delete Message", "Mute User (1h / 24h / permanent)", "Ban User"
- Confirmation dialog for ban actions

Create: `components/chat/MutedBanner.tsx`

- If the current user is muted, show a banner above the input: "You are muted. You can read messages but cannot post." with the unmute time if temporary.

Create: `components/chat/BannedState.tsx`

- If the current user is banned, show a full-room replacement: "You have been banned from this room." with the reason if provided.

### 3.6 Announcement Integration in Chat

When an analyst posts an announcement, also render it inline in the chat room as a special pinned message.

**Approach:**

When `POST /api/announcements` creates an announcement:
1. Also create a `ChatMessage` in the analyst's room with:
   - `content` = announcement text (or a truncated preview)
   - A new field `messageType = 'announcement'` (default for regular messages is `'message'`)
   - `isPinned = true`
2. The chat UI renders announcement messages with a distinct style: highlighted background, "📢 Announcement" label, full-width

**Schema change:**

```prisma
model ChatMessage {
  // ... existing fields ...
  messageType   String  @default("message")   // "message" | "announcement" | "system"
}
```

**Frontend:**

Modify: `components/chat/ChatMessage.tsx`

- If `messageType === 'announcement'`: render with accent border, announcement icon, different background
- If `messageType === 'system'`: render as gray centered text (for future "User joined" type messages)

---

## 4. Sub-Phase 6B — Social Feed

### Objective

Build a platform activity feed, a free follow mechanic, signal likes/bookmarks, and external sharing with rich previews.

### 4.1 Activity Feed

**Schema:**

```prisma
model FeedEvent {
  id          String   @id @default(cuid())
  type        String                // Event type (see table below)
  actorId     String                // User who triggered the event
  actor       User     @relation(fields: [actorId], references: [id])
  analystId   String?               // Analyst the event is about (for filtering)
  signalId    String?               // Related signal (if applicable)
  metadata    Json?                 // Type-specific data
  visibility  String   @default("public")  // "public" | "subscribers"
  createdAt   DateTime @default(now())

  @@index([analystId, createdAt])
  @@index([actorId, createdAt])
  @@index([createdAt])
}
```

**Event types:**

| Type | Trigger | Visibility | Metadata |
|------|---------|-----------|----------|
| `signal_published` | Analyst publishes a signal | `public` (preview) or `subscribers` (full) | `{ asset, direction, conviction, timeframe }` |
| `signal_resolved` | Analyst resolves a signal | `public` | `{ asset, direction, resultPnl }` |
| `milestone_signals` | Analyst hits 50/100/250/500 signals | `public` | `{ count }` |
| `milestone_subscribers` | Analyst hits 10/50/100/500 subscribers | `public` | `{ count }` |
| `milestone_winstreak` | Analyst hits 5/10/15 win streak | `public` | `{ streak }` |
| `announcement` | Analyst posts announcement | `subscribers` | `{ title, preview }` |
| `new_analyst` | User becomes an analyst | `public` | `{ tagline }` |

**Event creation:**

Events are created as side effects in existing routes. Add `createFeedEvent()` calls to:
- `POST /api/signals` (when status = 'active') → `signal_published`
- `POST /api/signals/[id]/resolve` → `signal_resolved` + check milestones
- `POST /api/signals/[id]/publish` (draft → active) → `signal_published`
- `POST /api/announcements` → `announcement`
- `POST /api/users/become-analyst` → `new_analyst`

Create: `lib/feed/events.ts`

```typescript
export async function createFeedEvent(params: {
  type: string;
  actorId: string;
  analystId?: string;
  signalId?: string;
  metadata?: Record<string, any>;
  visibility?: 'public' | 'subscribers';
}): Promise<void> {
  await prisma.feedEvent.create({ data: params });

  // Check milestones after signal events
  if (params.type === 'signal_resolved') {
    await checkAndCreateMilestones(params.actorId);
  }
}

async function checkAndCreateMilestones(analystId: string): Promise<void> {
  const perf = await prisma.analystPerformance.findUnique({ where: { userId: analystId } });
  if (!perf) return;

  const milestones = [
    { field: 'totalSignals', thresholds: [50, 100, 250, 500], type: 'milestone_signals' },
    { field: 'subscriberCount', thresholds: [10, 50, 100, 500], type: 'milestone_subscribers' },
    { field: 'currentWinStreak', thresholds: [5, 10, 15], type: 'milestone_winstreak' },
  ];

  for (const m of milestones) {
    const value = perf[m.field];
    for (const threshold of m.thresholds) {
      if (value === threshold) {
        // Check we haven't already created this milestone
        const exists = await prisma.feedEvent.findFirst({
          where: { actorId: analystId, type: m.type, metadata: { path: ['count'], equals: threshold } },
        });
        if (!exists) {
          await prisma.feedEvent.create({
            data: {
              type: m.type,
              actorId: analystId,
              analystId,
              metadata: { count: value },
              visibility: 'public',
            },
          });
        }
      }
    }
  }
}
```

### 4.2 Feed API Routes

**Global feed:** `GET /api/feed`

Query: `?limit=20&cursor={id}&filter=all|signals|milestones`

Returns public events from all analysts, newest first. For `signal_published` events with `visibility = 'subscribers'`, show the preview version (asset + direction only, no prices). Subscribers to that analyst see the full metadata.

**Per-analyst feed:** `GET /api/feed?analystId={id}`

Same as global but filtered to one analyst. Subscriber-gated events show full content if the viewer is subscribed.

**Following feed:** `GET /api/feed/following`

Auth: Logged in. Returns events only from analysts the user follows (see 4.3). This is the "personalized" feed.

Response shape:
```typescript
interface FeedItem {
  id: string;
  type: string;
  actor: {
    slug: string;
    displayName: string;
    avatar: string | null;
  };
  signal?: {
    id: string;
    asset: string;
    direction: string;
    conviction?: string;       // null if gated
    resultPnl?: number;        // null if gated or unresolved
  };
  metadata: Record<string, any>;
  visibility: string;
  isFullAccess: boolean;        // true if viewer has subscription access
  createdAt: string;
}
```

Cache the global feed with 60-second TTL: `feed:global:{filter}:{cursor}`. Per-analyst and following feeds are not cached (personalized).

### 4.3 Follow Mechanic (Free Tier)

Allow users to follow analysts without subscribing. Followers see public activity in their personalized feed and get a lightweight connection to the analyst.

**Schema:**

```prisma
model Follow {
  id          String   @id @default(cuid())
  followerId  String
  follower    User     @relation("Following", fields: [followerId], references: [id])
  analystId   String
  analyst     User     @relation("Followers", fields: [analystId], references: [id])
  createdAt   DateTime @default(now())

  @@unique([followerId, analystId])
  @@index([followerId])
  @@index([analystId])
}
```

**API routes:**

`POST /api/follow`
Auth: Logged in. Body: `{ analystId }`. Creates a follow. Returns 409 if already following.

`DELETE /api/follow?analystId={id}`
Auth: Logged in. Removes the follow.

`GET /api/follow/status?analystId={id}`
Auth: Logged in. Returns `{ isFollowing: boolean, isSubscribed: boolean }`.

`GET /api/analysts/[slug]/followers`
Public. Returns `{ followerCount: number }`.

**Relationship hierarchy:**
- **Follow** = free, sees public feed activity, counts toward analyst's follower count
- **Subscribe** = paid, includes everything follow gives plus full signal access, chat, annotations
- Subscribing automatically creates a follow (if not already following). Unsubscribing does NOT auto-unfollow — the user retains the free follow.

**Frontend:**

Modify analyst profile page and analyst cards:
- Show a "Follow" button if not following and not subscribed
- Show "Following ✓" if following but not subscribed (with dropdown: "Unfollow")
- Show "Subscribed ✓" if subscribed (follow is implicit)
- Show follower count on analyst profile (separate from subscriber count)

### 4.4 Signal Likes & Bookmarks

Let subscribers interact with signals beyond just tracking them.

**Schema:**

```prisma
model SignalLike {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  signalId  String
  signal    Signal   @relation(fields: [signalId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, signalId])
  @@index([signalId])
}

model SignalBookmark {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  signalId  String
  signal    Signal   @relation(fields: [signalId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, signalId])
  @@index([userId, createdAt])
  @@index([signalId])
}
```

**Denormalized count on Signal:**

```prisma
model Signal {
  // ... existing fields ...
  likeCount    Int   @default(0)
  likes        SignalLike[]
  bookmarks    SignalBookmark[]
}
```

**API routes:**

`POST /api/signals/[id]/like` — toggle like (create if not exists, delete if exists). Recompute `likeCount`.
`POST /api/signals/[id]/bookmark` — toggle bookmark (create/delete).
`GET /api/bookmarks` — list user's bookmarked signals, newest first, paginated.
`GET /api/signals/[id]` — include `isLiked` and `isBookmarked` booleans for the current user.

**Frontend:**

Modify signal cards and signal detail views:
- Heart icon with like count (filled if liked by current user)
- Bookmark icon (filled if bookmarked)
- Both are optimistic-update toggles

Create: `app/bookmarks/page.tsx`
- Grid of bookmarked signal cards, sorted by bookmark date
- Empty state: "Bookmark signals to save them for later"
- Add "Bookmarks" to the sidebar navigation

### 4.5 External Sharing (Open Graph / Twitter Cards)

When a signal URL is shared to Twitter/X, LinkedIn, or any platform that reads Open Graph tags, show a rich card preview.

**Implementation:**

Modify the signal detail page's metadata (Next.js `generateMetadata`):

```typescript
// app/signal/[id]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const signal = await getSignal(params.id);
  const analyst = await getAnalyst(signal.analystId);

  const direction = signal.direction.toUpperCase();
  const emoji = signal.direction === 'long' ? '🟢' : '🔴';

  return {
    title: `${emoji} ${signal.asset} ${direction} — ${analyst.displayName} on Scope Alpha`,
    description: `${analyst.displayName} published a ${signal.conviction} conviction ${direction} signal on ${signal.asset}. View on Scope Alpha.`,
    openGraph: {
      title: `${signal.asset} ${direction} Signal`,
      description: `${signal.conviction} conviction ${direction} on ${signal.asset} by ${analyst.displayName}`,
      type: 'article',
      url: `https://scopealpha.com/signal/${signal.id}`,
      images: signal.screenshotUrl ? [{ url: signal.screenshotUrl }] : [],
    },
    twitter: {
      card: signal.screenshotUrl ? 'summary_large_image' : 'summary',
      title: `${emoji} ${signal.asset} ${direction} — ${analyst.displayName}`,
      description: `${signal.conviction} conviction | View full signal on Scope Alpha`,
    },
  };
}
```

**Note:** The OG metadata intentionally does NOT include prices (entry/target/stop). This drives traffic to the platform — the card shows enough to be intriguing (asset + direction + analyst), but you need to visit the site to see the trade details.

**Share button:**

Create: `components/signals/ShareButton.tsx`

- Copy link to clipboard (primary action)
- Share to Twitter/X (pre-composed tweet with signal URL)
- Native share sheet on mobile (via `navigator.share` if available)

**Signal detail page:**

Create: `app/signal/[id]/page.tsx`

A public landing page for individual signals:
- Shows the signal card with full details (gated per Phase 2 access rules)
- Shows the analyst mini-profile (avatar, name, win rate)
- CTA: "Subscribe to {analyst} for full access" if not subscribed
- This page is what the OG tags point to

---

## 5. New Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| None | All features use existing packages | — |

If the share button needs a Twitter intent URL builder, that's just string concatenation — no library needed.

---

## 6. Environment Variables

No new environment variables. Media uploads reuse the existing R2 configuration from Phase 4 (inert when not configured). Typing/presence use the existing Upstash Redis from Phase 1.

---

## 7. Prisma Schema Changes (Summary)

```prisma
// New models
model ChatReadReceipt {
  id                String   @id @default(cuid())
  roomId            String
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  lastReadMessageId String
  lastReadAt        DateTime @default(now())
  @@unique([roomId, userId])
  @@index([roomId])
}

model ChatRoomMember {
  id         String    @id @default(cuid())
  roomId     String
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  role       String    @default("member")   // "member" | "muted" | "banned"
  mutedAt    DateTime?
  mutedUntil DateTime?
  bannedAt   DateTime?
  reason     String?
  @@unique([roomId, userId])
  @@index([roomId])
}

model FeedEvent {
  id          String   @id @default(cuid())
  type        String
  actorId     String
  actor       User     @relation(fields: [actorId], references: [id])
  analystId   String?
  signalId    String?
  metadata    Json?
  visibility  String   @default("public")
  createdAt   DateTime @default(now())
  @@index([analystId, createdAt])
  @@index([actorId, createdAt])
  @@index([createdAt])
}

model Follow {
  id          String   @id @default(cuid())
  followerId  String
  follower    User     @relation("Following", fields: [followerId], references: [id])
  analystId   String
  analyst     User     @relation("Followers", fields: [analystId], references: [id])
  createdAt   DateTime @default(now())
  @@unique([followerId, analystId])
  @@index([followerId])
  @@index([analystId])
}

model SignalLike {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  signalId  String
  signal    Signal   @relation(fields: [signalId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, signalId])
  @@index([signalId])
}

model SignalBookmark {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  signalId  String
  signal    Signal   @relation(fields: [signalId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@unique([userId, signalId])
  @@index([userId, createdAt])
  @@index([signalId])
}

// Changes to existing models
model ChatMessage {
  // Add:
  mediaUrl      String?
  mediaType     String?
  deletedAt     DateTime?
  deletedBy     String?
  messageType   String    @default("message")  // "message" | "announcement" | "system"
}

model Signal {
  // Add:
  likeCount     Int      @default(0)
  likes         SignalLike[]
  bookmarks     SignalBookmark[]
}

model User {
  // Add relations:
  chatReadReceipts  ChatReadReceipt[]
  chatRoomMembers   ChatRoomMember[]
  feedEvents        FeedEvent[]
  following         Follow[]   @relation("Following")
  followers         Follow[]   @relation("Followers")
  signalLikes       SignalLike[]
  signalBookmarks   SignalBookmark[]
}
```

---

## 8. File Structure

**New files:**

```
lib/
  feed/
    events.ts                                    # createFeedEvent() + milestone checker
  chat/
    moderation.ts                                # Mute/ban check helpers

app/api/
  chat/
    [roomId]/
      typing/route.ts                           # POST — set typing indicator in Upstash
      presence/route.ts                         # GET — online users + typing users
      read/route.ts                             # POST — update read receipt
      media/route.ts                            # POST — upload image for chat
      moderate/route.ts                         # POST — mute/ban/delete actions
      heartbeat/route.ts                        # POST — online presence ping
  feed/
    route.ts                                    # GET — global or per-analyst feed
    following/route.ts                          # GET — personalized following feed
  follow/
    route.ts                                    # POST (follow), DELETE (unfollow)
    status/route.ts                             # GET — follow/subscribe status check
  signals/
    [id]/
      like/route.ts                             # POST — toggle like
      bookmark/route.ts                         # POST — toggle bookmark
  bookmarks/route.ts                            # GET — user's bookmarked signals

app/
  feed/page.tsx                                 # Global activity feed page
  bookmarks/page.tsx                            # User's bookmarked signals
  signal/[id]/page.tsx                          # Public signal detail page (OG landing)

components/
  chat/
    TypingIndicator.tsx                         # "{Name} is typing..." with dot animation
    OnlineUsers.tsx                             # Sidebar/header showing online users
    ModerationMenu.tsx                          # Right-click/three-dot moderation actions
    MutedBanner.tsx                             # "You are muted" banner above input
    BannedState.tsx                             # Full-room "You are banned" replacement
    ChatMediaPreview.tsx                        # Inline image rendering in messages
  feed/
    FeedPage.tsx                                # Feed layout with filter tabs
    FeedItem.tsx                                # Single feed event card
    FeedSignalEvent.tsx                         # Signal published/resolved event
    FeedMilestoneEvent.tsx                      # Milestone celebration event
    FeedAnnouncementEvent.tsx                   # Announcement event
  social/
    FollowButton.tsx                            # Follow / Following ✓ / Subscribed ✓ states
    LikeButton.tsx                              # Heart icon with count, optimistic toggle
    BookmarkButton.tsx                          # Bookmark icon, optimistic toggle
    ShareButton.tsx                             # Copy link + share to Twitter/X + native share

stores/
  socialStore.ts                                # Zustand: followed analyst IDs, liked/bookmarked signal IDs
```

**Existing files to modify:**

```
prisma/schema.prisma                            # All new models + field additions above

app/api/chat/[roomId]/route.ts                  # Enforce mute/ban checks on POST
                                                # Include read receipt state in GET response
                                                # Filter out banned users' visibility
                                                # Render deleted messages as "[Deleted]"

app/api/announcements/route.ts                  # Also create a ChatMessage with messageType='announcement'
                                                # Also create a FeedEvent

app/api/signals/route.ts                        # Include isLiked/isBookmarked in GET for authenticated users
                                                # Create FeedEvent on publish

app/api/signals/[id]/route.ts                   # Include isLiked/isBookmarked
app/api/signals/[id]/publish/route.ts           # Create FeedEvent on draft→active
app/api/signals/[id]/resolve/route.ts           # Create FeedEvent + check milestones

app/api/users/become-analyst/route.ts           # Create FeedEvent 'new_analyst'

components/chat/ChatMessage.tsx                 # Render media, announcement style, deleted state
components/chat/ChatInput.tsx                   # Add media upload button
components/chat/ChatRoom.tsx                    # Add TypingIndicator, OnlineUsers, moderation context

components/terminal/SignalCard.tsx               # Add LikeButton, BookmarkButton, ShareButton
components/analyst/AnalystCard.tsx               # Add FollowButton
app/analyst/[slug]/page.tsx                     # Add FollowButton, follower count, online status

components/layout/Sidebar.tsx                   # Add "Feed" and "Bookmarks" nav items
```

**Files to leave alone:**

```
# All Phase 1–5 infrastructure
# Market data, charting, terminal
# Auth, Stripe stubs, notification stubs
# Annotation system
# Portfolio tracking (Phase 5)
# Performance analytics (Phase 4)
```

---

## 9. Testing & Validation

### Manual Verification Checklist

**Chat — Typing Indicators:**
- [ ] User starts typing → other users in the room see "Name is typing..." within 5 seconds
- [ ] User stops typing → indicator disappears after 5 seconds
- [ ] Multiple users typing → "Name1 and Name2 are typing..."

**Chat — Read Receipts:**
- [ ] Opening a chat room marks messages as read
- [ ] Other users see "Seen by" avatars on recent messages
- [ ] Scrolling to old messages does not show per-message read-by (only recent 5)

**Chat — Online Presence:**
- [ ] Users with the chat room open show as "online" with green dot
- [ ] Closing the tab → user disappears from online list within 60 seconds
- [ ] Analyst profile shows "Online" or "Last seen X ago"

**Chat — Media Sharing:**
- [ ] Click image icon → file picker opens
- [ ] Select image → preview shows above input
- [ ] Send → image renders inline in chat
- [ ] Click image → full-size lightbox opens
- [ ] Files > 2MB rejected with error
- [ ] If R2 not configured → "Media sharing not available" message

**Chat — Moderation:**
- [ ] Analyst right-clicks a message → moderation menu appears
- [ ] "Delete Message" → message shows "[Message deleted by analyst]"
- [ ] "Mute User (1h)" → user sees muted banner, cannot post, auto-unmutes after 1hr
- [ ] "Ban User" → user sees banned state, cannot see room content
- [ ] "Unban" → user regains access
- [ ] Non-analyst users do NOT see moderation menu

**Chat — Announcements in Chat:**
- [ ] Analyst posts announcement → appears in chat room with announcement styling
- [ ] Announcement message is auto-pinned

**Feed:**
- [ ] Signal published → event appears in global feed within 60 seconds
- [ ] Signal resolved → event appears with result P&L
- [ ] Analyst hits 50 signals → milestone event appears
- [ ] Feed filters work: all / signals / milestones
- [ ] Following feed shows only events from followed analysts

**Follow:**
- [ ] Click "Follow" on analyst card → button changes to "Following ✓"
- [ ] Click "Unfollow" → reverts
- [ ] Subscribe to analyst → follow is implicit
- [ ] Unsubscribe → follow remains (does not auto-unfollow)
- [ ] Follower count on profile is accurate

**Likes & Bookmarks:**
- [ ] Click heart on signal → count increments, heart fills
- [ ] Click again → count decrements, heart empties
- [ ] Click bookmark → signal appears in /bookmarks
- [ ] Remove bookmark → signal disappears from /bookmarks
- [ ] Like count persists across page loads

**Sharing:**
- [ ] "Copy Link" copies the signal URL to clipboard
- [ ] "Share to Twitter" opens a new tab with pre-composed tweet
- [ ] Signal URL shows rich OG card preview (test via Twitter Card Validator or opengraph.xyz)
- [ ] OG card shows asset, direction, analyst name — NOT prices

---

## 10. Rollout Plan

1. **Prisma migration** — all new models + field additions
2. **Chat moderation** (3.5) — ChatRoomMember model, moderation route, enforce in message posting
3. **Chat media** (3.4) — upload route, message rendering, input UI
4. **Chat presence** (3.1 + 3.3) — typing indicators + online status via Upstash
5. **Chat read receipts** (3.2) — receipt model, mark-as-read, display
6. **Announcement in chat** (3.6) — wire announcement creation to chat message
7. **Feed event model + creation** (4.1) — model, createFeedEvent(), milestone checker
8. **Feed API routes** (4.2) — global, per-analyst, following feeds
9. **Follow mechanic** (4.3) — model, API, button, auto-follow on subscribe
10. **Likes & bookmarks** (4.4) — models, toggle routes, UI buttons, bookmarks page
11. **Signal detail page + OG tags** (4.5) — public landing page, metadata, share button
12. **Feed UI** (4.2) — feed page, feed items, filter tabs
13. **Wire feed events** — add createFeedEvent() calls into existing signal/announcement routes
14. **End-to-end test** — publish signal → see in feed → like → bookmark → share → verify OG card
15. **Deploy to staging** — verify Upstash presence keys, media uploads, feed population

---

## 11. Out of Scope

The following are explicitly NOT part of this phase:

- Real-time WebSocket chat (polling + Upstash presence is sufficient for alpha)
- Direct messages between users (only analyst room chat)
- User-to-user following (only follow analysts)
- Comment threads on signals (likes/bookmarks only — keep signals clean)
- Notification integration for feed events (Phase 3 stub stays as-is)
- Algorithm-ranked feed (chronological only)
- Content recommendation engine
- Embedded signal widgets for external sites
- Video/audio sharing in chat
- Emoji reactions on chat messages (keep it to text + images for now)
- Chat message search
- Chat export / history download
- Any changes to market data, payments, portfolio, analytics, or auth
