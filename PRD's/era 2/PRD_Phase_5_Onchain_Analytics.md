# PRD: Phase 5 — On-Chain Analytics

**Version:** 1.0
**Date:** April 18, 2026
**Status:** Ready for Implementation
**Priority:** High — unlocks the synthesis layer (Phase 6)
**Depends on:** Phases 0–4 shipped + Quant Engine deployed to Railway/Fly.io with `QUANT_ENGINE_URL` set

---

## 1. Context

### Where We Are

Phases 0–4 shipped a live derivatives and options intelligence platform: funding, OI, liquidations, basis, CVD, and a composite health score at `/terminal/derivatives`; and a thirteen-tab volatility surface at `/terminal/volatility` covering vol surface, RND, skew, term structure, vol cone, VRP, GEX (with heatmap), DEX, vanna/charm, flow, pin risk, and the April cascade-risk overlay.

`/terminal/onchain` renders a `ComingSoon` stub. `/terminal/macro` and `/terminal/sentiment` do the same. The navigation entries exist; the analytics don't. Phase 5 fills in on-chain.

### What Phase 5 Is

Phase 5 adds the **third data domain** to the platform. Derivatives (Phases 1–2) show where speculative leverage sits. Options (Phases 3–4) show where dealer hedging will move price. On-chain shows where the underlying supply is actually moving — who is accumulating, who is distributing, what's heading to exchanges, and what the long-horizon cost basis of the supply looks like.

Five new tabs under `/terminal/onchain`:

1. **Exchange Flows** — net spot + stablecoin flows into and out of exchanges, per asset
2. **Supply Dynamics** — MVRV z-score, SOPR, realized cap, HODL waves
3. **Network Health** — NVT ratio, active addresses, fees, hash rate (BTC) / gas (ETH)
4. **Stablecoin Flows** — aggregate stablecoin supply, exchange balance, net mint/burn (USDT, USDC, DAI)
5. **Whale Monitor** — large transfer log with exchange classification

Plus two cross-domain synthesis features that ship with the tabs, not after:

- **On-chain + RND compare** — overlay high-OI cost-basis clusters on the RND curve at `/terminal/volatility`. When realized price clusters stack against a fat RND tail, that's a convergence signal.
- **Exchange-flow price overlay** — chart toolbar toggle on the derivatives terminal that renders exchange netflow bars underneath the price chart.

### What's NOT In Phase 5

- **Regime classifier and convergence engine.** Those are Phase 6. Phase 5 produces the *inputs* that Phase 6 will synthesize. Every metric in this phase is scoped to feed the convergence scorer.
- **Sentiment + macro.** Phase 7.
- **"Why is price moving?" card as a full feature.** That belongs in Phase 6 because it requires regime context to explain well. See §11 Open Decisions — a v0 stub (derivatives + on-chain only) is an optional add to the tail of Phase 5 if desired.
- **Per-wallet labelling beyond basic exchange classification.** Arkham/Nansen-style attribution is out of scope; we classify "exchange vs non-exchange" only.
- **Altcoins beyond BTC and ETH in v1.** Same constraint as Phase 3/4. Stablecoin flows aggregate across USDT, USDC, and DAI as a single liquidity series; we are not opening a per-alt flow series in this phase.

### Critical Distinction: Data Sourcing Reality

The gold-standard on-chain provider is Glassnode ($300+/mo for the relevant tier). Their depth, label quality, and methodology consistency are hard to match. CryptoQuant is cheaper ($29+/mo) but thinner. Arkham and Nansen are label-first, not metric-first.

Scope Alpha's v1 takes the **free-tier bootstrap path** and upgrades later. The reasoning:

- The metrics that matter for the Phase 6 convergence scorer — MVRV-Z, SOPR, NVT, exchange netflow, stablecoin aggregate supply — are all computable from public BTC/ETH chain data plus CoinMetrics' community API. Glassnode's Studio tier provides daily CSV snapshots of its core indicators for free with attribution.
- Paying $300+/mo before monetization is decided (per v3 principles) is the wrong ordering of bets.
- If convergence signals demonstrate value and users want deeper coverage, Glassnode integration is a surface-level swap behind the existing data-source abstraction.

We design the data layer (§2) with a provider-interface abstraction so swapping free-tier for Glassnode later is a config change, not a rewrite.

### Scoping Principle

Every metric on every tab must answer the question: *"How does this feed the convergence scorer in Phase 6?"* Vanity charts — realized cap alone, fee-rate alone — earn tab space only if they contribute a convergence input or a user-visible synthesis feature. On-chain is notorious for producing beautiful-but-useless dashboards. This one serves the product, not the data.

---

## 2. Data Sources

### What's Available Today

