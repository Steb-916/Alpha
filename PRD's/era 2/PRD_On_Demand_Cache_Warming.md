# PRD: On-Demand Options Cache Warming

**Version:** 1.0
**Date:** April 17, 2026
**Status:** Ready for Implementation
**Priority:** High — fixes empty state on first visit and between cron runs
**Type:** Standalone fix (not a numbered phase)
**Depends on:** Phase 3 complete (Deribit connector, options cron, API routes exist)

---

## 1. Problem

The options data pipeline depends on the `refresh-options` cron job to populate Redis. If the cron hasn't run yet (fresh deploy, Hobby plan daily schedule, or cron failure), every options API route returns 503 and the UI shows "not available" or "INERT MODE" on all Volatility tabs.

This means:
- After every Vercel deploy, the site shows empty volatility data until the next cron fires
- On Hobby plan (daily cron), there's up to a 24-hour window where data is stale or missing
- If cron fails silently, the entire Volatility section is dead until the next successful run
- A visitor exploring the terminal for the first time sees "RND not available" — terrible first impression

## 2. Solution

Add **on-demand cache warming** to every options API route. When a route finds the Redis cache empty, it fetches fresh data inline (same logic the cron uses), caches it, and returns it to the user. The cron continues to run on schedule to keep the cache fresh proactively — on-demand is just the fallback for cold cache scenarios.

The first visitor after a cold cache pays a ~2-5 second latency penalty (Deribit fetch + optional Quant Engine computation). Every subsequent visitor within the TTL window gets instant cached data.

---

## 3. Current State

### What Exists

**Cron job:** `app/api/cron/refresh-options/route.ts`
- Runs hourly (or daily on Hobby)
- For each asset (BTC, ETH):
  1. Fetches Deribit book summary via `deribit.getBookSummary(currency)`
  2. Parses chain via `parseChain()` or similar
  3. Computes aggregates (per-expiry summaries, max pain, put/call ratio)
  4. Caches raw chain at `options:chain:{asset}` (TTL ~3600s)
  5. Caches aggregates at `options:aggregate:{asset}` (TTL ~3600s)
  6. If Quant Engine configured: dispatches to `/vol-surface`, `/rnd`, `/skew`, `/vol-cone`, `/vrp` and caches results
  7. Persists snapshots to PostgreSQL (hourly)

**API routes (6 total):**
- `app/api/market/options/chain/route.ts`
- `app/api/market/options/vol-surface/route.ts`
- `app/api/market/options/rnd/route.ts`
- `app/api/market/options/skew/route.ts`
- `app/api/market/options/vol-cone/route.ts`
- `app/api/market/options/vrp/route.ts`

Each route currently does:
```typescript
const data = await getCached(`options:...:{asset}`);
if (!data) return NextResponse.json({ error: '...' }, { status: 503 });
return NextResponse.json(data);
```

**Problem:** No fallback when cache is empty. Pure passthrough from Redis.

### What Needs to Change

Extract the fetch-and-cache logic from the cron into a reusable function. Call it from both the cron AND the API routes on cache miss.

---

## 4. Implementation

### 4.1 Extract Reusable Fetch Functions

Create a new file: `lib/options/fetcher.ts`

This file extracts the core fetch-parse-cache logic from the cron into reusable functions that both the cron and API routes can call.

```typescript
// lib/options/fetcher.ts

/**
 * Fetches the full options chain from Deribit, parses it, computes aggregates,
 * caches everything in Redis, and optionally dispatches to the Quant Engine.
 * 
 * Returns the cached data shape so the caller can return it directly.
 * 
 * This is called by:
 * 1. The refresh-options cron (proactive, on schedule)
 * 2. Any options API route on cache miss (reactive, on first request)
 */
export async function fetchAndCacheOptionsData(
  asset: "BTC" | "ETH",
  options?: {
    skipQuantEngine?: boolean;    // Skip Quant Engine dispatch (for faster warm-up)
    skipPersistence?: boolean;    // Skip PostgreSQL writes (cron handles this)
  }
): Promise<{
  chain: OptionsChainData | null;
  aggregate: AggregateData | null;
  volSurface: VolSurfaceData | null;
  rnd: Record<string, RNDData> | null;  // keyed by expiry date
  skew: SkewData | null;
  volCone: VolConeData | null;
  vrp: VRPData | null;
}> {
  // 1. Fetch from Deribit
  // 2. Parse chain
  // 3. Compute aggregates
  // 4. Cache chain + aggregates in Redis
  // 5. If Quant Engine configured AND !skipQuantEngine:
  //    - Dispatch to all 5 endpoints
  //    - Cache results in Redis
  // 6. If !skipPersistence:
  //    - Persist snapshots to PostgreSQL
  // 7. Return all data
}

/**
 * Lightweight version — just fetches and caches the raw chain + aggregates.
 * Doesn't dispatch to Quant Engine or persist to DB.
 * Used for fast cache warming when a user hits an empty cache.
 */
export async function warmChainCache(asset: "BTC" | "ETH"): Promise<boolean> {
  const result = await fetchAndCacheOptionsData(asset, {
    skipQuantEngine: false,  // Still try Quant Engine if configured
    skipPersistence: true,   // Don't write to DB on user-triggered warm
  });
  return result.chain !== null;
}
```

