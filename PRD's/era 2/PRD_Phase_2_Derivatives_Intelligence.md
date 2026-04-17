# PRD: Phase 2 — Derivatives Intelligence Layer

**Version:** 1.0
**Date:** April 17, 2026
**Status:** Ready for Implementation
**Priority:** High — first differentiating features beyond raw data display
**Depends on:** Phase 1 (Live Derivatives Data) complete

---

## 1. Context

### Where We Are

Phase 0 stripped the marketplace and rebuilt the app as an analytics platform shell. Phase 1 wired live data from Binance + Bybit — funding rates, OI, liquidations, basis, health score, screener, and historical persistence to PostgreSQL. The derivatives terminal at `/terminal/derivatives` shows real data across all 10 assets.

### What Phase 2 Is

Phase 1 made the terminal a **data display** — showing you what the market numbers are right now. Phase 2 makes it an **intelligence tool** — computing derived analytics that tell you what the numbers *mean* and surfacing insights that require synthesis across multiple data points.

This is where Scope Alpha starts differentiating from Coinglass. Raw funding rates and OI are free on a dozen websites. Liquidation heatmaps, cross-exchange arbitrage analysis, CVD divergence detection, and a regime-aware health composite are not.

### What's NOT In Phase 2

- Options data pipeline and Quant Engine (Phase 3)
- On-chain analytics (Phase 5)
- Sentiment / macro dashboard (Phase 7)
- Payment / subscription system (deferred)
- The computations in Phase 2 are all implementable in TypeScript. The Python Quant Engine arrives in Phase 3 when vol surfaces, RND, and GEX require it.

### Quant Partner Deliverables Expected

By the start of Phase 2, the data science partner should have validated prototypes for:

| Module | Status | Deliverable |
|---|---|---|
| Funding rate arb calculator | Ready | Python module + methodology doc |
| Basis trade monitor | Ready | Python module + methodology doc |
| CVD divergence detection | Ready | Jupyter notebook prototype |
| Data cleaning library | In progress | Shared validation functions |

These prototypes inform the TypeScript implementations. The logic is simple enough (arithmetic, z-scores, divergence detection) that porting to TS is straightforward. The quant partner validates that the TS implementations produce identical outputs to their Python prototypes.

---

## 2. Current State (Post-Phase 1)

### What Exists

**Live data flowing:**
- Binance: candles (WS), tickers (WS), liquidations (WS), funding/OI/basis (REST+cron)
- Bybit: liquidations (WS), funding/OI/basis (REST+cron)
- Upstash Redis caching all slow metrics
- Historical data accumulating in PostgreSQL (FundingRateSnapshot, OISnapshot, LiquidationEvent, CandleHistory)

**API routes:**
- `/api/market/funding?asset=BTC` — live funding data
- `/api/market/open-interest?asset=BTC` — live OI data
- `/api/market/liquidations?asset=BTC` — aggregated liquidations
- `/api/market/basis?asset=BTC` — basis/premium data
- `/api/market/health?asset=BTC` — health score composite
- `/api/market/screener` — all-asset screener
- `/api/cron/refresh-metrics` — cache warming
- `/api/cron/refresh-screener` — screener aggregation
- `/api/cron/persist-candles` — daily candle persistence

**Alert infrastructure (from Phase 0):**
- Alert + AlertHistory Prisma models
- CRUD API routes: `/api/alerts`, `/api/alerts/[id]`, `/api/alerts/history`
- AlertBell component in TopBar
- No evaluation engine yet — alerts can be created but don't fire

**Frontend:**
- `/terminal/derivatives` with tabs: Overview, Funding, OI, Liquidations, Basis, Screener
- Connection status indicator
- All showing live data

### What Does NOT Exist

- Liquidation heatmap (predicted liquidation levels)
- Cross-exchange comparison view (Binance vs Bybit deep dive)
- Funding rate arbitrage scanner
- Basis trade monitor with historical percentile
- CVD (Cumulative Volume Delta) computation or divergence detection
- Alert trigger evaluation engine
- Regime classification (even derivatives-only)
- Screener filtering or regime tags

---

## 3. Goals

After Phase 2 is complete:

1. Liquidation heatmap overlay on the price chart showing predicted liquidation clusters
2. Cross-exchange comparison panel showing Binance vs Bybit metrics side-by-side per asset
3. Arb Scanner tool at `/tools/arb-scanner` — live funding rate + basis arb opportunities
4. CVD chart on price chart with automatic divergence detection
5. Alert evaluation engine that checks live data against user-configured thresholds and fires in-app notifications
6. Derivatives health composite v2 with regime classification per asset
7. Screener with regime tags, sortable by all new computed columns
8. Historical funding and OI data powering trend charts within each tab