Nothing. `lib/onchain/` does not exist. No cron touches on-chain data. Prisma has no on-chain models.

### What Phase 5 Adds

A **provider-interface abstraction** (`lib/onchain/providers/*`) so the actual source is swappable. v1 ships with free-tier providers:

| Data | Primary Source (free) | Backup / Upgrade Path | Notes |
|---|---|---|---|
| BTC/ETH supply, realized cap, MVRV inputs | CoinMetrics Community API | Glassnode paid | CoinMetrics publishes community-tier daily for BTC/ETH including realized cap |
| SOPR (BTC) | Derive from public BTC chain via mempool.space / blockchain.com REST | Glassnode paid | Daily resolution is fine for v1 |
| NVT | Derive from market cap + tx volume (CoinMetrics) | Glassnode paid | Trivial |
| Exchange classification (BTC) | Bitcoin-ETF + known-exchange address lists (Glassnode CSV, public lists on GitHub) | Arkham (paid API) | Maintain a versioned seed list in-repo |
| Exchange classification (ETH) | Etherscan label list + public exchange hot-wallet registries | Arkham (paid API) | Same pattern |
| Stablecoin supply + flows | Etherscan + Tron explorer for USDT, Circle's published attestations for USDC, MakerDAO subgraph for DAI | DeFiLlama stablecoins API | DeFiLlama is the pragmatic default; their free API is stable |
| Whale transactions | Whale Alert public feed (free tier: ~1 req/sec, thresholded) | Whale Alert paid / Arkham | Use as a stream-to-cache pattern, not a lookup |

### Provider Interface

```typescript
// lib/onchain/providers/types.ts
export interface OnChainProvider {
  name: string;
  configured: boolean;

  fetchSupplyMetrics(asset: "BTC" | "ETH"): Promise<SupplyMetrics | null>;
  fetchExchangeFlows(asset: "BTC" | "ETH", window: TimeWindow): Promise<ExchangeFlowSeries | null>;
  fetchStablecoinAggregate(): Promise<StablecoinAggregate | null>;
  fetchWhaleTransactions(asset: "BTC" | "ETH", sinceMs: number): Promise<WhaleTransaction[]>;
  fetchNetworkMetrics(asset: "BTC" | "ETH"): Promise<NetworkMetrics | null>;
}
```

Two implementations land in v1:

1. `CoinMetricsProvider` — community API, primary for supply + network metrics
2. `DefiLlamaProvider` — stablecoin aggregate
3. `PublicChainProvider` — derives SOPR + whale transactions from public BTC/ETH RPC + WhaleAlert

When none are configured, the routes go inert (same pattern as Quant Engine unset).

### Env Vars

```bash
# Phase 5 additions to .env.example
COINMETRICS_API_KEY=          # optional — community tier works without a key
WHALE_ALERT_API_KEY=          # optional — free tier available
ONCHAIN_PROVIDER=coinmetrics  # "coinmetrics" | "glassnode" | "cryptoquant"
ETHERSCAN_API_KEY=            # optional — used by stablecoin + whale modules
```

All optional. Inert-mode fallback is the rule.

---

## 3. Quant Engine — New Endpoints

The raw metrics (e.g., realized cap, supply, tx volume) come from the providers. The Quant Engine computes the *derived* z-scores, percentiles, and regime labels that make those raw metrics actionable.

### 3.1 `POST /onchain/mvrv`

**What it computes:** MVRV z-score with regime bands.

MVRV = market cap / realized cap. The z-score normalizes against the asset's historical distribution. Regime bands map z-score to interpretable labels (e.g., `deep_value`, `fair`, `elevated`, `euphoria`).

**Input:**

```json
{
  "asset": "BTC",
  "series": [
    { "timestamp": "2024-01-01T00:00:00Z", "market_cap": 850000000000, "realized_cap": 420000000000 }
  ],
  "lookback_days": 1460
}
```

**Computation:**

```python
def compute_mvrv_z(series, lookback_days):
    df = pd.DataFrame(series)
    df["mvrv"] = df["market_cap"] / df["realized_cap"]

    window = df.tail(lookback_days)
    mean = window["mvrv"].mean()
    std = window["mvrv"].std()
    current = df["mvrv"].iloc[-1]
    z = (current - mean) / std

    if z < -1.0: regime = "deep_value"
    elif z < 0.5: regime = "fair"
    elif z < 2.5: regime = "elevated"
    else: regime = "euphoria"

    return MVRVOutput(
        current_mvrv=current,
        z_score=z,
        regime=regime,
        historical_percentile=percentileofscore(window["mvrv"], current) / 100,
        # Historical forward return by regime for interpretability
        forward_return_distribution=compute_forward_returns_by_regime(df),
    )
```

**Output:**

