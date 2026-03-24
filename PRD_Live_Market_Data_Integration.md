# PRD: Live Market Data Integration — Scope Alpha

**Version:** 1.0
**Date:** March 24, 2026
**Status:** Phase 1 — MVP
**Priority:** Critical Path

---

## 1. Overview

Scope Alpha is a crypto derivatives analytics and trading strategy marketplace built with Next.js 14, React 18, TypeScript, Prisma ORM (PostgreSQL via Neon), Zustand for state management, and Lightweight Charts 4.2.0 for charting.

The platform currently runs entirely on mock/seeded data. This PRD defines the implementation plan to replace mock data with live market data from cryptocurrency exchanges, making the derivatives terminal and charting system real-time.

**Goal:** Wire up live exchange data feeds so the existing Lightweight Charts render real-time candlestick data, and the derivatives terminal displays live funding rates, open interest, liquidation data, and basis analysis.

---

## 2. Current State

### What Exists

- **Charting:** Lightweight Charts 4.2.0 rendering static/mock OHLCV candlestick arrays
- **Derivatives Terminal Features (all mock data):**
  - Price charts (OHLCV candlesticks)
  - Health Score Dashboard (composite metric)
  - Funding Rate Analysis (current, 8hr avg, annualized, z-score, by-exchange)
  - Open Interest Tracker (aggregate, net changes, per-exchange)
  - Liquidation Monitor (long/short volumes, exchange heatmap)
  - Perpetual Basis Analyzer (basis %, annualized rate, per-exchange)
  - Multi-Asset Screener (sortable table with sparklines)
- **State Management:** Zustand 4.5.2 with localStorage persistence
- **Database:** PostgreSQL via Neon with Prisma 6.19.2 ORM, 10 models
- **Auth:** NextAuth 4.24.13 with JWT sessions
- **Deployment:** Vercel (frontend) + Neon PostgreSQL (database)

### What Does NOT Exist

- WebSocket connections to any exchange
- Live OHLCV data pipeline
- Live funding rate, open interest, or liquidation feeds
- Server-side data caching or aggregation layer
- Reconnection/failover logic for data streams
- Rate limit management for exchange APIs

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (Next.js)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Lightweight  │  │  Derivatives │  │  Multi-Asset   │  │
│  │ Charts       │  │  Terminal     │  │  Screener      │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         └────────────────┼──────────────────┘           │
│                    Zustand Store                         │
│                    (marketDataStore)                     │
│                          │                              │
│                   SSE / WebSocket                        │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│               SERVER (Next.js API Routes)                │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Market Data Service Layer               │   │
│  │  ┌────────────┐ ┌───────────┐ ┌──────────────┐   │   │
│  │  │ WebSocket  │ │  REST     │ │   Cache      │   │   │
│  │  │ Manager    │ │  Poller   │ │   (in-memory │   │   │
│  │  │            │ │           │ │   or Redis)  │   │   │
│  │  └─────┬──────┘ └─────┬─────┘ └──────────────┘   │   │
│  └────────┼──────────────┼───────────────────────────┘   │
└───────────┼──────────────┼───────────────────────────────┘
            │              │
   ┌────────┴──────┐  ┌───┴────────────┐
   │  Exchange WS  │  │  Exchange REST  │
   │  Streams      │  │  APIs           │
   │  (Binance,    │  │  (Binance,      │
   │   Bybit, OKX) │  │   Bybit, OKX)  │
   └───────────────┘  └────────────────┘