---

## 4. Feature Specifications

### 4.1 Liquidation Heatmap

**What it is:** A visual overlay on the price chart showing where liquidation clusters are predicted to occur. When price approaches a zone with dense estimated liquidations, traders know a cascade could accelerate the move.

**How it works:**

The heatmap estimates where leveraged positions would be liquidated based on:
- Current OI distribution (how much is open at what implied entry prices)
- Typical leverage levels (exchange-reported long/short ratio + estimated leverage)
- Liquidation price formula: for longs, `entry × (1 - 1/leverage + maintenance_margin)`, for shorts the inverse

**Implementation approach:**

This is an estimation model, not exact data. Exchanges don't publish per-position entry prices. The approach:

1. **Leverage distribution assumption:** Use exchange-reported long/short account ratios and estimated average leverage from OI/volume ratios. Binance reports account long/short ratio via `GET /futures/data/globalLongShortAccountRatio`.

2. **Entry price estimation:** Assume positions are distributed around recent price action. Use a Gaussian distribution centered on the current price with standard deviation based on recent volatility (e.g., 7-day realized vol). Denser clusters near round numbers and recent support/resistance levels.

3. **Liquidation price calculation:** For each estimated entry level and leverage bucket (3x, 5x, 10x, 25x, 50x, 100x), compute the liquidation price.

4. **Heatmap rendering:** Render as colored bands on the Lightweight Charts price chart using the `addHistogramSeries` or a custom SVG overlay. Color intensity = estimated liquidation volume at that price level. Warmer colors (orange/red) = denser liquidation clusters.

**API Route:** `GET /api/market/liquidation-heatmap?asset=BTC`

Response:
```typescript
{
  asset: "BTC",
  currentPrice: 84520,
  levels: [
    { price: 82000, estimatedLiqVolume: 45000000, side: "long", intensity: 0.8 },
    { price: 81500, estimatedLiqVolume: 72000000, side: "long", intensity: 0.95 },
    { price: 86000, estimatedLiqVolume: 38000000, side: "short", intensity: 0.65 },
    // ... levels in $500 increments within ±10% of current price
  ],
  metadata: {
    estimatedLongLeverage: 12.5,       // Weighted average estimated leverage
    estimatedShortLeverage: 8.3,
    longShortRatio: 1.42,
    model: "gaussian_leverage_v1",
    updatedAt: "2026-04-17T12:00:00Z"
  }
}
```

**Computation logic (runs in cron or on-demand):**

```typescript
// Pseudocode
function computeLiquidationHeatmap(asset: string): HeatmapLevel[] {
  const currentPrice = await getCurrentPrice(asset);
  const longShortRatio = await getLongShortRatio(asset);  // Binance API
  const totalOI = await getOI(asset);
  const recentVol = await getRealized7dVol(asset);        // From CandleHistory
  
  const leverageBuckets = [3, 5, 10, 25, 50, 100];
  const leverageWeights = [0.05, 0.15, 0.30, 0.25, 0.15, 0.10]; // Estimated distribution
  
  const priceRange = currentPrice * 0.10; // ±10% from current
  const stepSize = priceRange / 40;       // 40 levels
  
  const levels: HeatmapLevel[] = [];
  
  for (let offset = -20; offset <= 20; offset++) {
    const priceLevel = currentPrice + (offset * stepSize);
    let estimatedVolume = 0;
    
    for (let i = 0; i < leverageBuckets.length; i++) {
      const leverage = leverageBuckets[i];
      const weight = leverageWeights[i];
      
      // Estimate what entry price would result in liquidation at this priceLevel
      // For longs: entryPrice = priceLevel / (1 - 1/leverage)
      // For shorts: entryPrice = priceLevel / (1 + 1/leverage)
      
      const longEntryForLiqHere = priceLevel / (1 - 1/leverage);
      const shortEntryForLiqHere = priceLevel / (1 + 1/leverage);
      
      // Gaussian probability of positions existing at that entry price
      const longProb = gaussianPDF(longEntryForLiqHere, currentPrice, currentPrice * recentVol);
      const shortProb = gaussianPDF(shortEntryForLiqHere, currentPrice, currentPrice * recentVol);
      
      const longOI = totalOI * (longShortRatio / (1 + longShortRatio));
      const shortOI = totalOI * (1 / (1 + longShortRatio));
      
      estimatedVolume += (longProb * longOI * weight) + (shortProb * shortOI * weight);
    }
    
    levels.push({
      price: priceLevel,
      estimatedLiqVolume: estimatedVolume,
      side: priceLevel < currentPrice ? "long" : "short",
      intensity: 0, // Normalized after all levels computed
    });
  }
  
  // Normalize intensity to 0-1 range
  const maxVol = Math.max(...levels.map(l => l.estimatedLiqVolume));
  levels.forEach(l => l.intensity = l.estimatedLiqVolume / maxVol);
  
  return levels;
}
```

