# PRD: Phase 3 — Options & Volatility Analytics

**Version:** 1.0
**Date:** April 17, 2026
**Status:** Ready for Implementation
**Priority:** High — biggest differentiator in the product
**Depends on:** Phase 2 (Derivatives Intelligence Layer) complete

---

## 1. Context

### Where We Are

Phase 0 stripped the marketplace. Phase 1 wired live derivatives data from Binance + Bybit. Phase 2 added derived analytics: liquidation heatmap, CVD + divergence detection, arb scanner, cross-exchange comparison, alert evaluation engine, regime classification, and historical charts. The derivatives terminal at `/terminal/derivatives` is a functional intelligence tool.

### What Phase 3 Is

Phase 3 introduces **two new pieces of infrastructure** and **six new analytical tools** that don't exist accessibly for crypto anywhere below Bloomberg's $32K/yr tier:

1. **Deribit options data pipeline** — a third exchange connector, pulling the full options chain for BTC and ETH every 5 minutes
2. **Python Quant Engine** — a FastAPI microservice deployed on Railway/Fly.io that performs the mathematical computations too complex or specialized for TypeScript (vol surface fitting, RND extraction, volatility cone percentile calculation)
3. **Six volatility analysis tools** — implied volatility surface, risk-neutral density, volatility skew, IV term structure, volatility cone, and volatility risk premium

This is the phase where Scope Alpha enters territory that Coinglass doesn't touch and that Glassnode only started exploring in late 2025. These tools are what institutional vol traders use daily. Making them accessible and visual at a non-institutional price point is the core differentiator.

### What's NOT In Phase 3

- Greeks exposure maps (GEX, DEX, vanna, charm) — Phase 4
- Options flow scanner / unusual activity — Phase 4
- Max pain and pin risk — Phase 4
- On-chain analytics — Phase 5
- The Quant Engine ships with vol/RND modules. GEX and Greeks modules deploy in Phase 4.

### Quant Partner Deliverables Expected

By the start of Phase 3, the data science partner should have **validated and production-ready:**

| Module | Deliverable | Status |
|---|---|---|
| Data cleaning for options chains | Validation functions for strike/IV/OI data | Ready |
| Vol surface fitting | SVI parameterization or cubic spline — validated in Jupyter | Ready |
| RND engine | Breeden-Litzenberger implementation — validated against known distributions | Ready |
| Volatility cone | Realized vol percentile computation across multiple windows | Ready |
| VRP calculator | IV vs realized vol spread, historical percentile | Ready |
| FastAPI service scaffold | Project structure, endpoints, health check, Docker config | Ready |

If any module isn't ready, its corresponding frontend tool ships with a "Coming Soon" placeholder within the Volatility section rather than blocking the entire phase.

---

## 2. Architecture

### Two New Services

Phase 3 introduces the first external services beyond the existing Vercel + Neon + Upstash stack:

```
┌─────────────────────────────────────────────────┐
│                  VERCEL (Frontend)               │
│  Next.js / React / TypeScript                    │
│  ┌─────────────────────────────────────────┐    │
│  │  Deribit Options Cron (every 5 min)     │    │
│  │  → Fetch chain → Cache in Redis         │    │
│  │  → Send raw chain to Quant Engine       │    │
│  │  → Store computed results in Redis      │    │
│  │  → Persist snapshots to PostgreSQL      │    │
│  └─────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
┌─────────▼──────────┐   ┌─────────▼──────────┐
│   Upstash Redis    │   │   QUANT ENGINE     │
│   (cache layer)    │   │   (Railway/Fly.io) │
│                    │   │                    │
│   Options chains   │   │  FastAPI (Python)  │
│   Computed metrics │   │  /vol-surface      │
│   All existing     │   │  /rnd              │
│   derivatives cache│   │  /vol-cone         │
│                    │   │  /vrp              │
│                    │   │  /skew             │
│                    │   │  /term-structure   │
│                    │   │  /health           │
└────────────────────┘   └──────────┬─────────┘
                                    │
                         ┌──────────▼─────────┐
                         │   Neon PostgreSQL   │
                         │   + Phase 1 tables  │
                         │   + Phase 2 tables  │
                         │   + Options tables  │
                         └────────────────────┘
```

### Why a Separate Python Service?

The vol surface fitting (SVI parameterization), RND extraction (second derivative of call price w.r.t. strike via Breeden-Litzenberger), and volatility cone (percentile computation across multiple lookback windows) all involve numerical optimization and statistical computation that:

1. The quant partner has already built and validated in Python
2. Would require porting complex numerical methods to TypeScript (numpy equivalents, scipy.optimize equivalents)
3. Benefit from Python's numerical ecosystem (numpy, scipy) for correctness and performance
4. Are maintained by the quant partner — keeping them in Python means they own the full stack from research notebook to production

The Quant Engine is a stateless HTTP service. Vercel sends it raw data, it returns computed results. No database access, no auth, no state. Simple to deploy, simple to scale, simple to replace.

### Quant Engine Deployment

**Platform:** Railway or Fly.io (whichever is simpler for the quant partner to deploy)

**Stack:**
- Python 3.11+
- FastAPI
- numpy, scipy (for numerical computation)
- uvicorn (ASGI server)
- Docker container