### 4.2 Refactor Cron to Use Shared Function

Update `app/api/cron/refresh-options/route.ts` to call `fetchAndCacheOptionsData()` instead of having the fetch logic inline:

```typescript
// Before (pseudocode of current cron):
for (const asset of ["BTC", "ETH"]) {
  const chain = await deribit.getBookSummary(asset);
  const parsed = parseChain(chain);
  await setCached(`options:chain:${asset}`, parsed, 3600);
  // ... more inline logic
}

// After:
for (const asset of ["BTC", "ETH"] as const) {
  await fetchAndCacheOptionsData(asset, {
    skipQuantEngine: false,
    skipPersistence: false,  // Cron does persist
  });
}
```

The cron becomes a thin scheduler that calls the shared function. All logic lives in `fetcher.ts`.

### 4.3 Update API Routes with On-Demand Warming

Update each of the 6 options API routes to warm the cache on miss.

**Pattern for chain route:**

```typescript
// app/api/market/options/chain/route.ts

export async function GET(request: NextRequest) {
  const asset = request.nextUrl.searchParams.get("asset") || "BTC";
  
  // Try cache first (fast path — 99% of requests)
  let data = await getCached(`options:chain:${asset}`);
  
  // Cache miss — warm on demand
  if (!data) {
    console.log(`[options/chain] Cache miss for ${asset}, warming on demand...`);
    await warmChainCache(asset as "BTC" | "ETH");
    data = await getCached(`options:chain:${asset}`);
  }
  
  // Still null — Deribit is truly unavailable
  if (!data) {
    return NextResponse.json(
      { error: "Options data temporarily unavailable", asset },
      { status: 503 }
    );
  }
  
  return NextResponse.json(data);
}
```

**Pattern for compute-dependent routes (vol-surface, rnd, skew, vol-cone, vrp):**

```typescript
// app/api/market/options/vol-surface/route.ts

export async function GET(request: NextRequest) {
  const asset = request.nextUrl.searchParams.get("asset") || "BTC";
  
  // Try cache first
  let data = await getCached(`options:vol-surface:${asset}`);
  
  // Cache miss — warm everything (including Quant Engine dispatch)
  if (!data) {
    console.log(`[options/vol-surface] Cache miss for ${asset}, warming on demand...`);
    const result = await fetchAndCacheOptionsData(asset as "BTC" | "ETH", {
      skipQuantEngine: false,
      skipPersistence: true,
    });
    data = result.volSurface;
    
    // If still null, Quant Engine isn't configured — return appropriate message
    if (!data) {
      return NextResponse.json(
        { 
          error: "Quant Engine not configured",
          asset,
          inert: true,
          message: "Configure QUANT_ENGINE_URL to enable computed volatility analytics"
        },
        { status: 503 }
      );
    }
  }
  
  return NextResponse.json(data);
}
```

### 4.4 Prevent Concurrent Warming (Thundering Herd)

If 10 users hit the volatility page simultaneously on a cold cache, we don't want 10 parallel Deribit fetches. Add a simple in-flight lock using Redis:

```typescript
// lib/options/fetcher.ts

const WARMING_LOCK_TTL = 30; // seconds

async function acquireWarmingLock(asset: string): Promise<boolean> {
  // SET NX — only succeeds if key doesn't exist
  const result = await redis.set(
    `options:warming:${asset}`,
    "1",
    { nx: true, ex: WARMING_LOCK_TTL }
  );
  return result === "OK";
}

async function releaseWarmingLock(asset: string): Promise<void> {
  await redis.del(`options:warming:${asset}`);
}

export async function warmChainCache(asset: "BTC" | "ETH"): Promise<boolean> {
  // Try to acquire lock
  const acquired = await acquireWarmingLock(asset);
  
  if (!acquired) {
    // Another request is already warming — wait briefly, then check cache
    await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3s
    const cached = await getCached(`options:chain:${asset}`);
    return cached !== null;
  }
  
  try {
    const result = await fetchAndCacheOptionsData(asset, {
      skipQuantEngine: false,
      skipPersistence: true,
    });
    return result.chain !== null;
  } finally {
    await releaseWarmingLock(asset);
  }
}
```

