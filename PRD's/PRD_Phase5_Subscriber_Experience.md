# PRD: Phase 5 — Subscriber Experience Polish

**Version:** 1.0
**Date:** April 7, 2026
**Status:** Ready for Implementation (after Phase 4 complete)
**Priority:** High — subscriber retention and conversion depend on discovery, tracking, and trust signals
**Depends On:** Phase 4 (multi-target signals, performance analytics), Phase 2 stub (subscription access)

---

## 1. Context

### Why This Phase Matters

Analysts are the supply side; subscribers are the revenue. Right now, the subscriber experience is passive — browse a marketplace, subscribe, check signals manually. There's no way to track how signals are performing in your personal portfolio, no way to compare analysts side-by-side before committing, and the review system is basic. This phase makes the subscriber side sticky enough that paying users stay.

### What Already Exists

**Marketplace:**

| Feature | Status |
|---------|--------|
| Browse analyst cards with key metrics | ✅ Works |
| Search by analyst name | ✅ Works |
| Filter by price, win rate, asset, subscriber count, rating | ✅ Works |
| Sort by subscribers, win rate, P&L, price, rating, newest | ✅ Works |
| Individual analyst profile pages | ✅ Works |

| Missing | Impact |
|---------|--------|
| No advanced range filters (min/max win rate, P&L range) | Can't narrow search precisely |
| No analyst comparison view | Can't evaluate analysts side-by-side |
| No "trending" section | No social proof for rising analysts |
| No autocomplete search across names, assets, tags | Discovery feels basic |

**Portfolio / Signal Tracking:**

Nothing exists. Subscribers have no dashboard showing signals they're following, no way to mark signals as "taken," no personal P&L tracking, and no aggregate view across analysts.

**Review System:**

| Feature | Status |
|---------|--------|
| Subscriber ratings (1–5 stars) with text reviews | ✅ Works |
| One review per subscriber per analyst (uniqueness constraint) | ✅ Works |
| Analyst responses to reviews | ✅ Works |

| Missing | Impact |
|---------|--------|
| No sorting (most recent, highest rated, most helpful) | Reviews feel unorganized |
| No "was this helpful?" voting | No way to surface best reviews |
| No filtering by subscription tier | Can't see reviews from similar subscribers |
| No verified subscriber badge | No proof reviewer was actually subscribed |

---

## 2. Goals

After this phase is complete:

1. Subscribers can filter the marketplace with precise range controls and find analysts through autocomplete search
2. Subscribers can compare 2–3 analysts side-by-side on key metrics
3. A "trending analysts" section highlights analysts with recent subscriber growth
4. Subscribers have a portfolio dashboard tracking signals they've taken
5. Subscribers can mark signals as "taken" with their own entry price and track personal P&L
6. Aggregate P&L across all subscribed analysts gives subscribers a clear performance picture
7. Reviews are sortable, filterable, and show verified subscriber badges
8. "Was this helpful?" voting surfaces the most useful reviews

---

## 3. Sub-Phase 5A — Discovery & Marketplace Improvements

### Objective

Make it easy for potential subscribers to find the right analyst through powerful filtering, comparison, social proof, and search.

### 3.1 Advanced Marketplace Filters

**Modify:** `GET /api/analysts` (or whatever route powers the marketplace listing)

Add query params for range filters:

```
?minWinRate=60&maxWinRate=100
&minPnl=-50&maxPnl=500
&minPrice=50&maxPrice=500
&minSignals=20
&minSubscribers=10
&assets=BTC,ETH,SOL
&style=swing,scalp
&rating=4
```

Implementation:
- Build a Prisma `where` clause dynamically from present query params
- Win rate, P&L, subscriber count come from `AnalystPerformance` relation
- Assets filter matches against `AnalystProfile.primaryAssets` (array/JSON field)
- Rating filter: `AnalystPerformance.averageRating >= rating`
- All filters are AND-combined

**Frontend — Filter Panel:**

Create: `components/marketplace/AdvancedFilters.tsx`