**Sizing:** Single instance, 512MB–1GB RAM. The computations are CPU-bound but short-lived (< 500ms per request). A single instance handles the polling load easily.

**Authentication:** Simple API key in header (`X-Quant-Key: {QUANT_ENGINE_API_KEY}`). Not a security-critical boundary — it's internal service-to-service communication. The key prevents random internet traffic from hitting the compute endpoints.

**Health check:** `GET /health` returns `200 OK` with version info.

---

## 3. Deribit API Reference

All endpoints are public and require no API key.

### REST Endpoints

**Base URL:** `https://www.deribit.com/api/v2/public/`

| Endpoint | Purpose | Key Response Fields |
|---|---|---|
| `get_instruments?currency=BTC&kind=option&expired=false` | List all active options instruments | instrument_name, strike, expiration_timestamp, option_type (call/put) |
| `get_book_summary_by_currency?currency=BTC&kind=option` | Summary for all options — bid/ask IV, OI, volume, mark price, underlying price | bid_price, ask_price, mark_iv, bid_iv, ask_iv, open_interest, volume, underlying_price, mark_price |
| `get_order_book?instrument_name=BTC-28MAR26-90000-C` | Full order book for a specific option | bid_iv, ask_iv, mark_iv, mark_price, underlying_price, greeks (delta, gamma, vega, theta, rho) |
| `get_historical_volatility?currency=BTC` | Historical realized volatility | Array of [timestamp, volatility] pairs |
| `ticker?instrument_name=BTC-PERPETUAL` | BTC perpetual price (for spot reference) | mark_price, index_price |

### Key Concepts

**Instrument naming:** `{ASSET}-{EXPIRY}-{STRIKE}-{TYPE}`
- Example: `BTC-28MAR26-90000-C` = BTC call option, $90,000 strike, expires March 28, 2026

**IV is provided by Deribit:** Unlike equity options where you compute IV from prices, Deribit provides `mark_iv`, `bid_iv`, and `ask_iv` directly. This simplifies the pipeline — we don't need to run our own IV solver.

**Data density:** BTC typically has 200-400 active option instruments across 5-8 expirations and 30-60 strikes per expiration. ETH is similar. Total: ~400-800 instruments to fetch per asset.

**Rate limits:** 20 requests per second for unauthenticated access. The `get_book_summary_by_currency` endpoint returns ALL options in one call (no pagination needed), so we need only 2 calls per polling cycle (BTC + ETH).

### Data Freshness

Options data doesn't need sub-second latency — the vol surface changes gradually. Polling every 5 minutes is sufficient for analytics purposes.

---

## 4. Database — Options Data Models

Add to `prisma/schema.prisma`:

```prisma
// Snapshot of the full options chain at a point in time
// One row per instrument per snapshot cycle
model OptionsChainSnapshot {
  id              String   @id @default(cuid())
  asset           String                          // "BTC" or "ETH"
  instrumentName  String                          // "BTC-28MAR26-90000-C"
  strike          Float
  expiration      DateTime                        // Expiration date of the option
  optionType      String                          // "call" or "put"
  
  // Pricing
  markPrice       Float                           // Option mark price (in BTC/ETH)
  markIV          Float                           // Deribit's mark implied volatility (annualized, 0-500 range)
  bidIV           Float?                          // Bid IV (null if no bid)
  askIV           Float?                          // Ask IV (null if no ask)
  underlyingPrice Float                           // BTC/ETH spot price at time of snapshot
  
  // Activity
  openInterest    Float                           // OI in contracts
  volume24h       Float                           // 24h volume
  
  // Greeks (provided by Deribit)
  delta           Float?
  gamma           Float?
  vega            Float?
  theta           Float?
  
  // Metadata
  timestamp       DateTime                        // Snapshot time (rounded to 5-min interval)
  createdAt       DateTime @default(now())
  
  @@unique([asset, instrumentName, timestamp])
  @@index([asset, timestamp])
  @@index([asset, expiration, timestamp])
  @@index([asset, strike, optionType, timestamp])
}

// Computed vol surface snapshots (output from Quant Engine)
// Persisted for historical comparison ("what did the surface look like last week?")
model VolSurfaceSnapshot {
  id              String   @id @default(cuid())
  asset           String                          // "BTC" or "ETH"
  
  // Fitted surface data stored as JSON
  // Array of { strike, expiry, fittedIV, delta } points
  surfaceData     Json
  
  // Key summary metrics extracted from the surface
  atmIV30d        Float?                          // ATM IV for 30-day expiry
  atmIV90d        Float?                          // ATM IV for 90-day expiry
  skew25d30d      Float?                          // 25-delta risk reversal for 30-day
  
  timestamp       DateTime
  createdAt       DateTime @default(now())
  
  @@unique([asset, timestamp])
  @@index([asset, timestamp])
}

// Historical IV snapshots for term structure and VRP tracking
model IVSnapshot {
  id              String   @id @default(cuid())
  asset           String
  
  // ATM IV at standard tenors
  iv7d            Float?                          // 7-day ATM IV
  iv30d           Float?                          // 30-day ATM IV
  iv60d           Float?                          // 60-day ATM IV
  iv90d           Float?                          // 90-day ATM IV
  iv180d          Float?                          // 180-day ATM IV
  
  // Skew at standard tenors
  skew25d7d       Float?                          // 25-delta RR, 7-day
  skew25d30d      Float?                          // 25-delta RR, 30-day
  skew25d90d      Float?                          // 25-delta RR, 90-day
  
  // Spot price for context
  spotPrice       Float
  
  timestamp       DateTime
  createdAt       DateTime @default(now())
  
  @@unique([asset, timestamp])
  @@index([asset, timestamp])
}
```