```

### Key Architectural Decisions

1. **Server-side WebSocket aggregation** — Do NOT connect clients directly to exchange WebSockets. The Next.js server maintains exchange connections and fans out to clients. This prevents rate limit issues when multiple users view the same asset.

2. **Server-Sent Events (SSE) for client delivery** — Use SSE from the Next.js API routes to push updates to the browser. SSE is simpler than running a separate WebSocket server, works natively with Next.js API routes, and handles reconnection automatically.

3. **In-memory cache with optional Redis upgrade** — Start with a simple in-memory Map for caching OHLCV and metrics data. Document the interface so it can be swapped to Redis later when scaling demands it.

4. **Exchange abstraction layer** — All exchange-specific logic lives behind a common interface. Adding a new exchange should only require implementing the interface, not modifying consumers.

---

## 4. Exchange Data Sources

### Primary: Binance

Binance is the primary data source due to highest volume and most comprehensive free API.

**WebSocket Streams (free, no auth required):**

| Stream | Endpoint Pattern | Data | Update Frequency |
|--------|-----------------|------|-----------------|
| Kline (OHLCV) | `wss://fstream.binance.com/ws/<symbol>@kline_<interval>` | Open, High, Low, Close, Volume per candle | Real-time on every trade |
| Mark Price | `wss://fstream.binance.com/ws/<symbol>@markPrice@1s` | Mark price, funding rate, next funding time | Every 1 second |
| Aggregate Trades | `wss://fstream.binance.com/ws/<symbol>@aggTrade` | Price, quantity, trade time, buyer/seller | Real-time per trade |
| Liquidation | `wss://fstream.binance.com/ws/<symbol>@forceOrder` | Symbol, side, order type, price, quantity | Real-time on liquidation |
| All Market Tickers | `wss://fstream.binance.com/ws/!ticker@arr` | 24hr price change, volume for all symbols | Every 1 second |

**REST Endpoints (free, weight-limited at 1200/min):**

| Endpoint | Data | Use Case |
|----------|------|----------|
| `GET /fapi/v1/klines` | Historical OHLCV | Initial chart load, backfill |
| `GET /fapi/v1/fundingRate` | Historical funding rates | Funding rate analysis chart |
| `GET /fapi/v1/openInterest` | Current open interest | OI tracker |
| `GET /futures/data/openInterestHist` | Historical OI | OI change tracking |
| `GET /fapi/v1/ticker/24hr` | 24hr stats all symbols | Multi-asset screener |
| `GET /futures/data/globalLongShortAccountRatio` | Long/short ratio | Health score input |

### Secondary: Bybit

Bybit as a secondary source for cross-exchange comparison features.

**WebSocket:** `wss://stream.bybit.com/v5/public/linear`
- Subscribe topics: `kline`, `tickers`, `liquidation`

**REST:** `https://api.bybit.com/v5/market/`
- `/kline`, `/funding/history`, `/open-interest`, `/tickers`

### Tertiary: OKX

OKX for additional exchange coverage.

**WebSocket:** `wss://ws.okx.com:8443/ws/v5/public`
- Channels: `candle`, `funding-rate`, `open-interest`, `liquidation-orders`

**REST:** `https://www.okx.com/api/v5/`
- `/market/candles`, `/public/funding-rate`, `/public/open-interest`

### Rate Limit Strategy

| Exchange | Limit | Strategy |
|----------|-------|----------|
| Binance | 1200 weight/min (REST), 5 messages/sec (WS) | Batch REST requests on startup; rely on WS for ongoing data |
| Bybit | 120 requests/min (REST) | Cache aggressively; REST only for historical backfill |
| OKX | 20 requests/2sec (REST) | Cache aggressively; REST only for historical backfill |

---

## 5. Implementation Modules

### Module 1: Exchange Abstraction Layer

**File:** `src/lib/exchanges/types.ts`

Define a common interface all exchange connectors implement:

```typescript
interface ExchangeConnector {
  name: string;
  
  // REST methods
  getKlines(symbol: string, interval: string, limit?: number, startTime?: number, endTime?: number): Promise<OHLCV[]>;
  getFundingRate(symbol: string): Promise<FundingRate>;
  getFundingRateHistory(symbol: string, limit?: number): Promise<FundingRate[]>;
  getOpenInterest(symbol: string): Promise<OpenInterest>;
  getOpenInterestHistory(symbol: string, period: string, limit?: number): Promise<OpenInterest[]>;
  get24hrTicker(symbol?: string): Promise<Ticker[]>;
  
  // WebSocket methods
  subscribeKline(symbol: string, interval: string, callback: (data: OHLCV) => void): () => void;
  subscribeMarkPrice(symbol: string, callback: (data: MarkPrice) => void): () => void;
  subscribeLiquidation(symbol: string, callback: (data: Liquidation) => void): () => void;
  subscribeAllTickers(callback: (data: Ticker[]) => void): () => void;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
}
```

**Files to create:**
- `src/lib/exchanges/types.ts` — Shared types and interface
- `src/lib/exchanges/binance.ts` — Binance implementation
- `src/lib/exchanges/bybit.ts` — Bybit implementation (Phase 1 stretch)
- `src/lib/exchanges/okx.ts` — OKX implementation (Phase 1 stretch)
- `src/lib/exchanges/index.ts` — Factory/registry

