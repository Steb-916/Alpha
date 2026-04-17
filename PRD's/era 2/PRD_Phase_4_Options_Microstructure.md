# PRD: Phase 4 — Options Microstructure (Greeks Exposure)

**Version:** 1.0
**Date:** April 17, 2026
**Status:** Ready for Implementation
**Priority:** High — completes the options analytics suite
**Depends on:** Phase 3 (Options & Volatility Analytics) complete + Quant Engine deployed

---

## 1. Context

### Where We Are

Phase 3 deployed the Deribit options pipeline, the Quant Engine (FastAPI on Railway), and six volatility tools (vol surface, RND, skew, term structure, vol cone, VRP) at `/terminal/volatility`. The options chain caches hourly in Redis and persists to PostgreSQL. The Quant Engine accepts raw chain data and returns computed analytics.

### What Phase 4 Is

Phase 4 adds the **dealer positioning layer** — tools that reveal how options market makers are positioned and how their forced hedging flows will affect price behavior. This is the knowledge gap between retail and institutional traders. A retail trader sees price going up. An institutional trader sees price approaching a negative gamma zone where dealer hedging will amplify the move and trigger a cascade.

Six new tools:

1. **GEX (Gamma Exposure) by Strike** — where dealer hedging stabilizes or amplifies price
2. **GEX Heatmap Over Time** — how gamma positioning evolves day-over-day
3. **DEX (Delta Exposure) by Strike** — net directional pressure from options positioning
4. **Vanna Exposure** — how IV changes force dealer repositioning
5. **Charm Exposure** — how time decay shifts dealer positioning (explains drift into expiry)
6. **Options Flow Scanner** — unusual volume/OI activity flagging institutional positioning

Plus two cross-domain synthesis features:
- GEX + Liquidation overlay (from Phase 2) showing cascade risk zones
- Regime classifier enrichment with gamma regime inputs

### What's NOT In Phase 4

- On-chain analytics (Phase 5)
- Regime & convergence engine (Phase 6)
- Sentiment & macro (Phase 7)
- These tools are for BTC and ETH only (same constraint as Phase 3 — Deribit options coverage)

### Critical Distinction: Crypto vs Equity GEX

In equity markets (SPX), GEX uses a simple heuristic: assume investors sell calls and buy puts, therefore dealers are long calls and short puts. This assumption **breaks in crypto** where a large share of participants actively buy calls to speculate on upside.

Glassnode recognized this in early 2026 and built a taker-flow-based GEX model that reconstructs dealer inventory from actual trade flow data. For Scope Alpha's v1, we use a **simplified approach** that still produces useful output without requiring Deribit's full trade-by-trade history:

**OI-weighted approach:** Use open interest distribution across strikes and option types, combined with volume direction indicators (when available), to estimate where dealer gamma concentrates. This is less precise than Glassnode's flow-based reconstruction but is computable from the data we already have (book summary provides OI, volume, and Greeks per instrument).

The quant partner can upgrade to a flow-based model in a future iteration if Deribit trade history becomes available.

---

## 2. Data Sources

### What Phase 3 Already Provides

All Phase 4 computations use the **same Deribit data** that Phase 3 fetches. No new exchange connectors, no new cron jobs, no additional API calls. The hourly `refresh-options` cron already fetches:

| Data | Source | Cache Key | Available |
|---|---|---|---|
| Full options chain | Deribit `get_book_summary_by_currency` | `options:chain:{asset}` | ✅ |
| Per-instrument Greeks | Deribit book summary includes delta, gamma, vega, theta | Within chain data | ✅ |
| Per-instrument OI | Deribit book summary | Within chain data | ✅ |
| Per-instrument volume (24h) | Deribit book summary | Within chain data | ✅ |
| Spot/underlying price | Deribit ticker | Within chain data | ✅ |

**Key insight:** Deribit provides pre-computed Greeks (delta, gamma, vega, theta) per instrument in the book summary. We don't need to compute Greeks from scratch — we aggregate them.

### What's New in Phase 4

Phase 4 adds **aggregation and analysis** on top of the existing chain data. The Quant Engine gets 3 new endpoints that take the same chain input and return exposure maps.

---

## 3. Quant Engine — New Endpoints

### 3.1 `POST /gex`

**What it computes:** Aggregate gamma exposure across all strikes, showing where dealer hedging creates stabilizing (positive gamma) or amplifying (negative gamma) effects on price.

**Input:** Same `OptionsChainEntry[]` from Phase 3, plus spot price.