- Collapsible filter panel (collapsed by default on mobile, expanded on desktop)
- Range sliders for: win rate (0–100%), total P&L (range), subscription price ($50–$2,000)
- Minimum thresholds for: signal count, subscriber count
- Multi-select for: primary assets, trading style
- Minimum rating: star selector
- "Reset filters" button
- Filters apply immediately (debounced 300ms) via URL query params so the page is shareable
- Active filter count shown as a badge on the filter toggle button

### 3.2 Analyst Comparison View

Allow subscribers to select 2–3 analysts and compare them side-by-side.

**Route:** `GET /api/analysts/compare?ids=slug1,slug2,slug3`

Response:
```typescript
interface ComparisonData {
  analysts: Array<{
    slug: string;
    displayName: string;
    avatar: string | null;
    tagline: string | null;
    primaryAssets: string[];
    tradingStyle: string | null;
    experienceYears: number | null;
    performance: {
      totalSignals: number;
      winRate: number;
      avgPnl: number;
      totalPnl: number;
      profitFactor: number;
      maxDrawdownPct: number | null;
      subscriberCount: number;
      averageRating: number | null;
      ratingCount: number;
    };
    tiers: Array<{
      name: string;
      price: number;
      features: string[];
    }>;
    recentPerformance: {
      '30d': { winRate: number; totalPnl: number; signalCount: number };
      '90d': { winRate: number; totalPnl: number; signalCount: number };
    };
  }>;
}
```

Cache with 5-minute TTL: `analytics:compare:{sortedSlugs}`.

**Frontend:**

Create: `components/marketplace/AnalystComparison.tsx`

- Side-by-side card layout (2 or 3 columns)
- Each metric row is color-coded: best value in green, worst in red, middle in neutral
- Highlighted "best in" badges per metric (e.g., "Best Win Rate", "Lowest Drawdown")
- Subscribe CTA under each analyst's column
- Accessible from the marketplace via checkboxes on analyst cards: "Compare (0/3)" counter in a sticky bottom bar
- When 2+ analysts selected, "Compare" button appears → navigates to `/marketplace/compare?ids=slug1,slug2`

**Page:** `app/marketplace/compare/page.tsx`

### 3.3 Trending Analysts

Surface analysts with the highest recent subscriber growth.

**Route:** `GET /api/analysts/trending?period=7d&limit=5`

Implementation:
- Query subscriptions created in the last `period` (7d or 30d)
- Group by `analystId`, count new subscriptions
- Join with `AnalystProfile` and `AnalystPerformance`
- Rank by new subscription count descending
- Return top N with their profile + performance data

Response:
```typescript
interface TrendingAnalyst {
  slug: string;
  displayName: string;
  avatar: string | null;
  newSubscribers: number;     // Count in the period
  totalSubscribers: number;
  winRate: number;
  totalPnl: number;
  lowestTierPrice: number;
}
```

Cache with 30-minute TTL: `analytics:trending:{period}`.

**Frontend:**

Create: `components/marketplace/TrendingAnalysts.tsx`

- Horizontal scrolling card row at the top of the marketplace page
- Each card shows: analyst avatar, name, "+X new subscribers this week", key metrics
- "Trending" flame badge
- Clicking navigates to the analyst's profile

### 3.4 Search with Autocomplete

**Route:** `GET /api/search?q=btc&limit=8`

Searches across:
- Analyst display names (fuzzy match)
- Analyst slugs (exact prefix match)
- Primary assets (exact match)
- Tags/trading style (if the field exists)

Response:
```typescript
interface SearchResult {
  type: 'analyst' | 'asset';
  // For analyst results:
  analyst?: {
    slug: string;
    displayName: string;
    avatar: string | null;
    winRate: number;
    subscriberCount: number;
  };
  // For asset results:
  asset?: {
    symbol: string;
    analystCount: number;  // How many analysts trade this asset
  };
}
```

Implementation:
- For analyst name search: use Prisma `contains` with case-insensitive mode
- For asset search: query `AnalystProfile` where `primaryAssets` contains the search term
- Merge and deduplicate results, prioritize exact matches over fuzzy
- Cache is not needed (queries are fast and personalized)

**Frontend:**

Create: `components/marketplace/SearchAutocomplete.tsx`