### Normalized Data Types

```typescript
interface OHLCV {
  time: number;        // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  exchange: string;
  symbol: string;
  interval: string;
  isClosed: boolean;   // Whether this candle is finalized
}

interface FundingRate {
  symbol: string;
  exchange: string;
  fundingRate: number;
  fundingTime: number;
  markPrice: number;
  nextFundingTime: number;
}

interface OpenInterest {
  symbol: string;
  exchange: string;
  openInterest: number;   // In contracts
  openInterestValue: number; // In USD
  timestamp: number;
}

interface Liquidation {
  symbol: string;
  exchange: string;
  side: 'long' | 'short';
  price: number;
  quantity: number;
  timestamp: number;
}

interface Ticker {
  symbol: string;
  exchange: string;
  lastPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

interface MarkPrice {
  symbol: string;
  exchange: string;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  timestamp: number;
}
```

---

### Module 2: WebSocket Manager

**File:** `src/lib/market-data/ws-manager.ts`

A singleton that manages all exchange WebSocket connections on the server side. Handles connection lifecycle, reconnection, and subscription multiplexing.

**Requirements:**

1. **Singleton per exchange** — Only one WebSocket connection per exchange per stream type, regardless of how many clients request the same data.

2. **Automatic reconnection** — If a connection drops:
   - Wait 1 second, then retry
   - Exponential backoff: 1s → 2s → 4s → 8s → max 30s
   - After 10 consecutive failures, log an error and pause for 60 seconds before retrying
   - On successful reconnect, resubscribe to all active subscriptions

3. **Heartbeat/ping-pong** — Binance sends a ping frame every 3 minutes. Respond with pong. If no ping received within 5 minutes, force reconnect.

4. **Subscription reference counting** — Track how many consumers need each stream. Only unsubscribe from the exchange when the last consumer disconnects.

5. **Combined streams** — Use Binance combined stream endpoint to subscribe to multiple streams on a single connection: `wss://fstream.binance.com/stream?streams=<stream1>/<stream2>/...`

**Key behaviors:**

```
Client A requests BTCUSDT kline_1m → Manager opens WS, subscribes
Client B requests BTCUSDT kline_1m → Manager reuses existing subscription
Client A disconnects → refcount decremented
Client B disconnects → refcount hits 0, unsubscribe after 30s grace period
```

The 30-second grace period prevents rapid subscribe/unsubscribe cycling when users navigate between pages.

---

### Module 3: Cache Layer

**File:** `src/lib/market-data/cache.ts`

In-memory cache that stores recent market data for fast access and reduces exchange API calls.

**Interface:**

```typescript
interface MarketDataCache {
  // OHLCV candle history per symbol/interval
  getKlines(symbol: string, interval: string): OHLCV[];
  setKlines(symbol: string, interval: string, data: OHLCV[]): void;
  appendKline(symbol: string, interval: string, candle: OHLCV): void;
  
  // Latest metrics per symbol
  getLatestTicker(symbol: string): Ticker | null;
  setLatestTicker(symbol: string, data: Ticker): void;
  
  getFundingRate(symbol: string): FundingRate | null;
  setFundingRate(symbol: string, data: FundingRate): void;
  
  getOpenInterest(symbol: string): OpenInterest | null;
  setOpenInterest(symbol: string, data: OpenInterest): void;
  
  // Bulk operations for screener
  getAllTickers(): Map<string, Ticker>;
  
  // Cache management
  clear(): void;
  getStats(): { keys: number; memoryEstimate: number };
}
```

**Cache behavior:**

- **Kline history:** Store up to 1000 candles per symbol/interval pair. When a new closed candle arrives, append and evict the oldest if over limit.
- **Current candle:** The latest candle is continuously updated in-place (not appended) until `isClosed === true`.
- **Tickers/metrics:** Store only the latest value per symbol. Overwrite on each update.
- **TTL:** Ticker data expires after 10 seconds if not refreshed (stale data indicator). Kline data does not expire.
- **Memory limit:** If total cache entries exceed 50,000 keys, evict least-recently-accessed symbol data first. Log a warning at 40,000 keys.

---

### Module 4: Server-Sent Events (SSE) API Routes

These API routes establish SSE connections from the browser to the Next.js server. The server pushes market data updates to connected clients.

**Route:** `GET /api/market-data/stream`