```json
{
  "asset": "BTC",
  "spot_price": 84520,
  "options": [
    {
      "strike": 80000,
      "option_type": "call",
      "open_interest": 1250,
      "volume_24h": 85,
      "gamma": 0.00002,
      "delta": 0.65,
      "vega": 120.5,
      "theta": -45.2,
      "mark_iv": 52.3,
      "expiry_days": 14
    }
  ]
}
```

**Computation (OI-weighted approach):**

```python
def compute_gex(options, spot_price):
    gex_by_strike = {}
    
    for opt in options:
        strike = opt.strike
        gamma = opt.gamma
        oi = opt.open_interest
        contract_multiplier = 1  # Deribit BTC options = 1 BTC per contract
        
        # Dealer position assumption for crypto:
        # Calls: assume ~60% sold by dealers (market making), 40% sold by investors
        # Puts: assume ~55% bought by investors (hedging), dealers are short puts
        # This is a rough heuristic — taker-flow model would be more precise
        
        if opt.option_type == "call":
            # Dealers likely long gamma from calls they bought from sellers
            # But in crypto, many call buyers are speculators, not covered writers
            # Use a blended assumption: dealers net short ~40% of call OI
            dealer_gamma = -0.4 * gamma * oi * contract_multiplier * spot_price
        else:
            # Dealers typically short puts (buying from hedgers)
            # Dealer is short the put → short gamma
            dealer_gamma = -0.6 * gamma * oi * contract_multiplier * spot_price
        
        if strike not in gex_by_strike:
            gex_by_strike[strike] = 0
        gex_by_strike[strike] += dealer_gamma
    
    # Find gamma flip point (where cumulative GEX crosses zero)
    strikes_sorted = sorted(gex_by_strike.keys())
    cumulative = 0
    gamma_flip = spot_price  # default
    for strike in strikes_sorted:
        prev_cum = cumulative
        cumulative += gex_by_strike[strike]
        if prev_cum * cumulative < 0:  # sign change
            gamma_flip = strike
            break
    
    # Determine regime
    spot_gex = sum(v for k, v in gex_by_strike.items() 
                   if abs(k - spot_price) < spot_price * 0.02)
    regime = "positive_gamma" if spot_gex > 0 else "negative_gamma"
    
    return GEXOutput(...)
```

**Output:**

```json
{
  "asset": "BTC",
  "spot_price": 84520,
  "levels": [
    { "strike": 80000, "gex_usd": -45000000, "side": "negative" },
    { "strike": 82000, "gex_usd": -12000000, "side": "negative" },
    { "strike": 84000, "gex_usd": 38000000, "side": "positive" },
    { "strike": 86000, "gex_usd": 72000000, "side": "positive" },
    { "strike": 88000, "gex_usd": 25000000, "side": "positive" }
  ],
  "gamma_flip": 83500,
  "total_gex": 15000000,
  "regime": "positive_gamma",
  "regime_description": "Dealers are net long gamma near spot. Expect dampened moves, mean-reversion, and lower realized volatility.",
  "call_wall": 90000,
  "put_wall": 78000,
  "interpretation": {
    "above_spot": "Positive gamma cluster at 84K-88K creates resistance — rallies face dealer selling pressure.",
    "below_spot": "Negative gamma below 83.5K (gamma flip) — breaks below this level could accelerate downside as dealers amplify the move.",
    "regime_implications": "Current positive gamma regime favors range-bound strategies. Breakout attempts likely fail unless gamma flip is breached."
  }
}
```

### 3.2 `POST /dex`

**What it computes:** Net delta exposure across strikes — shows directional hedging pressure.

```python
def compute_dex(options, spot_price):
    dex_by_strike = {}
    
    for opt in options:
        strike = opt.strike
        delta = opt.delta
        oi = opt.open_interest
        
        if opt.option_type == "call":
            dealer_delta = -0.4 * delta * oi * spot_price
        else:
            dealer_delta = -0.6 * delta * oi * spot_price
        
        if strike not in dex_by_strike:
            dex_by_strike[strike] = 0
        dex_by_strike[strike] += dealer_delta
    
    return DEXOutput(...)
```

**Output:**

```json
{
  "asset": "BTC",
  "spot_price": 84520,
  "levels": [
    { "strike": 80000, "dex_usd": 28000000, "direction": "long" },
    { "strike": 85000, "dex_usd": -15000000, "direction": "short" }
  ],
  "net_dex": -5000000,
  "directional_bias": "slightly_short",
  "interpretation": "Net dealer delta is slightly short — dealers will buy on dips (bullish hedging pressure)."
}
```

