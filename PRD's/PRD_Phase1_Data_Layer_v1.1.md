# PRD: Phase 1 — Data Layer (Mock → Live)

**Version:** 1.1
**Date:** April 7, 2026
**Status:** Ready for Implementation
**Priority:** Critical Path — blocks all subsequent phases

### Key Architecture Decisions (Resolved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | **Hybrid** — keep existing WS+SSE for real-time data, add REST+cron for slow metrics | Preserves working code (ws-manager.ts, stream-coordinator.ts, SSE pipeline), avoids rewrite |
| Cache Backend | **Upstash Redis** (`@upstash/redis`) | Survives serverless cold starts, shared across invocations, free tier sufficient for alpha |
| Exchange Coverage | **Binance + Bybit** only | Two largest perp venues cover the vast majority of volume; OKX stub remains for future |

---

## 1. Context

### What Is Scope Alpha

Scope Alpha is a crypto derivatives analytics and trading strategy marketplace. Verified analysts publish timestamped trading signals, create chart annotations, and monetize their expertise through subscription tiers. Subscribers browse the marketplace, view analyst profiles, and receive real-time signals overlaid on trading charts.

The platform is currently in demo/alpha stage. All market data displayed is mock/seeded. This PRD defines the work required to replace all mock data with live exchange feeds across every surface of the application.

### Current Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14.2.5, React 18.3.1, TypeScript 5.4.5 |
| State Management | Zustand 4.5.2 with localStorage persistence |
| Styling | Tailwind CSS 3.4.4, custom glass-morphism design system |
| Charts | Lightweight Charts 4.2.0 |
| Auth | NextAuth 4.24.13, JWT sessions, bcrypt, Google OAuth |
| Database | PostgreSQL via Neon (cloud), connection pooling |
| ORM | Prisma 6.19.2 |
| Deployment | Vercel (frontend) + Neon PostgreSQL (database) |

### What Already Exists (from 3/24 Build)

The 3/24 implementation built a substantial live-data layer using an in-process WebSocket → SSE push model with in-memory cache. The following files and systems are already in place and should be **preserved, not rewritten**:

- **`ws-manager.ts`** — WebSocket connection manager for Binance streams
- **`stream-coordinator.ts`** — Coordinates multiple WS streams, manages subscriptions
- **SSE pipeline** — Server-Sent Events push from server → client for real-time updates
- **Zustand integration** — SSE data flows into Zustand stores which feed React components
- **`lib/market-data/cache.ts`** — In-memory cache (will remain for WS-served data; Upstash is additive)
- **Bybit/OKX connector stubs** — Interface definitions exist but have no real REST/WS implementation

This existing pipeline handles: **OHLCV candles, live ticker prices, and liquidation events** via WebSocket with real-time push to the client.

### What Does NOT Exist Yet

- Live funding rate data (Binance or Bybit)
- Live open interest data (Binance or Bybit)
- Live basis/premium analysis
- Health Score computed from real inputs
- Multi-exchange comparison (Bybit connector is a stub)
- Server-side persistent cache (Upstash Redis)
- Screener aggregation from live data
- Sparkline generation from real candle closes
- Stale-cache fallback for resilience
- `config/assets.ts` for centralized asset list

---

## 2. Goals

After this phase is complete:

1. All candlestick charts display real-time live data via the existing WS+SSE pipeline
2. All derivatives metrics (funding, OI, basis) are fetched via REST and cached in Upstash
3. Liquidation data flows via the existing WS+SSE pipeline with Upstash as a persistence layer
4. The multi-asset screener shows live values with real sparklines
5. The Health Score is calculated from real inputs
6. Per-exchange comparison panels show Binance and Bybit data side-by-side
7. Upstash Redis caching prevents redundant exchange API calls for slow-moving metrics
8. The system gracefully handles exchange disconnects with stale-cache fallback

---

## 3. Architecture — Hybrid Model

### What Goes Through Existing WS+SSE Pipeline (Real-Time)

These data types need sub-second freshness. The existing WebSocket → SSE → Zustand pipeline already handles them:

| Data Type | Source | Existing? | Notes |
|-----------|--------|-----------|-------|
| OHLCV Candles | Binance `@kline_<interval>` | ✅ Yes | Already streaming via ws-manager.ts |
| Live Ticker/Price | Binance `@ticker` | ✅ Yes | Already streaming |
| Liquidation Events | Binance `@forceOrder` | ✅ Yes | Already streaming |

**No changes needed** for these streams — they work. The only work here is verifying they render correctly with the existing components and filling any gaps (see Sub-Phase 1A).

### What Goes Through New REST + Upstash + Cron (30-60s Freshness)

These data types update slowly and don't need real-time push:

| Data Type | Freshness Needed | Cron Interval | Cache TTL |
|-----------|-----------------|---------------|-----------|
| Funding Rates | Every 8 hours (rate itself), mark price drifts | 60s | 60s |
| Open Interest | Changes gradually | 30s | 30s |
| Basis/Premium | Changes gradually | 30s | 30s |
| Health Score | Composite of above | 60s | 60s |
| Screener Aggregation | Summary view | 30s | 30s |
| Sparklines | 24hr hourly closes | 60s | 60s |

These are served by Next.js API routes on Vercel that read from Upstash Redis. Vercel Cron Jobs (or client-side polling on cache miss) keep the cache warm.

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  REAL-TIME PATH (existing — do not rewrite)                 │
│                                                             │
│  Binance WS ──→ ws-manager.ts ──→ stream-coordinator.ts    │
│                                    ──→ SSE endpoint         │
│                                         ──→ Client EventSource
│                                              ──→ Zustand    │
│                                                   ──→ Charts│
│                                                   ──→ Ticker│
│                                                   ──→ Liqs  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SLOW METRICS PATH (new — build this)                       │
│                                                             │
│  Binance REST ──→ API routes ──→ Upstash Redis              │
│  Bybit REST   ──→ API routes ──→ Upstash Redis              │
│                                       │                     │
│  Vercel Cron ──→ refresh jobs ──→ Upstash Redis             │
│                                       │                     │
│                        Client polls API routes (30-60s)     │
│                              ──→ Zustand                    │
│                                   ──→ Funding Panel         │
│                                   ──→ OI Panel              │
│                                   ──→ Basis Panel           │
│                                   ──→ Health Score          │
│                                   ──→ Screener Table        │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Exchange Data Sources

### Primary: Binance

Binance has the deepest liquidity and most comprehensive free API for derivatives data.

**WebSocket Streams (already connected via ws-manager.ts):**

| Stream | URL Pattern | Data |
|--------|-------------|------|
| Kline (OHLCV) | `wss://fstream.binance.com/ws/<symbol>@kline_<interval>` | Real-time candlestick updates |
| Mark Price | `wss://fstream.binance.com/ws/<symbol>@markPrice@1s` | Current funding rate, mark price, next funding time |
| Ticker | `wss://fstream.binance.com/ws/<symbol>@ticker` | 24hr price change, volume, last price |
| Liquidation | `wss://fstream.binance.com/ws/<symbol>@forceOrder` | Individual liquidation events (side, qty, price) |
| All Market Tickers | `wss://fstream.binance.com/ws/!ticker@arr` | All symbols ticker data in one stream |

**REST Endpoints (new — for slow metrics):**

| Endpoint | Use Case | Rate Limit |
|----------|----------|------------|
| `GET /fapi/v1/premiumIndex` | Current funding rate, mark price, index price | 2400 req/min (IP) |
| `GET /fapi/v1/openInterest` | Current open interest for a symbol | 2400 req/min |
| `GET /fapi/v1/fundingRate` | Historical funding rate records | 2400 req/min |
| `GET /fapi/v1/klines` | Historical candle backfill (if needed beyond WS) | 2400 req/min |
| `GET /fapi/v1/ticker/24hr` | 24hr stats for all symbols | 2400 req/min |

**Combined Streams:** Binance supports combined streams via `wss://fstream.binance.com/stream?streams=<stream1>/<stream2>`. Max 200 streams per connection, max 5 messages/sec outbound.

### Secondary: Bybit