**Query parameters:**
- `symbols` — Comma-separated list of symbols (e.g., `BTCUSDT,ETHUSDT`)
- `intervals` — Kline interval (e.g., `1m,5m,15m,1h,4h,1d`)
- `channels` — Comma-separated data types: `kline`, `ticker`, `funding`, `liquidation`, `openInterest`

**SSE Event Format:**

```
event: kline
data: {"symbol":"BTCUSDT","interval":"1m","time":1711234567,"open":67500.5,"high":67550.0,"low":67480.2,"close":67520.1,"volume":123.45,"isClosed":false,"exchange":"binance"}

event: ticker
data: {"symbol":"BTCUSDT","lastPrice":67520.1,"priceChange24h":1250.5,"priceChangePercent24h":1.88,"volume24h":42500000,"exchange":"binance"}

event: funding
data: {"symbol":"BTCUSDT","fundingRate":0.0001,"markPrice":67520.5,"nextFundingTime":1711238400,"exchange":"binance"}

event: liquidation
data: {"symbol":"BTCUSDT","side":"long","price":67200.0,"quantity":2.5,"timestamp":1711234570,"exchange":"binance"}

event: openInterest
data: {"symbol":"BTCUSDT","openInterest":285000,"openInterestValue":19237500000,"timestamp":1711234567,"exchange":"binance"}

event: heartbeat
data: {"timestamp":1711234567}
```

**Implementation notes:**

- Send a `heartbeat` event every 15 seconds to keep the connection alive
- On client connect, immediately send the latest cached data for all requested symbols so the UI populates instantly (no waiting for the next WS tick)
- Handle client disconnect by decrementing subscription reference counts in the WebSocket Manager
- Set appropriate headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

**Additional REST endpoints for initial data load:**

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/market-data/klines` | GET | Historical OHLCV for initial chart render. Params: `symbol`, `interval`, `limit` (default 500) |
| `GET /api/market-data/tickers` | GET | Current 24hr stats for all tracked symbols (screener) |
| `GET /api/market-data/funding-rates` | GET | Current and historical funding rates. Params: `symbol`, `limit` |
| `GET /api/market-data/open-interest` | GET | Current and historical OI. Params: `symbol`, `period`, `limit` |

These REST routes serve cached data and fall back to exchange REST APIs if the cache is empty (e.g., on cold start).

---

### Module 5: Client-Side Zustand Store

**File:** `src/stores/marketDataStore.ts`

A new Zustand store (or extension of the existing store) that manages the SSE connection and exposes live market data to all UI components.

**Store shape:**

```typescript
interface MarketDataState {
  // Connection state
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastHeartbeat: number | null;
  
  // Per-symbol live data
  klines: Record<string, Record<string, OHLCV[]>>; // [symbol][interval] -> candles
  tickers: Record<string, Ticker>;                   // [symbol] -> latest ticker
  fundingRates: Record<string, FundingRate>;          // [symbol] -> latest funding
  openInterest: Record<string, OpenInterest>;         // [symbol] -> latest OI
  liquidations: Liquidation[];                        // Rolling buffer, last 100
  
  // Actions
  connect: (symbols: string[], intervals: string[], channels: string[]) => void;
  disconnect: () => void;
  updateSubscriptions: (symbols: string[], intervals: string[], channels: string[]) => void;
  