### 3.3 `POST /greeks-exposure`

**What it computes:** Vanna and charm exposure maps in a single endpoint (they use the same data and are always displayed together).

**Vanna** = dDelta/dIV. Shows how a change in implied volatility forces dealer repositioning. If vanna is positive at a strike and IV drops, dealers lose delta and must buy the underlying to re-hedge → bullish flow.

**Charm** = dDelta/dTime. Shows how the passage of time shifts dealer delta. As options approach expiry, gamma concentrates and delta moves sharply → explains directional drift into expiration.

```python
def compute_vanna_charm(options, spot_price):
    vanna_by_strike = {}
    charm_by_strike = {}
    
    for opt in options:
        strike = opt.strike
        vega = opt.vega
        theta = opt.theta
        gamma = opt.gamma
        delta = opt.delta
        oi = opt.open_interest
        
        # Vanna approximation: vega * delta / spot (simplified)
        # More precisely: d(delta)/d(sigma) ≈ vega * (1 - d1*d2) / (sigma * sqrt(T))
        # But since we have Deribit's pre-computed Greeks, approximate from them
        vanna_est = vega * delta / max(spot_price, 1) if vega else 0
        
        # Charm approximation: -dDelta/dT
        # Approximate from theta and gamma relationship
        charm_est = -theta * gamma / max(abs(delta), 0.001) if theta and gamma and delta else 0
        
        dealer_factor = -0.4 if opt.option_type == "call" else -0.6
        
        if strike not in vanna_by_strike:
            vanna_by_strike[strike] = 0
            charm_by_strike[strike] = 0
        
        vanna_by_strike[strike] += dealer_factor * vanna_est * oi
        charm_by_strike[strike] += dealer_factor * charm_est * oi
    
    return GreeksExposureOutput(...)
```

**Output:**

```json
{
  "asset": "BTC",
  "spot_price": 84520,
  "vanna": {
    "levels": [
      { "strike": 80000, "vanna_exposure": -1200000, "iv_sensitivity": "negative" },
      { "strike": 85000, "vanna_exposure": 800000, "iv_sensitivity": "positive" }
    ],
    "net_vanna": 350000,
    "interpretation": "Net positive vanna — if IV drops (post-event), dealers will buy the underlying to re-hedge. Bullish flow on vol compression."
  },
  "charm": {
    "levels": [
      { "strike": 80000, "charm_exposure": -200000 },
      { "strike": 85000, "charm_exposure": 450000 }
    ],
    "net_charm": 150000,
    "time_decay_bias": "bullish",
    "interpretation": "Positive charm near spot — time decay is pushing dealer delta higher, creating buying pressure into expiry."
  }
}
```

---

## 4. TypeScript Features (No Quant Engine Required)

These features are computed directly in TypeScript from the cached options chain. No new Quant Engine endpoints needed.

### 4.1 Max Pain & Pin Risk

Max pain is already computed in Phase 3's `lib/options/max-pain.ts`. Phase 4 adds:

**Pin risk assessment:** How likely is price to pin at max pain as expiry approaches?

```typescript
function computePinRisk(chain: OptionsChainEntry[], maxPainStrike: number, spotPrice: number, daysToExpiry: number): PinRisk {
  // Pin risk increases when:
  // 1. Expiry is close (< 3 days)
  // 2. OI is concentrated at max pain strike
  // 3. Gamma is high at max pain (strong pinning force)
  // 4. Spot is near max pain (within 2%)
  
  const nearMaxPain = Math.abs(spotPrice - maxPainStrike) / spotPrice < 0.02;
  const oiAtMaxPain = chain
    .filter(o => o.strike === maxPainStrike)
    .reduce((sum, o) => sum + o.openInterest, 0);
  const totalOI = chain.reduce((sum, o) => sum + o.openInterest, 0);
  const oiConcentration = oiAtMaxPain / Math.max(totalOI, 1);
  
  let pinProbability = 0;
  if (daysToExpiry <= 1) pinProbability += 0.3;
  else if (daysToExpiry <= 3) pinProbability += 0.15;
  if (nearMaxPain) pinProbability += 0.25;
  if (oiConcentration > 0.1) pinProbability += 0.2;
  
  return {
    maxPainStrike,
    currentDistance: ((spotPrice - maxPainStrike) / spotPrice * 100).toFixed(2),
    pinProbability: Math.min(pinProbability, 0.95),
    oiConcentration,
    daysToExpiry,
    assessment: pinProbability > 0.4 
      ? `High pin risk — price within ${Math.abs(spotPrice - maxPainStrike).toFixed(0)} of max pain with ${daysToExpiry}d to expiry`
      : `Low pin risk — max pain at ${maxPainStrike}, ${daysToExpiry}d to expiry`
  };
}
```

