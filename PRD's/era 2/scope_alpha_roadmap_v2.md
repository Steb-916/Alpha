# Scope Alpha — Rebuild Roadmap v2
## Crypto Analytics & Quantitative Intelligence Platform
### April 2026

---

## What Changed From v1

- **Monetization deferred.** Stripe, tiers, and paywalls are pushed to late-stage. Build something worth paying for first.
- **Synthesis layer is the product.** Every phase now includes cross-domain derived metrics — not just raw data display. The platform computes what no single-source tool can.
- **Quantitative tools are first-class features.** RND, GEX, VRP, volatility cone, regime classification, convergence scoring — these are the differentiators, not add-ons.
- **Parallel workstreams.** Engineering (you + Claude Code) and Quantitative Development (data science partner) run simultaneously. The quant layer is developed, validated, and documented in Python before integration.
- **No half-measures.** Each phase ships a complete, functional vertical. If a metric isn't validated, it doesn't ship.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  VERCEL (Frontend)                    │
│  Next.js 14 / React 18 / TypeScript / Tailwind       │
│  Lightweight Charts / Zustand / SSE consumers         │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
┌─────────▼──────────┐   ┌─────────▼──────────┐
│  MARKET DATA SVC   │   │   QUANT ENGINE      │
│  (Railway/Fly.io)  │   │   (Railway/Fly.io)  │
│                    │   │                      │
│  WebSocket mgr     │   │  FastAPI (Python)    │
│  Exchange adapters │   │  RND computation     │
│  SSE broadcaster   │   │  GEX/Greeks engine   │
│  Redis cache       │   │  Vol surface fitting │
│  Historical persist│   │  Regime classifier   │
│                    │   │  Convergence scorer  │
│  Binance, Bybit,   │   │  VRP calculator      │
│  Deribit, OKX      │   │  Arb calculators     │
└────────┬───────────┘   └──────────┬───────────┘
         │                          │
         └──────────┬───────────────┘
                    │
         ┌──────────▼───────────┐
         │   NEON PostgreSQL    │
         │   + Upstash Redis    │
         │                      │
         │  Historical candles  │
         │  Funding snapshots   │
         │  OI snapshots        │
         │  Options chains      │
         │  On-chain metrics    │
         │  Computed metrics    │
         │  User data / alerts  │
         └──────────────────────┘
```

**Two long-running services** deployed on Railway or Fly.io:
1. **Market Data Service** — WebSocket connections, exchange adapters, caching, SSE broadcast
2. **Quant Engine** — Python FastAPI service that receives raw data and returns computed metrics (RND, GEX, vol surface, regime scores, etc.)

The Quant Engine is the data science partner's domain. They build, validate, and maintain it. You wire it into the frontend and data pipeline.

---

## Parallel Workstreams

### Engineering Track (You + Claude Code)
Phases 0–8 below. Frontend, data pipelines, infrastructure, UX, integration.

### Quantitative Track (Data Science Partner)
Runs in parallel from day one. Each module is developed in Python, validated against historical data in Jupyter notebooks, documented with methodology, then deployed as an endpoint in the Quant Engine FastAPI service.

**Quant Module Delivery Schedule:**

| Module | Delivers Before | Inputs | Outputs |
|---|---|---|---|
| Data cleaning / validation library | Phase 1 | Raw exchange API data | Clean, normalized data |
| Funding rate arb calculator | Phase 2 | Cross-exchange funding rates | Net yield estimates, pair rankings |
| Basis trade monitor | Phase 2 | Spot + futures prices across expirations | Annualized basis, historical percentile |
| CVD divergence detector | Phase 2 | Taker buy/sell volume streams | Divergence signals, CVD charts |
| Vol surface fitting (SVI or cubic spline) | Phase 3 | Options chain (strikes, IVs, expiries) | Fitted IV surface |
| RND engine | Phase 3 | Fitted vol surface + spot price | Probability density curve |
| Volatility cone | Phase 3 | Historical price data (multiple windows) | Realized vol percentiles + current IV overlay |
| VRP calculator | Phase 3 | Realized vol + implied vol time series | VRP spread, historical percentile |
| GEX / DEX computation | Phase 4 | Options chain + taker flow data | Gamma/delta exposure by strike |
| Gamma flip detection | Phase 4 | GEX output | Flip price level, regime label |
| Vanna / Charm exposure | Phase 4 | Options chain + Greeks | Exposure maps by strike |
| Max pain + pin risk | Phase 4 | Options OI by strike | Max pain level, pin probability |
| MVRV z-score | Phase 5 | On-chain realized cap + market cap | Z-score, regime bands |
| SOPR | Phase 5 | On-chain spent outputs | Profit/loss ratio, regime signals |
| NVT ratio | Phase 5 | Market cap + on-chain tx volume | Valuation signal |
| Regime classifier | Phase 6 | Multi-domain feature vector | Regime label + confidence |
| Convergence scorer | Phase 6 | All domain signals | Composite score + breakdown |
| Dispersion analysis | Phase 7 | BTC + altcoin IV / correlation | Dispersion metric, rotation signals |

**Deliverable format for each module:**
1. Jupyter notebook with historical validation and edge case testing
2. Methodology document (math, assumptions, limitations, known failure modes)
3. Clean Python function/class with typed inputs/outputs
4. FastAPI endpoint wrapper
5. Test suite with known-good inputs/outputs

---

## Phase 0 — Strip & Restructure
**Goal:** Remove all marketplace/signals code. Rebuild the app shell as an analytics platform.

**Duration:** 1 week

### Engineering Scope

**Remove:**
- All signal-related models, pages, components, API routes
- Analyst marketplace, profiles, performance tracking
- Per-analyst subscriptions, tiers, reviews, ratings
- Chat system, announcements
- Demo mode seed data
- Annotation system (analyst-owned)

**Database migration:**
- Drop: AnalystProfile, AnalystPerformance, Signal, Annotation, SubscriptionTier, Subscription, ChatMessage, Announcement, Review
- Simplify User model: auth fields only (name, email, password, avatar, provider)
- Add: UserPreferences model (saved layouts, watchlists, alert configs)
- Add: Alert model (type, conditions JSON, isActive, lastTriggered)

**New information architecture:**
```
/                           → Landing page (value prop, no pricing yet)
/terminal                   → Main app shell
  /terminal/derivatives     → Funding, OI, liquidations, basis, screener
  /terminal/volatility      → Vol surface, RND, skew, cone, VRP, GEX
  /terminal/onchain         → Exchange flows, supply metrics, whale tracking
  /terminal/macro           → Correlations, ETF flows, regime dashboard
  /terminal/sentiment       → Fear/greed, social, sector rotation