  // Selectors
  getKlines: (symbol: string, interval: string) => OHLCV[];
  getTicker: (symbol: string) => Ticker | null;
  getFundingRate: (symbol: string) => FundingRate | null;
}
```

**Behavior:**

1. On `connect()`, open an `EventSource` to `/api/market-data/stream` with the requested params.
2. Before the SSE stream starts flowing, fetch initial data via the REST endpoints (`/api/market-data/klines`, etc.) to populate charts immediately.
3. As SSE events arrive, update the corresponding state slices. For klines:
   - If `isClosed === false`, update the last candle in the array in-place.
   - If `isClosed === true`, finalize the current candle and start a new one.
4. Maintain a rolling buffer of the last 100 liquidation events for the liquidation monitor.
5. If the SSE connection drops, `EventSource` will auto-reconnect. On reconnect, re-fetch the latest REST snapshot to fill any gaps.
6. If no `heartbeat` event is received within 30 seconds, set `connectionStatus` to `error` and display a connection warning in the UI.

**Do NOT persist market data to localStorage.** It changes every second and would thrash storage. Only persist user preferences like selected symbol and interval.

---

### Module 6: Chart Integration

**Files to modify:** Existing chart components that currently render mock data.

**Changes required:**

1. **Replace mock data source** — Where charts currently import or generate static OHLCV arrays, replace with `marketDataStore.getKlines(symbol, interval)`.

2. **Real-time candle updates** — Subscribe to the store and call the Lightweight Charts `update()` method on each new tick:
   ```typescript
   // On each kline update from the store:
   if (candle.isClosed) {
     // Finalized candle — append as new bar
     candlestickSeries.update({
       time: candle.time as UTCTimestamp,
       open: candle.open,
       high: candle.high,
       low: candle.low,
       close: candle.close,
     });
   } else {
     // In-progress candle — update the current (last) bar
     candlestickSeries.update({
       time: candle.time as UTCTimestamp,
       open: candle.open,
       high: candle.high,
       low: candle.low,
       close: candle.close,
     });
   }
   ```
   Note: Lightweight Charts `update()` handles both cases — if the timestamp matches the last bar, it updates in place; if it's new, it appends.

3. **Timeframe switching** — When the user changes the chart interval (e.g., 1m → 4h):
   - Update the store subscription to the new interval
   - Fetch historical klines for the new interval via REST
   - Clear and re-set the chart series data
   - Resume SSE updates for the new interval

4. **Symbol switching** — Same pattern as timeframe switching. Update subscriptions, fetch history, re-render.

5. **Volume series** — If displaying volume bars beneath the candlestick chart, update the volume series in sync with kline updates.

6. **Annotations overlay** — Existing annotation system (trend lines, zones, notes) should continue to work unchanged. Annotations are stored in the database per asset/timeframe and are independent of the data source.

---

### Module 7: Derivatives Terminal Integration

**Files to modify:** Existing terminal dashboard components.

Map live data from the store to each terminal widget:

| Widget | Data Source | Update Method |
|--------|------------|---------------|
| Price Chart | `marketDataStore.klines[symbol][interval]` | Real-time via `candlestickSeries.update()` |
| Health Score | Composite of funding rate + OI + liquidations + basis from store | Recompute on any input change |
| Funding Rate Panel | `marketDataStore.fundingRates[symbol]` + historical from REST | Live current rate; historical chart from REST endpoint |
| Open Interest Tracker | `marketDataStore.openInterest[symbol]` + historical from REST | Live current OI; historical from REST endpoint |
| Liquidation Monitor | `marketDataStore.liquidations` filtered by symbol | Append new liquidations as they stream in |
| Basis Analyzer | Compute from mark price vs. index price in ticker data | Recompute on each ticker update |
| Multi-Asset Screener | `marketDataStore.tickers` (all symbols) | Update table rows on each ticker event |

**Health Score Computation:**

The Health Score is a composite metric. Define clear weights and thresholds:

```typescript
function computeHealthScore(
  fundingRate: number,
  openInterestChange24h: number,
  liquidationVolume24h: number,
  basisPercent: number
): { score: number; label: 'healthy' | 'caution' | 'danger' } {
  // Funding rate component (0-25 points)
  // Near-zero funding = healthy; extreme positive/negative = danger
  
  // OI change component (0-25 points)
  // Stable or moderate growth = healthy; rapid spikes = caution
  
  // Liquidation component (0-25 points)
  // Low liquidation volume = healthy; cascading liquidations = danger
  
  // Basis component (0-25 points)
  // Near-zero basis = healthy; extreme basis = caution/opportunity
  
  // Return composite 0-100 score
}
```

Document the exact formula so analysts and subscribers can understand the metric.

---

## 6. Supported Symbols (MVP)

Start with a focused set of high-volume perpetual futures:

**Tier 1 (always connected, real-time):**
- BTCUSDT
- ETHUSDT

**Tier 2 (connected on demand when user navigates to them):**
- SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, AVAXUSDT, DOTUSDT, LINKUSDT

**Tier 3 (available via screener, REST-only until selected):**
- All other USDT-M perpetual contracts on Binance

This tiered approach keeps WebSocket connections manageable. Tier 1 symbols are always streaming. Tier 2 symbols connect when a user opens their chart and disconnect after the 30-second grace period when no users are viewing them.

---

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Exchange WebSocket disconnects | Auto-reconnect with exponential backoff. During downtime, serve cached data with a "delayed" badge in the UI. |
| Exchange REST API returns error/rate limit | Retry after the `Retry-After` header duration. Serve cached data in the interim. |
| Exchange returns malformed data | Log the error, skip the update, continue processing. Never crash the stream. |
| SSE connection from client drops | `EventSource` auto-reconnects. On reconnect, client fetches REST snapshot to fill gaps. |
| Server cold start (no cache) | Fetch initial data via REST for Tier 1 symbols, then open WebSocket streams. Display a loading state for ~2-3 seconds while data populates. |
| All exchanges unreachable | Display a prominent "Market Data Unavailable" banner. Retry every 60 seconds. |

---

## 8. Environment Variables

Add the following to `.env`:

```env
# Exchange API Configuration
# No API keys needed for public market data endpoints