```json
{
  "asset": "BTC",
  "current_mvrv": 2.1,
  "z_score": 1.4,
  "regime": "elevated",
  "historical_percentile": 0.82,
  "interpretation": "MVRV z-score at 1.4 places BTC in the elevated band (top 18% historically). Forward 90-day returns from this regime have averaged +2.1% with high dispersion.",
  "forward_return_distribution": {
    "90d_median": 0.021,
    "90d_p25": -0.12,
    "90d_p75": 0.18
  }
}
```

### 3.2 `POST /onchain/sopr`

**What it computes:** Spent Output Profit Ratio with profit-taking / capitulation labels.

SOPR > 1 means spent coins are realized at a profit on aggregate. < 1 means realized at a loss (capitulation). Crosses at 1 are regime transitions.

**Output fields:** `current_sopr`, `ema_7d`, `state` (`profit_taking` / `neutral` / `capitulation` / `recovery`), `crossed_one_days_ago`.

### 3.3 `POST /onchain/nvt`

**What it computes:** NVT ratio (market cap / daily on-chain tx volume) with historical percentile.

**Output fields:** `current_nvt`, `nvt_signal_90d` (Willy Woo's smoothed variant), `historical_percentile`, `regime` (`cheap` / `fair` / `overvalued`).

### 3.4 `POST /onchain/flow-regime`

**What it computes:** Classifies current exchange-flow regime from a netflow series.

**Input:** 30-day netflow series (USD) per asset.

**Output:**

```json
{
  "asset": "BTC",
  "regime": "accumulation",
  "regime_confidence": 0.73,
  "net_flow_7d": -284000000,
  "net_flow_30d": -1200000000,
  "interpretation": "Sustained net outflow over 30 days at 2.1x the trailing 90d baseline. Consistent with accumulation regime.",
  "historical_regime_distribution": {
    "accumulation": 0.34,
    "distribution": 0.31,
    "neutral": 0.35
  }
}
```

Regime label drives the exchange-flow color on the price overlay and the convergence input in Phase 6.

### QuantEngineClient Additions

Add 4 methods to `lib/quant-engine.ts`:

```typescript
async computeMVRV(input: MVRVInput): Promise<MVRVOutput | null>
async computeSOPR(input: SOPRInput): Promise<SOPROutput | null>
async computeNVT(input: NVTInput): Promise<NVTOutput | null>
async computeFlowRegime(input: FlowRegimeInput): Promise<FlowRegimeOutput | null>
```

Inert-mode returns null — same pattern as existing methods.

---

## 4. Frontend

### 4.1 Page Structure

Replace the `ComingSoon` stub at `scope-alpha/frontend/app/(app)/terminal/onchain/page.tsx` with a tabbed view mirroring the volatility page pattern. Keep the header style consistent with `/terminal/derivatives` and `/terminal/volatility`.

```typescript
const TABS = [
  { label: "Exchange Flows", value: "flows" },
  { label: "Supply Dynamics", value: "supply" },
  { label: "Network Health", value: "network" },
  { label: "Stablecoins", value: "stablecoins" },
  { label: "Whale Monitor", value: "whales" },
] as const;
```

Asset selector reuses the shared component from the derivatives terminal. BTC + ETH supported. Selector is disabled on the Stablecoins tab (aggregate-only).

### 4.2 Exchange Flows Tab

**Component:** `components/onchain/ExchangeFlowsView.tsx`

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  BTC Exchange Flows                                      │
│  Regime: ACCUMULATION  [green badge]   Confidence 73%    │
│  7d net: -$284M    30d net: -$1.2B                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [Stacked bar chart: inflows (red) / outflows (green)]   │
│  Daily bars, 90-day window                               │
│                                                          │
│  ──── Net flow line overlay ────                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Per-exchange breakdown (top 5)                          │
│  Binance:  -$142M  [sparkline]                           │
│  Coinbase: -$89M   [sparkline]                           │
│  Kraken:   -$31M   [sparkline]                           │
│  OKX:      -$15M   [sparkline]                           │
│  Bybit:     -$7M   [sparkline]                           │
├──────────────────────────────────────────────────────────┤
│  Interpretation:                                         │
│  • Sustained net outflow 2.1x baseline                   │
│  • Pattern consistent with accumulation                  │
│  • Historical accumulation phases preceded +4.8% 90d     │
│    median return (p25: -3%, p75: +15%)                   │
└──────────────────────────────────────────────────────────┘
```

### 4.3 Supply Dynamics Tab

**Component:** `components/onchain/SupplyDynamicsView.tsx`

Two-column layout:

**Left column — MVRV**
- Line chart: MVRV z-score over time (4-year lookback)
- Regime bands shaded (deep_value, fair, elevated, euphoria)
- Current value marker
- Regime label + forward-return distribution block

**Right column — SOPR**
- Line chart: SOPR with 7d EMA
- Horizontal reference line at y=1
- State badge (profit_taking / neutral / capitulation / recovery)
- Days-since-last-cross stat

Below the two columns, a compact **HODL waves** bar (age-banded supply distribution) rendered as a stacked horizontal bar — v1 doesn't need the full Glassnode-style area chart. One bar showing the current distribution of supply by age buckets is the right resolution for the convergence scorer.

### 4.4 Network Health Tab

**Component:** `components/onchain/NetworkHealthView.tsx`

Four-card grid:

1. **NVT Ratio** — current value, 90d smoothed variant, historical percentile, regime label
2. **Active Addresses** — 7d trailing vs 90d baseline, sparkline
3. **Fees** — USD total fees 24h, as % of block reward (BTC) or gas-weighted (ETH)
4. **Issuance** — annualized inflation rate (BTC), staking yield (ETH)

Minimal narrative per card — this tab is context, not action. Keep it scannable.

### 4.5 Stablecoins Tab

**Component:** `components/onchain/StablecoinFlowsView.tsx`

Aggregate-only view (USDT + USDC + DAI combined).

- Big number at top: Total stablecoin supply ($)
- Line chart: aggregate supply over time
- Second chart: stablecoin exchange balance as % of total supply (high = dry powder on exchanges)
- Side panel: 7d mint/burn by issuer, net
- Interpretation block: "Stablecoin supply expanding + rising exchange balance = liquidity accumulating for deployment."

**Synthesis note:** This tab feeds Phase 7's macro correlations and Phase 6 convergence as a liquidity proxy. The phrasing in the interpretation should already nod toward that role.

### 4.6 Whale Monitor Tab

**Component:** `components/onchain/WhaleMonitorView.tsx`

Real-time-ish table (cached at 60s TTL):

```
┌──────────────────────────────────────────────────────────────┐
│  Whale Transactions — BTC                                    │
│  Threshold: $1M+                                             │
├──────────────────────────────────────────────────────────────┤
│  Time    │ Amount     │ Flow                │ Significance   │
│  ────────┼────────────┼─────────────────────┼─────────────── │
│  2m ago  │ $12.4M     │ Unknown → Binance   │ 🔴 HIGH         │
│  8m ago  │ $3.1M      │ Coinbase → Unknown  │ 🟡 MEDIUM       │
│  14m ago │ $45M       │ Unknown → Unknown   │ 🔴 HIGH         │
│  ...                                                         │
├──────────────────────────────────────────────────────────────┤
│  Last 24h summary                                            │
│  Total: 47 transfers > $1M                                   │
│  Net flow to exchanges: +$89M                                │
│  Net flow from exchanges: -$341M                             │
│  Notable: 3 transfers > $20M (all non-exchange wallets)      │
└──────────────────────────────────────────────────────────────┘
```

Flow classification colors: red for "to exchange" (distribution signal), green for "from exchange" (accumulation signal), gray for "wallet-to-wallet."

### 4.7 Shared UI States

- **Inert state:** if no on-chain provider is configured → `UnavailableBanner` (reuse the component from Phase 3).
- **Stale data banner:** if the most recent snapshot is > 2x the expected cadence, show a "Data delayed" warning inline (not a block).
- **Asset without coverage:** for the rare case where an asset is BTC-only (e.g., HODL waves), hide the tab section and show a helper note.

---

## 5. API Routes & Cache Warming

All on-chain routes follow the on-demand warming pattern from the cache warming PRD (same as Phase 3/4):

1. Read cache → return if fresh
2. Miss → dispatch warmer → return result
3. Still null → return 503 with `{ reason: "provider_unconfigured" }` or similar

### New Routes

| Route | Method | Source | Purpose |
|---|---|---|---|
| `/api/market/onchain/flows` | GET | Provider → Quant Engine `/onchain/flow-regime` | Exchange flows + regime |
| `/api/market/onchain/supply` | GET | Provider → Quant Engine `/onchain/mvrv`, `/onchain/sopr` | MVRV + SOPR + HODL waves |
| `/api/market/onchain/network` | GET | Provider → Quant Engine `/onchain/nvt` | NVT + network metrics |
| `/api/market/onchain/stablecoins` | GET | DefiLlama provider | Stablecoin aggregate |
| `/api/market/onchain/whales` | GET | Whale Alert / public chain | Whale transaction log |
| `/api/market/onchain/history/flows` | GET | DB | Historical exchange-flow series |
| `/api/market/onchain/history/supply` | GET | DB | Historical MVRV/SOPR series |

### Cache Keys and TTLs

| Cache Key | TTL | Populated By | Rationale |
|---|---|---|---|
| `onchain:flows:{asset}` | 3600s | refresh-onchain cron | Flow data daily cadence from provider; hourly cache refresh |
| `onchain:supply:{asset}` | 21600s (6h) | refresh-onchain cron | MVRV/SOPR daily publish — 6h cache is plenty |
| `onchain:network:{asset}` | 3600s | refresh-onchain cron | |
| `onchain:stablecoins` | 3600s | refresh-onchain cron | |
| `onchain:whales:{asset}` | 60s | On-demand (stream append) | Near-real-time desired |

### New Cron Handler

`app/api/cron/refresh-onchain/route.ts` — scheduled daily at 02:00 UTC (after most on-chain providers publish their daily snapshots).

Dispatches:

```typescript
// Pseudocode
for (const asset of ["BTC", "ETH"]) {
  const supply = await provider.fetchSupplyMetrics(asset);
  const flows = await provider.fetchExchangeFlows(asset, "30d");
  const network = await provider.fetchNetworkMetrics(asset);

  if (quantEngine.configured) {
    const mvrv = await quantEngine.computeMVRV({ asset, series: supply.series, lookback_days: 1460 });
    const sopr = await quantEngine.computeSOPR({ asset, series: supply.soprSeries });
    const nvt = await quantEngine.computeNVT({ asset, series: network.nvtSeries });
    const flowRegime = await quantEngine.computeFlowRegime({ asset, series: flows.netflowSeries });

    await setCached(`onchain:supply:${asset}`, { supply, mvrv, sopr }, 21600);
    await setCached(`onchain:flows:${asset}`, { flows, regime: flowRegime }, 3600);
    await setCached(`onchain:network:${asset}`, { network, nvt }, 3600);
  }

  // Persist snapshots
  await persistOnChainSnapshot(asset, { supply, flows, network, mvrv, sopr, nvt, flowRegime });
}

// Stablecoin aggregate (single call, not per-asset)
const stables = await provider.fetchStablecoinAggregate();
await setCached(`onchain:stablecoins`, stables, 3600);
```

Add to `vercel.json`:

```json
{ "path": "/api/cron/refresh-onchain", "schedule": "0 2 * * *" }
```

### Whale Stream

Whales are not daily cadence. A lightweight poller runs on a 5-minute Vercel cron, appends new transactions to a circular buffer in Redis (`onchain:whales:{asset}:recent`), and the API route reads from that buffer.

```json
{ "path": "/api/cron/poll-whales", "schedule": "*/5 * * * *" }
```

Buffer size: last 500 transactions per asset, TTL 24h.

---

## 6. Cross-Domain Synthesis

### 6.1 On-chain + RND Compare

**Where it lives:** `/terminal/volatility`, RND tab. Not a new tab — an overlay toggle on the existing RND chart.

**What it does:** Overlays vertical bands at price levels where significant cost-basis clusters sit (from realized-price distribution). When the RND shows non-trivial probability in a region that coincides with a heavy cost-basis cluster, that's a **support/resistance convergence signal**.

Add to `components/volatility/RNDView.tsx`:

```typescript
const [showCostBasis, setShowCostBasis] = useState(false);
const { data: costBasis } = useOnChainSupply(asset);

// In the render:
{showCostBasis && costBasis && (
  <CostBasisOverlay clusters={costBasis.hodl_distribution.priceBands} />
)}
```

Toggle label: "Cost basis clusters." Same visual language as the existing GEX zones toggle.

### 6.2 Exchange-Flow Price Overlay

**Where it lives:** `/terminal/derivatives`, chart toolbar.

Add a new toggle: "Exchange netflow." When enabled, renders exchange netflow bars underneath the main price chart. Green bars = net outflow (bullish accumulation signal), red bars = net inflow (bearish distribution signal).

Same pattern as the existing Phase 4 GEX zones toggle in the derivatives chart toolbar.

### 6.3 Health Score Enrichment

Phase 2's `computeHealthScore()` currently consumes derivatives + options regime inputs. Phase 5 extends it to accept optional on-chain regime inputs:

```typescript
interface OnChainRegimeInput {
  flowRegime?: "accumulation" | "distribution" | "neutral";
  mvrvRegime?: "deep_value" | "fair" | "elevated" | "euphoria";
  soprState?: "profit_taking" | "neutral" | "capitulation" | "recovery";
}
```

Weighting is conservative in v1. The *real* synthesis work is Phase 6's convergence scorer — this phase just wires the inputs in so they're available.

### 6.4 Alert Types

| Type | Condition | Example |
|---|---|---|
| `onchain_flow_regime_change` | `detected` | "BTC exchange flow regime shifted from neutral to distribution" |
| `mvrv_regime_change` | `detected` | "BTC MVRV z-score entered euphoria band" |
| `sopr_cross` | `crosses_above` / `crosses_below` | "BTC SOPR crossed below 1.0 — capitulation signal" |
| `whale_large_transfer` | `above` (USD threshold) | "$45M BTC transfer from unknown to Binance" |

Add to `lib/alerts/evaluator.ts` and the alert type enum.

---

## 7. Database Changes

### New Prisma Models

```prisma
// Snapshot of the core on-chain indicators per asset per day
model OnChainSnapshot {
  id         String   @id @default(cuid())
  asset      String                                // "BTC" | "ETH"
  timestamp  DateTime

  // Raw
  marketCap      Float?
  realizedCap    Float?
  supply         Float?
  activeAddresses Int?
  txVolumeUsd    Float?
  feesUsd        Float?

  // Derived (from Quant Engine)
  mvrv           Float?
  mvrvZScore     Float?
  mvrvRegime     String?
  sopr           Float?
  soprState      String?
  nvt            Float?
  nvtRegime      String?

  createdAt      DateTime @default(now())

  @@unique([asset, timestamp])
  @@index([asset, timestamp])
}

// Per-exchange netflow slice (daily)
model ExchangeFlowSnapshot {
  id          String   @id @default(cuid())
  asset       String
  exchange    String
  netFlowUsd  Float
  inflowUsd   Float
  outflowUsd  Float
  timestamp   DateTime
  createdAt   DateTime @default(now())

  @@unique([asset, exchange, timestamp])
  @@index([asset, timestamp])
}

// Large on-chain transfers (rolling log, retention policy TBD)
model WhaleTransaction {
  id             String   @id @default(cuid())
  asset          String
  valueUsd       Float
  fromAddress    String
  toAddress      String
  fromLabel      String?    // "binance" | "coinbase" | null (unknown)
  toLabel        String?
  classification String     // "to_exchange" | "from_exchange" | "wallet_to_wallet"
  txHash         String
  timestamp      DateTime
  createdAt      DateTime @default(now())

  @@unique([txHash])
  @@index([asset, timestamp])
  @@index([classification, timestamp])
}

// Stablecoin aggregate daily
model StablecoinSnapshot {
  id                    String   @id @default(cuid())
  timestamp             DateTime @unique
  totalSupplyUsd        Float
  exchangeBalanceUsd    Float
  exchangeBalancePct    Float
  usdtSupplyUsd         Float
  usdcSupplyUsd         Float
  daiSupplyUsd          Float
  createdAt             DateTime @default(now())

  @@index([timestamp])
}
```

**Retention policy:**
- `OnChainSnapshot`, `ExchangeFlowSnapshot`, `StablecoinSnapshot` — keep indefinitely (small per-row, high analytical value)
- `WhaleTransaction` — rolling 90-day retention in v1; revisit if storage becomes a concern

---

## 8. File Structure

### New Files

```
# Quant Engine additions (Python)
quant-engine/app/routes/onchain.py                   # 4 routes
quant-engine/app/core/onchain.py                     # MVRV, SOPR, NVT, flow regime

# Frontend — on-chain provider layer
scope-alpha/frontend/lib/onchain/types.ts
scope-alpha/frontend/lib/onchain/providers/types.ts
scope-alpha/frontend/lib/onchain/providers/coinmetrics.ts
scope-alpha/frontend/lib/onchain/providers/defillama.ts
scope-alpha/frontend/lib/onchain/providers/public-chain.ts
scope-alpha/frontend/lib/onchain/providers/whale-alert.ts
scope-alpha/frontend/lib/onchain/index.ts            # Provider selector

# Frontend — classification data
scope-alpha/frontend/lib/onchain/exchange-addresses/btc.json
scope-alpha/frontend/lib/onchain/exchange-addresses/eth.json

# Frontend — API routes
scope-alpha/frontend/app/api/market/onchain/flows/route.ts
scope-alpha/frontend/app/api/market/onchain/supply/route.ts
scope-alpha/frontend/app/api/market/onchain/network/route.ts
scope-alpha/frontend/app/api/market/onchain/stablecoins/route.ts
scope-alpha/frontend/app/api/market/onchain/whales/route.ts
scope-alpha/frontend/app/api/market/onchain/history/flows/route.ts
scope-alpha/frontend/app/api/market/onchain/history/supply/route.ts

# Frontend — cron
scope-alpha/frontend/app/api/cron/refresh-onchain/route.ts
scope-alpha/frontend/app/api/cron/poll-whales/route.ts

# Frontend — components
scope-alpha/frontend/components/onchain/ExchangeFlowsView.tsx
scope-alpha/frontend/components/onchain/SupplyDynamicsView.tsx
scope-alpha/frontend/components/onchain/NetworkHealthView.tsx
scope-alpha/frontend/components/onchain/StablecoinFlowsView.tsx
scope-alpha/frontend/components/onchain/WhaleMonitorView.tsx
scope-alpha/frontend/components/onchain/CostBasisOverlay.tsx  # For RND tab synthesis

# Frontend — hooks
scope-alpha/frontend/hooks/useOnChainFlows.ts
scope-alpha/frontend/hooks/useOnChainSupply.ts
scope-alpha/frontend/hooks/useOnChainNetwork.ts
scope-alpha/frontend/hooks/useStablecoins.ts
scope-alpha/frontend/hooks/useWhaleTransactions.ts

# Types
scope-alpha/frontend/types/onchain.ts
```

### Files to Modify

```
# Quant Engine
quant-engine/app/main.py                             # Register onchain router
quant-engine/app/models/inputs.py                    # Add MVRV/SOPR/NVT/FlowRegime inputs
quant-engine/app/models/outputs.py                   # Add matching outputs

# Frontend
scope-alpha/frontend/lib/quant-engine.ts             # Add 4 compute methods
scope-alpha/frontend/app/(app)/terminal/onchain/page.tsx   # Replace ComingSoon
scope-alpha/frontend/components/volatility/RNDView.tsx     # Cost-basis overlay toggle
scope-alpha/frontend/components/terminal/ChartToolbar.tsx  # Exchange-netflow toggle
scope-alpha/frontend/lib/market/health.ts            # Accept on-chain regime input
scope-alpha/frontend/lib/alerts/evaluator.ts         # 4 new alert types
scope-alpha/frontend/app/api/alerts/route.ts         # Add types to enum
scope-alpha/frontend/prisma/schema.prisma            # 4 new models
scope-alpha/frontend/config/navigation.ts            # No change — Onchain already present
scope-alpha/frontend/vercel.json                     # 2 new cron entries
scope-alpha/frontend/.env.example                    # Add COINMETRICS_API_KEY etc
```

---

## 9. Implementation Order

1. **Prisma migration** — add 4 new models (OnChainSnapshot, ExchangeFlowSnapshot, WhaleTransaction, StablecoinSnapshot)
2. **Types** — `types/onchain.ts` covering provider outputs, Quant Engine IO, UI types
3. **Provider interface** — `lib/onchain/providers/types.ts` + CoinMetrics + DefiLlama + public-chain implementations (skeleton, real data wiring next)
4. **Exchange address seed data** — commit versioned JSON address lists (BTC, ETH)
5. **QuantEngineClient update** — 4 new methods, inert fallback
6. **Quant Engine Python** — `/onchain/mvrv`, `/onchain/sopr`, `/onchain/nvt`, `/onchain/flow-regime` + core computations
7. **Whale Alert poller** — `app/api/cron/poll-whales/route.ts` + Redis circular buffer
8. **Main cron** — `app/api/cron/refresh-onchain/route.ts` with dispatch pipeline
9. **API routes** — 7 new routes following cache-first pattern
10. **Hooks** — 5 new SWR hooks
11. **Components** — 5 tab views + CostBasisOverlay
12. **Tab integration** — replace `ComingSoon` at `/terminal/onchain/page.tsx`
13. **Cross-domain overlays** — RND cost-basis toggle, derivatives chart netflow toggle
14. **Health score enrichment** — thread on-chain regime inputs through
15. **Alert types** — 4 new alert types in evaluator
16. **Deploy Quant Engine update** — push `/onchain/*` endpoints to Railway
17. **Seed historical data** — one-time backfill script for MVRV/SOPR ~4 years for BTC, ~3 years for ETH (needed for the lookback windows to produce meaningful z-scores on day one)

---

## 10. Definition of Done

### Provider Layer
- [ ] Provider interface implemented with CoinMetrics (primary), DefiLlama (stablecoins), public-chain (whales) implementations
- [ ] Exchange address classification lists committed with version and source citations
- [ ] Inert-mode fallback when no provider is configured
- [ ] Environment variables documented in `.env.example`

### Quant Engine
- [ ] `/onchain/mvrv` returns z-score with regime band and forward-return distribution
- [ ] `/onchain/sopr` returns SOPR with state classification
- [ ] `/onchain/nvt` returns NVT with smoothed variant and percentile
- [ ] `/onchain/flow-regime` classifies flow regime with confidence score
- [ ] Unit tests pass for all 4 computations against reference data
- [ ] Deployed to Railway/Fly.io

### Frontend
- [ ] `/terminal/onchain` renders 5 tabs with real data for BTC + ETH (where applicable)
- [ ] Exchange Flows tab shows regime badge, stacked bar chart, per-exchange breakdown, interpretation
- [ ] Supply Dynamics tab shows MVRV + SOPR panels with regime bands and state labels
- [ ] Network Health tab shows 4-card layout
- [ ] Stablecoins tab shows aggregate supply + exchange balance + mint/burn
- [ ] Whale Monitor tab shows classified transaction table with 24h summary
- [ ] All views have plain-English interpretations
- [ ] All views render `UnavailableBanner` when no provider configured

### Synthesis
- [ ] RND tab has "Cost basis clusters" overlay toggle producing visible bands
- [ ] Derivatives chart has "Exchange netflow" toolbar toggle
- [ ] Health score accepts on-chain regime inputs
- [ ] 4 new alert types firing correctly

### Infrastructure
- [ ] `refresh-onchain` cron running daily at 02:00 UTC
- [ ] `poll-whales` cron running every 5 minutes
- [ ] Historical backfill completed for MVRV/SOPR lookback
- [ ] Snapshots persisting to Postgres
- [ ] Cache keys and TTLs match §5 spec

### Technical
- [ ] Zero TypeScript errors; build passes
- [ ] Quant Engine on-chain endpoints respond within 500ms
- [ ] On-demand cache warming works for all new routes
- [ ] Documented data-source choice and upgrade path in this PRD (✅) and in the team README

---

## 11. Open Decisions

These should be resolved during Claude Code's implementation-plan pass before work starts.

1. **Provider choice confirmation.** v3 and this PRD recommend the free-tier bootstrap (CoinMetrics + DefiLlama + public-chain + WhaleAlert free tier). An alternative is to purchase CryptoQuant ($29+/mo) for better flow data. Glassnode paid is not recommended pre-monetization. **Recommendation: ship on free-tier; revisit after Phase 6 proves the convergence engine produces signals worth paying for better inputs.**

2. **"Why is price moving?" v0 scope.** v3 positions this fully in Phase 6 (needs regime classifier). A Phase 5 v0 stub using only derivatives + on-chain evidence is feasible and would ship synthesis value earlier, at the cost of ~2–3 days of extra scope. **Recommendation: defer to Phase 6 unless there's appetite to ship a minimal derivatives+on-chain explainer here.** If opting in, add it as tab 6 or a terminal-level card, and expand in Phase 6 with regime context.

3. **Whale transaction threshold.** $1M is the default in the body of this PRD. BTC's $1M = 11-ish BTC at current prices, which produces a steady stream. Thresholds need per-asset tuning — set BTC at $1M and ETH at $500K in v1 and revisit if table is too noisy or too empty.

4. **Historical backfill source.** For MVRV/SOPR to produce meaningful z-scores on day one, we need ~4 years of history. CoinMetrics community provides this for BTC freely. For ETH the depth is thinner. **Open:** accept shorter ETH lookback (~2 years) or seed from a paid CSV one-time purchase.

5. **Address-list curation.** Exchange address lists drift — new hot wallets appear, old ones are retired. v1 commits a versioned seed list. **Open:** whether to set up an automated refresh path (scrape Glassnode Studio CSV or Arkham public-wallet endpoints nightly) or accept manual quarterly updates.

6. **Stablecoin tab asset selector.** The tab is aggregate-only in v1. If users want per-issuer drill-down, that's a small extension. **Open:** ship aggregate-only and wait for feedback, or include per-issuer toggles day one.

---

## 12. What This Enables

Phase 5 completes the three-legged stool (derivatives + options + on-chain) that the convergence engine needs to do its job. After this:

- **Phase 6 (Regime & Convergence):** The convergence scorer gets its third domain. A signal like "negative gamma regime (options) + extreme positive funding (derivatives) + exchange outflows despite rally (on-chain disagreement)" becomes computable. No platform below Bloomberg's tier produces this specific composite.
- **Phase 7 (Sentiment & Macro):** Stablecoin aggregate supply already covers a major liquidity input; Phase 7 layers sentiment and macro correlations on top.
- **Phase 8 (Quant Tools):** The screener gains on-chain filters (MVRV z-score, SOPR state, flow regime). The backtester can test strategies that condition on on-chain state. The similarity finder's state vector gets 4 new high-signal dimensions.
- **User value:** A user seeing "BTC is in elevated MVRV territory + exchange flows turned distribution 3 days ago + funding is at 95th percentile" is getting the same pattern-match that institutional desks run manually. That's the synthesis layer the product promised.

The choice to ship cross-domain synthesis features *with* the tabs rather than after them is deliberate — it keeps the product's identity as a synthesis layer, not a data aggregator, on every phase it ships.

---

*This PRD should be treated as the authoritative specification. Claude Code should present an implementation plan with architecture decision questions before beginning work, giving particular attention to the §11 Open Decisions.*