### 4.2 Options Flow Scanner

Detects unusual options activity — large volume spikes, OI changes, and premium flow that indicates institutional positioning.

**Computed in TypeScript** by comparing current chain snapshot to the previous snapshot (stored in Redis or the most recent `OptionsChainSnapshot` in PostgreSQL).

```typescript
interface FlowAnomaly {
  instrument: string;          // "BTC-28MAR26-90000-C"
  asset: string;
  strike: number;
  optionType: "call" | "put";
  expiryDate: string;
  daysToExpiry: number;
  
  anomalyType: "volume_spike" | "oi_surge" | "large_premium" | "unusual_ratio";
  
  // Current values
  volume24h: number;
  openInterest: number;
  oiChange: number;            // vs previous snapshot
  oiChangePct: number;
  
  // Context
  avgVolume7d: number | null;  // If historical data available
  volumeRatio: number;         // current / average (>3x = notable)
  premiumUsd: number;          // Estimated premium spent (volume × mark price × spot)
  
  // Interpretation
  sentiment: "bullish" | "bearish" | "neutral";
  significance: "low" | "medium" | "high";
  description: string;         // "1,250 BTC-90K-C contracts traded (5.2x avg volume). $2.1M premium spent on upside calls."
}
```

**Detection logic:**

```typescript
function detectFlowAnomalies(
  currentChain: OptionsChainEntry[],
  previousChain: OptionsChainEntry[] | null,
  spotPrice: number
): FlowAnomaly[] {
  const anomalies: FlowAnomaly[] = [];
  
  for (const opt of currentChain) {
    // Skip very illiquid instruments
    if (opt.volume24h < 10) continue;
    
    // Find same instrument in previous snapshot
    const prev = previousChain?.find(p => p.instrumentName === opt.instrumentName);
    
    // Volume spike: volume > 3x typical (use OI as proxy for "typical" if no history)
    const volumeThreshold = Math.max(opt.openInterest * 0.1, 50);
    if (opt.volume24h > volumeThreshold * 3) {
      const premiumUsd = opt.volume24h * opt.markPrice * spotPrice;
      anomalies.push({
        instrument: opt.instrumentName,
        anomalyType: "volume_spike",
        volumeRatio: opt.volume24h / Math.max(volumeThreshold, 1),
        premiumUsd,
        sentiment: opt.optionType === "call" ? "bullish" : "bearish",
        significance: premiumUsd > 1000000 ? "high" : premiumUsd > 100000 ? "medium" : "low",
        description: `${opt.volume24h} contracts traded (${(opt.volume24h / volumeThreshold).toFixed(1)}x typical). $${(premiumUsd / 1000000).toFixed(1)}M premium on ${opt.strike} ${opt.optionType}.`,
        // ... other fields
      });
    }
    
    // OI surge: OI changed > 20% since last snapshot
    if (prev && prev.openInterest > 10) {
      const oiChange = opt.openInterest - prev.openInterest;
      const oiChangePct = oiChange / prev.openInterest * 100;
      if (Math.abs(oiChangePct) > 20) {
        anomalies.push({
          anomalyType: "oi_surge",
          oiChange,
          oiChangePct,
          sentiment: oiChange > 0 
            ? (opt.optionType === "call" ? "bullish" : "bearish")
            : (opt.optionType === "call" ? "bearish" : "bullish"),
          significance: Math.abs(oiChange) > 500 ? "high" : "medium",
          description: `OI ${oiChange > 0 ? "surged" : "dropped"} ${Math.abs(oiChangePct).toFixed(0)}% (${oiChange > 0 ? "+" : ""}${oiChange} contracts) on ${opt.strike} ${opt.optionType}.`,
        });
      }
    }
    
    // Large single-instrument premium (> $500K in 24h on one strike)
    const premiumUsd = opt.volume24h * opt.markPrice * spotPrice;
    if (premiumUsd > 500000) {
      anomalies.push({
        anomalyType: "large_premium",
        premiumUsd,
        significance: premiumUsd > 5000000 ? "high" : premiumUsd > 1000000 ? "medium" : "low",
        description: `$${(premiumUsd / 1000000).toFixed(1)}M premium flow into ${opt.strike} ${opt.optionType} (${opt.daysToExpiry}d expiry).`,
      });
    }
  }
  
  // Sort by significance then premium
  return anomalies
    .sort((a, b) => {
      const sigOrder = { high: 0, medium: 1, low: 2 };
      return (sigOrder[a.significance] - sigOrder[b.significance]) || (b.premiumUsd - a.premiumUsd);
    })
    .slice(0, 20); // Top 20 anomalies
}
```