**Cache:** Upstash, 60s TTL. Recomputed by the refresh-metrics cron.

**Frontend:** Render as colored vertical bands behind the candlestick chart. Use Lightweight Charts' `createPriceLine` for key levels, or an absolutely-positioned SVG overlay for the full heatmap gradient.

**Limitations to document in UI:** "Estimated liquidation levels based on statistical model. Actual liquidations depend on individual position sizes and leverage which are not publicly available."

---

### 4.2 Cross-Exchange Comparison

**What it is:** A dedicated comparison view showing Binance vs Bybit metrics side-by-side for the selected asset. Highlights dislocations between exchanges that indicate arbitrage opportunities or market stress.

**Where it lives:** New tab or panel within `/terminal/derivatives`. Could be a "Compare" tab or a toggle within each existing tab.

**Recommended approach:** Add a "Cross-Exchange" tab to the derivatives terminal.

**API Route:** `GET /api/market/compare?asset=BTC`

Response:
```typescript
{
  asset: "BTC",
  funding: {
    binance: { rate: 0.0001, annualized: 13.14, nextFunding: "..." },
    bybit: { rate: 0.00012, annualized: 15.77, nextFunding: "..." },
    differential: 0.00002,
    differentialAnnualized: 2.63,
    differentialZScore: 1.1,          // How unusual is this spread?
    arbitrageYield: 2.63,             // Net annualized % if you arb the spread
  },
  openInterest: {
    binance: { oi: 312000, oiUsd: 26364000000 },
    bybit: { oi: 211000, oiUsd: 17831000000 },
    binanceShare: 59.6,               // % of total
    bybitShare: 40.4,
  },
  liquidations24h: {
    binance: { long: 28100000, short: 19800000 },
    bybit: { long: 17100000, short: 12300000 },
  },
  basis: {
    binance: { basisPct: 0.047, annualized: 17.3 },
    bybit: { basisPct: 0.056, annualized: 20.4 },
    differential: 0.009,
    differentialAnnualized: 3.1,
  },
  price: {
    binance: 84520,
    bybit: 84525,
    spread: 5,
    spreadPct: 0.006,
  }
}
```

**Frontend layout:**

Two-column layout:
```
┌─────────────────────┬─────────────────────┐
│      BINANCE        │       BYBIT         │
├─────────────────────┼─────────────────────┤
│ Funding: 0.010%     │ Funding: 0.012%     │
│ Annualized: 13.14%  │ Annualized: 15.77%  │
├─────────────────────┼─────────────────────┤
│ OI: $26.4B (59.6%)  │ OI: $17.8B (40.4%)  │
├─────────────────────┼─────────────────────┤
│ Liq 24h: $47.9M     │ Liq 24h: $29.4M     │
│ L: $28.1M S: $19.8M │ L: $17.1M S: $12.3M │
├─────────────────────┼─────────────────────┤
│ Basis: 0.047%       │ Basis: 0.056%       │
│ Annualized: 17.3%   │ Annualized: 20.4%   │
├─────────────────────┴─────────────────────┤
│ SPREAD ANALYSIS                           │
│ Funding diff: +0.002% (z: 1.1)           │
│ Basis diff: +0.009% → 3.1% arb yield     │
│ Price spread: $5 (0.006%)                 │
└───────────────────────────────────────────┘
```

Highlight cells where differentials exceed 1 standard deviation (yellow) or 2 standard deviations (red) from historical norms.

---

### 4.3 Funding Rate Arbitrage Scanner

**What it is:** The first tool in the `/tools/` section. Scans all enabled assets for funding rate and basis arbitrage opportunities between exchanges.

**Where it lives:** `/tools/arb-scanner` (currently a Coming Soon placeholder from Phase 0). Flip `enabled: true` in `config/navigation.ts`.

**API Route:** `GET /api/tools/arb-scanner`

