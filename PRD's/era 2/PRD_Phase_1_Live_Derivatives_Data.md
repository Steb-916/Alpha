# PRD: Phase 1 — Live Derivatives Data

**Version:** 2.0
**Date:** April 16, 2026
**Status:** Ready for Implementation
**Priority:** Critical Path — blocks all subsequent phases
**Depends on:** Phase 0 (Strip & Restructure) complete

---

## 1. Context

### What Is Scope Alpha (Post-Pivot)

Scope Alpha is a crypto analytics and quantitative intelligence platform. It provides derivatives data, options analytics, on-chain metrics, and proprietary quantitative tools. There are no analysts, no signals, no per-analyst subscriptions — the platform itself is the product.

Phase 0 stripped all marketplace code and rebuilt the app shell as a sidebar-based analytics terminal. The derivatives terminal UI exists at `/terminal/derivatives` with tabs for Overview, Funding, OI, Liquidations, Basis, and Screener. These tabs currently render components that may still reference mock data or empty states.

**Phase 1 makes the derivatives terminal real.** Every number, chart, and table must show live exchange data. This is the foundation everything else builds on — options analytics (Phase 3), on-chain (Phase 5), and the quant engine all depend on reliable, real-time derivatives data.

### Architecture Decision (Carried Forward)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | **Hybrid** — existing WS+SSE for real-time, REST+cron for slow metrics | Preserves working WS infrastructure, avoids new service for alpha |
| Cache Backend | **Upstash Redis** (`@upstash/redis`) | Survives serverless cold starts, shared across invocations |
| Exchange Coverage | **Binance + Bybit** | Two largest perp venues; OKX deferred |

**Note on future architecture:** The roadmap v2 calls for a separate Market Data Service on Railway/Fly.io for persistent WebSocket connections. That migration is NOT in scope for Phase 1. The current hybrid approach (in-process WS via Vercel + REST polling + Upstash) is sufficient for alpha. When user load or data freshness requirements demand it, the Market Data Service can be extracted as a dedicated phase.

---

## 2. Current State (Post-Phase 0)

### What Already Exists (from 3/24 Build)

The March 2024 implementation built a substantial live-data layer. These files and systems should be **preserved, not rewritten:**

| File/System | What It Does | Status |
|---|---|---|
| `ws-manager.ts` | WebSocket connection manager for Binance streams | ✅ Working |
| `stream-coordinator.ts` | Coordinates multiple WS streams, manages subscriptions | ✅ Working |
| SSE pipeline (`/api/health/sse` or similar) | Server-Sent Events push from server → client | ✅ Working |
| Zustand stores (marketDataStore, etc.) | SSE data → Zustand → React components | ✅ Working |
| `lib/market-data/cache.ts` | In-memory cache for WS-served data | ✅ Working |
| `lib/exchanges/binance.ts` | Binance REST fetch functions | ✅ Partial |
| `lib/exchanges/bybit.ts` | Bybit REST fetch functions | ⚠️ Stub only |
| `lib/cache.ts` | Upstash Redis read/write helpers | ✅ Exists |
| `lib/exchangeClient.ts` | Rate-limited fetch wrapper | ✅ Exists |
| `lib/transforms.ts` | Exchange response → internal type mappers | ✅ Exists |
| `config/assets.ts` | Supported asset list | ✅ Exists (updated in Phase 0) |

**Real-time streams already working:**

| Data Type | Source | Stream |
|---|---|---|
| OHLCV Candles | Binance | `@kline_<interval>` via WS |
| Live Ticker/Price | Binance | `@ticker` via WS |
| Liquidation Events | Binance | `@forceOrder` via WS |

### What Does NOT Exist Yet

- Bybit WebSocket streams (only Binance is wired)
- Bybit REST implementation (stub exists but no real fetch logic)
- Live funding rate data from either exchange
- Live open interest data from either exchange
- Live basis/premium computation
- Cross-exchange comparison (Binance vs Bybit side-by-side)
- Health Score computed from real inputs
- Screener aggregated from live data with real sparklines
- **Historical data persistence** — no data is being stored in PostgreSQL for long-term analysis
- Cron jobs for cache warming

---

## 3. Goals

After Phase 1 is complete:

1. All candlestick charts display real-time live data from Binance (existing) + Bybit (new)
2. Funding rate tab shows live rates from both exchanges with 8h avg, annualized carry, z-score, and cross-exchange comparison
3. Open interest tab shows live aggregate OI, per-exchange breakdown, and 24h net change
4. Liquidation tab shows real-time liquidation feed, 24h aggregates, and exchange breakdown
5. Basis tab shows live perp-spot premium/discount and annualized basis rate per exchange
6. Screener tab shows a live sortable table for all 10 assets with real sparklines
7. Health Score composite is calculated from real derivatives inputs
8. Upstash Redis caching prevents redundant exchange API calls
9. Historical data is accumulating in PostgreSQL for future use by the Quant Engine (backtesting, regime classification, etc.)
10. The system gracefully handles exchange disconnects with stale-cache fallback

---

## 4. Supported Assets

From `config/assets.ts` (established in Phase 0). Phase 1 flips `enabled: true` for each asset as data flows are confirmed:

| Symbol | Pair | Category | Priority |
|---|---|---|---|
| BTC | BTCUSDT | major | 1 — wire first, validate everything here |
| ETH | ETHUSDT | major | 1 |
| SOL | SOLUSDT | major | 2 |
| BNB | BNBUSDT | major | 2 |
| XRP | XRPUSDT | major | 2 |
| DOGE | DOGEUSDT | alt | 3 |
| ADA | ADAUSDT | alt | 3 |
| AVAX | AVAXUSDT | alt | 3 |
| LINK | LINKUSDT | defi | 3 |
| ARB | ARBUSDT | alt | 3 |

**Implementation order:** Wire BTC + ETH first end-to-end. Once the full pipeline is validated for these two, expand to the remaining 8 assets (should be mechanical — same code, different symbols).

---

## 5. Architecture — Data Flow

### 5.1 Real-Time Path (Sub-Second Freshness)

Already working for Binance. Add Bybit equivalent.

```
Exchange WebSocket ──→ ws-manager.ts ──→ stream-coordinator.ts ──→ In-Memory Cache
                                                                        │
                                                                  SSE Endpoint
                                                                        │
                                                                  Browser SSE Client
                                                                        │
                                                                  Zustand Store
                                                                        │
                                                              React Components + Charts
```

Data types on this path:
- OHLCV candles (both exchanges)
- Live ticker/price (both exchanges)
- Liquidation events (both exchanges)

### 5.2 Slow Metrics Path (30–60s Freshness)

New path for data that updates gradually. No WebSocket needed.

```
Vercel Cron (every 30-60s) ──→ REST fetch from Binance + Bybit
                                        │
                                  Transform + Normalize
                                        │
                                  Write to Upstash Redis (with TTL)
                                        │
                                  Also persist to PostgreSQL (historical accumulation)
                                        │
Client polling (10-30s) ──→ Next.js API Route ──→ Read from Upstash Redis ──→ Response
```

Data types on this path:

| Data Type | Cron Interval | Cache TTL | DB Persist Interval |
|---|---|---|---|
| Funding Rates | 60s | 60s | Every 8h (on rate change) |
| Open Interest | 30s | 30s | Hourly snapshots |
| Basis/Premium | 30s | 30s | Hourly snapshots |
| Health Score | 60s | 60s | Not persisted (derived) |
| Screener Aggregation | 30s | 30s | Not persisted (derived) |
| Sparklines (24h hourly closes) | 60s | 60s | Not persisted (derived from candles) |

### 5.3 Historical Persistence Path (New)

This path didn't exist in the previous Phase 1. It's critical for the quant partner's work — regime classification, backtesting, and convergence scoring all need historical data.

```
Cron Jobs ──→ Fetch latest metrics ──→ Write to PostgreSQL
                                              │
                                     Accumulates over time
                                              │
                              Quant Engine reads for backtesting/analysis (future phases)
```

---

## 6. Database — Historical Data Models

Add to `prisma/schema.prisma`:

```prisma
// Historical funding rate snapshots
// Persisted every 8 hours when the rate changes (matches exchange funding intervals)
model FundingRateSnapshot {
  id          String   @id @default(cuid())
  asset       String                          // "BTC", "ETH", etc.
  exchange    String                          // "binance", "bybit"
  rate        Float                           // Funding rate (e.g., 0.0001 = 0.01%)
  markPrice   Float                           // Mark price at time of snapshot
  indexPrice  Float                           // Index (spot) price at time of snapshot
  timestamp   DateTime                        // Exchange timestamp of the funding event
  createdAt   DateTime @default(now())

  @@unique([asset, exchange, timestamp])
  @@index([asset, timestamp])
  @@index([asset, exchange, timestamp])
}

// Hourly open interest snapshots
model OISnapshot {
  id          String   @id @default(cuid())
  asset       String
  exchange    String
  oi          Float                           // OI in contracts
  oiUsd       Float                           // OI in USD
  price       Float                           // Price at time of snapshot (for USD conversion accuracy)
  timestamp   DateTime                        // Rounded to hour
  createdAt   DateTime @default(now())

  @@unique([asset, exchange, timestamp])
  @@index([asset, timestamp])
}

// Individual liquidation events (persisted from WS stream)
model LiquidationEvent {
  id          String   @id @default(cuid())
  asset       String
  exchange    String
  side        String                          // "long" or "short"
  quantity    Float                           // Contracts liquidated
  price       Float                           // Liquidation price
  usdValue    Float                           // USD value of liquidation
  timestamp   DateTime                        // Exchange timestamp
  createdAt   DateTime @default(now())

  @@index([asset, timestamp])
  @@index([asset, exchange, timestamp])
  @@index([timestamp])
}

// OHLCV candle history (for backtesting — accumulated over time)
// Only store daily and 4h candles to manage storage. Smaller timeframes are ephemeral.
model CandleHistory {
  id          String   @id @default(cuid())
  asset       String
  exchange    String
  timeframe   String                          // "4h", "1d"
  open        Float
  high        Float
  low         Float
  close       Float
  volume      Float
  timestamp   DateTime                        // Candle open time
  createdAt   DateTime @default(now())

  @@unique([asset, exchange, timeframe, timestamp])
  @@index([asset, timeframe, timestamp])
}
```

**Storage estimates (10 assets × 2 exchanges):**
- Funding: ~6 rows/day → ~4,380/year — trivial
- OI: ~480 rows/day → ~175,200/year — manageable
- Liquidations: variable, ~500-5,000/day in volatile markets → could grow; add retention policy (keep 90 days, archive older)
- Candles (4h + 1d): ~140 rows/day → ~51,100/year — trivial

Neon free tier handles this easily. Add a monthly cleanup job for liquidation events older than 90 days if storage becomes a concern.

---

## 7. Exchange API Reference

### 7.1 Binance Futures (USDⓈ-M)

**REST Endpoints (public, no API key required):**

| Endpoint | Use | Rate Weight |
|---|---|---|
| `GET /fapi/v1/premiumIndex?symbol=BTCUSDT` | Current funding rate + mark price + index price | 1 |
| `GET /fapi/v1/fundingRate?symbol=BTCUSDT&limit=100` | Historical funding rates | 1 |
| `GET /fapi/v1/openInterest?symbol=BTCUSDT` | Current open interest | 1 |
| `GET /fapi/v1/ticker/24hr?symbol=BTCUSDT` | 24h stats (volume, price change) | 1-40 |
| `GET /fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=500` | Historical candles | 5-10 |
| `GET /fapi/v1/ticker/price?symbol=BTCUSDT` | Spot price (for basis calc) | 1 |

**WebSocket Streams (already wired for most):**

| Stream | Data | Status |
|---|---|---|
| `btcusdt@kline_1m` | Real-time candles | ✅ Working |
| `btcusdt@ticker` | Real-time ticker | ✅ Working |
| `btcusdt@forceOrder` | Real-time liquidations | ✅ Working |
| `btcusdt@markPrice@1s` | Mark price updates | ❌ Add (useful for basis) |

**Rate limits:** 2,400 request weight/minute per IP. With 10 assets × ~5 REST calls × every 30s = ~1,000 weight/min. Well within limits.

### 7.2 Bybit (Linear USDT Perpetuals)

**REST Endpoints (public, no API key required):**

| Endpoint | Use | Rate Weight |
|---|---|---|
| `GET /v5/market/tickers?category=linear&symbol=BTCUSDT` | Current price, funding rate, OI, 24h volume — all in one call | 10 |
| `GET /v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=200` | Historical funding rates | 10 |
| `GET /v5/market/kline?category=linear&symbol=BTCUSDT&interval=60&limit=200` | Historical candles | 10 |
| `GET /v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=48` | OI history (hourly) | 10 |

**WebSocket Streams (need to implement):**

| Stream | Data | Subscribe Message |
|---|---|---|
| `kline.1.BTCUSDT` | Real-time candles | `{"op":"subscribe","args":["kline.1.BTCUSDT"]}` |
| `tickers.BTCUSDT` | Ticker updates (price, funding, OI) | `{"op":"subscribe","args":["tickers.BTCUSDT"]}` |
| `liquidation.BTCUSDT` | Liquidation events | `{"op":"subscribe","args":["liquidation.BTCUSDT"]}` |