**Storage estimates:**
- OptionsChainSnapshot: ~600 instruments × 288 snapshots/day (every 5 min) × 2 assets = ~345,600 rows/day. **This is too many.** Reduce: persist full chain snapshots only every hour (48/day), and keep the 5-min data in Redis only. That's ~57,600 rows/day → ~21M rows/year. Still large. **Implement a retention policy: keep hourly snapshots for 30 days, daily snapshots (noon UTC) for 1 year, delete older.**
- VolSurfaceSnapshot: 1 per asset per hour = 48/day, ~17,520/year — trivial.
- IVSnapshot: 1 per asset per hour = 48/day — trivial.

---

## 5. Quant Engine — API Specification

### Endpoints

All endpoints accept POST with JSON body and return JSON. The Vercel backend sends raw options chain data, the Quant Engine returns computed results. No database access from the engine.

#### `POST /vol-surface`

**Input:**
```json
{
  "asset": "BTC",
  "spot_price": 84520,
  "options": [
    {
      "strike": 80000,
      "expiry_days": 14,
      "option_type": "call",
      "mark_iv": 52.3,
      "bid_iv": 51.0,
      "ask_iv": 53.5,
      "open_interest": 1250,
      "volume_24h": 85
    }
  ],
  "expirations": [
    { "date": "2026-05-01", "days_to_expiry": 14 },
    { "date": "2026-05-30", "days_to_expiry": 43 }
  ]
}
```

**Output:**
```json
{
  "asset": "BTC",
  "spot_price": 84520,
  "surface": [
    {
      "strike": 80000,
      "delta": -0.25,
      "expiry_days": 14,
      "expiry_date": "2026-05-01",
      "raw_iv": 52.3,
      "fitted_iv": 52.1,
      "residual": 0.2
    }
  ],
  "fit_quality": {
    "rmse": 0.45,
    "max_residual": 1.2,
    "method": "svi"
  },
  "summary": {
    "atm_iv_by_expiry": [
      { "expiry_days": 14, "atm_iv": 48.5 },
      { "expiry_days": 43, "atm_iv": 51.2 }
    ],
    "skew_25d_by_expiry": [
      { "expiry_days": 14, "skew_25d": -3.2 },
      { "expiry_days": 43, "skew_25d": -2.8 }
    ]
  },
  "computed_at": "2026-04-17T12:00:00Z"
}
```

**Computation:** Fit the raw IV data to a smooth surface using SVI (Stochastic Volatility Inspired) parameterization or cubic spline interpolation. The quant partner decides the method based on validation results. The output is a grid of fitted IV values across strikes and expirations with quality metrics.

#### `POST /rnd`

**Input:**
```json
{
  "asset": "BTC",
  "spot_price": 84520,
  "expiry_date": "2026-05-01",
  "expiry_days": 14,
  "risk_free_rate": 0.05,
  "options": [
    { "strike": 80000, "call_price_usd": 5200, "iv": 52.1, "option_type": "call" }
  ]
}
```

**Output:**
```json
{
  "asset": "BTC",
  "expiry_date": "2026-05-01",
  "expiry_days": 14,
  "spot_price": 84520,
  "density": [
    { "price": 70000, "probability": 0.002 },
    { "price": 72000, "probability": 0.005 },
    { "price": 74000, "probability": 0.012 }
  ],
  "statistics": {
    "mean": 85200,
    "median": 84800,
    "mode": 84500,
    "std_dev": 5200,
    "skewness": -0.15,
    "kurtosis": 3.8,
    "prob_above_spot": 0.52,
    "prob_below_80k": 0.18,
    "prob_above_90k": 0.22
  },
  "confidence": {
    "method": "breeden_litzenberger",
    "n_options_used": 42,
    "strike_range": [70000, 120000],
    "quality": "good"
  }
}
```

**Computation:** Breeden-Litzenberger method — the second derivative of call prices with respect to strike price, discounted at the risk-free rate, gives the risk-neutral probability density. The quant partner's implementation handles interpolation between discrete strikes and extrapolation in the tails.

#### `POST /vol-cone`

**Input:**
```json
{
  "asset": "BTC",
  "daily_closes": [84000, 84200, 83800, 84500, ...],
  "current_atm_iv": 48.5
}
```

**Output:**
```json
{
  "asset": "BTC",
  "windows": [
    {
      "days": 7,
      "current_rv": 42.3,
      "percentiles": { "p10": 28, "p25": 35, "p50": 45, "p75": 58, "p90": 72 }
    },
    {
      "days": 30,
      "current_rv": 48.1,
      "percentiles": { "p10": 32, "p25": 40, "p50": 50, "p75": 62, "p90": 78 }
    },
    { "days": 60, ... },
    { "days": 90, ... },
    { "days": 180, ... }
  ],
  "current_atm_iv": 48.5,
  "iv_percentile_vs_rv30d": 42,
  "assessment": "IV is at the 42nd percentile of historical 30d realized vol — options are fairly priced"
}
```