/tools                      → Quantitative tools
  /tools/arb-scanner        → Funding arb, basis trade, cross-exchange
  /tools/screener           → Custom multi-factor screener
  /tools/backtest           → Strategy backtesting
/settings                   → Account, watchlists, alert config
```

**Navigation:**
- Left sidebar with section icons
- Top bar: global asset selector, timeframe, search
- Sections not yet built show "Coming Soon" with description
- Dark theme by default (trading terminal standard)

### Quant Partner Scope (Parallel)
- Set up Python project structure and development environment
- Pull historical data from Deribit REST API (options chains, BTC + ETH)
- Pull historical funding rates from Binance + Bybit
- Pull historical OHLCV data for backtesting
- Begin building the data cleaning/validation library
- Explore data quality issues: missing strikes, stale quotes, crossed markets

### Definition of Done
- All old code removed, zero references to signals/marketplace/analysts
- New nav structure rendering
- Existing derivatives terminal UI functional under new routing
- Clean database schema
- Quant partner has historical datasets loaded and cleaning library started

---

## Phase 1 — Live Derivatives Data
**Goal:** Replace all mock data with real-time exchange data. This is the foundation everything depends on.

**Duration:** 2–3 weeks

### Engineering Scope

**Market Data Service (Railway/Fly.io):**
- Long-running Node.js process
- WebSocket adapters for:
  - **Binance:** perp price, funding rates, OI, mark price, liquidation stream, spot price
  - **Bybit:** same data set
- REST fallback for initial load and reconnection
- Redis caching layer (Upstash):
  - Current funding rates (TTL: 60s)
  - OI snapshots (TTL: 60s)
  - OHLCV candles by timeframe (TTL: varies)
  - 24h liquidation aggregates (TTL: 30s)
- SSE endpoint for Vercel frontend
- Health check and auto-reconnect logic

**Assets at launch:** BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, ARB (top 10 by perp OI)

**Historical data persistence:**
- PostgreSQL tables: funding_rate_snapshots, oi_snapshots, liquidation_events, ohlcv_candles
- Background jobs: persist funding every 8h, OI every hour, liquidations as they occur, candles on close
- This data accumulates over time and feeds the quant engine for backtesting

**Frontend wiring:**
- Replace all mock data hooks with SSE/REST consumers
- Live price charts (Lightweight Charts, real-time candle updates)
- Funding rate dashboard: current, 8h avg, annualized, z-score, Binance vs Bybit comparison
- OI tracker: aggregate, per-exchange breakdown, net change
- Liquidation monitor: real-time feed, 24h aggregates, exchange heatmap
- Basis analyzer: perp premium/discount, annualized basis rate

### Quant Partner Scope (Parallel)
- Complete data cleaning/validation library
- Build funding rate arbitrage calculator prototype:
  - Input: real-time funding rates from N exchanges
  - Output: ranked pairs by net annualized yield after fees
  - Historical backtest of strategy returns
- Build basis trade monitor prototype:
  - Track spot vs futures across expirations
  - Annualize basis, compute historical percentile
- Begin CVD (Cumulative Volume Delta) divergence detection module

### Definition of Done
- Live data flowing from Binance + Bybit for all 10 assets
- Real-time price charts, funding, OI, liquidations, basis — zero mock data
- Historical data accumulating in PostgreSQL
- Market Data Service stable with auto-reconnect
- Quant partner has validated arb calculator and basis monitor prototypes

---

## Phase 2 — Derivatives Intelligence Layer
**Goal:** Go beyond raw data display. Build the derived analytics and synthesis features on top of live derivatives data that make this more than a Coinglass clone.

**Duration:** 2–3 weeks

### Engineering Scope

**Liquidation heatmap:**
- Estimate liquidation clusters from OI distribution and leverage estimates
- Render as heatmap overlay on price chart
- Show where cascading liquidations would trigger at different price levels

**Multi-asset screener (live):**
- Sortable/filterable table for all supported assets
- Columns: price, 24h%, funding rate, funding z-score, OI, OI change%, liq volume (24h), basis%, volume
- Sparklines for funding and OI trends
- Click-through to individual asset view

**Cross-exchange deep dive per asset:**
- Side-by-side: Binance vs Bybit
- Funding rate differential, OI split, liquidation comparison, basis differential
- Highlight exchange-specific dislocations

**Integrate quant modules (from partner):**

*Funding Rate Arbitrage Scanner:*
- Dedicated /tools/arb-scanner page
- Live cross-exchange funding rate comparison
- Calculated net yield after fees for each pair
- Historical yield chart per pair
- Position sizing calculator (input capital → projected yield)

*Basis Trade Monitor:*
- Current annualized basis across spot/perp and spot/dated futures
- Historical percentile (is current basis high or low vs history?)
- Alert when basis exceeds N standard deviations

*CVD Divergence:*
- CVD line on price chart
- Automatic divergence detection (price rising + CVD falling = bearish divergence)
- Visual markers on chart when divergences occur

**Alerts system (v1):**
- User-configurable alerts: funding threshold, OI change %, liquidation cascade, basis threshold, CVD divergence
- In-app notification bell
- Stored in database for history

### Synthesis Features (the differentiators):
- **Derivatives Health Composite:** weighted score combining funding extremity, OI leverage ratio, liquidation proximity, basis abnormality — single number per asset summarizing derivatives risk
- **Regime tag per asset:** based on derivatives data only at this stage (trending/ranging/volatile/compressed) — will be enriched with more data in later phases

### Quant Partner Scope (Parallel)
- Begin options analytics work:
  - Pull Deribit options chain data (BTC, ETH) via REST polling
  - Implement vol surface fitting (evaluate SVI parameterization vs cubic spline)
  - Implement RND engine (Breeden-Litzenberger)
  - Validate against known distributions and edge cases
- Begin volatility cone computation
- Begin VRP (Volatility Risk Premium) calculator
- Document methodology for all Phase 1–2 quant modules

### Definition of Done
- Liquidation heatmap rendering on chart
- Screener with live data, sorting, filtering
- Cross-exchange comparison views
- Arb scanner, basis monitor, CVD divergence — all integrated and live
- Derivatives health composite score displaying per asset
- Alert system creating and firing in-app notifications
- Quant partner has validated vol surface + RND prototypes

---

## Phase 3 — Options & Volatility Analytics
**Goal:** Build the volatility analytics suite. This is the single biggest differentiator — these tools don't exist accessibly for crypto.

**Duration:** 3–4 weeks

### Engineering Scope

**Options data pipeline:**
- Add Deribit to Market Data Service:
  - REST polling every 5 minutes for full options chain (BTC, ETH)
  - Strikes, expirations, bid/ask IV, volume, OI, mark price
  - Order flow / taker data where available
- Normalize and cache in Redis
- Persist historical snapshots in PostgreSQL (options_chain_snapshots table)
- Pipeline sends raw chain data to Quant Engine for computation

**Quant Engine integration:**
- Deploy FastAPI service (quant partner's Python modules) on Railway/Fly.io
- API contract: POST raw options chain → GET computed metrics
- Endpoints:
  - /vol-surface → fitted IV surface data
  - /rnd → probability density for given expiration
  - /vol-cone → realized vol percentiles + current IV
  - /vrp → volatility risk premium spread
  - /skew → delta skew across expirations
  - /term-structure → IV term structure at fixed deltas

**Frontend — /terminal/volatility section:**

1. **Implied Volatility Surface**
   - Interactive 3D visualization: strike × expiry × IV
   - Hover for exact values, rotate/zoom
   - Toggle between absolute strike and delta space
   - Historical comparison (current vs N days ago)

2. **Risk-Neutral Density (RND)**
   - Probability distribution curve per expiration
   - Dropdown to select expiration
   - Overlay: current spot price, key support/resistance levels
   - Show implied probability of reaching user-specified price targets
   - "What does the market think?" — plain English summary of the distribution

3. **Volatility Skew**
   - 25-delta risk reversal across expirations
   - Historical skew chart (current vs 30d avg vs 90d avg)
   - Skew term structure (near-term vs long-term)
   - Plain English interpretation: "Market is paying X% more for downside protection than upside"

4. **IV Term Structure**
   - ATM IV across expirations (7d, 30d, 60d, 90d, 180d)
   - Historical overlay
   - Contango/backwardation label
   - Alert on term structure inversion

5. **Volatility Cone**
   - Realized vol percentiles across lookback windows
   - Current ATM IV overlaid
   - Clear visual: "Current implied vol is at the Xth percentile of historical realized vol"
   - Interpretation: "Options are cheap/expensive relative to what actually happens"

6. **Volatility Risk Premium (VRP)**
   - Rolling spread: implied vol minus subsequent realized vol
   - Historical VRP chart
   - Current VRP percentile
   - Interpretation: "The vol premium is wide/narrow — selling options is favorable/unfavorable"

### Synthesis Features:
- **Vol surface + derivatives overlay:** when vol surface shows elevated put skew AND funding is extremely positive AND OI is at highs → flag as "high risk of correction" via the convergence framework
- **RND vs on-chain comparison (preview):** if RND shows 10% implied probability of hitting $X, but that level is where massive on-chain supply sits — surface this as a note (full on-chain integration in Phase 5)

### Quant Partner Scope (Parallel)
- Deploy Quant Engine FastAPI service
- Finalize and deploy all vol/options modules to production
- Begin GEX (Gamma Exposure) computation module:
  - Adapt methodology for crypto (taker-flow-based, not equity-style assumptions)
  - Build gamma flip detection
  - Build delta exposure (DEX) computation
  - Build vanna and charm exposure maps
- Begin max pain and pin risk calculator
- Prototype options flow anomaly detection (unusual volume/OI spikes)
- Begin pulling on-chain data and evaluating data sources for Phase 5

### Definition of Done
- Live options data from Deribit for BTC and ETH
- Quant Engine deployed and serving computed metrics
- All 6 volatility tools rendering with real data
- RND generating valid probability distributions
- Vol cone showing accurate realized vs implied comparison
- VRP chart with historical context
- Historical options data accumulating

---

## Phase 4 — Options Microstructure (Greeks Exposure)
**Goal:** Add the dealer positioning tools that give institutional-grade insight into how options market structure affects price.

**Duration:** 2–3 weeks

### Engineering Scope

**Frontend — additions to /terminal/volatility:**

7. **Gamma Exposure (GEX) by Strike**
   - Bar chart: net gamma exposure per strike price
   - Green = positive gamma (stabilizing), Red = negative gamma (amplifying)
   - Spot price marker overlaid
   - Gamma flip level clearly marked
   - Regime label: "Dealers are net long/short gamma — expect dampened/amplified moves"

8. **GEX Heatmap Over Time**
   - 2D heatmap: time × strike, colored by gamma exposure intensity
   - Shows how dealer positioning evolves day-over-day
   - Spot price line overlaid
   - Regime transitions visible as color shifts

9. **Delta Exposure (DEX) by Strike**
   - Net directional pressure from options positioning
   - Identifies strikes with most directional hedging pressure

10. **Vanna & Charm Exposure**
    - How changes in IV (vanna) and time decay (charm) force dealer repositioning
    - Explains drift into expiration and vol-driven moves

11. **Max Pain & Pin Risk**
    - Max pain level per expiration
    - Pin risk probability near high-OI strikes approaching expiry
    - Overlay on price chart

12. **Options Flow Scanner**
    - Large/unusual trades flagged
    - Premium spent on calls vs puts (net premium flow)
    - Historical flow chart

### Synthesis Features:
- **GEX + Liquidation Overlay:** show gamma exposure map overlaid with predicted liquidation levels on the same price chart. When negative gamma zones overlap with dense liquidation clusters, flag as "cascade risk zone" — this insight only exists because you have both derivatives and options data
- **Regime classification enrichment:** add options microstructure signals to the regime classifier (gamma regime, skew regime, term structure shape)

### Quant Partner Scope (Parallel)
- Deploy GEX, DEX, vanna, charm modules to Quant Engine
- Validate GEX against known market episodes (liquidation cascades, expiry pinning)
- Begin on-chain valuation models:
  - MVRV z-score implementation
  - SOPR (Spent Output Profit Ratio)
  - NVT ratio
  - Exchange flow analysis (net inflow/outflow)
  - Supply in profit/loss
- Evaluate on-chain data sources (Glassnode API vs CryptoQuant vs public blockchain)
- Begin regime classifier design:
  - Define feature vector (derivatives signals + vol signals + options microstructure)
  - Evaluate model approaches (HMM, k-means clustering, random forest)
  - Build prototype on historical data

### Definition of Done
- GEX rendering with real options data, gamma flip clearly marked
- GEX heatmap showing historical evolution
- DEX, vanna, charm exposure maps functional
- Max pain and options flow scanner live
- GEX + liquidation cascade risk zones overlaid on chart
- Quant partner has validated on-chain models and regime classifier prototype

---

## Phase 5 — On-Chain Analytics
**Goal:** Add blockchain-level data. Focus on metrics that directly inform trading decisions — not vanity metrics.

**Duration:** 3–4 weeks

### Engineering Scope

**On-chain data pipeline:**
- Evaluate and integrate data source (Glassnode API recommended for depth; CryptoQuant as alternative)
- If budget is a constraint: start with free tiers + public blockchain APIs for basic metrics, upgrade later
- Ingest and cache in Redis, persist historical in PostgreSQL
- Feed raw on-chain data to Quant Engine for derived metrics

**Frontend — /terminal/onchain section:**

1. **Exchange Flows Dashboard**
   - BTC, ETH, USDT, USDC net flows to/from major exchanges
   - Historical flow chart (30d, 90d)
   - Exchange reserve totals and trend
   - Large deposit/withdrawal alerts
   - Overlay exchange flows on price chart

2. **Supply Dynamics**
   - MVRV z-score with historical bands (overbought/oversold zones)
   - Supply in profit vs loss (%)
   - SOPR (spent output profit ratio) — profit-taking vs capitulation signal
   - HODL waves / coin age distribution (if data source supports)

3. **Network Health**
   - Active addresses, transaction count
   - NVT ratio (Network Value to Transactions — crypto P/E)
   - Hash rate (BTC) / staking metrics (ETH)
   - Fee revenue trends

4. **Stablecoin Flows**
   - Total stablecoin market cap trend
   - Mint/burn events
   - Stablecoin exchange inflows (buying power proxy)

5. **Whale Monitor**
   - Large transaction feed (>$1M equivalent)
   - Exchange deposit alerts from known large wallets
   - Accumulation/distribution scoring

### Synthesis Features (this is where it gets powerful):
- **Cross-domain divergence detection:**
  - Price rising + exchange inflows spiking + SOPR > 1 = distribution happening under the surface
  - Price falling + exchange outflows + MVRV < 1 = accumulation happening under capitulation
  - Funding extremely positive + exchange inflows rising = leveraged longs about to get hit by whale selling
  - Surface these as automatic "Insight" cards in the UI

- **On-chain + RND comparison:**
  - "Options market implies 15% probability of BTC below $80K by June expiry"
  - "On-chain: 2.3M BTC sits at a cost basis between $78K–$82K (strong realized support)"
  - Let the user see both perspectives — probabilistic (options) and structural (on-chain)

- **Derivatives Health Composite v2:** now includes on-chain signals alongside derivatives. More dimensions = more signal

### Quant Partner Scope (Parallel)
- Deploy MVRV, SOPR, NVT, exchange flow analysis modules to Quant Engine
- Validate on-chain signals against historical price episodes
- Continue regime classifier development — add on-chain features to the model
- Begin convergence scoring system design:
  - Define signal taxonomy: derivatives signals, options signals, on-chain signals
  - Define agreement/disagreement logic
  - Build composite scoring with confidence weighting
  - Backtest: does high convergence predict forward returns better than individual signals?
- Begin dispersion analysis module (BTC vs altcoin implied vol correlation)

### Definition of Done
- On-chain data flowing and displaying for BTC and ETH
- MVRV, SOPR, NVT charting with historical context
- Exchange flows with large transaction alerts
- Stablecoin flow tracking
- Cross-domain divergence insights generating automatically
- On-chain overlays on price chart
- Quant partner has convergence scorer prototype validated

---

## Phase 6 — Regime Classification & Convergence Engine
**Goal:** Deploy the synthesis layer that is the core product differentiator. This is what makes Scope Alpha more than the sum of its data sources.

**Duration:** 2–3 weeks

### Engineering Scope

**Regime Classification Dashboard:**
- Per-asset regime label: risk-on trending, risk-off trending, range-bound accumulation, range-bound distribution, volatile/unstable, compressed (pre-breakout)
- Regime determined by multi-domain feature vector:
  - Derivatives: funding rate trend, OI trend, liquidation pressure, leverage ratio
  - Volatility: realized vol regime, IV percentile, term structure shape, gamma regime
  - On-chain: exchange flow direction, MVRV zone, SOPR trend, whale behavior
- Confidence score for each classification
- Historical regime timeline (color-coded bar showing regime over past 90d)
- "What happened historically in similar regimes?" — forward return distribution from backtesting
- Per-asset regime dashboard + overview showing all assets color-coded

**Convergence Scoring Engine:**
- Dashboard showing agreement/disagreement across data domains
- Domains scored independently:
  - Derivatives sentiment (bullish/bearish/neutral based on funding, OI, long/short)
  - Options positioning (bullish/bearish/neutral based on skew, flow, GEX)
  - On-chain behavior (accumulation/distribution/neutral based on flows, MVRV, SOPR)
  - (Sentiment domain added in Phase 7)
- Composite convergence score: how many domains agree?
- Visual: 3-panel (later 4-panel) indicator showing each domain's lean
- Historical convergence vs forward returns (does high convergence predict?)
- Alert when convergence score crosses threshold (all domains agree = high conviction signal)

**"Why Is Price Moving?" Engine:**
- When price moves >3% in an hour, automatically check all data domains
- Surface which domains showed abnormal activity first:
  - Was it a liquidation cascade? (check liquidation volume spike)
  - Whale dump? (check exchange inflows)
  - Options dealer hedging? (check GEX regime change)
  - Macro correlation? (check DXY, SPX moves)
- Display as an "Insight" card: "BTC dropped 4.2% in the last hour. Primary driver: liquidation cascade ($230M in long liquidations). Secondary: exchange inflows spiked 45 minutes prior."

**Contextual metric emphasis:**
- Based on current regime, highlight the metrics most predictive in that regime
- Trending regime → emphasize funding, OI momentum, CVD
- Range-bound → emphasize on-chain accumulation, options positioning, vol cone
- Volatile → emphasize liquidation levels, GEX, stablecoin inflows

### Quant Partner Scope (Parallel)
- Deploy regime classifier and convergence scorer to Quant Engine
- Ongoing model calibration with accumulating live data
- Begin sentiment data exploration (Alternative.me Fear & Greed, social APIs)
- Begin macro correlation analysis (BTC vs SPX, DXY, gold, yields)
- Build dispersion analysis module (BTC-altcoin correlation via IV)
- Document all methodology for the synthesis layer

### Definition of Done
- Regime labels displaying per asset with confidence scores
- Regime timeline showing historical classification
- Convergence score dashboard with domain-level breakdown
- "Why is price moving?" engine generating real-time explanations
- Contextual metric emphasis adapting UI based on regime
- All synthesis features backed by validated quant models

---

## Phase 7 — Sentiment & Macro Dashboard
**Goal:** Add the final data domains: social sentiment and macro context. These complete the convergence framework.

**Duration:** 2–3 weeks

### Engineering Scope

**Sentiment — /terminal/sentiment:**
- Fear & Greed Index integration (Alternative.me API — free)
- Social volume tracking (LunarCrush API or similar) for top assets
- Funding rate sentiment composite (derived from own data — already built)
- Historical sentiment chart with price overlay
- Sector sentiment comparison (if data available): L1s vs DeFi vs memecoins

**Macro — /terminal/macro:**
- BTC correlation dashboard:
  - Rolling 30d/90d correlation: BTC vs S&P 500, NASDAQ, DXY, gold, 10Y yields
  - Interactive correlation matrix heatmap
  - Correlation regime indicator (high/low/negative)
- ETF flow tracking:
  - BTC and ETH spot ETF daily inflows/outflows
  - Cumulative flow chart
- Stablecoin supply as macro liquidity proxy (already built, surface here)
- Token unlock calendar:
  - Major upcoming vesting events
  - Dilution impact estimates
  - Calendar + table view

**Convergence scorer v2:**
- Add sentiment domain to the convergence framework (now 4 domains)
- Add macro alignment as a contextual modifier
- Full 4-panel convergence dashboard: derivatives + options + on-chain + sentiment

**Dispersion analysis (from quant partner):**
- BTC vs altcoin implied volatility correlation
- When dispersion is high (BTC stable, altcoins volatile): sector rotation happening
- When dispersion is low (everything correlated): macro-driven, fear/greed regime
- Display as standalone chart + integrate into regime classifier

### Quant Partner Scope (Parallel)
- Deploy sentiment integration and macro correlation modules
- Deploy dispersion analysis module
- Update regime classifier with sentiment + macro features (now full feature set)
- Update convergence scorer to 4 domains
- Comprehensive backtesting of full regime classifier across 2+ years of data
- Validate convergence score predictive power with full domain coverage
- Begin designing custom screener logic (multi-factor filtering across all domains)

### Definition of Done
- Sentiment dashboard with Fear & Greed, social volume
- Macro correlation matrix and ETF flow tracking
- Token unlock calendar
- Convergence score now includes all 4 data domains
- Dispersion analysis charting
- Regime classifier running on full feature set
- Everything overlayable on price charts where relevant

---

## Phase 8 — Quantitative Tools
**Goal:** Screener, backtesting, and the utility tools that make power users sticky.

**Duration:** 3–4 weeks

### Engineering Scope

**Custom Screener — /tools/screener:**
- Visual filter builder (no code required):
  - Price/volume filters
  - Derivatives: funding rate range, OI change%, liquidation volume, basis
  - Options: IV percentile, skew direction, GEX regime, VRP level
  - On-chain: MVRV zone, exchange flow direction, whale activity, SOPR
  - Sentiment: fear/greed range, social volume spike
  - Regime: filter by current regime classification
  - Convergence: filter by convergence score threshold
- Save/load custom screener presets
- Real-time updating results table
- Export as CSV

**Backtesting Engine (v1) — /tools/backtest:**
- Visual strategy definition (no code):
  - Entry conditions: combine any available metric (e.g., "funding rate < -0.03% AND MVRV z-score < 0 AND convergence score > 3")
  - Exit conditions: metric-based + take-profit/stop-loss %
  - Position sizing: fixed or adjustable
- Run against accumulated historical data
- Results dashboard:
  - Equity curve
  - Win rate, profit factor, max drawdown, Sharpe, Sortino
  - Trade log with entry/exit details and which conditions triggered
  - Monthly returns heatmap
  - Drawdown chart
- v1 limitations: daily resolution, single asset at a time, long/short only

**Historically Similar Conditions Finder:**
- "Show me what happened the last N times conditions looked like this"
- User defines current state (or it auto-detects from current regime + metrics)
- Searches historical data for similar multi-dimensional states
- Shows forward price distribution from those historical matches
- Not a prediction — a probabilistic context tool

**Data Export:**
- CSV export from any chart or table
- JSON export for developers
- Bulk historical download for quant users

### Quant Partner Scope (Parallel)
- Build the similarity search algorithm for "Historically Similar Conditions"
- Define distance metric across multi-dimensional market state space
- Validate that similar historical states produce meaningfully different forward distributions than random
- Comprehensive model documentation for all deployed modules
- Performance monitoring and calibration of live models vs expectations

### Definition of Done
- Custom screener filtering across all data domains
- Backtesting engine running strategies against historical data
- Historically similar conditions tool returning valid matches
- Data export working from all views
- All tools functional with real data

---

## Phase 9 — Alerts, Notifications & Polish
**Goal:** Get insights out of the app and into traders' hands. Polish the entire experience.

**Duration:** 2–3 weeks

### Engineering Scope

**Alert delivery expansion:**
- Email alerts via Resend + React Email templates
- Telegram bot for real-time alerts
- Smart throttling (prevent spam during high-vol cascades)
- Alert types: all previously built alerts + regime change + convergence threshold + "why is price moving" digest

**User experience polish:**
- Customizable dashboard layouts (save/load workspace arrangements)
- Watchlist system (pin assets, custom ordering)
- Chart annotation tools (user-owned: trend lines, horizontal levels, notes)
- Keyboard shortcuts for power users
- Responsive mobile experience (not a native app, but usable)
- Onboarding flow for new users (explain what each section does)

**Performance:**
- Lighthouse audit and optimization
- WebSocket/SSE connection resilience
- Redis cache hit rate optimization
- Database query performance audit
- Code splitting and lazy loading for heavy chart components

**Reliability:**
- Error tracking (Sentry)
- Uptime monitoring for Market Data Service and Quant Engine
- Data freshness monitoring (alert if data goes stale)
- Automated health checks

### Definition of Done
- Email and Telegram alerts delivering
- Customizable layouts and watchlists
- Chart annotations working
- Mobile-responsive
- Performance benchmarks met (sub-2s page loads, sub-1s data updates)
- Monitoring and error tracking active

---

## Phase 10 — Security, Legal & Soft Launch
**Goal:** Make everything production-ready and open the doors.

**Duration:** 1–2 weeks

### Scope

**Security:**
- Rate limiting on all routes
- Input validation audit
- CSP headers
- Dependency vulnerability scan
- API route authentication audit

**Legal:**
- Terms of Service (analytics/data platform, NOT financial advice)
- Privacy Policy
- Prominent disclaimers: "For informational purposes only. Not financial advice."
- Cookie consent
- GDPR compliance check

**Launch prep:**
- Landing page with clear value proposition
- SEO basics (meta tags, OG cards)
- Social sharing cards for charts/insights
- Feedback mechanism (in-app)
- Analytics (privacy-respecting usage tracking)

**Soft launch:**
- Open to users — entirely free for now
- All features available to all users
- Collect feedback, monitor usage patterns, identify what people actually use
- Monetization comes later based on what users value most

### Definition of Done
- Security audit complete
- Legal pages published
- Landing page live
- App publicly accessible
- Monitoring confirms stability under real user load
- Feedback mechanism active

---

## Phase Summary

| Phase | Name | Duration | Cumulative | Key Deliverable |
|---|---|---|---|---|
| 0 | Strip & Restructure | 1 week | 1 week | Clean analytics platform shell |
| 1 | Live Derivatives Data | 2–3 weeks | 3–4 weeks | Real-time funding, OI, liquidations, basis |
| 2 | Derivatives Intelligence | 2–3 weeks | 5–7 weeks | Arb scanner, CVD, health composite, screener |
| 3 | Options & Volatility | 3–4 weeks | 8–11 weeks | Vol surface, RND, skew, VRP, vol cone |
| 4 | Options Microstructure | 2–3 weeks | 10–14 weeks | GEX, gamma flip, DEX, vanna/charm, flow |
| 5 | On-Chain Analytics | 3–4 weeks | 13–18 weeks | Exchange flows, MVRV, SOPR, whale tracking |
| 6 | Regime & Convergence | 2–3 weeks | 15–21 weeks | Regime classifier, convergence engine, "why" engine |
| 7 | Sentiment & Macro | 2–3 weeks | 17–24 weeks | Fear/greed, correlations, ETF flows, dispersion |
| 8 | Quant Tools | 3–4 weeks | 20–28 weeks | Screener, backtester, historical similarity |
| 9 | Alerts & Polish | 2–3 weeks | 22–31 weeks | Email/Telegram alerts, customizable layouts |
| 10 | Security & Soft Launch | 1–2 weeks | 23–33 weeks | Public launch, all features free |

**Total: ~6–8 months to full soft launch**

### Key Milestones

**Month 2 (after Phase 2):** You have a live derivatives terminal with intelligence features (arb scanner, CVD divergence, health composite) that already differentiates from Coinglass's free tier. Usable internally and for early feedback.

**Month 3–4 (after Phase 4):** Options and volatility suite is live. RND, vol surface, GEX — tools that don't exist accessibly in crypto. This is the "wow" moment. Could share publicly for early traction.

**Month 5 (after Phase 6):** The synthesis layer (regime classification, convergence engine, "why is price moving?") is live. This is the moat. No other platform can do this because no other platform has all the data domains in one system.

**Month 6–8 (Phases 7–10):** Complete platform with sentiment, macro, quant tools, polish, and public launch.

---

## Data Source Summary

| Data | Source | Cost | Phase |
|---|---|---|---|
| Perp futures (price, funding, OI) | Binance + Bybit WebSocket/REST | Free | 1 |
| Liquidations | Binance + Bybit streams | Free | 1 |
| Options chains | Deribit REST | Free | 3 |
| Options (secondary) | OKX, Bybit REST | Free | 3–4 |
| On-chain metrics | Glassnode API or CryptoQuant | $29–300+/mo | 5 |
| Fear & Greed Index | Alternative.me | Free | 7 |
| Social sentiment | LunarCrush or Santiment | Tiered | 7 |
| Macro (SPX, DXY, yields) | Yahoo Finance / FRED | Free | 7 |
| ETF flows | Public sources | Free | 7 |
| Token unlocks | Token Unlocks API | Tiered | 7 |

---

*This roadmap is a living document. Each phase will be expanded into a detailed PRD before implementation begins. Quant module specifications will be co-authored with the data science partner.*