Response:
```typescript
{
  opportunities: [
    {
      asset: "BTC",
      type: "funding",                  // "funding" or "basis"
      longExchange: "bybit",            // Go long here (lower funding = less cost)
      shortExchange: "binance",         // Go short here (higher funding = receive more)
      longRate: 0.00008,
      shortRate: 0.00012,
      netRate: 0.00004,                 // Rate you capture per 8h
      annualizedYield: 5.26,            // Net annualized %
      riskScore: "low",                 // Based on spread stability
      spreadZScore: 0.8,
      spreadStability: 0.72,            // % of last 30 days this spread was positive
      estimatedFees: 0.15,             // % estimated round-trip trading fees
      netYieldAfterFees: 5.11,
    },
    {
      asset: "ETH",
      type: "basis",
      longExchange: "binance",
      shortExchange: "bybit",
      basisDiff: 0.012,
      annualizedYield: 4.38,
      riskScore: "low",
      spreadStability: 0.68,
      estimatedFees: 0.15,
      netYieldAfterFees: 4.23,
    },
    // ... all assets, sorted by netYieldAfterFees descending
  ],
  updatedAt: "2026-04-17T12:00:00Z"
}
```

**Computation logic:**

```typescript
function computeArbOpportunities(): ArbOpportunity[] {
  const opportunities = [];
  
  for (const asset of enabledAssets) {
    const funding = await getCachedFunding(asset);
    const basis = await getCachedBasis(asset);
    
    // Funding arb: if funding differs between exchanges
    if (funding.binance && funding.bybit) {
      const diff = Math.abs(funding.binance.rate - funding.bybit.rate);
      if (diff > 0.00002) { // Minimum threshold to be interesting
        const longExchange = funding.binance.rate < funding.bybit.rate ? "binance" : "bybit";
        const shortExchange = longExchange === "binance" ? "bybit" : "binance";
        
        // Compute spread stability from historical data
        const history = await getHistoricalFundingSpread(asset, 30); // 30 days
        const positiveCount = history.filter(h => h.spread > 0).length;
        const stability = positiveCount / history.length;
        
        const annualized = diff * 3 * 365 * 100;
        const fees = 0.15; // Estimated 0.075% per side × 2
        
        opportunities.push({
          asset: asset.symbol,
          type: "funding",
          longExchange,
          shortExchange,
          longRate: funding[longExchange].rate,
          shortRate: funding[shortExchange].rate,
          netRate: diff,
          annualizedYield: annualized,
          riskScore: stability > 0.7 ? "low" : stability > 0.5 ? "medium" : "high",
          spreadZScore: computeZScore(diff, history.map(h => h.spread)),
          spreadStability: stability,
          estimatedFees: fees,
          netYieldAfterFees: annualized - fees,
        });
      }
    }
    
    // Basis arb: similar logic for basis differential
    // ...
  }
  
  return opportunities.sort((a, b) => b.netYieldAfterFees - a.netYieldAfterFees);
}
```

**Frontend:**

Sortable table with:
- Asset, Type (funding/basis), Long Exchange, Short Exchange
- Net Rate, Annualized Yield, Risk Score (colored badge)
- Spread Stability (bar chart), Estimated Fees, Net Yield After Fees

Click a row to expand detail: historical spread chart, yield over time, recommended position sizing note.

**Position size calculator (expandable panel):**

```
Capital: [___$10,000___]  Leverage: [_3x_]
Projected Yield: $511/year ($42.58/month)
Note: Requires maintaining positions on both exchanges.
Liquidation risk on each leg should be managed independently.
```

**Disclaimer:** "This tool shows funding rate differentials between exchanges. It does not constitute financial advice. Executing arbitrage strategies involves counterparty risk, execution risk, and potential for liquidation."

---

### 4.4 Cumulative Volume Delta (CVD) + Divergence Detection

**What it is:** CVD tracks the running net of taker buy volume minus taker sell volume. It reveals whether aggressive buyers or sellers are dominating. Divergences between CVD direction and price direction are powerful signals.

**Data source:** Binance taker buy/sell volume is available from:
- Real-time: `@aggTrade` WS stream (has `m` field indicating buyer is maker → seller is aggressor, or vice versa)
- Historical: `GET /fapi/v1/klines` includes `takerBuyBaseAssetVolume` per candle
- Aggregated: `GET /futures/data/takerlongshortRatio`

**Recommended approach:** Use the per-candle taker buy volume from kline data (already cached). CVD = cumulative sum of (takerBuyVolume - takerSellVolume) where takerSellVolume = totalVolume - takerBuyVolume.

**API Route:** `GET /api/market/cvd?asset=BTC&timeframe=1h&limit=200`