Used for per-exchange comparison in funding rate, OI, and basis panels.

**REST (new — implement real calls against existing stub interfaces):**

| Endpoint | Use Case |
|----------|----------|
| `GET /v5/market/tickers?category=linear` | Funding rate, OI, mark price, index price, 24hr stats |
| `GET /v5/market/funding/history` | Historical funding records |

Bybit's tickers endpoint returns funding rate, OI, mark price, and index price all in one call — efficient for the comparison panels.

### OKX — Deferred

The OKX connector stub remains in the codebase but will **not** be implemented in this phase. Per-exchange panels will show Binance and Bybit columns. OKX can be wired up in a future iteration with minimal effort since the interface already exists.

---

## 5. Sub-Phase 1A — Verify & Complete Live OHLCV Charting

### Objective

The existing WS+SSE pipeline already streams candle data. This sub-phase verifies it works end-to-end, fills any gaps, and adds the connection status indicator.

### Implementation Steps

#### 5.1 Verify Existing Pipeline

Confirm the following work correctly with real Binance data:
- Candles stream into Lightweight Charts via Zustand
- `candlestickSeries.setData()` called on initial load with historical backfill
- `candlestickSeries.update()` called on each new WS candle event
- Chart renders without errors or stale data bleed

If the existing pipeline handles historical backfill via WS, no REST backfill route is needed. If it doesn't, add a thin route:

Create (if needed): `app/api/market/candles/route.ts`
```
GET /api/market/candles?symbol=BTCUSDT&interval=1h&limit=500
```
Calls Binance REST `GET /fapi/v1/klines`, transforms to Lightweight Charts format, returns array.

#### 5.2 Multi-Timeframe Support

Supported intervals (must map to Binance interval codes):
| UI Label | Binance Code |
|----------|-------------|
| 1m | 1m |
| 5m | 5m |
| 15m | 15m |
| 1H | 1h |
| 4H | 4h |
| 1D | 1d |
| 1W | 1w |

On interval change:
1. Unsubscribe from current kline stream via ws-manager
2. Clear current candle data in Zustand
3. Subscribe to new kline stream
4. Historical backfill for new interval

#### 5.3 Multi-Asset Switching

When user switches assets (e.g., BTCUSDT → ETHUSDT):
1. Unsubscribe old symbol streams via ws-manager
2. Clear stale data in Zustand to prevent rendering old candles
3. Subscribe new symbol streams
4. Historical backfill for new symbol

#### 5.4 Connection Status Indicator

Add a small UI indicator (dot or badge) near the chart:
- 🟢 Green: SSE connected, data fresh (last update < 2× expected interval)
- 🟡 Yellow: Data stale (last update > 2× expected interval)
- 🔴 Red: SSE disconnected or WS error

Track `lastUpdateTimestamp` in Zustand.

#### 5.5 Supported Assets (Initial Launch Set)

Create: `config/assets.ts`

```typescript
export const SUPPORTED_ASSETS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'LINKUSDT',
  'MATICUSDT', 'LTCUSDT', 'ARBUSDT', 'OPUSDT', 'APTUSDT',
] as const;

export type SupportedAsset = typeof SUPPORTED_ASSETS[number];
```

All components referencing asset lists should import from this config.

---

## 6. Sub-Phase 1B — Live Derivatives Metrics (New REST + Upstash Path)

### Objective

Build the new REST + Upstash caching path for slow-moving derivatives metrics: funding rates, open interest, basis, and liquidation aggregates. These power the dashboard panels and the health score.

### Implementation Steps

#### 6.1 Funding Rate API Route

Create: `app/api/market/funding/route.ts`

```
GET /api/market/funding?symbol=BTCUSDT
```

Response shape:
```typescript
interface FundingData {
  symbol: string;
  currentRate: number;           // Current funding rate (decimal, e.g., 0.0001 = 0.01%)
  nextFundingTime: number;       // Unix timestamp
  avg8h: number;                 // Average of last 3 funding periods (8hr avg)
  annualizedCarry: number;       // currentRate × 3 × 365 × 100
  zScore: number;                // (current - mean) / stddev over last 30 days
  byExchange: {
    binance: number;
    bybit: number;
  };
}
```