---

## 5. API Routes

### New Routes

| Route | Method | Source | Purpose |
|---|---|---|---|
| `/api/market/options/gex` | GET | Quant Engine `/gex` | Gamma exposure by strike |
| `/api/market/options/dex` | GET | Quant Engine `/dex` | Delta exposure by strike |
| `/api/market/options/greeks-exposure` | GET | Quant Engine `/greeks-exposure` | Vanna + charm exposure |
| `/api/market/options/pin-risk` | GET | TypeScript (direct) | Max pain + pin risk assessment |
| `/api/market/options/flow` | GET | TypeScript (direct) | Options flow anomaly scanner |

All routes follow the same on-demand warming pattern from the cache warming PRD:
1. Check Redis cache → return if fresh
2. If miss → warm cache (fetch chain if needed, dispatch to Quant Engine)
3. If still null → return 503 with appropriate message

**Cache keys and TTLs:**

| Cache Key | TTL | Populated By |
|---|---|---|
| `options:gex:{asset}` | 3600s | refresh-options cron |
| `options:dex:{asset}` | 3600s | refresh-options cron |
| `options:greeks-exposure:{asset}` | 3600s | refresh-options cron |
| `options:pin-risk:{asset}` | 3600s | Computed inline (TypeScript) |
| `options:flow:{asset}` | 1800s | Computed inline (TypeScript), shorter TTL for freshness |

### Cron Update

Add GEX, DEX, and greeks-exposure dispatch to the existing `refresh-options` cron, alongside the existing vol-surface/rnd/skew/vol-cone/vrp dispatches:

```typescript
// In refresh-options cron, after existing Quant Engine dispatches:
if (quantEngine.configured) {
  // ... existing dispatches (vol-surface, rnd, skew, vol-cone, vrp) ...
  
  // Phase 4 additions:
  const gexResult = await quantEngine.computeGEX({ asset, spot_price, options: chainEntries });
  if (gexResult) await setCached(`options:gex:${asset}`, gexResult, 3600);
  
  const dexResult = await quantEngine.computeDEX({ asset, spot_price, options: chainEntries });
  if (dexResult) await setCached(`options:dex:${asset}`, dexResult, 3600);
  
  const greeksResult = await quantEngine.computeGreeksExposure({ asset, spot_price, options: chainEntries });
  if (greeksResult) await setCached(`options:greeks-exposure:${asset}`, greeksResult, 3600);
}
```

### QuantEngineClient Update

Add 3 new methods to `lib/quant-engine.ts`:

```typescript
async computeGEX(input: GEXInput): Promise<GEXOutput | null>
async computeDEX(input: DEXInput): Promise<DEXOutput | null>
async computeGreeksExposure(input: GreeksExposureInput): Promise<GreeksExposureOutput | null>
```

Same inert-mode pattern — return null when `QUANT_ENGINE_URL` is unset.

---

## 6. Frontend

### 6.1 New Tabs in Volatility Section

Add 4 new tabs to `/terminal/volatility/page.tsx`:

```typescript
const TABS = [
  // ... existing Phase 3 tabs (Overview, Vol Surface, RND, Skew, Term, Vol Cone, VRP) ...
  { label: "GEX", value: "gex" },
  { label: "DEX", value: "dex" },
  { label: "Vanna/Charm", value: "vanna_charm" },
  { label: "Flow", value: "flow" },
] as const;
```

**Tab count concern:** 11 tabs total after Phase 4. If this feels like too many, group them:
- Group 1 (Market View): Overview, Vol Surface, Skew, Term Structure
- Group 2 (Risk/Probability): RND, Vol Cone, VRP
- Group 3 (Positioning): GEX, DEX, Vanna/Charm, Flow

Use a tab row with horizontal scroll on mobile, or a dropdown group selector. Implementation detail for Claude Code to decide.

### 6.2 GEX View