# Binance
BINANCE_FUTURES_WS_URL=wss://fstream.binance.com
BINANCE_FUTURES_REST_URL=https://fapi.binance.com

# Bybit (Phase 1 stretch)
BYBIT_WS_URL=wss://stream.bybit.com/v5/public/linear
BYBIT_REST_URL=https://api.bybit.com/v5

# OKX (Phase 1 stretch)
OKX_WS_URL=wss://ws.okx.com:8443/ws/v5/public
OKX_REST_URL=https://www.okx.com/api/v5

# Feature Flags
ENABLE_LIVE_DATA=true
ENABLE_BYBIT=false
ENABLE_OKX=false

# Cache Configuration
CACHE_MAX_KLINES_PER_PAIR=1000
CACHE_TICKER_TTL_MS=10000
CACHE_MAX_ENTRIES=50000
```

---

## 9. File Structure

```
src/
├── lib/
│   ├── exchanges/
│   │   ├── types.ts              # Shared types, ExchangeConnector interface
│   │   ├── binance.ts            # Binance connector implementation
│   │   ├── bybit.ts              # Bybit connector (stub for Phase 1)
│   │   ├── okx.ts                # OKX connector (stub for Phase 1)
│   │   ├── index.ts              # Exchange registry/factory
│   │   └── utils.ts              # Symbol normalization, interval mapping
│   │
│   └── market-data/
│       ├── ws-manager.ts         # Server-side WebSocket connection manager
│       ├── cache.ts              # In-memory market data cache
│       ├── stream-coordinator.ts # Coordinates WS manager + cache + SSE fanout
│       └── types.ts              # Market data specific types
│
├── app/api/market-data/
│   ├── stream/route.ts           # SSE endpoint for live data
│   ├── klines/route.ts           # REST: historical OHLCV
│   ├── tickers/route.ts          # REST: current ticker data
│   ├── funding-rates/route.ts    # REST: funding rate data
│   └── open-interest/route.ts    # REST: open interest data
│
├── stores/
│   └── marketDataStore.ts        # Zustand store for client-side market data
│
├── hooks/
│   ├── useMarketData.ts          # Hook to connect store to SSE stream
│   ├── useLiveChart.ts           # Hook to wire Lightweight Charts to store
│   └── useConnectionStatus.ts    # Hook for connection status UI indicator
│
└── components/
    └── ui/
        └── ConnectionStatus.tsx  # Visual indicator for data feed status