Implementation:
1. Check Upstash cache for `market:funding:{symbol}` — return if fresh
2. Fetch current funding rate from Binance `GET /fapi/v1/premiumIndex`
3. Fetch historical funding rates from Binance `GET /fapi/v1/fundingRate?limit=90` (30 days ≈ 90 periods)
4. Fetch current rate from Bybit `GET /v5/market/tickers?category=linear&symbol={symbol}`
5. Compute avg8h from last 3 historical records
6. Compute annualized carry: `currentRate × 3 × 365 × 100`
7. Compute z-score from 30-day history: `(current - mean) / stddev`
8. Write to Upstash with 60s TTL + stale key with 5min TTL
9. Return response

#### 6.2 Open Interest API Route

Create: `app/api/market/open-interest/route.ts`

```
GET /api/market/open-interest?symbol=BTCUSDT
```

Response shape:
```typescript
interface OpenInterestData {
  symbol: string;
  aggregateOI: number;           // Total OI in contracts (Binance + Bybit)
  aggregateOIUsd: number;        // Total OI in USD
  change24h: number;             // Net change in OI over 24hr (contracts)
  change24hPct: number;          // Percentage change
  byExchange: {
    binance: { oi: number; oiUsd: number };
    bybit: { oi: number; oiUsd: number };
  };
}
```

Implementation:
1. Check Upstash cache — return if fresh
2. Fetch from Binance `GET /fapi/v1/openInterest?symbol={symbol}`
3. Fetch from Bybit `GET /v5/market/tickers?category=linear&symbol={symbol}` (includes OI fields)
4. For 24hr change: store previous OI value in Upstash key `market:oi:prev:{symbol}` (25hr TTL), compute delta on next fetch
5. Write to Upstash with 30s TTL + stale key with 5min TTL

#### 6.3 Liquidation Aggregates API Route

The existing WS+SSE pipeline streams individual liquidation events in real-time. This route provides **aggregated summaries** (24hr totals, long/short ratio) for the dashboard panels.

Create: `app/api/market/liquidations/route.ts`

```
GET /api/market/liquidations?symbol=BTCUSDT&period=24h
```

Response shape:
```typescript
interface LiquidationData {
  symbol: string;
  period: string;
  longLiquidationVolume: number;    // USD value of long liquidations
  shortLiquidationVolume: number;   // USD value of short liquidations
  totalLiquidationVolume: number;
  longShortRatio: number;           // long / short
  exchangeHeatmap: {
    binance: { long: number; short: number };
    bybit: { long: number; short: number };
  };
  recentLiquidations: Array<{       // Last 20 liquidation events
    time: number;
    side: 'long' | 'short';
    quantity: number;
    price: number;
    exchange: string;
  }>;
}
```

Implementation:
1. **For the `recentLiquidations` array:** Read from the existing WS-fed in-memory cache or Zustand store — these are already being captured by the SSE pipeline
2. **For aggregate volumes:** Accumulate liquidation events into Upstash rolling counters. Each incoming liquidation event (from the WS stream) writes an increment to Upstash keys like `market:liqs:long:{symbol}` and `market:liqs:short:{symbol}` using `INCRBYFLOAT`, with a 24hr TTL
3. **For Bybit liquidations:** Bybit's REST `GET /v5/market/recent-trade?category=linear&symbol={symbol}` can be polled, or use their liquidation WS stream if adding Bybit WS support later
4. **Fallback:** If WS-based accumulation isn't reliable, poll a third-party aggregator (CoinGlass API) for 24hr liquidation totals
5. Cache aggregated response with 60s TTL

**Note:** Liquidation aggregation is the most complex piece. Accept imperfect data quality at alpha — Binance-only aggregation is fine for launch, with Bybit as a stretch goal within this sub-phase.

#### 6.4 Basis Analysis API Route

Create: `app/api/market/basis/route.ts`

```
GET /api/market/basis?symbol=BTCUSDT
```

