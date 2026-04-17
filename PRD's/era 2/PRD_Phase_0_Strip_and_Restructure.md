# PRD: Phase 0 — Strip & Restructure

**Version:** 1.0
**Date:** April 16, 2026
**Status:** Ready for Implementation
**Priority:** Critical Path — blocks all subsequent phases

---

## 1. Context

### What Is Changing

Scope Alpha is pivoting from a **crypto trading signals marketplace** (analysts publish signals, subscribers pay per-analyst) to a **crypto analytics and quantitative intelligence platform** (the platform itself provides derivatives data, options analytics, on-chain metrics, and proprietary quantitative tools to all users).

This pivot eliminates all regulatory risk from hosting unregistered financial advice. The new product is a data and tools platform — same category as Glassnode, Coinglass, and Bloomberg Terminal. We sell data and computation, not recommendations.

### Why Phase 0 Exists

The current codebase is built around a marketplace model: analyst profiles, per-analyst subscriptions, trading signals, reviews, chat rooms, announcements, and social features. All of this must be removed before building the analytics platform. If we build new features on top of old marketplace code, we'll have dead code paths, confusing data models, broken references, and a codebase that fights us at every step.

Phase 0 is a controlled demolition. Strip everything marketplace-related, restructure the database, rebuild the navigation and information architecture, and leave a clean foundation for Phase 1 (Live Derivatives Data).

### What We Are NOT Doing in Phase 0