- Search input in the marketplace header
- Dropdown appears on focus/typing with instant results (debounced 200ms)
- Results grouped by type: "Analysts" section and "Assets" section
- Analyst results show avatar + name + win rate
- Asset results show "X analysts trading {asset}" with a link to filtered marketplace view
- Keyboard navigation (arrow keys, Enter to select)
- Clicking an analyst navigates to their profile
- Clicking an asset applies the asset filter to the marketplace

---

## 4. Sub-Phase 5B — Portfolio & P&L Tracking

### Objective

Give subscribers a personal dashboard where they can track signals they've taken, record their own entry prices, and see aggregate P&L across all analysts they follow.

### 4.1 Signal Tracking Model

```prisma
model TrackedSignal {
  id              String    @id @default(cuid())
  subscriberId    String
  subscriber      User      @relation(fields: [subscriberId], references: [id])
  signalId        String
  signal          Signal    @relation(fields: [signalId], references: [id])
  analystId       String

  // Subscriber's own execution data
  takenAt         DateTime  @default(now())
  personalEntry   Float?               // Subscriber's actual entry price (null = used analyst's price)
  personalStop    Float?               // Subscriber's actual stop (null = used analyst's)
  positionSize    Float?               // Optional: position size in USD or units
  status          String    @default("active")  // "active" | "closed"
  closedAt        DateTime?
  closePrice      Float?               // Price subscriber actually closed at
  personalPnl     Float?               // Subscriber's actual P&L % (calculated on close)
  notes           String?              // Subscriber's private notes

  @@unique([subscriberId, signalId])   // Can only track a signal once
  @@index([subscriberId, status])
  @@index([subscriberId, analystId])
}
```

### 4.2 Tracking API Routes

**`POST /api/portfolio/track`**

Auth: Subscriber.

Body:
```typescript
{
  signalId: string;
  personalEntry?: number;   // null = use analyst's entry price
  personalStop?: number;
  positionSize?: number;
  notes?: string;
}
```

Creates a `TrackedSignal` record. Validates that the subscriber has an active subscription to the signal's analyst (via the `checkSubscriptionAccess` stub).

**`GET /api/portfolio`**

Auth: Subscriber.

Query params: `?status=active&analystId=xxx&asset=BTC&sort=takenAt&order=desc&limit=20&cursor={id}`

Response:
```typescript
interface PortfolioResponse {
  positions: Array<{
    id: string;
    signal: {
      id: string;
      asset: string;
      direction: string;
      entryPrice: number;
      targets: Array<{ label: string; price: number; closePercent: number; hit: boolean }>;
      stopLoss: number;
      status: string;
      resultPnl: number | null;
    };
    analyst: {
      slug: string;
      displayName: string;
      avatar: string | null;
    };
    personalEntry: number | null;
    personalStop: number | null;
    positionSize: number | null;
    status: string;
    takenAt: string;
    closedAt: string | null;
    closePrice: number | null;
    personalPnl: number | null;
    unrealizedPnl: number | null;    // Computed from current market price if active
    notes: string | null;
  }>;
  summary: PortfolioSummary;
  nextCursor: string | null;
}
```

**Unrealized P&L calculation:**

For active tracked signals, compute unrealized P&L using the current market price from the Phase 1 market data cache:

```typescript
// Read current price from Upstash cache (set by Phase 1 market data pipeline)
const currentPrice = await getCached<number>(`market:price:${signal.asset}`);
if (currentPrice && position.status === 'active') {
  const entry = position.personalEntry ?? signal.entryPrice;
  const direction = signal.direction === 'long' ? 1 : -1;
  position.unrealizedPnl = direction * ((currentPrice - entry) / entry) * 100;
}
```

**`PUT /api/portfolio/[id]`**

Auth: Owner of the tracked signal.

Body: `{ personalEntry?, personalStop?, positionSize?, notes? }`

Update the subscriber's execution data on an active tracked signal.

**`POST /api/portfolio/[id]/close`**

Auth: Owner.

Body: `{ closePrice: number, notes?: string }`

Sets status to `closed`, records `closedAt`, `closePrice`, and calculates `personalPnl`:
```typescript
const entry = trackedSignal.personalEntry ?? signal.entryPrice;
const direction = signal.direction === 'long' ? 1 : -1;
personalPnl = direction * ((closePrice - entry) / entry) * 100;
```