Response shape:
```typescript
interface BasisData {
  symbol: string;
  basisPct: number;             // (markPrice - indexPrice) / indexPrice × 100
  annualizedBasisRate: number;  // For perps, use funding-implied: annualizedCarry from funding data
  byExchange: {
    binance: { markPrice: number; indexPrice: number; basisPct: number };
    bybit: { markPrice: number; indexPrice: number; basisPct: number };
  };
}
```

Implementation:
1. Check Upstash cache — return if fresh
2. Binance: `GET /fapi/v1/premiumIndex` returns `markPrice` and `indexPrice`
3. Bybit: `GET /v5/market/tickers?category=linear&symbol={symbol}` returns `markPrice` and `indexPrice`
4. Compute `basisPct = (markPrice - indexPrice) / indexPrice × 100` for each exchange
5. For annualized rate on perpetuals: reuse `annualizedCarry` from funding data (read from Upstash `market:funding:{symbol}`)
6. Write to Upstash with 30s TTL + stale key with 5min TTL

#### 6.5 Health Score

Create: `app/api/market/health/route.ts`

```
GET /api/market/health?symbol=BTCUSDT
```

Response shape:
```typescript
interface HealthScore {
  score: number;          // 0-100
  label: string;          // "Bearish" | "Cautious" | "Neutral" | "Bullish" | "Euphoric"
  components: {
    fundingScore: number;     // 0-100 based on funding rate z-score
    oiScore: number;          // 0-100 based on OI change momentum
    liquidationScore: number; // 0-100 based on liquidation imbalance
    basisScore: number;       // 0-100 based on basis premium
  };
}
```

This route reads from Upstash cache keys for funding, OI, liquidations, and basis — it does NOT call exchanges directly.

Scoring logic:
- **Funding Score:** Map z-score to 0-100. z > 2 = extreme bullish (90+), z < -2 = extreme bearish (10-)
- **OI Score:** Rising OI + rising price = bullish. Rising OI + falling price = bearish. Map to 0-100.
- **Liquidation Score:** High long liquidation ratio = bearish. High short liquidation ratio = bullish. Map to 0-100.
- **Basis Score:** Premium above historical average = bullish. Discount = bearish. Map to 0-100.
- **Composite:** Weighted average. Weights defined in `config/healthScore.ts`: funding 30%, OI 25%, liquidation 25%, basis 20%.

Cache with 60s TTL.

---

## 7. Sub-Phase 1C — Upstash Redis Caching & Resilience

### Objective

Set up Upstash Redis as the persistent cache for all slow-moving metrics. Implement resilience patterns (stale fallback, rate limiting, error handling).

### Implementation Steps

#### 7.1 Upstash Redis Setup

Install: `npm install @upstash/redis`

Create: `lib/cache.ts`

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCached<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await redis.set(key, value, { ex: ttlSeconds });
}

export async function setCachedWithStale<T>(
  key: string,
  value: T,
  ttlSeconds: number,
  staleTtlSeconds: number = 300
): Promise<void> {
  await Promise.all([
    redis.set(key, value, { ex: ttlSeconds }),
    redis.set(`${key}:stale`, value, { ex: staleTtlSeconds }),
  ]);
}

export async function getStaleFallback<T>(key: string): Promise<T | null> {
  return redis.get<T>(`${key}:stale`);
}
```

Cache key pattern: `market:{dataType}:{symbol}`

| Key | TTL | Stale TTL |
|-----|-----|-----------|
| `market:funding:{symbol}` | 60s | 5min |
| `market:oi:{symbol}` | 30s | 5min |
| `market:oi:prev:{symbol}` | 25h | — |
| `market:basis:{symbol}` | 30s | 5min |
| `market:liquidations:{symbol}` | 60s | 5min |
| `market:health:{symbol}` | 60s | 5min |
| `market:screener` | 30s | 5min |
| `market:sparkline:{symbol}` | 60s | 5min |

#### 7.2 Vercel Cron Jobs for Cache Warming

Create cron-triggered API routes that pre-populate Upstash:

| Cron Route | Schedule | Action |
|------------|----------|--------|
| `app/api/cron/refresh-metrics/route.ts` | Every 1 min | Fetch funding, OI, basis for all 15 assets from Binance + Bybit REST, write to Upstash |
| `app/api/cron/refresh-screener/route.ts` | Every 1 min | Read all metric cache keys, aggregate into screener format, write to Upstash |

Note: Vercel's minimum cron interval is 1 minute. For 30s freshness on OI/basis, the client-side polling approach (API routes that fetch-on-cache-miss) fills the gap between cron runs. The cron jobs ensure the cache is warm even without active clients.

Configure in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/refresh-metrics", "schedule": "* * * * *" },
    { "path": "/api/cron/refresh-screener", "schedule": "* * * * *" }
  ]
}
```