Response:
```typescript
{
  asset: "BTC",
  timeframe: "1h",
  series: [
    { timestamp: "...", cvd: 1250.5, price: 84520, takerBuyVol: 15200, takerSellVol: 13950 },
    // ... up to 200 data points
  ],
  divergences: [
    {
      type: "bearish",                    // Price up, CVD down
      startTimestamp: "...",
      endTimestamp: "...",
      priceChange: 2.1,                   // % change in price during divergence
      cvdChange: -850,                    // CVD moved opposite
      severity: "moderate",               // Based on magnitude and duration
    },
    {
      type: "bullish",                    // Price down, CVD up
      startTimestamp: "...",
      endTimestamp: "...",
      priceChange: -1.8,
      cvdChange: 620,
      severity: "mild",
    }
  ]
}
```

**Divergence detection algorithm:**

```typescript
function detectDivergences(series: CVDPoint[], lookback: number = 20): Divergence[] {
  const divergences: Divergence[] = [];
  
  // Sliding window approach
  for (let i = lookback; i < series.length; i++) {
    const window = series.slice(i - lookback, i);
    
    const priceChange = (window[window.length - 1].price - window[0].price) / window[0].price;
    const cvdChange = window[window.length - 1].cvd - window[0].cvd;
    
    // Bearish divergence: price went up but CVD went down
    if (priceChange > 0.005 && cvdChange < 0) { // >0.5% price rise + negative CVD
      divergences.push({
        type: "bearish",
        startTimestamp: window[0].timestamp,
        endTimestamp: window[window.length - 1].timestamp,
        priceChange: priceChange * 100,
        cvdChange,
        severity: classifySeverity(Math.abs(priceChange), Math.abs(cvdChange)),
      });
    }
    
    // Bullish divergence: price went down but CVD went up
    if (priceChange < -0.005 && cvdChange > 0) {
      divergences.push({
        type: "bullish",
        startTimestamp: window[0].timestamp,
        endTimestamp: window[window.length - 1].timestamp,
        priceChange: priceChange * 100,
        cvdChange,
        severity: classifySeverity(Math.abs(priceChange), Math.abs(cvdChange)),
      });
    }
  }
  
  // Merge overlapping divergences
  return mergeDivergences(divergences);
}
```

**Frontend:**

- CVD rendered as a line series below the main price chart (separate pane, synced x-axis)
- Divergence markers on the price chart: bearish divergence = red arrow/shading, bullish = green
- Toggle: show/hide CVD pane and divergence markers
- Divergence list panel showing active and recent divergences with severity badges

**Where it lives:** On the price chart within `/terminal/derivatives` as a toggleable overlay/pane. Add a chart toolbar with toggles for: Liquidation Heatmap, CVD, Divergences.

---

### 4.5 Alert Trigger Evaluation Engine

**What it is:** The evaluation engine that checks live data against user-configured alert conditions and fires notifications. The Alert/AlertHistory models and CRUD routes exist from Phase 0. This phase adds the brains.

**Architecture:**

Alerts are evaluated in two places:

1. **In the cron job (`refresh-metrics`):** After fetching and caching metrics for each asset, check all active alerts for that asset. This catches slow-metric alerts (funding rate, OI change, basis) with ~60s latency.

2. **In the WS event handler:** For real-time data (price, liquidations), check alerts inline as events arrive. This catches price alerts and liquidation cascades with sub-second latency.

**Implementation:**

```typescript
// lib/alerts/evaluator.ts

interface AlertEvalResult {
  triggered: boolean;
  actualValue: number;
}

function evaluateAlert(alert: Alert, currentData: MarketData): AlertEvalResult {
  let actualValue: number;
  
  switch (alert.type) {
    case "funding_rate":
      actualValue = currentData.funding.binance.rate; // Or aggregate
      break;
    case "oi_change":
      actualValue = currentData.oi.change24hPct;
      break;
    case "liquidation":
      actualValue = currentData.liquidations.totalLiquidationVolume;
      break;
    case "price":
      actualValue = currentData.price;
      break;
    case "basis":
      actualValue = currentData.basis.basisPct;
      break;
    default:
      return { triggered: false, actualValue: 0 };
  }
  
  let triggered = false;
  switch (alert.condition) {
    case "above":
      triggered = actualValue > alert.value;
      break;
    case "below":
      triggered = actualValue < alert.value;
      break;
    case "crosses_above":
      // Need previous value — store in Redis
      const prevKey = `alert:prev:${alert.id}`;
      const prev = await getCached<number>(prevKey);
      triggered = prev !== null && prev <= alert.value && actualValue > alert.value;
      await setCached(prevKey, actualValue, 86400); // 24h TTL
      break;
    case "crosses_below":
      // Similar logic
      break;
    case "change_exceeds":
      // Compare to value from N hours ago
      break;
  }
  
  return { triggered, actualValue };
}
```