### 4.3 Portfolio Summary (Aggregate P&L)

**Route:** `GET /api/portfolio/summary`

Auth: Subscriber.

Response:
```typescript
interface PortfolioSummary {
  totalTracked: number;
  activePositions: number;
  closedPositions: number;

  // Closed position stats
  closedPnl: {
    total: number;           // Sum of personalPnl for all closed positions
    avgPnl: number;
    winRate: number;
    wins: number;
    losses: number;
    bestTrade: number;
    worstTrade: number;
  };

  // Active position stats (unrealized)
  activePnl: {
    totalUnrealized: number;  // Sum of unrealized P&L across all active positions
    positionCount: number;
  };

  // Per-analyst breakdown
  byAnalyst: Array<{
    analyst: { slug: string; displayName: string; avatar: string | null };
    trackedCount: number;
    closedPnl: number;
    activePnl: number;
    winRate: number;
  }>;

  // Time series for equity curve
  equityCurve: Array<{
    date: string;
    cumulativePnl: number;
  }>;
}
```

### 4.4 Portfolio Dashboard Page

**Page:** `app/portfolio/page.tsx`

Sections:

**Header row — Summary cards:**
- Total P&L (closed + unrealized), Active positions count, Win rate, Best/worst trade
- Each card uses the glass-morphism style matching existing stat cards

**Equity curve chart:**
- Line chart (reuse Lightweight Charts or SVG) showing cumulative P&L over time from closed positions
- Matches the analyst performance chart style

**Per-analyst breakdown:**
- Horizontal card row showing each subscribed analyst with their contribution to the subscriber's P&L
- "View signals" link per analyst