Protect cron routes with `CRON_SECRET` header verification so they can't be triggered externally.

#### 7.3 Rate Limit Management

Create: `lib/exchangeClient.ts`

Wrapper around `fetch` that:
1. Tracks request count per exchange per minute (in-memory counter, resets each minute)
2. Logs warnings when usage exceeds 80% of limit
3. Returns `null` if rate limited (caller falls back to cache or secondary exchange)

Binance limit: 2400 requests/min per IP. With 15 assets × 4 metric types × 1 request/min = ~60 requests/min. Well within limits.

Bybit limit: 120 requests/min for public endpoints. With 15 assets × 1 ticker call/min = ~15 requests/min. Fine.

#### 7.4 Error Handling & Fallback Pattern

Every slow-metric API route must follow this pattern:

```typescript
export async function GET(request: Request) {
  const { symbol } = parseParams(request);
  const cacheKey = `market:funding:${symbol}`;

  // 1. Try fresh cache
  const cached = await getCached<FundingData>(cacheKey);
  if (cached) return Response.json(cached);

  // 2. Try primary exchange (Binance)
  try {
    const data = await fetchBinanceFunding(symbol);
    await setCachedWithStale(cacheKey, data, 60, 300);
    return Response.json(data);
  } catch (err) {
    console.error(`Binance funding failed for ${symbol}:`, err);
  }

  // 3. Try secondary exchange (Bybit)
  try {
    const data = await fetchBybitFunding(symbol);
    await setCachedWithStale(cacheKey, data, 60, 300);
    return Response.json(data);
  } catch (err) {
    console.error(`Bybit funding failed for ${symbol}:`, err);
  }

  // 4. Return stale cache
  const stale = await getStaleFallback<FundingData>(cacheKey);
  if (stale) return Response.json({ ...stale, _stale: true });

  // 5. Error
  return Response.json({ error: 'All exchange feeds unavailable' }, { status: 503 });
}
```

#### 7.5 Exchange API Response Types & Transforms

Create: `types/exchange.ts` — TypeScript types for raw Binance and Bybit API responses

Create: `lib/transforms.ts` — Functions mapping raw responses to normalized internal types:
- `transformBinanceFunding(raw) → FundingData`
- `transformBybitFunding(raw) → FundingData`
- `transformBinanceOI(raw) → OpenInterestData`
- `transformBybitOI(raw) → OpenInterestData`
- `transformBinanceBasis(raw) → BasisData`
- `transformBybitBasis(raw) → BasisData`

Each exchange gets its own transform. The API routes call the appropriate transform before caching.

---

## 8. Sub-Phase 1D — Multi-Asset Screener (Live)

### Objective

Replace the mock screener table with real aggregated data for all supported assets.

### Implementation Steps

#### 8.1 Screener Data API Route

Create: `app/api/market/screener/route.ts`

```
GET /api/market/screener
```

Response shape:
```typescript
interface ScreenerRow {
  symbol: string;
  price: number;
  change24h: number;
  change24hPct: number;
  volume24h: number;
  fundingRate: number;
  fundingAnnualized: number;
  openInterest: number;
  oiChange24hPct: number;
  liquidation24hTotal: number;
  liquidationLongShortRatio: number;
  basisPct: number;
  healthScore: number;
  regime: 'bearish' | 'cautious' | 'neutral' | 'bullish' | 'euphoric';
  sparkline: number[];  // Last 24 hourly closes
}

type ScreenerResponse = ScreenerRow[];
```