```

---

## 10. Implementation Order

Execute these steps in order. Each step should be a working, testable increment.

### Step 1: Types & Exchange Abstraction
Create all shared types and the `ExchangeConnector` interface. Create the Binance connector with REST methods only (no WebSocket yet). Write a simple test script that fetches BTCUSDT 1h klines from Binance and logs them.

### Step 2: Cache Layer
Implement the in-memory cache. Write tests that verify kline append/eviction, ticker overwrite, and TTL expiry.

### Step 3: REST API Routes
Create the `/api/market-data/*` REST routes. These should use the Binance connector + cache: fetch from Binance on cache miss, serve from cache on hit. Test by hitting the endpoints in the browser and verifying real OHLCV data returns.

### Step 4: Chart Integration (REST only)
Replace mock data in the chart components with data fetched from the new REST API routes. At this point, charts show real historical data but do not update live. Verify charts render correctly with real Binance data.

### Step 5: WebSocket Manager
Implement the server-side WebSocket manager with Binance kline and ticker streams. Test reconnection logic. Connect it to the cache so incoming WS data updates the cache in real-time.

### Step 6: SSE Streaming
Implement the `/api/market-data/stream` SSE endpoint that reads from the WebSocket manager and pushes updates to connected clients. Test with a simple EventSource in the browser console.

### Step 7: Zustand Store & Hooks
Build the client-side Zustand store and hooks. Wire up the SSE connection. Verify that the store updates reactively as data streams in.

### Step 8: Live Chart Updates
Connect the Zustand store to Lightweight Charts via `useLiveChart` hook. Verify candlesticks update in real-time. Test timeframe and symbol switching.

### Step 9: Terminal Widget Integration
Wire all derivatives terminal widgets to the live store: funding rates, OI, liquidations, basis, health score, screener. Replace mock computations with real data.

### Step 10: Connection Status & Error Handling
Add the connection status indicator. Implement all error handling scenarios from Section 7. Test by killing the server, disconnecting network, etc.

---

## 11. Testing Checklist

- [ ] Binance REST: fetch historical klines, funding rates, OI, tickers
- [ ] Binance WebSocket: connect, receive kline stream, receive ticker stream, receive liquidation stream
- [ ] WebSocket reconnection: kill connection, verify auto-reconnect with backoff
- [ ] Cache: verify kline append, eviction at limit, ticker TTL expiry
- [ ] SSE: verify client receives events, heartbeat keeps connection alive, auto-reconnect on drop
- [ ] Chart: real candles render, live updates animate, timeframe switch works, symbol switch works
- [ ] Screener: all rows update with live ticker data
- [ ] Funding rate panel: displays current rate, updates live
- [ ] Liquidation monitor: new liquidations appear in real-time
- [ ] Health score: recomputes as inputs change
- [ ] Cold start: server starts, fetches initial data, becomes operational within 5 seconds
- [ ] Error state: exchange unreachable shows appropriate UI warning

---

## 12. Out of Scope (This PRD)

The following are NOT included in this implementation:

- **Stripe payment integration** — Separate PRD
- **Email notifications / Telegram alerts** — Separate PRD
- **Signal notification system** — Separate PRD
- **Copy trading / auto-execution** — Phase 2
- **Custom indicators (RSI, MACD, etc.)** — Follow-up PRD; requires separate computation layer
- **Bybit/OKX full integration** — Phase 1 stretch; stub the connectors but focus on Binance
- **Redis cache** — Future optimization; in-memory is sufficient for MVP scale
- **Historical data backfill beyond exchange API limits** — Future; would require a separate data ingestion pipeline
- **Mobile app WebSocket handling** — Phase 3

---

## 13. Dependencies to Install

```bash
npm install ws                  # WebSocket client for server-side exchange connections
npm install @types/ws --save-dev # TypeScript types for ws
```

No other new dependencies should be needed. The project already has Next.js, Zustand, and Lightweight Charts.

---

## 14. Deployment Notes

**Vercel considerations:**

- Vercel Serverless Functions have a maximum execution time (default 10s on Hobby, 60s on Pro, 300s on Enterprise). SSE streams need long-lived connections.
- **Option A:** Use Vercel's Edge Runtime for the SSE route, which supports streaming responses.
- **Option B:** If Vercel limits are problematic, consider deploying the market data service as a separate long-running process (e.g., on Railway, Fly.io, or a VPS) and having the Vercel frontend connect to it.
- The WebSocket Manager (server-side connections to exchanges) CANNOT run in Vercel Serverless Functions because they are stateless and ephemeral. This will need either Edge Runtime, a separate service, or a move to a long-running server deployment.

**Recommendation:** For MVP, deploy the market data service (WebSocket manager + cache + SSE endpoint) as a standalone Node.js process on Railway or Fly.io. The Vercel frontend connects to this service for live data. REST endpoints for historical data can remain on Vercel.

---

## 15. Success Criteria

This implementation is complete when:

1. Opening the derivatives terminal shows real BTC and ETH candlestick charts with live-updating candles
2. The funding rate, open interest, and liquidation widgets display real current data
3. The multi-asset screener shows live prices and 24hr changes for all tracked symbols
4. Switching timeframes loads real historical data and resumes live updates
5. Switching symbols loads the correct asset data
6. Disconnecting and reconnecting to the internet recovers gracefully
7. The UI clearly indicates connection status (connected/reconnecting/error)
8. No mock or seeded data is displayed anywhere in the derivatives terminal