**Computation:** For each lookback window (7d, 30d, 60d, 90d, 180d), compute realized volatility (annualized standard deviation of log returns), then calculate what percentile the current value sits at relative to all historical values of that same window. Overlay the current ATM IV to show whether options are cheap or expensive.

#### `POST /vrp`

**Input:**
```json
{
  "asset": "BTC",
  "iv_history": [
    { "date": "2026-04-01", "atm_iv_30d": 52.3 },
    { "date": "2026-04-02", "atm_iv_30d": 51.8 }
  ],
  "rv_history": [
    { "date": "2026-04-01", "rv_30d": 45.2 },
    { "date": "2026-04-02", "rv_30d": 44.8 }
  ]
}
```

**Output:**
```json
{
  "asset": "BTC",
  "current_vrp": 6.5,
  "current_vrp_percentile": 62,
  "vrp_series": [
    { "date": "2026-04-01", "vrp": 7.1, "iv": 52.3, "rv": 45.2 },
    { "date": "2026-04-02", "vrp": 7.0, "iv": 51.8, "rv": 44.8 }
  ],
  "assessment": "VRP is positive and above median — selling options is modestly favorable",
  "mean_vrp": 5.8,
  "std_vrp": 3.2
}
```

**Computation:** VRP = IV - subsequent realized vol. The series shows how the premium has evolved over time. Percentile shows where current VRP sits relative to history.

#### `POST /skew`

**Input:** Same options array as `/vol-surface`.

**Output:**
```json
{
  "asset": "BTC",
  "by_expiry": [
    {
      "expiry_date": "2026-05-01",
      "expiry_days": 14,
      "skew_25d": -3.2,
      "skew_10d": -5.8,
      "skew_5d": -8.1,
      "put_iv_25d": 54.5,
      "call_iv_25d": 51.3,
      "atm_iv": 48.5,
      "smile": [
        { "delta": -0.10, "iv": 62.3 },
        { "delta": -0.25, "iv": 54.5 },
        { "delta": -0.50, "iv": 48.5 },
        { "delta": 0.25, "iv": 51.3 },
        { "delta": 0.10, "iv": 56.1 }
      ]
    }
  ],
  "term_structure": [
    { "expiry_days": 7, "atm_iv": 45.2 },
    { "expiry_days": 14, "atm_iv": 48.5 },
    { "expiry_days": 30, "atm_iv": 51.2 },
    { "expiry_days": 60, "atm_iv": 53.8 },
    { "expiry_days": 90, "atm_iv": 55.1 },
    { "expiry_days": 180, "atm_iv": 56.3 }
  ],
  "term_structure_shape": "contango"
}
```

**Computation:** For each expiration, find options closest to 5-delta, 10-delta, 25-delta, and 50-delta (ATM) using Black-Scholes delta calculation. Compute risk reversals (put IV - call IV at same delta). Term structure = ATM IV across expirations.

#### `POST /term-structure`

Can be served by the `/skew` endpoint (term_structure is included in the output). Alternatively, a lightweight standalone endpoint if the full skew computation isn't needed.

---

## 6. Implementation — Step by Step

### Step 1: Deribit Exchange Connector

**New file:** `lib/exchanges/deribit.ts`

```typescript
interface DeribitConnector {
  // Get all active option instruments for a currency
  getInstruments(currency: "BTC" | "ETH"): Promise<DeribitInstrument[]>;
  
  // Get book summary for all options — single call returns everything
  getBookSummary(currency: "BTC" | "ETH"): Promise<DeribitBookSummary[]>;
  
  // Get detailed order book for a specific instrument (for Greeks)
  getOrderBook(instrumentName: string): Promise<DeribitOrderBook>;
  
  // Get historical realized volatility
  getHistoricalVolatility(currency: "BTC" | "ETH"): Promise<DeribitVolHistory[]>;
  
  // Get BTC/ETH index price
  getIndexPrice(currency: "BTC" | "ETH"): Promise<number>;
}
```

**Key implementation notes:**

- Base URL: `https://www.deribit.com/api/v2/public/`
- All endpoints use GET with query params
- `get_book_summary_by_currency?currency=BTC&kind=option` returns the entire chain in one call
- Parse instrument names to extract strike, expiry, type: `BTC-28MAR26-90000-C` → `{ asset: "BTC", expiry: "2026-03-28", strike: 90000, type: "call" }`
- Rate limit: 20 req/s — with 2 calls per cycle (BTC + ETH book summary), this is trivially within limits
- Use `lib/exchangeClient.ts` for rate-limited fetching (same as Binance/Bybit)
- Handle Deribit-specific quirks: IV is in percentage points (0-500), not decimal; mark_price is in BTC/ETH not USD

**Types file:** `lib/exchanges/deribit-types.ts`