**Bybit WS endpoint:** `wss://stream.bybit.com/v5/public/linear`

**Rate limits:** 120 requests/minute for market data endpoints. With 10 assets × 1 combined call × every 30s = ~20 req/min. Well within limits.

**Key Bybit advantage:** The `/v5/market/tickers` endpoint returns funding rate AND OI AND price in a single call, unlike Binance which requires separate endpoints.

---

## 8. Implementation — Step by Step

### Step 1: Bybit REST Implementation

Complete the Bybit REST adapter (currently a stub):

**File:** `lib/exchanges/bybit.ts`

```typescript
// Implement these functions:
fetchBybitTicker(symbol: string): Promise<BybitTickerData>
  // GET /v5/market/tickers → current price, funding rate, OI, volume
  
fetchBybitFundingHistory(symbol: string, limit?: number): Promise<BybitFundingRate[]>
  // GET /v5/market/funding/history → historical funding rates

fetchBybitOIHistory(symbol: string, interval: string, limit?: number): Promise<BybitOISnapshot[]>
  // GET /v5/market/open-interest → OI history

fetchBybitCandles(symbol: string, interval: string, limit?: number): Promise<BybitCandle[]>
  // GET /v5/market/kline → historical candles
```

All functions should:
- Use `lib/exchangeClient.ts` for rate-limited fetching
- Map responses through `lib/transforms.ts` to internal types
- Handle errors gracefully (return null/empty, log error, don't throw)

### Step 2: Bybit WebSocket Integration

Extend `ws-manager.ts` (or create a parallel Bybit WS manager) to connect to Bybit streams:

- Connect to `wss://stream.bybit.com/v5/public/linear`
- Subscribe to kline, ticker, and liquidation streams for all enabled assets
- Transform Bybit WS messages to the same internal format as Binance
- Feed into the same stream-coordinator and Zustand stores

**Key consideration:** Bybit WS message format differs from Binance. The transform layer must normalize both to the same internal types so downstream components don't care which exchange data came from.

**Bybit WS ping/pong:** Bybit requires sending `{"op":"ping"}` every 20 seconds. The WS manager must handle this.

### Step 3: Upstash Redis Caching for Slow Metrics

Verify/update `lib/cache.ts` for Upstash Redis:

```typescript
// Cache key patterns:
// market:funding:{asset}          → current funding data (both exchanges)
// market:oi:{asset}               → current OI data (both exchanges)
// market:basis:{asset}            → current basis data
// market:health:{asset}           → health score composite
// market:screener                 → aggregated screener data
// market:sparklines:{asset}       → 24h hourly close prices

// Functions needed:
getCached<T>(key: string): Promise<T | null>
setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void>
getMulti<T>(keys: string[]): Promise<(T | null)[]>
```

### Step 4: Funding Rate API Route + Cron

**API Route:** `app/api/market/funding/route.ts`

```
GET /api/market/funding?asset=BTC
```

Response:

```typescript
{
  asset: "BTC",
  current: {
    binance: { rate: 0.0001, markPrice: 84500, indexPrice: 84480, nextFundingTime: 1713283200000 },
    bybit: { rate: 0.00012, markPrice: 84502, indexPrice: 84478, nextFundingTime: 1713283200000 }
  },
  avg8h: 0.00011,                    // Average of last 3 funding payments
  annualizedCarry: 13.14,            // currentRate × 3 × 365 × 100
  zScore: 1.42,                      // (current - 30d_mean) / 30d_stddev
  history30d: [                       // Last 90 funding payments (~30 days)
    { timestamp: "...", binance: 0.0001, bybit: 0.00012 },
    ...
  ]
}
```

**Logic:**
1. Check Upstash cache (`market:funding:{asset}`, TTL 60s)
2. If cache hit → return cached data
3. If cache miss → fetch from both Binance and Bybit REST
4. Compute avg8h, annualized carry, z-score from historical data
5. Write to Upstash cache
6. Return response

**Cron Job:** `app/api/cron/refresh-metrics/route.ts`

Runs every 60 seconds (Vercel cron minimum is 1 minute). For each enabled asset:
1. Fetch funding rates from both exchanges
2. Fetch OI from both exchanges
3. Compute basis from mark price vs index price
4. Write all to Upstash cache
5. Persist funding rate snapshots to PostgreSQL (only when rate changes — every 8h)
6. Persist OI snapshots to PostgreSQL (hourly — check if hour boundary crossed)

Cron auth: validate `Authorization: Bearer {CRON_SECRET}` header.

### Step 5: Open Interest API Route

**API Route:** `app/api/market/open-interest/route.ts`

```
GET /api/market/open-interest?asset=BTC
```

Response:

```typescript
{
  asset: "BTC",
  aggregateOI: 523000,               // Total OI in contracts (sum of exchanges)
  aggregateOIUsd: 44195000000,       // Total OI in USD
  change24h: 12500,                   // Net change in contracts over 24h
  change24hPct: 2.45,                 // Percentage change
  byExchange: {
    binance: { oi: 312000, oiUsd: 26364000000 },
    bybit: { oi: 211000, oiUsd: 17831000000 }
  },
  history24h: [                       // Hourly OI for last 24h (for chart)
    { timestamp: "...", binance: 310000, bybit: 209000 },
    ...
  ]
}
```

**Logic:** Same cache-first pattern as funding. For 24h change: compare current OI to the OI snapshot from 24h ago in PostgreSQL (or earliest cached value if history isn't deep enough yet).

### Step 6: Liquidation API Route

**API Route:** `app/api/market/liquidations/route.ts`

```
GET /api/market/liquidations?asset=BTC&period=24h
```

Response:

```typescript
{
  asset: "BTC",
  period: "24h",
  longLiquidationVolume: 45200000,    // USD
  shortLiquidationVolume: 32100000,   // USD
  totalLiquidationVolume: 77300000,
  longShortRatio: 1.41,
  byExchange: {
    binance: { long: 28100000, short: 19800000 },
    bybit: { long: 17100000, short: 12300000 }
  },
  recentEvents: [                     // Last 50 liquidation events
    { timestamp: "...", exchange: "binance", side: "long", price: 84200, usdValue: 1250000 },
    ...
  ]
}
```

**Logic:**
- Real-time liquidation events arrive via WS streams (Binance working, Bybit to be added)
- Each event is persisted to PostgreSQL `LiquidationEvent` table
- The API route aggregates from PostgreSQL for the requested period
- Also cache the aggregation in Upstash (60s TTL) to avoid repeated DB queries
- `recentEvents` pulls the last 50 from the LiquidationEvent table directly

### Step 7: Basis/Premium API Route

**API Route:** `app/api/market/basis/route.ts`

```
GET /api/market/basis?asset=BTC
```

Response:

```typescript
{
  asset: "BTC",
  binance: {
    perpPrice: 84520,
    spotPrice: 84480,
    basisAbsolute: 40,
    basisPct: 0.047,                  // (perp - spot) / spot × 100
    annualizedBasisPct: 17.3          // basisPct × 365 (simplified — actual depends on funding frequency)
  },
  bybit: {
    perpPrice: 84525,
    spotPrice: 84478,
    basisAbsolute: 47,
    basisPct: 0.056,
    annualizedBasisPct: 20.4
  }
}
```

**Logic:**
- Perp price = mark price from ticker data
- Spot price = index price from premiumIndex (Binance) or ticker (Bybit)
- Basis = (perpPrice - spotPrice) / spotPrice × 100
- Annualized = basisPct × 365 (simplified; more accurate calc uses funding rate frequency)

### Step 8: Health Score API Route

**API Route:** `app/api/market/health/route.ts`

```
GET /api/market/health?asset=BTC
```

Response:

```typescript
{
  asset: "BTC",
  score: 62,                          // 0-100 composite
  regime: "moderately_bullish",       // Label based on score ranges
  components: {
    funding: { score: 72, weight: 0.30, detail: "Positive funding, moderate long bias" },
    openInterest: { score: 55, weight: 0.25, detail: "Rising OI with rising price — healthy trend" },
    liquidation: { score: 48, weight: 0.25, detail: "Balanced long/short liquidations" },
    basis: { score: 70, weight: 0.20, detail: "Positive basis, moderate contango" }
  }
}
```

**Logic:**
- Read cached funding, OI, liquidation, basis data from Upstash
- Compute each component score (0-100):
  - **Funding Score:** Neutral = 50. Positive funding shifts bullish (60-80). Extreme positive = overheated (drops to 40). Negative = bearish (20-40). Z-score determines extremity.
  - **OI Score:** Rising OI + rising price = bullish (60-80). Rising OI + falling price = bearish (20-40). Falling OI = neutral/unwinding (40-60).
  - **Liquidation Score:** Balanced = neutral (50). Heavy long liquidations = bearish (20-40). Heavy short liquidations = bullish (60-80).
  - **Basis Score:** Premium = bullish (60-80). Extreme premium = overheated (40). Discount = bearish (20-40).
- Weights: funding 30%, OI 25%, liquidation 25%, basis 20% (configurable in `config/healthScore.ts`)
- Regime label: 0-20 "strongly_bearish", 20-40 "bearish", 40-60 "neutral", 60-80 "bullish", 80-100 "strongly_bullish"

### Step 9: Screener API Route

**API Route:** `app/api/market/screener/route.ts`

```
GET /api/market/screener
```

Response:

```typescript
{
  assets: [
    {
      symbol: "BTC",
      name: "Bitcoin",
      price: 84520,
      change24h: 2.3,                 // %
      volume24h: 42000000000,
      fundingRate: 0.0001,
      fundingZScore: 1.42,
      oiUsd: 44195000000,
      oiChange24hPct: 2.45,
      liquidation24hUsd: 77300000,
      basisPct: 0.047,
      healthScore: 62,
      sparkline: [84100, 84200, ...], // 24 hourly close prices
    },
    // ... all 10 assets
  ],
  updatedAt: "2026-04-16T12:00:00Z"
}
```

**Logic:**
- Read all cached data from Upstash for all enabled assets
- Aggregate into screener format
- Generate sparklines from 24h hourly candle closes (fetch via REST if not cached)
- Cache the entire screener response (30s TTL)
- If any asset's data is missing/stale, include it with null values and a `stale: true` flag

### Step 10: Frontend Wiring

Connect the derivatives terminal components to the new live API routes. The components already exist from the pre-pivot build — they just need their data sources swapped.

**For each tab in `/terminal/derivatives`:**

| Tab | Data Source | Refresh Interval |
|---|---|---|
| Overview | `/api/market/health` + `/api/market/screener` (summary) | Poll every 30s |
| Funding | `/api/market/funding?asset={selected}` | Poll every 30s |
| OI | `/api/market/open-interest?asset={selected}` | Poll every 30s |
| Liquidations | `/api/market/liquidations?asset={selected}` + SSE for real-time feed | Poll aggregates every 30s, SSE for live events |
| Basis | `/api/market/basis?asset={selected}` | Poll every 30s |
| Screener | `/api/market/screener` | Poll every 30s |

**Chart (price chart at top):**
- Continues using existing WS+SSE pipeline for real-time candles
- No change needed if existing infrastructure works
- Add Bybit candle stream as a secondary overlay option (or just use for comparison)

**Implementation pattern for each panel:**

```typescript
// Custom hook pattern for each data type
function useFundingData(asset: string) {
  const [data, setData] = useState<FundingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  
  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(`/api/market/funding?asset=${asset}`);
      if (res.ok) {
        setData(await res.json());
        setIsStale(false);
      } else {
        setIsStale(true); // Keep showing last data with stale indicator
      }
      setIsLoading(false);
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [asset]);
  
  return { data, isLoading, isStale };
}
```

**Connection status indicator:**
- Add a small indicator (green dot / yellow dot / red dot) in the TopBar or terminal header
- Green: all data fresh (< 60s old)
- Yellow: some data stale (> 60s, < 5min) — "Data delayed"
- Red: data feed disconnected (> 5min since last update)

### Step 11: Historical Data Persistence Jobs

Separate from the cache-warming cron, add persistence logic to accumulate historical data:

**In the `refresh-metrics` cron job, add:**

```typescript
// After fetching and caching metrics, persist to PostgreSQL:

// Funding: only persist when rate changes (every 8h)
// Check: has the funding timestamp changed since last persisted?
if (fundingTimestamp !== lastPersistedFundingTimestamp) {
  await prisma.fundingRateSnapshot.create({ ... });
}

// OI: persist hourly
// Check: has the hour boundary been crossed?
if (currentHour !== lastPersistedOIHour) {
  await prisma.oISnapshot.create({ ... });
}
```

**For liquidation events (from WS stream):**
- In the WS message handler, after pushing to SSE and cache, also write to PostgreSQL
- Batch writes: accumulate events for 5 seconds, then bulk insert to reduce DB writes
- This runs in the WS handler, not the cron job

**For candle history:**
- Add a daily cron job (`app/api/cron/persist-candles/route.ts`) that:
  - Fetches the last 24h of 4h candles from both exchanges for all assets
  - Fetches the last day's daily candle
  - Upserts to CandleHistory (idempotent — safe to re-run)
- This builds up the historical dataset the Quant Engine needs for backtesting

---

## 9. Error Handling & Resilience

### Exchange API Failures

- If an exchange REST call fails: return stale cached data (Upstash) with `stale: true` flag
- If Upstash is unavailable: attempt direct fetch from exchange (skip cache)
- If both fail: return null with error indicator in response
- **Never let a single exchange failure break the entire page.** If Bybit is down, show Binance data with "Bybit unavailable" indicator

### WebSocket Disconnections

- Existing auto-reconnect logic in ws-manager.ts handles this
- Add Bybit-specific reconnection (exponential backoff: 1s → 2s → 4s → 8s → max 30s)
- After 10 consecutive failures: log error, pause 60s, try again
- During disconnect: components show last known data with "Reconnecting..." indicator

### Rate Limit Protection

- `lib/exchangeClient.ts` tracks request weight per exchange per minute
- If approaching 80% of limit: queue requests, extend polling interval
- If rate limited (HTTP 429): back off for the duration specified in response headers
- Log rate limit events for monitoring

### Data Validation

- Validate all exchange responses before caching:
  - Prices must be > 0
  - Funding rates must be within reasonable bounds (-0.5% to 0.5%)
  - OI must be >= 0
  - Timestamps must be recent (within last 5 minutes for "current" data)
- Reject and log invalid data — don't cache or display garbage

---

## 10. Environment Variables

### New (add to `.env.local` and Vercel):

```env
# Upstash Redis (if not already configured)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron security
CRON_SECRET=                          # Random string, validates cron job requests

# Feature flags
NEXT_PUBLIC_LIVE_DATA_ENABLED=true    # Kill switch to disable live data (shows "data unavailable")
```

### Existing (no changes):
```env
DATABASE_URL=                          # Neon PostgreSQL
DIRECT_URL=                            # Neon direct connection
NEXTAUTH_URL=
NEXTAUTH_SECRET=
```

Exchange API keys are **NOT required.** All endpoints used are public.

---

## 11. New File Structure

```
# New files to create:

prisma/
  schema.prisma                        # Add 4 new models (FundingRateSnapshot, OISnapshot, LiquidationEvent, CandleHistory)

lib/exchanges/
  bybit.ts                            # Complete Bybit REST implementation (replace stub)
  bybit-ws.ts                         # Bybit WebSocket stream handler (new)
  types.ts                            # Shared exchange type definitions (if not in types/)

app/api/market/
  funding/route.ts                     # Funding rate data
  open-interest/route.ts               # Open interest data
  liquidations/route.ts                # Liquidation aggregates + recent events
  basis/route.ts                       # Basis/premium analysis
  health/route.ts                      # Health score composite
  screener/route.ts                    # Aggregated screener for all assets

app/api/cron/
  refresh-metrics/route.ts             # 60s cron: funding + OI + basis for all assets
  refresh-screener/route.ts            # 30s cron: aggregate screener data
  persist-candles/route.ts             # Daily cron: persist 4h + 1d candles to PostgreSQL

config/
  healthScore.ts                       # Health score weights and thresholds

hooks/
  useFundingData.ts                    # React hook for funding tab
  useOIData.ts                         # React hook for OI tab
  useLiquidationData.ts                # React hook for liquidation tab
  useBasisData.ts                      # React hook for basis tab
  useHealthScore.ts                    # React hook for health score
  useScreenerData.ts                   # React hook for screener
  useConnectionStatus.ts               # React hook for data freshness indicator

components/terminal/
  ConnectionStatus.tsx                 # Green/yellow/red indicator for data freshness


# Existing files to modify:

lib/exchanges/bybit.ts                 # Replace stub with real implementation
ws-manager.ts (or equivalent)          # Add Bybit WS connection
stream-coordinator.ts                  # Add Bybit stream types

config/assets.ts                       # Flip enabled: true as assets are wired

# Terminal components — swap mock data sources for live hooks
# (exact files depend on Phase 0 output — the consolidated derivatives page)
```

---

## 12. Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-metrics",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/refresh-screener",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/persist-candles",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Note: Vercel cron minimum is 1 minute. For 30s screener refresh, rely on client polling to trigger cache-miss fetches between cron runs. The cron ensures the cache is warm even without active clients.

---

## 13. Testing & Validation

### Data Accuracy Checks

For each asset, compare Scope Alpha's displayed values against the source:

| Metric | Validation Source | Acceptable Deviation |
|---|---|---|
| Price | Binance/Bybit website | < 0.01% |
| Funding rate | Binance/Bybit funding page | Exact match |
| Open interest | Binance/Bybit OI display or Coinglass | < 1% |
| Liquidations | Coinglass liquidation data | < 5% (different aggregation methods) |
| Basis | Manual calc: (perp - spot) / spot | < 0.01% |

### Stress Tests

- Kill Bybit connection → verify Binance data continues, Bybit shows "unavailable"
- Kill Upstash → verify direct-fetch fallback works
- Navigate rapidly between assets → verify no stale data from previous asset
- Open multiple tabs → verify SSE connections don't multiply unboundedly
- Leave page open 24h → verify data continues updating, no memory leaks

### Monitoring (Lightweight)

- Log every cron run: success/failure, duration, asset count
- Log exchange API errors: endpoint, status code, response body (truncated)
- Log rate limit events: exchange, current usage, limit
- Log WS disconnects and reconnects: exchange, duration of outage
- All logs go to Vercel's built-in logging (viewable in dashboard)

---

## 14. Quant Partner Parallel Work (During Phase 1)

While engineering wires up live data, the data science partner should be working on:

1. **Pull historical data for model development:**
   - Download 1+ years of historical funding rates from Binance REST API
   - Download 1+ years of historical OI snapshots
   - Download historical candles (4h, 1d) for BTC and ETH
   - Store in local CSV/Parquet files for Jupyter notebook analysis

2. **Build and validate funding rate arbitrage calculator:**
   - Input: cross-exchange funding rates
   - Output: ranked pairs by net annualized yield after fees
   - Historical backtest of static and dynamic arb strategies
   - Deliverable: validated Python module + methodology doc

3. **Build and validate basis trade monitor:**
   - Track spot vs perp across expirations
   - Annualize basis, compute historical percentile
   - Deliverable: validated Python module + methodology doc

4. **Begin CVD (Cumulative Volume Delta) divergence detection:**
   - Prototype using historical taker buy/sell volume data
   - Define divergence detection algorithm (price/CVD divergence)
   - Deliverable: prototype in Jupyter notebook

5. **Begin data cleaning/validation library:**
   - Build standardized functions for cleaning exchange API responses
   - Handle missing values, outliers, crossed markets
   - This library will be used by the Quant Engine in Phase 3+

---

## 15. Definition of Done

### Must Have

- [ ] Live price charts updating in real-time for all 10 assets (Binance WS)
- [ ] Bybit WebSocket streaming candles, tickers, liquidations
- [ ] Funding rate tab showing live data from both exchanges with avg8h, annualized, z-score
- [ ] OI tab showing live aggregate OI, per-exchange breakdown, 24h change
- [ ] Liquidation tab showing real-time feed + 24h aggregates
- [ ] Basis tab showing perp-spot premium with annualized rate
- [ ] Screener showing all 10 assets with live data and sparklines
- [ ] Health score computing from real inputs
- [ ] Cross-exchange comparison (Binance vs Bybit) visible in each metric tab
- [ ] Upstash Redis caching all slow metrics with appropriate TTLs
- [ ] Cron jobs running and keeping cache warm
- [ ] Historical data accumulating in PostgreSQL (funding, OI, liquidations, candles)
- [ ] Connection status indicator showing data freshness
- [ ] Graceful degradation when one exchange is unavailable
- [ ] Zero mock data remaining anywhere in the derivatives terminal
- [ ] `config/assets.ts` has `enabled: true` for all 10 assets

### Nice to Have (can defer to Phase 2)

- [ ] Bybit candle overlay on chart (secondary exchange view)
- [ ] Historical funding rate chart (30d) in funding tab
- [ ] OI history chart (24h hourly) in OI tab
- [ ] Liquidation heatmap (deferred to Phase 2 — requires modeling)

---

## 16. What This Enables

After Phase 1, the derivatives terminal is alive with real data from two exchanges. This unlocks:

- **Phase 2:** Derivatives intelligence layer — the arb scanner, CVD divergence, health composite enrichment, and liquidation heatmap all build on this live data pipeline
- **Phase 3:** Options data pipeline adds Deribit as a third exchange using the same patterns (REST + cache + persistence)
- **Quant Engine:** Historical data accumulating in PostgreSQL feeds the data science partner's backtesting and model validation work
- **User value:** Even without later phases, a live derivatives terminal with cross-exchange comparison, health scores, and a multi-asset screener is a useful product that people can evaluate

---

*This PRD should be treated as the authoritative specification. Claude Code should present an implementation plan with architecture decision questions before beginning work.*