- No new data integrations (that's Phase 1)
- No new analytics features
- No payment/subscription system (deferred to much later)
- No new external service integrations
- We are not building the Quant Engine service yet

### Current Tech Stack (Unchanged)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14.2.5, React 18.3.1, TypeScript 5.4.5 |
| State Management | Zustand 4.5.2 with localStorage persistence |
| Styling | Tailwind CSS 3.4.4, custom glass-morphism design system |
| Charts | Lightweight Charts 4.2.0 |
| Auth | NextAuth 4.24.13, JWT sessions, bcrypt, Google OAuth |
| Database | PostgreSQL via Neon, connection pooling |
| ORM | Prisma 6.19.2 |
| Deployment | Vercel (frontend) + Neon PostgreSQL (database) |

---

## 2. Current State — What Exists

### 2.1 Database Models (Prisma Schema)

These 10+ models currently exist. This section documents what each does so the removal scope is clear.

**KEEP (with modifications):**

| Model | Purpose | Phase 0 Action |
|-------|---------|----------------|
| `User` | Core account: email, password hash, display name, slug, role, avatar, bio, social links, Stripe fields | **Modify** — remove analyst-specific fields, simplify role system |

**REMOVE:**

| Model | Purpose | Why It Goes |
|-------|---------|-------------|
| `AnalystProfile` | Extended analyst profile: tagline, primary assets, trading style, experience, subscription acceptance flag | Marketplace concept — no more individual analysts |
| `AnalystPerformance` | Calculated metrics: total signals, win count/rate, P&L%, profit factor, Sharpe-like ratios, subscriber count | Signal performance tracking — removed with signals |
| `Signal` | Trading callouts: asset, direction, entry/target/stop, timeframe, conviction, publish timestamp, result P&L% | Core of the "financial advice" model — the thing we're eliminating |
| `Annotation` | Chart drawings: horizontal lines, zones, text notes tied to asset/timeframe with active/draft status | Analyst-owned annotations — may rebuild as user-owned later, but current implementation is tied to analyst model |
| `SubscriptionTier` | Per-analyst pricing tiers ($50–$2,000/mo) with feature lists, stripePriceId | Per-analyst monetization — replaced by platform-level tiers later |
| `Subscription` | Links subscriber to analyst via tier, tracks period dates, stripeSubscriptionId, stripeCustomerId | Per-analyst subscriptions — removed entirely |
| `ChatMessage` | Room-based messaging with reply threads, pinning, media, moderation | Community chat tied to analyst rooms — not relevant to analytics platform |
| `ChatReadReceipt` | Read receipt tracking per room per user | Part of chat system |
| `ChatRoomMember` | Room membership with roles, mute/ban | Part of chat system |
| `Announcement` | Analyst broadcasts to subscribers | Analyst-specific feature |
| `Review` | Subscriber ratings (1–5 stars) with text and analyst responses | Analyst review system |
| `FeedEvent` | Social feed events (signal published, milestone reached, etc.) | Social/marketplace feature |
| `Follow` | User-to-analyst follow relationships | Social/marketplace feature |
| `SignalLike` | Signal like/heart interactions | Social/marketplace feature |
| `SignalBookmark` | Signal bookmark/save interactions | Social/marketplace feature |

### 2.2 API Routes

**Routes to REMOVE:**

```
app/api/signals/                        # All signal CRUD
app/api/signals/[id]/                   # Individual signal operations
app/api/signals/[id]/like/              # Signal likes
app/api/signals/[id]/bookmark/          # Signal bookmarks
app/api/annotations/                    # Annotation CRUD
app/api/subscriptions/                  # Per-analyst subscriptions
app/api/subscriptions/[id]/             # Individual subscription management
app/api/subscriptions/checkout/         # Stripe checkout for analyst subscriptions
app/api/subscription-tiers/             # Per-analyst tier management
app/api/reviews/                        # Review CRUD
app/api/chat/                           # All chat routes
app/api/chat/[roomId]/                  # Room-based messaging
app/api/chat/[roomId]/typing/           # Typing indicators
app/api/chat/[roomId]/presence/         # Online presence
app/api/chat/[roomId]/read/             # Read receipts
app/api/chat/[roomId]/media/            # Chat media upload
app/api/chat/[roomId]/moderate/         # Moderation actions
app/api/chat/[roomId]/heartbeat/        # Presence heartbeat
app/api/announcements/                  # Announcement CRUD
app/api/analysts/                       # Analyst profile lookup
app/api/analysts/[slug]/                # Analyst profile by slug
app/api/analysts/revenue/               # Analyst revenue dashboard
app/api/feed/                           # Social feed
app/api/feed/following/                 # Following feed
app/api/follow/                         # Follow/unfollow
app/api/follow/status/                  # Follow status check
app/api/bookmarks/                      # User bookmarks list
app/api/stripe/                         # All Stripe routes (Connect, webhooks, billing portal)
app/api/users/become-analyst/           # Role upgrade to analyst (or similar)
```

**Routes to KEEP:**

```
app/api/auth/                           # All auth routes (signup, login, NextAuth callbacks, demo)
app/api/users/                          # User profile management (simplified)
```

### 2.3 Frontend Pages

**Pages to REMOVE:**

```
app/marketplace/                        # Analyst marketplace browse page
app/analyst/[slug]/                     # Individual analyst profile page
app/signal/[id]/                        # Public signal detail page
app/feed/                               # Social activity feed
app/bookmarks/                          # User bookmarked signals
app/subscriptions/                      # Subscriber billing dashboard
app/settings/payments/                  # Analyst Stripe Connect onboarding
```

**Pages to KEEP (with modifications):**

```
app/                                    # Landing page — needs complete rewrite
app/settings/                           # Account settings — simplify, remove analyst-specific
app/terminal/                           # Main dashboard — keep and restructure as analytics shell
```

### 2.4 Components

**Component directories to REMOVE entirely:**

```
components/signals/                     # SignalCard, SignalForm, SignalList, etc.
components/chat/                        # ChatRoom, ChatMessage, TypingIndicator, ModerationMenu, etc.
components/marketplace/                 # AnalystCard, MarketplaceFilters, etc.
components/social/                      # FollowButton, LikeButton, BookmarkButton, ShareButton
components/feed/                        # FeedPage, FeedItem, FeedSignalEvent, etc.
components/ui/Paywall.tsx               # Subscription paywall
components/ui/GracePeriodBanner.tsx      # Payment failure banner
components/ui/CancellationBanner.tsx     # Cancellation notice
components/ui/StripeConnectStatus.tsx    # Analyst Stripe status
```

**Components to KEEP:**

```
components/charts/                      # All Lightweight Charts components — core to analytics
components/terminal/                    # Derivatives terminal components (funding, OI, liquidations, basis, screener)
components/ui/                          # Generic UI components (buttons, inputs, modals, etc.) — keep all except marketplace-specific ones listed above
components/layout/                      # Layout shell, header, sidebar — will be modified
```

### 2.5 Zustand Stores

**Stores to REMOVE:**

```
stores/signalStore.ts                   # Signal state
stores/annotationStore.ts               # Annotation state (if exists)
stores/chatStore.ts                     # Chat state (if exists)
stores/socialStore.ts                   # Follow/like/bookmark state
```

**Stores to KEEP:**

```
stores/marketDataStore.ts               # Market data state (if exists) — core to analytics
stores/terminalStore.ts                 # Terminal/dashboard state (if exists)
```

### 2.6 Existing Infrastructure to KEEP

Everything from the Phase 1 live data work (if partially built):

```
lib/ws-manager.ts                       # WebSocket connection manager
lib/stream-coordinator.ts               # SSE stream coordination
lib/cache.ts                            # Redis/Upstash caching utilities
lib/market-data/                        # Any existing market data utilities
```

Also keep:

```
lib/auth.ts                             # Auth utilities
lib/prisma.ts                           # Prisma client singleton
lib/utils.ts                            # General utilities
middleware.ts                           # Next.js middleware (auth checks, CSRF, rate limiting)
```

### 2.7 Configuration & External Services

**Keep:**
- NextAuth configuration
- Prisma configuration
- Tailwind configuration
- Vercel deployment configuration
- Upstash Redis configuration (if exists)
- All environment variables for auth, database, Redis

**Remove references to:**
- Stripe (Connect, webhooks, checkout) — all env vars and config
- R2/Cloudflare (chat media uploads) — unless used elsewhere
- Telegram bot (was for signal alerts) — will be rebuilt for platform alerts later

---

## 3. Goals

After Phase 0 is complete:

1. **Zero marketplace code remains.** No signals, no analyst profiles, no per-analyst subscriptions, no reviews, no chat, no announcements, no social features, no feed. The codebase should have no references to these concepts.

2. **Database is clean.** Only the User model (simplified) and new platform models remain. All marketplace models are dropped via migration.

3. **Navigation reflects an analytics platform.** Sidebar navigation with sections for: Derivatives, Volatility (coming soon), On-Chain (coming soon), Macro (coming soon), Sentiment (coming soon), Tools (coming soon).

4. **The existing derivatives terminal still works.** The terminal components (funding rates, OI, liquidations, basis, screener) should render under the new routing structure. If they currently display mock data, that's fine — Phase 1 replaces it with live data.

5. **The app compiles and runs cleanly.** No broken imports, no dead references, no TypeScript errors from removed models.

6. **Auth still works.** Users can sign up, log in (email/password, Google OAuth), and access the app. The demo login flow can be simplified or removed — it was designed for marketplace exploration and may not be relevant.

---

## 4. New Database Schema

### 4.1 User Model (Simplified)

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  emailVerified   DateTime?
  passwordHash    String?
  name            String?
  displayName     String?
  slug            String?   @unique
  avatar          String?
  bio             String?
  
  // Auth
  provider        String    @default("credentials")  // credentials | google
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastLoginAt     DateTime?
  
  // Relations (new platform models)
  preferences     UserPreferences?
  alerts          Alert[]
  watchlists      Watchlist[]
  
  @@index([email])
  @@index([slug])
}
```

**Removed from User:**
- `role` field (subscriber/analyst distinction — no longer relevant)
- `stripeCustomerId` (no payments yet)
- `stripeConnectId` (no Stripe Connect)
- All analyst-related relations (AnalystProfile, signals, annotations, tiers, etc.)
- All social relations (follows, likes, bookmarks, feed events)
- All chat relations (messages, read receipts, room members)
- All subscription relations

### 4.2 New Platform Models

```prisma
model UserPreferences {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Display
  defaultAsset    String   @default("BTC")
  defaultTimeframe String  @default("1H")
  theme           String   @default("dark")
  
  // Layout
  savedLayouts    Json?    // Stored dashboard layout configurations
  
  // Timestamps
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Watchlist {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String   @default("Default")
  assets          String[] // Array of asset symbols: ["BTC", "ETH", "SOL"]
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([userId])
}

model Alert {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Alert definition
  name            String
  asset           String              // "BTC", "ETH", etc.
  type            String              // "funding_rate", "oi_change", "liquidation", "price", "basis"
  condition       String              // "above", "below", "crosses_above", "crosses_below", "change_exceeds"
  value           Float               // Threshold value
  timeframe       String?             // For change-based alerts: "1h", "4h", "24h"
  
  // State
  isActive        Boolean  @default(true)
  lastTriggered   DateTime?
  triggerCount    Int      @default(0)
  
  // Delivery (for future phases — store preference now)
  deliveryMethod  String   @default("in_app")  // "in_app", "email", "telegram", "webhook"
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([userId, isActive])
  @@index([asset, type, isActive])
}

model AlertHistory {
  id              String   @id @default(cuid())
  alertId         String
  
  // Snapshot of what triggered
  asset           String
  type            String
  condition       String
  threshold       Float
  actualValue     Float
  
  triggeredAt     DateTime @default(now())
  
  @@index([alertId, triggeredAt])
}
```

### 4.3 Migration Strategy

This is a **destructive migration** — we are dropping tables. This is fine because:
- The platform is in demo/alpha with no real user data worth preserving
- All existing data is mock/seeded
- We want a clean slate

**Migration steps:**

1. Create a new Prisma migration that:
   - Drops all removed models (AnalystProfile, AnalystPerformance, Signal, Annotation, SubscriptionTier, Subscription, ChatMessage, ChatReadReceipt, ChatRoomMember, Announcement, Review, FeedEvent, Follow, SignalLike, SignalBookmark)
   - Removes marketplace-specific columns from User model
   - Creates new models (UserPreferences, Watchlist, Alert, AlertHistory)

2. Run `prisma migrate dev` to apply
3. Run `prisma generate` to regenerate the client
4. Remove the old seed file (`prisma/seed.ts`) — it seeds demo analysts, signals, etc.
5. Create a minimal new seed file that creates a test user (if needed for development)

---

## 5. New Information Architecture

### 5.1 Route Structure

```
app/
  page.tsx                              # Landing page (simple — value prop + sign up)
  
  (auth)/
    login/page.tsx                      # Login page
    signup/page.tsx                     # Signup page
  
  (app)/                                # Authenticated app shell (layout with sidebar)
    terminal/
      page.tsx                          # Default terminal view — redirects to /terminal/derivatives
      derivatives/page.tsx              # Funding rates, OI, liquidations, basis, screener
      volatility/page.tsx               # Coming Soon — vol surface, RND, skew, cone, VRP, GEX
      onchain/page.tsx                  # Coming Soon — exchange flows, MVRV, SOPR, whale tracking
      macro/page.tsx                    # Coming Soon — correlations, ETF flows, regime dashboard
      sentiment/page.tsx                # Coming Soon — fear/greed, social, sector rotation
    
    tools/
      page.tsx                          # Tools overview — redirects to first available tool
      arb-scanner/page.tsx              # Coming Soon — funding arb, basis trade, cross-exchange
      screener/page.tsx                 # Coming Soon — custom multi-factor screener
      backtest/page.tsx                 # Coming Soon — strategy backtesting
    
    settings/
      page.tsx                          # Account settings
      watchlists/page.tsx               # Manage watchlists
      alerts/page.tsx                   # Manage alerts
  
  api/
    auth/[...nextauth]/route.ts         # NextAuth handler (keep)
    auth/signup/route.ts                # Email signup (keep)
    users/
      me/route.ts                       # GET current user, PATCH update profile
      preferences/route.ts             # GET/PATCH user preferences
    watchlists/
      route.ts                          # GET all, POST create
      [id]/route.ts                     # PATCH update, DELETE remove
    alerts/
      route.ts                          # GET all, POST create
      [id]/route.ts                     # PATCH update, DELETE remove
      history/route.ts                  # GET alert trigger history
```

### 5.2 Navigation Sidebar

```
┌─────────────────────────┐
│  SCOPE ALPHA             │
│  [logo]                  │
├─────────────────────────┤
│                          │
│  TERMINAL                │
│  ├── Derivatives    ●    │  ← Active (built)
│  ├── Volatility    ◌    │  ← Coming Soon
│  ├── On-Chain      ◌    │  ← Coming Soon
│  ├── Macro         ◌    │  ← Coming Soon
│  └── Sentiment     ◌    │  ← Coming Soon
│                          │
│  TOOLS                   │
│  ├── Arb Scanner   ◌    │  ← Coming Soon
│  ├── Screener      ◌    │  ← Coming Soon
│  └── Backtester    ◌    │  ← Coming Soon
│                          │
├─────────────────────────┤
│  ⚙ Settings              │
│  👤 Account               │
└─────────────────────────┘
```

### 5.3 Top Bar

```
┌──────────────────────────────────────────────────────────┐
│  [Asset Selector: BTC ▼]  [Timeframe: 1H ▼]  [🔍 Search]  [🔔 Alerts]  [Avatar ▼] │
└──────────────────────────────────────────────────────────┘
```

- **Asset Selector:** dropdown with all supported assets (BTC, ETH, SOL, etc.). Changes the context for whichever terminal section is active.
- **Timeframe Selector:** 1m, 5m, 15m, 1H, 4H, 1D, 1W. Affects chart and time-based metrics.
- **Search:** search for an asset by name or symbol.
- **Alerts:** notification bell showing unread alert count (badge). Dropdown shows recent alerts.
- **Avatar:** user menu with settings, logout.

### 5.4 "Coming Soon" State

For sections not yet built (Volatility, On-Chain, Macro, Sentiment, all Tools), display a clean placeholder:

```
┌────────────────────────────────────────────┐
│                                            │
│         [Section Icon]                     │
│                                            │
│     Volatility Analytics                   │
│                                            │
│     Implied volatility surface, risk-      │
│     neutral density, skew analysis,        │
│     volatility cone, and Greeks            │
│     exposure maps.                         │
│                                            │
│     Coming in Phase 3                      │
│                                            │
└────────────────────────────────────────────┘
```

Each section gets a unique description so users understand what's coming. No "subscribe to get notified" — we're not monetizing yet. Just a clean, informative placeholder.

---

## 6. Implementation Details

### 6.1 Code Removal Order

The removal must happen in a specific order to avoid cascading TypeScript errors:

**Step 1: Database first**
- Update `prisma/schema.prisma` with the new schema (remove models, simplify User, add new models)
- Run migration
- Regenerate Prisma client
- This will immediately break every file that references removed models — that's expected

**Step 2: Remove API routes**
- Delete all API route directories listed in Section 2.2
- This eliminates the largest chunk of server-side references to removed models

**Step 3: Remove pages**
- Delete all page directories listed in Section 2.3
- Remove marketplace/analyst/signal/chat/feed/bookmarks pages

**Step 4: Remove components**
- Delete all component directories listed in Section 2.4
- Remove signals, chat, marketplace, social, feed component directories
- Remove marketplace-specific UI components (Paywall, GracePeriodBanner, etc.)

**Step 5: Remove stores**
- Delete Zustand stores listed in Section 2.5
- Remove any localStorage persistence for removed stores

**Step 6: Remove lib utilities**
- Delete marketplace-specific utilities:
  - `lib/stripe.ts` (Stripe SDK)
  - `lib/subscriptions.ts` (subscription access checks)
  - `lib/feed/events.ts` (feed event creation)
  - `lib/chat/moderation.ts` (chat moderation)
  - Any signal-related utilities
- Keep: auth, prisma, market data, cache, general utilities

**Step 7: Clean up imports and references**
- Search entire codebase for imports from deleted files
- Search for references to removed model names (Signal, AnalystProfile, etc.)
- Search for removed route paths in any Link components or fetch calls
- Fix or remove all broken references
- Run `tsc --noEmit` to verify zero TypeScript errors

**Step 8: Update middleware**
- Review `middleware.ts` for any route matchers that reference removed paths
- Update auth middleware to reflect new route structure
- Remove any Stripe webhook exemptions, chat-specific routes, etc.

### 6.2 Auth Simplification

**Current:** Users have a `role` field that is either `subscriber` or `analyst`. Many API routes check this role for authorization. The "become analyst" flow upgrades a subscriber to analyst.

**New:** Remove the role distinction entirely. All users are just users. There is no subscriber/analyst split. If we need role-based access later (e.g., admin), we can add it then.

- Remove `role` field from User model
- Remove all `role === 'analyst'` checks in remaining routes
- Remove the "become analyst" API route and flow
- Remove any UI that shows different states based on role

**Demo mode:** The current demo login auto-seeds an analyst with signals, subscribers, etc. This entire flow should be removed. If we want a demo/guest mode later, it would be a simplified "explore the terminal with sample data" flow — but that's not a Phase 0 requirement.

### 6.3 Layout Rebuild

**Current layout:** The existing layout likely has navigation for marketplace, signals, analyst profiles, chat, etc.

**New layout (`app/(app)/layout.tsx`):**

```tsx
// Authenticated app layout with sidebar navigation
export default function AppLayout({ children }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar />
        
        {/* Page content */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**New components to create:**

```
components/layout/
  Sidebar.tsx                           # Navigation sidebar (Section 5.2)
  TopBar.tsx                            # Asset selector, timeframe, search, alerts, user menu
  AssetSelector.tsx                     # Dropdown for selecting active asset
  TimeframeSelector.tsx                 # Dropdown for selecting timeframe
  AlertBell.tsx                         # Notification bell with badge
  UserMenu.tsx                          # Avatar dropdown with settings/logout
  ComingSoon.tsx                        # Reusable "Coming Soon" placeholder for unbuilt sections
```

### 6.4 Terminal Section

The existing derivatives terminal components should be moved under the new routing structure. The terminal already has (with mock or partially-live data):

- Price chart (Lightweight Charts)
- Funding rate dashboard
- Open interest tracker
- Liquidation monitor
- Basis analyzer
- Multi-asset screener

These components should render at `/terminal/derivatives`. The internal component structure can stay the same — we're changing the routing and navigation wrapper, not the terminal internals.

If the terminal currently lives at a path like `/dashboard` or `/` in the existing app, the components need to be re-routed to `/terminal/derivatives`. The components themselves should not need modification unless they import from deleted modules.

### 6.5 Landing Page

Replace the current landing page (which likely pitches the marketplace/analyst concept) with a simple analytics platform landing page:

**Content:**
- Headline: "Institutional-Grade Crypto Analytics"
- Subhead: "Derivatives data, options analytics, on-chain intelligence, and quantitative tools — in one platform."
- Brief feature list (what's coming):
  - Real-time derivatives terminal
  - Options & volatility analytics (RND, vol surface, GEX)
  - On-chain flow analysis
  - Regime classification & convergence scoring
  - Quantitative backtesting tools
- CTA: Sign up / Log in
- No pricing section (monetization is deferred)

Keep it simple. This page will evolve as features ship.

### 6.6 Settings Pages

**Keep:** Basic account settings (name, email, avatar, password change)
**Remove:** Analyst-specific settings (Stripe Connect onboarding, payout settings, tier management)
**Add:** 
- Watchlist management (basic CRUD — add/remove assets from lists)
- Alert management (list active alerts, create new, edit, delete)

These are lightweight pages that wire to the new API routes.

---

## 7. New API Routes

### 7.1 User Preferences

**`GET /api/users/preferences`**
- Returns current user's preferences (default asset, timeframe, theme, saved layouts)
- Creates default preferences on first access if none exist

**`PATCH /api/users/preferences`**
- Updates preferences
- Body: `{ defaultAsset?, defaultTimeframe?, theme?, savedLayouts? }`

### 7.2 Watchlists

**`GET /api/watchlists`**
- Returns all watchlists for current user
- Each watchlist includes its asset list

**`POST /api/watchlists`**
- Creates a new watchlist
- Body: `{ name, assets: string[] }`

**`PATCH /api/watchlists/[id]`**
- Updates watchlist name or assets
- Body: `{ name?, assets? }`
- Verify ownership (watchlist.userId === session.userId)

**`DELETE /api/watchlists/[id]`**
- Deletes a watchlist
- Verify ownership

### 7.3 Alerts

**`GET /api/alerts`**
- Returns all alerts for current user
- Query params: `?active=true` to filter

**`POST /api/alerts`**
- Creates a new alert
- Body: `{ name, asset, type, condition, value, timeframe?, deliveryMethod? }`
- Validate that type is one of: funding_rate, oi_change, liquidation, price, basis
- Validate that condition is one of: above, below, crosses_above, crosses_below, change_exceeds

**`PATCH /api/alerts/[id]`**
- Updates alert configuration or toggles active/inactive
- Body: `{ name?, asset?, type?, condition?, value?, timeframe?, isActive?, deliveryMethod? }`
- Verify ownership

**`DELETE /api/alerts/[id]`**
- Deletes an alert
- Verify ownership

**`GET /api/alerts/history`**
- Returns recent alert trigger history for current user
- Query params: `?limit=50&offset=0`
- Returns from AlertHistory table

**Note:** Alerts are defined and stored in Phase 0, but the actual trigger evaluation engine is built in Phase 2 when live data is flowing. In Phase 0, alerts can be created and managed but won't fire.

---

## 8. Environment Variables

### Keep

```
# Database
DATABASE_URL=
DIRECT_URL=

# Auth
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Redis (if configured)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Remove (or leave unused)

```
# Stripe (all)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# R2 / Cloudflare (chat media)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Telegram bot (will be rebuilt later)
TELEGRAM_BOT_TOKEN=

# Resend (email — will be rebuilt later)
RESEND_API_KEY=

# Sentry (keep if configured, not critical path)
SENTRY_DSN=
```

Don't delete env vars from `.env.example` — just mark them as "not used in current phase" with comments. This prevents confusion when they're needed later.

---

## 9. File Structure — Final State After Phase 0

```
app/
  page.tsx                                      # Landing page
  layout.tsx                                    # Root layout
  globals.css                                   # Global styles
  
  (auth)/
    login/page.tsx
    signup/page.tsx
  
  (app)/
    layout.tsx                                  # App shell with sidebar + topbar
    terminal/
      page.tsx                                  # Redirect to /terminal/derivatives
      derivatives/page.tsx                      # Derivatives terminal (existing components)
      volatility/page.tsx                       # Coming Soon
      onchain/page.tsx                          # Coming Soon
      macro/page.tsx                            # Coming Soon
      sentiment/page.tsx                        # Coming Soon
    tools/
      page.tsx                                  # Redirect to first tool
      arb-scanner/page.tsx                      # Coming Soon
      screener/page.tsx                         # Coming Soon
      backtest/page.tsx                         # Coming Soon
    settings/
      page.tsx                                  # Account settings
      watchlists/page.tsx                       # Watchlist management
      alerts/page.tsx                           # Alert management
  
  api/
    auth/[...nextauth]/route.ts
    auth/signup/route.ts
    users/
      me/route.ts
      preferences/route.ts
    watchlists/
      route.ts
      [id]/route.ts
    alerts/
      route.ts
      [id]/route.ts
      history/route.ts

components/
  layout/
    Sidebar.tsx
    TopBar.tsx
    AssetSelector.tsx
    TimeframeSelector.tsx
    AlertBell.tsx
    UserMenu.tsx
    ComingSoon.tsx
  charts/                                       # Existing — Lightweight Charts components
    (all existing chart components)
  terminal/                                     # Existing — derivatives terminal components
    (all existing terminal components)
  ui/                                           # Generic UI components
    (buttons, inputs, modals, dropdowns, etc. — keep all generic ones)
  settings/
    AccountForm.tsx                             # Profile edit form
    WatchlistManager.tsx                        # Watchlist CRUD UI
    AlertManager.tsx                            # Alert CRUD UI
    AlertCard.tsx                               # Individual alert display/edit

lib/
  auth.ts                                       # Auth utilities
  prisma.ts                                     # Prisma client singleton
  utils.ts                                      # General utilities
  cache.ts                                      # Redis/Upstash utilities (if exists)
  market-data/                                  # Existing market data utilities (if exists)
    ws-manager.ts
    stream-coordinator.ts
    (other existing market data files)

stores/
  marketDataStore.ts                            # Market data state (if exists)
  terminalStore.ts                              # Terminal UI state (if exists)
  userStore.ts                                  # User preferences, watchlists (new or modified)

prisma/
  schema.prisma                                 # Updated schema
  migrations/                                   # New migration for the restructure
  seed.ts                                       # Minimal seed (test user only)

config/
  assets.ts                                     # Supported assets list: { symbol, name, icon }
  navigation.ts                                 # Sidebar nav config with coming-soon flags
```

---

## 10. Supported Assets Configuration

Create a central configuration for supported assets that all components reference:

```typescript
// config/assets.ts

export interface Asset {
  symbol: string;        // "BTC"
  name: string;          // "Bitcoin"
  pair: string;          // "BTCUSDT"
  category: string;      // "major" | "alt" | "defi"
  enabled: boolean;      // Whether live data is connected (false until Phase 1)
}

export const SUPPORTED_ASSETS: Asset[] = [
  { symbol: "BTC", name: "Bitcoin", pair: "BTCUSDT", category: "major", enabled: false },
  { symbol: "ETH", name: "Ethereum", pair: "ETHUSDT", category: "major", enabled: false },
  { symbol: "SOL", name: "Solana", pair: "SOLUSDT", category: "major", enabled: false },
  { symbol: "BNB", name: "BNB", pair: "BNBUSDT", category: "major", enabled: false },
  { symbol: "XRP", name: "XRP", pair: "XRPUSDT", category: "major", enabled: false },
  { symbol: "DOGE", name: "Dogecoin", pair: "DOGEUSDT", category: "alt", enabled: false },
  { symbol: "ADA", name: "Cardano", pair: "ADAUSDT", category: "alt", enabled: false },
  { symbol: "AVAX", name: "Avalanche", pair: "AVAXUSDT", category: "alt", enabled: false },
  { symbol: "LINK", name: "Chainlink", pair: "LINKUSDT", category: "defi", enabled: false },
  { symbol: "ARB", name: "Arbitrum", pair: "ARBUSDT", category: "alt", enabled: false },
];

// Phase 1 will flip enabled: true as exchanges are connected
```

```typescript
// config/navigation.ts

export interface NavItem {
  label: string;
  path: string;
  icon: string;          // Lucide icon name
  enabled: boolean;      // Is this section built?
  description: string;   // For "Coming Soon" placeholder
  phase: number;         // Which build phase delivers this
}

export const TERMINAL_NAV: NavItem[] = [
  {
    label: "Derivatives",
    path: "/terminal/derivatives",
    icon: "TrendingUp",
    enabled: true,
    description: "Real-time funding rates, open interest, liquidations, basis analysis, and multi-asset screener.",
    phase: 1,
  },
  {
    label: "Volatility",
    path: "/terminal/volatility",
    icon: "Activity",
    enabled: false,
    description: "Implied volatility surface, risk-neutral density, skew analysis, volatility cone, volatility risk premium, and Greeks exposure maps.",
    phase: 3,
  },
  {
    label: "On-Chain",
    path: "/terminal/onchain",
    icon: "GitBranch",
    enabled: false,
    description: "Exchange flows, MVRV z-score, SOPR, NVT ratio, whale tracking, stablecoin flows, and supply dynamics.",
    phase: 5,
  },
  {
    label: "Macro",
    path: "/terminal/macro",
    icon: "Globe",
    enabled: false,
    description: "Cross-asset correlations, ETF flow tracking, market regime classification, convergence scoring, and token unlock calendar.",
    phase: 6,
  },
  {
    label: "Sentiment",
    path: "/terminal/sentiment",
    icon: "MessageCircle",
    enabled: false,
    description: "Fear & Greed Index, social volume analysis, sector sentiment rotation, and sentiment-price divergence detection.",
    phase: 7,
  },
];

export const TOOLS_NAV: NavItem[] = [
  {
    label: "Arb Scanner",
    path: "/tools/arb-scanner",
    icon: "ArrowLeftRight",
    enabled: false,
    description: "Cross-exchange funding rate arbitrage scanner, basis trade monitor, and position P&L calculator.",
    phase: 2,
  },
  {
    label: "Screener",
    path: "/tools/screener",
    icon: "Filter",
    enabled: false,
    description: "Custom multi-factor screener across derivatives, options, on-chain, and sentiment data domains.",
    phase: 8,
  },
  {
    label: "Backtester",
    path: "/tools/backtest",
    icon: "FlaskConical",
    enabled: false,
    description: "Visual strategy builder with backtesting against historical multi-domain data. No coding required.",
    phase: 8,
  },
];
```

---

## 11. Design Direction

### Theme
- **Dark mode by default.** This is a trading terminal — dark backgrounds with high-contrast data. Light mode is not a priority.
- **Keep the glass-morphism design system** — it's distinctive and already built. Translucent panels, subtle borders, backdrop blur.
- **Fonts:** Keep Outfit (display) and JetBrains Mono (data/numbers). These work well for a terminal aesthetic.
- **Color palette:** Keep the existing palette. If the current scheme is too "marketplace-y" (e.g., warm/inviting tones), shift accent colors toward cooler tones (teals, blues, cyans) that read as analytical/quantitative.

### Terminal Feel
The app should feel like a professional trading terminal, not a social media platform. Dense information, clean typography, minimal whitespace waste on data screens. The sidebar is narrow and icon-focused. The content area maximizes data density.

### Coming Soon Sections
These should feel intentional, not empty. Use the glass-morphism cards with the section icon, name, and description. Consider a subtle animated grid or data visualization motif in the background to suggest "data is on its way."

---

## 12. Definition of Done

- [ ] All marketplace models removed from Prisma schema
- [ ] Database migration applied successfully
- [ ] All signal/analyst/subscription/chat/review/feed/social API routes deleted
- [ ] All marketplace-specific pages deleted
- [ ] All marketplace-specific components deleted
- [ ] All marketplace-specific Zustand stores deleted
- [ ] All marketplace-specific lib utilities deleted
- [ ] User model simplified (no role, no Stripe fields, no analyst relations)
- [ ] New models created: UserPreferences, Watchlist, Alert, AlertHistory
- [ ] New API routes working: preferences, watchlists, alerts
- [ ] Sidebar navigation rendering with Terminal + Tools sections
- [ ] Top bar rendering with asset selector, timeframe selector, alert bell, user menu
- [ ] "Coming Soon" placeholder rendering for unbuilt sections
- [ ] Derivatives terminal components rendering at `/terminal/derivatives`
- [ ] Landing page updated with analytics platform messaging
- [ ] Auth flow (signup, login, Google OAuth) still working
- [ ] Zero TypeScript errors (`tsc --noEmit` passes)
- [ ] Zero broken imports or dead references
- [ ] App builds and deploys successfully on Vercel
- [ ] Prisma client generates without errors
- [ ] `config/assets.ts` and `config/navigation.ts` created
- [ ] Seed file updated (minimal — test user only)

---

## 13. What This Enables

After Phase 0, the codebase is a clean analytics platform shell ready for:

- **Phase 1:** Wire up live exchange data (Binance + Bybit WebSocket/REST → Market Data Service → SSE → frontend). The derivatives terminal components are already in place — they just need live data piped in.
- **Phase 2:** Build derivatives intelligence features (arb scanner, CVD divergence, health composite, liquidation heatmap) on top of live data.
- **Phase 3:** Add options data pipeline (Deribit) and deploy the Quant Engine (FastAPI) with vol surface, RND, and volatility tools.

The existing terminal components, charting library, auth system, database, and deployment pipeline all carry forward unchanged. Phase 0 is purely subtractive (removing marketplace code) plus minimal additive work (new nav shell, new models, new config).

---

*This PRD should be treated as the authoritative specification. Claude Code should present an implementation plan with architecture decision questions before beginning work.*