```typescript
interface DeribitBookSummary {
  instrument_name: string;
  underlying_price: number;
  mark_price: number;
  mark_iv: number;           // Annualized IV in percentage (e.g., 52.3 = 52.3%)
  bid_price: number | null;
  ask_price: number | null;
  bid_iv: number | null;
  ask_iv: number | null;
  open_interest: number;
  volume: number;
  // ... other fields
}

// Parsed into internal format
interface OptionsChainEntry {
  asset: string;
  instrumentName: string;
  strike: number;
  expirationDate: Date;
  daysToExpiry: number;
  optionType: "call" | "put";
  markPrice: number;          // In USD (converted from BTC)
  markIV: number;             // Annualized, percentage
  bidIV: number | null;
  askIV: number | null;
  underlyingPrice: number;    // Spot/index price in USD
  openInterest: number;
  volume24h: number;
  delta: number | null;
  gamma: number | null;
  vega: number | null;
  theta: number | null;
}
```

### Step 2: Options Data Cron Job

**New file:** `app/api/cron/refresh-options/route.ts`

Runs every 5 minutes. For each asset (BTC, ETH):

1. Fetch full book summary from Deribit (`get_book_summary_by_currency`)
2. Parse all instruments into `OptionsChainEntry[]`
3. Filter out instruments with no bid and no ask (completely illiquid)
4. Filter out instruments with < 1 OI (no market)
5. Cache the full parsed chain in Upstash Redis (`options:chain:BTC`, TTL 6 min)
6. Send the chain to the Quant Engine for vol surface fitting (`POST /vol-surface`)
7. Send per-expiry data to Quant Engine for RND (`POST /rnd` per expiration)
8. Send daily closes + current ATM IV to Quant Engine for vol cone (`POST /vol-cone`)
9. Cache all computed results in Upstash Redis with 6-min TTL
10. Persist to PostgreSQL:
    - OptionsChainSnapshot: hourly only (check if hour boundary crossed)
    - VolSurfaceSnapshot: hourly
    - IVSnapshot: hourly (extract ATM IVs and skews from surface output)
11. Fetch historical IV + RV data, send to Quant Engine for VRP (`POST /vrp`)

**Cron schedule:** `*/5 * * * *` (every 5 minutes, requires Vercel Pro). On Hobby plan, use `0 * * * *` (hourly) and supplement with client-triggered cache warming on first request.

**Error handling:**
- If Deribit is unavailable: return stale cache (previous 5-min snapshot)
- If Quant Engine is unavailable: cache raw chain data but skip computed metrics. Log error. Frontend shows raw IV data but not fitted surface.
- If individual computation fails (e.g., RND for one expiry): skip that expiry, return partial results

### Step 3: Quant Engine Deployment

**Quant partner's deliverable.** The engineering side provides:
- Environment variable: `QUANT_ENGINE_URL` (e.g., `https://scope-alpha-quant.up.railway.app`)
- Environment variable: `QUANT_ENGINE_API_KEY`
- A client wrapper in TypeScript:

**New file:** `lib/quant-engine.ts`

```typescript
class QuantEngineClient {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = process.env.QUANT_ENGINE_URL || "";
    this.apiKey = process.env.QUANT_ENGINE_API_KEY || "";
  }
  
  async computeVolSurface(input: VolSurfaceInput): Promise<VolSurfaceOutput | null> {
    return this.post("/vol-surface", input);
  }
  
  async computeRND(input: RNDInput): Promise<RNDOutput | null> {
    return this.post("/rnd", input);
  }
  
  async computeVolCone(input: VolConeInput): Promise<VolConeOutput | null> {
    return this.post("/vol-cone", input);
  }
  
  async computeVRP(input: VRPInput): Promise<VRPOutput | null> {
    return this.post("/vrp", input);
  }
  
  async computeSkew(input: SkewInput): Promise<SkewOutput | null> {
    return this.post("/skew", input);
  }
  
  private async post<I, O>(path: string, input: I): Promise<O | null> {
    if (!this.baseUrl) {
      console.warn("Quant Engine not configured — returning null");
      return null;
    }
    
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Quant-Key": this.apiKey,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
      
      if (!res.ok) {
        console.error(`Quant Engine ${path} returned ${res.status}`);
        return null;
      }
      
      return res.json();
    } catch (err) {
      console.error(`Quant Engine ${path} failed:`, err);
      return null;
    }
  }
}

export const quantEngine = new QuantEngineClient();
```

**Inert mode:** When `QUANT_ENGINE_URL` is empty, all methods return `null`. The cron job skips computed metrics. The frontend shows raw Deribit data (mark IV per instrument) without fitted surfaces. This allows deploying the options pipeline before the Quant Engine is ready.

### Step 4: Volatility API Routes

#### `GET /api/market/options/chain?asset=BTC`

Returns the cached options chain with basic aggregations.

```typescript
{
  asset: "BTC",
  spotPrice: 84520,
  expirations: [
    {
      date: "2026-05-01",
      daysToExpiry: 14,
      callCount: 28,
      putCount: 26,
      totalOI: 45000,
      totalVolume: 3200,
      maxPainStrike: 85000,     // Strike where total option value is minimized
      putCallRatio: 0.85,       // Put OI / Call OI
    }
  ],
  totalInstruments: 420,
  updatedAt: "2026-04-17T12:00:00Z"
}
```