**Component:** `components/volatility/GEXView.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  BTC Gamma Exposure (GEX)                           │
│  Regime: POSITIVE GAMMA  [green badge]              │
│  "Dealers net long gamma — expect dampened moves"   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Bar chart: GEX by Strike]                         │
│                                                     │
│  Green bars = positive gamma (stabilizing)           │
│  Red bars = negative gamma (amplifying)              │
│                                                     │
│  ──── Spot Price: $84,520 ────                       │
│  ──── Gamma Flip: $83,500 ---- (dashed)              │
│                                                     │
│  Call Wall: $90,000 (highest positive GEX)           │
│  Put Wall: $78,000 (most negative GEX)              │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Interpretation:                                    │
│  • Above spot: Positive gamma cluster at 84K-88K    │
│    creates resistance                               │
│  • Below spot: Negative gamma below 83.5K — breaks  │
│    below this could accelerate downside              │
│  • Regime: Mean-reversion strategies favored         │
└─────────────────────────────────────────────────────┘
```

**Bar chart rendering:** SVG bar chart with strikes on X axis, GEX value on Y axis. Green bars for positive, red for negative. Vertical dashed line at spot price, another at gamma flip. Call wall and put wall marked with labels.

### 6.3 GEX + Liquidation Overlay

**Cross-domain synthesis feature.** Overlay GEX data onto the price chart (from Phase 2's chart toolbar system).

Add a new toggle to the chart toolbar: "GEX Zones"

When enabled:
- Color the price chart background in bands:
  - Green tint where GEX is positive (above gamma flip)
  - Red tint where GEX is negative (below gamma flip)
- Mark the gamma flip level with a dashed line
- If negative gamma zones overlap with Phase 2's liquidation heatmap clusters → highlight as "CASCADE RISK" zone with a warning marker

This overlay is on the **derivatives terminal** price chart (`/terminal/derivatives`), not the volatility section. It bridges the two sections.

### 6.4 DEX View

**Component:** `components/volatility/DEXView.tsx`

Similar bar chart layout to GEX but showing delta exposure per strike. Color: blue for long delta, orange for short delta. Include net DEX summary and directional bias label.

### 6.5 Vanna/Charm View

**Component:** `components/volatility/VannaCharmView.tsx`

Two-panel layout:

**Top panel: Vanna Exposure**
- Bar chart by strike
- Net vanna summary
- Interpretation: "If IV drops by 5 points, dealers will need to buy/sell X BTC to re-hedge"

**Bottom panel: Charm Exposure**
- Bar chart by strike
- Time decay bias label
- Interpretation: "With 3 days to expiry, time decay is pushing dealer delta [direction], creating [buying/selling] pressure"

### 6.6 Options Flow Scanner

**Component:** `components/volatility/FlowScannerView.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  Options Flow Scanner — BTC                         │
│  Showing unusual activity in the last 24h           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Table: sorted by significance]                    │
│                                                     │
│  Significance | Type    | Instrument      | Detail  │
│  ──────────────────────────────────────────────────  │
│  🔴 HIGH     | VOLUME  | BTC-90K-C Jun   | 1,250   │
│              |         |                 | contracts│
│              |         |                 | 5.2x avg │
│              |         |                 | $2.1M    │
│  ──────────────────────────────────────────────────  │
│  🟡 MEDIUM   | OI SURGE| BTC-78K-P May   | +340    │
│              |         |                 | contracts│
│              |         |                 | +45% OI  │
│  ──────────────────────────────────────────────────  │
│                                                     │
│  Net Premium Flow:                                  │
│  Calls: $8.2M | Puts: $3.1M | Ratio: 2.6x bullish  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Colored significance badges (red = high, yellow = medium, gray = low). Expandable rows with full instrument details. Net call vs put premium summary at the bottom.

### 6.7 Max Pain / Pin Risk (Enhance Existing)

Phase 3's Overview tab already shows max pain. Phase 4 adds the pin risk assessment as a card below it:

```
┌─────────────────────────────────────────────────┐
│  Max Pain & Pin Risk — BTC May Expiry           │
│                                                 │
│  Max Pain Strike: $85,000                       │
│  Current Price:   $84,520 (0.56% away)          │
│  Days to Expiry:  3                             │
│                                                 │
│  Pin Risk: MODERATE [yellow badge]              │
│  OI Concentration at Max Pain: 12.3%            │
│                                                 │
│  "Price is within 0.6% of max pain with 3 days  │
│   to expiry. Moderate pinning probability."     │
└─────────────────────────────────────────────────┘
```

---

## 7. Cross-Domain Synthesis

### 7.1 Regime Classifier Enrichment

Add gamma regime to the health score / regime classifier (built in Phase 2):

| Input | Source | Signal |
|---|---|---|
| Gamma regime | GEX output | positive_gamma → stabilizing, negative_gamma → volatile |
| Skew direction | Phase 3 skew | Negative skew → put demand → hedging activity |
| IV percentile | Phase 3 vol cone | High IV → expensive options → possible regime shift |

Update `computeHealthScore()` to accept optional `options` inputs:

```typescript
interface OptionsRegimeInput {
  gammaRegime?: "positive_gamma" | "negative_gamma";
  skew25d?: number;
  ivPercentile?: number;
}

// In health score computation:
if (optionsInput?.gammaRegime === "negative_gamma") {
  // Negative gamma amplifies moves — increase volatility expectation
  healthScore.regime = adjustForGammaRegime(healthScore.regime, "negative_gamma");
}
```

### 7.2 Alert Types

Add new alert types:

| Type | Condition | Example |
|---|---|---|
| `gamma_flip_crossed` | `crosses_above` / `crosses_below` | "BTC crossed below gamma flip at $83,500" |
| `gex_regime_change` | `detected` | "BTC gamma regime shifted from positive to negative" |
| `flow_anomaly` | `detected` | "High-significance volume spike on BTC-90K-C" |
| `pin_risk_high` | `above` | "BTC pin risk exceeded 40% for May expiry" |

Add to alert evaluator and type enum.

---

## 8. Database Changes

### New Model

```prisma
// Persist GEX snapshots for the GEX heatmap over time
model GEXSnapshot {
  id          String   @id @default(cuid())
  asset       String
  
  // Key levels
  gammaFlip   Float
  totalGex    Float
  regime      String                          // "positive_gamma" | "negative_gamma"
  callWall    Float
  putWall     Float
  
  // Full GEX data stored as JSON (levels array)
  levelsData  Json
  
  spotPrice   Float
  timestamp   DateTime
  createdAt   DateTime @default(now())
  
  @@unique([asset, timestamp])
  @@index([asset, timestamp])
}
```

Persist hourly in the refresh-options cron (same pattern as VolSurfaceSnapshot). Used to power the GEX Heatmap Over Time visualization.

### GEX Heatmap Over Time

**API Route:** `GET /api/market/options/gex-history?asset=BTC&days=7`

Reads from `GEXSnapshot` table. Returns a 2D array (time × strike → GEX value) suitable for a heatmap.

**Component:** `components/volatility/GEXHeatmap.tsx`

2D heatmap: X axis = time (hourly snapshots), Y axis = strike, color = GEX intensity (green positive, red negative). Spot price line overlaid. Shows how dealer positioning shifts over days — regime transitions visible as color changes.

---

## 9. File Structure

### New Files

```
# Quant Engine additions (Python)
quant-engine/app/routes/gex.py                   # POST /gex
quant-engine/app/routes/dex.py                   # POST /dex
quant-engine/app/routes/greeks_exposure.py        # POST /greeks-exposure
quant-engine/app/core/gex.py                     # GEX computation
quant-engine/app/core/dex.py                     # DEX computation
quant-engine/app/core/vanna_charm.py             # Vanna + charm computation

# Frontend — new API routes
app/api/market/options/gex/route.ts
app/api/market/options/dex/route.ts
app/api/market/options/greeks-exposure/route.ts
app/api/market/options/pin-risk/route.ts
app/api/market/options/flow/route.ts
app/api/market/options/gex-history/route.ts

# Frontend — new components
components/volatility/GEXView.tsx
components/volatility/GEXHeatmap.tsx
components/volatility/DEXView.tsx
components/volatility/VannaCharmView.tsx
components/volatility/FlowScannerView.tsx
components/volatility/PinRiskCard.tsx

# Frontend — new hooks
hooks/useGEX.ts
hooks/useDEX.ts
hooks/useGreeksExposure.ts
hooks/usePinRisk.ts
hooks/useFlowScanner.ts
hooks/useGEXHistory.ts

# TypeScript computation
lib/options/pin-risk.ts                          # Pin risk assessment
lib/options/flow-scanner.ts                      # Flow anomaly detection

# Types
types/options.ts                                 # Extend with GEX/DEX/GreeksExposure/PinRisk/FlowAnomaly types
```

### Files to Modify

```
# Quant Engine
quant-engine/app/main.py                         # Register 3 new routes
quant-engine/app/models/inputs.py                # Add GEXInput, DEXInput, GreeksExposureInput
quant-engine/app/models/outputs.py               # Add GEXOutput, DEXOutput, GreeksExposureOutput

# Frontend
lib/quant-engine.ts                              # Add computeGEX, computeDEX, computeGreeksExposure methods
app/api/cron/refresh-options/route.ts            # Add GEX/DEX/greeks dispatch + GEXSnapshot persistence
app/(app)/terminal/volatility/page.tsx           # Add 4 new tabs
app/api/alerts/route.ts                          # Add 4 new alert types
lib/alerts/evaluator.ts                          # Add gamma_flip, gex_regime, flow_anomaly, pin_risk cases
lib/market/health.ts                             # Accept optional gamma regime input
prisma/schema.prisma                             # Add GEXSnapshot model
config/navigation.ts                             # No change (Volatility already enabled)

# Cross-domain overlay
components/terminal/ChartToolbar.tsx              # Add "GEX Zones" toggle
# Price chart component                          # Render GEX zone overlay when toggle is on
```

---

## 10. Implementation Order

1. **Prisma migration** — add GEXSnapshot model
2. **Types** — extend `types/options.ts` with GEX/DEX/GreeksExposure/PinRisk/FlowAnomaly types
3. **QuantEngineClient** — add 3 new methods to `lib/quant-engine.ts`
4. **Quant Engine Python** — implement `/gex`, `/dex`, `/greeks-exposure` endpoints + core computation modules
5. **Pin risk** — `lib/options/pin-risk.ts` (TypeScript, no Quant Engine)
6. **Flow scanner** — `lib/options/flow-scanner.ts` (TypeScript, no Quant Engine)
7. **API routes** — 6 new routes following cache-first + on-demand warming pattern
8. **Cron update** — add GEX/DEX/greeks dispatch + GEXSnapshot persistence
9. **Hooks** — 6 new SWR hooks
10. **Frontend views** — GEXView, GEXHeatmap, DEXView, VannaCharmView, FlowScannerView, PinRiskCard
11. **Tab integration** — add 4 tabs to volatility page
12. **GEX overlay on derivatives chart** — chart toolbar toggle + zone rendering
13. **Alert types** — add 4 new types to evaluator
14. **Regime enrichment** — add gamma regime to health score
15. **Deploy Quant Engine update** — push new endpoints to Railway

---

## 11. Definition of Done

### Quant Engine
- [ ] `/gex` returns gamma exposure per strike with gamma flip, regime, call/put walls
- [ ] `/dex` returns delta exposure per strike with directional bias
- [ ] `/greeks-exposure` returns vanna and charm exposure with interpretations
- [ ] All 3 endpoints handle edge cases (sparse chains, illiquid options) gracefully

### Frontend
- [ ] GEX tab shows bar chart with positive/negative bars, spot line, gamma flip line
- [ ] GEX heatmap shows gamma positioning evolution over time
- [ ] DEX tab shows delta exposure bar chart with directional bias
- [ ] Vanna/Charm tab shows two-panel exposure view with interpretations
- [ ] Flow Scanner tab shows table of unusual activity sorted by significance
- [ ] Pin risk card shows max pain + pin probability in Overview tab
- [ ] All views have plain-English interpretations
- [ ] All views show UnavailableBanner when Quant Engine is inert

### Integration
- [ ] GEX Zones toggle in derivatives chart toolbar renders colored price bands
- [ ] GEX + liquidation heatmap overlap flagged as cascade risk zones
- [ ] 4 new alert types working (gamma_flip, gex_regime, flow_anomaly, pin_risk)
- [ ] Regime classifier accepts gamma regime input
- [ ] GEXSnapshot persisting hourly to PostgreSQL
- [ ] GEX history queryable for heatmap

### Technical
- [ ] Zero TypeScript errors, build passes
- [ ] Quant Engine endpoints respond within 500ms
- [ ] On-demand cache warming works for all new routes

---

## 12. What This Enables

Phase 4 completes the options analytics suite. After this:

- **Phase 5 (On-Chain):** The GEX regime becomes an input to the cross-domain convergence scorer alongside on-chain signals. "Negative gamma regime + whale exchange inflows + extreme funding" is a multi-domain convergence signal that no single-source platform can produce.
- **Phase 6 (Regime & Convergence):** The full feature set — derivatives positioning, options microstructure, and on-chain flows — feeds the regime classifier and convergence engine. Phase 4's gamma regime is one of the highest-signal inputs.
- **User value:** A retail trader seeing "BTC is in negative gamma territory below $83.5K — if it breaks this level, dealer hedging will amplify the downside move" is getting insight that was previously available only to institutional vol desks.

---

*This PRD should be treated as the authoritative specification. Claude Code should present an implementation plan with architecture decision questions before beginning work.*