This ensures only one Deribit fetch happens per asset at a time. Concurrent requests wait 3 seconds then check if the cache was populated by the first request.

### 4.5 Derivatives Routes — Same Pattern

The derivatives data routes (`/api/market/funding`, `/api/market/open-interest`, `/api/market/basis`, `/api/market/screener`, etc.) may have the same cold-cache problem. Check each one:

**If they already do on-demand fetching from exchanges on cache miss:** No change needed.

**If they also return 503 on empty cache:** Apply the same pattern — extract the fetch logic, call it on cache miss. The derivatives data is simpler (just REST calls to Binance/Bybit, no Quant Engine), so the warming is faster (~1-2s).

**Check these routes:**
- `app/api/market/funding/route.ts`
- `app/api/market/open-interest/route.ts`
- `app/api/market/basis/route.ts`
- `app/api/market/health/route.ts`
- `app/api/market/screener/route.ts`
- `app/api/market/liquidation-heatmap/route.ts`
- `app/api/market/compare/route.ts`
- `app/api/market/cvd/route.ts`

For each: if it returns 503 on empty cache without attempting a fresh fetch, add on-demand warming. The cron keeps running for proactive freshness — on-demand is just the safety net.

---

## 5. File Changes

### New Files

```
lib/options/fetcher.ts              # Shared fetch-parse-cache logic
```

### Files to Modify

```
app/api/cron/refresh-options/route.ts     # Refactor to call fetchAndCacheOptionsData()
app/api/market/options/chain/route.ts     # Add on-demand warming on cache miss
app/api/market/options/vol-surface/route.ts  # Add on-demand warming
app/api/market/options/rnd/route.ts       # Add on-demand warming
app/api/market/options/skew/route.ts      # Add on-demand warming
app/api/market/options/vol-cone/route.ts  # Add on-demand warming
app/api/market/options/vrp/route.ts       # Add on-demand warming

# Check and potentially update these derivatives routes too:
app/api/market/funding/route.ts
app/api/market/open-interest/route.ts
app/api/market/basis/route.ts
app/api/market/health/route.ts
app/api/market/screener/route.ts
app/api/market/liquidation-heatmap/route.ts
app/api/market/compare/route.ts
app/api/market/cvd/route.ts
```

---

## 6. Implementation Order

1. **Create `lib/options/fetcher.ts`** — extract fetch-parse-cache logic from the cron into `fetchAndCacheOptionsData()` and `warmChainCache()` with the Redis locking mechanism
2. **Refactor the cron** — replace inline logic with calls to `fetchAndCacheOptionsData()`. Verify the cron still works identically (trigger manually, check logs)
3. **Update the 6 options API routes** — add cache-miss → warm on demand → retry cache pattern
4. **Audit derivatives routes** — check each one for the same cold-cache 503 issue. Fix any that return 503 without attempting a fresh fetch
5. **Test** — deploy, clear Redis cache manually (or wait for TTL expiry), visit `/terminal/volatility` and confirm data loads after a brief delay instead of showing "not available"

---

## 7. Definition of Done

- [ ] `lib/options/fetcher.ts` exists with `fetchAndCacheOptionsData()` and `warmChainCache()`
- [ ] Refresh-options cron refactored to use shared function (no behavioral change)
- [ ] All 6 options API routes warm cache on miss instead of returning 503
- [ ] Thundering herd protection via Redis lock prevents concurrent Deribit fetches
- [ ] First visit to `/terminal/volatility` on cold cache shows data after brief loading (not "not available")
- [ ] Subsequent visits within TTL are instant (served from cache)
- [ ] Cron still works as before (manual trigger produces same results)
- [ ] Derivatives routes audited — any that returned 503 on cold cache now warm on demand
- [ ] Overview tab (put/call ratio, max pain, raw IV) populates even without Quant Engine
- [ ] Compute-dependent tabs (Vol Surface, RND, etc.) show "Quant Engine not configured" only when QE is truly absent — not when cache is simply cold
- [ ] No duplicate Deribit fetches under concurrent load (lock works)
- [ ] Zero TypeScript errors, build passes

---

## 8. What This Fixes

After this change:
- **Fresh deploy:** first visitor triggers data population automatically. No manual cron trigger needed.
- **Hobby plan:** even with daily cron, active users keep the cache warm through their requests.
- **Cron failure:** if the cron silently fails, user traffic self-heals the cache.
- **Demo/showcase:** someone clicking "Explore terminal" and navigating to Volatility sees real data within a few seconds, not an error screen.

The "INERT MODE" / "not available" state should only appear when either Deribit itself is unreachable or (for compute-dependent tabs) the Quant Engine isn't deployed. Never because the cron hasn't run yet.

---

*This PRD is a standalone fix. It can be executed immediately and does not block or depend on the Quant Engine deployment. The two can run in parallel.*