Cache: read from `options:chain:BTC` in Redis.

#### `GET /api/market/options/vol-surface?asset=BTC`

Returns the fitted volatility surface from the Quant Engine.

Cache: read from `options:vol-surface:BTC` in Redis.

#### `GET /api/market/options/rnd?asset=BTC&expiry=2026-05-01`

Returns the RND for a specific expiration.

Cache: read from `options:rnd:BTC:2026-05-01` in Redis.

#### `GET /api/market/options/vol-cone?asset=BTC`

Returns the volatility cone data.

Cache: read from `options:vol-cone:BTC` in Redis.

#### `GET /api/market/options/vrp?asset=BTC`

Returns the volatility risk premium analysis.

Cache: read from `options:vrp:BTC` in Redis.

#### `GET /api/market/options/skew?asset=BTC`

Returns skew data across expirations + term structure.

Cache: read from `options:skew:BTC` in Redis.

All routes follow the same pattern: check Redis cache → if miss, the cron should have populated it → if truly missing, return 503 with "data not yet available" message.

### Step 5: Frontend — Volatility Section

Flip `/terminal/volatility` from Coming Soon to active.

**New file:** `app/(app)/terminal/volatility/page.tsx`

Tabbed layout (same pattern as derivatives):

| Tab | Content | Data Source |
|---|---|---|
| Overview | Key metrics summary: ATM IV, skew, term structure shape, VRP, vol cone status | Multiple endpoints |
| Vol Surface | Interactive 3D surface visualization | `/api/market/options/vol-surface` |
| RND | Probability distribution curve per expiration | `/api/market/options/rnd` |
| Skew | Risk reversal charts + smile per expiry | `/api/market/options/skew` |
| Term Structure | ATM IV across expirations | `/api/market/options/skew` (term_structure field) |
| Vol Cone | Realized vol percentiles + IV overlay | `/api/market/options/vol-cone` |
| VRP | IV vs realized vol spread chart | `/api/market/options/vrp` |

### Step 6: Frontend Components — Vol Surface

**New file:** `components/volatility/VolSurfaceView.tsx`

**3D Surface visualization options (in order of preference):**

1. **Plotly.js** — has a native `Surface` trace type for 3D. Import via CDN. Interactive rotation, zoom, hover for values. Best visual result with least effort.
2. **Three.js** — available in the React artifacts stack. More control but more work.
3. **2D heatmap fallback** — strikes on X axis, expirations on Y axis, color = IV. Simpler to build, still useful.

**Recommendation:** Start with the 2D heatmap (faster to ship, works well on mobile) with a toggle to switch to 3D Plotly surface. The 2D heatmap is a grid of colored cells where each cell shows the IV at that (strike, expiry) intersection.

**Features:**
- Toggle between absolute strike and delta space on X axis
- Expiry selector (filter to specific expirations)
- Hover: show exact IV, strike, expiry, delta
- Historical comparison toggle: overlay the surface from N days ago (from VolSurfaceSnapshot) to see how the surface has shifted

### Step 7: Frontend Components — RND

**New file:** `components/volatility/RNDView.tsx`

- Expiration selector dropdown
- Probability density curve (area chart / line chart using Lightweight Charts or Recharts)
- Vertical line at current spot price
- Shaded regions for user-specified price targets: "probability of being above $90K by expiry"
- Statistics panel: mean, median, std dev, skewness, prob above/below spot
- Plain English summary: "The options market implies a 52% chance BTC will be above the current price ($84,520) by May 1st, with a 22% chance of exceeding $90,000"

### Step 8: Frontend Components — Skew & Term Structure

**New file:** `components/volatility/SkewView.tsx`

- Expiration selector
- Smile chart: IV vs delta for the selected expiration (U-shaped curve)
- Risk reversal chart: 25-delta skew across expirations (line chart, one point per expiry)
- Historical skew overlay: current vs 30d avg (from IVSnapshot history)
- Interpretation: "Put skew is elevated at -5.2 for near-term options, indicating the market is paying a premium for downside protection"

**New file:** `components/volatility/TermStructureView.tsx`

- ATM IV across expirations (line chart, X = days to expiry, Y = IV)
- Contango/backwardation label
- Historical overlay: current term structure vs 7d/30d ago
- Interpretation: "Term structure is in contango — longer-dated options are more expensive, indicating no near-term stress"

### Step 9: Frontend Components — Vol Cone & VRP

**New file:** `components/volatility/VolConeView.tsx`

- X axis: lookback window (7d, 30d, 60d, 90d, 180d)
- Y axis: annualized volatility
- Shaded bands for percentile ranges (10th-90th, 25th-75th)
- Dot at current realized vol for each window
- Horizontal line at current ATM IV
- Clear visual: if the IV line sits above the current RV dots and above the median band → "options are expensive"
- Assessment text from Quant Engine: "IV is at the 42nd percentile of historical 30d realized vol — options are fairly priced"

**New file:** `components/volatility/VRPView.tsx`