Implementation:
1. Read from Upstash `market:screener` — return if fresh
2. If cache miss: iterate all 15 assets, read their individual metric cache keys from Upstash, aggregate into `ScreenerRow[]`
3. The `refresh-screener` cron job does this aggregation proactively every minute
4. Cache with 30s TTL

#### 8.2 Sparkline Generation

For each asset, store the last 24 hourly close prices in Upstash:
- Key: `market:sparkline:{symbol}`
- Source: The existing WS pipeline already receives candle data. On each 1H candle close, push the close price to a rolling array in Upstash (use `LPUSH` + `LTRIM` to maintain 24 elements)
- Alternative: The metrics cron job fetches the last 24 1H candles via Binance REST `GET /fapi/v1/klines?interval=1h&limit=24` and writes the close array

The screener cron reads these arrays and includes them in each `ScreenerRow`.

#### 8.3 Regime Classification

Map health score ranges to regime labels:
```typescript
function classifyRegime(healthScore: number): string {
  if (healthScore >= 80) return 'euphoric';
  if (healthScore >= 60) return 'bullish';
  if (healthScore >= 40) return 'neutral';
  if (healthScore >= 20) return 'cautious';
  return 'bearish';
}
```

#### 8.4 Screener UI Updates

The existing screener component needs:
1. Replace mock data source with `GET /api/market/screener`
2. Poll every 30s for updates
3. Render sparklines from the `sparkline` array (SVG sparkline or Lightweight Charts small series)
4. Color-code regime badges (red → green gradient)
5. All sort columns wired to real numeric values
6. Loading skeleton on first fetch
7. "Last updated: Xs ago" timestamp

#### 8.5 Screener Filters

Verify these filters function correctly against real data:
- Symbol search
- Sort by: price, 24h change, volume, funding rate, OI, health score
- Filter by regime

---

## 9. New Dependencies

| Package | Purpose | Install |
|---------|---------|---------|
| `@upstash/redis` | Server-side persistent cache | `npm install @upstash/redis` |

No other new dependencies. Lightweight Charts 4.2.0 and all WS/SSE infrastructure already exist.

---

## 10. Environment Variables

Add to `.env.local` and Vercel project settings:

```env
# Upstash Redis
UPSTASH_REDIS_REST_URL=         # From Upstash dashboard
UPSTASH_REDIS_REST_TOKEN=       # From Upstash dashboard

# Cron security
CRON_SECRET=                    # Vercel cron job auth header

# Feature flags
NEXT_PUBLIC_LIVE_DATA_ENABLED=true   # Toggle to fall back to mock data during issues
```

Exchange API keys are NOT required — all endpoints used are public.

---

## 11. File Structure

**New files to create:**

```
config/
  assets.ts                          # Supported asset list and metadata
  healthScore.ts                     # Health score component weights

lib/
  cache.ts                           # Upstash Redis read/write/stale helpers
  exchangeClient.ts                  # Rate-limited fetch wrapper for REST calls
  transforms.ts                      # Exchange response → internal type mappers
  exchanges/
    binance.ts                       # Binance REST fetch functions
    bybit.ts                         # Bybit REST fetch functions

types/
  exchange.ts                        # Raw Binance + Bybit API response types
  market.ts                          # Internal normalized market data types

app/api/market/
  funding/route.ts                   # Funding rate data (REST + Upstash)
  open-interest/route.ts             # Open interest data (REST + Upstash)
  liquidations/route.ts              # Liquidation aggregates (WS accumulation + Upstash)
  basis/route.ts                     # Basis analysis (REST + Upstash)
  health/route.ts                    # Health score composite (reads Upstash)
  screener/route.ts                  # Aggregated screener data (reads Upstash)
  candles/route.ts                   # Historical backfill (if needed beyond existing WS)

app/api/cron/
  refresh-metrics/route.ts           # Cron: update funding/OI/basis for all assets
  refresh-screener/route.ts          # Cron: aggregate screener + sparklines
```

**Existing files to modify:**