**Active positions table:**
- Columns: asset, direction, analyst, entry (personal or analyst's), current price, unrealized P&L, taken date
- Current price updates via the existing market data polling (read from Zustand marketDataStore)
- Color-coded P&L: green positive, red negative
- "Close Position" button → modal for entering close price

**Closed positions table:**
- Columns: asset, direction, analyst, entry, close, P&L, taken date, closed date
- Sortable, filterable by analyst and asset
- Expandable rows showing signal details and personal notes

### 4.5 "Take Signal" UX Integration

**Modify:** Signal cards and signal detail views

When a subscriber views a signal from an analyst they're subscribed to:
- Show a "Take Signal" button (only if signal.status === 'active' and not already tracked)
- Clicking opens a small modal/inline form:
  - Pre-filled entry = analyst's entry price (subscriber can override)
  - Optional: personal stop, position size, notes
  - "Track This Signal" submit button
- After tracking, the button changes to "Tracking ✓" with a link to the portfolio

Create: `components/signals/TakeSignalButton.tsx`

- Checks if signal is already tracked (via a lightweight SWR call or from a cached portfolio list)
- Renders "Take Signal" / "Tracking ✓" / "Signal Closed" states
- Inline form for quick tracking without navigating away

### 4.6 Auto-Close on Signal Resolution

When an analyst resolves a signal (Phase 4 resolve flow), any active `TrackedSignal` records for that signal should be optionally notified:

- Do NOT auto-close the subscriber's position (they may have exited at a different price)
- Instead, add a visual indicator on the portfolio: "Analyst resolved this signal at ${price} (${pnl}%)"
- Subscriber can then manually close their position with their own exit price

Implementation: When the signal status changes to `resolved`, the portfolio view checks `signal.status` and shows a banner on the tracked signal row.

---

## 5. Sub-Phase 5C — Review & Rating System Enhancements

### Objective

Make reviews more useful through sorting, voting, tier-based filtering, and verified subscriber badges.

### 5.1 Review Helpfulness Voting

**Schema change:**

```prisma
model ReviewVote {
  id        String   @id @default(cuid())
  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  helpful   Boolean                // true = helpful, false = not helpful

  @@unique([reviewId, userId])     // One vote per user per review
  @@index([reviewId])
}

model Review {
  // ... existing fields ...
  votes       ReviewVote[]
  helpfulCount   Int   @default(0)    // Denormalized count for sorting
  unhelpfulCount Int   @default(0)    // Denormalized count
}
```

**Route:** `POST /api/reviews/[id]/vote`

Auth: Logged in (anyone can vote except the review author and the analyst being reviewed).

Body: `{ helpful: boolean }`

1. Upsert the vote (allows changing vote)
2. Recompute denormalized `helpfulCount` and `unhelpfulCount` on the Review

**Frontend:** Add thumbs-up / thumbs-down buttons below each review with counts.

### 5.2 Review Sorting & Filtering

**Modify:** `GET /api/reviews?analystId={id}`

Add query params:
```
?sort=newest|highest|lowest|mostHelpful
&tier=tierName
&verified=true
&limit=10&cursor={id}
```

Sorting implementation:
- `newest` → `ORDER BY createdAt DESC` (current default)
- `highest` → `ORDER BY rating DESC, createdAt DESC`
- `lowest` → `ORDER BY rating ASC, createdAt DESC`
- `mostHelpful` → `ORDER BY helpfulCount DESC, createdAt DESC`

Tier filter: join with `Subscription` to find the reviewer's tier at time of review.

Verified filter: only show reviews where the reviewer had an active subscription at the time of the review (see 5.3).

### 5.3 Verified Subscriber Badge

When a review is created, stamp whether the reviewer was an active subscriber at that moment:

**Schema change:**

```prisma
model Review {
  // ... existing fields ...
  verifiedSubscriber  Boolean  @default(false)  // Was reviewer subscribed when posting?
  subscriptionTier    String?                    // Tier name at time of review
}
```

**Modify:** `POST /api/reviews`

After creating the review:
1. Check `checkSubscriptionAccess(reviewerId, analystId)`
2. If the reviewer has an active subscription, set `verifiedSubscriber = true` and `subscriptionTier = tier.name`

**Frontend:**

Create: `components/reviews/VerifiedBadge.tsx`

- Green checkmark badge: "✓ Verified Subscriber" next to the reviewer's name
- Tooltip or small text: "Subscribed on {tier.name} tier when reviewing"
- Non-verified reviews show no badge (not a negative indicator — they just don't have the trust signal)

### 5.4 Review Sorting/Filtering UI

**Modify:** Review section on analyst profile page

Create: `components/reviews/ReviewFilterBar.tsx`

- Sort dropdown: "Most Recent", "Highest Rated", "Lowest Rated", "Most Helpful"
- Filter toggle: "Verified subscribers only"
- Tier filter dropdown: shows all tiers the analyst has (if multiple)
- Results update via SWR with the query params

### 5.5 Analyst Response UX Polish

The analyst response feature already exists. Polish the UX:

- Show responses inline below the review (indented, labeled "Analyst response")
- If no response yet, show a "Reply" button (analyst only) that expands an inline textarea
- Responses are single (one per review), not threaded
- Timestamp on the response

---

## 6. New Dependencies

None. All features use existing packages (Prisma, SWR, existing UI components).

If autocomplete search needs fuzzy matching beyond Prisma `contains`, consider `fuse.js` (~5KB) for client-side fuzzy search on the analyst list. But start with server-side `contains` and only add fuse.js if the search quality isn't good enough.

---

## 7. Prisma Schema Changes (Summary)

```prisma
// New models
model TrackedSignal {
  id              String    @id @default(cuid())
  subscriberId    String
  subscriber      User      @relation(fields: [subscriberId], references: [id])
  signalId        String
  signal          Signal    @relation(fields: [signalId], references: [id])
  analystId       String
  takenAt         DateTime  @default(now())
  personalEntry   Float?
  personalStop    Float?
  positionSize    Float?
  status          String    @default("active")
  closedAt        DateTime?
  closePrice      Float?
  personalPnl     Float?
  notes           String?
  @@unique([subscriberId, signalId])
  @@index([subscriberId, status])
  @@index([subscriberId, analystId])
}

model ReviewVote {
  id        String   @id @default(cuid())
  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  helpful   Boolean
  @@unique([reviewId, userId])
  @@index([reviewId])
}

// Changes to existing models
model Review {
  // Add:
  votes              ReviewVote[]
  helpfulCount       Int      @default(0)
  unhelpfulCount     Int      @default(0)
  verifiedSubscriber Boolean  @default(false)
  subscriptionTier   String?
}

model Signal {
  // Add:
  trackedBy          TrackedSignal[]
}
```

---

## 8. File Structure

**New files:**

```
app/api/
  search/route.ts                               # GET — autocomplete search across analysts + assets
  analysts/
    compare/route.ts                            # GET — side-by-side comparison data
    trending/route.ts                           # GET — trending analysts by subscriber growth
  portfolio/
    route.ts                                    # GET (list), POST /track (create)
    summary/route.ts                            # GET — aggregate portfolio summary
    [id]/route.ts                               # PUT (update tracked signal)
    [id]/close/route.ts                         # POST — close a tracked position
  reviews/
    [id]/vote/route.ts                          # POST — helpful/not helpful vote

app/
  portfolio/page.tsx                            # Subscriber portfolio dashboard
  marketplace/
    compare/page.tsx                            # Analyst comparison page

components/
  marketplace/
    AdvancedFilters.tsx                         # Range sliders, multi-select, filter panel
    SearchAutocomplete.tsx                      # Search input with dropdown results
    AnalystComparison.tsx                       # Side-by-side comparison layout
    TrendingAnalysts.tsx                        # Horizontal scrolling trending card row
    CompareCheckbox.tsx                         # Checkbox on analyst cards for comparison selection
    CompareBar.tsx                              # Sticky bottom bar "Compare (2/3)"
  portfolio/
    PortfolioSummaryCards.tsx                   # Header stat cards (total P&L, active, win rate)
    PortfolioEquityCurve.tsx                    # Cumulative P&L line chart
    ActivePositionsTable.tsx                    # Active tracked signals with unrealized P&L
    ClosedPositionsTable.tsx                    # Closed signals with realized P&L
    AnalystBreakdownRow.tsx                     # Per-analyst P&L contribution card
    ClosePositionModal.tsx                      # Modal for entering close price
  signals/
    TakeSignalButton.tsx                        # "Take Signal" / "Tracking ✓" button
    TakeSignalForm.tsx                          # Inline form for personal entry/stop/size
  reviews/
    ReviewFilterBar.tsx                         # Sort + filter controls for review list
    ReviewVoteButtons.tsx                       # Thumbs up/down with counts
    VerifiedBadge.tsx                           # "✓ Verified Subscriber" badge
    AnalystResponse.tsx                         # Polished inline response display + reply form

stores/
  portfolioStore.ts                             # Zustand: tracked signal IDs for quick "already tracking" checks
```

**Existing files to modify:**

```
prisma/schema.prisma                            # Add TrackedSignal, ReviewVote, Review fields, Signal relation

app/api/analysts/route.ts                       # Add advanced filter query params
app/api/reviews/route.ts                        # Add sort/filter query params, verified badge on create

app/marketplace/page.tsx                        # Add TrendingAnalysts section, AdvancedFilters panel, SearchAutocomplete, compare selection UI
components/marketplace/AnalystCard.tsx           # Add CompareCheckbox
components/signals/SignalCard.tsx                # Add TakeSignalButton for subscribers
components/analyst/ReviewSection.tsx             # Add ReviewFilterBar, ReviewVoteButtons, VerifiedBadge, polished AnalystResponse
```

**Files to leave alone:**

```
# All Phase 1–4 infrastructure
# Market data, charting, terminal pages
# Auth, Stripe stubs, notification stubs
# Annotation system
# Signal creation (Phase 4)
# Performance analytics (Phase 4)
```

---

## 9. Testing & Validation

### Manual Verification Checklist

**Marketplace Filters:**
- [ ] Range slider for win rate filters marketplace correctly (e.g., 60–80% shows only matching analysts)
- [ ] Price range filter works ($100–$500)
- [ ] Asset multi-select filter works (BTC + ETH shows analysts trading either)
- [ ] Minimum signal count filter excludes analysts with fewer signals
- [ ] Filters combine correctly (AND logic)
- [ ] URL updates with filter params (page is shareable)
- [ ] "Reset filters" clears all filters

**Search Autocomplete:**
- [ ] Typing "btc" shows analysts with BTC as primary asset + an "Assets: BTC" group result
- [ ] Typing an analyst name shows matching analysts with avatar and win rate
- [ ] Keyboard navigation works (arrow keys + Enter)
- [ ] Clicking an analyst navigates to their profile
- [ ] Clicking an asset applies the filter
- [ ] Empty query shows no dropdown

**Comparison:**
- [ ] Selecting 2 analysts via checkboxes → "Compare (2)" bar appears at bottom
- [ ] Clicking "Compare" → comparison page loads with side-by-side metrics
- [ ] Best-in-category metrics are highlighted green
- [ ] 3-analyst comparison works
- [ ] Subscribe CTA on each column works

**Trending:**
- [ ] Trending section shows at top of marketplace
- [ ] Analysts with most new subscribers in last 7 days appear first
- [ ] "+X new subscribers" count is accurate
- [ ] Cards link to analyst profiles

**Portfolio — Take Signal:**
- [ ] "Take Signal" button appears on active signals for subscribed users
- [ ] Clicking opens inline form with pre-filled analyst entry price
- [ ] Override entry price works
- [ ] After tracking, button shows "Tracking ✓"
- [ ] Cannot track same signal twice

**Portfolio Dashboard:**
- [ ] Summary cards show correct totals (tracked count, P&L, win rate)
- [ ] Active positions table shows unrealized P&L using current market prices
- [ ] Unrealized P&L updates when market data refreshes
- [ ] "Close Position" modal records close price and calculates personal P&L correctly
- [ ] Closed positions table shows realized P&L
- [ ] Per-analyst breakdown is accurate
- [ ] Equity curve chart renders correctly
- [ ] Filter by analyst works
- [ ] When analyst resolves a signal, tracked position shows "Analyst resolved at $X" banner

**Reviews:**
- [ ] Sorting by "Most Helpful" orders by helpfulCount descending
- [ ] Sorting by "Highest Rated" / "Lowest Rated" works
- [ ] "Verified subscribers only" filter shows only reviews with badge
- [ ] Thumbs-up/down voting works and updates counts
- [ ] Changing vote (up → down) updates counts correctly
- [ ] Review author cannot vote on their own review
- [ ] Verified subscriber badge shows for reviewers who were subscribed at review time
- [ ] Tier name shows on verified badge
- [ ] Analyst reply renders inline below review
- [ ] Analyst can reply from the review section directly

---

## 10. Rollout Plan

1. **Prisma migration** — add TrackedSignal, ReviewVote, Review fields, Signal relation
2. **Search autocomplete** (3.4) — API route + frontend component
3. **Advanced filters** (3.1) — API query param support + filter panel
4. **Trending analysts** (3.3) — API route + trending card row
5. **Comparison view** (3.2) — API route + comparison page + selection UI
6. **Portfolio tracking model + API** (4.1–4.3) — TrackedSignal CRUD + summary route
7. **Take Signal UX** (4.5) — button on signal cards, inline form
8. **Portfolio dashboard** (4.4) — page with summary, positions, equity curve
9. **Review voting** (5.1) — ReviewVote model, vote route, UI
10. **Review sorting/filtering** (5.2 + 5.4) — query param support + filter bar
11. **Verified badge** (5.3) — stamp on review creation, badge component
12. **Analyst response polish** (5.5) — inline reply UX
13. **End-to-end test** — full subscriber journey: search → filter → compare → subscribe → take signal → track P&L → leave verified review
14. **Deploy to staging** — verify portfolio P&L calculations against market data

---

## 11. Out of Scope

The following are explicitly NOT part of this phase:

- Auto-execution / copy trading (different legal and technical scope entirely)
- Social feed / activity timeline (Phase 6)
- Follow without subscribing (Phase 6)
- Signal bookmarking / liking (Phase 6)
- External sharing (Twitter cards, etc.) (Phase 6)
- Leaderboard / ranking page (can be built from existing data, but not prioritized here)
- Subscriber-to-subscriber social features
- Advanced portfolio analytics (Sharpe ratio, beta, correlation between analysts)
- Multi-currency P&L (USD only)
- Integration with exchange APIs for actual position tracking
- Mobile-specific portfolio UX
- Any changes to analyst-side tools, market data, payments, or notifications