- Time series chart: VRP (IV - RV) over the selected lookback period (30d, 90d, 1y)
- Zero line highlighted
- Shaded regions: VRP > 0 (green tint), VRP < 0 (red tint)
- Current VRP with percentile badge
- Interpretation: "Volatility risk premium is +6.5% (62nd percentile). Options sellers are receiving a moderate premium over realized movement."

### Step 10: Volatility Overview Tab

**New file:** `components/volatility/VolOverview.tsx`

Summary dashboard showing key metrics at a glance (all pulled from cached data, no additional API calls):

```
┌─────────────────────────────────────────────────────┐
│  BTC Volatility Overview                            │
├──────────────┬──────────────┬──────────────┬────────┤
│ ATM IV (30d) │ 25d Skew     │ Term Struct  │ VRP    │
│ 48.5%        │ -3.2         │ Contango     │ +6.5%  │
│ ↑ from 46.2  │ Puts bid     │ Normal       │ 62nd % │
├──────────────┴──────────────┴──────────────┴────────┤
│ Vol Cone Status: IV is at 42nd percentile of RV     │
│ → Options are fairly priced                         │
├─────────────────────────────────────────────────────┤
│ RND Summary (nearest expiry):                       │
│ 52% prob above spot | 22% prob > $90K | 18% < $80K  │
├─────────────────────────────────────────────────────┤
│ Put/Call OI Ratio: 0.85 | Max Pain (May): $85,000   │
└─────────────────────────────────────────────────────┘
```

---

## 7. Navigation Updates

In `config/navigation.ts`, flip Volatility to enabled:

```typescript
{
  label: "Volatility",
  path: "/terminal/volatility",
  icon: "Activity",
  enabled: true,  // ← flip from false
  description: "...",
  phase: 3,
}
```

---

## 8. Environment Variables

### New

```env
# Deribit (no API key needed — public endpoints)
# No new env vars for Deribit itself

# Quant Engine
QUANT_ENGINE_URL=                     # e.g., https://scope-alpha-quant.up.railway.app
QUANT_ENGINE_API_KEY=                 # Shared secret for service-to-service auth
```

Both are optional — inert mode when empty.

---

## 9. New File Structure

```
# New files

lib/exchanges/
  deribit.ts                           # Deribit REST connector
  deribit-types.ts                     # Deribit-specific type definitions

lib/
  quant-engine.ts                      # QuantEngineClient wrapper

lib/options/
  chain-parser.ts                      # Parse Deribit response → OptionsChainEntry[]
  max-pain.ts                          # Max pain calculation (pure TS — doesn't need Quant Engine)
  put-call-ratio.ts                    # P/C ratio computation
  snapshot-manager.ts                  # Handles hourly persistence + retention policy

app/api/cron/
  refresh-options/route.ts             # 5-min options data refresh cron

app/api/market/options/
  chain/route.ts                       # Raw chain data + aggregations
  vol-surface/route.ts                 # Fitted vol surface
  rnd/route.ts                         # Risk-neutral density
  vol-cone/route.ts                    # Volatility cone
  vrp/route.ts                        # Volatility risk premium
  skew/route.ts                        # Skew + term structure

app/(app)/terminal/
  volatility/page.tsx                  # Volatility section (replace Coming Soon)

components/volatility/
  VolOverview.tsx                      # Overview tab — key metrics dashboard
  VolSurfaceView.tsx                   # 3D/2D vol surface visualization
  VolSurfaceHeatmap.tsx                # 2D heatmap (strike × expiry → IV color)
  RNDView.tsx                          # Probability density curve
  SkewView.tsx                         # Smile + risk reversal charts
  TermStructureView.tsx                # ATM IV across expirations
  VolConeView.tsx                      # Realized vol percentiles + IV overlay
  VRPView.tsx                          # IV vs RV spread chart
  ExpirationSelector.tsx               # Dropdown for selecting expiration (reused across views)

hooks/
  useOptionsChain.ts                   # SWR hook for chain data
  useVolSurface.ts                     # SWR hook for vol surface
  useRND.ts                            # SWR hook for RND (includes expiry param)
  useSkew.ts                           # SWR hook for skew + term structure
  useVolCone.ts                        # SWR hook for vol cone
  useVRP.ts                            # SWR hook for VRP

types/
  options.ts                           # All options-specific TypeScript types
```

---

## 10. Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/refresh-options", "schedule": "*/5 * * * *" }
  ]
}
```

On Hobby plan (daily minimum): use `0 * * * *` (hourly) and add client-triggered warming. The first user to visit `/terminal/volatility` after cache expires triggers a synchronous fetch + computation cycle. Subsequent requests within 6 minutes get cached data.

---

## 11. Data Retention Policy

Implement in a new cron job or as part of `refresh-options`:

**`OptionsChainSnapshot`:**
- Keep hourly snapshots for 30 days
- Keep one snapshot per day (noon UTC) for up to 1 year
- Delete anything older than 1 year
- Run cleanup daily

**`VolSurfaceSnapshot`:**
- Keep all (48/day × 365 = ~17,520/year — trivial storage)

**`IVSnapshot`:**
- Keep all (same — trivial storage)

**Implementation:** Daily cron or appended to `persist-candles` cron:
```sql
DELETE FROM "OptionsChainSnapshot" 
WHERE timestamp < NOW() - INTERVAL '30 days'
AND EXTRACT(HOUR FROM timestamp) != 12;