**Throttling:**
- Don't fire the same alert more than once per hour (configurable per alert type)
- Store `lastTriggered` timestamp on Alert model
- Check: `if (now - alert.lastTriggered > throttleInterval) → fire`

**On trigger:**
1. Create AlertHistory record with actual value
2. Update Alert.lastTriggered and triggerCount
3. Push to in-app notification (via SSE or polling)
4. Email/Telegram delivery is Phase 8 — for now, in-app only

**In-app notification flow:**
- AlertBell component (from Phase 0) polls `/api/alerts/history?since={lastChecked}` every 30s
- New alerts show as unread badge count
- Dropdown shows recent alerts with asset, type, triggered value, time
- Click an alert → navigate to that asset's terminal view

**New alert types to add in Phase 2:**

| Type | Condition | Example |
|---|---|---|
| `cvd_divergence` | `detected` | "CVD bearish divergence detected on BTC" |
| `health_score` | `below` / `above` | "BTC health score dropped below 30" |
| `arb_yield` | `above` | "ETH funding arb yield exceeds 10% annualized" |

Add these to the Alert model's type enum and the evaluator.

---

### 4.6 Derivatives Health Composite v2

**What changes from Phase 1:**

Phase 1's health score is a simple 0-100 number with a label. Phase 2 adds:

1. **Regime classification per asset:**

| Score Range | Regime Label | Color | Description |
|---|---|---|---|
| 0–15 | `extreme_fear` | Deep red | Capitulation, heavy liquidations, negative funding |
| 15–30 | `bearish` | Red | Sustained selling pressure, negative bias |
| 30–45 | `cautious` | Orange | Mixed signals, slight bearish lean |
| 45–55 | `neutral` | Gray | No clear directional bias |
| 55–70 | `optimistic` | Light green | Positive bias, moderate long positioning |
| 70–85 | `bullish` | Green | Strong long bias, positive funding, rising OI |
| 85–100 | `euphoria` | Yellow/gold | Extreme long bias, potential overheating |

2. **Trend direction and momentum:**
- Compare current score to 24h ago and 7d ago
- "Improving" / "Deteriorating" / "Stable" label
- Rate of change (score moved +15 points in 24h → "rapidly improving")

3. **Component breakdown with sparklines:**
- Each component (funding, OI, liquidation, basis) gets a mini sparkline showing its score over 24h
- Quickly shows which component is driving the overall change

**API Route update:** Extend `/api/market/health?asset=BTC` response:

```typescript
{
  // ... existing fields ...
  regime: "bullish",
  regimeColor: "#22c55e",
  trend: {
    direction: "improving",
    change24h: 8,                  // Score change over 24h
    change7d: 15,                  // Score change over 7d
    momentum: "accelerating"       // Rate of change increasing
  },
  components: {
    funding: {
      score: 72,
      weight: 0.30,
      detail: "Positive funding, moderate long bias",
      sparkline24h: [65, 67, 68, 70, 71, 72, 72], // Hourly scores for last 24h
    },
    // ... other components with sparklines
  },
  history24h: [54, 56, 57, 58, 60, 62, 62, ...],  // Hourly composite scores
}
```

**Historical scoring:** To compute sparklines and trends, the health score must be persisted. Add to the `refresh-metrics` cron: after computing health score, write to a new table or append to an existing cache key.

New Prisma model:
```prisma
model HealthScoreSnapshot {
  id        String   @id @default(cuid())
  asset     String
  score     Float
  regime    String
  funding   Float    // Component scores
  oi        Float
  liquidation Float
  basis     Float
  timestamp DateTime
  createdAt DateTime @default(now())

  @@unique([asset, timestamp])
  @@index([asset, timestamp])
}
```

Persist hourly. Keep 30 days of history (720 rows per asset = 7,200 total — trivial).

---

### 4.7 Screener Enhancements

**What changes:**

Add new columns and features to the existing screener table:

**New columns:**
- `regime` — regime label with colored badge (from health score v2)
- `fundingZScore` — z-score of current funding rate (already computed)
- `oiChange4h` — OI % change over last 4 hours (shorter term than 24h)
- `liq24hUsd` — total liquidation volume (already exists, ensure it's prominent)
- `cvdTrend` — "bullish" / "bearish" / "neutral" based on recent CVD direction
- `arbYield` — best available arb yield for this asset (from arb scanner)

**Filtering:**
- Filter by regime: show only "bullish" assets, or "extreme_fear", etc.
- Filter by funding z-score range (e.g., show only assets with z-score > 2 or < -2)
- Filter by minimum arb yield

**Sorting:**
All columns should be sortable. Default sort: health score descending.

**Regime color coding:**
Each row background gets a subtle tint based on its regime (very subtle — don't make it look like a Christmas tree).

**API Route update:** Extend `/api/market/screener` to include new fields per asset.

---

### 4.8 Historical Charts Within Tabs

**What it is:** Each metric tab (Funding, OI, Basis) should show a historical chart alongside the current values. This uses the data accumulating in PostgreSQL from Phase 1.

**Funding tab:**
- Chart: funding rate over last 30 days (from FundingRateSnapshot table)
- Binance and Bybit as separate lines
- Highlight the zero line
- Z-score bands overlay (±1σ, ±2σ)

**OI tab:**
- Chart: OI over last 7 days (from OISnapshot table)
- Both exchanges
- Overlay price on secondary axis to show OI-price correlation

**Liquidation tab:**
- Chart: daily liquidation volumes over last 30 days (aggregated from LiquidationEvent table)
- Stacked bar: long liquidations (red) and short liquidations (green) per day

**API Routes:**

```
GET /api/market/history/funding?asset=BTC&days=30
GET /api/market/history/oi?asset=BTC&days=7
GET /api/market/history/liquidations?asset=BTC&days=30
```

These query PostgreSQL directly (not Upstash — this is historical, not real-time). Cache with long TTL (5min) since historical data changes slowly.

---

## 5. New Database Models

Add to `prisma/schema.prisma`:

```prisma
model HealthScoreSnapshot {
  id          String   @id @default(cuid())
  asset       String
  score       Float
  regime      String
  funding     Float
  oi          Float
  liquidation Float
  basis       Float
  timestamp   DateTime

  createdAt   DateTime @default(now())

  @@unique([asset, timestamp])
  @@index([asset, timestamp])
}
```

This is the only new model. All other historical data uses models from Phase 1 (FundingRateSnapshot, OISnapshot, LiquidationEvent, CandleHistory).

---

## 6. New & Modified API Routes

### New Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/market/liquidation-heatmap` | GET | Predicted liquidation levels |
| `/api/market/compare` | GET | Cross-exchange comparison |
| `/api/market/cvd` | GET | CVD series + divergences |
| `/api/market/history/funding` | GET | Historical funding from PostgreSQL |
| `/api/market/history/oi` | GET | Historical OI from PostgreSQL |
| `/api/market/history/liquidations` | GET | Historical liquidation aggregates |
| `/api/tools/arb-scanner` | GET | Arbitrage opportunities |

### Modified Routes

| Route | Change |
|---|---|
| `/api/market/health` | Add regime, trend, component sparklines |
| `/api/market/screener` | Add regime tag, cvdTrend, arbYield columns |
| `/api/cron/refresh-metrics` | Add alert evaluation + health score persistence |

---

## 7. New File Structure

```
# New files

lib/
  alerts/
    evaluator.ts                      # Alert condition evaluation engine
    throttle.ts                       # Alert throttling logic
  analytics/
    liquidation-heatmap.ts            # Heatmap computation model
    cvd.ts                            # CVD computation + divergence detection
    arb-scanner.ts                    # Funding/basis arb opportunity finder
    regime.ts                         # Regime classification logic
    math.ts                           # Shared math utilities (gaussianPDF, zScore, etc.)

app/api/market/
  liquidation-heatmap/route.ts
  compare/route.ts
  cvd/route.ts
  history/
    funding/route.ts
    oi/route.ts
    liquidations/route.ts

app/api/tools/
  arb-scanner/route.ts

app/(app)/tools/
  arb-scanner/page.tsx                # Replace Coming Soon with real page

components/terminal/
  LiquidationHeatmap.tsx              # Heatmap overlay for price chart
  CVDPane.tsx                         # CVD chart pane below price chart
  DivergenceMarkers.tsx               # Divergence arrows/shading on price chart
  ChartToolbar.tsx                    # Toggle bar: heatmap, CVD, divergences
  CrossExchangeTab.tsx                # Cross-exchange comparison tab content
  HistoricalFundingChart.tsx          # 30d funding rate chart
  HistoricalOIChart.tsx               # 7d OI chart
  HistoricalLiquidationsChart.tsx     # 30d liquidation bar chart
  RegimeBadge.tsx                     # Colored regime label component
  HealthScoreTrend.tsx                # Health score with trend arrow + sparkline

components/tools/
  ArbScannerTable.tsx                 # Arb opportunity table
  ArbDetailPanel.tsx                  # Expanded arb detail with historical spread chart
  PositionCalculator.tsx              # Position sizing calculator

hooks/
  useCVDData.ts
  useLiquidationHeatmap.ts
  useArbScanner.ts
  useCrossExchange.ts
  useHistoricalFunding.ts
  useHistoricalOI.ts
  useHistoricalLiquidations.ts
  useAlertNotifications.ts            # Polls for new alert triggers

config/
  healthScore.ts                      # Weights, thresholds, regime labels (extend if exists)
  alertTypes.ts                       # Alert type definitions + new Phase 2 types
```

---

## 8. Navigation Updates

In `config/navigation.ts`:

```typescript
// Update Arb Scanner to enabled
{
  label: "Arb Scanner",
  path: "/tools/arb-scanner",
  icon: "ArrowLeftRight",
  enabled: true,  // ← flip from false to true
  description: "...",
  phase: 2,
}
```

Add "Cross-Exchange" as a new tab in the derivatives terminal tab configuration (wherever tabs are defined — likely in the derivatives page component or a config).

Add chart toolbar toggles for Liquidation Heatmap, CVD Pane, and Divergence Markers.

---

## 9. Implementation Order

1. **Math utilities** — `lib/analytics/math.ts` (gaussianPDF, zScore, etc.)
2. **Health score v2 + regime** — extend health API, add HealthScoreSnapshot model + persistence, regime classification
3. **Historical data API routes** — funding/OI/liquidation history from PostgreSQL
4. **Historical charts in tabs** — wire frontend components to history APIs
5. **CVD computation + divergence** — API route, detection algorithm, frontend pane + markers
6. **Liquidation heatmap** — computation model, API route, chart overlay
7. **Cross-exchange comparison** — API route, new tab, frontend layout
8. **Arb scanner** — computation, API route, frontend page (replace Coming Soon)
9. **Alert evaluation engine** — evaluator, throttling, wire into cron + WS, notification polling
10. **Screener enhancements** — add new columns, filtering, regime tags

---

## 10. Definition of Done

- [ ] Liquidation heatmap rendering as overlay on price chart with predicted levels
- [ ] Cross-exchange tab showing Binance vs Bybit comparison with spread analysis
- [ ] Arb scanner at `/tools/arb-scanner` showing live opportunities sorted by yield
- [ ] CVD pane below price chart with line series
- [ ] CVD divergence markers on price chart (bearish = red, bullish = green)
- [ ] Chart toolbar with toggles for heatmap, CVD, divergences
- [ ] Alert evaluation engine firing for all alert types (funding, OI, price, basis, liquidation)
- [ ] New alert types working: cvd_divergence, health_score, arb_yield
- [ ] AlertBell showing unread count, dropdown listing recent triggered alerts
- [ ] Health score v2: regime classification, trend direction, component sparklines
- [ ] Screener: regime column, CVD trend, arb yield, filtering by regime
- [ ] Historical funding chart (30d) in funding tab
- [ ] Historical OI chart (7d) in OI tab
- [ ] Historical liquidation bar chart (30d) in liquidation tab
- [ ] HealthScoreSnapshot model persisting hourly data
- [ ] Position calculator in arb scanner detail panel
- [ ] All new API routes returning valid data from live sources
- [ ] Disclaimer text on liquidation heatmap and arb scanner
- [ ] Zero TypeScript errors, build passes

---

## 11. What This Enables

Phase 2 transforms the terminal from a data display into an analysis tool. Specifically:

- **Phase 3 (Options):** The CVD and regime classification infrastructure provides the framework for adding options microstructure data (GEX, skew) as additional inputs. The chart toolbar pattern extends to options overlays.
- **Phase 4 (Options Microstructure):** The "Cross-Exchange" comparison pattern extends naturally to a "Cross-Domain" view when options data arrives.
- **Phase 5 (On-Chain):** The regime classifier can ingest on-chain signals as additional features. The alert evaluation engine extends to on-chain alert types.
- **Phase 6 (Regime & Convergence):** Phase 2's derivatives-only regime classification is the foundation. Phase 6 enriches it with options, on-chain, and sentiment inputs and adds the convergence scoring engine.
- **Quant Engine (Phase 3+):** The liquidation heatmap model and CVD divergence algorithm are candidates for the quant partner to validate and potentially improve with more sophisticated models (e.g., order flow imbalance, Bayesian entry estimation).

---

*This PRD should be treated as the authoritative specification. Claude Code should present an implementation plan with architecture decision questions before beginning work.*