```
# Derivatives metric panels — swap mock data for new API route calls
# Screener table — swap mock data for screener API call
# Health score component — swap mock calculation for health API call
# Add connection status indicator to chart area
# Wire liquidation WS events to Upstash accumulation (bridge between real-time and slow paths)
```

**Existing files to preserve (do not rewrite):**

```
# ws-manager.ts — WebSocket connection manager
# stream-coordinator.ts — Multi-stream coordinator
# SSE endpoint(s) — Server-Sent Events push
# Existing Zustand stores for candles/tickers/liquidations
# lib/market-data/cache.ts — In-memory cache (still used by WS path)
```

---

## 12. Testing & Validation

### Manual Verification Checklist

- [ ] Chart loads real candles for BTCUSDT on 1H timeframe via existing WS+SSE pipeline
- [ ] Switching timeframes (1m → 4H → 1D) loads correct data
- [ ] Switching assets (BTC → ETH → SOL) loads correct data without stale candle bleed
- [ ] Chart updates in real-time via SSE (not polling)
- [ ] Connection status indicator shows green during normal operation
- [ ] Connection status indicator shows red when SSE disconnects
- [ ] Funding rate panel shows real values, Binance + Bybit side-by-side
- [ ] Funding rate values match Binance UI (spot check)
- [ ] OI panel shows real values, Binance + Bybit side-by-side
- [ ] Basis panel shows real values with per-exchange comparison
- [ ] Liquidation panel shows real data (at minimum Binance, stretch goal Bybit)
- [ ] Health score updates and reflects current market conditions
- [ ] Screener shows all 15 assets with real data
- [ ] Screener sparklines reflect actual 24hr price movement
- [ ] Screener sorting works on all columns
- [ ] All panels render correctly with the glass-morphism design system
- [ ] Mock data toggle (`LIVE_DATA_ENABLED=false`) falls back to mock data cleanly
- [ ] Stale cache fallback works: kill exchange connectivity → UI shows last-known data with `_stale` indicator
- [ ] Upstash cache populates correctly (verify via Upstash dashboard)
- [ ] Cron jobs run on schedule and warm cache (verify via Vercel logs)

### Performance Targets

- Chart initial load (with history backfill): < 2 seconds
- Real-time candle update latency (WS → SSE → chart): < 500ms
- Slow metric API response (cache hit): < 200ms
- Slow metric API response (cache miss, exchange fetch): < 2 seconds
- Screener full load: < 1 second
- Upstash cache hit rate during normal operation: > 90%
- Zero crashed tabs from memory leaks (monitor over 1hr session)

---

## 13. Rollout Plan

1. **Set up Upstash Redis** — create instance, add env vars, deploy `lib/cache.ts`
2. **Create config files** — `assets.ts`, `healthScore.ts`
3. **Build exchange clients** — `lib/exchanges/binance.ts`, `lib/exchanges/bybit.ts`, `lib/transforms.ts`
4. **Verify existing WS+SSE charting** (1A) — confirm candles, tickers, liquidations stream correctly
5. **Build slow-metric API routes** (1B) — funding, OI, basis, liquidations aggregate, health score
6. **Build cron jobs** (1C) — `refresh-metrics`, `refresh-screener`
7. **Build screener route** (1D) — aggregation + sparklines
8. **Wire UI components** — swap mock data sources for new API routes in all dashboard panels
9. **Add feature flag** — `LIVE_DATA_ENABLED` toggle
10. **Test against real exchange data** — verify numbers match exchange UIs
11. **Deploy to staging** — monitor Upstash usage, cron execution, rate limits
12. **Deploy to production** — monitor error rates for 48hrs

---

## 14. Out of Scope

The following are explicitly NOT part of this phase:

- Stripe payments (Phase 2)
- Email notifications (Phase 3)
- Telegram bot (Phase 3)
- Copy trading (Phase 4+)
- Mobile app (Phase 8)
- OKX exchange integration (deferred — stub remains)
- Bybit WebSocket integration (REST only for now)
- Authenticated exchange endpoints (portfolio, positions)
- Any changes to signals, annotations, subscriptions, reviews, or chat features