DELETE FROM "OptionsChainSnapshot"
WHERE timestamp < NOW() - INTERVAL '365 days';
```

---

## 12. Cross-Domain Synthesis (Phase 3 Contributions)

Phase 3 adds options data to the synthesis framework built in Phase 2:

**Regime classifier enrichment:**
- Add IV regime as an input: if ATM IV is at > 80th percentile of vol cone → "high vol regime"
- Add skew as an input: if 25d skew is more negative than -5 → "hedging demand elevated"
- Update `computeHealthScore` to accept optional `volatility` inputs

**Screener additions:**
- Add `atmIV30d` column to screener (for BTC and ETH only — options data is limited to these two)
- Add `skew25d` column
- Add `volRegime` tag: "low_vol" / "normal_vol" / "high_vol" based on vol cone position

**Alert new types:**
- `iv_above` / `iv_below` — ATM IV threshold
- `skew_extreme` — 25d skew exceeds threshold
- `vrp_extreme` — VRP exceeds threshold

Add to alert evaluator and alert type enum.

---

## 13. Definition of Done

### Infrastructure
- [ ] Deribit connector fetching full options chain for BTC and ETH
- [ ] Options data cron running and caching chain data in Redis
- [ ] Quant Engine deployed and reachable from Vercel (or inert mode working)
- [ ] QuantEngineClient wrapper handling success, failure, and inert mode
- [ ] Three new Prisma models created and migrated
- [ ] Historical data accumulating (hourly chain snapshots, vol surface, IV snapshots)
- [ ] Data retention policy running

### API Routes
- [ ] `/api/market/options/chain` returning parsed options data
- [ ] `/api/market/options/vol-surface` returning fitted surface
- [ ] `/api/market/options/rnd` returning probability density per expiration
- [ ] `/api/market/options/vol-cone` returning percentile data
- [ ] `/api/market/options/vrp` returning premium analysis
- [ ] `/api/market/options/skew` returning skew + term structure
- [ ] All routes gracefully handling Quant Engine unavailability

### Frontend
- [ ] Volatility section at `/terminal/volatility` active (no longer Coming Soon)
- [ ] Overview tab showing key metrics dashboard
- [ ] Vol surface rendering as 2D heatmap (3D is nice-to-have)
- [ ] RND curve rendering with expiration selector and probability statistics
- [ ] Skew view showing smile and risk reversal charts
- [ ] Term structure view showing ATM IV across expirations
- [ ] Vol cone showing percentile bands with IV overlay
- [ ] VRP chart showing IV-RV spread over time
- [ ] All views have plain-English interpretation text
- [ ] Sidebar updated: Volatility enabled

### Integration
- [ ] Screener updated with IV/skew columns for BTC + ETH
- [ ] New alert types for IV/skew/VRP thresholds
- [ ] Regime classifier enriched with vol inputs (if Phase 2 regime is in place)

### Technical
- [ ] Zero TypeScript errors
- [ ] Build passes
- [ ] Quant Engine returns results within 10s timeout
- [ ] Options cron completes within 30s (Vercel function limit on Pro)

---

## 14. Quant Partner Parallel Work (During Phase 3)

While engineering builds the pipeline and frontend:

1. **Deploy the Quant Engine** — FastAPI service with all 5 endpoints, Dockerized, on Railway/Fly.io
2. **Validate vol surface output** against known market conditions — confirm fitted IVs are within 0.5% of mark IVs on average
3. **Validate RND output** — confirm probabilities sum to ~1.0, distribution is smooth, tail behavior is reasonable
4. **Begin GEX computation module** (for Phase 4):
   - Adapt crypto-specific taker-flow-based methodology
   - Build gamma flip detection
   - Build delta exposure computation
5. **Begin max pain validation** — compare computed max pain to Deribit's reported settlement prices historically
6. **Document methodology** for all deployed modules

---

## 15. What This Enables

Phase 3 gives Scope Alpha the options analytics suite that currently only exists on Glassnode (new and limited), MenthorQ (paid), and Bloomberg ($32K/yr). Making these tools accessible with clear visualizations and plain-English interpretations is the core differentiator.

Specifically:

- **Phase 4:** Adds GEX, DEX, vanna/charm, options flow to the same `/terminal/volatility` section. The Quant Engine gains 4 more endpoints. The Deribit data pipeline is already in place — Phase 4 just adds more computation on the same data.
- **Phase 5 (On-Chain):** The RND vs on-chain support/resistance comparison becomes possible — "options market implies 18% chance of sub-$80K, but on-chain shows 2.3M BTC cost basis between $78K-$82K"
- **Phase 6 (Regime & Convergence):** Options data becomes the third domain in the convergence scorer (derivatives + options + on-chain). IV regime, skew, and vol cone position are powerful inputs.
- **The "wow" moment:** A retail trader opening Scope Alpha and seeing an interactive RND curve that says "there's a 22% chance BTC will be above $90K by May 1st" — derived from real options market pricing — is something they've never had access to before outside of building it themselves in Python.

---

*This PRD should be treated as the authoritative specification. Claude Code should present an implementation plan with architecture decision questions before beginning work.*
